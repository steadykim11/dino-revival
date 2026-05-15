// 닉네임 debounce 검증 hook
// 400ms debounce 후 /api/me/check-nickname 호출
//
// SAME_AS_CURRENT는 hook 차원에서 'available'로 처리한다
// (자기 현재 닉네임 = 변경 안 함도 valid한 상태)
// 호출자가 "변경 안 함"을 구분하려면 nickname을 originalNickname과 비교

"use client";

import { useState, useEffect } from "react";

const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]{2,12}$/;
const DEBOUNCE_MS = 400;

export type NicknameStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "invalid_format" }
  | { kind: "taken" }
  | { kind: "available" };

export function useNicknameCheck(nickname: string): NicknameStatus {
  const [status, setStatus] = useState<NicknameStatus>({ kind: "idle" });

  useEffect(() => {
    const trimmed = nickname.trim();
    if (trimmed === "") {
      setStatus({ kind: "idle" });
      return;
    }
    if (!NICKNAME_REGEX.test(trimmed)) {
      setStatus({ kind: "invalid_format" });
      return;
    }

    setStatus({ kind: "checking" });

    const handle = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/me/check-nickname?nickname=${encodeURIComponent(trimmed)}`,
        );
        const json = await res.json();
        if (json.available || json.reason === "SAME_AS_CURRENT") {
          setStatus({ kind: "available" });
        } else if (json.reason === "INVALID_FORMAT") {
          setStatus({ kind: "invalid_format" });
        } else {
          setStatus({ kind: "taken" });
        }
      } catch {
        // 네트워크 오류는 조용히 idle로 - 제출 시점에 검증
        setStatus({ kind: "idle" });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [nickname]);

  return status;
}
