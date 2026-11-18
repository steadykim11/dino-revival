// 월드 상태를 쓰는 컴포넌트들의 첫 렌더링 결과를 확인한다.
// 서버가 그리는 HTML이자, 브라우저가 화면에 붙을 때 처음 만드는 결과와 같은 것이다.
// (폴링·타이머 같은 effect는 여기서 실행되지 않는다.)

import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DungeonBanner } from "@/components/dungeon/dungeon-banner";
import type { DungeonState } from "@/lib/dungeon/types";
import type { WorldStateResponse } from "@/lib/world/types";
import { CarbonClock } from "./carbon-clock";
import { useWorldState, WorldStateProvider } from "./world-state-provider";

const NOW = Date.parse("2026-11-17T07:00:00.000Z");

const NO_DUNGEON: DungeonState = { active: false, instance: null };

const activeDungeon = (remainingSec: number): DungeonState => ({
  active: true,
  instance: {
    id: "d-1",
    type: "PEAK",
    activatedAt: "2026-11-17T06:30:00.000Z",
    expiresAt: "2026-11-17T07:30:00.000Z",
    remainingSec,
    triggerReserveRate: 8.5,
    triggerCarbonIntensity: 520,
  },
});

function worldState(overrides: {
  isStale?: boolean;
  dungeon?: DungeonState;
  ts?: string;
}): WorldStateResponse {
  const fuel = {
    hydro: 0,
    oil: 0,
    coal: 0.4,
    nuclear: 0.3,
    pumped: 0,
    gas: 0.3,
    coalDomestic: 0,
    solarMarket: 0,
    wind: 0,
    renewable: 0,
    ppa: 0,
    btm: 0,
  };
  return {
    ts: overrides.ts ?? "2026-11-17T06:45:00.000Z",
    world: {
      carbonIntensity: 463.09,
      supplyReserveRate: 32.08,
      supplyCapacity: 96983,
      currentLoad: 73429,
      fuelMix: fuel,
      fuelMixPercent: fuel,
      battlefield: "NORMAL",
      isStale: overrides.isStale ?? false,
    },
    dungeon: overrides.dungeon ?? NO_DUNGEON,
    todayForecast: null,
  };
}

function render(data: WorldStateResponse | null) {
  return (
    renderToString(
      <WorldStateProvider initialData={data} initialNowMs={NOW}>
        <CarbonClock />
        <DungeonBanner />
      </WorldStateProvider>,
    )
      // React가 인접한 텍스트 사이에 넣는 구분자 — 화면에는 보이지 않는다
      .replaceAll("<!-- -->", "")
  );
}

describe("CarbonClock", () => {
  it("서버가 넘긴 첫 값을 로딩 화면 없이 바로 그린다", () => {
    const html = render(worldState({}));
    expect(html).toContain("463");
    expect(html).toContain("평범한 전장");
    expect(html).toContain("32.1%");
    expect(html).not.toContain("데이터 준비 중입니다");
  });

  it("스냅샷 시각을 서버가 넘긴 현재 시각 기준의 상대 시간으로 표시한다", () => {
    // ts 06:45, 현재 07:00 → 15분 전
    expect(render(worldState({}))).toContain("15분 전");
  });

  it("지연 상태가 아니면 지연 표시가 없다", () => {
    expect(render(worldState({ isStale: false }))).not.toContain("데이터 지연");
  });

  it("지연 상태면 '데이터 지연'을 표시한다", () => {
    expect(render(worldState({ isStale: true }))).toContain("데이터 지연");
  });

  it("스냅샷이 하나도 없으면 준비 중 화면을 그린다", () => {
    const html = render(null);
    expect(html).toContain("데이터 준비 중입니다");
    expect(html).not.toContain("463");
  });
});

describe("DungeonBanner", () => {
  it("활성 던전이 없으면 그리지 않는다", () => {
    expect(render(worldState({ dungeon: NO_DUNGEON }))).not.toContain(
      "피크 던전 발령",
    );
  });

  it("활성 던전이 있으면 배너와 남은 시간을 그린다", () => {
    const html = render(worldState({ dungeon: activeDungeon(2530) }));
    expect(html).toContain("피크 던전 발령");
    expect(html).toContain("42:10");
    expect(html).toContain('href="/dungeon"');
  });

  it("남은 시간이 0이면 그리지 않는다", () => {
    expect(render(worldState({ dungeon: activeDungeon(0) }))).not.toContain(
      "피크 던전 발령",
    );
  });

  it("스냅샷이 없으면 그리지 않는다", () => {
    expect(render(null)).not.toContain("피크 던전 발령");
  });
});

describe("useWorldState", () => {
  it("Provider 밖에서 쓰면 원인을 알려주는 오류를 던진다", () => {
    function Orphan() {
      useWorldState();
      return null;
    }
    expect(() => renderToString(<Orphan />)).toThrow(/WorldStateProvider/);
  });
});
