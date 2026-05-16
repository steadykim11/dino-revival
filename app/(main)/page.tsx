import { CarbonClock } from "@/components/world/carbon-clock";
import { PageHeader } from "@/components/layout/page-header";
import { createServerSupabase } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { DinoSection } from "@/components/dino/dino-section";
import { MissionsSection } from "@/components/missions/missions-section";

export default async function HomePage() {
  // layout 가드 통과 후라 user·dino 존재 보장.
  // 다만 타입 안전성 위해 한 번 더 조회 (Server Component는 가볍게 호출 가능).
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const dino = user
    ? await prisma.dino.findUnique({
      where: { userId: user.id },
      select: {
        name: true,
        species: true,
        stage: true,
        totalCleanEnergy: true,
      },
    })
    : null;

  return (
    <>
      <PageHeader title="홈" />

      <div className="px-4 pt-1">
        {/* 1. 탄소 시계 */}
        <CarbonClock />

        {/* 2. 던전 배너 — D18 */}
        <div className="mt-3 rounded-2xl border border-dashed border-stone-300 p-4 text-center text-xs text-stone-400">
          피크 던전 배너 (D18)
        </div>

        {/* 3. 공룡 영역 — D10·D14 */}
        {dino && (
          <div className="mt-3">
            <DinoSection
              name={dino.name}
              species={dino.species}
              stage={dino.stage}
              totalCleanEnergy={dino.totalCleanEnergy}
            />
          </div>
        )}

        {/* 4. 미션 바텀시트 자리 — D11·D12 */}
        <MissionsSection />
      </div>
    </>
  );
}
