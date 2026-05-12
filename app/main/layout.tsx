import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { SideNav } from "@/components/layout/side-nav";

/**
 * 로그인 후 페이지에 공통으로 적용되는 레이아웃.
 *
 * 폭 정책:
 * - 콘텐츠 폭은 항상 420px (max-width).
 * - 모바일/태블릿(<1024px):
 *     하단 56px 탭바가 fixed → 콘텐츠 하단에 pb-16으로 가림 방지.
 *     콘텐츠는 mx-auto로 화면 중앙.
 * - 데스크톱(>=1024px):
 *     우측 240px 사이드바가 fixed.
 *     mx-auto는 viewport 기준이라 그대로 두면 사이드바 영역까지 침범 가능.
 *     바깥 컨테이너에 lg:mr-60(240px)을 주면 콘텐츠가 (viewport - 240) 영역의 중앙에 위치.
 *
 * D8에서 인증 가드를 이 layout에 추가 예정.
 * 현재는 비인증 상태로도 접근 가능 (D5/D6 검증용).
 */

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-stone-100">
      <div className="lg:mr-60">
        <div className="mx-auto w-full max-w-[420px] pb-16 lg:pb-6">
          {children}
        </div>
      </div>

      <BottomTabBar />
      <SideNav />
    </div>
  );
}
