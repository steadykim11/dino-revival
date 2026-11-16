import { describe, expect, it } from "vitest";
import { relativeTimeKo } from "./relative";

const NOW = new Date("2026-06-30T12:00:00.000Z");
const ago = (sec: number) => new Date(NOW.getTime() - sec * 1000);

describe("relativeTimeKo", () => {
  it.each([
    [0, "방금 전"],
    [59, "방금 전"],
    [60, "1분 전"],
    [59 * 60, "59분 전"],
    [60 * 60, "1시간 전"],
    [23 * 60 * 60, "23시간 전"],
    [24 * 60 * 60, "1일 전"],
    [9 * 24 * 60 * 60, "9일 전"],
  ])("%d초 전 → %s", (sec, expected) => {
    expect(relativeTimeKo(ago(sec), NOW)).toBe(expected);
  });

  it("ISO 문자열도 받는다", () => {
    expect(relativeTimeKo(ago(120).toISOString(), NOW)).toBe("2분 전");
  });

  it("미래 시각은 방금 전으로 처리", () => {
    expect(relativeTimeKo(ago(-300), NOW)).toBe("방금 전");
  });
});
