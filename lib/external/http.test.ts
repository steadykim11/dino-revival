import { describe, expect, it } from "vitest";
import { ExternalApiError, isRetryable } from "./http";

describe("isRetryable", () => {
  it("네트워크·타임아웃 실패는 재시도", () => {
    expect(isRetryable(new ExternalApiError("X", "network"))).toBe(true);
    expect(isRetryable(new ExternalApiError("X", "timeout"))).toBe(true);
  });

  it("5xx는 재시도, 4xx는 재시도하지 않는다", () => {
    expect(isRetryable(new ExternalApiError("X", "http", 500))).toBe(true);
    expect(isRetryable(new ExternalApiError("X", "http", 503))).toBe(true);
    expect(isRetryable(new ExternalApiError("X", "http", 404))).toBe(false);
    expect(isRetryable(new ExternalApiError("X", "http", 401))).toBe(false);
  });

  it("응답 형식 오류와 그 외 예외는 재시도하지 않는다", () => {
    expect(isRetryable(new ExternalApiError("X", "parse"))).toBe(false);
    expect(isRetryable(new ExternalApiError("X", "http"))).toBe(false);
    expect(isRetryable(new Error("boom"))).toBe(false);
  });
});
