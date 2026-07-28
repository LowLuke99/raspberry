import { useEffect, useState } from "react";

/**
 * Accumulates a rolling window of the latest `value` for live charts. Appends
 * on each change and trims to `length` samples. NaN/undefined are ignored so a
 * failed poll doesn't punch a hole in the chart.
 */
export function useSeries(value: number | undefined | null, length = 60): number[] {
  const [series, setSeries] = useState<number[]>([]);

  useEffect(() => {
    if (value == null || Number.isNaN(value)) return;
    setSeries((prev) => {
      const next = [...prev, value];
      return next.length > length ? next.slice(next.length - length) : next;
    });
  }, [value, length]);

  return series;
}
