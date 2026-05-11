"use client";

import { useEffect, useRef, useState } from "react";
import type { WorldStateResponse } from "@/lib/types/world-snapshot";

type Status = "loading" | "ready" | "unavailable";

interface UseWorldStateResult {
  data: WorldStateResponse | null;
  status: Status;
}

const POLL_MS = 5000;

export function useWorldState(): UseWorldStateResult {
  const [data, setData] = useState<WorldStateResponse | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let stopped = false;

    const fetchOnce = async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch("/api/world/state", { signal: ac.signal });
        if (stopped) return;
        if (res.status === 503) {
          setStatus("unavailable");
        } else if (res.ok) {
          const json = (await res.json()) as WorldStateResponse;
          setData(json);
          setStatus("ready");
        }
        // 그 외 코드는 직전 상태 유지 (시연 안정성 우선)
      } catch {
        // abort/네트워크 에러 → 직전 상태 유지
      }
    };

    const schedule = () => {
      if (stopped) return;
      timerRef.current = setTimeout(async () => {
        await fetchOnce();
        schedule();
      }, POLL_MS);
    };

    const start = async () => {
      await fetchOnce();
      schedule();
    };

    const stop = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      abortRef.current?.abort();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        stop();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return { data, status };
}
