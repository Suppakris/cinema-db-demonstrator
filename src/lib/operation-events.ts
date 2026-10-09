export type OperationEvent = {
  id: string;
  timestamp: string;
  kind: string;
  label: string;
  tables: string[];
  sql: string | null;
  outcome: string;
  affectedRows: number | null;
};

type Channel = {
  events: OperationEvent[];
  listeners: Set<(event: OperationEvent) => void>;
  complete: boolean;
  touchedAt: number;
};

type EventStore = Map<string, Channel>;
const root = globalThis as typeof globalThis & { __cinemaOperationEvents?: EventStore };
const store = root.__cinemaOperationEvents ?? (root.__cinemaOperationEvents = new Map());

function channelFor(operationId: string) {
  const now = Date.now();
  for (const [key, channel] of store) {
    if (now - channel.touchedAt > 120_000) store.delete(key);
  }
  let channel = store.get(operationId);
  if (!channel) {
    channel = { events: [], listeners: new Set(), complete: false, touchedAt: now };
    store.set(operationId, channel);
  }
  channel.touchedAt = now;
  return channel;
}

export function publishOperationEvent(
  operationId: string,
  event: Omit<OperationEvent, "id" | "timestamp"> & { timestamp?: string },
) {
  const channel = channelFor(operationId);
  if (channel.complete) return;
  const entry: OperationEvent = {
    ...event,
    id: `${Date.now()}-${channel.events.length + 1}`,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };
  channel.events.push(entry);
  if (channel.events.length > 250) channel.events.splice(0, channel.events.length - 250);
  channel.touchedAt = Date.now();
  for (const listener of channel.listeners) listener(entry);
}

export function completeOperation(operationId: string) {
  const channel = channelFor(operationId);
  if (channel.complete) return;
  publishOperationEvent(operationId, {
    kind: "OPERATION",
    label: "Operation finished",
    tables: [],
    sql: null,
    outcome: "COMPLETE",
    affectedRows: null,
  });
  channel.complete = true;
  channel.touchedAt = Date.now();
}

export function subscribeToOperation(operationId: string, listener: (event: OperationEvent) => void) {
  const channel = channelFor(operationId);
  channel.listeners.add(listener);
  return {
    events: [...channel.events],
    complete: channel.complete,
    unsubscribe: () => channel.listeners.delete(listener),
  };
}
