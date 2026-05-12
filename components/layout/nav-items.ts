import { BarChart3, Home, LucideIcon, Settings, Users } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: Home },
  { href: "/stats", label: "통계", icon: BarChart3 },
  { href: "/leaderboard", label: "길드", icon: Users },
  // 라벨은 설정이지만 라우트는 /profile (프로필+설정)
  { href: "/profile", label: "설정", icon: Settings },
];
