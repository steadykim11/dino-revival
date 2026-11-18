// /api/world/state를 주기적으로 읽는 폴러. React·DOM과 무관해 그대로 테스트할 수 있다.
// 화면에서는 WorldStateProvider 하나만 이것을 쓴다.
//
// - start(fetchNow): 폴링 시작. fetchNow가 true면 즉시 한 번 읽고, false면 한 주기 뒤부터.
// - stop(): 타이머와 진행 중인 요청을 취소한다. 이미 떠난 요청의 응답이 뒤늦게 와도 버린다.
// - 요청이 끝난 뒤에 다음 타이머를 건다 — 응답이 느려도 요청이 겹치지 않는다.

import type { WorldStateResponse } from "@/lib/world/types";

export interface WorldStatePollerOptions {
  intervalMs: number;
  /** 새 값을 받았을 때 호출. 스냅샷이 하나도 없으면(503) null. */
  onUpdate: (data: WorldStateResponse | null) => void;
  /** 테스트 주입용. 기본은 전역 fetch. */
  fetchImpl?: typeof fetch;
}

export interface WorldStatePoller {
  start: (fetchNow: boolean) => void;
  stop: () => void;
}

export function createWorldStatePoller(
  options: WorldStatePollerOptions,
): WorldStatePoller {
  const { intervalMs, onUpdate } = options;
  const doFetch = options.fetchImpl ?? fetch;

  // 세대 번호 — stop()이나 start()가 호출되면 그 전에 시작된 요청·타이머의 결과를 버린다
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;

  const fetchOnce = async (gen: number) => {
    controller = new AbortController();
    try {
      const res = await doFetch("/api/world/state", {
        signal: controller.signal,
      });
      if (gen !== generation) return;

      if (res.ok) {
        const data = (await res.json()) as WorldStateResponse;
        if (gen !== generation) return;
        onUpdate(data);
      } else if (res.status === 503) {
        onUpdate(null);
      }
      // 그 외 응답은 직전 값을 유지한다 (onUpdate를 부르지 않는다)
    } catch {
      // 중단·네트워크 오류 → 직전 값을 유지하고 다음 주기에 다시 시도
    }
  };

  const stop = () => {
    generation += 1;
    if (timer) clearTimeout(timer);
    timer = null;
    controller?.abort();
    controller = null;
  };

  const start = (fetchNow: boolean) => {
    stop();
    const gen = generation;

    const tick = async () => {
      await fetchOnce(gen);
      if (gen === generation) timer = setTimeout(tick, intervalMs);
    };

    if (fetchNow) void tick();
    else timer = setTimeout(tick, intervalMs);
  };

  return { start, stop };
}
