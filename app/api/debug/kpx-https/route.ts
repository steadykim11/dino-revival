import { NextRequest, NextResponse } from "next/server";
import https from "node:https";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  // 인증 — 아무나 못 부르게
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = `https://openapi.kpx.or.kr/openapi/sukub5mMaxDatetime/getSukub5mMaxDatetime?serviceKey=${env.KPX_API_KEY}&pageNo=1&numOfRows=1`;

  // 1. node:https 시도
  const httpsResult = await tryHttps(url);

  // 2. fetch 시도 (비교용)
  const fetchResult = await tryFetch(url);

  return NextResponse.json({
    https: httpsResult,
    fetch: fetchResult,
  });
}

function tryHttps(url: string): Promise<{
  ok: boolean;
  status?: number;
  bytes?: number;
  elapsedMs: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const req = https.get(url, { timeout: 20000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        resolve({
          ok: true,
          status: res.statusCode,
          bytes: body.length,
          elapsedMs: Date.now() - t0,
        });
      });
    });
    req.on("error", (e) => {
      resolve({
        ok: false,
        elapsedMs: Date.now() - t0,
        error: `${e.name}: ${e.message}`,
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({
        ok: false,
        elapsedMs: Date.now() - t0,
        error: "timeout",
      });
    });
  });
}

async function tryFetch(url: string): Promise<{
  ok: boolean;
  status?: number;
  bytes?: number;
  elapsedMs: number;
  error?: string;
}> {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    return {
      ok: true,
      status: res.status,
      bytes: text.length,
      elapsedMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      ok: false,
      elapsedMs: Date.now() - t0,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
