"use client";

import {
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Clock3,
  Database,
  LoaderCircle,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { WorkspaceFrame } from "@/components/workspace-frame";
import { LiveDatabaseActivity } from "@/components/live-database-activity";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

type MovieReview = {
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

type Movie = {
  id: number;
  title: string;
  posterImage: string | null;
  synopsis: string | null;
  duration: number;
  releaseDate: string;
  ageRating: string;
  genres: string | null;
  credits: string | null;
  showtimeCount: number;
  reviewCount: number;
  normalizedReviewCount: number;
  averageScore100: string | null;
  reviews: MovieReview[];
};

type Showtime = {
  id: number;
  startsAt: string;
  endsAt: string;
  status: string;
  theaterId: number;
  theaterName: string;
  branchId: number;
  branchName: string;
  audioLanguage: string;
  subtitleLanguage: string | null;
  seatCount: number;
  bookedCount: number;
};

type Seat = {
  id: number;
  seatRow: string;
  seatColumn: number;
  physicalStatus: string;
  seatTypeId: number;
  seatTypeName: string;
  status: "AVAILABLE" | "BOOKED";
  priceId: number | null;
  price: number | string | null;
};

type PaymentMethod = { id: number; name: string };
type SqlStatement = { label: string; sql: string; affectedRows: number };
type DatabaseActivityEntry = {
  timestamp: string;
  kind: string;
  label: string;
  tables: string[];
  sql: string | null;
  outcome: string;
  affectedRows: number | null;
};
type BookingDatabaseState = {
  affectedTables: string[];
  before: {
    tableCounts: { customer: number; booking: number; ticket: number; payment: number };
    seats: Array<{ seatId: number; label: string; status: string; ticketId: number | null }>;
  };
  after: {
    tableCounts: { customer: number; booking: number; ticket: number; payment: number };
    seats: Array<{ seatId: number; label: string; status: string; ticketId: number | null }>;
    tickets: Array<{ ticketId: number; seatId: number; soldPrice: number }>;
    payment: { paymentId: number; bookingId: number; paidAmount: number; status: string };
  };
};
type BookingReceipt = {
  id: number;
  paymentId: number;
  showtimeId: number;
  total: number;
  ticketIds: number[];
  seats: string[];
  databaseState?: BookingDatabaseState;
  transaction?: string;
  activity?: DatabaseActivityEntry[];
};
type RollbackDemoResult = {
  transaction: string;
  showtimeId: number;
  failure: string;
  before: { customer: number; booking: number; ticket: number; payment: number };
  after: { customer: number; booking: number; ticket: number; payment: number };
  attempted: { customerId: number; bookingId: number };
  persistedDemoRows: { customer: number; booking: number; payment: number };
  noPartialRows: boolean;
  statements: Array<{ label: string; sql: string; outcome: string; affectedRows: number }>;
  activity: DatabaseActivityEntry[];
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

function formatShowtime(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", {
    ...options,
    timeZone: "Asia/Bangkok",
  }).format(new Date(`${value}+07:00`));
}

function formatRawScore(review: MovieReview) {
  if (review.scoreType.toUpperCase() === "PERCENT") return `${review.rawScore}%`;
  const max = review.scoreMax ? Number(review.scoreMax).toString() : null;
  return max ? `${review.rawScore}/${max}` : review.rawScore;
}

function ActivityTimeline({ events }: { events: DatabaseActivityEntry[] }) {
  return <div className="activity-view" aria-label="Database activity timeline">
    <div className="activity-view-heading"><strong>DATABASE ACTIVITY</strong><span>SAFE SQL · PARAMETER VALUES OMITTED</span></div>
    <div className="activity-event-list">{events.map((event, index) => <article className="activity-event" key={`${event.timestamp}-${event.kind}-${index}`}>
      <time dateTime={event.timestamp}>{new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(event.timestamp))}</time>
      <span className={`activity-kind activity-kind-${event.kind.toLowerCase()}`}>{event.kind}</span>
      <div className="activity-event-main"><strong>{event.label}</strong><small>{event.tables.length ? `TABLES · ${event.tables.join(", ")}` : "APPLICATION / TRANSACTION"}</small>{event.sql && <code>{event.sql}</code>}</div>
      <span className={`activity-outcome activity-outcome-${event.outcome.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{event.outcome}{event.affectedRows !== null ? ` · ${event.affectedRows} ROW${event.affectedRows === 1 ? "" : "S"}` : ""}</span>
    </article>)}</div>
  </div>;
}

function Poster({ movie, large = false }: { movie: Movie; large?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className={`poster-art ${large ? "poster-art-large" : ""}`}>
      {movie.posterImage && !imageFailed ? <Image className="poster-image" src={movie.posterImage} alt="" fill sizes="(max-width: 700px) 54px, 64px" unoptimized onError={() => setImageFailed(true)} /> : <span className="poster-missing">POSTER<br />UNAVAILABLE</span>}
    </div>
  );
}

function StepLabel({ number, label, active, complete }: {
  number: string;
  label: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <div className={`step-label ${active ? "step-active" : ""} ${complete ? "step-complete" : ""}`}>
      <span>{complete ? <Check size={12} strokeWidth={3} /> : number}</span>
      <b>{label}</b>
    </div>
  );
}

function LoadingMark() {
  return <LoaderCircle className="loading-spin" size={16} />;
}

export default function Home() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [showtimes, setShowtimes] = useState<Showtime[]>([]);
  const [showtime, setShowtime] = useState<Showtime | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState(1);
  const [selectedSeatIds, setSelectedSeatIds] = useState<number[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"discover" | "seats" | "details" | "confirmed">("discover");
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [databaseStatus, setDatabaseStatus] = useState<"checking" | "online" | "offline">("checking");
  const [loadingShows, setLoadingShows] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);
  const [statements, setStatements] = useState<SqlStatement[]>([]);
  const [replayed, setReplayed] = useState(false);
  const [rollbackResult, setRollbackResult] = useState<RollbackDemoResult | null>(null);
  const [runningRollbackDemo, setRunningRollbackDemo] = useState(false);
  const [rollbackDemoError, setRollbackDemoError] = useState("");
  const [activityOperationId, setActivityOperationId] = useState<string | null>(null);
  const idempotencyKey = useRef("");

  const selectedSeats = useMemo(
    () => seats.filter((seat) => selectedSeatIds.includes(seat.id)),
    [seats, selectedSeatIds],
  );
  const total = selectedSeats.reduce((sum, seat) => sum + Number(seat.price ?? 0), 0);
  const loadShowtimes = useCallback(async (movieId: number): Promise<Showtime[]> => {
    setLoadingShows(true);
    setShowtime(null);
    setSeats([]);
    setSelectedSeatIds([]);
    setStep("discover");
    setError("");
    try {
      const response = await fetch(`/api/showtimes?movieId=${movieId}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load showtimes.");
      const nextShowtimes = result.showtimes as Showtime[];
      setShowtimes(nextShowtimes);
      return nextShowtimes;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load showtimes.");
      return [];
    } finally {
      setLoadingShows(false);
    }
  }, []);

  const chooseShowtime = useCallback(async (nextShowtime: Showtime, preferredSeatIds: number[] = []) => {
    setLoadingSeats(true);
    setError("");
    setShowtime(nextShowtime);
    setSelectedSeatIds([]);
    setReceipt(null);
    setStatements([]);
    try {
      const response = await fetch(`/api/showtimes/${nextShowtime.id}/seats`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not load seats.");
      const nextSeats = result.seats as Seat[];
      setSeats(nextSeats);
      const availablePreferredSeats = nextSeats
        .filter((seat) => preferredSeatIds.includes(seat.id) && seat.status === "AVAILABLE" && seat.physicalStatus === "AVAILABLE" && seat.priceId !== null)
        .slice(0, 4);
      setSelectedSeatIds(availablePreferredSeats.map((seat) => seat.id));
      if (preferredSeatIds.length > availablePreferredSeats.length) {
        setError("One or more selected seats are no longer available. Review the updated seat map before continuing.");
      }
      setPaymentMethods(result.paymentMethods as PaymentMethod[]);
      const methods = result.paymentMethods as PaymentMethod[];
      setPaymentMethodId(methods[0]?.id ?? 1);
      setStep("seats");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load seats.");
    } finally {
      setLoadingSeats(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((result) => setDatabaseStatus(result.status === "ok" ? "online" : "offline"))
      .catch(() => setDatabaseStatus("offline"));
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/movies")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not connect to the database.");
        return result.movies as Movie[];
      })
      .then((result) => {
        if (!active) return;
        setMovies(result);
        const requestedMovieId = Number(new URLSearchParams(window.location.search).get("movieId"));
        const requestedMovie = result.find((item) => item.id === requestedMovieId) ?? null;
        setMovie(requestedMovie);
        if (requestedMovie) {
          const requestedShowtimeId = Number(new URLSearchParams(window.location.search).get("showtimeId"));
          const requestedSeatIds = new URLSearchParams(window.location.search).get("seatIds")
            ?.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0) ?? [];
          void loadShowtimes(requestedMovie.id).then(async (availableShowtimes) => {
            const requestedShowtime = availableShowtimes.find((item) => item.id === requestedShowtimeId);
            if (requestedShowtime) await chooseShowtime(requestedShowtime, requestedSeatIds);
            window.setTimeout(() => document.getElementById("booking")?.scrollIntoView({ behavior: "smooth", block: "start" }), requestedShowtime ? 0 : 100);
          });
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not connect to the database.");
      })
      .finally(() => {
        if (active) setLoadingMovies(false);
      });
    return () => { active = false; };
  }, [chooseShowtime, loadShowtimes]);

  function toggleSeat(seat: Seat) {
    if (seat.status !== "AVAILABLE" || seat.physicalStatus !== "AVAILABLE" || seat.priceId === null) return;
    setSelectedSeatIds((current) => {
      if (current.includes(seat.id)) return current.filter((id) => id !== seat.id);
      if (current.length >= 4) return current;
      return [...current, seat.id];
    });
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!showtime || selectedSeatIds.length === 0) return;
    setSubmitting(true);
    setError("");
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID();
    const operationId = crypto.randomUUID();
    setActivityOperationId(operationId);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Operation-ID": operationId },
        body: JSON.stringify({
          showtimeId: showtime.id,
          seatIds: selectedSeatIds,
          firstName,
          lastName,
          email,
          phone,
          paymentMethodId,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Booking could not be completed.");
      setReceipt({
        ...(result.booking as BookingReceipt),
        databaseState: result.databaseState as BookingDatabaseState | undefined,
        transaction: result.transaction as string | undefined,
        activity: result.activity as DatabaseActivityEntry[] | undefined,
      });
      setStatements(result.statements as SqlStatement[]);
      setReplayed(Boolean(result.replayed));
      setStep("confirmed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Booking could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function runRollbackDemo() {
    setRunningRollbackDemo(true);
    setRollbackDemoError("");
    setRollbackResult(null);
    try {
      const response = await fetch("/api/transactions/rollback-demo", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "The rollback demonstration failed.");
      setRollbackResult(result as RollbackDemoResult);
    } catch (cause) {
      setRollbackDemoError(cause instanceof Error ? cause.message : "The rollback demonstration failed.");
    } finally {
      setRunningRollbackDemo(false);
    }
  }

  function startAgain() {
    setReceipt(null);
    setStatements([]);
    setShowtime(null);
    setSelectedSeatIds([]);
    setStep("discover");
    idempotencyKey.current = "";
    if (movie) void loadShowtimes(movie.id);
  }

  const hasFutureShows = movies.some((item) => Number(item.showtimeCount) > 0);
  return (
    <WorkspaceFrame page="booking">

      <section className="cinema-hero" id="top">
        <div className="cinema-hero-image" aria-hidden="true"><svg className="cinema-hero-art" viewBox="0 0 1600 800" preserveAspectRatio="xMidYMid slice" role="presentation">
          <defs><linearGradient id="auditorium" x2="0" y2="1"><stop stopColor="#33483b" /><stop offset="1" stopColor="#111b17" /></linearGradient><linearGradient id="screen" x2="1" y2="1"><stop stopColor="#dfb997" /><stop offset=".55" stopColor="#a76b52" /><stop offset="1" stopColor="#465b51" /></linearGradient><radialGradient id="screenGlow"><stop stopColor="#f4d2a3" stopOpacity=".48" /><stop offset="1" stopColor="#f4d2a3" stopOpacity="0" /></radialGradient></defs>
          <rect width="1600" height="800" fill="url(#auditorium)" /><ellipse cx="1050" cy="340" rx="700" ry="430" fill="url(#screenGlow)" /><path d="M710 110h670v385H710z" fill="#26362e" stroke="#8c7660" strokeWidth="8" /><path d="M738 138h614v329H738z" fill="url(#screen)" /><path d="M738 390c130-88 214-12 323-99 113-90 184-25 291-126v302H738z" fill="#354940" opacity=".76" /><path d="M738 420c132-62 241-24 353-100 92-63 178-22 261-58v205H738z" fill="#182720" opacity=".82" /><path d="M0 800 330 470h940l330 330z" fill="#101814" /><path d="M0 800 268 540l170 70-72 190zM1600 800l-268-260-170 70 72 190z" fill="#523932" opacity=".78" /><g fill="#0b100e"><path d="M410 800c0-128 61-197 148-197s148 69 148 197zM718 800c0-151 73-232 177-232s177 81 177 232zM1080 800c0-128 61-197 148-197s148 69 148 197z" /></g><g fill="#b0714d" opacity=".7"><circle cx="170" cy="171" r="4"/><circle cx="310" cy="258" r="3"/><circle cx="1430" cy="185" r="4"/><circle cx="1510" cy="327" r="3"/></g>
        </svg></div>
        <div className="cinema-hero-shade" />
        <div className="cinema-hero-copy"><div className="eyebrow"><span className="eyebrow-line" /> NOW SHOWING / CINEMA.DB</div><h1>Stories are<br /><em>better here.</em></h1><p>Find your next film, choose your seats, and settle in.</p><a className="cinema-hero-link" href="#movies">Explore movies <ArrowDownRight size={15} /></a></div>
        <div className="cinema-hero-caption"><span>{databaseStatus === "online" ? "LIVE CINEMA LISTINGS" : databaseStatus === "offline" ? "LISTINGS UNAVAILABLE" : "CONNECTING TO CINEMA"}</span><span>MYSQL → API → MOVIE CARDS</span></div>
      </section>

      <section className="collection section-wrap cinema-collection" id="movies">
        <div className="section-heading"><div><div className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> BOOKING CASE STUDY</div><h2>Now <em>showing.</em></h2></div><p className="section-intro">Explore a title to see its details and ratings, then find a screening near you.</p><div className="collection-count"><span>{String(movies.length).padStart(2, "0")}</span><small>LIVE MOVIES<br />IN DATABASE</small></div></div>
        <div className="movie-insight"><Database size={14} /><span>Movie information comes from MySQL through the cinema API. Titles, posters, and scores appear only when recorded.</span></div>
        {error && movies.length === 0 && !loadingMovies && <div className="movie-reviews-empty" role="alert">{error} Please check the database connection and try again.</div>}
        <div className="movie-grid cinema-movie-grid" aria-busy={loadingMovies}>
          {loadingMovies ? <div className="loading-state"><LoadingMark /> Loading movies from the cinema…</div> : movies.length === 0 ? <div className="loading-state">No movie records are available in the database.</div> : movies.slice(0, 10).map((item) => {
            const count = Number(item.showtimeCount);
            return <Link className={`movie-card cinema-movie-card ${count === 0 ? "movie-card-no-show" : ""}`} key={item.id} href={`/movie/${item.id}`} aria-label={`Explore ${item.title}`}>
              <div className="movie-card-poster"><Poster movie={item} /><span className="poster-card-index">NOW SHOWING</span>{count > 0 && <span className="poster-showtime-badge"><span /> {count} SHOWTIME{count === 1 ? "" : "S"}</span>}</div>
              <div className="movie-card-info">{item.ageRating && <span className="movie-rating">{item.ageRating}</span>}<h3>{item.title}</h3><div className="movie-meta"><span>{item.genres || "Genre unavailable"}</span><span className="meta-dot">·</span><span>{item.releaseDate ? item.releaseDate.slice(0, 4) : "Release year unavailable"}</span></div>{item.reviews.some((review) => review.rawScore.trim() !== "" && Number.isFinite(Number(review.rawScore))) && <div className="movie-card-review-lines">{item.reviews.filter((review) => review.rawScore.trim() !== "" && Number.isFinite(Number(review.rawScore))).slice(0, 2).map((review) => <span key={review.reviewId}><b>{review.sourceName}</b><strong>{formatRawScore(review)}</strong></span>)}</div>}<span className="movie-explore">EXPLORE FILM <ArrowRight size={12} /></span></div>
            </Link>;
          })}
        </div>
      </section>
      <section className="booking-case-study section-wrap" id="booking">
        <LiveDatabaseActivity key={activityOperationId ?? "booking-idle"} operationId={activityOperationId} fallbackEvents={receipt?.activity ?? []} running={submitting} />

        {error && step !== "confirmed" && <div className="error-banner"><CircleHelp size={17} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}

        <div className="selection-panel">
          <div className="selection-topline"><span><span className="selection-dot" /> BOOKING WORKFLOW</span><span>CASE STUDY / SHOWTIME → SEAT → TRANSACTION</span></div>
          <div className="selection-title-row"><div><div className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> {movie?.title ?? "CHOOSE A FILM"}</div><h2>Find your showtime.</h2></div><div className="flow-steps"><StepLabel number="01" label="FILM" active={step === "discover"} complete={Boolean(showtime)} /><span className="flow-connector" /><StepLabel number="02" label="SEATS" active={step === "seats"} complete={step === "details" || step === "confirmed"} /><span className="flow-connector" /><StepLabel number="03" label="DETAILS" active={step === "details"} complete={step === "confirmed"} /><span className="flow-connector" /><StepLabel number="04" label="DONE" active={step === "confirmed"} complete={step === "confirmed"} /></div></div>

          {movie && <details className="booking-learning"><summary>How showtimes are found</summary><p>The cinema API filters available future screenings by this Movie_ID and joins the matching theater, branch, and language records.</p></details>}

          {!movie && <div className="empty-state">Choose a film from the collection to see screenings.</div>}
          {movie && loadingShows && <div className="inline-loading"><LoadingMark /> Finding showtimes in MySQL…</div>}
          {movie && !loadingShows && showtimes.length === 0 && <div className="empty-state"><div className="empty-state-icon"><Clock3 size={18} /></div><div><strong>No upcoming screenings</strong><p>{hasFutureShows ? "This title has no future showtimes in the database yet." : "The database has no future showtimes yet."}</p></div><span className="empty-state-date">LIVE DB QUERY</span></div>}

          {showtimes.length > 0 && !showtime && (
            <div className="showtime-list">
              {showtimes.map((item, index) => (
                <button className="showtime-card" key={item.id} onClick={() => void chooseShowtime(item)} disabled={loadingSeats}>
                  <span className="showtime-number">0{index + 1}</span>
                  <span className="showtime-date"><b>{formatShowtime(item.startsAt, { weekday: "short", day: "2-digit", month: "short" })}</b><small>{item.audioLanguage}{item.subtitleLanguage ? ` / SUB ${item.subtitleLanguage}` : ""}</small></span>
                  <span className="showtime-time">{formatShowtime(item.startsAt, { hour: "2-digit", minute: "2-digit", hour12: false })}<small>START</small></span>
                  <span className="showtime-place"><b>{item.theaterName}</b><small><MapPin size={10} /> {item.branchName}</small></span>
                  <span className="showtime-seats">{Number(item.seatCount) - Number(item.bookedCount)} / {item.seatCount}<small>SEATS LEFT</small></span>
                  <span className="showtime-action">{loadingSeats ? <LoadingMark /> : <ChevronRight size={18} />}</span>
                </button>
              ))}
            </div>
          )}

          {showtime && step !== "confirmed" && (
            <div className="booking-workspace">
              <div className="screening-summary"><span className="summary-poster"><Poster movie={movie!} /></span><div className="summary-copy"><span>YOUR SCREENING</span><strong>{movie?.title}</strong><small>{formatShowtime(showtime.startsAt, { weekday: "long", day: "numeric", month: "long" })} · {formatShowtime(showtime.startsAt, { hour: "2-digit", minute: "2-digit", hour12: false })}</small><small>{showtime.theaterName} · {showtime.branchName}</small></div><button className="change-screening" onClick={() => { setShowtime(null); setStep("discover"); setSelectedSeatIds([]); }}>Change <ChevronDown size={13} /></button></div>

              {loadingSeats ? <div className="inline-loading"><LoadingMark /> Loading live seat map…</div> : (
                <div className="seat-and-summary">
                  <div className="seat-area">
                    <div className="seat-map-guide"><span>Tap to choose · up to 4 seats</span><strong aria-live="polite">{selectedSeatIds.length} / 4 SELECTED</strong></div>
                    <details className="booking-learning seat-learning"><summary>How seat availability works</summary><p>Booked status comes from ticket rows for this screening. The booking endpoint checks seats again inside its transaction before writing tickets.</p></details>
                    <div className="screen-label"><span /> SCREEN <span /></div>
                    <div className="screen-curve" />
                    <div className="seat-map-viewport">
                      <div className="seat-map" role="group" aria-label="Seat selection">
                        {[...new Set(seats.map((seat) => seat.seatRow))].map((rowName) => {
                          const rowSeats = seats.filter((seat) => seat.seatRow === rowName);
                          return <div className="seat-row" key={rowName}><span className="row-label">{rowName}</span>{rowSeats.map((seat) => {
                            const selected = selectedSeatIds.includes(seat.id);
                            const unavailable = seat.status !== "AVAILABLE" || seat.physicalStatus !== "AVAILABLE" || seat.priceId === null;
                            return <button key={seat.id} className={`seat ${selected ? "seat-selected" : ""} ${unavailable ? "seat-unavailable" : ""} ${seat.seatTypeId !== 1 ? "seat-premium" : ""}`} disabled={unavailable} onClick={() => toggleSeat(seat)} aria-pressed={selected} aria-label={`${seat.seatRow}${seat.seatColumn}, ${seat.seatTypeName}, ${unavailable ? "unavailable" : selected ? "selected" : "available"}, ${seat.priceId === null ? "price unavailable" : money.format(Number(seat.price))}`} title={`${seat.seatTypeName}${seat.priceId === null ? " · price unavailable" : ` · ${money.format(Number(seat.price))}`}`}>
                              {selected ? <Check size={13} /> : String(seat.seatColumn).padStart(2, "0")}
                            </button>;
                          })}</div>;
                        })}
                      </div>
                    </div>
                    <div className="seat-legend"><span><i className="legend-available" /> AVAILABLE</span><span><i className="legend-selected" /> SELECTED</span><span><i className="legend-booked" /> BOOKED</span></div>
                  </div>
                  <aside className="seat-summary">
                    <div className="summary-heading"><span>BOOKING SUMMARY</span><Ticket size={16} /></div>
                    <div className="summary-movie">{movie?.title}<small>{showtime.theaterName} · {formatShowtime(showtime.startsAt, { hour: "2-digit", minute: "2-digit", hour12: false })}</small></div>
                    <div className="summary-seat-list">{selectedSeats.length === 0 ? <span className="summary-placeholder">Select up to four seats</span> : selectedSeats.map((seat) => <div className="summary-seat" key={seat.id}><span>{seat.seatRow}{seat.seatColumn} <small>{seat.seatTypeName}</small></span><b>{money.format(Number(seat.price))}</b></div>)}</div>
                    <div className="summary-total"><span>TOTAL</span><strong>{money.format(total)}</strong></div>
                    <details className="booking-learning summary-learning"><summary>How this booking is saved</summary><p>On confirmation, the server validates the seats and prices and writes the customer, booking, ticket, and payment records together.</p></details>
                    {selectedSeats.length > 0 && <button className="primary-button summary-continue" onClick={() => setStep("details")}>Continue to details <ArrowRight size={15} /></button>}
                    <div className="summary-note"><ShieldCheck size={14} /><span>Seat availability is checked again before booking.</span></div>
                  </aside>
                </div>
              )}

              {step === "details" && (
                <div className="details-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setStep("seats"); }}>
                  <form className="details-card" onSubmit={submitBooking}>
                    <div className="details-heading"><div><span className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> CHECKOUT / 03</span><h3>One last thing.</h3></div><button type="button" className="icon-button" onClick={() => setStep("seats")} aria-label="Back to seats"><X size={17} /></button></div>
                    <p className="details-copy">Add a contact for the ticket record. Payment is simulated for this database demonstration.</p>
                    <div className="form-grid"><label>FIRST NAME<input required maxLength={50} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Alex" /></label><label>LAST NAME<input required maxLength={50} autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Morgan" /></label></div>
                    <label className="form-field">EMAIL<input required type="email" maxLength={255} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="alex@example.com" /></label>
                    <label className="form-field">PHONE<input required type="tel" maxLength={20} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+66 81 234 5678" /></label>
                    <label className="form-field">PAYMENT METHOD<select value={paymentMethodId} onChange={(event) => setPaymentMethodId(Number(event.target.value))}>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>
                    {error && <div className="form-error"><CircleHelp size={15} /> {error}</div>}
                    <div className="checkout-total"><span>{selectedSeats.length} TICKET{selectedSeats.length === 1 ? "" : "S"}</span><strong>{money.format(total)}</strong></div>
                    <button className="primary-button checkout-button" type="submit" disabled={submitting}>{submitting ? <><LoadingMark /> Saving transaction…</> : <>Confirm demo booking <ArrowRight size={15} /></>}</button>
                    <span className="checkout-footnote">This will write to the connected MySQL database.</span>
                  </form>
                </div>
              )}
            </div>
          )}

          {receipt && step === "confirmed" && (
            <div className="confirmation-panel">
              <div className="confirmation-mark"><Check size={22} /></div>
              <div className="confirmation-copy"><span>TRANSACTION COMMITTED {replayed ? "· REPLAYED SAFELY" : "· LIVE MYSQL"}</span><h3>The records are <em>committed.</em></h3><p>Booking #{String(receipt.id).padStart(6, "0")} · {receipt.seats.join(", ")} · {money.format(receipt.total)}</p></div>
              <button className="secondary-button" onClick={startAgain}><RotateCcw size={14} /> Start another booking</button>
              <Link className="database-result-link" href={`/database?bookingId=${receipt.id}`}>Inspect persisted booking rows in Database Explorer <ArrowRight size={13} /></Link>
              <a className="database-result-link" href="#transactions">Explore the Transaction Lab <ArrowRight size={13} /></a>
              <div className="transaction-stats"><div><small>BOOKING</small><b>#{receipt.id}</b></div><div><small>TICKETS</small><b>{receipt.ticketIds.length}</b></div><div><small>PAYMENT</small><b>#{receipt.paymentId}</b></div><div><small>TOTAL</small><b>{money.format(receipt.total)}</b></div></div>
              <div className="sql-trace"><div className="sql-trace-heading"><div><span>THE DATA TRAIL</span><small>{receipt.transaction ?? (replayed ? "IDEMPOTENT REPLAY" : "COMMITTED")} · {statements.reduce((sum, row) => sum + row.affectedRows, 0)} ROWS AFFECTED</small></div><Database size={17} /></div><div className="trace-flow"><span>USER ACTION</span><ArrowRight size={12} /><span>POST /API/BOOKINGS</span><ArrowRight size={12} /><span>BEGIN</span><ArrowRight size={12} /><span>MYSQL</span><ArrowRight size={12} /><span>COMMIT</span><Check size={13} /></div>
                {replayed ? <div className="replay-note"><RotateCcw size={13} /> An earlier request with this key already committed. No second booking was created.</div> : receipt.databaseState && <div className="before-after"><div><span>BEFORE · LIVE MYSQL STATE</span><strong>{receipt.databaseState.before.seats.map((seat) => `${seat.label} · ${seat.status}`).join(", ")}</strong><div className="database-row-counts">{Object.entries(receipt.databaseState.before.tableCounts).map(([table, count]) => <span key={table}>{table} <b>{count}</b></span>)}</div><small>Seat availability derived from ticket rows for showtime #{receipt.showtimeId}</small></div><ArrowRight size={16} /><div><span>AFTER · CONFIRMED MYSQL STATE</span><strong>{receipt.databaseState.after.seats.map((seat) => `${seat.label} · ${seat.status} · ticket #${seat.ticketId ?? "—"}`).join(", ")}</strong><div className="database-row-counts">{Object.entries(receipt.databaseState.after.tableCounts).map(([table, count]) => <span key={table}>{table} <b>{count}</b></span>)}</div><small>Booking #{receipt.id} · {receipt.databaseState.after.tickets.length} ticket row{receipt.databaseState.after.tickets.length === 1 ? "" : "s"} · payment #{receipt.databaseState.after.payment.paymentId} {receipt.databaseState.after.payment.status}</small></div></div>}
                {!replayed && receipt.databaseState && <div className="affected-tables"><span>TABLES AFFECTED</span>{receipt.databaseState.affectedTables.map((table) => <b key={table}>{table}</b>)}</div>}
                {statements.map((statement, index) => <div className="sql-row" key={`${statement.label}-${index}`}><div className="sql-row-meta"><span className="sql-step">0{index + 1}</span><b>{statement.label}</b><small>{statement.affectedRows} row{statement.affectedRows === 1 ? "" : "s"}</small></div><code>{statement.sql}</code></div>)}
              </div>
            </div>
          )}
        </div>
        <div className="rollback-demo-panel" id="transactions">
          <div className="rollback-demo-copy"><div className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> 04 / TRANSACTION LAB</div><h3>See a rollback.<br /><em>Keep the data consistent.</em></h3><p>This controlled run inserts a temporary customer and booking, then deliberately violates the payment method foreign key. MySQL rolls back the transaction; no demo records should remain.</p></div>
          <div className="rollback-demo-action"><span>BEGIN → INSERT CUSTOMER → INSERT BOOKING → PAYMENT FK FAIL → ROLLBACK</span><button className="secondary-button" onClick={() => void runRollbackDemo()} disabled={runningRollbackDemo}><RotateCcw size={14} /> {runningRollbackDemo ? "Running rollback…" : "Run rollback demonstration"}</button></div>
          {rollbackDemoError && <div className="rollback-demo-error" role="alert"><CircleHelp size={15} /> {rollbackDemoError}</div>}
          {rollbackResult && <div className="rollback-result" aria-live="polite">
            <div className={`rollback-result-status ${rollbackResult.noPartialRows ? "rollback-verified" : "rollback-unverified"}`}><span>{rollbackResult.noPartialRows ? <Check size={14} /> : <CircleHelp size={14} />}</span><div><strong>{rollbackResult.noPartialRows ? "ROLLBACK VERIFIED" : "CHECK DATABASE STATE"}</strong><small>{rollbackResult.failure}</small></div><b>{rollbackResult.transaction}</b></div>
            <div className="rollback-count-grid">{(["customer", "booking", "ticket", "payment"] as const).map((table) => <div key={table}><span>{table}</span><strong>{rollbackResult.before[table]} <ArrowRight size={11} /> {rollbackResult.after[table]}</strong></div>)}</div>
            <div className="rollback-attempt-summary"><span>ATTEMPTED IDs (NOT PERSISTED)</span><b>customer #{rollbackResult.attempted.customerId} · booking #{rollbackResult.attempted.bookingId}</b><small>Persisted demo rows: customer {rollbackResult.persistedDemoRows.customer}, booking {rollbackResult.persistedDemoRows.booking}, payment {rollbackResult.persistedDemoRows.payment}. Auto-increment values may advance during a rollback.</small></div>
            <ActivityTimeline events={rollbackResult.activity} />
          </div>}
        </div>
        <div className="collection-footnote"><span>MAKE IT A MOVIE NIGHT.</span><span>CHOOSE A FILM · FIND A SHOWTIME · PICK YOUR SEATS</span><a href="#top">BACK TO TOP <ChevronDown size={13} /></a></div>
      </section>

      <footer className="footer"><a className="brand-lockup" href="#top"><span className="brand-mark"><Clapperboard size={16} /></span><span className="brand-type">cinema<span>/</span>db</span></a><span>YOUR NEXT SHOW STARTS HERE.</span><a href="#top">BACK TO TOP <ArrowRight className="back-top-icon" size={12} /></a></footer>
    </WorkspaceFrame>
  );
}
