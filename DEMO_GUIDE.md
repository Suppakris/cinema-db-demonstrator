# Lecturer Demo Guide

This project uses a cinema booking workflow to demonstrate the live MySQL schema, relationships, records, and transaction behavior. The database is the subject; booking is the case study.

## Before the demo

1. Start the configured MySQL server and make sure the `cinema_db` schema is available. `Final_Sp222.sql` contains the schema and sample data used by the project.
2. Configure `.env.local` with `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. Keep credentials private; never include them in screenshots or shared logs.
3. From the repository root, run:

   ```powershell
   pnpm install
   pnpm dev
   ```

4. Open `http://localhost:3000`. Wait for the live database name and schema to load. The home page checks `/api/health`; schema and records load from MySQL.

## Three-minute walkthrough

### 1. Start with the real schema

Open **Schema Explorer**. Point out that tables, columns, keys, relationships, and row counts are read from MySQL `information_schema` and live table counts. Select `ticket` to show its key markers and relationships to `booking`, `seat`, and `showtime`.

Explain that a ticket's `(Showtime_ID, Seat_ID)` unique key prevents the same seat from being sold twice for a screening. A separate showtime-seat table does not exist in this schema.

### 2. Follow a real row

Open **Live Records**, select `ticket`, and inspect a row. Follow its foreign-key links to the related booking, seat, or showtime. The record viewer reads the selected MySQL table; it does not use bundled demo rows.

### 3. Show the successful booking example

In **Booking Case Study**, explain the write path:

```text
customer → booking → ticket → payment
```

The confirmed booking panel shows the transaction result, affected tables, before/after state, and safe SQL activity. A previously verified example created one customer, booking, ticket, and successful payment; its exact IDs and continued presence can change as the live database changes.

Submitting a new booking commits persistent rows to the configured database. Use only clearly identified demonstration contact details, and do this only when you intend to keep those records. No payment gateway is called; payment is simulated in MySQL.

### 4. Demonstrate rollback

Open **Transaction Lab** and select **Run rollback demonstration**. The route begins a transaction, inserts a temporary customer and booking, attempts a payment insert with a missing payment-method foreign key, and rolls back. Show the activity timeline and compare the before/after counts. The attempted rows should be absent; MySQL auto-increment values may still advance.

This rollback demonstration is safe to repeat. It does not create a successful payment or leave its temporary customer and booking behind.

## Useful endpoints

| Endpoint | What it demonstrates |
| --- | --- |
| `GET /api/health` | MySQL connection status |
| `GET /api/schema` | Live database objects, columns, keys, relationships, and counts |
| `GET /api/records/{tableName}` | Read-only paginated records for a base table |
| `GET /api/movies` | Movie and upcoming-showtime data for the booking case study |
| `POST /api/bookings` | A committed booking transaction; creates persistent records |
| `POST /api/transactions/rollback-demo` | Controlled foreign-key failure followed by rollback |

## If something does not load

- If the database indicator is offline, check that MySQL is running and the five `DB_*` settings in `.env.local` point to the intended database.
- If schema loads but a table has no rows, the live database may differ from the sample data. The UI reports the current database state rather than filling it with mock rows.
- Do not paste `.env.local` contents into the browser, screenshots, issue reports, or presentation slides.
