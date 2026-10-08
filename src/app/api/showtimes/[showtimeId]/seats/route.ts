import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

export const runtime = "nodejs";

function pricingSlot(dayOfWeek: number, time: string) {
  const hour = Number(time.slice(0, 2));
  if (hour >= 22) return 5;
  if (dayOfWeek === 4) return 4;
  if (dayOfWeek === 1 || dayOfWeek === 7) return hour < 12 ? 7 : 3;
  return hour < 12 ? 2 : 1;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ showtimeId: string }> },
) {
  const { showtimeId: rawId } = await params;
  const showtimeId = Number(rawId);
  if (!Number.isInteger(showtimeId) || showtimeId < 1) {
    return NextResponse.json({ error: "Choose a valid screening." }, { status: 400 });
  }

  try {
    const [showRows] = await db.query<RowDataPacket[]>(
      `SELECT s.Showtime_ID AS id, s.Theater_ID AS theaterId, s.Showtime_Status AS status,
              t.Branch_ID AS branchId, t.Theater_Type_ID AS theaterTypeId,
              DAYOFWEEK(s.Start_Time) AS dayOfWeek, TIME(s.Start_Time) AS showTime
       FROM showtime s JOIN theater t ON t.Theater_ID = s.Theater_ID
       WHERE s.Showtime_ID = ?`,
      [showtimeId],
    );
    const show = showRows[0];
    if (!show || show.status !== "AVAILABLE") {
      return NextResponse.json({ error: "This screening is no longer available." }, { status: 404 });
    }

    const slotId = pricingSlot(Number(show.dayOfWeek), String(show.showTime));
    const [seats] = await db.query<RowDataPacket[]>(
      `SELECT se.Seat_ID AS id, se.Seat_Row AS seatRow, se.Seat_Column AS seatColumn,
              se.Seat_Status AS physicalStatus, se.Seat_Type_ID AS seatTypeId,
              st.Seat_Type_Name AS seatTypeName,
              CASE WHEN tk.Ticket_ID IS NULL THEN 'AVAILABLE' ELSE 'BOOKED' END AS status,
              p.Price_ID AS priceId, p.Price_Amount AS price
       FROM seat se
       JOIN seat_type st ON st.Seat_Type_ID = se.Seat_Type_ID
       LEFT JOIN ticket tk ON tk.Showtime_ID = ? AND tk.Seat_ID = se.Seat_ID
       LEFT JOIN price p ON p.Branch_ID = ? AND p.Theater_Type_ID = ?
         AND p.Seat_Type_ID = se.Seat_Type_ID AND p.Day_Time_Slot_ID = ?
       WHERE se.Theater_ID = ?
       ORDER BY se.Seat_Row, se.Seat_Column`,
      [showtimeId, show.branchId, show.theaterTypeId, slotId, show.theaterId],
    );
    const [methods] = await db.query<RowDataPacket[]>(
      "SELECT Payment_Method_ID AS id, Method_Name AS name FROM payment_method ORDER BY Payment_Method_ID",
    );

    return NextResponse.json({ seats, paymentMethods: methods });
  } catch {
    return NextResponse.json(
      { error: "Seats could not be loaded from the cinema database." },
      { status: 503 },
    );
  }
}
