import { CarbonClock } from "@/components/world/carbon-clock";
import { PageHeader } from "@/components/layout/page-header";
import { requireSession } from "@/lib/auth/session.server";
import { getDino } from "@/lib/dino/dino.server";
import { DinoSection } from "@/components/dino/dino-section";
import { MissionsSection } from "@/components/missions/missions-section";
import { DungeonBanner } from "@/components/dungeon/dungeon-banner";

export default async function HomePage() {
  const me = await requireSession();
  const dino = await getDino(me.id);

  return (
    <>
      <PageHeader title="홈" />

      <div className="px-4 pt-1">
        {/* 1. 탄소 시계 */}
        <CarbonClock />

        {/* 2. 던전 배너 — D18 */}
        <DungeonBanner />

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
