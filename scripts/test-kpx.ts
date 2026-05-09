/**
 * KPX API 동작 확인용. 일회성 실행.
 *   pnpm tsx scripts/test-kpx.ts
 */

import { fetchWorldSnapshot } from "../lib/external/kpx";
import { fetchKpxD1 } from "../lib/external/kpx-d1";
import { fetchKpxD2 } from "../lib/external/kpx-d2";

async function main() {
  // console.log("━━━ KPX D1 (실시간 전력수급) ━━━");
  // try {
  //   const d1 = await fetchKpxD1();
  //   console.log(JSON.stringify(d1, null, 2));
  // } catch (e) {
  //   console.error("D1 실패:", e);
  // }

  // console.log("\n━━━ KPX D2 (발전원별) ━━━");
  // try {
  //   const d2 = await fetchKpxD2();
  //   console.log(JSON.stringify(d2, null, 2));
  // } catch (e) {
  //   console.error("D2 실패:", e);
  // }

  console.log("\n━━━ 통합 WorldSnapshot ━━━");
  try {
    const snap = await fetchWorldSnapshot();
    console.log(JSON.stringify(snap, null, 2));
    console.log(`\n→ 탄소강도: ${snap.carbonIntensity} gCO2/kWh`);
    console.log(`→ 예비율: ${snap.supplyReserveRate}%`);
    console.log(`→ 부하/공급: ${snap.currentLoad}/${snap.supplyCapacity} MW`);
  } catch (e) {
    console.error("통합 실패:", e);
  }
}

main().then(() => process.exit(0));
