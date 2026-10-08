import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const movieId = Number(request.nextUrl.searchParams.get("movieId"));
  if (!Number.isInteger(movieId) || movieId < 1) {
    return NextResponse.json({ error: "Choose a valid movie." }, { status: 400 });
  }

  try {
    const [rows] = await db.query(
      `SELECT s.Showtime_ID AS id,
              DATE_FORMAT(s.Start_Time, '%Y-%m-%dT%H:%i:%s') AS startsAt,
              DATE_FORMAT(s.End_Time, '%Y-%m-%dT%H:%i:%s') AS endsAt,
              s.Showtime_Status AS status, s.Theater_ID AS theaterId,
              t.Theater_Name AS theaterName, t.Branch_ID AS branchId,
              b.Branch_Name AS branchName, l.Language_Name AS audioLanguage,
              sl.Language_Name AS subtitleLanguage,
              (SELECT COUNT(*) FROM seat seat_count WHERE seat_count.Theater_ID = s.Theater_ID) AS seatCount,
              (SELECT COUNT(*) FROM ticket tk WHERE tk.Showtime_ID = s.Showtime_ID) AS bookedCount
       FROM showtime s
       JOIN theater t ON t.Theater_ID = s.Theater_ID
       JOIN branch b ON b.Branch_ID = t.Branch_ID
       JOIN language l ON l.Language_ID = s.Audio_Language_ID
       LEFT JOIN language sl ON sl.Language_ID = s.Subtitle_Language_ID
       WHERE s.Movie_ID = ? AND s.Showtime_Status = 'AVAILABLE' AND s.Start_Time > NOW()
       ORDER BY s.Start_Time`,
      [movieId],
    );

    return NextResponse.json({ showtimes: rows });
  } catch {
    return NextResponse.json(
      { error: "Showtimes could not be loaded from the cinema database." },
      { status: 503 },
    );
  }
}
