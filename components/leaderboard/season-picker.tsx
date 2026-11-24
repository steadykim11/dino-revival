// 시즌 선택 — 이번 시즌 · 지난 시즌들 · 역대 누적. searchParam 기반 링크.

import Link from "next/link";
import {
  ALL_TIME_PARAM,
  seasonShortLabel,
  type ScorePeriod,
} from "@/lib/guilds/season";
import { leaderboardHref, type LeaderboardTab } from "./href";

interface SeasonPickerProps {
  /** 최신순. 첫 항목이 이번 시즌 (listSeasons) */
  seasons: string[];
  active: ScorePeriod;
  tab: LeaderboardTab;
}

export function SeasonPicker({ seasons, active, tab }: SeasonPickerProps) {
  const [current, ...past] = seasons;
  const items = [
    {
      key: current,
      label: `이번 시즌 (${seasonShortLabel(current)})`,
      href: leaderboardHref(tab, null),
      active: active.kind === "season" && active.season === current,
    },
    ...past.map((season) => ({
      key: season,
      label: seasonShortLabel(season),
      href: leaderboardHref(tab, season),
      active: active.kind === "season" && active.season === season,
    })),
    {
      key: ALL_TIME_PARAM,
      label: "역대 누적",
      href: leaderboardHref(tab, ALL_TIME_PARAM),
      active: active.kind === "all",
    },
  ];

  return (
    <nav aria-label="시즌 선택" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-1.5">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={[
                "block rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                item.active
                  ? "bg-amber-600 text-white"
                  : "bg-white text-stone-600 shadow-sm hover:text-stone-900",
              ].join(" ")}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
