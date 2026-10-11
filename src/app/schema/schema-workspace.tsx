"use client";

import { ArrowDownToLine, ArrowRight, Minus, Plus, RotateCcw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import type { SchemaData, SchemaObject, SchemaRelationship } from "@/lib/schema-types";

const NODE_W = 270;
const NODE_HEADER_H = 30;
const COLUMN_ROW_H = 25;
const GAP_X = 96;
const GAP_Y = 80;
const COLS = 4;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 1.8;

function nodeHeight(table: SchemaObject) {
  return NODE_HEADER_H + table.columns.length * COLUMN_ROW_H + 10;
}

const GROUPS = [
  { id: "locations", label: "Locations, theatres & seats", order: ["district", "branch", "theater", "theater_type", "province", "seat_type", "seat", "day_time_slot", "sound_system", "theater_sound_system", "price"] },
  { id: "films", label: "Films, people & showtimes", order: ["genre", "movie", "studio", "person", "movie_genre_details", "movie_studio", "movie_person_role", "movie_release", "showtime", "language"] },
  { id: "bookings", label: "Bookings, tickets & payments", order: ["customer", "booking", "ticket", "payment", "promotion", "member_card", "membership_tier", "payment_provider_account", "member_pass_redemption", "payment_method"] },
] as const;

type DiagramGroup = { id: string; label: string; tables: SchemaObject[]; relationships: SchemaRelationship[] };
type EdgeLayout = { relation: SchemaRelationship; route: string; label: string; labelX: number; labelY: number; index: number };

function layoutRelationshipEdges(relationships: SchemaRelationship[], positions: Map<string, { x: number; y: number }>, heights: Map<string, number>): EdgeLayout[] {
  const placedLabels: Array<{ x: number; y: number; width: number }> = [];
  const outgoing = new Map<string, number[]>();
  const incoming = new Map<string, number[]>();
  relationships.forEach((relation, index) => {
    outgoing.set(relation.fromTable, [...(outgoing.get(relation.fromTable) ?? []), index]);
    incoming.set(relation.toTable, [...(incoming.get(relation.toTable) ?? []), index]);
  });
  const portX = (tableName: string, relationIndex: number, connections: Map<string, number[]>) => {
    const position = positions.get(tableName)!;
    const indexes = connections.get(tableName) ?? [];
    const portIndex = indexes.indexOf(relationIndex);
    return position.x + NODE_W * (portIndex + 1) / (indexes.length + 1);
  };
  return relationships.map((relation, index) => {
    const from = positions.get(relation.fromTable)!;
    const to = positions.get(relation.toTable)!;
    const fromHeight = heights.get(relation.fromTable)!;
    const toHeight = heights.get(relation.toTable)!;
    const fromColumn = Math.round((from.x - 18) / (NODE_W + GAP_X));
    const toColumn = Math.round((to.x - 18) / (NODE_W + GAP_X));
    const channelColumn = fromColumn === toColumn ? Math.min(fromColumn, COLS - 2) : Math.floor((fromColumn + toColumn) / 2);
    const channelX = 18 + channelColumn * (NODE_W + GAP_X) + NODE_W + GAP_X / 2 + (index % 7 - 3) * 8;
    const adjacentSameRow = from.y === to.y && Math.abs(fromColumn - toColumn) === 1;
    let route: string;
    let segments: Array<{ left: number; right: number; y: number; baselines: number[] }>;
    if (adjacentSameRow) {
      const sourceIndexes = outgoing.get(relation.fromTable) ?? [];
      const targetIndexes = incoming.get(relation.toTable) ?? [];
      const sourceY = from.y + fromHeight * (sourceIndexes.indexOf(index) + 1) / (sourceIndexes.length + 1);
      const targetY = to.y + toHeight * (targetIndexes.indexOf(index) + 1) / (targetIndexes.length + 1);
      const sourceX = from.x + (to.x > from.x ? NODE_W : 0);
      const targetX = to.x + (to.x > from.x ? 0 : NODE_W);
      const localChannelX = (sourceX + targetX) / 2 + (index % 3 - 1) * 8;
      route = `M ${sourceX} ${sourceY} L ${localChannelX} ${sourceY} L ${localChannelX} ${targetY} L ${targetX} ${targetY}`;
      segments = [
        { left: Math.min(sourceX, localChannelX), right: Math.max(sourceX, localChannelX), y: sourceY, baselines: [sourceY - 7, sourceY + 8] },
        { left: Math.min(localChannelX, targetX), right: Math.max(localChannelX, targetX), y: targetY, baselines: [targetY - 7, targetY + 8] },
      ].sort((a, b) => (b.right - b.left) - (a.right - a.left));
    } else {
      const x1 = portX(relation.fromTable, index, outgoing);
      const y1 = from.y + fromHeight;
      const x2 = portX(relation.toTable, index, incoming);
      const y2 = to.y + toHeight;
      const laneOffset = (index % 3 - 1) * 16;
      const laneY1 = y1 + GAP_Y / 2 + laneOffset;
      const laneY2 = y2 + GAP_Y / 2 + laneOffset;
      route = `M ${x1} ${y1} L ${x1} ${laneY1} L ${channelX} ${laneY1} L ${channelX} ${laneY2} L ${x2} ${laneY2} L ${x2} ${y2}`;
      segments = [
        { left: Math.min(x1, channelX), right: Math.max(x1, channelX), y: laneY1, baselines: [] },
        { left: Math.min(channelX, x2), right: Math.max(channelX, x2), y: laneY2, baselines: [] },
      ].map((segment) => {
        const rowBottom = segment.y - GAP_Y / 2 - laneOffset;
        return { ...segment, baselines: [segment.y - 8, segment.y + 8].filter((baseline) => baseline >= rowBottom + 8 && baseline <= rowBottom + GAP_Y - 8) };
      }).sort((a, b) => (b.right - b.left) - (a.right - a.left));
    }
    const label = `${relation.cardinality}${relation.optional ? " · OPTIONAL" : ""}`;
    const labelWidth = Math.max(26, label.length * 4.6);
    let labelX = (from.x + to.x + NODE_W) / 2;
    let labelY = (from.y + fromHeight + to.y + toHeight) / 2;
    let foundSlot = false;
    for (const segment of segments) {
      if (segment.right - segment.left < labelWidth + 12) continue;
      const minX = segment.left + labelWidth / 2 + 6;
      const maxX = segment.right - labelWidth / 2 - 6;
      const center = (minX + maxX) / 2;
      const candidates = [center];
      for (let step = 18; center - step >= minX || center + step <= maxX; step += 18) {
        if (center - step >= minX) candidates.push(center - step);
        if (center + step <= maxX) candidates.push(center + step);
      }
      for (const baseline of segment.baselines) {
        const available = candidates.find((candidateX) => !placedLabels.some((placed) =>
          Math.abs(placed.x - candidateX) < (placed.width + labelWidth) / 2 + 3 && Math.abs(placed.y - baseline) < 12,
        ));
        if (available !== undefined) {
          labelX = available;
          labelY = baseline;
          foundSlot = true;
          break;
        }
      }
      if (foundSlot) break;
    }
    placedLabels.push({ x: labelX, y: labelY, width: labelWidth });
    return { relation, route, label, labelX, labelY, index };
  });
}

export function SchemaWorkspace() {
  const [schema, setSchema] = useState<SchemaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [selectedRelation, setSelectedRelation] = useState<SchemaRelationship | null>(null);
  const [search, setSearch] = useState("");
  const [viewGroup, setViewGroup] = useState("bookings");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [fitMode, setFitMode] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/schema", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Schema metadata could not be loaded.");
        return result as SchemaData;
      })
      .then((result) => { if (active) { setSchema(result); setSelectedName(result.objects.find((item) => item.type === "BASE TABLE")?.name ?? ""); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "Schema metadata could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const tables = useMemo(() => schema?.objects.filter((item) => item.type === "BASE TABLE") ?? [], [schema]);
  const groupIdForTable = useCallback((name: string) => GROUPS.find((group) => group.order.includes(name as never))?.id ?? "other", []);
  const diagramGroups = useMemo<DiagramGroup[]>(() => {
    if (!schema) return [];
    const known = new Set<string>();
    const grouped: Array<{ id: string; label: string; tables: SchemaObject[] }> = GROUPS.map((group) => {
      const groupTables = tables
        .filter((table) => group.order.includes(table.name as never))
        .sort((a, b) => group.order.indexOf(a.name as never) - group.order.indexOf(b.name as never));
      groupTables.forEach((table) => known.add(table.name));
      return { id: group.id, label: group.label, tables: groupTables };
    }).filter((group) => group.tables.length > 0);
    const otherTables = tables.filter((table) => !known.has(table.name));
    if (otherTables.length) grouped.push({ id: "other", label: "Other tables", tables: otherTables });
    return grouped.map((group) => ({
      ...group,
      relationships: schema.relationships.filter((relation) =>
        group.tables.some((table) => table.name === relation.fromTable) &&
        group.tables.some((table) => table.name === relation.toTable),
      ),
    }));
  }, [schema, tables]);
  const visibleGroups = useMemo(() => viewGroup === "all" ? diagramGroups : diagramGroups.filter((group) => group.id === viewGroup), [diagramGroups, viewGroup]);
  const visibleTables = useMemo(() => viewGroup === "all" ? visibleGroups.flatMap((group) => group.tables) : visibleGroups[0]?.tables ?? [], [viewGroup, visibleGroups]);
  const shownTableNames = useMemo(() => new Set(visibleTables.map((table) => table.name)), [visibleTables]);
  const nodeHeights = useMemo(() => new Map(visibleTables.map((table) => [table.name, nodeHeight(table)])), [visibleTables]);
  const layout = useMemo(() => {
    const nodePositions = new Map<string, { x: number; y: number }>();
    const groupHeaders = new Map<string, number>();
    let groupTop = 34;
    for (const group of visibleGroups) {
      if (!group.tables.length) continue;
      groupHeaders.set(group.id, groupTop - 18);
      const rowCount = Math.ceil(group.tables.length / COLS);
      const rowHeights = Array.from({ length: rowCount }, (_, row) => Math.max(...group.tables.slice(row * COLS, (row + 1) * COLS).map(nodeHeight)));
      const rowTops: number[] = [];
      let rowTop = groupTop;
      rowHeights.forEach((rowHeight) => {
        rowTops.push(rowTop);
        rowTop += rowHeight + GAP_Y;
      });
      group.tables.forEach((table, index) => nodePositions.set(table.name, {
        x: 18 + (index % COLS) * (NODE_W + GAP_X),
        y: rowTops[Math.floor(index / COLS)],
      }));
      groupTop = rowTops[rowCount - 1] + rowHeights[rowCount - 1] + NODE_HEADER_H + 2 * GAP_Y;
    }
    const right = Math.max(0, ...[...nodePositions.values()].map((position) => position.x + NODE_W));
    const bottom = Math.max(0, ...[...nodePositions.entries()].map(([name, position]) => position.y + (nodeHeights.get(name) ?? 0)));
    return { positions: nodePositions, headers: groupHeaders, width: Math.max(240, right + 18), height: Math.max(240, bottom + GAP_Y + 24) };
  }, [nodeHeights, visibleGroups]);
  const positions = layout.positions;
  const width = layout.width;
  const height = layout.height;
  const visibleRelationships = useMemo(() => schema?.relationships.filter((relation) =>
    shownTableNames.has(relation.fromTable) && shownTableNames.has(relation.toTable) &&
    groupIdForTable(relation.fromTable) === groupIdForTable(relation.toTable),
  ) ?? [], [groupIdForTable, schema, shownTableNames]);
  const crossGroupRelationships = schema?.relationships.filter((relation) => viewGroup === "all"
    ? groupIdForTable(relation.fromTable) !== groupIdForTable(relation.toTable)
    : shownTableNames.has(relation.fromTable) !== shownTableNames.has(relation.toTable),
  ) ?? [];
  const edgeLayouts = useMemo(() => layoutRelationshipEdges(visibleRelationships, positions, nodeHeights), [visibleRelationships, positions, nodeHeights]);
  const selected = schema?.objects.find((item) => item.name === selectedName) ?? null;
  const matchingTables = tables.filter((table) => table.name.toLowerCase().includes(search.trim().toLowerCase()));

  const selectTable = useCallback((name: string) => {
    setSelectedName(name);
    setSelectedRelation(null);
    setViewGroup(groupIdForTable(name));
  }, [groupIdForTable]);
  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const padding = 48;
    const availableWidth = Math.max(1, canvas.clientWidth - padding);
    const availableHeight = Math.max(1, canvas.clientHeight - padding);
    const nextZoom = Math.max(MIN_ZOOM, Math.min(1, availableWidth / width, availableHeight / height));
    setZoom(nextZoom);
    setPan({ x: (canvas.clientWidth - width * nextZoom) / 2, y: (canvas.clientHeight - height * nextZoom) / 2 });
    setFitMode(true);
    canvas.scrollTo({ left: 0, top: 0 });
  }, [height, width]);
  useEffect(() => {
    if (!schema || window.matchMedia("(max-width: 700px)").matches) return;
    fitCanvas();
  }, [schema, fitCanvas]);
  useEffect(() => {
    if (!fitMode) return;
    fitCanvas();
  }, [fitMode, fitCanvas]);
  useEffect(() => {
    if (!fitMode) return;
    window.addEventListener("resize", fitCanvas);
    return () => window.removeEventListener("resize", fitCanvas);
  }, [fitMode, fitCanvas]);
  function zoomBy(amount: number) {
    setFitMode(false);
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + amount)));
  }
  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest(".erd-table, .erd-edge-hit")) return;
    setFitMode(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y });
  }
  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!drag) return;
    setPan({ x: drag.panX + (event.clientX - drag.x), y: drag.panY + (event.clientY - drag.y) });
  }
  function onPointerUp(event: PointerEvent<SVGSVGElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDrag(null);
  }
  function onWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? .06 : -.06);
  }
  async function toggleFullScreen() {
    if (!canvasRef.current) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else await canvasRef.current.requestFullscreen();
  }
  function chooseRelationship(relation: SchemaRelationship) {
    setSelectedRelation(relation);
    setSelectedName(relation.fromTable);
    setViewGroup(groupIdForTable(relation.fromTable));
  }
  function changeViewGroup(id: string) {
    setViewGroup(id);
    setSelectedRelation(null);
    const nextGroup = id === "all" ? diagramGroups[0] : diagramGroups.find((group) => group.id === id);
    if (nextGroup?.tables[0]) setSelectedName(nextGroup.tables[0].name);
  }

  return (
    <div className="schema-page-content">
      <section className="technical-heading">
        <div className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> DATABASE STRUCTURE / LIVE METADATA</div>
        <div className="technical-heading-row"><div><h1>Schema <em>Design</em></h1><p>Reverse-engineered from the connected MySQL database. Select a table or foreign-key edge to inspect verified structure.</p></div>
          {schema && <div className="schema-live-stats"><span>{schema.database}</span><strong>{schema.summary.tableCount}</strong><small>BASE TABLES</small><strong>{schema.relationships.length}</strong><small>FOREIGN KEYS</small></div>}
        </div>
      </section>
      <div className="schema-focus-tabs" role="group" aria-label="ERD focus view">
        {[{ id: "all", label: "All entity groups" }, ...diagramGroups.map(({ id, label }) => ({ id, label }))].map((item) => (
          <button key={item.id} type="button" className={viewGroup === item.id ? "active" : ""} aria-pressed={viewGroup === item.id} onClick={() => changeViewGroup(item.id)}>
            {item.label}{item.id !== "all" && <small>{diagramGroups.find((group) => group.id === item.id)?.tables.length ?? 0} TABLES</small>}
          </button>
        ))}
      </div>
      <div className="schema-controls">
        <label className="schema-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a table…" aria-label="Search tables" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear table search"><X size={14} /></button>}</label>
        <div className="schema-zoom-controls"><button type="button" onClick={() => zoomBy(-.1)} aria-label="Zoom out"><Minus size={15} /></button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => zoomBy(.1)} aria-label="Zoom in"><Plus size={15} /></button><button type="button" onClick={fitCanvas} aria-label="Fit diagram to view"><RotateCcw size={14} /> FIT</button><button type="button" onClick={() => void toggleFullScreen()}><ArrowDownToLine size={14} /> PRESENT</button></div>
      </div>
      {loading ? <div className="schema-loading">Reading verified MySQL schema…</div> : error ? <div className="schema-error" role="alert">{error}</div> : schema && <>
        <div className="schema-workspace-layout">
          <aside className="schema-table-rail" aria-label="Schema tables">
            <div className="schema-table-rail-head"><strong>TABLE INDEX</strong><span>{matchingTables.length} / {tables.length}</span></div>
            <div className="schema-table-index">{matchingTables.map((table) => <button key={table.name} type="button" className={selectedName === table.name ? "selected" : ""} onClick={() => selectTable(table.name)}><span>{table.name}</span><small>{table.columns.length} COL · {table.recordCount.toLocaleString()} ROW</small></button>)}</div>
          </aside>
          <section className={`erd-canvas${fitMode ? " erd-canvas-fitted" : ""}`} ref={canvasRef} aria-label="Interactive entity relationship diagram">
            <svg viewBox={`0 0 ${width} ${height}`} role="application" aria-label="Entity relationship diagram. Use pointer to pan and mouse wheel or controls to zoom." onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} style={{ width, height, cursor: drag ? "grabbing" : "grab" }}>
              <defs><marker id="erd-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#b89b63" /></marker></defs>
              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                {visibleGroups.map((group) => <text key={group.id} className="erd-group-label" x="18" y={(layout.headers.get(group.id) ?? 16) + 11}>{group.label.toUpperCase()} · {group.tables.length} TABLES · {group.relationships.length} INTERNAL LINKS</text>)}
                {edgeLayouts.map(({ relation, route, label, labelX, labelY, index }) => (
                  <g key={`${relation.constraintName}-${index}`} className="erd-edge" role="button" tabIndex={0} aria-label={`${relation.fromTable} to ${relation.toTable}, ${label}`} onClick={() => chooseRelationship(relation)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); chooseRelationship(relation); } }}>
                    <path className="erd-edge-visible" d={route} markerEnd="url(#erd-arrow)" />
                    <path className="erd-edge-hit" d={route} />
                    <text x={labelX} y={labelY} className="erd-edge-label">{label}</text>
                  </g>
                ))}
                {visibleTables.map((table) => {
                  const position = positions.get(table.name)!;
                  const tableHeight = nodeHeights.get(table.name)!;
                  const isMatch = !search || table.name.toLowerCase().includes(search.trim().toLowerCase());
                  const isSelected = selectedName === table.name;
                  return <g key={table.name} className={`erd-table ${isSelected ? "selected" : ""} ${isMatch ? "" : "dimmed"}`} role="button" tabIndex={0} aria-label={`Select ${table.name}, ${table.columns.length} columns`} aria-pressed={isSelected} onClick={() => selectTable(table.name)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectTable(table.name); } }} transform={`translate(${position.x} ${position.y})`}>
                    <rect width={NODE_W} height={tableHeight} />
                    <rect className="erd-table-cap" width={NODE_W} height={NODE_HEADER_H} />
                    <text className="erd-table-name" x="11" y="18">{table.name}</text>
                    <text className="erd-table-count" x={NODE_W - 10} y="18" textAnchor="end">{table.recordCount.toLocaleString()} ROWS</text>
                    {table.columns.map((column, columnIndex) => {
                      const rowTop = NODE_HEADER_H + columnIndex * COLUMN_ROW_H;
                      const rowBaseline = rowTop + 11;
                      const constraints = [
                        column.nullable ? "NULLABLE" : "NOT NULL",
                        column.defaultValue !== null ? `DEFAULT ${column.defaultValue}` : "",
                        column.extra,
                      ].filter(Boolean).join(" · ");
                      return <g key={column.name} className="erd-column-row">
                        <title>{`${column.name} · ${column.type}${column.keys.length ? ` · ${column.keys.map((key) => key.kind).join(" / ")}` : ""}${constraints ? ` · ${constraints}` : ""}`}</title>
                        <line className="erd-column-divider" x1="0" x2={NODE_W} y1={rowTop + COLUMN_ROW_H} y2={rowTop + COLUMN_ROW_H} />
                        {column.keys.length > 0 && <text className="erd-key-marker" x="8" y={rowBaseline}>{column.keys.map((key) => key.kind).join("/")}</text>}
                        <text className="erd-column-name" x="45" y={rowBaseline}>{column.name}</text>
                        <text className="erd-column-type" x={NODE_W - 8} y={rowBaseline} textAnchor="end">{column.type}</text>
                        {constraints && <text className="erd-column-constraints" x="45" y={rowTop + 21}>{constraints}</text>}
                      </g>;
                    })}
                  </g>;
                })}
              </g>
            </svg>
            <div className="erd-help">DRAG TO PAN · SCROLL TO ZOOM · CLICK A TABLE OR RELATIONSHIP</div>
          </section>
        </div>
        <section className="schema-detail-panel" aria-live="polite">
          {selectedRelation ? <div className="schema-relation-detail">
            <div><span className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> FOREIGN KEY / VERIFIED</span><h2>{selectedRelation.constraintName}</h2></div>
            <div className="schema-detail-flow"><button onClick={() => selectTable(selectedRelation.fromTable)}>{selectedRelation.fromTable}<small>{selectedRelation.fromColumns.join(", ")}</small></button><ArrowRight size={18} /><strong>{selectedRelation.cardinality}<small>{selectedRelation.optional ? "OPTIONAL REFERENCE" : "REQUIRED REFERENCE"}</small></strong><ArrowRight size={18} /><button onClick={() => selectTable(selectedRelation.toTable)}>{selectedRelation.toTable}<small>{selectedRelation.toColumns.join(", ")}</small></button></div>
          </div> : selected && <TableDetails table={selected} relationships={schema.relationships.filter((relation) => relation.fromTable === selected.name || relation.toTable === selected.name)} onSelectRelation={chooseRelationship} />}
        </section>
        {crossGroupRelationships.length > 0 && <section className="schema-cross-links" aria-label="Relationships between entity groups">
          <div className="schema-detail-subhead">RELATIONSHIPS TO OTHER GROUPS <span>{crossGroupRelationships.length} VERIFIED FOREIGN KEYS</span></div>
          <p>These live foreign keys connect this focus to tables in another group.</p>
          <div>{crossGroupRelationships.map((relation) => <button type="button" key={relation.constraintName} onClick={() => chooseRelationship(relation)}><strong>{relation.fromTable}</strong><code>{relation.fromColumns.join(", ")}</code><ArrowRight size={14} /><strong>{relation.toTable}</strong><code>{relation.toColumns.join(", ")}</code><small>{relation.cardinality}{relation.optional ? " · OPTIONAL" : ""}</small></button>)}</div>
        </section>}
      </>}
    </div>
  );
}

function TableDetails({ table, relationships, onSelectRelation }: { table: SchemaObject; relationships: SchemaRelationship[]; onSelectRelation: (relation: SchemaRelationship) => void }) {
  return <div className="table-detail-grid">
    <div className="table-detail-intro"><span className="eyebrow dark-eyebrow"><span className="eyebrow-line" /> SELECTED {table.type === "VIEW" ? "VIEW" : "TABLE"}</span><h2>{table.name}</h2><p>{table.columns.length} columns · {table.recordCount.toLocaleString()} live rows</p></div>
    <div className="schema-detail-columns"><div className="schema-detail-subhead">COLUMNS <span>{table.columns.length}</span></div><div className="schema-detail-column-list">{table.columns.map((column) => <div key={column.name}><span>{column.keys.map((key) => key.kind).join(" / ") || "COLUMN"}</span><strong>{column.name}</strong><code>{column.type}</code><small>{column.nullable ? "NULLABLE" : "NOT NULL"}{column.extra ? ` · ${column.extra}` : ""}</small></div>)}</div></div>
    <div className="schema-detail-relations"><div className="schema-detail-subhead">RELATIONSHIPS <span>{relationships.length}</span></div>{relationships.length === 0 ? <p>No declared foreign keys.</p> : relationships.map((relation) => <button key={relation.constraintName} type="button" onClick={() => onSelectRelation(relation)}><span>{relation.fromTable === table.name ? "REFERENCES" : "REFERENCED BY"}</span><strong>{relation.fromTable} <ArrowRight size={12} /> {relation.toTable}</strong><small>{relation.cardinality}{relation.optional ? " · OPTIONAL" : ""} · {relation.constraintName}</small></button>)}</div>
  </div>;
}

