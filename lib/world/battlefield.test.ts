import { describe, expect, it } from "vitest";
import { getBattlefield } from "@/lib/missions/reward-calculator";
import { battlefieldLabel, classifyBattlefield } from "./battlefield";

describe("classifyBattlefield", () => {
  it.each([
    [299.99, "PURIFIED"],
    [300, "NORMAL"],
    [499.99, "NORMAL"],
    [500, "POLLUTED"],
  ] as const)("탄소강도 %d → %s", (ci, expected) => {
    expect(classifyBattlefield(ci)).toBe(expected);
  });

  // 임계값(300/500)이 reward-calculator.ts와 이 파일에 중복 정의되어 있다.
  // 한쪽만 바뀌면 화면의 전장 표시와 실제 보상 가중치가 어긋나므로,
  // 두 구현이 하나로 합쳐질 때까지 이 테스트가 일치를 보장한다.
  it("reward-calculator의 getBattlefield와 항상 같은 결과", () => {
    for (let ci = 0; ci <= 1000; ci += 0.5) {
      expect(classifyBattlefield(ci)).toBe(getBattlefield(ci));
    }
  });
});

describe("battlefieldLabel", () => {
  it("한글 라벨", () => {
    expect(battlefieldLabel("PURIFIED")).toBe("정화된 전장");
    expect(battlefieldLabel("NORMAL")).toBe("평범한 전장");
    expect(battlefieldLabel("POLLUTED")).toBe("오염된 전장");
  });
});
