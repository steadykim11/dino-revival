// 탭 전환 — searchParam 기반. Link로 새 URL로 이동 (전체 리로드 x, RSC re-render)

"use client";

import Link from "next/link";

type Tab = "local" | "global";

interface LeaderboardTabsProps {
  active: Tab;
}

export function LeaderboardTabs({ active }: LeaderboardTabsProps) {
  return (
    <nav aria-label="리더보드 탭" className="flex rounded-xl bg-stone-100 p-1">
      <TabLink href="/leaderboard?tab=local" active={active === "local"}>
        우리 동네
      </TabLink>
      <TabLink href="/leaderboard?tab=global" active={active === "global"}>
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
