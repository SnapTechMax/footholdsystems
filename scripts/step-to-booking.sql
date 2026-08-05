-- Which sequence email precedes a booked audit.
--
--   psql "$DATABASE_URL" -f scripts/step-to-booking.sql
--
-- The join key is the recipient's email address. Both sides carry it for real:
-- Resend reports data.to[0] on every webhook event, and Calendly puts the
-- invitee's address in payload.email on invitee.created. Both are lowercased on
-- the way in (cleanRecipient in lib/tracking.ts, and .toLowerCase() in the
-- Calendly route), so they compare directly without normalising here.
--
-- Two credit models, because either alone misleads:
--
--   last touch  the click immediately before the booking. The number to judge a
--               single email on.
--   assisted    every email clicked at any point before booking. The number to
--               judge a *cut* on — an email with no last-touch bookings may
--               still be the one that makes email 19 land, and dropping it on
--               the first column alone would be a mistake.
--
-- Last-touch figures sum to the number of attributed bookings. Assisted figures
-- sum to more than that, on purpose.
--
-- Only clicks at or before the booking count. Sends continue until the Calendly
-- webhook marks the contact booked, so a later click is a real click on an email
-- that cannot have caused a booking which already happened.

WITH clicks AS (
  SELECT recipient AS email, email_key, occurred_at
  FROM email_events
  WHERE event_type = 'clicked'
    AND email_key IS NOT NULL
    AND recipient IS NOT NULL
),
bookings AS (
  -- First booking per person. A later re-book after a cancellation is the same
  -- person converting once, and counting both would credit two emails for one.
  SELECT email, MIN(created_at) AS booked_at
  FROM sequence_bookings
  WHERE status = 'booked'
  GROUP BY email
),
last_touch AS (
  SELECT DISTINCT ON (b.email)
         b.email, b.booked_at, c.email_key, c.occurred_at
  FROM bookings b
  JOIN clicks c ON c.email = b.email AND c.occurred_at <= b.booked_at
  ORDER BY b.email, c.occurred_at DESC
),
assisted AS (
  SELECT DISTINCT b.email, c.email_key
  FROM bookings b
  JOIN clicks c ON c.email = b.email AND c.occurred_at <= b.booked_at
)
SELECT s.email_key                        AS step,
       COUNT(DISTINCT s.email)::int       AS clickers,
       COALESCE(lt.n, 0)::int             AS booked_last_touch,
       COALESCE(a.n, 0)::int              AS booked_assisted,
       ROUND(lt.median_hours::numeric, 1) AS median_hours_to_book
FROM clicks s
LEFT JOIN (
  SELECT email_key,
         COUNT(*)::int AS n,
         PERCENTILE_CONT(0.5) WITHIN GROUP (
           ORDER BY EXTRACT(EPOCH FROM (booked_at - occurred_at)) / 3600
         ) AS median_hours
  FROM last_touch
  GROUP BY email_key
) lt ON lt.email_key = s.email_key
LEFT JOIN (
  SELECT email_key, COUNT(*)::int AS n FROM assisted GROUP BY email_key
) a ON a.email_key = s.email_key
GROUP BY s.email_key, lt.n, a.n, lt.median_hours
ORDER BY booked_last_touch DESC, clickers DESC;

-- Note: an email nobody has clicked does not appear at all, because the outer
-- query is built from clicks. That is the right shape for "which step precedes a
-- booking" but the wrong shape for "which of the 22 is dead weight" — for that,
-- left-join this against SEQUENCE_STEPS, which lib/tracking.ts getStepToBooking()
-- leaves to the caller for the same reason.
