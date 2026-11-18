// 월드 상태(탄소강도·발전믹스·던전)를 한 곳에서 받아 하위 컴포넌트에 나눠준다.
//
// - 첫 값은 서버 컴포넌트가 읽어서 props로 넘긴다 (로딩 화면 없이 바로 그린다).
// - 이후 이 Provider 하나가 /api/world/state를 주기적으로 다시 읽는다.
//   하위 컴포넌트는 직접 폴링하지 않고 useWorldState()로 받는다.
// - 탭이 보이지 않으면 멈추고, 다시 보이면 즉시 한 번 읽은 뒤 재개한다.
//
// 폴링 자체(주기, 취소, 오류 처리)는 lib/world/state-poller.ts.

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { WorldStateResponse } from "@/lib/world/types";
import { createWorldStatePoller } from "@/lib/world/state-poller";

/**
 * 폴링 주기. 수집은 20분마다지만 던전은 언제든 발령될 수 있어 그보다 자주 읽는다.
 * 응답은 CDN이 5초간 캐시하고 미들웨어를 거치지 않아 호출 비용이 작다.
 */
export const WORLD_STATE_POLL_MS = 30_000;

interface WorldStateValue {
  /** 스냅샷이 아직 하나도 없으면 null */
  data: WorldStateResponse | null;
  /**
   * data를 받은 시각 (ms). "받은 뒤 얼마나 지났나"를 계산하는 기준.
   * 서버가 그린 첫 값은 서버 시각이고, 화면에 붙은 뒤에는 기기 시각으로 바뀐다.
   */
  receivedAtMs: number;
}

const WorldStateContext = createContext<WorldStateValue | null>(null);

interface WorldStateProviderProps {
  /** 서버에서 읽은 첫 값 */
  initialData: WorldStateResponse | null;
  /** initialData를 읽은 서버 시각 (ms) — 서버와 브라우저의 첫 렌더링 결과를 같게 한다 */
  initialNowMs: number;
  children: ReactNode;
}

export function WorldStateProvider({
  initialData,
  initialNowMs,
  children,
}: WorldStateProviderProps) {
  const [value, setValue] = useState<WorldStateValue>({
    data: initialData,
    receivedAtMs: initialNowMs,
  });

  useEffect(() => {
    // 서버 시각 기준이던 받은 시각을 기기 시각으로 바꾼다 (이후 계산은 기기 시계만 쓴다)
    setValue((v) => ({ ...v, receivedAtMs: Date.now() }));

    const poller = createWorldStatePoller({
      intervalMs: WORLD_STATE_POLL_MS,
      onUpdate: (data) => setValue({ data, receivedAtMs: Date.now() }),
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") poller.start(true);
      else poller.stop();
    };

    // 첫 값은 서버가 방금 읽은 것이므로 바로 다시 읽지 않는다
    if (document.visibilityState === "visible") poller.start(false);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      poller.stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <WorldStateContext.Provider value={value}>
      {children}
    </WorldStateContext.Provider>
  );
}

export function useWorldState(): WorldStateValue {
  const value = useContext(WorldStateContext);
  if (!value) {
    throw new Error("useWorldState는 WorldStateProvider 안에서만 쓸 수 있습니다.");
  }
  return value;
}

/**
 * 현재 시각(ms)을 intervalMs마다 갱신해 돌려준다. null이면 갱신하지 않는다.
 *
 * 화면에 붙기 전(서버 렌더링, 브라우저의 첫 렌더링)에는 receivedAtMs를 돌려준다 —
 * 양쪽이 같은 값을 써야 서버가 그린 HTML과 브라우저의 첫 결과가 일치한다.
 */
export function useNow(intervalMs: number | null): number {
  const { receivedAtMs } = useWorldState();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    if (intervalMs === null) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now ?? receivedAtMs;
}
