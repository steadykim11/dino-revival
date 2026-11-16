import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // tsconfig의 "@/*" → 프로젝트 루트
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    // 테스트는 외부 API·DB를 호출하지 않는다.
    include: ["lib/**/*.test.ts", "prisma/**/*.test.ts"],
  },
});
