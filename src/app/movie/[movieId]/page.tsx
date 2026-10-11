"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import styles from "./movie-detail.module.css";
import { MajorLogo } from "@/components/major-logo";

type Review = { reviewId: number; rawScore: string; normalizedScore: string | null; sourceName: string; sourceCode: string; sourceUrl: string | null; websiteUrl: string | null; scoreType: string; scoreMax: string | null };
type Movie = { id: number; title: string; posterImage: string | null; synopsis: string | null; duration: number; releaseDate: string; ageRating: string; genres: string | null; credits: string | null; showtimeCount: number; reviews: Review[] };
type Showtime = { id: number; startsAt: string; status: string; theaterName: string; branchName: string; audioLanguage: string; subtitleLanguage: string | null; seatCount: number; bookedCount: number };

function score(review: Review) {
  if (review.scoreType.toUpperCase() === "PERCENT") return review.rawScore.endsWith("%") ? review.rawScore : `${review.rawScore}%`;
  return review.scoreMax ? `${review.rawScore}/${Number(review.scoreMax)}` : review.rawScore;
}

export default function MovieDetailsPage({ params }: PageProps<"/movie/[movieId]">) {
  const { movieId } = use(params);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [posterFailed, setPosterFailed] = useState(false);
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [showtimesLoadedForMovie, setShowtimesLoadedForMovie] = useState<number | null>(null);
  const [showtimeError, setShowtimeError] = useState("");
  const loadingShowtimes = Boolean(movie && showtimesLoadedForMovie !== movie.id);

  useEffect(() => {
    let active = true;
    fetch("/api/movies")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Movie details could not be loaded.");
        return (result.movies as Movie[]).find((item) => item.id === Number(movieId)) ?? null;
      })
      .then((result) => { if (active) setMovie(result); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Movie details could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [movieId]);

  useEffect(() => {
    if (!movie) return;
    let active = true;
    fetch(`/api/showtimes?movieId=${movie.id}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Showtimes could not be loaded.");
        return result.showtimes as Showtime[];
      })
      .then((result) => {
        if (!active) return;
        setShowtimes(result);
        setShowtimeError("");
        setShowtimesLoadedForMovie(movie.id);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setShowtimeError(cause instanceof Error ? cause.message : "Showtimes could not be loaded.");
        setShowtimesLoadedForMovie(movie.id);
      });
    return () => { active = false; };
  }, [movie]);

  return <main className={styles.page}>
    <header className={styles.nav}>
      <Link className={styles.brand} href="/" aria-label="Major Cineplex home"><MajorLogo /></Link>
      <Link className={styles.back} href="/"><ArrowLeft size={14} /> NOW SHOWING</Link>
    </header>
    {loading ? <div className={styles.state}><LoaderCircle className={styles.spin} size={18} /> Loading movie details from MySQL…</div> : error ? <div className={styles.state} role="alert">{error}</div> : !movie ? <div className={styles.state}>This movie could not be found in the cinema database.</div> : <>
      <section className={styles.hero}>
        <div className={styles.art}>{movie.posterImage && !posterFailed ? <Image src={movie.posterImage} alt={`${movie.title} poster`} fill sizes="(max-width: 700px) 75vw, 360px" unoptimized onError={() => setPosterFailed(true)} /> : <div className={styles.noPoster}>POSTER<br />UNAVAILABLE</div>}</div>
        <div className={styles.copy}>
          <div className={styles.eyebrow}>Movie_ID {movie.id}</div>
          <h1>{movie.title}</h1>
          <div className={styles.metadata}>{movie.releaseDate ? movie.releaseDate.slice(0, 4) : null}{movie.ageRating && <span>{movie.ageRating}</span>}{movie.duration > 0 && <span>{movie.duration} MIN</span>}{movie.genres && <span>{movie.genres}</span>}</div>
          <p className={styles.synopsis}>{movie.synopsis || "No synopsis is recorded for this movie."}</p>
          {movie.credits && <p className={styles.credits}><b>CAST & CREW</b>{movie.credits}</p>}
          <Link className={styles.cta} href="#showtimes">Book tickets <ArrowRight size={15} /></Link>
          <details className={styles.insight}><summary>How movie data is connected</summary><p>This page reads the Movie record and its genre, credit, review, and review-source relationships through the cinema API. Ratings appear only when a source score is recorded.</p><code>Movie → Movie_Genre_Details → Genre<br />Movie → Movie_Review → Review_Source</code></details>
        </div>
      </section>
      <section className={styles.reviews}>
        <div className={styles.reviewHeading}><h2>Ratings</h2></div>
        {movie.reviews.length === 0 ? <p className={styles.empty}>No external ratings are recorded for this movie yet.</p> : <div>{Object.entries(movie.reviews.reduce<Record<string, Review[]>>((groups, review) => { (groups[review.sourceName] ??= []).push(review); return groups; }, {})).map(([sourceName, reviews]) => <section className={styles.sourceGroup} key={sourceName}><div className={styles.sourceHeading}><strong>{sourceName}</strong><small>{reviews[0].sourceCode}</small></div>{reviews.map((review) => <article className={styles.review} key={review.reviewId}><span className={styles.sourceScore}>{score(review)}</span><span>{review.normalizedScore === null ? "Normalized score unavailable" : `Normalized ${Number(review.normalizedScore).toFixed(2).replace(/\.?0+$/, "")}/100`}</span>{review.sourceUrl || review.websiteUrl ? <a href={review.sourceUrl ?? review.websiteUrl ?? undefined} target="_blank" rel="noreferrer">Visit source <ArrowRight size={12} /></a> : <small>Source link unavailable</small>}</article>)}</section>)}</div>}
        <p className={styles.note}>Ratings are shown from the project database and may be demonstration data; they are not presented as independently verified live scores.</p>
      </section>
      <section className={styles.showtimes} id="showtimes">
        <div className={styles.showtimeHeading}><h2>Showtimes</h2><p>Upcoming screenings for {movie.title}, from the cinema database.</p></div>
        <details className={styles.showtimeInsight}><summary>How these screenings are found</summary><p>The showtime API filters by this Movie_ID, future start time, and available status, then joins theater, branch, and language records.</p></details>
        {loadingShowtimes ? <div className={styles.showtimeState}><LoaderCircle className={styles.spin} size={16} /> Loading screenings…</div> : showtimeError ? <p className={styles.empty} role="alert">{showtimeError}</p> : showtimes.length === 0 ? <p className={styles.empty}>There are no upcoming screenings for this movie.</p> : <div className={styles.showtimeList}>{showtimes.map((showtime) => {
          const date = new Date(`${showtime.startsAt}+07:00`);
          const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", weekday: "short", day: "2-digit", month: "short" }).format(date);
          const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
          const remaining = Math.max(0, Number(showtime.seatCount) - Number(showtime.bookedCount));
          return <article className={styles.showtimeCard} key={showtime.id}><div className={styles.showtimeDate}><strong>{day}</strong><span>{time}</span></div><div className={styles.showtimeDetails}><strong>{showtime.theaterName}</strong><span>{showtime.branchName} · {showtime.audioLanguage}{showtime.subtitleLanguage ? ` / SUB ${showtime.subtitleLanguage}` : ""}</span></div><small>{remaining} / {showtime.seatCount} SEATS LEFT</small><Link className={styles.seatLink} href={`/movie/${movie.id}/seats/${showtime.id}`}>Choose seats <ArrowRight size={13} /></Link></article>;
        })}</div>}
      </section>
    </>}
    <footer className={styles.footer}><Link href="/" aria-label="Major Cineplex home"><MajorLogo height={26} /></Link><span>Database course project · MySQL booking system</span></footer>
  </main>;
}
