"use client";

import { ArrowLeft, ArrowRight, Database, LoaderCircle, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { SchemaData } from "@/lib/schema-types";
import { MajorLogo } from "@/components/major-logo";

type RecordRow = Record<string, unknown>;
type TableRows = { table: string; total: number; limit: number; offset: number; columns: string[]; redactedColumns: string[]; primaryKey: string[]; rows: RecordRow[] };
type RecentBooking = { bookingId: number; createdAt: string; bookingStatus: string; showtimeId: number; ticketCount: number; total: number; paymentStatus: string | null; paymentIsSimulated: boolean };

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "THB", maximumFractionDigits: 0 });

function valueLabel(value: unknown) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function DatabaseWorkspace({ initialBookingId = null }: { initialBookingId?: number | null }) {
  const [schema, setSchema] = useState<SchemaData | null>(null);
  const [selectedTable, setSelectedTable] = useState("movie");
  const [rowsResult, setRowsResult] = useState<TableRows | null>(null);
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loadingSchema, setLoadingSchema] = useState(true);
  const [loadingRows, setLoadingRows] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [schemaError, setSchemaError] = useState("");
  const [rowsError, setRowsError] = useState("");
  const [recentError, setRecentError] = useState("");
  const [offset, setOffset] = useState(0);
  const [queryBookingId] = useState<number | null>(initialBookingId);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/schema", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Schema could not be loaded.");
        return result as SchemaData;
      })
      .then((result) => {
        if (!active) return;
        setSchema(result);
        setSelectedTable((current) => result.objects.some((item) => item.name === current && item.type === "BASE TABLE") ? current : result.objects.find((item) => item.type === "BASE TABLE")?.name ?? "");
      })
      .catch((cause: unknown) => { if (active) setSchemaError(cause instanceof Error ? cause.message : "Schema could not be loaded."); })
      .finally(() => { if (active) setLoadingSchema(false); });
    return () => { active = false; };
  }, []);

  const loadRecent = useCallback(async () => {
    try {
      const query = queryBookingId ? `?bookingId=${queryBookingId}` : "";
      const response = await fetch(`/api/database/recent${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Recent booking rows could not be loaded.");
      setRecentBookings(result.bookings as RecentBooking[]);
    } catch (cause) {
      setRecentError(cause instanceof Error ? cause.message : "Recent booking rows could not be loaded.");
    } finally { setLoadingRecent(false); }
  }, [queryBookingId]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRecent(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecent]);

  const loadRows = useCallback(async () => {
    if (!selectedTable) return;
    try {
      const response = await fetch(`/api/records/${encodeURIComponent(selectedTable)}?limit=25&offset=${offset}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Table rows could not be loaded.");
      setRowsResult(result as TableRows);
    } catch (cause) {
      setRowsResult(null);
      setRowsError(cause instanceof Error ? cause.message : "Table rows could not be loaded.");
    } finally { setLoadingRows(false); }
  }, [selectedTable, offset]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRows(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRows]);

  const tableObjects = useMemo(() => schema?.objects.filter((item) => item.type === "BASE TABLE") ?? [], [schema]);
  const filteredTables = tableObjects.filter((table) => table.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selectedObject = schema?.objects.find((item) => item.name === selectedTable);
  const pageCount = rowsResult ? Math.max(1, Math.ceil(rowsResult.total / rowsResult.limit)) : 1;
  const currentPage = rowsResult ? Math.floor(rowsResult.offset / rowsResult.limit) + 1 : 1;

  return (
    <div className="database-page-content">
      <section className="technical-heading">
                <div className="technical-heading-row"><div><h1>Database Explorer</h1><p>Inspect the connected database with bounded, read-only table queries. Sensitive column values are redacted before they reach this page.</p></div>
          {schema && <div className="schema-live-stats"><span>{schema.database}</span><strong>{schema.summary.tableCount}</strong><small>BASE TABLES</small><strong>{schema.summary.tableRecordCount.toLocaleString()}</strong><small>LIVE ROWS</small></div>}
        </div>
      </section>
      <section className="recent-bookings-panel" aria-label="Recent committed booking records">
        <div className="recent-bookings-heading"><div><h2>{queryBookingId ? `Booking #${queryBookingId}` : "Recent bookings"}</h2></div><button type="button" onClick={() => { setLoadingRecent(true); setRecentError(""); void loadRecent(); }} disabled={loadingRecent}><RefreshCw size={14} className={loadingRecent ? "loading-spin" : ""} /> Refresh</button></div>
        {loadingRecent ? <p className="database-state"><LoaderCircle size={15} className="loading-spin" /> Reading recent booking records…</p> : recentError ? <p className="database-state database-state-error" role="alert">{recentError}</p> : recentBookings.length === 0 ? <p className="database-state">No matching booking rows were found in the connected database.</p> : <div className="recent-bookings-list">{recentBookings.map((booking) => <article key={booking.bookingId} className={queryBookingId === booking.bookingId ? "recent-booking focused" : "recent-booking"}><div><span>BOOKING</span><strong>#{booking.bookingId}</strong><small>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(booking.createdAt))}</small></div><div><span>SHOWTIME</span><strong>#{booking.showtimeId}</strong></div><div><span>TICKETS</span><strong>{booking.ticketCount}</strong></div><div><span>TOTAL</span><strong>{currency.format(booking.total)}</strong></div><div><span>BOOKING STATUS</span><strong>{booking.bookingStatus}</strong><small>{booking.paymentStatus ? `DEMO PAYMENT ROW · ${booking.paymentStatus}` : "NO PAYMENT ROW"}</small></div></article>)}</div>}
        <p className="recent-bookings-note">These rows are queried from MySQL after commit. Payment status is a local demonstration record; no payment provider is contacted.</p>
      </section>

      <div className="database-explorer-layout">
        <aside className="database-table-rail" aria-label="Database tables">
          <div className="database-table-rail-head"><span>BASE TABLES</span><strong>{tableObjects.length}</strong></div>
          <label className="database-table-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tables" aria-label="Search database tables" /></label>
          {loadingSchema ? <p className="database-state"><LoaderCircle size={14} className="loading-spin" /> Loading tables…</p> : schemaError ? <p className="database-state database-state-error">{schemaError}</p> : <div className="database-table-list">{filteredTables.map((table) => <button key={table.name} className={selectedTable === table.name ? "selected" : ""} onClick={() => { setSelectedTable(table.name); setOffset(0); setLoadingRows(true); setRowsError(""); }}><span>{table.name}</span><small>{table.recordCount.toLocaleString()} ROWS</small></button>)}</div>}
        </aside>
        <section className="database-table-view" aria-label="Selected table contents">
          <div className="database-table-heading"><div><h2>{selectedTable || "Select a table"}</h2><p>{selectedObject ? `${selectedObject.columns.length} columns · ${selectedObject.recordCount.toLocaleString()} current rows` : "Choose a base table from the index."}</p></div><button type="button" onClick={() => { setLoadingRows(true); setRowsError(""); void loadRows(); }} disabled={loadingRows || !selectedTable}><RefreshCw size={14} className={loadingRows ? "loading-spin" : ""} /> Reload</button></div>
          {selectedObject && <div className="database-column-strip" aria-label="Table columns">{selectedObject.columns.map((column) => <span key={column.name}><b>{column.keys.map((key) => key.kind).join("/") || "COL"}</b>{column.name}<small>{column.type}</small></span>)}</div>}
          <div className="database-query-line"><code>LIVE QUERY RESULT · PAGE SIZE 25 · OFFSET {offset}</code><span><Database size={12} /> READ ONLY</span></div>
          {rowsError ? <p className="database-state database-state-error" role="alert">{rowsError}</p> : loadingRows ? <p className="database-state"><LoaderCircle size={15} className="loading-spin" /> Reading live rows…</p> : rowsResult?.rows.length === 0 ? <p className="database-state">This table has no rows in the current database.</p> : rowsResult && <>
            {rowsResult.redactedColumns.length > 0 && <p className="redaction-note">Sensitive values are withheld: {rowsResult.redactedColumns.join(", ")}</p>}
            <div className="database-record-grid-wrap"><table className="database-record-grid"><thead><tr>{rowsResult.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rowsResult.rows.map((row, index) => <tr key={rowsResult.primaryKey.map((column) => valueLabel(row[column])).join("/") || `${offset}-${index}`}>{rowsResult.columns.map((column) => <td key={column}>{rowsResult.redactedColumns.includes(column) ? <span className="redacted-value">REDACTED</span> : valueLabel(row[column])}</td>)}</tr>)}</tbody></table></div>
            <div className="database-pagination"><span>{rowsResult.total.toLocaleString()} ROWS · PAGE {currentPage} OF {pageCount}</span><div><button disabled={offset === 0 || loadingRows} onClick={() => { setLoadingRows(true); setOffset(Math.max(0, offset - 25)); }}><ArrowLeft size={13} /> Previous</button><button disabled={offset + 25 >= rowsResult.total || loadingRows} onClick={() => { setLoadingRows(true); setOffset(offset + 25); }}>Next <ArrowRight size={13} /></button></div></div>
          </>}
        </section>
      </div>
      <footer className="footer"><Link className="brand-lockup" href="/"><MajorLogo height={26} /></Link><span>Read-only view of the live MySQL database</span><Link href="/schema">OPEN SCHEMA <ArrowRight className="back-top-icon" size={12} /></Link></footer>
    </div>
  );
}
