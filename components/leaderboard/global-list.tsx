// 전국 탭 — 길드 순위. 본인 길드 강조.

import type { GuildRanking } from "@/lib/guilds/score";

interface GlobalListProps {
  rankings: GuildRanking[];
  myGuildId: string | null;
}

export function GlobalList({ rankings, myGuildId }: GlobalListProps) {
  if (rankings.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-sm text-stone-500 shadow-sm">
        길드 데이터가 없습니다.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {rankings.map((r) => {
        const isMyGuild = r.guildId === myGuildId;
        return (
          <li
            key={r.guildId}
            className={[
              "flex items-center gap-3 rounded-xl px-4 py-3 shadow-sm",
              isMyGuild ? "bg-amber-50" : "bg-white",
            ].join(" ")}
          >
            <span className="w-7 text-center text-sm font-semibold tabular-nums text-stone-500">
              {r.rank}
            </span>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm text-stone-800">
                {r.displayName}
                {isMyGuild && (
                  <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                    우리 동네
                  </span>
                )}
              </p>
              <p className="text-[11px] text-stone-500">
                길드원 {r.memberCount}명
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-amber-700">
              {r.seasonScore.toLocaleString()}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
