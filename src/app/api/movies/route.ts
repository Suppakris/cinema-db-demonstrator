import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [rows] = await db.query(
      `SELECT m.Movie_ID AS id, m.Title AS title, m.Poster_Image AS posterImage,
              m.Movie_Synopsis AS synopsis, m.Movie_Duration AS duration,
              m.Original_Release_Date AS releaseDate, m.Age_Rating AS ageRating,
              COUNT(DISTINCT s.Showtime_ID) AS showtimeCount
       FROM movie m
       LEFT JOIN showtime s ON s.Movie_ID = m.Movie_ID AND s.Showtime_Status = 'AVAILABLE'
         AND s.Start_Time > NOW()
       GROUP BY m.Movie_ID
       ORDER BY m.Movie_ID`,
    );

    return NextResponse.json({ movies: rows });
  } catch {
    return NextResponse.json(
      { error: "The movie list could not be loaded from the cinema database." },
      { status: 503 },
    );
  }
}
