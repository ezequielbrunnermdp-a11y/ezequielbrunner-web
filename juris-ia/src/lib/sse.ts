import "server-only";

/** Respuesta Server-Sent Events. `run` recibe `send(evento, datos)`. */
export function sse(run: (send: (event: string, data: unknown) => void, signal: AbortSignal) => Promise<void>, signal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const ping = setInterval(() => send("ping", {}), 15000);
      try {
        await run(send, signal);
      } catch (e) {
        console.error(e);
        send("error", { message: e instanceof Error ? e.message : "Error" });
      } finally {
        clearInterval(ping);
        send("done", {});
        closed = true;
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
