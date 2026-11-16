// 수집 작업 — 5분마다 실행.
//
//   1) KPX 호출 → world_snapshots에 UPSERT
//   2) 던전 모니터 (만료 정리 + 예비율 기준 자동 발령)
//
// KPX가 클라우드 IP를 차단하므로 가정용 회선(홈서버 또는 개인 PC)에서 실행한다.
// Next.js와 무관한 독립 스크립트이며 DB에 직접 기록한다.
//
// 실행:
//   pnpm job:collect               # .env.local 사용
//   pnpm job:collect --dry-run     # KPX만 호출하고 DB에는 쓰지 않음
//
// 필요한 환경변수: DATABASE_URL, KPX_API_KEY
//
// 종료 코드: 0 = 스냅샷 기록 성공, 1 = KPX 실패 또는 오류.
// 결과는 한 줄 JSON으로 출력한다 (로그 파일에서 검색하기 쉽도록).

import { fetchWorldSnapshot } from "@/lib/external/kpx";
import { monitorDungeon } from "@/lib/dungeon/monitor";
import { prisma } from "@/lib/prisma";
import { captureWorldSnapshot } from "@/lib/world/snapshot-writer";

function report(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({ job: "collect", at: new Date().toISOString(), ...fields }),
  );
}

async function dryRun(): Promise<number> {
  const data = await fetchWorldSnapshot();
  report({
    dryRun: true,
    ts: data.ts.toISOString(),
    carbonIntensity: data.carbonIntensity,
    supplyReserveRate: data.supplyReserveRate,
    currentLoad: data.currentLoad,
  });
  return 0;
}

async function run(): Promise<number> {
  const startedAt = Date.now();

  const snapshot = await captureWorldSnapshot();

  // 스냅샷 수집에 실패해도 던전 만료 정리는 진행한다.
  // (지연된 스냅샷으로는 자동 발령하지 않는다 — monitorDungeon 내부 가드)
  const dungeon = await monitorDungeon().catch((err: unknown) => ({
    error: err instanceof Error ? err.message : String(err),
  }));

  report({
    snapshot:
      snapshot.kind === "success"
        ? {
            kind: snapshot.kind,
            ts: snapshot.ts.toISOString(),
            carbonIntensity: snapshot.carbonIntensity,
          }
        : {
            kind: snapshot.kind,
            reason: snapshot.reason,
            lastTs: snapshot.lastTs?.toISOString() ?? null,
          },
    dungeon,
    elapsedMs: Date.now() - startedAt,
  });

  return snapshot.kind === "success" && !("error" in dungeon) ? 0 : 1;
}

async function main(): Promise<number> {
  const isDryRun = process.argv.includes("--dry-run");
  try {
    return await (isDryRun ? dryRun() : run());
  } catch (err) {
    report({ error: err instanceof Error ? err.message : String(err) });
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().then((code) => process.exit(code));
