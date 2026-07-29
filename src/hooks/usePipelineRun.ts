"use client";

/**
 * Drives a pipeline run and exposes live progress.
 *
 * Streams over SSE when the connection holds, and falls back to polling
 * `/api/pipeline/[jobId]` if the stream never opens or drops mid-run. The
 * fallback matters more than it looks: a run takes minutes, and proxies, mobile
 * networks and serverless platforms all cut idle-looking streams. Without it a
 * user watches a frozen bar while the job actually completes fine.
 *
 * Because progress is a SNAPSHOT rather than a delta, switching between the two
 * transports mid-run is safe — the next event from either source is complete.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PipelineProgress } from "@/lib/pipeline/progress";

const POLL_INTERVAL_MS = 2_000;

export type RunStatus = "idle" | "starting" | "running" | "completed" | "failed" | "stopped";

export interface UsePipelineRunResult {
  status: RunStatus;
  progress: PipelineProgress | null;
  jobId: string | null;
  error: string | null;
  /** True while falling back to polling instead of streaming. */
  polling: boolean;
  start: (payload: unknown) => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
}

export function usePipelineRun(): UsePipelineRunResult {
  const [status, setStatus] = useState<RunStatus>("idle");
  const [progress, setProgress] = useState<PipelineProgress | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string | null>(null);

  const clearPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setPolling(false);
  }, []);

  // Tear everything down if the component unmounts mid-run.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const beginPolling = useCallback(
    (id: string) => {
      if (pollRef.current) return;
      setPolling(true);

      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const response = await fetch(`/api/pipeline/${id}`);
            if (!response.ok) return;
            const body = await response.json();

            if (body.progress) setProgress(body.progress as PipelineProgress);

            const jobStatus = body.job?.status as string | undefined;
            if (jobStatus === "completed" || jobStatus === "failed" || jobStatus === "stopped") {
              setStatus(jobStatus as RunStatus);
              clearPolling();
            }
          } catch {
            // Transient network failure — keep polling rather than giving up.
          }
        })();
      }, POLL_INTERVAL_MS);
    },
    [clearPolling]
  );

  const start = useCallback(
    async (payload: unknown) => {
      setStatus("starting");
      setError(null);
      setProgress(null);
      setJobId(null);
      jobIdRef.current = null;
      clearPolling();

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/pipeline/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
        }

        // The server answers with JSON when it declined to stream; honour that
        // rather than trying to parse it as an event stream.
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("text/event-stream")) {
          const body = await response.json();
          setJobId(body.jobId ?? null);
          jobIdRef.current = body.jobId ?? null;
          setStatus(body.status === "completed" ? "completed" : "running");
          if (body.jobId) beginPolling(body.jobId);
          return;
        }

        setStatus("running");
        await consumeEventStream(response, {
          onProgress: (next) => {
            setProgress(next);
            if (next.jobId && !jobIdRef.current) {
              jobIdRef.current = next.jobId;
              setJobId(next.jobId);
            }
          },
          onDone: () => {
            setStatus("completed");
            clearPolling();
          },
          onError: (message) => {
            setError(message);
            setStatus("failed");
            clearPolling();
          },
        });

        // Stream ended without a terminal event — the connection was cut, but
        // the run may still be alive server-side, so switch to polling.
        setStatus((current) => {
          if (current === "running" && jobIdRef.current) {
            beginPolling(jobIdRef.current);
          }
          return current;
        });
      } catch (caught) {
        if (controller.signal.aborted) return;

        // If a job id was already assigned, the run exists — poll it instead of
        // reporting a failure the user cannot act on.
        if (jobIdRef.current) {
          beginPolling(jobIdRef.current);
          return;
        }
        setError(caught instanceof Error ? caught.message : String(caught));
        setStatus("failed");
      }
    },
    [beginPolling, clearPolling]
  );

  const stop = useCallback(async () => {
    const id = jobIdRef.current;
    abortRef.current?.abort();
    clearPolling();

    if (id) {
      try {
        await fetch(`/api/pipeline/${id}/stop`, { method: "POST" });
      } catch {
        // The abort above already stopped the client side.
      }
    }
    setStatus("stopped");
  }, [clearPolling]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearPolling();
    setStatus("idle");
    setProgress(null);
    setJobId(null);
    setError(null);
    jobIdRef.current = null;
  }, [clearPolling]);

  return { status, progress, jobId, error, polling, start, stop, reset };
}

/** Parse an SSE body incrementally. */
async function consumeEventStream(
  response: Response,
  handlers: {
    onProgress: (progress: PipelineProgress) => void;
    onDone: (payload: unknown) => void;
    onError: (message: string) => void;
  }
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line; anything after the last one is a
    // partial event and must stay in the buffer.
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const eventLine = chunk.split("\n").find((line) => line.startsWith("event:"));
      const dataLine = chunk.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;

      const event = eventLine?.slice("event:".length).trim() ?? "message";
      let data: unknown;
      try {
        data = JSON.parse(dataLine.slice("data:".length).trim());
      } catch {
        continue;
      }

      if (event === "progress") {
        const progress = data as PipelineProgress;
        if (typeof progress?.percent === "number") handlers.onProgress(progress);
      } else if (event === "done") {
        handlers.onDone(data);
      } else if (event === "error") {
        handlers.onError((data as { message?: string })?.message ?? "Run failed");
      }
    }
  }
}
