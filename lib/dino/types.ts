// 공룡 도메인 타입. UI·순수 로직은 @prisma/client 대신 이 파일을 쓴다.
//
// 값 목록은 Prisma 스키마의 enum과 같아야 한다. 아래 타입 검사가 어긋나면
// 컴파일 에러로 알려준다 (Prisma 쪽 import는 타입 전용이라 번들에 들어가지 않는다).

import type {
  DinoSpecies as PrismaDinoSpecies,
  DinoStage as PrismaDinoStage,
} from "@prisma/client";
import type { AssertSameUnion, Expect } from "@/lib/types-check";

export const DINO_SPECIES = ["TYRANNO", "BRACHIO", "TRICERA"] as const;
export type DinoSpecies = (typeof DINO_SPECIES)[number];

export const DINO_STAGES = ["EGG", "HATCHLING", "ADULT"] as const;
export type DinoStage = (typeof DINO_STAGES)[number];

export function isDinoSpecies(value: unknown): value is DinoSpecies {
  return (DINO_SPECIES as readonly unknown[]).includes(value);
}

// Prisma enum과 일치하는지 컴파일 타임 검사
export type _SpeciesMatchesPrisma = Expect<AssertSameUnion<DinoSpecies, PrismaDinoSpecies>>;
export type _StageMatchesPrisma = Expect<AssertSameUnion<DinoStage, PrismaDinoStage>>;
