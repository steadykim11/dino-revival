// SC-09 던전 진입 페이지
// - 활성 던전 없으면 빈 상태 페이지
// - 활성 시: enemy banner + 미션 + 기여도 (DungeonPageClient)
// - 인증/Dino 체크는 (main) layout 책임 — 여기선 활성 던전 존재만 확인

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/auth/session.server";
import { getDungeonMissions, toMissionItem } from "@/lib/missions/missions.server";
import { DUNGEON_MULTIPLIER } from "@/lib/missions/reward-calculator";
import { getLatestSnapshot } from "@/lib/world/snapshot-reader.server";
import { getCurrentActiveDungeon } from "@/lib/dungeon/lifecycle.server";
import { getGuildContribution } from "@/lib/dungeon/contribution.server";
import { classifyBattlefield } from "@/lib/world/battlefield";
import { ENEMY_META } from "@/lib/battle/enemy-types";
import { DungeonEnemyBanner } from "@/components/dungeon/enemy-banner";
import { DungeonPageClient } from "@/components/dungeon/dungeon-page-client";
import type { MissionItem } from "@/lib/missions/types";

export const dynamic = "force-dynamic";

export default async function DungeonPage() {
  const me = await requireSession();

  const now = new Date();
  const dungeon = await getCurrentActiveDungeon(now);

  // 빈 상태 — 던전이 없을 때
  if (!dungeon) {
    return <DungeonEmptyState />;
  }

  // 최신 snapshot — 적 분류용
  const snapshot = await getLatestSnapshot();
  if (!snapshot) {
    // snapshot 없으면 가드 — 일반적이지 않은 상태
    return <DungeonEmptyState message="전력 데이터를 불러오는 중입니다." />;
  }

  const { carbonIntensity, supplyReserveRate } = snapshot;
  const battlefield = classifyBattlefield(carbonIntensity);
  const enemy = ENEMY_META[battlefield];

  // 던전 미션 (이 dungeonId로 발급된 본인 미션)
  const missionRows = await getDungeonMissions(me.id, dungeon.id);

  // 보상은 2배로 표기한다. 실제 적립값은 서버 reward-calculator의 DUNGEON_MULTIPLIER가 보장
  const missions: MissionItem[] = missionRows.map((m) => {
    const item = toMissionItem(m);
    return { ...item, baseReward: item.baseReward * DUNGEON_MULTIPLIER };
  });

  // 길드 기여도
  const contribution = await getGuildContribution(me.id, dungeon.id);
  const remainingSec = Math.max(
    0,
    Math.floor((dungeon.expiresAt.getTime() - now.getTime()) / 1000),
  );

  // contribution이 null이면 길드 미가입 — 빈 카드로 fallback
  const contributionView =
    contribution !== null
      ? {
          guildDisplayName: contribution.guildDisplayName,
          totalMembers: contribution.totalMembers,
          contributedMembers: contribution.contributedMembers,
          percent: Math.round(
            contribution.totalMembers > 0
              ? (contribution.contributedMembers / contribution.totalMembers) *
                  100
              : 0,
          ),
        }
      : {
          guildDisplayName: "길드 미가입",
          totalMembers: 0,
          contributedMembers: 0,
          percent: 0,
        };

  return (
    <div className="px-4 py-4">
      {/* 페이지 헤더 — 뒤로가기 + 타이틀 */}
      <header className="mb-3 flex items-center gap-2">
        <Link
          href="/"
          aria-label="메인으로"
          className="flex h-8 w-8 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold text-stone-900">피크 던전</h1>
      </header>

      <div className="flex flex-col gap-3">
        <DungeonEnemyBanner
          enemy={enemy}
          carbonIntensity={carbonIntensity}
          supplyReserveRate={supplyReserveRate}
        />

        <DungeonPageClient
          dungeonId={dungeon.id}
          initialRemainingSec={remainingSec}
          missions={missions}
          carbonIntensity={carbonIntensity}
          contribution={contributionView}
        />
      </div>
    </div>
  );
}

function DungeonEmptyState({
  message = "방금 던전이 종료됐어요. 발급된 미션은 자정까지 메인에서 완료할 수 있습니다.",
}: {
  message?: string;
}) {
  return (
    <div className="px-4 py-4">
      <header className="mb-3 flex items-center gap-2">
        <Link
          href="/"
          aria-label="메인으로"
          className="flex h-8 w-8 items-center justify-center rounded-full text-stone-600 hover:bg-stone-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold text-stone-900">피크 던전</h1>
      </header>

      <div className="mt-12 flex flex-col items-center gap-3 text-center">
        <div className="text-sm text-stone-500">{message}</div>
        <Link
          href="/"
          className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-amber-700"
        >
          메인으로
        </Link>
      </div>
    </div>
  );
}
