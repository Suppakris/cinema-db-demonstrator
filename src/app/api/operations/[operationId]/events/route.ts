import { NextRequest } from "next/server";
import { subscribeToOperation } from "@/lib/operation-events";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const operationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ operationId: string }> },
) {
  const { operationId } = await params;
  if (!operationIdPattern.test(operationId)) {
    return Response.json({ error: "Choose a valid operation identifier." }, { status: 400 });
  }

  let closeStream = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      let unsubscribe = () => {};
      const heartbeat = setInterval(() => {
        if (closed) return;
        try { controller.enqueue(encoder.encode(": keep-alive\n\n")); }
        catch { close(); }
      }, 20_000);
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        request.signal.removeEventListener("abort", close);
        try { controller.close(); } catch { /* The browser may have closed first. */ }
      };
      const send = (event: { id: string; kind: string; outcome: string }) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`id: ${event.id}\ndata: ${JSON.stringify(event)}\n\n`));
          if (event.kind === "OPERATION" && event.outcome === "COMPLETE") close();
        } catch {
          close();
        }
      };

      const subscription = subscribeToOperation(operationId, send);
      unsubscribe = subscription.unsubscribe;
      for (const event of subscription.events) send(event);
      if (subscription.complete || closed) {
        close();
        return;
      }
      request.signal.addEventListener("abort", close, { once: true });
      closeStream = close;
    },
    cancel() { closeStream(); },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
