/**
 * Server-Sent Events (SSE) helpers for streaming long-running pipeline steps.
 *
 * Routes call `createSseResponse(run)` and, inside `run`, emit `progress` events as
 * work advances and a final `done` event carrying the same payload the JSON path
 * would return. Any thrown error is surfaced as an `error` event before the stream
 * closes. The browser reads this with `fetch` + a stream reader (EventSource only
 * supports GET, but these endpoints are POST).
 */

/** A per-item progress update shared by company discovery and lead enrichment. */
export interface PipelineProgressEvent {
  /** Items completed so far (1-based count). */
  current?: number;
  /** Total items to process this run. */
  total?: number;
  /** Matching results found so far, when known. */
  found?: number;
  /** Human label for the item currently being processed (e.g. a company name). */
  label?: string;
  /** Coarse phase label (e.g. "Validating company websites…"). */
  phase?: string;
}

export type ProgressReporter = (event: PipelineProgressEvent) => void;

export type SseEmitter = (event: string, data: unknown) => void;

/** True when the caller asked for an event stream (vs a one-shot JSON response). */
export function wantsEventStream(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("text/event-stream");
}

/**
 * Build a streaming SSE `Response`. `run` receives an `emit(event, data)` function;
 * it should emit `progress` events during work and a final `done` event with the
 * result payload. Throwing inside `run` emits an `error` event and closes cleanly.
 */
export function createSseResponse(
  run: (emit: SseEmitter) => Promise<void>
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const emit: SseEmitter = (event, data) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        await run(emit);
      } catch (error) {
        emit("error", {
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering (e.g. nginx) so events flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
