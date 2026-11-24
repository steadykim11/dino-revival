import { describe, expect, it } from "vitest";
import {
  getKstHour,
  kstDateAsUtcMidnight,
  kstMonthStart,
  toKstMonthString,
  getKstMinute,
  kstNextMidnight,
  normalizeTo5Min,
  parseKpxDateTime,
  toKstDateString,
} from "./kst";

describe("parseKpxDateTime", () => {
  it("KST 문자열을 UTC Date로 변환한다", () => {
    expect(parseKpxDateTime("20260507150500").toISOString()).toBe(
      "2026-05-07T06:05:00.000Z",
    );
  });

  it("KST 새벽은 UTC 전날이 된다", () => {
    expect(parseKpxDateTime("20260101003000").toISOString()).toBe(
      "2025-12-31T15:30:00.000Z",
    );
  });

  it("형식이 다르면 throw", () => {
    expect(() => parseKpxDateTime("2026-05-07 15:05")).toThrow();
    expect(() => parseKpxDateTime("")).toThrow();
  });
});

describe("normalizeTo5Min", () => {
  it("5분 단위로 내림한다", () => {
    expect(
      normalizeTo5Min(new Date("2026-05-07T06:07:42.123Z")).toISOString(),
    ).toBe("2026-05-07T06:05:00.000Z");
  });

  it("이미 5분 경계면 그대로", () => {
    expect(
      normalizeTo5Min(new Date("2026-05-07T06:10:00.000Z")).toISOString(),
    ).toBe("2026-05-07T06:10:00.000Z");
  });
});

describe("toKstDateString", () => {
  it("UTC 15:00 직전은 KST 당일", () => {
    expect(toKstDateString(new Date("2026-05-07T14:59:59.000Z"))).toBe(
      "2026-05-07",
    );
  });

  it("UTC 15:00부터는 KST 다음 날", () => {
    expect(toKstDateString(new Date("2026-05-07T15:00:00.000Z"))).toBe(
      "2026-05-08",
    );
  });
});

describe("getKstHour / getKstMinute", () => {
  it("UTC에 9시간을 더한 시·분", () => {
    const d = new Date("2026-05-07T20:34:00.000Z"); // KST 05:34
    expect(getKstHour(d)).toBe(5);
    expect(getKstMinute(d)).toBe(34);
  });
});

describe("kstNextMidnight", () => {
  it("KST 낮 → 그날 KST 24:00 (UTC 15:00)", () => {
    expect(
      kstNextMidnight(new Date("2026-05-07T03:00:00.000Z")).toISOString(),
    ).toBe("2026-05-07T15:00:00.000Z");
  });

  it("KST 자정 정각 → 다음 날 자정", () => {
    expect(
      kstNextMidnight(new Date("2026-05-07T15:00:00.000Z")).toISOString(),
    ).toBe("2026-05-08T15:00:00.000Z");
  });

  it("월말을 넘어간다", () => {
    expect(
      kstNextMidnight(new Date("2026-05-31T10:00:00.000Z")).toISOString(),
    ).toBe("2026-05-31T15:00:00.000Z");
    expect(
      kstNextMidnight(new Date("2026-05-31T16:00:00.000Z")).toISOString(),
    ).toBe("2026-06-01T15:00:00.000Z");
  });
});

describe("kstDateAsUtcMidnight", () => {
  it("KST 날짜를 UTC 자정으로 표현한다", () => {
    expect(
      kstDateAsUtcMidnight(new Date("2026-05-07T03:00:00.000Z")).toISOString(),
    ).toBe("2026-05-07T00:00:00.000Z");
  });

  it("UTC 15:00(KST 자정)부터는 다음 날짜", () => {
    expect(
      kstDateAsUtcMidnight(new Date("2026-05-07T14:59:59.999Z")).toISOString(),
    ).toBe("2026-05-07T00:00:00.000Z");
    expect(
      kstDateAsUtcMidnight(new Date("2026-05-07T15:00:00.000Z")).toISOString(),
    ).toBe("2026-05-08T00:00:00.000Z");
  });

  it("같은 KST 날짜 안에서는 언제 호출해도 같은 값", () => {
    const morning = kstDateAsUtcMidnight(new Date("2026-05-07T15:00:00.000Z"));
    const night = kstDateAsUtcMidnight(new Date("2026-05-08T14:59:00.000Z"));
    expect(morning.getTime()).toBe(night.getTime());
  });
});

describe("toKstMonthString", () => {
  it("KST 기준 월을 돌려준다", () => {
    expect(toKstMonthString(new Date("2026-11-30T14:59:59.999Z"))).toBe("2026-11");
    expect(toKstMonthString(new Date("2026-11-30T15:00:00.000Z"))).toBe("2026-12"); // KST 12/1 00:00
  });
});

describe("kstMonthStart", () => {
  it("KST 1일 자정을 UTC로", () => {
    expect(kstMonthStart("2026-12").toISOString()).toBe("2026-11-30T15:00:00.000Z");
  });

  it("앞뒤 달, 연도 경계", () => {
    expect(kstMonthStart("2026-12", 1).toISOString()).toBe("2026-12-31T15:00:00.000Z");
    expect(kstMonthStart("2026-01", -1).toISOString()).toBe("2025-11-30T15:00:00.000Z");
  });
});
