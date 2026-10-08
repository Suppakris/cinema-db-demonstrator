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
  Film,
  LoaderCircle,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

type Movie = {
  id: number;
  title: string;
  posterImage: string | null;
  synopsis: string | null;
  duration: number;
  releaseDate: string;
  ageRating: string;
  showtimeCount: number;
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
type BookingReceipt = {
  id: number;
  paymentId: number;
  showtimeId: number;
  total: number;
  ticketIds: number[];
  seats: string[];
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

function posterTone(id: number) {
  return `poster-tone-${((id - 1) % 7) + 1}`;
}

function Poster({ movie, large = false }: { movie: Movie; large?: boolean }) {
  return (
    <div className={`poster-art ${posterTone(movie.id)} ${large ? "poster-art-large" : ""}`}>
      <span className="poster-orbit poster-orbit-one" />
      <span className="poster-orbit poster-orbit-two" />
      <span className="poster-vertical" />
      <span className="poster-index">CINEMA / 0{movie.id}</span>
      <span className="poster-title">{movie.title}</span>
      <span className="poster-foot">A DATABASE PICTURE HOUSE</span>
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
  const idempotencyKey = useRef("");

  const selectedSeats = useMemo(
    () => seats.filter((seat) => selectedSeatIds.includes(seat.id)),
    [seats, selectedSeatIds],
  );
  const total = selectedSeats.reduce((sum, seat) => sum + Number(seat.price ?? 0), 0);

  const loadShowtimes = useCallback(async (movieId: number) => {
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
      setShowtimes(result.showtimes as Showtime[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load showtimes.");
    } finally {
      setLoadingShows(false);
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
        const firstAvailable = result.find((item) => Number(item.showtimeCount) > 0) ?? result[0] ?? null;
        setMovie(firstAvailable);
        if (firstAvailable) void loadShowtimes(firstAvailable.id);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Could not connect to the database.");
      })
      .finally(() => {
        if (active) setLoadingMovies(false);
      });
    return () => { active = false; };
  }, [loadShowtimes]);

  async function chooseShowtime(nextShowtime: Showtime) {
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
      setSeats(result.seats as Seat[]);
      setPaymentMethods(result.paymentMethods as PaymentMethod[]);
      const methods = result.paymentMethods as PaymentMethod[];
      setPaymentMethodId(methods[0]?.id ?? 1);
      setStep("seats");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load seats.");
    } finally {
      setLoadingSeats(false);
    }
  }

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
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setReceipt(result.booking as BookingReceipt);
      setStatements(result.statements as SqlStatement[]);
      setReplayed(Boolean(result.replayed));
      setStep("confirmed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Booking could not be completed.");
    } finally {
      setSubmitting(false);
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
    <main className="cinema-shell">
      <header className="topbar">
        <a className="brand-lockup" href="#top" aria-label="Cinema database home">
          <span className="brand-mark"><Clapperboard size={18} /></span>
          <span className="brand-type">cinema<span>/</span>db</span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a className="nav-current" href="#movies">The collection</a>
          <a href="#booking">Booking flow</a>
          <a href="#data-trail">Data trail</a>
        </nav>
        <div className={`db-status ${databaseStatus === "offline" ? "db-offline" : ""}`}><span className="status-dot" /><span>{databaseStatus === "checking" ? "CHECKING MYSQL" : databaseStatus === "online" ? "MYSQL CONNECTED" : "MYSQL OFFLINE"}</span><span className="status-separator">·</span><span>LIVE DATA</span></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid" />
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> DATABASE DEMONSTRATOR <span className="eyebrow-muted">/ 01</span></div>
          <h1>Every seat has<br /><em>a story.</em></h1>
          <p className="hero-description">Choose a film. Find your seat. Follow every change all the way into the database.</p>
          <a className="hero-link" href="#movies">Explore the collection <ArrowDownRight size={15} /></a>
          <div className="hero-caption"><span>LIVE CONNECTION</span><span className="caption-divider" /> mysql / cinema_db</div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-ring hero-ring-outer" />
          <div className="hero-ring hero-ring-inner" />
          <div className="hero-visual-core"><Film size={28} strokeWidth={1.1} /><span>DATA<br />IN MOTION</span></div>
          <span className="hero-orbit-label label-top">MOVIE</span>
          <span className="hero-orbit-label label-right">SHOWTIME</span>
          <span className="hero-orbit-label label-bottom">SEAT</span>
          <span className="hero-orbit-label label-left">BOOKING</span>
          <span className="orbit-point point-one" /><span className="orbit-point point-two" />
          <div className="hero-visual-note"><span className="note-line" /> A SMALL FLOW, A REAL DATABASE</div>
        </div>
        <div className="hero-bottom"><span>01—04 / SELECT · SEAT · CONFIRM · TRACE</span><span>SCROLL TO BEGIN <ChevronDown size={14} /></span></div>
      </section>

      <section className="collection section-wrap" id="movies">
        <div className="section-heading">
          <div><div className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> THE COLLECTION</div><h2>A good place<br />to <em>begin.</em></h2></div>
          <p className="section-intro">A small selection from the live cinema database. Each title leads to its showtimes, theater, seats and prices.</p>
          <div className="collection-count"><span>{String(movies.length).padStart(2, "0")}</span><small>FILMS<br />IN DATABASE</small></div>
        </div>

        {error && step !== "confirmed" && <div className="error-banner"><CircleHelp size={17} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}

        <div className="movie-grid" aria-busy={loadingMovies}>
          {loadingMovies ? (
            <div className="loading-state"><LoadingMark /> Loading live titles…</div>
          ) : movies.map((item) => {
            const active = movie?.id === item.id;
            const count = Number(item.showtimeCount);
            return (
              <button
                className={`movie-card ${active ? "movie-card-active" : ""} ${count === 0 ? "movie-card-no-show" : ""}`}
                key={item.id}
                onClick={() => { setMovie(item); void loadShowtimes(item.id); }}
                aria-pressed={active}
              >
                <div className="movie-card-poster"><Poster movie={item} /><span className="poster-card-index">FILM — {String(item.id).padStart(2, "0")}</span>{count > 0 && <span className="poster-showtime-badge"><span /> {count} SHOWTIME{count === 1 ? "" : "S"}</span>}</div>
                <div className="movie-card-info"><span className="movie-rating">{item.ageRating || "NR"}</span><h3>{item.title}</h3><div className="movie-meta"><span>{item.duration} MIN</span><span className="meta-dot">·</span><span>{count > 0 ? "NOW SHOWING" : "NO FUTURE SHOWS"}</span></div></div>
                <span className="movie-card-arrow"><ArrowRight size={15} /></span>
              </button>
            );
          })}
        </div>

        <div className="selection-panel" id="booking">
          <div className="selection-topline"><span><span className="selection-dot" /> YOUR SCREENING</span><span>DATABASE RECORD / SHOWTIME</span></div>
          <div className="selection-title-row"><div><div className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> {movie?.title ?? "CHOOSE A FILM"}</div><h2>{showtime ? "Choose your seats." : "Find your showtime."}</h2></div><div className="flow-steps"><StepLabel number="01" label="FILM" active={step === "discover"} complete={Boolean(showtime)} /><span className="flow-connector" /><StepLabel number="02" label="SEATS" active={step === "seats"} complete={step === "details" || step === "confirmed"} /><span className="flow-connector" /><StepLabel number="03" label="DETAILS" active={step === "details"} complete={step === "confirmed"} /><span className="flow-connector" /><StepLabel number="04" label="DONE" active={step === "confirmed"} complete={step === "confirmed"} /></div></div>

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
                    <div className="screen-label"><span /> SCREEN <span /></div>
                    <div className="screen-curve" />
                    <div className="seat-map" aria-label="Seat selection">
                      {[...new Set(seats.map((seat) => seat.seatRow))].map((rowName) => {
                        const rowSeats = seats.filter((seat) => seat.seatRow === rowName);
                        return <div className="seat-row" key={rowName}><span className="row-label">{rowName}</span>{rowSeats.map((seat) => {
                          const selected = selectedSeatIds.includes(seat.id);
                          const unavailable = seat.status !== "AVAILABLE" || seat.physicalStatus !== "AVAILABLE" || seat.priceId === null;
                          return <button key={seat.id} className={`seat ${selected ? "seat-selected" : ""} ${unavailable ? "seat-unavailable" : ""} ${seat.seatTypeId !== 1 ? "seat-premium" : ""}`} disabled={unavailable} onClick={() => toggleSeat(seat)} aria-label={`${seat.seatRow}${seat.seatColumn}, ${seat.seatTypeName}, ${seat.priceId === null ? "price unavailable" : money.format(Number(seat.price))}`} title={`${seat.seatTypeName}${seat.priceId === null ? " · price unavailable" : ` · ${money.format(Number(seat.price))}`}`}>
                            {selected ? <Check size={13} /> : String(seat.seatColumn).padStart(2, "0")}
                          </button>;
                        })}</div>;
                      })}
                    </div>
                    <div className="seat-legend"><span><i className="legend-available" /> AVAILABLE</span><span><i className="legend-selected" /> SELECTED</span><span><i className="legend-booked" /> BOOKED</span></div>
                  </div>
                  <aside className="seat-summary">
                    <div className="summary-heading"><span>BOOKING SUMMARY</span><Ticket size={16} /></div>
                    <div className="summary-movie">{movie?.title}<small>{showtime.theaterName} · {formatShowtime(showtime.startsAt, { hour: "2-digit", minute: "2-digit", hour12: false })}</small></div>
                    <div className="summary-seat-list">{selectedSeats.length === 0 ? <span className="summary-placeholder">Select up to four seats</span> : selectedSeats.map((seat) => <div className="summary-seat" key={seat.id}><span>{seat.seatRow}{seat.seatColumn} <small>{seat.seatTypeName}</small></span><b>{money.format(Number(seat.price))}</b></div>)}</div>
                    <div className="summary-total"><span>TOTAL</span><strong>{money.format(total)}</strong></div>
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
              <div className="confirmation-copy"><span>TRANSACTION COMMITTED {replayed ? "· REPLAYED SAFELY" : "· LIVE MYSQL"}</span><h3>Your seats are <em>yours.</em></h3><p>Booking #{String(receipt.id).padStart(6, "0")} · {receipt.seats.join(", ")} · {money.format(receipt.total)}</p></div>
              <button className="secondary-button" onClick={startAgain}><RotateCcw size={14} /> Start another booking</button>
              <div className="transaction-stats"><div><small>BOOKING</small><b>#{receipt.id}</b></div><div><small>TICKETS</small><b>{receipt.ticketIds.length}</b></div><div><small>PAYMENT</small><b>#{receipt.paymentId}</b></div><div><small>TOTAL</small><b>{money.format(receipt.total)}</b></div></div>
              <div className="sql-trace"><div className="sql-trace-heading"><div><span>THE DATA TRAIL</span><small>ONE ACTION · {statements.reduce((sum, row) => sum + row.affectedRows, 0)} ROWS AFFECTED</small></div><Database size={17} /></div><div className="trace-flow"><span>YOU</span><ArrowRight size={12} /><span>API</span><ArrowRight size={12} /><span>TRANSACTION</span><ArrowRight size={12} /><span>MYSQL</span><Check size={13} /></div>
                {replayed ? <div className="replay-note"><RotateCcw size={13} /> An earlier request with this key already committed. No second booking was created.</div> : <div className="before-after"><div><span>BEFORE</span><strong>{receipt.seats.join(", ")}</strong><small>AVAILABLE · NO TICKET ROW</small></div><ArrowRight size={16} /><div><span>AFTER · BOOKING #{receipt.id}</span><strong>{receipt.seats.join(", ")}</strong><small>BOOKED · {receipt.ticketIds.length} TICKET ROW{receipt.ticketIds.length === 1 ? "" : "S"} + PAYMENT</small></div></div>}
                {statements.map((statement, index) => <div className="sql-row" key={`${statement.label}-${index}`}><div className="sql-row-meta"><span className="sql-step">0{index + 1}</span><b>{statement.label}</b><small>{statement.affectedRows} row{statement.affectedRows === 1 ? "" : "s"}</small></div><code>{statement.sql}</code></div>)}
              </div>
            </div>
          )}
        </div>
        <div className="collection-footnote"><span>DATABASE FIRST, ALWAYS.</span><span>THE SEAT YOU PICK BECOMES A ROW YOU CAN TRACE.</span><span>SCROLL TO EXPLORE <ChevronDown size={13} /></span></div>
      </section>

      <section className="data-section" id="data-trail">
        <div className="data-section-inner">
          <div className="data-section-head"><div><div className="eyebrow"><span className="eyebrow-line" /> UNDER THE SURFACE</div><h2>Not just a seat.<br /><em>A relationship.</em></h2></div><p>The booking is only the beginning. Follow the records it touches: a customer, a booking, a ticket and a payment — held together by keys and a single transaction.</p></div>
          <div className="relationship-flow"><div className="relationship-node"><span>01 / ENTITY</span><strong>customer</strong><small>Customer_ID · PK</small></div><span className="relationship-arrow"><span>1 : N</span><ArrowRight size={17} /></span><div className="relationship-node node-lit"><span>02 / ENTITY</span><strong>booking</strong><small>Booking_ID · PK</small></div><span className="relationship-arrow"><span>1 : N</span><ArrowRight size={17} /></span><div className="relationship-node"><span>03 / ENTITY</span><strong>ticket</strong><small>Seat_ID · unique per show</small></div><span className="relationship-arrow"><span>1 : 1</span><ArrowRight size={17} /></span><div className="relationship-node"><span>04 / ENTITY</span><strong>payment</strong><small>Idempotency_Key · unique</small></div></div>
          <div className="data-section-foot"><span><span className="status-dot" /> MYSQL / LIVE</span><span>FOREIGN KEYS KEEP THE STORY INTACT.</span><span>END OF FLOW <ArrowRight size={13} /></span></div>
        </div>
      </section>

      <footer className="footer"><a className="brand-lockup" href="#top"><span className="brand-mark"><Clapperboard size={16} /></span><span className="brand-type">cinema<span>/</span>db</span></a><span>BUILT TO MAKE THE DATABASE VISIBLE.</span><a href="#top">BACK TO TOP <ArrowRight className="back-top-icon" size={12} /></a></footer>
    </main>
  );
}
