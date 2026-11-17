import { CarbonClock } from "@/components/world/carbon-clock";
import { WorldStateProvider } from "@/components/world/world-state-provider";
import { PageHeader } from "@/components/layout/page-header";
import { requireSession } from "@/lib/auth/session.server";
import { getDino } from "@/lib/dino/dino.server";
import { readWorldState } from "@/lib/world/snapshot-reader.server";
import { DinoSection } from "@/components/dino/dino-section";
import { MissionsSection } from "@/components/missions/missions-section";
import { DungeonBanner } from "@/components/dungeon/dungeon-banner";

export default async function HomePage() {
  const me = await requireSession();
  const [dino, worldState] = await Promise.all([
    getDino(me.id),
    readWorldState(),
  ]);

  return (
    <>
      <PageHeader title="홈" />

      {/* 월드 상태의 첫 값은 여기서 읽어 넘기고, 이후 갱신은 Provider가 맡는다 */}
      <WorldStateProvider initialData={worldState} initialNowMs={Date.now()}>
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
      </WorldStateProvider>
    </>
  );
}
