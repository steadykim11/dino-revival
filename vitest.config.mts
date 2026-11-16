import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // tsconfig의 "@/*" → 프로젝트 루트
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "prisma/**/*.test.ts"],
    // lib/env.ts가 모듈 로드 시점에 KPX_API_KEY를 검증하므로 더미 값 주입.
    // 테스트는 외부 API·DB를 호출하지 않는다.
    env: { KPX_API_KEY: "test-key" },
  },
});
