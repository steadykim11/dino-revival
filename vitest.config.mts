import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // tsconfig의 "@/*" → 프로젝트 루트
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  // tsconfig의 jsx는 Next가 요구하는 "preserve"라 여기서 따로 변환을 켠다 (테스트 전용)
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    // 테스트는 외부 API·DB를 호출하지 않는다.
    include: [
      "lib/**/*.test.ts",
      "prisma/**/*.test.ts",
      "components/**/*.test.tsx",
      "*.test.ts",
    ],
  },
});
