import { PrismaClient } from "@prisma/client";
import { seedMissionPool } from "./seeds/mission-pool";
import { seedGuilds } from "./seeds/guilds";
import { seedDummyUsers } from "./seeds/dummy-users";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding...");

  await seedMissionPool(prisma);
  await seedGuilds(prisma);
  await seedDummyUsers(prisma);

  // 환경부 배출계수는 코드 상수(D9)이므로 시드 불필요

  console.log("✅ Seeding complete");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
