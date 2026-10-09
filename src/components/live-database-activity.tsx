"use client";

import { Activity, ChevronDown, ChevronUp, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type ActivityEntry = {
  timestamp: string;
  kind: string;
  label: string;
  tables: string[];
  sql: string | null;
  outcome: string;
  affectedRows: number | null;
};

type LiveEvent = ActivityEntry & { id: string };

function parseEventBlock(block: string) {
  const data = block.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
  if (!data) return null;
  try { return JSON.parse(data) as LiveEvent; } catch { return null; }
}

export function LiveDatabaseActivity({
  operationId,
  fallbackEvents,
  running,
}: {
  operationId: string | null;
  fallbackEvents: ActivityEntry[];
  running: boolean;
}) {
  const [streamEvents, setStreamEvents] = useState<LiveEvent[]>([]);
  const [streamFailed, setStreamFailed] = useState(false);
  const [expanded, setExpanded] = useState(running);

  useEffect(() => {
    if (!operationId) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/operations/${operationId}/events`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok || !response.body) throw new Error("Activity stream unavailable.");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        let complete = false;
        while (!complete) {
          const { value, done } = await reader.read();
          if (done) break;
          pending += decoder.decode(value, { stream: true });
          const blocks = pending.split("\n\n");
          pending = blocks.pop() ?? "";
          for (const block of blocks) {
            const event = parseEventBlock(block);
            if (!event) continue;
            setStreamEvents((current) => [...current, event].slice(-100));
            if (event.kind === "OPERATION" && event.outcome === "COMPLETE") complete = true;
          }
        }
        await reader.cancel().catch(() => {});
      } catch {
        if (!controller.signal.aborted) setStreamFailed(true);
      }
    })();
    return () => controller.abort();
  }, [operationId]);

  const events: ActivityEntry[] = streamEvents.length ? streamEvents : fallbackEvents;
  const transactionStatus = useMemo(() => {
    if (running) return "IN PROGRESS";
    const statusEvent = [...events].reverse().find((event) => event.kind === "TRANSACTION" || event.kind === "BOOKING");
    if (!statusEvent) return streamFailed ? "ACTIVITY UNAVAILABLE" : events.length ? "OPERATION FINISHED" : "READY";
    if (statusEvent.outcome.includes("COMMITTED")) return "COMMITTED";
    if (statusEvent.outcome.includes("ROLLED BACK")) return "ROLLED BACK";
    if (statusEvent.outcome.includes("FAILED")) return "FAILED";
    return "IN PROGRESS";
  }, [events, running, streamFailed]);

  return (
    <section className={`live-activity ${running ? "live-activity-running" : ""}`} aria-label="Live database activity">
      <button className="live-activity-toggle" type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
        <span className="live-activity-icon"><Activity size={15} /></span>
        <span className="live-activity-title"><strong>Live database activity</strong><small>{events.length ? `${events.length} actual events · SQL values hidden` : "Operation evidence appears here as the booking runs"}</small></span>
        <span className={`live-activity-status ${transactionStatus.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{running && <LoaderCircle size={12} className="loading-spin" />}{transactionStatus}</span>
        {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {expanded && <div className="live-activity-body" aria-live="polite">
        {events.length === 0 ? <p>{streamFailed ? "The activity feed is unavailable. Booking continues independently." : operationId ? "Waiting for the backend to report database operations…" : "Submit a booking to inspect its real database operations."}</p> : <ol className="live-activity-list">
          {events.map((event, index) => <li key={`${event.timestamp}-${event.kind}-${index}`}>
            <time dateTime={event.timestamp}>{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(event.timestamp))}</time>
            <span className={`activity-kind activity-kind-${event.kind.toLowerCase()}`}>{event.kind}</span>
            <div><strong>{event.label}</strong><small>{event.tables.length ? `TABLES · ${event.tables.join(", ")}` : "TRANSACTION / APPLICATION"}</small>{event.sql && <code>{event.sql}</code>}</div>
            <span className={`activity-outcome activity-outcome-${event.outcome.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{event.outcome}{event.affectedRows !== null ? ` · ${event.affectedRows} ROW${event.affectedRows === 1 ? "" : "S"}` : ""}</span>
          </li>)}
        </ol>}
        {streamFailed && fallbackEvents.length > 0 && <p className="activity-fallback-note">Showing the backend operation trace returned with the booking receipt.</p>}
      </div>}
    </section>
  );
}
