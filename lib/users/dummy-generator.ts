// 더미 사용자 헬퍼
//
// 75명 (15개 갤드 x 5명)
// - User row + Dino row만 생성, Supabase Auth 우회
// - 닉네임: 형용사+명사 한글 조합
// - Dino 단계·cleanEnergy: 인덱스 hash 분포 (EGG 20%, HATCHLING 50%, ADULT 30%)
// - 과거 MissionLog 5~20개를 임의 날짜·보상으로 시드

import { createHash } from "node:crypto";
import type {
  DinoStage,
  MissionCategory,
  MissionType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { calculateCo2Reduced } from "../missions/reward-calculator";

// 닉네임 풀 (20x25=500 조합)
const ADJECTIVES = [
  "느린",
  "빠른",
  "활발한",
  "조용한",
  "용감한",
  "신중한",
  "똑똑한",
  "게으른",
  "부지런한",
  "친절한",
  "까칠한",
  "명랑한",
  "차분한",
  "호기심많은",
  "졸린",
  "배고픈",
  "신난",
  "도도한",
  "수줍은",
  "엉뚱한",
] as const;

const NOUNS = [
  "오리",
  "고래",
  "다람쥐",
  "너구리",
  "햄스터",
  "거북이",
  "토끼",
  "여우",
  "두더지",
  "펭귄",
  "부엉이",
  "까치",
  "참새",
  "비둘기",
  "박쥐",
  "고양이",
  "강아지",
  "곰",
  "사슴",
  "늑대",
  "호랑이",
  "표범",
  "코끼리",
  "기린",
  "원숭이",
] as const;

function generateNickname(i: number): string {
  const adj = ADJECTIVES[i % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(i / ADJECTIVES.length) % NOUNS.length];
  return `${adj}${noun}`;
}

// UUID v4 형식 문자열
// 시드 재실행해도 같은 사용자에게 같은 ID 보장 (upsert로 idempotent)
function generateDummyUuid(i: number): string {
  const hash = createHash("sha256").update(`dino-dummy-${i}`).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    "8" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

// 인덱스 -> 0~99 정수 (분포용)
function hashPercent(i: number, salt: string): number {
  const hash = createHash("sha256").update(`${salt}-${i}`).digest("hex");
  return parseInt(hash.slice(0, 8), 16) % 100;
}

// 인덱스 -> 범위 안 정수
function hashRange(i: number, salt: string, min: number, max: number): number {
  const hash = createHash("sha256").update(`${salt}-${i}`).digest("hex");
  const span = max - min + 1;
  return min + (parseInt(hash.slice(0, 8), 16) % span);
}

// dino 단계, cleanEnergy 분포

const HATCHLING_THRESHOLD = 100;
const ADULT_THRESHOLD = 500;

interface DinoSpec {
  stage: DinoStage;
  totalCleanEnergy: number;
  intimacy: number;
  hatchedAt: Date | null;
  evolvedAt: Date | null;
}

// 인덱스 -> dino 상태 분포
// EGG 20% (0~99 클린에너지)
// HATCHLING 50% (100~499)
// ADULT 30% (500~2000)
function generateDinoSpec(i: number, createdAt: Date): DinoSpec {
  const bucket = hashPercent(i, "stage");

  if (bucket < 20) {
    // EGG
    return {
      stage: "EGG",
      totalCleanEnergy: hashRange(i, "energy-egg", 0, 99),
      intimacy: hashRange(i, "intimacy", 0, 20),
      hatchedAt: null,
      evolvedAt: null,
    };
  }
  if (bucket < 70) {
    // HATCHLING
    const hatchedDaysAgo = hashRange(i, "hatched-days", 1, 20);
    return {
      stage: "HATCHLING",
      totalCleanEnergy: hashRange(
        i,
        "energy-hatch",
        HATCHLING_THRESHOLD,
        ADULT_THRESHOLD - 1,
      ),
      intimacy: hashRange(i, "intimacy", 10, 60),
      hatchedAt: daysAgo(createdAt, hatchedDaysAgo),
      evolvedAt: null,
    };
  }
  // ADULT
  const hatchedDaysAgo = hashRange(i, "hatched-days", 10, 25);
  const evolvedDaysAgo = hashRange(i, "evolved-days", 1, hatchedDaysAgo - 1);
  return {
    stage: "ADULT",
    totalCleanEnergy: hashRange(i, "energy-adult", ADULT_THRESHOLD, 2000),
    intimacy: hashRange(i, "intimacy", 40, 100),
    hatchedAt: daysAgo(createdAt, hatchedDaysAgo),
    evolvedAt: daysAgo(createdAt, evolvedDaysAgo),
  };
}

function daysAgo(reference: Date, days: number): Date {
  const d = new Date(reference);
  d.setDate(d.getDate() - days);
  return d;
}

// 과거 MissionLog 생성
interface MissionLogSeed {
  userId: string;
  /** 더미 로그는 실제 Mission 행이 없다 */
  missionId: null;
  missionTitle: string;
  missionType: MissionType;
  missionCategory: MissionCategory;
  carbonIntensityAtCompletion: number;
  cleanEnergyEarned: number;
  co2ReducedKg: number;
  intimacyEarned: number;
  stageBefore: DinoStage;
  stageAfter: DinoStage;
  completedAt: Date;
}

export interface MissionPoolEntry {
  id: string;
  title: string;
  category: MissionCategory;
  baseReward: number;
  estimatedKwh: number;
}

// generateMissionLogs 시그니처에 pool 추가
function generateMissionLogs(
  userId: string,
  i: number,
  dinoSpec: DinoSpec,
  pool: MissionPoolEntry[],
  now: Date,
): MissionLogSeed[] {
  const count =
    dinoSpec.stage === "EGG"
      ? hashRange(i, "log-count-egg", 0, 5)
      : dinoSpec.stage === "HATCHLING"
        ? hashRange(i, "log-count-hatch", 5, 15)
        : hashRange(i, "log-count-adult", 10, 20);

  const logs: MissionLogSeed[] = [];
  for (let j = 0; j < count; j++) {
    // pool에서 하나 선택
    const poolIdx = hashRange(i * 100 + j, "pool-pick", 0, pool.length - 1);
    const picked = pool[poolIdx];

    // 시점: 1~21일 전 사이
    const daysOld = hashRange(i * 100 + j, "days", 1, 21);
    const hours = hashRange(i * 100 + j, "hours", 0, 23);
    const completedAt = new Date(now);
    completedAt.setDate(completedAt.getDate() - daysOld);
    completedAt.setHours(hours, 0, 0, 0);

    // 보상: 실제 baseReward + 약간의 변동
    const cleanEnergyEarned =
      picked.baseReward + hashRange(i * 100 + j, "reward-jitter", -3, 5);
    const co2ReducedKg = calculateCo2Reduced(picked.estimatedKwh);

    logs.push({
      userId,
      missionId: null,
      missionTitle: picked.title,
      missionType: "DAILY",
      missionCategory: picked.category,
      carbonIntensityAtCompletion: hashRange(i * 100 + j, "carbon", 250, 600),
      cleanEnergyEarned: Math.max(1, cleanEnergyEarned),
      co2ReducedKg,
      intimacyEarned: 1,
      stageBefore: dinoSpec.stage,
      stageAfter: dinoSpec.stage,
      completedAt,
    });
  }

  return logs;
}

// 공개 API - 시드 스크립트가 호출
export interface DummyUserSpec {
  id: string;
  nickname: string;
  regionCode: string;
  guildId: string;
  isDummy: true;
  createdAt: Date;
  dino: {
    name: string;
    species: "TYRANNO";
    stage: DinoStage;
    totalCleanEnergy: number;
    intimacy: number;
    hatchedAt: Date | null;
    evolvedAt: Date | null;
  };
  missionLogs: MissionLogSeed[];
}

export interface GenerateDummiesParams {
  guilds: { id: string; regionCode: string }[];
  /** MissionPool 항목들 (시드 스크립트가 미리 조회해서 전달) */
  pool: MissionPoolEntry[];
  perGuild?: number;
  now?: Date;
}

// 75명 더미 사용자 spec 생성
export function generateDummyUsers(
  params: GenerateDummiesParams,
): DummyUserSpec[] {
  const { guilds, pool, perGuild = 5, now = new Date() } = params;

  if (pool.length === 0) {
    throw new Error(
      "MissionPool이 비어 있습니다. seedMissionPool이 먼저 실행되어야 함",
    );
  }

  const specs: DummyUserSpec[] = [];
  let i = 0;

  for (const guild of guilds) {
    for (let n = 0; n < perGuild; n++) {
      const id = generateDummyUuid(i);
      const nickname = generateNickname(i);
      const createdAt = daysAgo(now, hashRange(i, "created-days", 5, 30));
      const dinoSpec = generateDinoSpec(i, createdAt);
      const missionLogs = generateMissionLogs(id, i, dinoSpec, pool, now);

      specs.push({
        id,
        nickname,
        regionCode: guild.regionCode,
        guildId: guild.id,
        isDummy: true,
        createdAt,
        dino: {
          name: `더미-${nickname}`,
          species: "TYRANNO",
          ...dinoSpec,
        },
        missionLogs,
      });

      i++;
    }
  }

  return specs;
}
