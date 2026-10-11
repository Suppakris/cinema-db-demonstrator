import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type MovieRow = RowDataPacket & {
  id: number;
  title: string;
  posterImage: string | null;
  synopsis: string | null;
  duration: number;
  releaseDate: string;
  ageRating: string;
  showtimeCount: number;
  reviewCount: number;
  normalizedReviewCount: number;
  averageScore100: string | null;
  genres: string | null;
  credits: string | null;
};

type ReviewRow = RowDataPacket & {
  movieId: number;
  reviewId: number;
  rawScore: string;
  normalizedScore: string | null;
  sourceName: string;
  sourceCode: string;
  sourceUrl: string | null;
  websiteUrl: string | null;
  scoreType: string;
  scoreMax: string | null;
  updatedAt: string;
};

export async function GET() {
  try {
    const [rows] = await db.query<MovieRow[]>(
      `SELECT m.Movie_ID AS id, m.Title AS title, m.Poster_Image AS posterImage,
              m.Movie_Synopsis AS synopsis, m.Movie_Duration AS duration,
              m.Original_Release_Date AS releaseDate, m.Age_Rating AS ageRating,
              COUNT(DISTINCT s.Showtime_ID) AS showtimeCount,
              COALESCE(r.Source_Count, 0) AS reviewCount,
              COALESCE(r.Normalized_Source_Count, 0) AS normalizedReviewCount,
              r.Average_Score_100 AS averageScore100,
              (SELECT GROUP_CONCAT(g.Genre_Name ORDER BY g.Genre_Name SEPARATOR ', ')
               FROM movie_genre_details mgd JOIN genre g ON g.Genre_ID = mgd.Genre_ID
               WHERE mgd.Movie_ID = m.Movie_ID) AS genres,
              (SELECT GROUP_CONCAT(CONCAT(CONCAT_WS(' ', p.First_Name, NULLIF(p.Last_Name, '')), ' — ', mpr.Role_Type)
                 ORDER BY mpr.Role_Type, p.Last_Name, p.First_Name SEPARATOR ', ')
               FROM movie_person_role mpr JOIN person p ON p.Person_ID = mpr.Person_ID
               WHERE mpr.Movie_ID = m.Movie_ID AND mpr.Role_Type IN ('Actor', 'Director')) AS credits
       FROM movie m
       LEFT JOIN showtime s ON s.Movie_ID = m.Movie_ID AND s.Showtime_Status = 'AVAILABLE'
         AND s.Start_Time > NOW()
       LEFT JOIN v_movie_review_summary r ON r.Movie_ID = m.Movie_ID
       GROUP BY m.Movie_ID
       ORDER BY m.Movie_ID`,
    );

    const reviewsByMovie = new Map<number, Omit<ReviewRow, "movieId">[]>();
    if (rows.length > 0) {
      const [reviewRows] = await db.query<ReviewRow[]>(
        `SELECT mr.Movie_ID AS movieId, mr.Review_ID AS reviewId,
                mr.Raw_Score AS rawScore, mr.Normalized_Score AS normalizedScore,
                rs.Source_Name AS sourceName, rs.Source_Code AS sourceCode,
                mr.Source_URL AS sourceUrl, rs.Website_URL AS websiteUrl,
                rs.Score_Type AS scoreType, rs.Score_Max AS scoreMax,
                mr.Updated_At AS updatedAt
         FROM movie_review mr
         JOIN review_source rs ON rs.Source_ID = mr.Source_ID
         WHERE mr.Movie_ID IN (?)
         ORDER BY mr.Movie_ID, rs.Source_ID, mr.Updated_At DESC, mr.Review_ID DESC`,
        [rows.map((movie) => movie.id)],
      );

      for (const { movieId, ...review } of reviewRows) {
        const reviews = reviewsByMovie.get(movieId) ?? [];
        reviews.push(review);
        reviewsByMovie.set(movieId, reviews);
      }
    }

    return NextResponse.json({
      movies: rows.map((movie) => ({
        ...movie,
        reviews: reviewsByMovie.get(movie.id) ?? [],
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "The movie list could not be loaded from the cinema database." },
      { status: 503 },
    );
  }
}
