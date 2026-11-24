// 우리 동네 탭 — 길드원 리스트. 본인 강조.

import type { GuildMember } from "@/lib/guilds/ranking";

interface LocalListProps {
  members: GuildMember[];
  myUserId: string;
}

export function LocalList({ members, myUserId }: LocalListProps) {
  if (members.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 text-center text-sm text-stone-500 shadow-sm">
        길드원이 없습니다.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {members.map((m, i) => {
        const isMe = m.userId === myUserId;
        const rank = i + 1;
        return (
          <li
            key={m.userId}
            className={[
              "flex items-center gap-3 rounded-xl px-4 py-3 shadow-sm",
              isMe ? "bg-amber-50" : "bg-white",
            ].join(" ")}
          >
            <span className="w-7 text-center text-sm font-semibold tabular-nums text-stone-500">
              {rank}
            </span>
            <span className="flex-1 truncate text-sm text-stone-800">
              {m.nickname}
              {isMe && (
                <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                  나
                </span>
              )}
            </span>
            <span className="text-sm font-semibold tabular-nums text-amber-700">
              {m.cleanEnergy.toLocaleString()}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
