// 전투 결과 페이지. 컷씬(2.5초) → 결과 표시 두 단계를 한 페이지에서 phase 전환
// D14 수정: MissionLog의 stageBefore/stageAfter 사용 + evolution prop 전달
// D22: intro 인터스티셜 phase 추가 (missionTitle, battlefieldLabel prop 전달)

import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { getBattlefield } from "@/lib/missions/reward-calculator";
import { ENEMY_META } from "@/lib/battle/enemy-types";
import { BattlePageClient } from "@/components/battle/battle-page-client";

interface PageProps {
  params: Promise<{ missionLogId: string }>;
}

const BATTLEFIELD_LABEL = {
  PURIFIED: "PURIFIED",
  NORMAL: "NORMAL",
  POLLUTED: "POLLUTED",
} as const;

export default async function BattlePage({ params }: PageProps) {
  const { missionLogId } = await params;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  // D14: stageBefore/stageAfter 추가 select
  const log = await prisma.missionLog.findUnique({
    where: { id: missionLogId },
    select: {
      userId: true,
      missionTitle: true,
      cleanEnergyEarned: true,
      co2ReducedKg: true,
      intimacyEarned: true,
      carbonIntensityAtCompletion: true,
      stageBefore: true,
      stageAfter: true,
    },
  });
  if (!log || log.userId !== user.id) notFound();

  const dino = await prisma.dino.findUnique({
    where: { userId: user.id },
    select: {
      name: true,
      species: true,
      stage: true,
      totalCleanEnergy: true,
    },
  });
  if (!dino) notFound();

  // 전장 → 적
  const battlefield = getBattlefield(Number(log.carbonIntensityAtCompletion));
  const enemy = ENEMY_META[battlefield];

  // before/after 역산
  const cleanEnergyAfter = dino.totalCleanEnergy;
  const cleanEnergyBefore = cleanEnergyAfter - log.cleanEnergyEarned;

  // D14: 진화 여부는 MissionLog 두 stage 비교 (새로고침해도 재현 가능)
  const evolved =
    log.stageBefore !== log.stageAfter
      ? { from: log.stageBefore, to: log.stageAfter }
      : null;

  return (
    <BattlePageClient
      dino={{
        name: dino.name,
        species: dino.species,
        stageBefore: log.stageBefore,
        stageAfter: log.stageAfter,
        cleanEnergyBefore,
        cleanEnergyAfter,
      }}
      reward={{
        cleanEnergyEarned: log.cleanEnergyEarned,
        co2ReducedKg: Number(log.co2ReducedKg),
        intimacyEarned: log.intimacyEarned,
      }}
      enemy={enemy}
      missionTitle={log.missionTitle}
      battlefieldLabel={BATTLEFIELD_LABEL[battlefield]}
      evolved={evolved}
    />
  );
}
