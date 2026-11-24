// 탭 전환 — searchParam 기반. Link로 새 URL로 이동 (전체 리로드 x, RSC re-render)
// 고른 시즌은 탭을 바꿔도 유지한다.

import Link from "next/link";
import { leaderboardHref, type LeaderboardTab } from "./href";

interface LeaderboardTabsProps {
  active: LeaderboardTab;
  /** 현재 ?season= 값 (이번 시즌이면 null) */
  seasonParam: string | null;
}

export function LeaderboardTabs({ active, seasonParam }: LeaderboardTabsProps) {
  return (
    <nav aria-label="리더보드 탭" className="flex rounded-xl bg-stone-100 p-1">
      <TabLink href={leaderboardHref("local", seasonParam)} active={active === "local"}>
        우리 동네
      </TabLink>
      <TabLink href={leaderboardHref("global", seasonParam)} active={active === "global"}>
        전국
      </TabLink>
    </nav>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors",
        active
          ? "bg-white text-stone-900 shadow-sm"
          : "text-stone-500 hover:text-stone-700",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
