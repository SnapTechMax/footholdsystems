import { redirect } from "next/navigation";

/**
 * /admin, which used to be the overview dashboard.
 *
 * The overview counted guide views, downloads and sequence enrolments for a
 * funnel that no longer exists, so it was deleted rather than repointed: a
 * dashboard of numbers that stopped moving is not neutral, it is misleading.
 *
 * A redirect rather than a deleted route, because /admin is the URL that gets
 * typed and bookmarked, and landing on a 404 behind a password prompt reads as
 * the site being broken rather than as a page having moved. Outreach is the
 * screen with daily work on it, so that is where it goes.
 */
export default function AdminIndex() {
  redirect("/admin/outreach");
}
