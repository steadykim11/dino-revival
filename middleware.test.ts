import { describe, expect, it } from "vitest";
import { config } from "./middleware";

// Next의 matcher는 경로 전체에 대한 정규식으로 해석된다.
const matcher = new RegExp(`^${config.matcher[0]}$`);
const runsOn = (path: string) => matcher.test(path);

describe("middleware matcher", () => {
  it.each([
    "/",
    "/landing",
    "/signin",
    "/dungeon",
    "/battle/123e4567-e89b-12d3-a456-426614174000",
    "/admin",
    "/api/me",
    "/api/missions/today",
    "/api/missions/complete",
    "/api/auth/signin",
    "/api/admin/dino",
  ])("세션이 필요한 경로에서는 실행된다: %s", (path) => {
    expect(runsOn(path)).toBe(true);
  });

  it.each([
    "/api/world/state",
    "/api/health",
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
    "/images/dino/tyranno-egg.png",
    "/logo.svg",
  ])("공개 API와 정적 자원에서는 실행되지 않는다: %s", (path) => {
    expect(runsOn(path)).toBe(false);
  });

  it("비슷한 이름의 다른 API는 제외하지 않는다", () => {
    expect(runsOn("/api/worlds")).toBe(true);
    expect(runsOn("/api/me/world/state")).toBe(true);
  });
});
