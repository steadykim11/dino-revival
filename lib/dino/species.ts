// 공룡 종(species) 메타데이터 - UI에서 쓸 정보
//
// species → 디폴트 이름·색상·잠금 여부 매핑
// - SC-04 알 선택: lockedReason으로 잠금 카드 표시
// - SC-04b 이름 짓기: defaultName으로 input 초기값
// - SC-05 메인: color로 dino-display 배경·테마

import { DinoSpecies } from "@prisma/client";

export interface SpeciesMeta {
  /** 표시명 (예: "티라노 계열") */
  displayName: string;
  /** 짧은 설명 (와이어프레임 SC-04 설명 박스) */
  description: string;
  /** 부화 시 디폴트 이름 (사용자가 직접 변경 가능) */
  defaultName: string;
  /** 알 색상 키 — 'red' | 'blue' | 'green' */
  color: SpeciesColor;
  /** MVP에서 선택 가능한지 */
  isAvailable: boolean;
  /** 잠금된 경우 사유 라벨 */
  lockedReason?: string;
}

export type SpeciesColor = "red" | "blue" | "green";

export const SPECIES_META: Record<DinoSpecies, SpeciesMeta> = {
  TYRANNO: {
    displayName: "티라노 계열",
    description: "피크 시간대 감축 시 강해지는 영웅형 공룡. 던전 전투에 특화.",
    defaultName: "라프토라",
    color: "red",
    isAvailable: true,
  },
  BRACHIO: {
    displayName: "용각류",
    description: "꾸준한 절약에 강한 지구력형. Phase 2에 등장 예정.",
    defaultName: "발라사우라",
    color: "blue",
    isAvailable: false,
    lockedReason: "곧 출시",
  },
  TRICERA: {
    displayName: "각룡류",
    description: "동네 길드 협력에 보너스를 주는 사회형. Phase 2에 등장 예정.",
    defaultName: "트리코",
    color: "green",
    isAvailable: false,
    lockedReason: "곧 출시",
  },
};

/**
 * MVP에서 선택 가능한 종 목록
 * SC-04 카드 렌더링에 사용 (잠금 카드도 표시해야 하므로 전체 목록 + isAvailable 필터링)
 */
export const ALL_SPECIES = Object.keys(SPECIES_META) as DinoSpecies[];

/**
 * 색상 키 → Tailwind 클래스 매핑 (필요시)
 * SVG fill·배경 등 분기에 쓰일 수 있음
 */
export const SPECIES_COLOR_HEX: Record<SpeciesColor, string> = {
  red: "#e07a5f", // 따뜻한 vermillion
  blue: "#81a4cd", // 차분한 cornflower
  green: "#81b29a", // 부드러운 sage
};
