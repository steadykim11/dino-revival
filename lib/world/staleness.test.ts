import { describe, expect, it } from "vitest";
import { isSnapshotStale, SNAPSHOT_STALE_AFTER_MS } from "./staleness";

const NOW = new Date("2026-06-30T12:00:00.000Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60 * 1000);

describe("isSnapshotStale", () => {
  it("기준은 15분", () => {
    expect(SNAPSHOT_STALE_AFTER_MS).toBe(15 * 60 * 1000);
  });

  it("방금 수집된 스냅샷은 지연이 아니다", () => {
    expect(isSnapshotStale(minutesAgo(0), NOW)).toBe(false);
    expect(isSnapshotStale(minutesAgo(5), NOW)).toBe(false);
  });

  it("정확히 15분까지는 지연이 아니다", () => {
    expect(isSnapshotStale(minutesAgo(15), NOW)).toBe(false);
  });

  it("15분을 넘기면 지연", () => {
    expect(isSnapshotStale(new Date(minutesAgo(15).getTime() - 1), NOW)).toBe(
      true,
    );
    expect(isSnapshotStale(minutesAgo(180), NOW)).toBe(true);
  });

  it("미래 시각(시계 오차)은 지연이 아니다", () => {
    expect(isSnapshotStale(minutesAgo(-2), NOW)).toBe(false);
  });
});
