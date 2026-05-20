// 국민DR 비교 컨텍스트 — 정적 시드 활용
//
// NDR(국민DR) 시장은 국가 단위 수치라 본인과 직접 비교는 스케일이 안 맞음.
// 대신 "사회 차원의 DR 활동이 늘어나는 추세 + 본인도 거기에 참여 중" 카피 형성.
// - 최근 월 dispatch 횟수·감축량 표시
// - 본인 누적 클린에너지를 wh 환산해 NDR 단위(kWh)와 같은 차원으로 표기

import {
  NDR_RECENT_MONTH,
  NDR_SOURCE_AS_OF,
} from "@/lib/static-data/ndr-historical";

interface Props {
  myCleanEnergy: number;
}

// 클린에너지 → kWh 환산 비율 (게임 임의 단위 → 물리량)
// reward-calculator의 estimatedKwh와 baseReward 평균 비율 기준으로 대략 1 clean ≈ 0.005 kWh
// 시연 토이라 정밀할 필요 없음, 컨텍스트 카피용
const CLEAN_TO_KWH_RATIO = 0.005;

export function NdrComparisonCard({ myCleanEnergy }: Props) {
  const myEstimatedKwh = myCleanEnergy * CLEAN_TO_KWH_RATIO;

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold">국민DR 시장과 함께</h2>
      <p className="mt-0.5 text-xs text-stone-500">
        {NDR_RECENT_MONTH.yearMonth} 기준 실적
      </p>

      <div className="mt-4 space-y-2 text-xs">
        <Row
          label="전국 발령"
          value={`${NDR_RECENT_MONTH.dispatchCount.toLocaleString()}회`}
        />
        <Row
          label="전국 감축량"
          value={`${NDR_RECENT_MONTH.reductionKwh.toLocaleString()} kWh`}
        />
        <div className="border-t border-stone-100 pt-2">
          <Row
            label="본인 추정 절감"
            value={`${myEstimatedKwh.toFixed(2)} kWh`}
            emphasized
          />
        </div>
      </div>

      <p className="mt-3 text-[10px] text-stone-400">
        자료 기준: {NDR_SOURCE_AS_OF} · 전력거래소
      </p>
    </section>
  );
}

function Row({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-stone-500">{label}</span>
      <span
        className={`tabular-nums ${
          emphasized ? "font-bold text-amber-700" : "text-stone-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
