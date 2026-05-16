import { Prisma, type PrismaClient } from "@prisma/client";

type SeedMission = {
  title: string;
  description: string;
  category:
    | "COOLING"
    | "HEATING"
    | "LIGHTING"
    | "STANDBY"
    | "LAUNDRY"
    | "KITCHEN"
    | "ETC";
  timeSlot: "DAY" | "EVENING" | "ANYTIME";
  baseReward: number;
  estimatedKwh: string; // Decimal -> 문자열로 전달
};

const MISSIONS: readonly SeedMission[] = [
  // COOLING (냉방)
  {
    title: "에어컨 1℃ 올리기",
    description:
      "여름철 에어컨 설정 온도를 1℃ 올려보세요. 7~10% 절전 효과가 있어요.",
    category: "COOLING",
    timeSlot: "DAY",
    baseReward: 60,
    estimatedKwh: "0.500",
  },
  {
    title: "선풍기 병행 사용",
    description: "에어컨과 선풍기를 함께 써서 설정 온도를 높여보세요.",
    category: "COOLING",
    timeSlot: "DAY",
    baseReward: 50,
    estimatedKwh: "0.400",
  },

  // HEATING (난방)
  {
    title: "난방 1℃ 내리기",
    description: "겨울철 난방 설정 온도를 1℃ 내려보세요.",
    category: "HEATING",
    timeSlot: "EVENING",
    baseReward: 60,
    estimatedKwh: "0.700",
  },
  {
    title: "실내복 입기",
    description: "집에서 한 겹 더 입고 난방을 줄여주세요.",
    category: "HEATING",
    timeSlot: "ANYTIME",
    baseReward: 40,
    estimatedKwh: "0.500",
  },

  // LIGHTING (조명)
  {
    title: "자연광 활용",
    description: "낮 시간엔 커튼을 열고 형광등을 꺼주세요.",
    category: "LIGHTING",
    timeSlot: "DAY",
    baseReward: 30,
    estimatedKwh: "0.150",
  },
  {
    title: "필요한 곳만 켜기",
    description: "저녁에 사용하지 않는 방의 조명을 모두 꺼주세요.",
    category: "LIGHTING",
    timeSlot: "EVENING",
    baseReward: 35,
    estimatedKwh: "0.200",
  },
  {
    title: "LED 교체 인증",
    description: "집안 조명 1개를 LED로 교체했다면 완료!",
    category: "LIGHTING",
    timeSlot: "ANYTIME",
    baseReward: 80,
    estimatedKwh: "0.300",
  },

  // STANDBY (대기전력)
  {
    title: "플러그 뽑기",
    description: "오늘 사용하지 않는 가전제품 3개의 플러그를 뽑아주세요.",
    category: "STANDBY",
    timeSlot: "EVENING",
    baseReward: 50,
    estimatedKwh: "0.250",
  },
  {
    title: "멀티탭 스위치 OFF",
    description: "외출 전 멀티탭 스위치를 모두 꺼주세요.",
    category: "STANDBY",
    timeSlot: "ANYTIME",
    baseReward: 40,
    estimatedKwh: "0.200",
  },

  // LAUNDRY (세탁)
  {
    title: "찬물 세탁",
    description: "오늘 세탁은 찬물로! 온수 가열 에너지를 아낄 수 있어요.",
    category: "LAUNDRY",
    timeSlot: "ANYTIME",
    baseReward: 45,
    estimatedKwh: "0.600",
  },
  {
    title: "건조기 자연건조 대체",
    description: "오늘 한 번은 빨래를 자연건조해보세요.",
    category: "LAUNDRY",
    timeSlot: "ANYTIME",
    baseReward: 55,
    estimatedKwh: "1.500",
  },

  // KITCHEN (주방)
  {
    title: "냉장고 정리",
    description: "냉장고 안을 정리해 냉기 순환을 원활하게 만들어주세요.",
    category: "KITCHEN",
    timeSlot: "EVENING",
    baseReward: 35,
    estimatedKwh: "0.300",
  },
  {
    title: "전기밥솥 보온 끄기",
    description: "식사 후 전기밥솥의 보온 기능을 꺼주세요.",
    category: "KITCHEN",
    timeSlot: "EVENING",
    baseReward: 40,
    estimatedKwh: "0.400",
  },

  // ETC (기타)
  {
    title: "대중교통 이용",
    description: "오늘 한 번 이상 대중교통을 이용해주세요.",
    category: "ETC",
    timeSlot: "DAY",
    baseReward: 70,
    estimatedKwh: "0.000",
  },
  {
    title: "전력 사용 확인",
    description: "한전 앱에서 오늘 전력 사용량을 확인해주세요.",
    category: "ETC",
    timeSlot: "ANYTIME",
    baseReward: 20,
    estimatedKwh: "0.050",
  },
];

export async function seedMissionPool(prisma: PrismaClient) {
  console.log(`  Seeding mission pool (${MISSIONS.length} missions)...`);

  // 기존 풀 비우고 새로 (idempotent)
  // D11 이후: 발급된 Mission이 poolId를 FK로 참조한다.
  // deleteMany 시 onDelete: Restrict이라 FK 위반 발생.
  // 두 가지 전략 중 선택:
  //   1) 풀이 비어있을 때만 createMany (idempotent — 운영용 안전)
  //   2) Mission 전체를 먼저 비우고 풀 재시드 (개발 리셋용)
  // 일단 1번으로 진행. 풀 수정이 필요하면 개별 update 또는 별도 마이그레이션.
  const existing = await prisma.missionPool.count();
  if (existing > 0) {
    console.log(`  ↳ pool already seeded (${existing}). skip.`);
    return;
  }

  await prisma.missionPool.createMany({
    data: MISSIONS.map((m) => ({
      title: m.title,
      description: m.description,
      category: m.category,
      timeSlot: m.timeSlot,
      baseReward: m.baseReward,
      estimatedKwh: new Prisma.Decimal(m.estimatedKwh),
      isActive: true,
    })),
  });

  const count = await prisma.missionPool.count();
  console.log(`  ✓ ${count} missions in pool`);
}
