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
type SchemaKey = { kind: "PK" | "FK" | "UQ"; name: string };
type SchemaColumn = {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | number | null;
  extra: string;
  keys: SchemaKey[];
};
type SchemaObject = {
  name: string;
  type: "BASE TABLE" | "VIEW";
  recordCount: number;
  columns: SchemaColumn[];
};
type SchemaRelationship = {
  constraintName: string;
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  toColumns: string[];
};
type SchemaData = {
  database: string;
  summary: { objectCount: number; tableCount: number; viewCount: number; tableRecordCount: number };
  objects: SchemaObject[];
  relationships: SchemaRelationship[];
};
type DatabaseRecord = Record<string, unknown>;
type RecordsResult = {
  table: string;
  total: number;
  limit: number;
  offset: number;
  columns: string[];
  primaryKey: string[];
  rows: DatabaseRecord[];
};
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

function posterTone(id: number) {
  return `poster-tone-${((id - 1) % 7) + 1}`;
}

function formatRecordValue(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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
  const [schemaData, setSchemaData] = useState<SchemaData | null>(null);
  const [loadingSchema, setLoadingSchema] = useState(true);
  const [schemaError, setSchemaError] = useState("");
  const [selectedSchemaObject, setSelectedSchemaObject] = useState("movie");
  const [recordTable, setRecordTable] = useState("movie");
  const [recordOffset, setRecordOffset] = useState(0);
  const [recordFilter, setRecordFilter] = useState<Record<string, unknown> | null>(null);
  const [recordsResult, setRecordsResult] = useState<RecordsResult | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<DatabaseRecord | null>(null);
  const [recordsLoadKey, setRecordsLoadKey] = useState("");
  const [recordsError, setRecordsError] = useState("");
  const [rollbackResult, setRollbackResult] = useState<RollbackDemoResult | null>(null);
  const [runningRollbackDemo, setRunningRollbackDemo] = useState(false);
  const [rollbackDemoError, setRollbackDemoError] = useState("");
  const idempotencyKey = useRef("");

  const selectedSeats = useMemo(
    () => seats.filter((seat) => selectedSeatIds.includes(seat.id)),
    [seats, selectedSeatIds],
  );
  const total = selectedSeats.reduce((sum, seat) => sum + Number(seat.price ?? 0), 0);
  const selectedSchema = schemaData?.objects.find((item) => item.name === selectedSchemaObject) ?? schemaData?.objects[0] ?? null;
  const recordsRequestKey = JSON.stringify([recordTable, recordOffset, recordFilter]);
  const loadingRecords = recordsLoadKey !== recordsRequestKey;

  useEffect(() => {
    let active = true;
    fetch("/api/schema")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load database schema.");
        return result as SchemaData;
      })
      .then((result) => {
        if (!active) return;
        setSchemaData(result);
        setSelectedSchemaObject((current) => result.objects.some((item) => item.name === current) ? current : result.objects[0]?.name ?? "");
      })
      .catch((cause: unknown) => {
        if (active) setSchemaError(cause instanceof Error ? cause.message : "Could not load database schema.");
      })
      .finally(() => { if (active) setLoadingSchema(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ limit: "25", offset: String(recordOffset) });
    if (recordFilter) params.set("filter", JSON.stringify(recordFilter));
    fetch(`/api/records/${encodeURIComponent(recordTable)}?${params.toString()}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load database records.");
        return result as RecordsResult;
      })
      .then((result) => {
        if (!active) return;
        setRecordsError("");
        setRecordsResult(result);
        setRecordsLoadKey(recordsRequestKey);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setRecordsResult(null);
        setRecordsLoadKey(recordsRequestKey);
        setRecordsError(cause instanceof Error ? cause.message : "Could not load database records.");
      });
    return () => { active = false; };
  }, [recordTable, recordOffset, recordFilter, recordsRequestKey]);

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
  const recordRelations = selectedRecord && schemaData ? schemaData.relationships.flatMap((relation) => {
    if (relation.fromTable === recordTable) return [{
      relation,
      direction: "REFERENCES",
      targetTable: relation.toTable,
      filter: Object.fromEntries(relation.toColumns.map((column, index) => [column, selectedRecord[relation.fromColumns[index]]])),
    }];
    if (relation.toTable === recordTable) return [{
      relation,
      direction: "REFERENCED BY",
      targetTable: relation.fromTable,
      filter: Object.fromEntries(relation.fromColumns.map((column, index) => [column, selectedRecord[relation.toColumns[index]]])),
    }];
    return [];
  }) : [];

  return (
    <main className="cinema-shell">
      <header className="topbar">
        <a className="brand-lockup" href="#top" aria-label="Cinema database home">
          <span className="brand-mark"><Clapperboard size={18} /></span>
          <span className="brand-type">cinema<span>/</span>db</span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a className="nav-current" href="#data-trail">Schema explorer</a>
          <a href="#records">Live records</a>
          <a href="#transactions">Transaction lab</a>
        </nav>
        <div className={`db-status ${databaseStatus === "offline" ? "db-offline" : ""}`}><span className="status-dot" /><span>{databaseStatus === "checking" ? "CHECKING MYSQL" : databaseStatus === "online" ? "MYSQL CONNECTED" : "MYSQL OFFLINE"}</span><span className="status-separator">·</span><span>LIVE DATA</span></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-grid" />
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> DATABASE DEMONSTRATOR <span className="eyebrow-muted">/ 01</span></div>
          <h1>The schema.<br /><em>In practice.</em></h1>
          <p className="hero-description">A three-minute tour of the live schema, its records, and the database changes behind a cinema booking.</p>
          <a className="hero-link" href="#data-trail">Open the live schema explorer <ArrowDownRight size={15} /></a>
          <div className="hero-caption"><span>LIVE CONNECTION</span><span className="caption-divider" /> mysql / {schemaData?.database ?? "connecting"}</div>
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
        <div className="hero-bottom"><span>3-MINUTE PATH: SCHEMA → ROWS → COMMIT / ROLLBACK</span><span>DATABASE FIRST <ChevronDown size={14} /></span></div>
      </section>

      <section className="data-section schema-section" id="data-trail">
        <div className="data-section-inner">
          <div className="data-section-head"><div><div className="eyebrow"><span className="eyebrow-line" /> 01 / SCHEMA EXPLORER</div><h2>Tables connected<br /><em>by keys.</em></h2></div><p>Start with the actual MySQL objects. Select a table to inspect its columns, primary and foreign keys, relationships, and live row count.</p></div>
          {loadingSchema ? <div className="schema-state"><LoadingMark /> Reading MySQL schema metadata…</div> : schemaError ? <div className="schema-state schema-state-error"><CircleHelp size={16} /> {schemaError}</div> : schemaData && <>
            <div className="schema-dashboard" aria-label="Database summary">
              <div><span>DATABASE</span><strong>{schemaData.database}</strong></div>
              <div><span>BASE TABLES</span><strong>{schemaData.summary.tableCount}</strong></div>
              <div><span>VIEWS</span><strong>{schemaData.summary.viewCount}</strong></div>
              <div><span>ROWS IN TABLES</span><strong>{schemaData.summary.tableRecordCount.toLocaleString()}</strong></div>
            </div>
            <div className="schema-explorer">
              <aside className="schema-object-browser" aria-label="Database objects">
                <div className="schema-browser-head"><strong>DATABASE OBJECTS</strong><span>{schemaData.summary.objectCount}</span></div>
                <div className="schema-object-list">
                  {schemaData.objects.map((item) => <button key={item.name} className={`schema-object-button ${selectedSchema?.name === item.name ? "schema-object-selected" : ""}`} onClick={() => setSelectedSchemaObject(item.name)} aria-pressed={selectedSchema?.name === item.name}>
                    <span className="schema-object-name"><b>{item.name}</b><small>{item.type === "VIEW" ? "VIEW" : "TABLE"}</small></span><span className="schema-object-count">{item.recordCount.toLocaleString()} rows</span>
                  </button>)}
                </div>
              </aside>
              {selectedSchema && <div className="schema-inspector">
                <div className="schema-inspector-head"><div><span>{selectedSchema.type === "VIEW" ? "DATABASE VIEW" : "BASE TABLE"}</span><h3>{selectedSchema.name}</h3></div><strong>{selectedSchema.recordCount.toLocaleString()} <small>ROWS</small></strong></div>
                <div className="schema-column-table-wrap"><table className="schema-column-table"><thead><tr><th>Column</th><th>Type</th><th>Null</th><th>Default</th><th>Keys</th></tr></thead><tbody>{selectedSchema.columns.map((column) => <tr key={column.name}><td><strong>{column.name}</strong>{column.extra && <small>{column.extra}</small>}</td><td><code>{column.type}</code></td><td>{column.nullable ? "YES" : "NO"}</td><td>{column.defaultValue === null ? "—" : String(column.defaultValue)}</td><td><span className="schema-key-list">{column.keys.length ? column.keys.map((key) => <span className={`schema-key-badge schema-key-${key.kind.toLowerCase()}`} key={`${column.name}-${key.name}`} title={key.name}>{key.kind}</span>) : "—"}</span></td></tr>)}</tbody></table></div>
                <div className="schema-relations"><div className="schema-relations-title">FOREIGN KEY RELATIONSHIPS <span>{schemaData.relationships.filter((relation) => relation.fromTable === selectedSchema.name || relation.toTable === selectedSchema.name).length}</span></div>
                  {schemaData.relationships.filter((relation) => relation.fromTable === selectedSchema.name || relation.toTable === selectedSchema.name).length === 0 ? <p className="schema-no-relations">No foreign key relationships recorded for this object.</p> : schemaData.relationships.filter((relation) => relation.fromTable === selectedSchema.name || relation.toTable === selectedSchema.name).map((relation) => <div className="schema-relation-row" key={`${relation.fromTable}-${relation.constraintName}`}><button onClick={() => setSelectedSchemaObject(relation.fromTable)}>{relation.fromTable}</button><span>{relation.fromColumns.join(", ")} <ArrowRight size={12} /> {relation.toColumns.join(", ")}</span><button onClick={() => setSelectedSchemaObject(relation.toTable)}>{relation.toTable}</button><small>{relation.constraintName}</small></div>)}
                </div>
              </div>}
            </div>
          </>}
          <div className="data-section-foot"><span><span className="status-dot" /> {schemaData ? `MYSQL / ${schemaData.summary.objectCount} OBJECTS LOADED` : "PK = PRIMARY KEY · FK = FOREIGN KEY · UQ = UNIQUE"}</span><span>PK = PRIMARY KEY · FK = FOREIGN KEY · UQ = UNIQUE</span><a href="#records">INSPECT LIVE ROWS <ArrowDownRight size={13} /></a></div>
        </div>
      </section>

      <section className="records-section section-wrap" id="records">
        <div className="section-heading records-section-heading">
          <div><div className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> 02 / LIVE ROW INSPECTOR</div><h2>Read the rows.<br /><em>Follow the keys.</em></h2></div>
          <p className="section-intro">Select a database table, inspect actual rows, then follow a foreign key to the matching records on the other side.</p>
          <div className="collection-count"><span>{recordsResult?.total.toLocaleString() ?? "—"}</span><small>ROWS<br />IN FILTER</small></div>
        </div>
        <div className="records-explorer">
          <div className="records-toolbar"><label htmlFor="records-table-select">DATABASE TABLE</label><select id="records-table-select" value={recordTable} onChange={(event) => { setRecordTable(event.target.value); setRecordOffset(0); setRecordFilter(null); setSelectedRecord(null); }}>{schemaData?.objects.filter((item) => item.type === "BASE TABLE").map((item) => <option value={item.name} key={item.name}>{item.name} · {item.recordCount.toLocaleString()} rows</option>)}</select><span>{recordFilter ? "RELATED ROWS" : "LIVE SELECT"} / MYSQL</span></div>
          {recordsError && <div className="records-message records-message-error"><CircleHelp size={15} /> {recordsError}</div>}
          {loadingRecords ? <div className="records-message"><LoadingMark /> Loading rows from {recordTable}…</div> : recordsResult && <>
            <div className="records-query"><code>SELECT * FROM `{recordsResult.table}`{recordFilter ? " WHERE related key values match" : ""} ORDER BY {recordsResult.primaryKey.length ? recordsResult.primaryKey.map((column) => `\`${column}\``).join(", ") : "database row order"} LIMIT {recordsResult.limit} OFFSET {recordsResult.offset};</code><span>{recordsResult.total.toLocaleString()} matching rows</span></div>
            {recordsResult.rows.length === 0 ? <div className="records-message">No rows match this relationship in the current database.</div> : <>
              <div className="records-grid-wrap"><table className="records-grid"><thead><tr><th>Inspect</th>{recordsResult.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{recordsResult.rows.map((row, index) => {
                const rowKey = recordsResult.primaryKey.map((column) => formatRecordValue(row[column])).join("/") || String(recordsResult.offset + index);
                return <tr key={rowKey} className={selectedRecord === row ? "records-row-selected" : ""}><td><button className="record-inspect-button" onClick={() => setSelectedRecord(row)} aria-label={`Inspect row ${rowKey}`}>{selectedRecord === row ? "SELECTED" : "INSPECT"}</button></td>{recordsResult.columns.map((column) => <td key={column} title={formatRecordValue(row[column])}>{formatRecordValue(row[column])}</td>)}</tr>;
              })}</tbody></table></div>
              <div className="records-pagination"><span>ROWS {recordsResult.total === 0 ? 0 : recordsResult.offset + 1}–{Math.min(recordsResult.offset + recordsResult.rows.length, recordsResult.total)} OF {recordsResult.total}</span><div><button disabled={recordsResult.offset === 0 || loadingRecords} onClick={() => { setRecordOffset(Math.max(0, recordOffset - recordsResult.limit)); setSelectedRecord(null); }}>PREVIOUS</button><button disabled={recordsResult.offset + recordsResult.limit >= recordsResult.total || loadingRecords} onClick={() => { setRecordOffset(recordOffset + recordsResult.limit); setSelectedRecord(null); }}>NEXT</button></div></div>
              {selectedRecord && <div className="record-detail">
                <div className="record-detail-heading"><div><span>SELECTED ROW / {recordTable.toUpperCase()}</span><h3>{recordsResult.primaryKey.map((column) => `${column}: ${formatRecordValue(selectedRecord[column])}`).join(" · ") || "Row details"}</h3></div><button onClick={() => setSelectedRecord(null)} aria-label="Close row details"><X size={15} /></button></div>
                <dl className="record-fields">{recordsResult.columns.map((column) => <div key={column}><dt>{column}</dt><dd>{formatRecordValue(selectedRecord[column])}</dd></div>)}</dl>
                <div className="record-links-heading">RELATED RECORDS <span>FROM LIVE FOREIGN KEYS</span></div>
                {recordRelations.length === 0 ? <p className="record-no-links">No foreign key relationships connect this row.</p> : <div className="record-link-list">{recordRelations.map(({ relation, direction, targetTable, filter }) => <button key={`${relation.constraintName}-${direction}`} className="record-link" onClick={() => { setRecordTable(targetTable); setRecordFilter(filter); setRecordOffset(0); setSelectedRecord(null); }}><span>{direction}</span><strong>{targetTable}</strong><small>{relation.constraintName}</small><ArrowRight size={15} /></button>)}</div>}
              </div>}
            </>}
          </>}
        </div>
      </section>

      <section className="collection section-wrap" id="movies">
        <div className="section-heading">
          <div><div className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> 03 / BOOKING CASE STUDY</div><h2>One workflow.<br /><em>Four tables.</em></h2></div>
          <p className="section-intro">Booking is the case study. Choose a real movie and showtime to trace writes across customer, booking, ticket, and payment.</p>
          <div className="collection-count"><span>{String(movies.length).padStart(2, "0")}</span><small>MOVIE ROWS<br />IN DATABASE</small></div>
        </div>

        {error && step !== "confirmed" && <div className="error-banner"><CircleHelp size={17} /><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}

        {!loadingMovies && movies.length > 0 && <div className="read-query"><div className="read-query-heading"><span><Database size={14} /> LIVE SELECT / MYSQL RESULT</span><b>{movies.length} MOVIE ROWS · {movies.reduce((count, item) => count + Number(item.showtimeCount), 0)} FUTURE SHOWTIMES</b></div><code>SELECT m.Movie_ID AS id, m.Title AS title, m.Poster_Image AS posterImage, m.Movie_Synopsis AS synopsis,<br />m.Movie_Duration AS duration, m.Original_Release_Date AS releaseDate, m.Age_Rating AS ageRating,<br />COUNT(DISTINCT s.Showtime_ID) AS showtimeCount FROM movie m LEFT JOIN showtime s<br />ON s.Movie_ID = m.Movie_ID AND s.Showtime_Status = &apos;AVAILABLE&apos; AND s.Start_Time &gt; NOW()<br />GROUP BY m.Movie_ID ORDER BY m.Movie_ID;</code></div>}

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
                <div className="movie-card-info"><small className="movie-db-id">MOVIE_ID / {item.id}</small><span className="movie-rating">{item.ageRating || "NR"}</span><h3>{item.title}</h3><div className="movie-meta"><span>{item.duration} MIN</span><span className="meta-dot">·</span><span>{count > 0 ? `${count} LIVE SHOW${count === 1 ? "" : "S"}` : "NO FUTURE SHOWS"}</span></div></div>
                <span className="movie-card-arrow"><ArrowRight size={15} /></span>
              </button>
            );
          })}
        </div>

        <div className="selection-panel" id="booking">
          <div className="selection-topline"><span><span className="selection-dot" /> BOOKING WORKFLOW</span><span>CASE STUDY / SHOWTIME → SEAT → TRANSACTION</span></div>
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
                    <div className="seat-map-guide"><span>Tap to choose · up to 4 seats</span><strong aria-live="polite">{selectedSeatIds.length} / 4 SELECTED</strong></div>
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
              <div className="transaction-stats"><div><small>BOOKING</small><b>#{receipt.id}</b></div><div><small>TICKETS</small><b>{receipt.ticketIds.length}</b></div><div><small>PAYMENT</small><b>#{receipt.paymentId}</b></div><div><small>TOTAL</small><b>{money.format(receipt.total)}</b></div></div>
              <div className="sql-trace"><div className="sql-trace-heading"><div><span>THE DATA TRAIL</span><small>{receipt.transaction ?? (replayed ? "IDEMPOTENT REPLAY" : "COMMITTED")} · {statements.reduce((sum, row) => sum + row.affectedRows, 0)} ROWS AFFECTED</small></div><Database size={17} /></div><div className="trace-flow"><span>USER ACTION</span><ArrowRight size={12} /><span>POST /API/BOOKINGS</span><ArrowRight size={12} /><span>BEGIN</span><ArrowRight size={12} /><span>MYSQL</span><ArrowRight size={12} /><span>COMMIT</span><Check size={13} /></div>
                {replayed ? <div className="replay-note"><RotateCcw size={13} /> An earlier request with this key already committed. No second booking was created.</div> : receipt.databaseState && <div className="before-after"><div><span>BEFORE · LIVE MYSQL STATE</span><strong>{receipt.databaseState.before.seats.map((seat) => `${seat.label} · ${seat.status}`).join(", ")}</strong><div className="database-row-counts">{Object.entries(receipt.databaseState.before.tableCounts).map(([table, count]) => <span key={table}>{table} <b>{count}</b></span>)}</div><small>Seat availability derived from ticket rows for showtime #{receipt.showtimeId}</small></div><ArrowRight size={16} /><div><span>AFTER · CONFIRMED MYSQL STATE</span><strong>{receipt.databaseState.after.seats.map((seat) => `${seat.label} · ${seat.status} · ticket #${seat.ticketId ?? "—"}`).join(", ")}</strong><div className="database-row-counts">{Object.entries(receipt.databaseState.after.tableCounts).map(([table, count]) => <span key={table}>{table} <b>{count}</b></span>)}</div><small>Booking #{receipt.id} · {receipt.databaseState.after.tickets.length} ticket row{receipt.databaseState.after.tickets.length === 1 ? "" : "s"} · payment #{receipt.databaseState.after.payment.paymentId} {receipt.databaseState.after.payment.status}</small></div></div>}
                {!replayed && receipt.databaseState && <div className="affected-tables"><span>TABLES AFFECTED</span>{receipt.databaseState.affectedTables.map((table) => <b key={table}>{table}</b>)}</div>}
                {receipt.activity?.length ? <ActivityTimeline events={receipt.activity} /> : statements.map((statement, index) => <div className="sql-row" key={`${statement.label}-${index}`}><div className="sql-row-meta"><span className="sql-step">0{index + 1}</span><b>{statement.label}</b><small>{statement.affectedRows} row{statement.affectedRows === 1 ? "" : "s"}</small></div><code>{statement.sql}</code></div>)}
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
        <div className="collection-footnote"><span>DATABASE FIRST, ALWAYS.</span><span>BOOKING IS THE CASE STUDY; THE ROWS AND RELATIONSHIPS ARE THE SUBJECT.</span><span>SCROLL TO EXPLORE <ChevronDown size={13} /></span></div>
      </section>

      <footer className="footer"><a className="brand-lockup" href="#top"><span className="brand-mark"><Clapperboard size={16} /></span><span className="brand-type">cinema<span>/</span>db</span></a><span>BUILT TO MAKE THE DATABASE VISIBLE.</span><a href="#top">BACK TO TOP <ArrowRight className="back-top-icon" size={12} /></a></footer>
    </main>
  );
}
