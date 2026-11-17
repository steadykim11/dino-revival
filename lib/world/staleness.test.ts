import { describe, expect, it } from "vitest";
import {
  COLLECT_INTERVAL_MIN,
  isSnapshotStale,
  SNAPSHOT_STALE_AFTER_MIN,
  SNAPSHOT_STALE_AFTER_MS,
} from "./staleness";

const NOW = new Date("2026-06-30T12:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

describe("수집 주기", () => {
  it("하루 호출 수가 공공데이터포털 한도(API당 100회) 안에 들어온다", () => {
    const callsPerDay = (24 * 60) / COLLECT_INTERVAL_MIN;
    expect(callsPerDay).toBeLessThanOrEqual(100);
  });

  it("지연 기준은 수집 3회분", () => {
    expect(SNAPSHOT_STALE_AFTER_MIN).toBe(3 * COLLECT_INTERVAL_MIN);
    expect(SNAPSHOT_STALE_AFTER_MS).toBe(SNAPSHOT_STALE_AFTER_MIN * 60 * 1000);
  });
});

describe("isSnapshotStale", () => {
  it("방금 수집된 스냅샷은 지연이 아니다", () => {
    expect(isSnapshotStale(minutesAgo(0), NOW)).toBe(false);
    expect(isSnapshotStale(minutesAgo(COLLECT_INTERVAL_MIN), NOW)).toBe(false);
  });

  it("기준 시간까지는 지연이 아니다", () => {
    expect(isSnapshotStale(minutesAgo(SNAPSHOT_STALE_AFTER_MIN), NOW)).toBe(
      false,
    );
  });

  it("기준 시간을 넘기면 지연", () => {
    const justOver = new Date(
      minutesAgo(SNAPSHOT_STALE_AFTER_MIN).getTime() - 1,
    );
    expect(isSnapshotStale(justOver, NOW)).toBe(true);
    expect(isSnapshotStale(minutesAgo(600), NOW)).toBe(true);
  });

  it("미래 시각(시계 오차)은 지연이 아니다", () => {
    expect(isSnapshotStale(minutesAgo(-2), NOW)).toBe(false);
  });
});
