# Cinema Database Demonstrator

A Next.js application for exploring a live MySQL cinema-booking database. The cinema booking flow is the case study; the main focus is the database: its schema, relationships, records, analytics views, and transaction behavior.

## What’s in the app

- **Booking case study (`/`)** — browse movies, select a screening and seats, and follow the checkout transaction. The same page includes the Transaction Lab rollback demonstration.
- **Schema Explorer (`/schema`)** — inspect live tables, columns, keys, foreign keys, row counts, and relationship metadata.
- **Live Records (`/database`)** — browse paginated records from the connected database and inspect recent bookings.
- **Analytics Studio (`/analytics`)** — view charts backed by fixed, read-only MySQL view queries.
- **Movie detail (`/movie/[movieId]`)** — view movie metadata, review scores, and available screenings.
- **Seat selection (`/movie/[movieId]/seats/[showtimeId]`)** — select available seats and submit a booking.

For the lecturer walkthrough and transaction details, see [DEMO_GUIDE.md](DEMO_GUIDE.md). For how `/schema` derives relationships from MySQL metadata, see [docs/dbschema-reverse-engineering.md](docs/dbschema-reverse-engineering.md).

## Technology

- Next.js 16 App Router, React 19, and TypeScript
- MySQL with `mysql2` connection pooling
- Tailwind CSS 4 is imported in `src/app/globals.css`; most application styling is in that global stylesheet and page-level CSS Modules
- `pnpm` (the pinned package manager in `package.json`)

## Local setup

### 1. Install dependencies

Install a Node.js release supported by Next.js 16 and `pnpm` 10.34.6 (the version pinned in `package.json`), then install dependencies:

```bash
pnpm install --frozen-lockfile
```

### 2. Configure MySQL

Start a local MySQL server and create an empty database (the demo guide uses `cinema_db`). Run `Final_Sp222.sql` with that database selected. The SQL file creates 32 tables and five analytical views, and inserts review-source lookup rows.

**The SQL file is not a complete application data seed.** It does not populate a full movie catalog, screenings, or booking history. The optional scripts described under [Data scripts](#data-scripts) expect existing base cinema/reference data and placeholder movie rows.

Create `.env.local` in the repository root with local credentials:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_local_mysql_user
DB_PASSWORD=your_local_mysql_password
DB_NAME=cinema_db
```

`.env*` files are ignored by Git. Keep credentials out of source control, screenshots, and shared logs. The server-side connection pool is in `src/lib/db.ts`.

### 3. Start the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The database status indicator and `/api/health` endpoint show whether MySQL is reachable. Database-backed pages read from the configured database; they do not silently substitute mock records when the database is unavailable.

## Developer commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the local Next.js development server |
| `pnpm lint` | Run ESLint |
| `pnpm build` | Create a production build |
| `pnpm start` | Serve the production build locally |

## Project map

| Path | Responsibility |
| --- | --- |
| `src/app/page.tsx` | Booking case study and Transaction Lab UI |
| `src/app/schema/` | Schema Explorer page and interactive ERD |
| `src/app/database/` | Live Records workspace |
| `src/app/analytics/` | Analytics page, charts, and CSS Module |
| `src/app/movie/` | Movie detail, showtime, seat selection, and booking UI |
| `src/app/api/` | Server-side HTTP handlers that read or write MySQL |
| `src/lib/db.ts` | Shared MySQL connection pool |
| `src/lib/schema-types.ts` | Types for schema metadata and relationships |
| `src/lib/analytics-views.ts` | Analytics view definitions and read-only queries |
| `src/lib/db-activity.ts`, `src/lib/operation-events.ts` | Safe transaction and operation activity events |
| `src/app/globals.css` | Shared theme, layout, responsive rules, and global styles |
| `Final_Sp222.sql` | MySQL table definitions, constraints, and analytical views |

The project uses the App Router: a `page.tsx` file defines each page, while `route.ts` files define API endpoints. Database access stays on the server. Interactive workspaces use client components where browser state or pointer input is needed.

## API map

| Method and route | Purpose |
| --- | --- |
| `GET /api/health` | Check MySQL connectivity |
| `GET /api/movies` | Read movie and upcoming-showtime data |
| `GET /api/showtimes` | Read screenings |
| `GET /api/showtimes/[showtimeId]/seats` | Read seat availability for a screening |
| `GET /api/schema` | Read live schema metadata and row counts |
| `GET /api/records/[tableName]` | Read paginated records for a table |
| `GET /api/database/recent` | Read recent booking activity |
| `GET /api/analytics/[view]` | Run a bounded, read-only analytics query |
| `POST /api/bookings` | Commit a booking transaction |
| `POST /api/transactions/rollback-demo` | Run the controlled failure-and-rollback demonstration |
| `GET /api/operations/[operationId]/events` | Stream safe activity for a transaction operation |

## Data scripts

Two repository scripts support the demo database:

- `.db-real-movies.cjs` previews updates to the first seven placeholder movie records, their review snapshots, and related catalog details. It defaults to a transaction that rolls back. `--apply` commits; `--audit` checks the catalog state; `--refresh` permits refreshing those same seven already named titles.
- `.db-seed.cjs` previews synthetic historical analytics activity and rolling future screenings for the first seven named movies. It defaults to a transaction that rolls back. `--apply` commits the generated rows.

Both scripts require a correctly configured database and existing base/reference rows. Review each script’s output and confirm that `.env.local` points to an isolated local database before using `--apply`. The analytics seed creates synthetic customer, booking, ticket, and redemption rows; it does not seed movie titles. These scripts are not run automatically by `pnpm dev`.

## Database and transaction behavior

- Schema, record, movie, screening, and analytics responses represent the configured MySQL database.
- `POST /api/bookings` writes persistent customer, booking, ticket, and payment records. No payment gateway is called; payment is simulated in MySQL.
- The Transaction Lab deliberately triggers a foreign-key error inside a transaction and rolls back. It is designed to leave no attempted rows behind; MySQL auto-increment values can still advance.
- Activity events expose SQL templates and outcomes, not bound contact details or idempotency values.

## Working on the UI

- Shared styles and responsive rules live in `src/app/globals.css`.
- Route-specific styles live beside their pages as `*.module.css`.
- Keep database/business behavior in the existing API and library code when making presentation changes; the client workspaces call those endpoints.
- On narrow screens, long database tables and the ERD use their own scrolling and zoom controls so technical content remains navigable.

## Further documentation

- [DEMO_GUIDE.md](DEMO_GUIDE.md) — local demo setup, lecturer walkthrough, and safety notes for committed booking writes.
- [docs/dbschema-reverse-engineering.md](docs/dbschema-reverse-engineering.md) — MySQL metadata and DbSchema workflow.
- [docs/analytics-data-audit.md](docs/analytics-data-audit.md) — analytics data and seed-script details.
