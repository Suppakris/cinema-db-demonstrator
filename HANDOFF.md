# Handoff

## Current phase

Core movie-to-booking flow implemented; not yet linted, built, or visually checked.

## Completed

- Replaced the starter page with a responsive cinema catalog, screening picker, seat map, contact/payment form, confirmation, SQL trace, and before/after summary.
- Added live MySQL read APIs for movies, upcoming showtimes, seats, and payment methods; added a transactional booking API with seat uniqueness checks and idempotency.
- Added one approved future screening in the configured MySQL database: showtime **8**, Oppenheimer, Theater 1, Friday 2026-10-09 at 15:00–18:00. It uses existing seat and weekday price rows.

## Relevant files

- `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`
- `src/app/api/movies/route.ts`
- `src/app/api/showtimes/route.ts`
- `src/app/api/showtimes/[showtimeId]/seats/route.ts`
- `src/app/api/bookings/route.ts`
- `src/lib/db.ts` (existing MySQL pool)

## Decisions and constraints

- MySQL is the source of truth. The configured live schema was inspected; no `.sql` file is in the repo.
- There is no `showtime_seat` table. A `ticket` row marks a seat booked for a showtime; the unique `(Showtime_ID, Seat_ID)` key prevents duplicate sales.
- Payment is simulated and recorded as `SUCCESS`; no gateway is called. Booking submission writes customer, booking, ticket, and payment rows to live MySQL.
- The seeded available showtimes were from March 2026. Only Oppenheimer currently has an upcoming screening; the other catalog titles show no upcoming screenings.
- Do not create a booking as part of validation; it would write persistent customer and transaction records.

## Exact next step

Run `pnpm lint` and `pnpm build`, fix any reported issues, then visually inspect the flow. Do not submit the booking form during checks.
