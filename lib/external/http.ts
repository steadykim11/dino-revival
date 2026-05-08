/**
 * 외부 API 호출용 fetch 래퍼
 * - AbortController 기반 타임아웃 (기본 8초)
 * - 1회 재시도 (5xx, 네트워크 에러)
 * - 일관된 에러 타입
 */

export class ExternalApiError extends Error {
  constructor(
    public readonly source: string,
    public readonly kind: "timeout" | "network" | "http" | "parse",
    public readonly status?: number,
    public readonly body?: string,
    cause?: unknown,
  ) {
    super(`[${source}] ${kind}${status ? ` ${status}` : ""}`);
    this.name = "ExternalApiError";
    if (cause) this.cause = cause;
  }
}

export type FetchOptions = {
  source: string; // 로깅용 식별자 (ex. KPX_D1)
  timeoutMs?: number; // 기본 8000
  retry?: boolean; // 기본 true (5xx, 네트워크 에러 시 1회)
  init?: RequestInit;
};

export async function fetchExternal(
  url: string,
  opts: FetchOptions,
): Promise<string> {
  const { source, timeoutMs = 8000, retry = true, init } = opts;

  const attempt = async (): Promise<string> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new ExternalApiError(source, "http", res.status, body);
      }

      return await res.text();
    } catch (error) {
      if (error instanceof ExternalApiError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new ExternalApiError(source, "timeout");
      }
      throw new ExternalApiError(
        source,
        "network",
        undefined,
        undefined,
        error,
      );
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (error) {
    if (
      retry &&
      error instanceof ExternalApiError &&
      (error.kind === "network" ||
        error.kind === "timeout" ||
        (error.kind === "http" && error.status && error.status >= 500))
    ) {
      await new Promise((r) => setTimeout(r, 1000)); //  1초 대기 후 1회 재시도
      return await attempt();
    }
    throw error;
  }
}
