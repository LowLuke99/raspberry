import { useEffect, useRef, useState } from "react";

interface PollingResult<T> {
  data: T | null;
  error: string | null;
}

/**
 * Polls an async function on a fixed interval using a self-rescheduling timeout
 * (so calls never overlap even if one is slow). The latest `fn` is read from a
 * ref, so passing a fresh closure each render doesn't restart the loop — only
 * `intervalMs` does. Fully cleaned up on unmount.
 */
export function usePolling<T>(
  fn: () => Promise<T>,
  intervalMs: number,
): PollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      try {
        const result = await fnRef.current();
        if (alive) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) timer = setTimeout(tick, intervalMs);
      }
    };

    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [intervalMs]);

  return { data, error };
}
