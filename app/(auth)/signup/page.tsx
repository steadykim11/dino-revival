// 가입 성공 시 needsOnboarding === true 이므로 /onboarding/profile로 이동

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? "가입에 실패했습니다.");
        if (json.error?.code === "VALIDATION_ERROR" && json.error?.details) {
          setFieldErrors(json.error.details);
        }
        return;
      }

      // 아직 User row가 없기 때문에 needsOnboarding === true가 항상 참이 됨
      router.push("/onboarding");
      router.refresh(); // layout 가드가 새 인증 상태 인식하도록
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      {/* 탭 토글 */}
      <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-stone-100 p-1">
        <div className="rounded-md bg-white py-2 text-center text-sm font-semibold text-stone-900 shadow-sm">
          가입하기
        </div>
        <Link
          href="/signin"
          className="rounded-md py-2 text-center text-sm text-stone-500 hover:text-stone-700"
        >
          로그인
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs text-stone-600">이메일</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-rose-600">{fieldErrors.email[0]}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs text-stone-600">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상"
            required
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500"
          />
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-rose-600">
              {fieldErrors.password[0]}
            </p>
          )}
          <p className="mt-1 text-xs text-stone-400">
            최소 8자, 영문·숫자 포함
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-lg bg-amber-600 py-3 text-sm font-semibold text-white disabled:bg-stone-300"
        >
          {loading ? "가입 중..." : "가입하기"}
        </button>
      </form>

      {/* OAuth 자리 표시 — Phase 2 예정 */}
      <div className="mt-6">
        <div className="relative mb-4 flex items-center">
          <div className="flex-1 border-t border-stone-200" />
          <span className="px-3 text-xs text-stone-400">또는</span>
          <div className="flex-1 border-t border-stone-200" />
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-stone-200 bg-stone-50 py-2.5 text-sm text-stone-400"
          >
            카카오로 시작하기 (Phase 2)
          </button>
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-stone-200 bg-stone-50 py-2.5 text-sm text-stone-400"
          >
            Google로 시작하기 (Phase 2)
          </button>
        </div>
      </div>
    </div>
  );
}
