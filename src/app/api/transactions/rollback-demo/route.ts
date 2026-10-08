import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type Counts = { customer: number; booking: number; ticket: number; payment: number };
type ActivityEntry = {
  timestamp: string;
  kind: string;
  label: string;
  tables: string[];
  sql: string | null;
  outcome: string;
  affectedRows: number | null;
};

async function readCounts(connection: Awaited<ReturnType<typeof db.getConnection>>): Promise<Counts> {
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

function sameCounts(first: Counts, second: Counts) {
  return Object.keys(first).every((key) => first[key as keyof Counts] === second[key as keyof Counts]);
}

export async function POST() {
  let connection: Awaited<ReturnType<typeof db.getConnection>>;
  try {
    connection = await db.getConnection();
  } catch {
    return NextResponse.json({ error: "The database is currently unavailable." }, { status: 503 });
  }

  let transactionStarted = false;
  const activity: ActivityEntry[] = [];
  const logActivity = (kind: string, label: string, tables: string[], sql: string | null, outcome = "OK", affectedRows: number | null = null) => {
    activity.push({ timestamp: new Date().toISOString(), kind, label, tables, sql, outcome, affectedRows });
  };
  try {
    logActivity("API", "POST /api/transactions/rollback-demo", [], null, "RECEIVED");
    await connection.beginTransaction();
    transactionStarted = true;
    logActivity("TRANSACTION", "Begin transaction", [], "BEGIN", "ACTIVE");
    const before = await readCounts(connection);
    logActivity("SELECT", "Capture before-state counts", ["customer", "booking", "ticket", "payment"], "SELECT table counts", "BEFORE", null);
    const demoEmail = `rollback-demo-${randomUUID()}@example.test`;

    const [showRows] = await connection.query<RowDataPacket[]>(
      `SELECT Showtime_ID AS showtimeId
       FROM showtime WHERE Showtime_Status = 'AVAILABLE' AND Start_Time > NOW()
       ORDER BY Start_Time, Showtime_ID LIMIT 1 FOR UPDATE`,
    );
    logActivity("SELECT", "Lock an upcoming showtime", ["showtime"], "SELECT Showtime_ID FROM showtime WHERE AVAILABLE and Start_Time > NOW() FOR UPDATE", "READ", showRows.length);
    const [providerRows] = await connection.query<RowDataPacket[]>(
      "SELECT Provider_Account_ID AS providerId FROM payment_provider_account ORDER BY Provider_Account_ID LIMIT 1",
    );
    const [methodRows] = await connection.query<RowDataPacket[]>(
      "SELECT COALESCE(MAX(Payment_Method_ID), 0) + 1 AS invalidMethodId FROM payment_method",
    );
    logActivity("SELECT", "Read payment provider and identify absent method key", ["payment_provider_account", "payment_method"], "SELECT provider and MAX(Payment_Method_ID) + 1", "READ", Number(Boolean(providerRows[0])) + Number(Boolean(methodRows[0])));
    if (!showRows[0] || !providerRows[0] || !methodRows[0]) {
      await connection.rollback();
      transactionStarted = false;
      return NextResponse.json({ error: "A showtime or payment provider is not configured for the rollback demonstration." }, { status: 503 });
    }

    const statements: Array<{ label: string; sql: string; outcome: string; affectedRows: number }> = [
      { label: "Begin transaction", sql: "BEGIN", outcome: "COMPLETED", affectedRows: 0 },
    ];
    const [customerResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO customer (Customer_FirstName, Customer_LastName, Email, Phone, Created_At)
       VALUES ('Rollback', 'Demo', ?, '+66000000000', NOW())`,
      [demoEmail],
    );
    statements.push({
      label: "Create temporary demonstration customer",
      sql: "INSERT INTO customer (Customer_FirstName, Customer_LastName, Email, Phone, Created_At) VALUES ('Rollback', 'Demo', ?, ?, NOW())",
      outcome: "ROLLED BACK",
      affectedRows: customerResult.affectedRows,
    });
    logActivity("INSERT", "Create temporary customer", ["customer"], "INSERT INTO customer (...) VALUES ('Rollback', 'Demo', ?, ?, NOW())", "WILL ROLLBACK", customerResult.affectedRows);

    const [bookingResult] = await connection.query<ResultSetHeader>(
      `INSERT INTO booking (Booking_Status, Channel_Type, Customer_ID, Showtime_ID)
       VALUES ('CONFIRMED', 'WEBSITE', ?, ?)` ,
      [customerResult.insertId, showRows[0].showtimeId],
    );
    statements.push({
      label: "Create temporary demonstration booking",
      sql: "INSERT INTO booking (Booking_Status, Channel_Type, Customer_ID, Showtime_ID) VALUES ('CONFIRMED', 'WEBSITE', ?, ?)",
      outcome: "ROLLED BACK",
      affectedRows: bookingResult.affectedRows,
    });
    logActivity("INSERT", "Create temporary booking", ["booking"], "INSERT INTO booking (Booking_Status, Channel_Type, Customer_ID, Showtime_ID) VALUES ('CONFIRMED', 'WEBSITE', ?, ?)", "WILL ROLLBACK", bookingResult.affectedRows);

    let expectedFailure = false;
    try {
      await connection.query(
        `INSERT INTO payment
           (Paid_Amount, Payment_DateTime, Payment_Status, Booking_ID, Payment_Method_ID, Provider_Account_ID, Idempotency_Key)
         VALUES (0, NOW(), 'SUCCESS', ?, ?, ?, ?)`,
        [bookingResult.insertId, methodRows[0].invalidMethodId, providerRows[0].providerId, `rollback-${randomUUID()}`],
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== "ER_NO_REFERENCED_ROW_2" && code !== "ER_NO_REFERENCED_ROW") throw error;
      expectedFailure = true;
      statements.push({
        label: "Insert payment with a missing payment method",
        sql: "INSERT INTO payment (..., Payment_Method_ID, ...) VALUES (..., <missing FK>, ...)",
        outcome: "FAILED · FOREIGN KEY",
        affectedRows: 0,
      });
      logActivity("ERROR", "Payment insert violates foreign key", ["payment", "payment_method"], "INSERT INTO payment (..., Payment_Method_ID, ...) VALUES (..., <missing FK>, ...)", "FAILED", 0);
    }
    if (!expectedFailure) throw new Error("The controlled foreign-key failure did not occur.");

    await connection.rollback();
    transactionStarted = false;
    statements.push({ label: "Rollback transaction", sql: "ROLLBACK", outcome: "COMPLETED", affectedRows: 0 });
    logActivity("ROLLBACK", "Roll back all transaction writes", [], "ROLLBACK", "ROLLED BACK", 0);

    const after = await readCounts(connection);
    const [[customerProbe]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM customer WHERE Email = ?",
      [demoEmail],
    );
    const [[bookingProbe]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM booking WHERE Booking_ID = ?",
      [bookingResult.insertId],
    );
    const [[paymentProbe]] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM payment WHERE Booking_ID = ?",
      [bookingResult.insertId],
    );
    const persistedPaymentRows = Number(paymentProbe.total);
    const noPartialRows = sameCounts(before, after) && Number(customerProbe.total) === 0 &&
      Number(bookingProbe.total) === 0 && persistedPaymentRows === 0;
    logActivity("SELECT", "Verify rollback left no partial rows", ["customer", "booking", "ticket", "payment"], "SELECT table counts and attempted IDs after ROLLBACK", noPartialRows ? "VERIFIED" : "MISMATCH", null);

    return NextResponse.json({
      transaction: "ROLLED_BACK",
      showtimeId: Number(showRows[0].showtimeId),
      failure: "Payment insert rejected because the payment method foreign key does not exist.",
      before,
      after,
      attempted: { customerId: Number(customerResult.insertId), bookingId: Number(bookingResult.insertId) },
      persistedDemoRows: { customer: Number(customerProbe.total), booking: Number(bookingProbe.total), payment: persistedPaymentRows },
      noPartialRows,
      statements,
      activity,
    });
  } catch {
    if (transactionStarted) {
      try { await connection.rollback(); } catch { /* Transaction may already be closed. */ }
    }
    return NextResponse.json({ error: "The rollback demonstration could not complete." }, { status: 500 });
  } finally {
    connection.release();
  }
}
