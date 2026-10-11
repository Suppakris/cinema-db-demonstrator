"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./analytics.module.css";
import { analyticsViews, type AnalyticsViewId } from "@/lib/analytics-views";

type Row = Record<string, string | number | null>;
type Payload = { rows: Row[] };
type Point = { label: string; value: number; detail: string };

const ids = Object.keys(analyticsViews) as AnalyticsViewId[];
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

function numeric(row: Row, key: string) { return Number(row[key] ?? 0) || 0; }
function money(value: number) { return currency.format(value); }
function dateLabel(value: unknown) {
  const raw = String(value ?? "");
  const date = new Date(raw.length === 10 ? `${raw}T00:00:00` : raw);
  return Number.isNaN(date.valueOf()) ? raw.slice(0, 10) : new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function LineChart({ points, format, emptyLabel }: { points: Point[]; format: (value: number) => string; emptyLabel: string }) {
  if (!points.length) return <p className={styles.message}>{emptyLabel}</p>;
  const width = 720, height = 260, left = 88, right = 20, top = 18, bottom = 42;
  const max = Math.max(1, ...points.map((point) => point.value));
  const min = Math.min(0, ...points.map((point) => point.value));
  const range = Math.max(1, max - min);
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const plotted = points.map((point, index) => ({ ...point,
    x: points.length === 1 ? left + plotWidth / 2 : left + (index / (points.length - 1)) * plotWidth,
    y: top + ((max - point.value) / range) * plotHeight,
  }));
  const line = plotted.map((point) => `${point.x},${point.y}`).join(" ");
  return <div className={styles.lineChart}>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Line chart. Focus or hover over a point to see its value.">
      {[0, .5, 1].map((fraction) => { const y = top + plotHeight * fraction; const value = max - range * fraction; return <g key={fraction}><line x1={left} x2={width - right} y1={y} y2={y} className={styles.gridLine} /><text x={left - 9} y={y + 4} textAnchor="end" className={styles.axisText}>{format(value)}</text></g>; })}
      <polyline points={line} className={styles.line} />
      {plotted.map((point, index) => <g key={`${point.label}-${index}`}><circle cx={point.x} cy={point.y} r="5" className={styles.point} tabIndex={0}><title>{`${point.label}: ${format(point.value)} · ${point.detail}`}</title></circle><text x={point.x} y={height - 13} textAnchor="middle" className={styles.axisText}>{point.label}</text></g>)}
    </svg>
  </div>;
}

function HorizontalBars({ rows, metric, format, detail }: { rows: Row[]; metric: string; format: (value: number) => string; detail: (row: Row) => string }) {
  const maximum = Math.max(1, ...rows.map((row) => numeric(row, metric)));
  return <div className={styles.chart}>{rows.map((row, index) => {
    const value = numeric(row, metric);
    const label = String(row.Movie_Title ?? row.Tier_Name ?? row.Theater_Type_Name ?? "");
    return <div className={styles.barRow} key={`${label}-${index}`}><div className={styles.barMeta}><strong title={label}>{label}</strong><span>{format(value)}</span></div><div className={styles.track}><span style={{ width: `${Math.max(2, (value / maximum) * 100)}%` }} /></div><small>{detail(row)}</small></div>;
  })}</div>;
}

export function AnalyticsWorkspace() {
  const [active, setActive] = useState<AnalyticsViewId>("bookings");
  const [data, setData] = useState<Partial<Record<AnalyticsViewId, Payload>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [membershipMetric, setMembershipMetric] = useState<"revenue" | "tickets">("revenue");
  const [movieChoice, setMovieChoice] = useState("");
  const view = analyticsViews[active];

  useEffect(() => {
    if (data[active]) { setLoading(false); setError(""); return; }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/analytics/${active}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load analytics.");
        return payload as Payload;
      })
      .then((payload) => setData((current) => ({ ...current, [active]: payload })))
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Could not load analytics."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [active, data]);

  const rows = data[active]?.rows ?? [];
  const movieTitles = useMemo(() => [...new Set(rows.map((row) => String(row.Movie_Title ?? "" )).filter(Boolean))], [rows]);
  const selectedMovie = movieTitles.includes(movieChoice) ? movieChoice : movieTitles[0] ?? "";
  const bookingPoints: Point[] = rows.slice(-12).map((row) => ({ label: dateLabel(row.Booking_Date), value: numeric(row, "Total_Sales_Revenue"), detail: `${number.format(numeric(row, "Total_Booking_Orders"))} bookings · ${number.format(numeric(row, "Total_Seats_Booked"))} seats` }));
  const monthlyPoints: Point[] = rows.filter((row) => String(row.Movie_Title) === selectedMovie).sort((a, b) => String(a.Month_Year).localeCompare(String(b.Month_Year))).map((row) => ({ label: String(row.Month_Year), value: numeric(row, "Total_Tickets_Sold"), detail: `${number.format(numeric(row, "Monthly_Popularity_Rank"))} rank · ${money(numeric(row, "Total_Revenue"))}` }));
  const membershipRows = rows.slice(0, 12);
  const reviewRows = rows.slice(0, 12);

  return <div className={styles.page}>
    <section className={styles.intro}>
      <div><h1>Analytics</h1><p className={styles.lede}>Explore the cinema database views. Each chart is paired with the SQL that produces its results.</p><p className={styles.dataNote}>Movie trends use seven real film titles; IMDb and Rotten Tomatoes scores were checked on Oct 11, 2026. Booking history is synthetic demo activity tagged DEMO_ANALYTICS.</p></div>
      <div className={styles.summary}><span>MYSQL VIEWS</span><strong>05</strong><small>READ ONLY</small></div>
    </section>
    <nav className={styles.tabs} role="tablist" aria-label="Analytics views">
      {ids.map((id) => <button key={id} type="button" role="tab" aria-selected={active === id} className={active === id ? styles.activeTab : ""} onClick={() => setActive(id)}>{analyticsViews[id].label}</button>)}
    </nav>
    <section className={styles.heading}><div><h2>{view.label}</h2><p>{view.description}</p></div><div className={styles.rowCount}>{loading ? "LOADING" : `${rows.length} ROWS`}</div></section>
    <div className={styles.grid}>
      <section className={styles.panel} aria-label={`${view.label} chart`}>
        <div className={styles.panelHead}><div><p className={styles.eyebrow}>VISUAL SUMMARY</p><h3>{active === "bookings" ? "Sales over time" : active === "memberships" ? "Usage by membership tier" : active === "theaters" ? "Tickets by theater type" : active === "movies" ? "Movie ticket trend" : "Average score by movie"}</h3></div><span>{active === "reviews" ? "SCORE / 100" : active === "memberships" ? membershipMetric === "revenue" ? "THB" : "TICKETS" : active === "bookings" ? "THB" : "TICKETS"}</span></div>
        {active === "memberships" && <div className={styles.metricToggle} role="group" aria-label="Membership chart metric"><button type="button" aria-pressed={membershipMetric === "revenue"} className={membershipMetric === "revenue" ? styles.metricActive : ""} onClick={() => setMembershipMetric("revenue")}>Revenue</button><button type="button" aria-pressed={membershipMetric === "tickets"} className={membershipMetric === "tickets" ? styles.metricActive : ""} onClick={() => setMembershipMetric("tickets")}>Tickets claimed</button></div>}
        {active === "movies" && !loading && !error && movieTitles.length > 0 && <label className={styles.movieSelect}>MOVIE<select value={selectedMovie} onChange={(event) => setMovieChoice(event.target.value)}>{movieTitles.map((title) => <option key={title} value={title}>{title}</option>)}</select></label>}
        {loading ? <p className={styles.message}>Loading live view data…</p> : error ? <p className={styles.message}>{error}</p> : active === "bookings" ? <LineChart points={bookingPoints} format={money} emptyLabel="No booking activity yet." /> : active === "movies" ? <LineChart points={monthlyPoints} format={number.format} emptyLabel="No monthly ranking data for this movie yet." /> : active === "memberships" ? <HorizontalBars rows={membershipRows} metric={membershipMetric === "revenue" ? "Total_Revenue_Generated" : "Total_Tickets_Claimed"} format={membershipMetric === "revenue" ? money : (value) => number.format(value)} detail={(row) => `${row.Tier_Type ?? "Tier"} · ${number.format(numeric(row, "Total_Active_Cards"))} active cards · ${number.format(numeric(row, "Total_Tickets_Claimed"))} tickets · ${money(numeric(row, "Total_Revenue_Generated"))}`} /> : active === "theaters" ? <HorizontalBars rows={rows.slice(0, 12)} metric="Total_Tickets_Sold" format={number.format} detail={(row) => `${money(numeric(row, "Total_Revenue"))} revenue`} /> : <HorizontalBars rows={reviewRows} metric="Average_Score_100" format={(value) => `${number.format(value)} / 100`} detail={(row) => `${number.format(numeric(row, "Normalized_Source_Count"))} reviews · ${number.format(numeric(row, "Source_Count"))} sources`} />}
        {!loading && !error && rows.length > 0 && <p className={styles.caption}>{active === "bookings" ? "Most recent 12 days with activity. Hover or focus a point for booking and seat counts." : active === "memberships" ? "Switch metrics to compare tier activity. Values use their own scale." : active === "theaters" ? "Ordered by tickets sold; revenue appears under each bar." : active === "movies" ? `Monthly ticket sales for ${selectedMovie}. Choose another movie to compare its trend.` : "Movies with at least one normalized review score. Review counts help show how much data supports each average."}</p>}
      </section>
      <section className={`${styles.panel} ${styles.queryPanel}`} aria-label="SQL query">
        <div className={styles.panelHead}><div><p className={styles.eyebrow}>HOW THIS CHART IS BUILT</p><h3>SQL query</h3></div><span>BOUNDED READ</span></div>
        <pre><code>{view.query}</code></pre>
        <p className={styles.queryNote}>The API runs this fixed, read-only query and returns at most 500 rows. The chart summarizes those returned rows.</p>
      </section>
    </div>
  </div>;
}
