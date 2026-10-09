import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type RecentBooking = RowDataPacket & {
  bookingId: number;
  createdAt: string;
  bookingStatus: string;
  showtimeId: number;
  ticketCount: number;
  total: string | number;
  paymentStatus: string | null;
};

export async function GET(request: NextRequest) {
  const rawBookingId = request.nextUrl.searchParams.get("bookingId");
  const bookingId = rawBookingId === null ? null : Number(rawBookingId);
  if (bookingId !== null && (!Number.isInteger(bookingId) || bookingId < 1)) {
    return NextResponse.json({ error: "Choose a valid booking identifier." }, { status: 400 });
  }

  try {
    const values: number[] = [];
    const where = bookingId === null ? "" : "WHERE b.Booking_ID = ?";
    if (bookingId !== null) values.push(bookingId);
    const limit = bookingId === null ? 12 : 1;
    const [rows] = await db.query<RecentBooking[]>(
      `SELECT b.Booking_ID AS bookingId, b.Booking_DateTime AS createdAt,
              b.Booking_Status AS bookingStatus, b.Showtime_ID AS showtimeId,
              (SELECT COUNT(*) FROM ticket tk WHERE tk.Booking_ID = b.Booking_ID) AS ticketCount,
              (SELECT COALESCE(SUM(tk.Sold_Price), 0) FROM ticket tk WHERE tk.Booking_ID = b.Booking_ID) AS total,
              (SELECT p.Payment_Status FROM payment p WHERE p.Booking_ID = b.Booking_ID
               ORDER BY p.Payment_DateTime DESC, p.Payment_ID DESC LIMIT 1) AS paymentStatus
       FROM booking b ${where}
       ORDER BY b.Booking_DateTime DESC, b.Booking_ID DESC LIMIT ?`,
      [...values, limit],
    );
    return NextResponse.json({
      bookings: rows.map((row) => ({
        bookingId: Number(row.bookingId),
        createdAt: row.createdAt,
        bookingStatus: row.bookingStatus,
        showtimeId: Number(row.showtimeId),
        ticketCount: Number(row.ticketCount),
        total: Number(row.total),
        paymentStatus: row.paymentStatus,
        paymentIsSimulated: true,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Recent booking rows could not be loaded." }, { status: 503 });
  }
}
