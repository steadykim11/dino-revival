// SC-11 길드/리더보드 페이지
//
// 탭 두 개: 우리 동네 (default) / 전국
// searchParam ?tab=local|global 로 전환. URL 보존.
//
// 데이터는 서버에서 lib/guilds/score 직접 호출 (API self-loopback 회피).
// 첫 진입 fetch만 — 폴링 없음.

import { requireSession } from "@/lib/auth/session.server";
import { getLeaderboard, getGuildDetail } from "@/lib/guilds/score.server";
import { LeaderboardTabs } from "@/components/leaderboard/leaderboard-tabs";
import { LocalList } from "@/components/leaderboard/local-list";
import { GlobalList } from "@/components/leaderboard/global-list";

type Tab = "local" | "global";

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tab: Tab = params.tab === "global" ? "global" : "local";

  // 본인 정보 조회 — (main) layout이 User + Dino 가드하므로 여기선 무조건 존재
  const me = await requireSession();

  // 두 탭의 데이터를 미리 가져옴 (탭 전환 시 라운드트립 회피).
  const [leaderboard, guildDetail] = await Promise.all([
    getLeaderboard(),
    me.guildId ? getGuildDetail(me.guildId) : Promise.resolve(null),
  ]);

  // 헤더에 표시할 본인 길드 정보
  const myGuildHeader = guildDetail
    ? {
        displayName: guildDetail.guild.displayName,
        score: guildDetail.guild.score,
        rank: guildDetail.guild.rank,
        memberCount: guildDetail.guild.memberCount,
      }
    : null;

  return (
    <div className="flex flex-col gap-4 px-4 py-5">
      {/* 헤더 — 본인 길드 표시명 + 점수 + 전국 순위 */}
      {myGuildHeader ? (
        <header className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-stone-500">우리 동네 길드</p>
          <h1 className="mt-0.5 text-lg font-bold text-stone-900">
            {myGuildHeader.displayName}
          </h1>
          <div className="mt-3 flex items-end justify-between">
            <div>
              <p className="text-xs text-stone-500">길드 점수</p>
              <p className="text-xl font-bold tabular-nums text-amber-700">
                {myGuildHeader.score.toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-stone-500">전국 순위</p>
              <p className="text-xl font-bold tabular-nums text-stone-800">
                #{myGuildHeader.rank}
              </p>
            </div>
          </div>
        </header>
      ) : (
        <EmptyHeader />
      )}

      {/* 탭 */}
      <LeaderboardTabs active={tab} />

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
