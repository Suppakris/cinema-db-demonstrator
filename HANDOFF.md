# Handoff

## Resume point — 2026-10-11

The latest task added the Analytics page, updated the named-film posters, and synchronized the demo seed to the production Aiven database. This section is the current state and supersedes older notes below where they conflict.

### Completed in the latest session

- Added `/analytics` with five database views: booking statistics, membership usage, theater type sales, monthly movie ranking, and movie review summary. Each chart shows the SQL that produces its data.
- Added `src/app/api/analytics/[view]/route.ts`, `src/lib/analytics-views.ts`, and the Analytics navigation entry in `src/components/workspace-frame.tsx`.
- Added `.db-seed.cjs`, a repeatable synthetic activity seed. It has been applied to both local MySQL and production Aiven: 154 showtimes, 828 bookings, 3,573 tickets, 127 M Pass redemption rows, and 64 example.test customers. It tags demo bookings with `Channel_Type=DEMO_ANALYTICS`.
- Added `.db-real-movies.cjs` and applied seven named film records to local MySQL and production Aiven: Dune: Part Two, Oppenheimer, Barbie, Spider-Man: Across the Spider-Verse, Godzilla Minus One, Top Gun: Maverick, and How to Make Millions Before Grandma Dies. Their records include posters, synopses, genres, director and lead-actor credits, studios, original release entries, and 14 IMDb/Rotten Tomatoes score snapshots with source URLs. The scores were checked on 2026-10-11 and are snapshots, not a live feed.
- Updated the monthly ranking and review chart queries to exclude the remaining `Demo Movie` placeholders. The booking, membership, and theater charts still use synthetic demo transactions, called out on the page.
- Added [the analytics data audit](docs/analytics-data-audit.md), which explains the seeds and prior relationship checks.
- Pushed commit `da9522f` to GitHub `master` and deployed the final app to Vercel. Production health reports the Aiven database connected; `/api/movies` returns all seven real titles with posters and `/api/analytics/bookings` returns seeded data.
- The temporary authenticated production-seed route and its one-time token were removed after the Aiven update. They will not be included in the final deployment.
- Added a rolling upcoming-showtime seed for the seven named films. It uses existing theater capacity, language, and price rows; creates only `AVAILABLE` showtimes with no bookings; and maintains at least two future screenings per named film. Applied nine new screenings to Aiven. The live `/api/movies` counts are 2, 2, 2, 2, 2, 2, and 3 in catalog order.
- Optimized `.db-seed.cjs` marker checks to use a prefix set instead of repeatedly scanning every payment key, and made the existing-showtime readback skip an empty `IN` query. The seed plans upcoming sessions against the same `NOW()` boundary the product uses.
- The seven-film metadata seed now replaces demo genres, credits, and release rows for movie IDs 1–7 and adds normalized studio relationships; it does not alter IDs 8–60. The live `/api/movies` endpoint confirms the richer catalog and still shows `Demo Movie 08` as the next placeholder.
- The temporary authenticated catalog-seed route and one-time token were removed after the Aiven update. They are not part of the final deployment.

### Current data status and constraints

- `.env.local` still points to the local MySQL database `cinema_db` (`DB_HOST=localhost`). Production uses the configured Aiven environment. Both databases have 60 movies total: 7 real entries and 53 placeholders. The language table still has 50 `Demo Language` placeholders. All seven theaters remain at Ratchayothin; six other branches have no theaters.
- The audit found 20 pre-existing M Pass redemption rows without a matching zero-price ticket. They were not changed. The new seed creates matching tickets for its own redemptions.
- Existing booking/ticket/payment checks passed before the real-film update. The seven-film catalog seed changes movie metadata and the genre, person-credit, studio, release, and review links only; it does not alter bookings, showtimes, tickets, or payments.
- `.db-real-movies.cjs` defaults to rollback-only preview; `--apply` writes. `--audit` verifies seven complete catalog entries, source-linked review rows, and the remaining 53 placeholder movie titles. `--refresh --apply` refreshes metadata and related rows for IDs 1–7 only.
- `.db-seed.cjs` defaults to rollback-only preview; `--apply` writes. It is idempotent, creates demo historical activity and maintains two upcoming `AVAILABLE` screenings for each named film, with no synthetic bookings on future sessions.

### Resume here

1. Review the production site and `/analytics`; the final deployment passed `pnpm build` and the production health endpoint reports Aiven connected.
2. If a chart cannot load, inspect the response at `/api/analytics/<view>` and verify the Vercel production DB environment still targets Aiven.
3. Decide whether to add more verified films or replace remaining placeholders. Keep the generated transaction history labeled synthetic unless real transaction records are loaded.

The analytics, movie poster, and seed changes were pushed to GitHub `master`. `git diff --check` passed (Git printed existing line-ending warnings).

## System goal

Demonstrate the cinema database through the web interface. Prioritize schema structure, relationships, real MySQL rows, SQL operations and results, transaction flow, and before/after database state. The booking flow is a case study for those concepts, not a commercial ticketing product.

## Current phase

Phase 10 — ERD table-card and responsive Fit-to-view refinements completed. Production build, TypeScript, lint, and diff checks pass. Rendered browser checks verified the fitted ERD at desktop and smaller viewport sizes.

## Completed

- The home page leads with a live schema explorer backed by `GET /api/schema`. It displays the database name, table/view totals, table row total, all object counts, column types/null/defaults, PK/FK/UQ markers, and navigable foreign-key relationships.
- The live movie section shows the SQL read query and returned movie and upcoming-showtime counts. The booking flow continues to show SQL writes, affected rows, and before/after seat state after a committed transaction.
- The mobile seat map has 44px touch targets, horizontal scrolling for wider rows, selected-seat count, and clearer screen-reader labels.
- The booking API passes TypeScript checks after `validText` was marked as a type guard.
- Added future screenings in live MySQL, all with available seats and matching configured prices:
  - **8** Oppenheimer — Theater 1, 2026-10-09 15:00–18:00
  - **9** Dune: Part Two — Krungsri IMAX, 2026-10-09 19:15–22:01
  - **10** How to Make Millions Before Grandma Dies — Theater 1, 2026-10-12 15:00–17:05
  - **11** Spider-Man: Across the Spider-Verse — Theater 1, 2026-10-13 15:00–17:20
  - **12** Godzilla Minus One — Theater 1, 2026-10-15 15:00–17:05
  - **13** The Medium — Theater 1, 2026-10-16 15:00–17:10
  - **14** Top Gun: Maverick — Theater 1, 2026-10-19 15:00–17:11
  - Times are Asia/Bangkok. Six additions use weekday afternoon price slot 1; Dune is scheduled in the IMAX room.
- GitHub `master` was fetched and fast-forwarded to `6a1f6d0`; it adds `Final_Sp222.sql`.

## Relevant files

- `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`
- `src/app/api/movies/route.ts`
- `src/app/api/records/[tableName]/route.ts`
- `src/app/api/bookings/route.ts`
- `src/app/api/transactions/rollback-demo/route.ts`
- `src/app/api/showtimes/route.ts`
- `src/app/api/showtimes/[showtimeId]/seats/route.ts`
- `src/app/api/bookings/route.ts`
- `src/lib/db.ts` (existing MySQL pool)
- `Final_Sp222.sql` (schema script in the GitHub repository)

## Decisions and constraints

- The web interface reads and writes the configured live MySQL database.
- There is no `showtime_seat` table. A `ticket` row marks a seat booked for a showtime; the unique `(Showtime_ID, Seat_ID)` key prevents duplicate sales.
- Payment is simulated and recorded as `SUCCESS`; no gateway is called. Booking submission writes customer, booking, ticket, and payment rows to live MySQL.
- Do not create bookings during validation; that writes persistent customer and transaction records.

## Phase 1 — Database integration audit

- Compared `Final_Sp222.sql` with live `information_schema`: exact match of **31 tables and 4 views**; no missing or extra tables/views. The SQL header's “27 Physical Relational Tables” count is incorrect.
- Verified core PK/FK/unique constraints against live metadata, including `Ticket`'s unique `(Showtime_ID, Seat_ID)` and its composite relationships to booking, seat, and showtime.
- Live row counts: movie 7, branch 7, theater 7, seat 7, showtime 14, booking 8, ticket 8, payment 8. Seven showtimes are upcoming; seven configured seats are in the two Paragon theaters.
- Traced all requested entities from UI through route handler SQL to MySQL (see Phase 1 report in the conversation). Branch and theater are exposed through showtime joins; booking, ticket, and payment have no standalone read endpoints.
- No product code changed in Phase 1. No booking was submitted.

## Phase 2 — Schema Explorer checkpoint

- Added read-only `GET /api/schema`, which queries the active database's `information_schema` and counts records in each discovered table and view.
- Replaced the curated static entity path with a selectable live object browser and column/key/relationship inspector. It displays no fabricated schema entities or row records.
- Runtime endpoint verification returned database `cinema_db`, **31 base tables**, **4 views**, **35 total objects**, and **228 table rows** across the tables. All objects returned columns; the movie PK was `Movie_ID`; showtime FK columns included `Movie_ID` and `Theater_ID`; 37 FK relationships were returned.
- Endpoint row counts matched the Phase 1 live counts for movie (7), branch (7), theater (7), seat (7), showtime (14), booking (8), ticket (8), and payment (8). No booking was created.
- `pnpm lint` and `pnpm build` pass. The build lists `/api/schema` as a dynamic route. No browser visual review was available.

## Phase 3 — Live Data Explorer checkpoint

- Added read-only `GET /api/records/[tableName]` with stable PK ordering, exact filtered row totals, pagination capped at 50 rows, and validated parameterized relationship filters. It rejects views/unknown objects and invalid filter columns.
- Added a live row browser for base tables, row inspection, selected-row field details, and foreign-key navigation in both directions. Composite foreign-key values are passed together to the related query. No demo records are hardcoded.
- Runtime API checks returned live counts matching the schema endpoint for movie (7), branch (7), theater (7), seat (7), showtime (14), booking (8), ticket (8), and payment (8). The movie endpoint returned 7 actual rows/columns and a stable `Movie_ID` primary key; showtime filtering by the selected movie returned its 2 matching rows. A composite ticket filter on `Showtime_ID` and `Seat_ID` returned the matching ticket. Invalid filter columns returned 400; an unknown table returned 404.
- A temporary uniquely named movie was inserted, observed through the records API (1 matching row), deleted, and confirmed absent through the same API (0 matching rows). The probe script and row were removed; no booking was created.
- `pnpm lint`, `pnpm build`, and `git diff --check` pass. No browser surface was available for visual interaction review.

## Phase 4 — Database operation demonstration checkpoint

- The booking API now reads `customer`, `booking`, `ticket`, and `payment` table counts and selected seat/ticket state before inserts. It reads the resulting counts, seat status, created ticket rows, and payment row inside the transaction before committing, then returns those snapshots with affected table names.
- The confirmation panel now shows the transaction path, actual before/after row counts and seat/ticket IDs, affected tables, and parameterized SQL statements with affected-row counts.
- One authorized end-to-end demo booking was committed: Dune: Part Two, Showtime 9, Krungsri IMAX at Paragon Cineplex, seat A1 (Seat_ID 5), 2026-10-09 19:15 Asia/Bangkok. The synthetic contact was `Schema Demo`, `phase4-demo-e0d5627e91f74486959f77fe146fef60@example.test`, phone `+66000000000`.
- **Before:** A1 was available with no ticket; customer 8, booking 8, ticket 8, payment 8.
- **Operation:** `POST /api/bookings`; transaction inserted customer 9, booking 9, ticket 9, and payment 9, then committed. Payment is the existing simulated `SUCCESS` record; total THB 600. The `Seat` row's physical status remains `AVAILABLE` by design; the seat is considered booked for a showtime because Ticket_ID 9 links Seat_ID 5 to Showtime_ID 9.
- **After:** customer 9, booking 9, ticket 9, payment 9; seat API reports A1 `BOOKED`. Independent read-only requests returned exactly one row for booking 9, its demo customer, its ticket, and its payment; payment status `SUCCESS`, amount 600.00.
- No extra booking was submitted. `pnpm lint` and `pnpm build` pass. No browser surface was available to visually inspect the confirmation panel.

## Phase 5 — Transaction / rollback checkpoint

- Added `POST /api/transactions/rollback-demo` and a Transaction Lab control. It inserts a synthetic customer and booking inside a MySQL transaction, deliberately attempts a payment with a nonexistent payment-method FK, catches the FK error, and runs `ROLLBACK`.
- The UI reports each attempted statement and its outcome, before/after row counts, attempted IDs, rows that remain, and the FK failure. The successful COMMIT path remains visible in the Phase 4 confirmation panel.
- Runtime verification returned `transaction: ROLLED_BACK`, expected FK failure, and `noPartialRows: true`. Before and after counts both remained customer 9, booking 9, ticket 9, payment 9. Independent reads confirmed attempted customer 10, booking 10, and related ticket/payment rows all returned zero results.
- The failed transaction consumes MySQL auto-increment values, so gaps may appear; it left no persistent customer, booking, ticket, or payment rows. No additional successful booking was created.
- `pnpm lint`, `pnpm build`, and `git diff --check` pass. No browser surface was available to visually inspect or click the Transaction Lab.

## Phase 6 — Database activity / SQL visualization checkpoint

- Booking and rollback API responses now include timestamped activity events for the API request, transaction start, SELECT validation/snapshot operations, INSERTs, expected FK failure, and COMMIT/ROLLBACK. Each event carries a safe SQL template, table names, outcome, and row count where applicable; bound values, contact data, and idempotency keys are omitted.
- Added a shared activity timeline to both transaction result panels. It displays local Bangkok timestamps, API/transaction/SQL steps, table names, statement outcome, and a clear note that parameter values are omitted.
- Verified commit-side activity with an idempotency replay of existing booking 9: the route returned `replayed: true`, showed API → BEGIN → idempotency SELECT → COMMIT, and did not create a duplicate. Verified rollback-side activity: it showed temporary customer/booking INSERTs → FK failure → ROLLBACK → after-state SELECT; `noPartialRows` remained true.
- The replay and rollback checks left booking/payment counts at 9. Serialized activity contained no demo email, phone, or idempotency key. A fresh committed booking was not created for this activity check.
- `pnpm lint`, `pnpm build`, and `git diff --check` pass. No browser surface was available for visual review of the activity timelines.

## Phase 7 — UI refocus checkpoint

- Navigation now names the primary destinations directly: Schema Explorer, Live Records, and Transaction Lab. The schema footer's live-row link now points to the general records explorer.
- The hero explains the three-minute database-first path and displays the active database name from live schema metadata.
- The schema and row inspector sections are numbered first. Movie selection is relabeled as a booking case study, with compact database-style rows showing Movie_ID and live showtime counts instead of large poster cards. Booking completion copy describes committed records.
- Build and lint pass. The computer-use surface inventory contained no browsers, so the visual experience could not be inspected in a rendered browser.

## Phase 8 — Final verification checkpoint

- `/api/health` reports `ok`; `/api/schema` reports `cinema_db`, 31 tables, 4 views, and 35 total objects. Parsed names from `Final_Sp222.sql` match live `information_schema` exactly (0 table or view differences). All objects expose columns; sampled movie PK, ticket UQ, and showtime FKs match the live schema.
- Read-only row totals from `/api/records` match schema counts for movie 7, branch 7, theater 7, seat 7, showtime 14, booking 9, ticket 9, and payment 9. The 4-row increase from the initial 228 total is the committed Phase 4 customer/booking/ticket/payment.
- The live showtime/seat API reports demo seat A1 `BOOKED`; booking 9, customer 9, ticket 9, and payment 9 each resolve to one row, with the payment `SUCCESS`.
- Invalid booking payload returns 400. Idempotent replay returns booking 9 without creating a duplicate; booking and payment totals remain 9. Phase 5 rollback probe IDs remain absent from customer, booking, ticket, and payment.
- The served home page contains schema, live row, booking case study, and transaction lab sections. `pnpm lint`, `pnpm build`, and `git diff --check` pass.
- No browser was available for visual interaction review. The compact movie-card artwork is generated decorative styling; movie and booking records displayed by APIs come from MySQL.

## Progress checklist

- [x] Phase 0 — Discovery baseline
- [x] Phase 1 — Database integration audit
- [x] Phase 2 — Schema explorer / dashboard
- [x] Phase 3 — Live data explorer
- [x] Phase 4 — Database operation demonstration
- [x] Phase 5 — Transaction / rollback demonstration
- [x] Phase 6 — Database activity / SQL visualization
- [x] Phase 7 — UI refocus
- [x] Phase 8 — Final verification
- [x] Phase 9 — Demo readiness
- [x] Phase 10 — ERD table cards and responsive Fit-to-view

## Phase 9 — Demo readiness

- Added `DEMO_GUIDE.md` with local setup requirements, a three-minute lecturer walkthrough, live endpoint map, and clear notes about persistent booking writes and the repeatable rollback demonstration.
- Replaced the starter README opening with a project description and a direct link to the demo guide.
- Reviewed the guide against the current page, database configuration, and transaction route. `git diff --check` passes. No application code or database state changed in this phase.

## Phase 10 — ERD table cards and responsive Fit-to-view

- Updated `/schema` entity cards to render every column from live schema metadata, including column name, type, PK/FK/UQ markers, nullability, and available default/extra metadata. No table or column definitions are hardcoded in the UI.
- Card widths and heights now accommodate table-like rows. Row placement uses each grid row's tallest card, and canvas bounds include the dynamic card heights and relationship-routing gap to avoid card overlap or clipped lower routes.
- Preserved the existing relationship-routing strategy and table-level connections. Edge endpoints now use each node's actual height.
- Replaced the Fit button's 100% reset with a fitted scale and centered pan based on the current ERD and canvas dimensions. Fit mode recalculates on viewport resize and hides scrollbars; manual zoom or pan returns to the scrollable workspace.
- Browser inspection at 1800×1400 fitted the booking group at 84%; at 1200×900 it refitted at 62%. The diagram remained centered within the canvas at both sizes. This checked the 10-table booking view with 9 internal links.
- Changed `src/app/schema/schema-workspace.tsx` and `src/app/globals.css`. Verification passed: `pnpm build`, `pnpm exec tsc --noEmit`, `pnpm exec eslint src`, and `git diff --check`. Existing line-ending warnings were reported by Git.
- The browser screenshot is a temporary artifact at `%TEMP%\cinema-erd-fit.png`; it is not a project file.

## Next step

The schema view has been visually checked at two desktop viewport sizes. Next, exercise pointer pan, wheel/button zoom, table selection, and relationship selection in-browser, then review the booking and database pages at a narrow mobile viewport. No schema or database changes were made for Phase 10.
