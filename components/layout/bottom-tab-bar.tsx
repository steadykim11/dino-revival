"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, NavItem } from "./nav-items";

// 모바일/태블릿(< 1024px) 하단 고정 탭바
// 활성 탭은 아이콘 색 + 배경 연하게
// 콘텐츠 폭과 동일하게 중앙 정렬
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주 메뉴"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex h-14 max-w-[420px] items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
                  active
                    ? "bg-amber-50 font-medium text-amber-800"
                    : "text-stone-500 hover:text-stone-700",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// 활성 탭 판별
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
