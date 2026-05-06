import type { PrismaClient } from "@prisma/client";

/**
 * 행정안전부 행정표준코드 — 시·군·구 5자리.
 * 출처: https://www.code.go.kr (행정표준코드 관리시스템)
 */

const REGIONS: readonly { code: string; displayName: string }[] = [
  // 서울 (11***)
  { code: "11680", displayName: "강남구" },
  { code: "11650", displayName: "서초구" },
  { code: "11710", displayName: "송파구" },
  { code: "11440", displayName: "마포구" },
  { code: "11170", displayName: "용산구" },
  { code: "11110", displayName: "종로구" },
  { code: "11560", displayName: "영등포구" },
  { code: "11200", displayName: "성동구" },

  // 경기 (41***)
  { code: "41135", displayName: "성남시 분당구" },
  { code: "41117", displayName: "수원시 영통구" },
  { code: "41285", displayName: "고양시 일산동구" },
  { code: "41465", displayName: "용인시 수지구" },

  // 광역시
  { code: "26350", displayName: "해운대구" }, // 부산
  { code: "28185", displayName: "연수구" }, // 인천
  { code: "30200", displayName: "유성구" }, // 대전
];

export async function seedGuilds(prisma: PrismaClient) {
  console.log(`  Seeding guilds (${REGIONS.length} regions)...`);

  for (const r of REGIONS) {
    await prisma.guild.upsert({
      where: { regionCode: r.code },
      create: {
        regionCode: r.code,
        displayName: r.displayName,
        seasonScore: 0,
      },
      update: {
        displayName: r.displayName,
      },
    });
  }

  const count = await prisma.guild.count();
  console.log(`  ✓ ${count} guilds`);
}
