// SC-01 랜딩 페이지. 비로그인 사용자가 / 로 진입하면 (main) 가드가 여기로 보냄.
// (auth) 그룹 소속이라 로그인된 사용자는 layout에서 / 로 자동 리다이렉트.

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center">
      {/* 상단 로고 */}
      <div className="text-xs font-medium tracking-wider text-amber-700">
        DINO REVIVAL
      </div>

      {/* 일러스트 */}
      <div className="my-8 flex h-[220px] w-[220px] items-center justify-center">
        <svg
          viewBox="0 0 200 180"
          width="200"
          height="200"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="공룡 일러스트"
        >
          <circle cx="100" cy="100" r="80" fill="#FAEEDA" />
          <path
            d="M 60 130 Q 50 110 55 90 Q 60 65 85 55 Q 100 45 115 50 Q 135 55 140 75 L 145 70 L 150 80 L 145 88 Q 150 100 145 115 L 155 120 L 150 130 Q 140 138 125 138 L 120 145 L 110 145 L 108 138 L 85 138 L 82 145 L 72 145 L 70 138 Q 62 135 60 130 Z"
            fill="#BA7517"
          />
          <circle cx="120" cy="78" r="3" fill="#FAF8F3" />
          <ellipse
            cx="70"
            cy="148"
            rx="10"
            ry="2"
            fill="#97C459"
            opacity="0.6"
          />
          <ellipse
            cx="130"
            cy="148"
            rx="12"
            ry="2"
            fill="#97C459"
            opacity="0.6"
          />
        </svg>
      </div>

      {/* 헤드 / 서브 카피 */}
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-2xl font-semibold leading-snug text-stone-900">
          멸종을 막으러
          <br />
          그들이 돌아왔다
        </h1>
        <p className="text-sm leading-relaxed text-stone-600">
          전기를 절약하고 공룡을 성장시키세요.
          <br />
          당신의 절전이 지구를 구합니다.
        </p>
      </div>

      {/* CTA 버튼 2개 */}
      <div className="flex w-full flex-col gap-2.5">
        <Link
          href="/signup"
          className="w-full rounded-lg bg-amber-600 py-3.5 text-center text-sm font-semibold text-white"
        >
          시작하기
        </Link>
        <Link
          href="/signin"
          className="w-full py-2.5 text-center text-sm text-stone-500 hover:text-stone-700"
        >
          이미 계정이 있어요
        </Link>
      </div>
    </div>
  );
}
