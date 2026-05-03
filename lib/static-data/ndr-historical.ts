/**
 * 국민DR (수요반응 자원시장) 운영 실적 — 정적 시드 데이터
 *
 * 출처: 전력거래소 「국민·주파수·플러스DR 운영 실적」 통합 파일
 * 반영 시점: 2026-01 자료 기준 (입력일: 2026-05-04)
 *
 * 갱신 정책:
 *   월 1회 수동 갱신. 새 자료 받으면 RECENT_MONTH와 ANNUAL 마지막 행 업데이트.
 *   갱신 시 sourceAsOf 필드도 함께 변경.
 *
 * 단위:
 *   - reductionKwh: 감축량 (kWh)
 *   - settlementKrwThousand: 정산금 (천원)  ← 표시할 땐 *1000 해서 원으로
 *   - dispatchCount: 발령 횟수 (회)
 */

export const NDR_SOURCE_AS_OF = '2026-01' as const;

/** 가장 최근 월 (2026년 1월) 단일 실적 */
export const NDR_RECENT_MONTH = {
  yearMonth: '2026-01',
  dispatchCount: 11,
  reductionKwh: 112_684,
  settlementKrwThousand: 171_206,
} as const;

/** 연도별 누적 시계열 — 통계 페이지 그래프용 */
export const NDR_ANNUAL = [
  { year: 2020, dispatchCount: 36, reductionKwh: 636,       settlementKrwThousand: 803       },
  { year: 2021, dispatchCount: 59, reductionKwh: 1_530,     settlementKrwThousand: 2_037     },
  { year: 2022, dispatchCount: 45, reductionKwh: 6_477,     settlementKrwThousand: 10_321    },
  { year: 2023, dispatchCount: 66, reductionKwh: 29_377,    settlementKrwThousand: 49_292    },
  { year: 2024, dispatchCount: 55, reductionKwh: 142_148,   settlementKrwThousand: 248_378   },
  { year: 2025, dispatchCount: 45, reductionKwh: 798_187,   settlementKrwThousand: 1_297_300 },
  // 2026은 1월까지의 부분 데이터. partial 플래그로 구분.
  { year: 2026, dispatchCount: 11, reductionKwh: 112_684,   settlementKrwThousand: 171_207, partial: true, throughMonth: 1 },
] as const satisfies readonly NdrAnnualEntry[];

/** 검증용 합계 — 자료의 "합계" 행과 비교해 입력 오타 방지 */
export const NDR_TOTAL = {
  dispatchCount: 317,
  reductionKwh: 1_091_039,
  settlementKrwThousand: 1_779_338,
} as const;

// ─── 타입 ───

export type NdrMonthEntry = {
  readonly yearMonth: string;
  readonly dispatchCount: number;
  readonly reductionKwh: number;
  readonly settlementKrwThousand: number;
};

export type NdrAnnualEntry = {
  readonly year: number;
  readonly dispatchCount: number;
  readonly reductionKwh: number;
  readonly settlementKrwThousand: number;
  readonly partial?: boolean;
  readonly throughMonth?: number;
};

// 데이터 무결성 자가 검증 구문
if (process.env.NODE_ENV !== 'production') {
  const sum = NDR_ANNUAL.reduce(
    (acc, row) => ({
      dispatchCount: acc.dispatchCount + row.dispatchCount,
      reductionKwh: acc.reductionKwh + row.reductionKwh,
      settlementKrwThousand: acc.settlementKrwThousand + row.settlementKrwThousand,
    }),
    { dispatchCount: 0, reductionKwh: 0, settlementKrwThousand: 0 }
  );

  // 정산금 합계는 자료에 1원 오차가 있음 (1,779,338 vs 합산 1,779,338).
  // 누적 시계열의 2026-01 정산금이 171,207인데 최근 월 표는 171,206.
  // 자료 자체의 반올림 차이로 보임. 1 단위 오차는 허용.
  console.assert(sum.dispatchCount === NDR_TOTAL.dispatchCount, 'NDR dispatchCount mismatch');
  console.assert(sum.reductionKwh === NDR_TOTAL.reductionKwh, 'NDR reductionKwh mismatch');
  console.assert(
    Math.abs(sum.settlementKrwThousand - NDR_TOTAL.settlementKrwThousand) <= 1,
    'NDR settlement mismatch'
  );
}