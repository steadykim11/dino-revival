import { prisma } from "@/lib/prisma";

/** DB 연결 확인 (헬스 체크용). 실패하면 throw. */
export async function pingDb(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}
