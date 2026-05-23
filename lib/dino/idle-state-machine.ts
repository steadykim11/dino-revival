// 메인 화면 공룡 idle 애니메이션 동작 hook
//
// 상태:
//   standing — 가만히 서서 호흡. 가장 자주 등장.
//   walking — 좌우로 짧게 걷기. 캐릭터가 ±30px 좌우 이동.
//   sitting — 앉아서 쉼. 가끔 등장.
//
// 각 상태는 (자세 + 프레임 번호) 조합으로 표현됨.
// - 자세는 시간 기반으로 자동 전이 (5~15초 랜덤)
// - 프레임 번호는 자세별 다른 주기로 토글
//
// 사용: const { pose, frame, facing, offsetX } = useIdleStateMachine();

"use client";

import { useEffect, useRef, useState } from "react";

export type IdlePose = "standing" | "walking" | "sitting";

export interface IdleState {
  pose: IdlePose;
  // 1 또는 2 (현재 자세의 프레임 번호)
  frame: 1 | 2;
  // 'right' | 'left' — walking에서만 의미 있음, 다른 자세는 항상 'right'
  facing: "right" | "left";
  // 캐릭터의 x 위치 오프셋(px). walking에서만 움직임.
  offsetX: number;
}

interface PoseConfig {
  // 이 자세가 유지되는 최소 시간(ms)
  minDurationMs: number;
  // 이 자세가 유지되는 최대 시간(ms)
  maxDurationMs: number;
  // 프레임 토글 주기(ms)
  frameSwapMs: number;
  // 다음 자세 후보로의 가중치
  nextWeights: Record<IdlePose, number>;
}

const POSE_CONFIG: Record<IdlePose, PoseConfig> = {
  standing: {
    minDurationMs: 5000,
    maxDurationMs: 12000,
    frameSwapMs: 600,
    nextWeights: { standing: 0, walking: 7, sitting: 3 },
  },
  walking: {
    minDurationMs: 3000,
    maxDurationMs: 6000,
    frameSwapMs: 300,
    nextWeights: { standing: 8, walking: 0, sitting: 2 },
  },
  sitting: {
    minDurationMs: 3000,
    maxDurationMs: 7000,
    frameSwapMs: 800,
    nextWeights: { standing: 10, walking: 0, sitting: 0 },
  },
};

const WALKING_RANGE_PX = 70;
const WALKING_SPEED_PX_PER_FRAME = 0.6; // 60fps 기준 약 36px/sec

function pickNext(current: IdlePose): IdlePose {
  const weights = POSE_CONFIG[current].nextWeights;
  const entries = Object.entries(weights) as [IdlePose, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [pose, w] of entries) {
    if (r < w) return pose;
    r -= w;
  }
  return "standing";
}

function randomDuration(pose: IdlePose): number {
  const { minDurationMs, maxDurationMs } = POSE_CONFIG[pose];
  return minDurationMs + Math.random() * (maxDurationMs - minDurationMs);
}

export function useIdleStateMachine(enabled: boolean = true): IdleState {
  const [pose, setPose] = useState<IdlePose>("standing");
  const [frame, setFrame] = useState<1 | 2>(1);
  const [facing, setFacing] = useState<"right" | "left">("right");
  const [offsetX, setOffsetX] = useState(0);

  // walking 시 좌우 이동은 setInterval 기반 — useRef로 값 추적
  const offsetRef = useRef(0);
  const facingRef = useRef<"right" | "left">("right");

  // 자세 전이
  useEffect(() => {
    if (!enabled) return;

    const timeout = setTimeout(() => {
      const next = pickNext(pose);
      setPose(next);
      setFrame(1); // 새 자세 시작은 항상 프레임 1
    }, randomDuration(pose));

    return () => clearTimeout(timeout);
  }, [pose, enabled]);

  // 프레임 토글
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setFrame((f) => (f === 1 ? 2 : 1));
    }, POSE_CONFIG[pose].frameSwapMs);

    return () => clearInterval(interval);
  }, [pose, enabled]);

  // walking 좌우 이동
  useEffect(() => {
    if (!enabled) return;
    if (pose !== "walking") {
      // walking 종료 시 위치는 그대로 둔다 (다음 walking이 그 자리에서 시작)
      // 굳이 0으로 reset하지 않음 — 자연스러운 흐름
      return;
    }

    const interval = setInterval(() => {
      const dir = facingRef.current === "right" ? 1 : -1;
      let next = offsetRef.current + dir * WALKING_SPEED_PX_PER_FRAME;

      if (next >= WALKING_RANGE_PX) {
        next = WALKING_RANGE_PX;
        facingRef.current = "left";
        setFacing("left");
      } else if (next <= -WALKING_RANGE_PX) {
        next = -WALKING_RANGE_PX;
        facingRef.current = "right";
        setFacing("right");
      }

      offsetRef.current = next;
      setOffsetX(next);
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [pose, enabled]);

  if (!enabled) {
    return { pose: "standing", frame: 1, facing: "right", offsetX: 0 };
  }

  return { pose, frame, facing, offsetX };
}
