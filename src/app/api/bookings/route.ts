import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type BookingInput = {
  showtimeId?: unknown;
  seatIds?: unknown;
  firstName?: unknown;
  lastName?: unknown;
  email?: unknown;
  phone?: unknown;
  paymentMethodId?: unknown;
  idempotencyKey?: unknown;
};

type ShowRow = RowDataPacket & {
  Showtime_ID: number;
  Showtime_Status: string;
  IsUpcoming: number;
  Theater_ID: number;
  Branch_ID: number;
  Theater_Type_ID: number;
  DayOfWeek: number;
  ShowTime: string;
};

type SeatRow = RowDataPacket & {
  Seat_ID: number;
  Seat_Row: string;
  Seat_Column: number;
  Seat_Status: string;
  Seat_Type_ID: number;
  Seat_Type_Name: string;
  Price_ID: number | null;
  Price_Amount: string | number | null;
};

type SeatStateRow = RowDataPacket & {
  seatId: number;
  label: string;
  status: string;
  ticketId: number | null;
};
type ActivityEntry = {
  timestamp: string;
  kind: string;
  label: string;
  tables: string[];
  sql: string | null;
  outcome: string;
  affectedRows: number | null;
};

async function readTableCounts(connection: Awaited<ReturnType<typeof db.getConnection>>) {
  const [[row]] = await connection.query<RowDataPacket[]>(
    `SELECT (SELECT COUNT(*) FROM customer) AS customer,
            (SELECT COUNT(*) FROM booking) AS booking,
            (SELECT COUNT(*) FROM ticket) AS ticket,
            (SELECT COUNT(*) FROM payment) AS payment`,
  );
  return {
    customer: Number(row.customer),
    booking: Number(row.booking),
    ticket: Number(row.ticket),
    payment: Number(row.payment),
  };
}

async function readSeatStates(
  connection: Awaited<ReturnType<typeof db.getConnection>>,
  showtimeId: number,
  seatIds: number[],
) {
  const placeholders = seatIds.map(() => "?").join(", ");
  const [rows] = await connection.query<SeatStateRow[]>(
    `SELECT se.Seat_ID AS seatId, CONCAT(se.Seat_Row, se.Seat_Column) AS label,
            CASE WHEN tk.Ticket_ID IS NOT NULL THEN 'BOOKED' ELSE se.Seat_Status END AS status,
            tk.Ticket_ID AS ticketId
     FROM seat se LEFT JOIN ticket tk ON tk.Showtime_ID = ? AND tk.Seat_ID = se.Seat_ID
     WHERE se.Seat_ID IN (${placeholders}) ORDER BY se.Seat_Row, se.Seat_Column`,
    [showtimeId, ...seatIds],
  );
  return rows.map((row) => ({
    seatId: Number(row.seatId),
    label: row.label,
    status: row.status,
    ticketId: row.ticketId === null ? null : Number(row.ticketId),
  }));
}

function pricingSlot(dayOfWeek: number, time: string) {
  const hour = Number(time.slice(0, 2));
  if (hour >= 22) return 5;
  if (dayOfWeek === 4) return 4;
  if (dayOfWeek === 1 || dayOfWeek === 7) return hour < 12 ? 7 : 3;
  return hour < 12 ? 2 : 1;
}

function validText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

export async function POST(request: NextRequest) {
  let input: BookingInput;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "The booking details are not valid." }, { status: 400 });
    }
    input = body as BookingInput;
  } catch {
    return NextResponse.json({ error: "The booking details are not valid." }, { status: 400 });
  }

  const showtimeId = Number(input.showtimeId);
  const seatIds = Array.isArray(input.seatIds)
    ? [...new Set(input.seatIds.map(Number))]
    : [];
  const paymentMethodId = Number(input.paymentMethodId);
  const firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
  const lastName = typeof input.lastName === "string" ? input.lastName.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  const phone = typeof input.phone === "string" ? input.phone.trim() : "";
  const idempotencyKey = validText(input.idempotencyKey, 64)
    ? input.idempotencyKey.trim()
    : randomUUID();

  if (
    !Number.isInteger(showtimeId) || showtimeId < 1 ||
    !Number.isInteger(paymentMethodId) || paymentMethodId < 1 ||
    seatIds.length < 1 || seatIds.length > 4 ||
    seatIds.some((id) => !Number.isInteger(id) || id < 1) ||
    !validText(firstName, 50) || !validText(lastName, 50) ||
    !validText(email, 255) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !validText(phone, 20)
  ) {
    return NextResponse.json({ error: "Complete the contact and seat details to continue." }, { status: 400 });
  }

  let connection: Awaited<ReturnType<typeof db.getConnection>>;
  try {
    connection = await db.getConnection();
  } catch {
    return NextResponse.json({ error: "The database is currently unavailable." }, { status: 503 });
  }
  const statements: Array<{ label: string; sql: string; affectedRows: number }> = [];
  const activity: ActivityEntry[] = [];
  const logActivity = (kind: string, label: string, tables: string[], sql: string | null, outcome = "OK", affectedRows: number | null = null) => {
    activity.push({ timestamp: new Date().toISOString(), kind, label, tables, sql, outcome, affectedRows });
  };
  try {
    logActivity("API", "POST /api/bookings", [], null, "RECEIVED");
    await connection.beginTransaction();
    logActivity("TRANSACTION", "Begin transaction", [], "BEGIN", "ACTIVE");

    const [priorRows] = await connection.query<RowDataPacket[]>(
      `SELECT p.Payment_ID AS paymentId, p.Booking_ID AS bookingId,
              b.Showtime_ID AS showtimeId, p.Paid_Amount AS total
       FROM payment p JOIN booking b ON b.Booking_ID = p.Booking_ID
       WHERE p.Idempotency_Key = ? LIMIT 1`,
      [idempotencyKey],
    );
    logActivity("SELECT", "Check idempotency key", ["payment", "booking"], "SELECT payment and booking by Idempotency_Key = ?", "READ", priorRows.length);
    const prior = priorRows[0];
    if (prior) {
      const [priorTicketRows] = await connection.query<RowDataPacket[]>(
        `SELECT tk.Ticket_ID AS ticketId, se.Seat_Row AS seatRow, se.Seat_Column AS seatColumn
         FROM ticket tk JOIN seat se ON se.Seat_ID = tk.Seat_ID
         WHERE tk.Booking_ID = ? ORDER BY se.Seat_Row, se.Seat_Column`,
        [prior.bookingId],
      );
      await connection.commit();
      logActivity("COMMIT", "Commit idempotent replay", [], "COMMIT", "COMMITTED");
      return NextResponse.json({
        booking: {
          id: prior.bookingId,
          paymentId: prior.paymentId,
          showtimeId: prior.showtimeId,
          total: Number(prior.total),
          seats: priorTicketRows.map((ticket) => `${ticket.seatRow}${ticket.seatColumn}`),
          ticketIds: priorTicketRows.map((ticket) => Number(ticket.ticketId)),
        },
        replayed: true,
        statements: [],
        activity,
        transaction: "REPLAYED",
      });
    }

    const [showRows] = await connection.query<ShowRow[]>(
      `SELECT s.Showtime_ID, s.Showtime_Status, s.Start_Time > NOW() AS IsUpcoming, s.Theater_ID,
              t.Branch_ID, t.Theater_Type_ID, DAYOFWEEK(s.Start_Time) AS DayOfWeek,
              TIME(s.Start_Time) AS ShowTime
       FROM showtime s JOIN theater t ON t.Theater_ID = s.Theater_ID
       WHERE s.Showtime_ID = ? FOR UPDATE`,
      [showtimeId],
    );
    logActivity("SELECT", "Lock and validate showtime", ["showtime", "theater"], "SELECT showtime and theater FOR UPDATE", "READ", showRows.length);
    const show = showRows[0];
    if (!show || show.Showtime_Status !== "AVAILABLE") {
      await connection.rollback();
      return NextResponse.json({ error: "This screening is no longer available." }, { status: 409 });
    }
    if (!Boolean(show.IsUpcoming)) {
      await connection.rollback();
      return NextResponse.json({ error: "This screening has already started. Choose a future showtime." }, { status: 409 });
    }

    const slotId = pricingSlot(Number(show.DayOfWeek), String(show.ShowTime));
    const placeholders = seatIds.map(() => "?").join(", ");
    const [seatRows] = await connection.query<SeatRow[]>(
      `SELECT se.Seat_ID, se.Seat_Row, se.Seat_Column, se.Seat_Status,
              se.Seat_Type_ID, st.Seat_Type_Name, p.Price_ID, p.Price_Amount
       FROM seat se JOIN seat_type st ON st.Seat_Type_ID = se.Seat_Type_ID
       LEFT JOIN price p ON p.Branch_ID = ? AND p.Theater_Type_ID = ?
         AND p.Seat_Type_ID = se.Seat_Type_ID AND p.Day_Time_Slot_ID = ?
       WHERE se.Theater_ID = ? AND se.Seat_ID IN (${placeholders})
       ORDER BY se.Seat_Row, se.Seat_Column FOR UPDATE`,
      [show.Branch_ID, show.Theater_Type_ID, slotId, show.Theater_ID, ...seatIds],
    );
    logActivity("SELECT", "Validate seats and configured prices", ["seat", "seat_type", "price"], "SELECT seats and matching price FOR UPDATE WHERE Seat_ID IN (?)", "READ", seatRows.length);
    if (seatRows.length !== seatIds.length) {
      await connection.rollback();
      return NextResponse.json({ error: "One or more seats do not belong to this theater." }, { status: 400 });
    }
    if (seatRows.some((seat) => seat.Seat_Status !== "AVAILABLE" || seat.Price_ID === null)) {
      await connection.rollback();
      return NextResponse.json({ error: "A selected seat is unavailable or has no configured price." }, { status: 409 });
    }

    const [takenRows] = await connection.query<RowDataPacket[]>(
      `SELECT Seat_ID FROM ticket WHERE Showtime_ID = ? AND Seat_ID IN (${placeholders}) FOR UPDATE`,
      [showtimeId, ...seatIds],
    );
    logActivity("SELECT", "Check seat tickets for this showtime", ["ticket"], "SELECT Ticket_ID FROM ticket WHERE Showtime_ID = ? AND Seat_ID IN (?) FOR UPDATE", "READ", takenRows.length);
    if (takenRows.length > 0) {
      await connection.rollback();
      return NextResponse.json({ error: "A selected seat was just booked. Please choose another seat." }, { status: 409 });
    }

    const [methodRows] = await connection.query<RowDataPacket[]>(
      "SELECT Payment_Method_ID FROM payment_method WHERE Payment_Method_ID = ?",
      [paymentMethodId],
    );
    const [providerRows] = await connection.query<RowDataPacket[]>(
      "SELECT Provider_Account_ID FROM payment_provider_account ORDER BY Provider_Account_ID LIMIT 1",
    );
    logActivity("SELECT", "Verify payment configuration", ["payment_method", "payment_provider_account"], "SELECT configured method and provider account", "READ", Number(Boolean(methodRows[0])) + Number(Boolean(providerRows[0])));
    if (!methodRows[0] || !providerRows[0]) {
      await connection.rollback();
      return NextResponse.json({ error: "Payment options are not configured." }, { status: 503 });
    }

    const beforeState = {
      tableCounts: await readTableCounts(connection),
      seats: await readSeatStates(connection, showtimeId, seatIds),
    };
    logActivity("SELECT", "Capture before-state counts and seat status", ["customer", "booking", "ticket", "payment", "seat"], "SELECT table counts and ticket-derived seat availability", "BEFORE", null);

    const [customerResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO customer (Customer_FirstName, Customer_LastName, Email, Phone, Created_At)
       VALUES (?, ?, ?, ?, NOW())`,
      [firstName, lastName, email, phone],
    );
    statements.push({
      label: "Create customer",
      sql: "INSERT INTO customer (Customer_FirstName, Customer_LastName, Email, Phone, Created_At) VALUES (?, ?, ?, ?, NOW())",
      affectedRows: customerResult.affectedRows,
    });
    logActivity("INSERT", "Create customer", ["customer"], "INSERT INTO customer (...) VALUES (?, ?, ?, ?, NOW())", "INSERTED", customerResult.affectedRows);

    const [bookingResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO booking (Booking_Status, Channel_Type, Customer_ID, Showtime_ID)
       VALUES ('CONFIRMED', 'WEBSITE', ?, ?)`,
      [customerResult.insertId, showtimeId],
    );
    statements.push({
      label: "Create confirmed booking",
      sql: "INSERT INTO booking (Booking_Status, Channel_Type, Customer_ID, Showtime_ID) VALUES ('CONFIRMED', 'WEBSITE', ?, ?)",
      affectedRows: bookingResult.affectedRows,
    });
    logActivity("INSERT", "Create confirmed booking", ["booking"], "INSERT INTO booking (Booking_Status, Channel_Type, Customer_ID, Showtime_ID) VALUES ('CONFIRMED', 'WEBSITE', ?, ?)", "INSERTED", bookingResult.affectedRows);

    let total = 0;
    const ticketIds: number[] = [];
    for (const seat of seatRows) {
      const soldPrice = Number(seat.Price_Amount);
      total += soldPrice;
      const [ticketResult] = await connection.query<ResultSetHeader>(
        `INSERT INTO ticket (Booking_ID, Seat_ID, Showtime_ID, Theater_ID, Price_ID, Sold_Price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [bookingResult.insertId, seat.Seat_ID, showtimeId, show.Theater_ID, seat.Price_ID, soldPrice],
      );
      ticketIds.push(ticketResult.insertId);
      statements.push({
        label: `Create ticket for ${seat.Seat_Row}${seat.Seat_Column}`,
        sql: "INSERT INTO ticket (Booking_ID, Seat_ID, Showtime_ID, Theater_ID, Price_ID, Sold_Price) VALUES (?, ?, ?, ?, ?, ?)",
        affectedRows: ticketResult.affectedRows,
      });
      logActivity("INSERT", `Create ticket for ${seat.Seat_Row}${seat.Seat_Column}`, ["ticket"], "INSERT INTO ticket (Booking_ID, Seat_ID, Showtime_ID, Theater_ID, Price_ID, Sold_Price) VALUES (?, ?, ?, ?, ?, ?)", "INSERTED", ticketResult.affectedRows);
    }

    const [paymentResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO payment
         (Paid_Amount, Payment_DateTime, Payment_Status, Booking_ID, Payment_Method_ID, Provider_Account_ID, Idempotency_Key)
       VALUES (?, NOW(), 'SUCCESS', ?, ?, ?, ?)`,
      [total, bookingResult.insertId, paymentMethodId, providerRows[0].Provider_Account_ID, idempotencyKey],
    );
    statements.push({
      label: "Record simulated payment",
      sql: "INSERT INTO payment (Paid_Amount, Payment_DateTime, Payment_Status, Booking_ID, Payment_Method_ID, Provider_Account_ID, Idempotency_Key) VALUES (?, NOW(), 'SUCCESS', ?, ?, ?, ?)",
      affectedRows: paymentResult.affectedRows,
    });
    logActivity("INSERT", "Record simulated payment", ["payment"], "INSERT INTO payment (..., Booking_ID, Payment_Method_ID, Provider_Account_ID, Idempotency_Key) VALUES (?, NOW(), 'SUCCESS', ?, ?, ?, ?)", "INSERTED", paymentResult.affectedRows);

    const [createdTickets] = await connection.query<RowDataPacket[]>(
      `SELECT Ticket_ID AS ticketId, Seat_ID AS seatId, Sold_Price AS soldPrice
       FROM ticket WHERE Booking_ID = ? ORDER BY Ticket_ID`,
      [bookingResult.insertId],
    );
    const [[createdPayment]] = await connection.query<RowDataPacket[]>(
      `SELECT Payment_ID AS paymentId, Booking_ID AS bookingId,
              Paid_Amount AS paidAmount, Payment_Status AS status
       FROM payment WHERE Payment_ID = ?`,
      [paymentResult.insertId],
    );
    const afterState = {
      tableCounts: await readTableCounts(connection),
      seats: await readSeatStates(connection, showtimeId, seatIds),
      tickets: createdTickets.map((ticket) => ({
        ticketId: Number(ticket.ticketId),
        seatId: Number(ticket.seatId),
        soldPrice: Number(ticket.soldPrice),
      })),
      payment: {
        paymentId: Number(createdPayment.paymentId),
        bookingId: Number(createdPayment.bookingId),
        paidAmount: Number(createdPayment.paidAmount),
        status: String(createdPayment.status),
      },
    };
    logActivity("SELECT", "Read back created records and after-state", ["customer", "booking", "ticket", "payment", "seat"], "SELECT created ticket/payment rows, table counts, and ticket-derived seat status", "AFTER", null);

    await connection.commit();
    logActivity("COMMIT", "Commit booking transaction", [], "COMMIT", "COMMITTED");
    return NextResponse.json({
      booking: {
        id: bookingResult.insertId,
        paymentId: paymentResult.insertId,
        showtimeId,
        total,
        ticketIds,
        seats: seatRows.map((seat) => `${seat.Seat_Row}${seat.Seat_Column}`),
      },
      statements,
      activity,
      databaseState: {
        affectedTables: ["customer", "booking", "ticket", "payment"],
        before: beforeState,
        after: afterState,
      },
      transaction: "COMMITTED",
    }, { status: 201 });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // The transaction may have failed before it began.
    }
    const code = (error as { code?: string }).code;
    if (code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "That seat has just been booked. Choose another seat." }, { status: 409 });
    }
    return NextResponse.json({ error: "The booking could not be completed. No database changes were committed." }, { status: 500 });
  } finally {
    connection.release();
  }
}
