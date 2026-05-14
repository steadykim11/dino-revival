import type { PrismaClient } from "@prisma/client";
import { REGIONS } from "../../lib/static-data/regions";

// 동네 길드 시드
// 동네 선택지(SC-03 select)와 길드 1:1 매칭

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
