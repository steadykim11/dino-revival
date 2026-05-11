import { CarbonClock } from "@/components/world/carbon-clock";

export default function HomePage() {
  return (
    <>
      {/* 1. 탄소 시계 */}
      <CarbonClock />

      {/* 2. 던전 배너 — D18 */}
      <div className="mt-3 rounded-2xl border border-dashed border-stone-300 p-4 text-center text-xs text-stone-400">
        피크 던전 배너 (D18)
      </div>

      {/* 3. 공룡 영역 — D10·D14 */}
      <div className="mt-3 rounded-2xl border border-dashed border-stone-300 p-10 text-center text-xs text-stone-400">
        공룡 영역 (D10·D14)
      </div>

      {/* 4. 미션 바텀시트 자리 — D11·D12 */}
      <div className="mt-3 rounded-2xl border border-dashed border-stone-300 p-6 text-center text-xs text-stone-400">
        오늘의 미션 (D11·D12)
      </div>
    </>
  );
}
