import "server-only";
import { google } from "googleapis";

/**
 * The leads spreadsheet.
 *
 * This is the system of record for live lead routing. The Neon `marketing_consent`
 * table still holds the consent evidence, and Resend still holds the mailing list;
 * neither is a place a person can work a lead from. The sheet is, which is the
 * whole reason it exists.
 *
 * Columns A–L are written by this file on every submission. M–R are left alone —
 * they are CRM columns edited by hand (status, notes, next action), and an append
 * that touched them would overwrite work. That split is why the append range is
 * A:R while the row we send is only twelve values long: Sheets fills the row from
 * the left and leaves the rest of the range untouched.
 *
 * `insertDataOption: "INSERT_ROWS"` rather than the default OVERWRITE, so a row is
 * inserted below the last populated one instead of being written into whatever
 * happens to be sitting there. `valueInputOption: "RAW"` so nothing is parsed:
 * a phone number in E.164 starts with `+`, and USER_ENTERED would try to read that
 * as a formula.
 */

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

/**
 * The tab these ranges point at.
 *
 * Quoted in the A1 notation below because the name contains spaces. Unquoted,
 * Google reads `Lead gen master!A:R` as a malformed range and every call comes
 * back 400 "Unable to parse range" — which reads like a permissions problem and
 * isn't one. Renaming the tab in Sheets means changing this string, and nothing
 * else will tell you that you forgot.
 */
const SHEET_TAB = "Lead gen master";

/** Append target. See the note above on why this is A:R and not A:L. */
const APPEND_RANGE = `'${SHEET_TAB}'!A:R`;

/** Column A alone, for the row count the health check reports. */
const COUNT_RANGE = `'${SHEET_TAB}'!A:A`;

/**
 * The private key arrives from the environment with its newlines escaped.
 *
 * Vercel (and every other dashboard that takes a multi-line secret as a single
 * line) stores `\n` as two characters. Google's JWT signer needs real newlines or
 * it fails with an opaque `error:1E08010C:DECODER routines::unsupported`, which
 * says nothing at all about the actual cause. Unescaped here, once, on read.
 */
function privateKey(): string | undefined {
  const raw = process.env.GOOGLE_PRIVATE_KEY;
  return raw ? raw.replace(/\\n/g, "\n") : undefined;
}

/**
 * Whether the three Google variables are all present.
 *
 * Checked rather than assumed so a missing variable produces a named error at the
 * point of use instead of a stack trace from inside googleapis.
 */
export const SHEETS_CONFIGURED = Boolean(
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    process.env.GOOGLE_SHEET_ID
);

function client() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = privateKey();
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  const missing = [
    !clientEmail && "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    !key && "GOOGLE_PRIVATE_KEY",
    !spreadsheetId && "GOOGLE_SHEET_ID",
  ].filter(Boolean);

  if (missing.length > 0 || !clientEmail || !key || !spreadsheetId) {
    throw new Error(`Google Sheets is not configured: ${missing.join(", ")} unset`);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: clientEmail, private_key: key },
    scopes: SCOPES,
  });

  return { sheets: google.sheets({ version: "v4", auth }), spreadsheetId };
}

/**
 * One lead, in the order the columns are laid out.
 *
 * A named shape rather than a bare array because the column order is the one
 * thing here that cannot be got wrong silently — a swapped pair of strings still
 * appends successfully and lands in the sheet looking almost right.
 */
export interface LeadRow {
  /** Pacific local time, sortable as text. */
  timestamp: string;
  name: string;
  email: string;
  /** E.164. */
  phone: string;
  /** Whether they agreed to be contacted about their results. */
  consent: boolean;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  fbclid: string;
  landingPage: string;
  referrer: string;
}

/** Column A–L, in order. Changing this changes the sheet; change the headers too. */
export const LEAD_COLUMNS = [
  "Timestamp",
  "Name",
  "Email",
  "Phone",
  "Consent",
  "UTM Source",
  "UTM Medium",
  "UTM Campaign",
  "UTM Content",
  "FBCLID",
  "Landing Page",
  "Referrer",
] as const;

function toValues(row: LeadRow): string[] {
  return [
    row.timestamp,
    row.name,
    row.email,
    row.phone,
    row.consent ? "Yes" : "No",
    row.utmSource,
    row.utmMedium,
    row.utmCampaign,
    row.utmContent,
    row.fbclid,
    row.landingPage,
    row.referrer,
  ];
}

/**
 * Append a lead. Throws on failure — the caller is expected to catch and route
 * the payload to ALERT_EMAIL rather than let a lead disappear.
 */
export async function appendLead(row: LeadRow): Promise<void> {
  const { sheets, spreadsheetId } = client();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: APPEND_RANGE,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [toValues(row)] },
  });
}

export interface SheetsHealth {
  /** Rows with anything in column A, header included. */
  totalRows: number;
  /** Rows below the header, i.e. actual leads, floored at zero. */
  leadRows: number;
  /** Title of the spreadsheet the credentials actually reached. */
  spreadsheetTitle: string;
  /** The service account the JWT was signed for. */
  serviceAccount: string;
}

/**
 * Prove the credentials work and say how much is in the sheet.
 *
 * Two calls rather than one on purpose: the metadata read confirms the service
 * account can see the spreadsheet at all (the usual failure is a sheet that was
 * never shared with it), and the values read confirms the `Leads` tab exists and
 * is named exactly that. Either failing tells you which of the two is wrong,
 * which one combined call would not.
 */
export async function sheetsHealth(): Promise<SheetsHealth> {
  const { sheets, spreadsheetId } = client();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title",
  });

  const values = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: COUNT_RANGE,
  });

  const totalRows = values.data.values?.length ?? 0;

  return {
    totalRows,
    leadRows: Math.max(0, totalRows - 1),
    spreadsheetTitle: meta.data.properties?.title ?? "(untitled)",
    serviceAccount: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "(unset)",
  };
}
