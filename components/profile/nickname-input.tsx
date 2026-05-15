// 닉네임 input + debounce 검증 + 상태 메시지
//
// 사용처:
// - SC-03 (온보딩): helperText="30일 후 변경 가능"
// - SC-12 (프로필 설정): helperText="30일에 한 번 변경할 수 있어요"

"use client";

import { useEffect } from "react";
import { useNicknameCheck, type NicknameStatus } from "./use-nickname-check";

export interface NicknameInputProps {
  value: string;
  onChange: (next: string) => void;
  /** 빈 입력 또는 idle 상태에서 표시할 안내 카피 */
  helperText?: string;
  /** 검증 상태 변화 시 호출 — 상위가 제출 가능 여부 판단에 사용 */
  onStatusChange?: (status: NicknameStatus) => void;
  disabled?: boolean;
}

export function NicknameInput({
  value,
  onChange,
  helperText = "30일 후 변경 가능",
  onStatusChange,
  disabled,
}: NicknameInputProps) {
  const status = useNicknameCheck(value);

  // 상태 변화를 상위로 전파. effect로 감싸 매 렌더 호출 방지.
  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="2~12자, 한글·영문·숫자"
        maxLength={12}
        disabled={disabled}
        className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-amber-500 disabled:bg-stone-50 disabled:text-stone-400"
      />
      <NicknameStatusMessage
        status={status}
        nickname={value}
        helperText={helperText}
      />
    </div>
  );
}

function NicknameStatusMessage({
  status,
  nickname,
  helperText,
}: {
  status: NicknameStatus;
  nickname: string;
  helperText: string;
}) {
  if (nickname.trim() === "") {
    return <p className="mt-1 text-xs text-stone-400">{helperText}</p>;
  }
  switch (status.kind) {
    case "checking":
      return <p className="mt-1 text-xs text-stone-500">확인 중...</p>;
    case "invalid_format":
      return (
        <p className="mt-1 text-xs text-rose-600">
          한글·영문·숫자 2~12자만 가능합니다.
        </p>
      );
    case "taken":
      return (
        <p className="mt-1 text-xs text-rose-600">
          이미 사용 중인 닉네임입니다.
        </p>
      );
    case "available":
      return (
        <p className="mt-1 text-xs text-emerald-600">
          사용 가능한 닉네임입니다.
        </p>
      );
    default:
      return <p className="mt-1 text-xs text-stone-400">{helperText}</p>;
  }
}
