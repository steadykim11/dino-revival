import { defineConfig, globalIgnores } from "eslint/config";
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = defineConfig([
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),

  // 구조 규칙 1 (AGENTS.md): DB 접근은 lib/ 안에서만.
  // app/과 components/는 prisma를 직접 쓰지 않고 lib의 *.server.ts 함수를 호출한다.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "DB 접근은 lib/**/*.server.ts 안에서만 합니다. lib의 함수를 호출하세요.",
            },
          ],
        },
      ],
    },
  },

  // components/는 클라이언트 번들에 들어갈 수 있으므로 서버 전용 파일을
  // 값으로 import하지 않는다 (타입 import는 허용). 데이터는 props로 받는다.
  {
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/prisma",
              message:
                "DB 접근은 lib/**/*.server.ts 안에서만 합니다. lib의 함수를 호출하세요.",
            },
            {
              name: "@prisma/client",
              message:
                "UI는 Prisma 타입 대신 도메인 타입(lib/dino/types.ts, lib/missions/types.ts 등)을 씁니다.",
            },
          ],
          patterns: [
            {
              group: ["**/*.server"],
              allowTypeImports: true,
              message:
                "*.server.ts는 서버 전용입니다. 컴포넌트는 데이터를 props로 받으세요.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
