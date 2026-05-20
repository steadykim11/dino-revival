// 관리자 패널 (SC-13) — 시연 컨트롤
//
// - /admin 경로, (main) 그룹 외부
// - notFound() 가드: ADMIN_USER_IDS에 없으면 404 (페이지 존재 자체를 숨김)
// - PageHeader·BottomTabBar·SideNav를 직접 import (D6의 (main) layout 재현하되,
//   Dino 가드는 제외 — 관리자는 dino 없어도 페이지 진입 가능해야 시연 컨트롤 의미)
// - 4개 블록을 클라이언트 컴포넌트로 분리 (각자 fetch 호출)

import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { isAdminUserId } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { getCurrentActiveDungeon } from "@/lib/dungeon/lifecycle";
import { PageHeader } from "@/components/layout/page-header";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { SideNav } from "@/components/layout/side-nav";
import { DungeonControl } from "@/components/admin/dungeon-control";
import { DinoControl } from "@/components/admin/dino-control";
import { MissionsRegenerate } from "@/components/admin/missions-regenerate";
import { SnapshotsMonitor } from "@/components/admin/snapshots-monitor";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // 1) 가드
  const ctx = await requireUser();
  if (!isAdminUserId(ctx.user.id)) {
    notFound();
  }

  // 2) 병렬 데이터 패치
  const [activeDungeon, dino, snapshots] = await Promise.all([
    getCurrentActiveDungeon(prisma),
    prisma.dino.findUnique({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        name: true,
        stage: true,
        totalCleanEnergy: true,
        hatchedAt: true,
        evolvedAt: true,
      },
    }),
    prisma.worldSnapshot.findMany({
      orderBy: { ts: "desc" },
      take: 5,
      select: {
        ts: true,
        carbonIntensity: true,
        supplyReserveRate: true,
        currentLoad: true,
        isFallback: true,
      },
    }),
  ]);

  return (
    <>
      <PageHeader title="관리자 패널" />

      <main className="mx-auto w-full max-w-[420px] px-4 pb-20 pt-4 lg:pb-4">
        <p className="mb-6 text-xs text-stone-500">
          시연 컨트롤 — /admin 직접 접근, 화이트리스트 한정
        </p>

        <div className="space-y-6">
          <Section title="시연 컨트롤" description="피크 던전 발령·종료">
            <DungeonControl
              initialDungeon={
                activeDungeon
                  ? {
                      id: activeDungeon.id,
                      activatedAt: activeDungeon.activatedAt.toISOString(),
                      expiresAt: activeDungeon.expiresAt.toISOString(),
                    }
                  : null
              }
            />
          </Section>

          <Section
            title="공룡 조작"
            description="본인 공룡 단계 및 누적 클린에너지"
          >
            {dino ? (
              <DinoControl
                initialDino={{
                  name: dino.name,
                  stage: dino.stage,
                  totalCleanEnergy: dino.totalCleanEnergy,
                }}
              />
            ) : (
              <p className="text-xs text-stone-500">
                공룡이 없습니다. 온보딩 완료 후 사용 가능.
              </p>
            )}
          </Section>

          <Section title="미션 조작" description="오늘 일일 미션 재생성">
            <MissionsRegenerate />
          </Section>

          <Section title="데이터 모니터" description="최신 world_snapshot 5개">
            <SnapshotsMonitor
              snapshots={snapshots.map((s) => ({
                ts: s.ts.toISOString(),
                carbonIntensity: Number(s.carbonIntensity),
                supplyReserveRate: Number(s.supplyReserveRate),
                currentLoad: s.currentLoad,
                isFallback: s.isFallback,
              }))}
            />
          </Section>
        </div>
      </main>

      <BottomTabBar />
      <SideNav />
    </>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-stone-500">{description}</p>
      {children}
    </section>
  );
}
