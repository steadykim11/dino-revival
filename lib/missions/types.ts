// 미션 도메인 타입. UI·순수 로직은 @prisma/client 대신 이 파일을 쓴다.
// 값 목록이 Prisma enum과 어긋나면 아래 타입 검사가 컴파일 에러를 낸다.

import type {
  MissionCategory as PrismaMissionCategory,
  MissionTimeSlot as PrismaMissionTimeSlot,
  MissionType as PrismaMissionType,
} from "@prisma/client";
import type { AssertSameUnion, Expect } from "@/lib/types-check";

export type MissionType = "DAILY" | "DUNGEON";
export type MissionTimeSlot = "DAY" | "EVENING" | "ANYTIME";
export type MissionCategory =
  | "COOLING"
  | "HEATING"
  | "LIGHTING"
  | "STANDBY"
  | "LAUNDRY"
  | "KITCHEN"
  | "ETC";

/** 화면에 표시하는 미션 한 건 (홈 미션 시트·던전 페이지 공용) */
export interface MissionItem {
  id: string;
  title: string;
  description: string;
  category: MissionCategory;
  timeSlot: MissionTimeSlot;
  type: MissionType;
  baseReward: number;
  estimatedKwh: string;
  completedAt: string | null;
}

export type _MissionTypeMatchesPrisma = Expect<AssertSameUnion<MissionType, PrismaMissionType>>;
export type _TimeSlotMatchesPrisma = Expect<AssertSameUnion<MissionTimeSlot, PrismaMissionTimeSlot>>;
export type _CategoryMatchesPrisma = Expect<AssertSameUnion<MissionCategory, PrismaMissionCategory>>;
