// 전투 결과 페이지. 컷씬(2.5초) → 결과 표시 두 단계를 한 페이지에서 phase 전환
//
// MissionLog에서 필요한 데이터 로드:
//   - 보상 내역 (cleanEnergyEarned, co2ReducedKg, intimacyEarned)
//   - 탄소강도 (carbonIntensityAtCompletion) → 전장 → 적 결정
//   - 미션 카테고리·타입 등은 표시용 옵션
//
// Dino 현재 상태도 조회.
// 진척도 바의 "before/after" 표시를 위해 cleanEnergyBefore = totalCleanEnergy - cleanEnergyEarned 로 역산

import { notFound, redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { getBattlefield } from "@/lib/missions/reward-calculator";
import { ENEMY_META } from "@/lib/battle/enemy-types";
import { BattlePageClient } from "@/components/battle/battle-page-client";

interface PageProps {
  params: Promise<{ missionLogId: string }>;
}

export default async function BattlePage({ params }: PageProps) {
  const { missionLogId } = await params;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const log = await prisma.missionLog.findUnique({
    where: { id: missionLogId },
    select: {
      userId: true,
      missionTitle: true,
      cleanEnergyEarned: true,
      co2ReducedKg: true,
      intimacyEarned: true,
      carbonIntensityAtCompletion: true,
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

  // before/after 역산. 진화로 단계가 바뀐 경우에도 cleanEnergy 자체는 동일하게 차감
  const cleanEnergyAfter = dino.totalCleanEnergy;
  const cleanEnergyBefore = cleanEnergyAfter - log.cleanEnergyEarned;

  return (
    <BattlePageClient
      dino={{
        name: dino.name,
        species: dino.species,
        stageBefore: dino.stage, // 진화 직후라도 결과 화면에선 현재 단계 표시
        stageAfter: dino.stage,
        cleanEnergyBefore,
        cleanEnergyAfter,
      }}
      reward={{
        cleanEnergyEarned: log.cleanEnergyEarned,
        co2ReducedKg: Number(log.co2ReducedKg),
        intimacyEarned: log.intimacyEarned,
      }}
      enemy={enemy}
    />
  );
}