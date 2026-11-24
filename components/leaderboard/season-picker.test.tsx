import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { SeasonPicker } from "./season-picker";
import { leaderboardHref } from "./href";

const SEASONS = ["2026-11", "2026-10", "2026-09"];

/** 렌더링 결과에서 (라벨, href, 선택 여부) 목록을 뽑는다 */
function links(html: string) {
  return [...html.matchAll(/<a ([^>]*)>([^<]+)<\/a>/g)].map(([, attrs, label]) => ({
    href: (attrs.match(/href="([^"]+)"/)?.[1] ?? "").replaceAll("&amp;", "&"),
    label,
    active: attrs.includes('aria-current="page"'),
  }));
}

describe("leaderboardHref", () => {
  it("이번 시즌이면 season을 생략하고, 아니면 붙인다", () => {
    expect(leaderboardHref("local", null)).toBe("/leaderboard?tab=local");
    expect(leaderboardHref("global", "2026-10")).toBe("/leaderboard?tab=global&season=2026-10");
    expect(leaderboardHref("local", "all")).toBe("/leaderboard?tab=local&season=all");
  });
});

describe("SeasonPicker", () => {
  it("이번 시즌 · 지난 시즌 · 역대 누적 순으로, 현재 탭을 유지한 링크를 만든다", () => {
    const html = renderToString(
      <SeasonPicker seasons={SEASONS} active={{ kind: "season", season: "2026-10" }} tab="global" />,
    );
    expect(links(html)).toEqual([
      { label: "이번 시즌 (11월)", href: "/leaderboard?tab=global", active: false },
      { label: "10월", href: "/leaderboard?tab=global&season=2026-10", active: true },
      { label: "9월", href: "/leaderboard?tab=global&season=2026-09", active: false },
      { label: "역대 누적", href: "/leaderboard?tab=global&season=all", active: false },
    ]);
  });

  it("역대 누적을 고르면 그 항목만 선택된다", () => {
    const html = renderToString(
      <SeasonPicker seasons={["2026-11"]} active={{ kind: "all" }} tab="local" />,
    );
    expect(links(html).filter((l) => l.active).map((l) => l.label)).toEqual(["역대 누적"]);
  });
});
