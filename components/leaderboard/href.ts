// 리더보드 URL. 탭(?tab=)과 시즌(?season=)을 함께 유지한다.

export type LeaderboardTab = "local" | "global";

/** seasonParam이 null이면 이번 시즌 (lib/guilds/season.ts의 periodParam) */
export function leaderboardHref(tab: LeaderboardTab, seasonParam: string | null): string {
  const query = new URLSearchParams({ tab });
  if (seasonParam) query.set("season", seasonParam);
  return `/leaderboard?${query.toString()}`;
}
