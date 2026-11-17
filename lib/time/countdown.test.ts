import { describe, expect, it } from "vitest";
import { formatCountdown, remainingSecondsAt } from "./countdown";

const T0 = 1_800_000_000_000;

describe("remainingSecondsAt", () => {
  it("받은 직후에는 서버가 준 값 그대로", () => {
    expect(remainingSecondsAt(3600, T0, T0)).toBe(3600);
  });

  it("받은 뒤 흐른 시간만큼 줄어든다", () => {
    expect(remainingSecondsAt(3600, T0, T0 + 1_000)).toBe(3599);
    expect(remainingSecondsAt(3600, T0, T0 + 90_000)).toBe(3510);
  });

  it("1초가 다 지나기 전에는 줄지 않는다", () => {
    expect(remainingSecondsAt(10, T0, T0 + 999)).toBe(10);
  });

  it("0 아래로 내려가지 않는다", () => {
    expect(remainingSecondsAt(5, T0, T0 + 5_000)).toBe(0);
    expect(remainingSecondsAt(5, T0, T0 + 60_000)).toBe(0);
    expect(remainingSecondsAt(0, T0, T0)).toBe(0);
  });

  it("현재 시각이 받은 시각보다 앞서 있어도(시계 보정) 늘어나지 않는다", () => {
    expect(remainingSecondsAt(100, T0, T0 - 30_000)).toBe(100);
  });

  it("소수 초는 내림한다", () => {
    expect(remainingSecondsAt(12.9, T0, T0)).toBe(12);
  });
});

describe("formatCountdown", () => {
  it.each([
    [0, "00:00"],
    [9, "00:09"],
    [60, "01:00"],
    [61, "01:01"],
    [2530, "42:10"],
    [3599, "59:59"],
    [3600, "60:00"],
    [6000, "100:00"],
  ])("%d초 → %s", (sec, expected) => {
    expect(formatCountdown(sec)).toBe(expected);
  });

  it("음수는 00:00, 소수는 내림", () => {
    expect(formatCountdown(-5)).toBe("00:00");
    expect(formatCountdown(59.9)).toBe("00:59");
  });
});
