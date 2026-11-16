// SC-10 통계 대시보드
//
// - (main) 그룹 안 — layout이 외곽·탭바·사이드바·가드 처리
// - 본인 통계 + 7일 탄소강도 + 동네 비교 + NDR 비교
// - 데이터 패치는 page에서 prisma 직접 (D17 리더보드 패턴)
// - 와이어프레임 차트 2(시간대별 활동 히트맵)은 D21 폴리싱 또는 Phase 2 때

import { requireSession } from "@/lib/auth/session.server";
import { getGuildAverageCleanEnergy } from "@/lib/guilds/score.server";
import { getUserGuildInfo } from "@/lib/users/users.server";
import { PageHeader } from "@/components/layout/page-header";
import { getMeStats } from "@/lib/stats/me-stats.server";
import { getCarbonIntensityHistory } from "@/lib/stats/world-history.server";
import { SummaryCards } from "@/components/stats/summary-cards";
import { CarbonIntensityChart } from "@/components/stats/carbon-intensity-chart";
import { GuildCompareCard } from "@/components/stats/guild-compare-card";
import { NdrComparisonCard } from "@/components/stats/ndr-comparison-card";

export default async function StatsPage() {
  // (main) layout 가드 통과 후라 user·dino 존재 보장.
  // 본인 정보 + 길드 displayName 동시 조회.
  const session = await requireSession();

  const [meStats, history, me] = await Promise.all([
    getMeStats(session.id),
    getCarbonIntensityHistory(7),
    getUserGuildInfo(session.id),
  ]);

  // 동네 비교용 — 길드원 Dino.totalCleanEnergy 평균
  // (D16 길드 점수는 합계, 여기는 평균이 별도 필요)
  const guildAverage = me?.guildId
    ? await getGuildAverageCleanEnergy(me.guildId)
    : null;

  return (
    <>
      <PageHeader title="통계" />

      <div className="flex flex-col gap-3 px-4 pt-1 pb-6">
        <SummaryCards stats={meStats} />

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold">최근 7일 탄소강도</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            시간별 평균 · gCO₂/kWh
          </p>
          <div className="mt-3">
            <CarbonIntensityChart data={history} />
          </div>
        </section>

        {me?.guildId && guildAverage !== null && (
          <GuildCompareCard
            guildName={me.guild?.displayName ?? "내 동네"}
            myCleanEnergy={meStats.totalCleanEnergy}
            guildAverage={guildAverage}
          />
        )}

        <NdrComparisonCard myCleanEnergy={meStats.totalCleanEnergy} />
      </div>
    </>
  );
}
