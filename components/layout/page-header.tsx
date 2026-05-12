import Link from "next/link";

interface Props {
  title: string;
}

// 모든 페이지 상단에 표시되는 헤더
// 좌 페이지 제목 우 프로필 아바타(클릭 시 /profile 이동)
export function PageHeader({ title }: Props) {
  return (
    <header className="flex h-12 items-center justify-between px-4">
      <h1 className="text-base font-semibold text-stone-800">{title}</h1>
      <Link
        href="/profile"
        aria-label="프로필"
        className="h-7 w-7 rounded-full bg-stone-300 transition-opacity hover:opacity-80"
      />
    </header>
  );
}
