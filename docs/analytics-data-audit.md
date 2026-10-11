# Analytics data seed and audit

Snapshot taken 2026-10-11 from the local `cinema_db` configured in `.env.local` (`DB_HOST=localhost`). The production Aiven database was not changed.

## Seed added

Run `node .db-seed.cjs` to preview the transaction and roll it back. Run `node .db-seed.cjs --apply` to commit it. The script is repeatable: a second run adds no duplicate rows. It adds synthetic historical showtimes and confirmed bookings using existing movies, halls, seat inventory, price rules, active membership cards, and payment reference rows. Demo bookings use `Channel_Type=DEMO_ANALYTICS`; demo customers use `@example.test` addresses. No existing rows are updated or deleted.

Applied locally: 154 showtimes, 828 bookings, 3,573 tickets, 127 M Pass redemption rows, and 64 synthetic customer accounts. The generated showtimes span November 2025 through September 2026; the existing October 2026 records remain.

After seeding, the main table totals are 301 showtimes, 850 bookings, 3,594 tickets, and 125 customers. The membership view now has ticket activity for all six tiers. Theater-type sales have activity across all seven theater formats.

## Real film and review records

Run `node .db-real-movies.cjs` for a rollback-only preview. Run `node .db-real-movies.cjs --apply` to update the local catalog. The script only accepts the localhost database and only replaces the expected first seven `Demo Movie` placeholders. It updates movie title, original release date, runtime, age rating, and the existing IMDb/Rotten Tomatoes review rows. It does not alter bookings, showtimes, tickets, payment rows, or other catalog relationships.

Applied locally: Dune: Part Two, Oppenheimer, Barbie, Spider-Man: Across the Spider-Verse, Godzilla Minus One, Top Gun: Maverick, and How to Make Millions Before Grandma Dies. IMDb user ratings and Rotten Tomatoes Tomatometer scores are source snapshots checked on 2026-10-11, not an automatic live feed. The remaining 53 movie records are still placeholders. Analytics movie rankings and review summaries exclude `Demo Movie` titles; the booking, membership, and theater charts still show synthetic demonstration transactions.

## Existing data findings

- Before replacing seven placeholders, the catalog had 60 demonstration movie titles with consecutive dates in January and February 2020. The first seven now have real titles, release dates, runtimes, ratings, and source-linked review snapshots; 53 placeholders remain.
- The seven updated movies retain the two configured normalized review rows, now with checked IMDb and Rotten Tomatoes scores and direct source URLs. The other 53 movies still have demonstration review scores and are excluded from the review chart.
- The language table contains ten named languages and 50 `Demo Language` placeholders.
- All seven theaters are at the Ratchayothin branch. The other six branch records have no theaters.
- The database had 20 M Pass redemption records without a matching zero-price member ticket. They were left untouched; the new seed creates matching pass tickets for its own redemption rows.
- The checked booking/ticket/payment relations have no confirmed bookings without tickets, orphan tickets, booking/showtime mismatches, successful-payment amount mismatches, or review scores outside 0–100.

These checks describe the local database only. Neither the synthetic transaction seed nor the real film catalog updates have been copied to Aiven or deployed.
