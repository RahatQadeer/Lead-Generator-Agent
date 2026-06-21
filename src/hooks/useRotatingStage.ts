"use client";

import { useEffect, useState } from "react";

export function useRotatingStage(
  stages: readonly string[],
  active: boolean,
  intervalMs = 3500
): string {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setIndex(0);
      return;
    }

    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % stages.length);
    }, intervalMs);

    return () => clearInterval(id);
  }, [active, stages, intervalMs]);

  return stages[index] ?? stages[0] ?? "";
}
