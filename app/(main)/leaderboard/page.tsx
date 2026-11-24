// SC-11 길드/리더보드 페이지
//
// 시즌 선택: 이번 시즌(기본) / 지난 시즌 / 역대 누적 — ?season=yyyy-MM|all (ADR 43)
// 탭 두 개: 우리 동네 (default) / 전국 — ?tab=local|global
//
// 데이터는 서버에서 lib/guilds/score 직접 호출. 첫 진입 fetch만 — 폴링 없음.

import { requireSession } from "@/lib/auth/session.server";
import {
  getEarliestGuildLogAt,
  getGuildDetail,
  getLeaderboard,
} from "@/lib/guilds/score.server";
import {
  listSeasons,
  parsePeriodParam,
  periodParam,
  seasonDaysLeft,
  seasonLabel,
  seasonShortLabel,
  type ScorePeriod,
} from "@/lib/guilds/season";
import { LeaderboardTabs } from "@/components/leaderboard/leaderboard-tabs";
import { SeasonPicker } from "@/components/leaderboard/season-picker";
import type { LeaderboardTab } from "@/components/leaderboard/href";
import { LocalList } from "@/components/leaderboard/local-list";
import { GlobalList } from "@/components/leaderboard/global-list";

interface PageProps {
  searchParams: Promise<{ tab?: string; season?: string }>;
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab: LeaderboardTab = params.tab === "global" ? "global" : "local";
  const now = new Date();
  const period = parsePeriodParam(params.season, now);

  // 본인 정보 조회 — (main) layout이 User + Dino 가드하므로 여기선 무조건 존재
  const me = await requireSession();

  // 두 탭의 데이터를 미리 가져옴 (탭 전환 시 라운드트립 회피).
  const [leaderboard, guildDetail, earliest] = await Promise.all([
    getLeaderboard(period),
    me.guildId ? getGuildDetail(me.guildId, period) : Promise.resolve(null),
    getEarliestGuildLogAt(),
  ]);

  const isCumulative = period.kind === "all";

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      <SeasonPicker seasons={listSeasons(earliest, now)} active={period} tab={tab} />

      {/* 헤더 — 본인 길드 표시명 + 기간 점수 + 전국 순위 */}
      {guildDetail ? (
        <header className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-stone-500">
            우리 동네 길드 · {periodCaption(period, now)}
          </p>
          <h1 className="mt-0.5 text-lg font-bold text-stone-900">
            {guildDetail.guild.displayName}
          </h1>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-xs text-stone-500">
                {isCumulative ? "누적 점수" : "시즌 점수"}
              </p>
              <p className="text-xl font-bold tabular-nums text-amber-700">
                {guildDetail.guild.score.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500">전국 순위</p>
              <p className="text-xl font-bold tabular-nums text-stone-800">
                #{guildDetail.guild.rank}
              </p>
            </div>
          </div>
        </header>
      ) : (
        <EmptyHeader />
      )}

      {/* 탭 */}
      <LeaderboardTabs active={tab} seasonParam={periodParam(period, now)} />

      {/* 탭 컨텐츠 */}
      {tab === "local" ? (
        guildDetail ? (
          <LocalList members={guildDetail.members} myUserId={me.id} />
        ) : (
          <EmptyState message="길드 정보를 불러올 수 없습니다." />
        )
      ) : (
        <GlobalList rankings={leaderboard} myGuildId={me.guildId ?? null} />
      )}
    </div>
  );
}

/** "11월 시즌 · 7일 남음" / "2026년 10월 시즌 결과" / "역대 누적" */
function periodCaption(period: ScorePeriod, now: Date): string {
  if (period.kind === "all") return "역대 누적";
  const daysLeft = seasonDaysLeft(period.season, now);
  return daysLeft > 0
    ? `${seasonShortLabel(period.season)} 시즌 · ${daysLeft}일 남음`
    : `${seasonLabel(period.season)} 시즌 결과`;
}

function EmptyHeader() {
  return (
    <header className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-sm text-stone-500">
        길드 정보를 불러오지 못했습니다. 동네 코드가 등록되어 있는지 확인하세요.
      </p>
    </header>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center text-sm text-stone-500 shadow-sm">
      {message}
    </div>
  );
}
