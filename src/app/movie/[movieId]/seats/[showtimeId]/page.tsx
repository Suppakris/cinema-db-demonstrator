"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Clapperboard, LoaderCircle } from "lucide-react";
import styles from "./seat-selection.module.css";

type Movie = { id: number; title: string };
type Showtime = { id: number; startsAt: string; theaterName: string; branchName: string; audioLanguage: string; subtitleLanguage: string | null };
type Seat = { id: number; seatRow: string; seatColumn: number; physicalStatus: string; seatTypeId: number; seatTypeName: string; status: "AVAILABLE" | "BOOKED"; priceId: number | null; price: number | string | null };
type PaymentMethod = { id: number; name: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "THB", maximumFractionDigits: 0 });

function formatStart(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "Asia/Bangkok" }).format(new Date(`${value}+07:00`));
}

export default function SeatSelectionPage({ params }: PageProps<"/movie/[movieId]/seats/[showtimeId]">) {
  const { movieId: rawMovieId, showtimeId: rawShowtimeId } = use(params);
  const movieId = Number(rawMovieId);
  const showtimeId = Number(rawShowtimeId);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [showtime, setShowtime] = useState<Showtime | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ id: number; paymentId: number; seats: string[]; total: number } | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState(1);

  useEffect(() => {
    let active = true;
    async function loadSelection() {
      try {
        const [movieResponse, showtimeResponse] = await Promise.all([
          fetch("/api/movies"),
          fetch(`/api/showtimes?movieId=${movieId}`),
        ]);
        const [movieResult, showtimeResult] = await Promise.all([movieResponse.json(), showtimeResponse.json()]);
        if (!movieResponse.ok) throw new Error(movieResult.error ?? "Movie details could not be loaded.");
        if (!showtimeResponse.ok) throw new Error(showtimeResult.error ?? "Showtimes could not be loaded.");
        const selectedMovie = (movieResult.movies as Movie[]).find((item) => item.id === movieId) ?? null;
        const selectedShowtime = (showtimeResult.showtimes as Showtime[]).find((item) => item.id === showtimeId) ?? null;
        if (!selectedMovie || !selectedShowtime) throw new Error("This screening is no longer available. Return to the movie page and choose another showtime.");
        const seatResponse = await fetch(`/api/showtimes/${showtimeId}/seats`);
        const seatResult = await seatResponse.json();
        if (!seatResponse.ok) throw new Error(seatResult.error ?? "Seat information could not be loaded.");
        if (!active) return;
        setMovie(selectedMovie);
        setShowtime(selectedShowtime);
        setSeats(seatResult.seats as Seat[]);
        const methods = seatResult.paymentMethods as PaymentMethod[];
        setPaymentMethods(methods);
        setPaymentMethodId(methods[0]?.id ?? 1);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Seat information could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadSelection();
    return () => { active = false; };
  }, [movieId, showtimeId]);

  const selectedSeats = useMemo(() => seats.filter((seat) => selectedIds.includes(seat.id)), [seats, selectedIds]);
  const total = selectedSeats.reduce((sum, seat) => sum + Number(seat.price ?? 0), 0);

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!showtime || selectedSeats.length === 0) return;
    setSubmitting(true);
    setBookingError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showtimeId,
          seatIds: selectedIds,
          firstName,
          lastName,
          email,
          phone,
          paymentMethodId,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Booking could not be completed.");
      setReceipt(result.booking as { id: number; paymentId: number; seats: string[]; total: number });
      setCheckout(false);
    } catch (cause) {
      setBookingError(cause instanceof Error ? cause.message : "Booking could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSeat(seat: Seat) {
    if (seat.status !== "AVAILABLE" || seat.physicalStatus !== "AVAILABLE" || seat.priceId === null) return;
    setSelectedIds((current) => {
      if (current.includes(seat.id)) return current.filter((id) => id !== seat.id);
      return current.length < 4 ? [...current, seat.id] : current;
    });
  }

  const rows = [...new Set(seats.map((seat) => seat.seatRow))];
  return <main className={styles.page}>
    <header className={styles.nav}>
      <Link className={styles.brand} href="/"><span><Clapperboard size={17} /></span> cinema<b>/</b>db</Link>
      <Link className={styles.back} href={`/movie/${movieId}#showtimes`}><ArrowLeft size={14} /> BACK TO SHOWTIMES</Link>
    </header>
    {loading ? <div className={styles.state}><LoaderCircle className={styles.spin} size={18} /> Loading live seat map…</div> : error ? <div className={styles.state} role="alert">{error}</div> : movie && showtime && <>
      <section className={styles.heading}>
        <div className={styles.eyebrow}>BOOKING CASE STUDY <span>/ SELECT YOUR SEATS</span></div>
        <h1>Choose your seats.</h1>
        <p>{movie.title} · {formatStart(showtime.startsAt, { weekday: "long", day: "numeric", month: "long" })} at {formatStart(showtime.startsAt, { hour: "2-digit", minute: "2-digit", hour12: false })}</p>
        <p>{showtime.theaterName} · {showtime.branchName} · {showtime.audioLanguage}{showtime.subtitleLanguage ? ` / SUB ${showtime.subtitleLanguage}` : ""}</p>
      </section>
      {receipt ? <section className={styles.checkout} aria-live="polite"><div className={styles.eyebrow}>BOOKING CONFIRMED</div><h2>You’re all set.</h2><p>Booking #{receipt.id} · Payment #{receipt.paymentId}</p><p>{receipt.seats.join(", ")} · {money.format(receipt.total)}</p><Link className={styles.continue} href={`/database?bookingId=${receipt.id}`}>View booking record <ArrowRight size={14} /></Link></section> : checkout ? <section className={styles.checkout}>
        <div className={styles.eyebrow}>CHECKOUT / CUSTOMER DETAILS</div><h2>Complete your booking.</h2>
        <form className={styles.checkoutForm} onSubmit={submitBooking}>
          <label>FIRST NAME<input required maxLength={50} autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
          <label>LAST NAME<input required maxLength={50} autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
          <label>EMAIL<input required type="email" maxLength={255} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>PHONE<input required type="tel" maxLength={20} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
          <label>PAYMENT METHOD<select value={paymentMethodId} onChange={(event) => setPaymentMethodId(Number(event.target.value))}>{paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}</select></label>
          <div className={styles.checkoutTotal}><span>{selectedSeats.map((seat) => `${seat.seatRow}${seat.seatColumn}`).join(", ")}</span><strong>{money.format(total)}</strong></div>
          {bookingError && <p className={styles.checkoutError} role="alert">{bookingError}</p>}
          <button className={styles.continue} type="submit" disabled={submitting}>{submitting ? "Saving booking…" : "Confirm booking"} <ArrowRight size={14} /></button>
          <button className={styles.cancel} type="button" onClick={() => setCheckout(false)}>Back to seat selection</button>
        </form>
      </section> : <div className={styles.workspace}>
        <section className={styles.seatPanel} aria-label="Choose seats">
          <div className={styles.panelTopline}><span>SELECT UP TO 4 SEATS</span><span aria-live="polite">{selectedIds.length} / 4 SELECTED</span></div>
          <details className={styles.insight}><summary>How seat availability works</summary><p>Booked status and seat prices come from this screening’s live database records. The booking API checks availability and price again inside its transaction.</p></details>
          <div className={styles.screenLabel}><span /> SCREEN <span /></div>
          <div className={styles.screenCurve} aria-hidden="true" />
          <div className={styles.mapCaption}><span>FRONT OF THEATER</span><span>{seats.length} SEATS · {new Set(rows).size} ROWS</span></div>
          <div className={styles.seatViewport}><div className={styles.seatMap} role="group" aria-label="Seat selection">
            {rows.map((rowName) => {
              const rowSeats = seats.filter((seat) => seat.seatRow === rowName);
              return <div className={styles.seatRow} key={rowName}><span className={styles.rowLabel} aria-hidden="true">{rowName}</span><div className={styles.seatGroup}>
              {rowSeats.map((seat, index) => {
              const selected = selectedIds.includes(seat.id);
              const unavailable = seat.status !== "AVAILABLE" || seat.physicalStatus !== "AVAILABLE" || seat.priceId === null;
              const statusLabel = seat.status === "BOOKED" ? "booked" : seat.physicalStatus !== "AVAILABLE" ? "out of service" : seat.priceId === null ? "price unavailable" : "available";
              const previousColumn = rowSeats[index - 1]?.seatColumn;
              const gap = previousColumn === undefined ? 0 : seat.seatColumn - previousColumn;
              return <button key={seat.id} type="button" className={`seat ${styles.seatButton} ${selected ? "seat-selected" : ""} ${unavailable ? "seat-unavailable" : ""} ${seat.seatTypeId !== 1 ? "seat-premium" : ""}`} style={gap > 1 ? { marginLeft: `${Math.min(gap - 1, 3) * 12}px` } : undefined} disabled={unavailable} onClick={() => toggleSeat(seat)} aria-pressed={selected} aria-label={`${seat.seatRow}${seat.seatColumn}, ${seat.seatTypeName}, ${statusLabel}${!unavailable ? `, ${money.format(Number(seat.price))}` : ""}`} title={`${seat.seatRow}${seat.seatColumn} · ${seat.seatTypeName} · ${statusLabel}${!unavailable ? ` · ${money.format(Number(seat.price))}` : ""}`}><span className={styles.chairBack} aria-hidden="true" />{selected && <Check className={styles.seatCheck} size={14} aria-hidden="true" />}<span className={styles.chairBase} aria-hidden="true" /></button>;
            })}</div><span className={styles.rowLabel} aria-hidden="true">{rowName}</span></div>;
            })}
          </div></div>
          <div className={styles.legend}><span><i className={styles.availableKey} /> AVAILABLE</span><span><i className={styles.selectedKey} /> SELECTED</span><span><i className={styles.premiumKey} /> PREMIUM</span><span><i className={styles.bookedKey} /> BOOKED / UNAVAILABLE</span></div>
        </section>
        <aside className={styles.summary}>
          <div className={styles.summaryTitle}><span>BOOKING SUMMARY</span><span>{selectedSeats.length} SEATS</span></div>
          <strong className={styles.summaryMovie}>{movie.title}</strong>
          <p>{showtime.theaterName} · {formatStart(showtime.startsAt, { hour: "2-digit", minute: "2-digit", hour12: false })}</p>
          <div className={styles.summarySeats}>{selectedSeats.length === 0 ? <span>Select seats to see your total.</span> : selectedSeats.map((seat) => <div key={seat.id}><span>{seat.seatRow}{seat.seatColumn} · {seat.seatTypeName}</span><b>{money.format(Number(seat.price))}</b></div>)}</div>
          <div className={styles.total}><span>TOTAL</span><strong>{money.format(total)}</strong></div>
          <button aria-disabled={selectedSeats.length === 0} className={`${styles.continue} ${selectedSeats.length === 0 ? styles.disabled : ""}`} disabled={selectedSeats.length === 0} onClick={() => setCheckout(true)}>Continue to booking <ArrowRight size={14} /></button>
          <small>Availability and prices are verified again before booking.</small>
        </aside>
      </div>}
      <footer className={styles.footer}><Link href="/">cinema<span>/</span>db</Link><span>SELECT YOUR SEATS · LIVE DATABASE</span></footer>
    </>}
  </main>;
}
