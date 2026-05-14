// 비밀번호 재설정 메일 발송 요청 페이지
// 시연 시나리오에 없는 부가 기능이기 때문에 최소 구현

"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error?.message ?? "요청에 실패했습니다.");
        return;
      }
      setSent(true);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }

    if (sent) {
      return (
        <div className="text-center">
          <h1 className="mb-3 text-lg font-semibold">메일을 확인하세요</h1>
          <p className="mb-6 text-sm text-stone-600">
            {email}로 재설정 안내 메일을 보냈습니다.
          </p>
          <Link
            href="/signin"
            className="text-sm text-amber-700 hover:underline"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      );
    }

    return (
      <div>
        <h1 className="mb-2 text-lg font-semibold">비밀번호 재설정</h1>
        <p className="mb-6 text-sm text-stone-600">
          가입하신 이메일을 입력하시면 재설정 링크를 보내드립니다.
        </p>

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
            {loading ? "발송 중..." : "재설정 메일 보내기"}
          </button>

          <Link
            href="/signin"
            className="self-center text-xs text-stone-500 hover:text-stone-700"
          >
            로그인으로 돌아가기
          </Link>
        </form>
      </div>
    );
  }
}
