// SC-12 프로필·설정 - 닉네임·동네 인라인 편집, 비밀번호 재설정 메일, 로그아웃
//
// 탈퇴, 약관 등은 Phase 2 - 자리 표시

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { NicknameInput } from "@/components/profile/nickname-input";
import { RegionSelect } from "@/components/profile/region-select";
import type { NicknameStatus } from "@/components/profile/use-nickname-check";
import {
  getCooldownStatus,
  NICKNAME_COOLDOWN_DAYS,
  REGION_COOLDOWN_DAYS,
} from "@/lib/profile/cooldown";
import { REGIONS_BY_CODE } from "@/lib/static-data/regions";

interface MeResponse {
  auth: { id: string; email: string };
  profile: {
    id: string;
    nickname: string;
    regionCode: string;
    createdAt: string;
    nicknameChangedAt: string | null;
    regionChangedAt: string | null;
  } | null;
  guild: { displayName: string } | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);

  async function refetchMe() {
    const res = await fetch("/api/me");
    const json = (await res.json()) as MeResponse;
    setMe(json);
  }

  useEffect(() => {
    refetchMe();
  }, []);

  if (!me || !me.profile) {
    return (
      <>
        <PageHeader title="프로필" />
        <div className="px-4 pt-4 text-sm text-stone-400">불러오는 중...</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="프로필" />
      <div className="flex flex-col gap-3 px-4 pt-1 pb-6">
        <ProfileCard me={me} />
        <NicknameSection me={me} onUpdated={refetchMe} />
        <RegionSection me={me} onUpdated={refetchMe} />
        <AccountSection email={me.auth.email} router={router} />
        <InfoSection />
      </div>
    </>
  );
}

// 프로필 카드
function ProfileCard({ me }: { me: MeResponse }) {
  if (!me.profile) return null;
  const joined = new Date(me.profile.createdAt).toLocaleDateString("ko-KR");
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <p className="text-lg font-semibold">{me.profile.nickname}</p>
      <p className="mt-1 text-sm text-stone-600">
        {me.guild?.displayName ?? "동네 미설정"} · 가입일 {joined}
      </p>
    </section>
  );
}

// 닉네임 변경
function NicknameSection({
  me,
  onUpdated,
}: {
  me: MeResponse;
  onUpdated: () => void;
}) {
  const cooldown = getCooldownStatus(
    me.profile?.nicknameChangedAt ?? null,
    NICKNAME_COOLDOWN_DAYS,
  );

  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(me.profile?.nickname ?? "");
  const [status, setStatus] = useState<NicknameStatus>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setNickname(me.profile?.nickname ?? "");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  // 변경 안 한 경우 = 저장 비활성
  const isUnchanged = nickname.trim() === me.profile?.nickname;
  const canSave = status.kind === "available" && !isUnchanged && !saving;

  async function save() {
    if (!canSave || !me.profile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          regionCode: me.profile.regionCode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "변경에 실패했습니다.");
        return;
      }
      setEditing(false);
      onUpdated();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">닉네임</h2>
        {!editing && (
          <button
            onClick={startEdit}
            disabled={!cooldown.canChange}
            className="text-xs text-amber-700 hover:underline disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline"
          >
            변경
          </button>
        )}
      </div>

      {!editing ? (
        <>
          <p className="text-sm text-stone-700">{me.profile?.nickname}</p>
          <p className="mt-1 text-xs text-stone-400">
            {cooldown.canChange
              ? "30일에 한 번 변경할 수 있어요."
              : `${cooldown.remainingDays}일 후 변경 가능`}
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <NicknameInput
            value={nickname}
            onChange={setNickname}
            onStatusChange={setStatus}
            helperText="30일에 한 번 변경할 수 있어요."
          />
          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!canSave}
              className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white disabled:bg-stone-300"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={cancel}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// 동네 변경
function RegionSection({
  me,
  onUpdated,
}: {
  me: MeResponse;
  onUpdated: () => void;
}) {
  const cooldown = getCooldownStatus(
    me.profile?.regionChangedAt ?? null,
    REGION_COOLDOWN_DAYS,
  );

  const [editing, setEditing] = useState(false);
  const [regionCode, setRegionCode] = useState(me.profile?.regionCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function startEdit() {
    setRegionCode(me.profile?.regionCode ?? "");
    setError(null);
    setEditing(true);
  }

  const currentRegion = me.profile
    ? REGIONS_BY_CODE.get(me.profile.regionCode)
    : undefined;
  const isUnchanged = regionCode === me.profile?.regionCode;
  const canSave = !isUnchanged && regionCode !== "" && !saving;

  async function save() {
    if (!canSave || !me.profile) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: me.profile.nickname,
          regionCode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? "변경에 실패했습니다.");
        return;
      }
      setEditing(false);
      onUpdated();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">동네</h2>
        {!editing && (
          <button
            onClick={startEdit}
            disabled={!cooldown.canChange}
            className="text-xs text-amber-700 hover:underline disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline"
          >
            변경
          </button>
        )}
      </div>

      {!editing ? (
        <>
          <p className="text-sm text-stone-700">
            {currentRegion
              ? `${currentRegion.province} ${currentRegion.displayName}`
              : "—"}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {cooldown.canChange
              ? "90일에 한 번 변경할 수 있어요."
              : `${cooldown.remainingDays}일 후 변경 가능`}
          </p>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <RegionSelect value={regionCode} onChange={setRegionCode} />
          {error && (
            <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={!canSave}
              className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-semibold text-white disabled:bg-stone-300"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// 계정
function AccountSection({
  email,
  router,
}: {
  email: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  async function sendResetEmail() {
    setResetLoading(true);
    try {
      await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setResetSent(true);
    } finally {
      setResetLoading(false);
    }
  }

  async function logout() {
    setLogoutLoading(true);
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/signin");
    router.refresh();
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">계정</h2>
      <p className="mb-4 text-xs text-stone-500">{email}</p>

      <div className="flex flex-col gap-2">
        <button
          onClick={sendResetEmail}
          disabled={resetLoading || resetSent}
          className="w-full rounded-lg border border-stone-300 bg-white py-2 text-sm text-stone-700 disabled:opacity-50"
        >
          {resetSent
            ? "재설정 메일 발송 완료"
            : resetLoading
              ? "발송 중..."
              : "비밀번호 재설정 메일 받기"}
        </button>

        <button
          onClick={logout}
          disabled={logoutLoading}
          className="w-full rounded-lg border border-stone-300 bg-white py-2 text-sm text-stone-700 disabled:opacity-50"
        >
          {logoutLoading ? "처리 중..." : "로그아웃"}
        </button>

        <button
          disabled
          className="w-full cursor-not-allowed rounded-lg border border-stone-200 bg-stone-50 py-2 text-sm text-stone-400"
        >
          탈퇴 (Phase 2)
        </button>
      </div>
    </section>
  );
}

// 정보
function InfoSection() {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold">정보</h2>
      <div className="flex flex-col gap-2 text-xs text-stone-400">
        <span className="cursor-not-allowed">이용약관 (Phase 2)</span>
        <span className="cursor-not-allowed">개인정보처리방침 (Phase 2)</span>
        <span className="cursor-not-allowed">문의 (Phase 2)</span>
      </div>
    </section>
  );
}
