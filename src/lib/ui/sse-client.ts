import type { PipelineProgressEvent } from "@/lib/sse/stream";

interface EventStreamHandlers {
  onProgress?: (event: PipelineProgressEvent) => void;
  onDone?: (payload: unknown) => void;
  onError?: (error: { message?: string }) => void;
}

function parseSseChunk(raw: string): { event: string; data: unknown } | null {
  let event = "message";
  const dataLines: string[] = [];

  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  if (dataLines.length === 0) return null;
  try {
    return { event, data: JSON.parse(dataLines.join("\n")) };
  } catch {
    return null;
  }
}

/**
 * Read a `text/event-stream` POST response and dispatch its events. Handles partial
 * chunks across reads by buffering until a full `\n\n`-delimited event is available.
 */
export async function consumeEventStream(
  response: Response,
  handlers: EventStreamHandlers
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response has no readable body");

  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const rawEvent = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);

      const parsed = parseSseChunk(rawEvent);
      if (parsed) {
        if (parsed.event === "progress") {
          handlers.onProgress?.(parsed.data as PipelineProgressEvent);
        } else if (parsed.event === "done") {
          handlers.onDone?.(parsed.data);
        } else if (parsed.event === "error") {
          handlers.onError?.(parsed.data as { message?: string });
        }
      }

      separator = buffer.indexOf("\n\n");
    }
  }
}
