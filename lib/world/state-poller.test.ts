import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorldStateResponse } from "@/lib/world/types";
import { createWorldStatePoller } from "./state-poller";

const INTERVAL = 30_000;

const state = (carbonIntensity: number) =>
  ({ world: { carbonIntensity } }) as unknown as WorldStateResponse;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/** 응답을 테스트가 원하는 시점에 풀어줄 수 있는 fetch */
function deferredFetch() {
  const pending: {
    resolve: (res: Response) => void;
    reject: (err: unknown) => void;
    signal: AbortSignal;
  }[] = [];

  const fetchImpl = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((resolve, reject) => {
      const signal = init!.signal!;
      signal.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError")),
      );
      pending.push({ resolve, reject, signal });
    });
  });

  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls: fetchImpl, pending };
}

/** 대기 중인 프라미스 콜백을 모두 실행 */
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("start", () => {
  it("fetchNow=true면 즉시 한 번 읽고 결과를 전달한다", async () => {
    const onUpdate = vi.fn();
    const fetchImpl = vi.fn(async () => json(state(463)));
    const poller = createWorldStatePoller({
      intervalMs: INTERVAL,
      onUpdate,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    poller.start(true);
    await flush();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/world/state",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(onUpdate).toHaveBeenCalledWith(state(463));
    poller.stop();
  });

  it("fetchNow=false면 한 주기가 지나기 전에는 읽지 않는다", async () => {
    const fetchImpl = vi.fn(async () => json(state(1)));
    const poller = createWorldStatePoller({
      intervalMs: INTERVAL,
      onUpdate: vi.fn(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    poller.start(false);
    await vi.advanceTimersByTimeAsync(INTERVAL - 1);
    expect(fetchImpl).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    poller.stop();
  });

  it("주기마다 계속 읽는다", async () => {
    const onUpdate = vi.fn();
    let n = 0;
    const fetchImpl = vi.fn(async () => json(state(++n)));
    const poller = createWorldStatePoller({
      intervalMs: INTERVAL,
      onUpdate,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    poller.start(true);
    await flush();
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);

    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(onUpdate).toHaveBeenLastCalledWith(state(4));
    poller.stop();
  });

  it("응답이 느리면 끝난 뒤에 다음 주기를 센다 — 요청이 겹치지 않는다", async () => {
    const { fetchImpl, calls, pending } = deferredFetch();
    const poller = createWorldStatePoller({
      intervalMs: INTERVAL,
      onUpdate: vi.fn(),
      fetchImpl,
    });

    poller.start(true);
    await flush();
    expect(calls).toHaveBeenCalledTimes(1);

    // 응답이 주기의 3배만큼 늦어도 두 번째 요청은 나가지 않는다
    await vi.advanceTimersByTimeAsync(INTERVAL * 3);
    expect(calls).toHaveBeenCalledTimes(1);

    pending[0].resolve(json(state(1)));
    await flush();
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(calls).toHaveBeenCalledTimes(2);
    poller.stop();
  });

  it("다시 start해도 폴링이 두 겹이 되지 않는다", async () => {
    const fetchImpl = vi.fn(async () => json(state(1)));
    const poller = createWorldStatePoller({
      intervalMs: INTERVAL,
      onUpdate: vi.fn(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    poller.start(false);
    poller.start(false);
    poller.start(false);
    await vi.advanceTimersByTimeAsync(INTERVAL);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    poller.stop();
  });
});

describe("stop", () => {
  it("이후로는 읽지 않는다", async () => {
    const fetchImpl = vi.fn(async () => json(state(1)));
    const poller = createWorldStatePoller({
      intervalMs: INTERVAL,
      onUpdate: vi.fn(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    poller.start(true);
    await flush();
    poller.stop();
    await vi.advanceTimersByTimeAsync(INTERVAL * 5);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("진행 중인 요청을 취소하고, 뒤늦게 온 응답은 전달하지 않는다", async () => {
    const { fetchImpl, pending } = deferredFetch();
    const onUpdate = vi.fn();
    const poller = createWorldStatePoller({
      intervalMs: INTERVAL,
      onUpdate,
      fetchImpl,
    });

    poller.start(true);
    await flush();
    poller.stop();

    expect(pending[0].signal.aborted).toBe(true);

    // 취소 신호를 무시하고 응답이 도착하는 경우에도 버린다
    pending[0].resolve(json(state(999)));
    await flush();
    await vi.advanceTimersByTimeAsync(INTERVAL * 2);

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("stop 뒤에 다시 start하면 이전 요청의 응답이 새 폴링에 섞이지 않는다", async () => {
    const { fetchImpl, calls, pending } = deferredFetch();
    const onUpdate = vi.fn();
    const poller = createWorldStatePoller({
      intervalMs: INTERVAL,
      onUpdate,
      fetchImpl,
    });

    poller.start(true); // 요청 A
    await flush();
    poller.stop();
    poller.start(true); // 요청 B
    await flush();
    expect(calls).toHaveBeenCalledTimes(2);

    pending[0].resolve(json(state(1))); // 늦게 도착한 A
    pending[1].resolve(json(state(2))); // B
    await flush();

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(state(2));

    // 타이머도 한 겹만 — 한 주기 뒤 요청은 1건만 늘어난다
    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(calls).toHaveBeenCalledTimes(3);
    poller.stop();
  });
});

describe("응답 처리", () => {
  it("503(스냅샷 없음)이면 null을 전달한다", async () => {
    const onUpdate = vi.fn();
    const poller = createWorldStatePoller({
      intervalMs: INTERVAL,
      onUpdate,
      fetchImpl: (async () =>
        json({ error: { code: "EXTERNAL_API_DOWN" } }, 503)) as unknown as typeof fetch,
    });

    poller.start(true);
    await flush();

    expect(onUpdate).toHaveBeenCalledWith(null);
    poller.stop();
  });

  it("그 외 오류 응답(500 등)은 무시하고 직전 값을 유지한다 — 폴링은 계속", async () => {
    const onUpdate = vi.fn();
    const responses = [json({}, 500), json(state(7))];
    const fetchImpl = vi.fn(async () => responses.shift()!);
    const poller = createWorldStatePoller({
      intervalMs: INTERVAL,
      onUpdate,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    poller.start(true);
    await flush();
    expect(onUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(onUpdate).toHaveBeenCalledWith(state(7));
    poller.stop();
  });

  it("네트워크 오류가 나도 멈추지 않고 다음 주기에 다시 시도한다", async () => {
    const onUpdate = vi.fn();
    const fetchImpl = vi
      .fn<() => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(json(state(5)));
    const poller = createWorldStatePoller({
      intervalMs: INTERVAL,
      onUpdate,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    poller.start(true);
    await flush();
    expect(onUpdate).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(INTERVAL);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledWith(state(5));
    poller.stop();
  });
});
