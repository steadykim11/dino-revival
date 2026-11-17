/**
 * 외부 API 호출용 fetch 래퍼
 * - AbortController 기반 타임아웃 (기본 8초)
 * - 재시도 (5xx, 타임아웃, 네트워크 에러). 기본 1회, 횟수·간격 지정 가능
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
  retry?: boolean; // 기본 true. false면 재시도 없음
  retries?: number; // 재시도 횟수 (기본 1)
  retryDelayMs?: number; // 재시도 전 대기 (기본 1000)
  init?: RequestInit;
};

export async function fetchExternal(
  url: string,
  opts: FetchOptions,
): Promise<string> {
  const {
    source,
    timeoutMs = 8000,
    retry = true,
    retries = 1,
    retryDelayMs = 1000,
    init,
  } = opts;

  const attempt = async (): Promise<string> => {
    const t0 = Date.now();
    console.log(
      `[${source}] fetch start`,
      url.replace(/serviceKey=[^&]+/, "serviceKey=***"),
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      console.log(`[${source}] response received`, {
        status: res.status,
        elapsed: Date.now() - t0,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new ExternalApiError(source, "http", res.status, body);
      }

      const text = await res.text();
      console.log(`[${source}] body read complete`, {
        bytes: text.length,
        elapsed: Date.now() - t0,
      });
      return text;
    } catch (error) {
      console.error(`[${source}] failed`, {
        elapsed: Date.now() - t0,
        error: error instanceof Error ? error.message : String(error),
      });
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

  const maxAttempts = retry ? 1 + retries : 1;

  for (let i = 1; ; i++) {
    try {
      return await attempt();
    } catch (error) {
      if (i >= maxAttempts || !isRetryable(error)) throw error;
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
}

/** 재시도할 가치가 있는 실패: 네트워크·타임아웃·5xx */
export function isRetryable(error: unknown): boolean {
  return (
    error instanceof ExternalApiError &&
    (error.kind === "network" ||
      error.kind === "timeout" ||
      (error.kind === "http" && error.status !== undefined && error.status >= 500))
  );
}
