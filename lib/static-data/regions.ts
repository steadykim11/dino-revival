// 행정안전부 행정표준코드 — 시·군·구 5자리
// 출처: https://www.code.go.kr
//
// 이 목록으로 길드 시드 생성

export interface Region {
  // 5자리 시·군·구 코드
  code: string;
  // 표시명 (예: "강남구")
  displayName: string;
  // 시·도 표시명 (optgroup 라벨 등에 사용)
  province: string;
}

export const REGIONS: readonly Region[] = [
  // 서울 (11***)
  { code: "11680", displayName: "강남구", province: "서울특별시" },
  { code: "11650", displayName: "서초구", province: "서울특별시" },
  { code: "11710", displayName: "송파구", province: "서울특별시" },
  { code: "11440", displayName: "마포구", province: "서울특별시" },
  { code: "11170", displayName: "용산구", province: "서울특별시" },
  { code: "11110", displayName: "종로구", province: "서울특별시" },
  { code: "11560", displayName: "영등포구", province: "서울특별시" },
  { code: "11200", displayName: "성동구", province: "서울특별시" },

  // 경기 (41***)
  { code: "41135", displayName: "성남시 분당구", province: "경기도" },
  { code: "41117", displayName: "수원시 영통구", province: "경기도" },
  { code: "41285", displayName: "고양시 일산동구", province: "경기도" },
  { code: "41465", displayName: "용인시 수지구", province: "경기도" },

  // 광역시
  { code: "26350", displayName: "해운대구", province: "부산광역시" },
  { code: "28185", displayName: "연수구", province: "인천광역시" },
  { code: "30200", displayName: "유성구", province: "대전광역시" },
] as const;

// 코드 → Region 조회용 Map (검증·표시명 lookup)
export const REGIONS_BY_CODE: ReadonlyMap<string, Region> = new Map(
  REGIONS.map((r) => [r.code, r]),
);

// 시·도별로 그룹화된 Region 목록 (select optgroup 렌더링용)
// 입력 순서를 그대로 보존한다 (Map 삽입 순서)
export const REGIONS_BY_PROVINCE: ReadonlyMap<string, readonly Region[]> =
  (() => {
    const map = new Map<string, Region[]>();
    for (const r of REGIONS) {
      if (!map.has(r.province)) map.set(r.province, []);
      map.get(r.province)!.push(r);
    }
    return map;
  })();

// regionCode 유효성 검증 (Zod refine 등에서 사용)
export function isValidRegionCode(code: string): boolean {
  return REGIONS_BY_CODE.has(code);
}
