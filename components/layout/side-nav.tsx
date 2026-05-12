"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NavItem } from "./nav-items";

// 데스크톱(>= 1024px) 우측 고정 사이드바
// 모바일에서는 hidden, 폭 240px 높이 viewport 전체
export function SideNav() {
  const pathname = usePathname();

  return (
    <aside
      aria-label="주 메뉴"
      className="fixed inset-y-0 right-0 z-20 hidden w-60 border-1 border-stone-200 bg-white px-3 py-6 lg:block"
    >
      <div className="mb-4 px-3 text-sm font-semibold text-stone-800">
        디노 리바이벌
      </div>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-amber-50 font-medium text-amber-800"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-800",
                ].join(" ")}
              >
                <Icon
                  className="h-[18px] w-[18px]"
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
