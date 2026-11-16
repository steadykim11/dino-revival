import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { daysSince, getCooldownStatus } from "./cooldown";

const NOW = new Date("2026-06-30T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("daysSince", () => {
  it("변경 이력이 없으면 Infinity", () => {
    expect(daysSince(null)).toBe(Infinity);
  });

  it("Date와 ISO 문자열 모두 받는다", () => {
    expect(daysSince(daysAgo(10))).toBe(10);
    expect(daysSince(daysAgo(1.5).toISOString())).toBe(1.5);
  });
});

describe("getCooldownStatus", () => {
  it("변경 이력이 없으면 바로 변경 가능", () => {
    expect(getCooldownStatus(null, 30)).toEqual({
      canChange: true,
      remainingDays: 0,
    });
  });

  it("쿨다운 중이면 남은 일수를 올림해서 알려준다", () => {
    expect(getCooldownStatus(daysAgo(10), 30)).toEqual({
      canChange: false,
      remainingDays: 20,
    });
    expect(getCooldownStatus(daysAgo(10.5), 30)).toEqual({
      canChange: false,
      remainingDays: 20,
    });
    expect(getCooldownStatus(daysAgo(29.9), 30).remainingDays).toBe(1);
  });

  it("쿨다운 일수를 정확히 채우면 변경 가능", () => {
    expect(getCooldownStatus(daysAgo(30), 30).canChange).toBe(true);
    expect(getCooldownStatus(daysAgo(120), 90).canChange).toBe(true);
  });
});
