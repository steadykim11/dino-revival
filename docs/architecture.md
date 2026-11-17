# 아키텍처 결정 기록

주요 결정 사항을 ADR(Architecture Decision Record) 형식으로 정리.
시간이 지나서 "왜 이렇게 했지?"를 다시 확인할 때 보는 문서.

각 항목은 **결정 / 이유 / 대안 / 후속**으로 구성.

---

## 1. 외부 데이터 파이프 — 본인 PC에서 ingest (ADR 24로 대체됨)

**결정**: KPX D1·D2 외부 API를 본인 PC의 PowerShell 루프(5분 간격)에서 호출하고, 결과를 Vercel의 `/api/ingest/world-snapshot`으로 POST한다. Vercel Cron은 던전 모니터(D18)·일일 작업(D11·D15)에만 사용.

**이유**: D3 검증 결과 KPX가 Vercel·GitHub Actions의 클라우드 IP를 거부함. 자체 호스팅 서버를 두기엔 인프라 부담 크고, 본인 PC가 시연 기간 동안 켜져 있을 거라 충분.

**대안**:

- 클라우드 VM(가비아·AWS Lightsail 등) 1대 임대 — 비용 발생
- Cloudflare Workers — 동일하게 IP 거부 가능성
- 정적 CSV 백업 — 자체 데이터 갱신 불가, 시연 일정 동안 부적합

**후속**: 시연 일정 동안 PC 가동 보장 필요. PS 루프 안정성은 D17 무렵 24~48시간 관찰로 재검증.

---

## 2. WorldSnapshot.ts를 PK로 — Idempotent UPSERT

**결정**: `world_snapshots` 테이블의 PK는 `ts`(timestamp). Ingest 시 동일 ts에 대한 호출은 UPSERT로 처리, 중복 행이 생기지 않는다.

**이유**: KPX는 5분 단위 갱신이라 클라이언트가 5분 내 재시도 시 같은 ts를 반환. 별도 dedupe 로직 없이 PK 제약으로 자동 처리.

**대안**:

- 자동증가 id + `unique(ts)` — 가능하지만 PK가 더 단순
- 어플리케이션 레벨 dedupe — 경합 위험

**후속**: D7 스폿 체크에서 idempotency 검증 완료.

---

## 3. fuelMixPercent 분모 — 발전량 > 0 항목 합

**결정**: 발전믹스 비율을 계산할 때 분모를 "발전량이 양수인 항목의 합"으로 잡는다. 음수(양수발전 충전 중인 pumped) 항목은 분모에서 제외.

**이유**: `kpx.ts`의 `calcCarbonIntensity` 함수가 동일 기준으로 가중평균을 계산한다. 표시용 비율과 계산용 가중치의 분모가 다르면 "612 gCO₂/kWh가 이 비율들로부터 나온 게 맞나?"라는 검증이 불가능해진다. 일관성을 위해 동일 기준 사용.

**대안**:

- 시장 거래 발전만(ppa·btm 제외) — KPX 공식 발전믹스에 가깝지만 carbon-intensity 분모와 불일치
- 12종 전부(음수 절대값 포함) — 양수충전을 "발전했다"고 표시하는 셈

**후속**: D11 미션 보상 가중치도 동일 기준 따를 것.

---

## 4. battlefield는 컬럼 아닌 계산값

**결정**: `world_snapshots` 테이블에 `battlefield` 컬럼을 두지 않고, 응답 시점에 `carbonIntensity`로부터 계산한다.
임계값: `< 300` → PURIFIED, `< 500` → NORMAL, `≥ 500` → POLLUTED.

**이유**: 임계값이 정책상 바뀔 수 있고(시연 결과에 따라 튜닝 가능성), 컬럼으로 두면 마이그레이션·과거 데이터 백필 부담. 계산이 가벼워 응답 시 매번 계산해도 비용 무시 가능.

**대안**: 컬럼으로 저장하고 적재 시 계산 — 정책 변경 시 과거 데이터 일관성 깨짐

**후속**: 임계값은 `lib/world/battlefield.ts`에 상수로. 변경 시 한 곳만 수정.

---

## 5. /api/world/state — Public + 5초 HTTP 캐시

**결정**: `GET /api/world/state`는 인증 없음(Public). 응답에 `Cache-Control: public, max-age=5, s-maxage=5, stale-while-revalidate=10` 헤더.

**이유**:

- 메인 화면이 5초 폴링하는 핫 엔드포인트라 함수 호출 절감 필요.
- 응답에 사용자별 정보가 없음(전부 글로벌 월드 상태).
- 인증을 거치면 함수 콜드스타트마다 세션 검증 비용.

**대안**:

- 인증 필요로 두고 사용자별 캐싱 — 무의미한 복잡도
- Redis 캐시 — Phase 2로 미룸 (Upstash 도입 시점)

**후속**: 캐시 정책은 사용자 정보가 들어오는 응답(예: `/api/me/stats`)에는 적용 안 함.

---

## 6. KPX D2 간헐 500 회피 — 다층 처방 (ADR 25로 대체됨)

**결정**: KPX_D2의 간헐적 500 응답("허용되지 않는 요청") 회피를 위해 네 가지 처방을 합산 적용:

1. `User-Agent`/`Accept` 헤더 명시 (`http.ts`)
2. D1·D2 호출 사이 대기 300ms → 1000ms 상향 (`kpx.ts`)
3. D2의 `retry: true` 활성화 (`kpx-d2.ts`)
4. ingest 스크립트의 에러 로그 압축 + stdout flush 종료 (`scripts/kpx-ingest.ts`)

**이유**: 권한 문제는 아닌 게 확인됐고(브라우저는 항상 OK), 자동화 거부 휴리스틱·게이트웨이 throttle·일시 장애의 가능성이 섞여 있어 단일 처방으로 단정 어려움. 다층으로 회피.

**대안**: Phase 2에서 D1·D2 데이터를 자체 캐싱 서버로 분리 — 지금은 과함.

**후속**: D17 무렵 24~48시간 안정성 관찰 결과에 따라 추가 조치 결정.

---

## 7. 데스크톱 레이아웃 — 우측 사이드바, 콘텐츠 폭 고정

**결정**: 모바일/태블릿(`< 1024px`)은 하단 탭바, 데스크톱(`≥ 1024px`)은 우측 사이드바(240px). 콘텐츠 폭은 어디서나 420px(`max-w-[420px]`)로 고정. 데스크톱에선 사이드바 폭만큼 우측 마진을 주어 콘텐츠가 화면 정중앙 위치.

**이유**:

- 모든 컴포넌트가 모바일 폭 기준으로 설계됨. 데스크톱에서 폭을 늘리면 카드 내부 정렬이 어색해짐(좌-우 양 끝 배치의 간격이 멀어짐).
- 와이어프레임의 데스크톱 2열 레이아웃은 D21 폴리싱 또는 Phase 2로 미룸.

**대안**:

- 콘텐츠 폭을 데스크톱에서 늘림(420 → 560px) — 카드들 재배치 필요, 일정 부담
- 사이드바 없이 하단 탭바를 어디서나 — 데스크톱에서 어색

**후속**: D21에서 데스크톱 콘텐츠 폭 확장 + 카드 2열 배치 검토.

---

## 8. 주간 피크 전망 — 정적 자료, 수동 갱신

**결정**: 일일 최대부하 예측 데이터는 한국전력거래소가 주 1회(금요일) 발표하는 PDF에서 사람이 수동으로 옮긴다. `lib/static-data/weekly-peak-forecast.ts`에 9일치 배열로 저장.

**이유**:

- 공공데이터포털에 시간별 부하 예측 API가 없음. 정적 PDF 자료가 가장 입도 적합(일별).
- 갱신 주기가 주 1회라 자동화 가치 낮음. PDF 포맷이 매주 동일하다는 보장도 없음.
- 시연 일정 동안 2~3회 갱신이면 충분.

**대안**:

- KPX API의 시간별 실적 — _과거_ 데이터라 "오늘의 예상 피크" 용도 부적합
- 자체 예측 모델 — MVP 범위 밖

**후속**:

- 갱신 절차는 `docs/sources/weekly-peak-forecast.md` 참조.
- D17(5/15 발표분), D24(5/22 발표분) 두 차례 갱신.

---

## 9. 레벨 분류 — 절대값 + 주간 상대 혼합

**결정**: 일일 최대부하 예측을 `LOW | MEDIUM | HIGH`로 분류할 때, 절대값 임계(65/75 GW)를 기본으로 하되 주간 9일 중 최고치는 항상 HIGH, 최저치는 항상 LOW로 처리.

**이유**:

- 절대값만 쓰면 봄철에 9일 다 LOW~MEDIUM으로 몰려 HIGH 케이스가 안 나옴. 시연 시 시각적 다양성 부족.
- 주간 상대만 쓰면 9일이 모두 비슷한 절대 부하라도 강제로 LOW/MEDIUM/HIGH가 갈라져 의미 약함.
- 혼합으로 둘 다 보완.

**대안**: 단일 기준만 사용 — 위 단점.

**후속**: D11에서 미션 보상 가중치로 활용 예정. 그때 임계값 재검토 가능.

---

## 10. 인증 — @supabase/ssr + fetch + API Route

**결정**: Supabase Auth를 `@supabase/ssr` 패키지로 통합. 가입·로그인은 클라이언트가 `fetch('/api/auth/...')`로 호출하고, Route Handler 안에서 supabase 호출. Server Action 사용 안 함.

**이유**:

- 27개 API 명세서에 이미 `/api/auth/{signup,signin,signout,reset-password}` 4개가 입력되어 있어 일관성.
- 외부에서 같은 API를 curl·Postman으로 호출 가능 → 시연 환경에서 디버깅 용이.
- Phase 2에서 NestJS 백엔드로 분리할 가능성을 열어두려면 Route Handler 형태가 이식 쉬움.
- `@supabase/ssr`은 토큰을 HTTP-only 쿠키로 관리해 XSS 노출 차단 + SSR과 호환.

**대안**:

- Server Action — 폼 보일러플레이트 적지만 외부 노출 불가, NestJS 이전 시 재작성 필요.
- 클라이언트에서 supabase-js 직접 호출 — User 테이블 row 생성 등 부가 작업 자리가 애매. 트리거로 대체 가능하지만 디버깅 까다로움.

**후속**: D9에서 `/api/me/profile` 등 인증된 엔드포인트가 추가되면서 `requireUser` 헬퍼 본격 활용.

---

## 11. Supabase 클라이언트 — 서버·브라우저 함수명 분리

**결정**: `lib/auth/supabase-server.ts`의 export를 `createServerSupabase`, `lib/auth/supabase-client.ts`의 export를 `createBrowserSupabase`로 명명. 두 파일이 같은 이름(`createClient`)을 export하지 않는다.

**이유**: 초기 구현은 양쪽 다 `createClient`로 통일했는데, IDE 자동완성이 잘못된 쪽(브라우저용)을 import해 서버 코드에서 런타임 에러 발생. 이름을 다르게 두면 자동완성 자체가 충돌하지 않아 실수 차단.

**대안**: `import { createClient as createServerSupabase }` 같은 alias — 매 파일마다 반복, 깜빡하면 같은 사고 재현.

**후속**: 일반 명명 규칙으로 굳힘. 새 환경별 헬퍼가 생겨도 환경을 이름에 명시.

---

## 12. 인증 가드 — middleware는 갱신, layout은 redirect

**결정**: `middleware.ts`는 매 요청마다 `supabase.auth.getUser()`를 호출해 토큰을 자동 갱신만 한다. 미인증 시 redirect는 각 layout(`(main)/layout.tsx`, `(auth)/layout.tsx`, `onboarding/layout.tsx`)이 담당. 서버 검증은 항상 `getUser()` (절대 `getSession()` 아님).

**이유**:

- middleware는 API Route 포함 모든 요청을 통과한다. 거기서 redirect를 입력하면 401 JSON을 반환해야 할 API 호출이 HTML redirect로 변질됨.
- redirect 정책이 그룹별로 다르다: `(auth)`는 인증되어 있으면 `/`로, `(main)`·`onboarding`은 미인증이면 `/signin`으로. 각자 layout이 적절한 자리.
- `getSession()`은 쿠키를 그대로 신뢰해 변조 가능. `getUser()`는 Supabase에 검증 요청 → 안전.

**대안**: middleware에서 path를 보고 분기하는 식으로 redirect — path 매칭 룰이 복잡해지고 그룹별 정책 변화 시 한 곳이 비대해짐.

**후속**: D9에서 User row 유무에 따른 추가 분기("인증됐지만 프로필 미등록 → /onboarding")를 `(main)/layout.tsx`에 추가 예정.

---

## 13. 온보딩 — 라우트 그룹 안 쓰고 일반 디렉토리

**결정**: 가입 직후 단계를 `app/onboarding/` (일반 디렉토리)에 둔다. 라우트 그룹 `app/(onboarding)/`이 아님.

**이유**:

- `(onboarding)/profile/page.tsx`로 두면 URL이 `/profile`인데, 이게 SC-12 프로필·설정(`(main)/profile/page.tsx`)과 정면 충돌. Next.js 빌드 에러.
- 일반 디렉토리 `onboarding/`은 URL이 `/onboarding`이 되어 SC-12와 분리.
- D10에 SC-04 알 선택을 추가할 때 `onboarding/egg/page.tsx` → URL `/onboarding/egg`로 자연스럽게 확장.
- 그룹의 장점(URL에서 안 보임)이 오히려 단점으로 작용한 케이스.

**대안**: SC-12를 `/settings`로 옮김 — 요약본·와이어프레임의 "프로필/설정" 명명이 바뀜.

**후속**: D9에서 `/onboarding`을 SC-03 프로필 등록 화면으로 본격 구현.

---

## 14. 프로필 — PUT으로 생성·갱신 통합

**결정**: `PUT /api/me/profile` 한 엔드포인트로 첫 생성과 부분 갱신을 모두 처리. POST/PATCH 분리 안 함. 명세서의 PATCH는 PUT으로 정정.

**이유**:

- 첫 생성 = "프로필을 이 상태로 두기"라는 멱등 의미. PUT의 의미와 자연스럽게 맞음.
- POST(생성) + PATCH(수정) 분리는 클라이언트가 "이게 첫 호출인지"를 알아야 결정. 클라이언트가 `/api/me`를 먼저 호출해 확인하는 한 라운드트립 추가.
- PATCH는 RFC상 "부분 갱신"이라 첫 생성 의미와 어긋남.

**대안**:

- POST(생성) + PATCH(수정) 분리 — 위 단점.
- PATCH로 upsert — 의미 어긋남.

**후속**: 다른 1:1 리소스(예: `/api/me/dino` D10)도 같은 패턴 채택 검토.

---

## 15. regions.ts — 동네 데이터의 단일 진실 원천(SSoT)

**결정**: `lib/static-data/regions.ts`가 시·군·구 데이터의 SSoT. 길드 시드·온보딩 select·동네 변경 select·서버 화이트리스트 검증 모두 이 파일을 import.

**이유**:

- 길드 시드와 동네 선택지가 분리돼 있으면 정합성 깨짐 — 사용자가 선택했는데 매칭 길드가 없는 케이스.
- 동네 추가·삭제 시 한 곳만 수정하면 됨.
- `REGIONS_BY_CODE` Map과 `REGIONS_BY_PROVINCE` Map을 같은 파일에서 파생 — 조회·렌더링 비용 절감.

**대안**:

- 시드와 클라이언트 상수를 별도 — 동기화 부담.
- DB의 `guilds` 테이블을 SSoT — 빌드 타임 검증 불가, optgroup 렌더링 시 매번 쿼리.

**후속**: 동네 확장 시(현재 15개) 이 파일만 수정하고 `pnpm prisma db seed` 재실행하면 길드도 자동 확장.

---

## 16. 온보딩 layout 가드 — path 의존 없는 단순 규칙

**결정**: `onboarding/layout.tsx`는 **User + Dino 둘 다 있을 때만** `/`로 redirect. 그 외(User 없음 / User만 있고 Dino 없음)는 onboarding 영역에 머무름. 페이지 간 이동은 각 페이지가 직접 처리.

**이유**:

- 단순 규칙으로 무한 루프 방지 — "User만 있는 상태"에서 `/onboarding`·`/onboarding/egg` 어디서든 layout이 redirect 안 함.
- 페이지가 자기 진입 조건을 책임 — `/onboarding`(SC-03)은 useEffect로 User 유무 보고 `/onboarding/egg` 자동 이동.

**대안**:

- layout에서 path 보고 분기 — 미들웨어 커스터마이징 부담.
- 미들웨어에서 모든 redirect 처리 — API Route까지 영향 받아 위험.

**후속**: D10에서 `(main)/layout.tsx`에 "Dino 없으면 `/onboarding/egg` redirect" 추가하면 메인 영역의 분기까지 완성.

---

## 17. needsOnboarding 응답 신호 — 서버가 클라이언트 라우팅을 안내

**결정**: 인증 API(`signup`, `signin`) 응답에 `needsOnboarding: boolean` 필드. 클라이언트가 이 값으로 `/onboarding` vs `/` 분기. 추가로 `/api/me` 응답의 `profile`·`dino` null 여부로 세분화.

**이유**:

- 서버가 도메인 상태(User row 유무 등)를 가장 정확하게 안다. 클라이언트가 다시 fetch해서 판단할 필요 없음.
- 인증 직후 라운드트립 절감 — signin 응답 한 번으로 다음 화면 결정.

**대안**:

- 클라이언트가 signin 후 `/api/me` 또 호출 — 라운드트립 추가.
- 인증 응답에 전체 User 객체 — 응답 비대, 책임 흐려짐.

**후속**: D10에서 알 선택 후 분기에 `dino` 필드 활용. 응답 스키마는 Phase 2에 OpenAPI로 정형화 검토.

---

## 18. 컴포넌트 추출 트리거 — 두 곳 사용 + 분리 가치

**결정**: 추상화는 다음 조건 동시 만족 시에만:

1. 두 곳 이상에서 재사용되는 게 확실
2. 추출 단위가 자체로 의미 있는 책임 (input + 검증, select + 옵션 데이터 등)
3. 100줄 안팎 — 너무 작으면 점프 비용, 너무 크면 응집도 의심

D9에서 `components/profile/` 하위 3개(useNicknameCheck, NicknameInput, RegionSelect)와 `lib/profile/cooldown.ts` 추출. SC-03(온보딩)과 SC-12(프로필 설정)에서 공유.

**이유**:

- 시연 토이라 과도한 추상화는 점프 비용만 늘림 (Layered Architecture 단순화 방침).
- 둘 다 한 번만 쓰일 거면 인라인 유지가 가독성 좋음.
- 추출 시점 = "두 번째 호출자가 등장" 또는 "쿨다운 정책처럼 서버·클라 양쪽 사용".

**대안**:

- 사전 추상화 (한 번 쓰일 거라도 컴포넌트로 분리) — 점프 비용 + 인터페이스 설계 부담.
- 끝까지 인라인 — SC-12 작성 시 SC-03 복붙 → 양쪽 동기화 부담.

**후속**: 미션 카드(D11~D12)와 배틀 컷씬(D13)도 두 페이지에서 쓰일 가능성 — 같은 트리거로 추출 판단.

---

## 19. species 메타데이터 — lib/dino/species.ts 단일 자리

**결정**: 종(species) 관련 표시 정보(displayName·description·defaultName·color·isAvailable·lockedReason)를 `lib/dino/species.ts`에 모음. UI·API 검증·시드 모두 이 파일을 import.

**이유**:

- SC-04 알 카드, SC-04b 디폴트 이름, SC-05 메인 색상, PUT API 잠금 검증이 다 같은 정보 참조.
- Phase 2에서 BRACHIO·TRICERA 활성화할 때 한 곳만 `isAvailable: true`로 수정.
- DB에 species 메타를 안 두는 이유 — 정적 데이터고, 빌드 타임 검증 가치 있음(`Record<DinoSpecies, SpeciesMeta>` 타입 보장).

**대안**:

- DB의 `species` enum + 별도 메타 테이블 — 정적인데 DB 조회 부담.
- 각 컴포넌트에 인라인 상수 — 동기화 부담.

**후속**: D14 진화 연출 카피, D21 디자인 토큰도 이 파일 확장으로 흡수 가능.

---

## 20. PUT으로 Dino 첫 생성, 게임 진행 갱신은 내부 함수

**결정**: `PUT /api/me/dino`는 첫 생성(알 받기)만 담당. 이미 있으면 409. 게임 진행에 따른 갱신(클린에너지·친밀도·진화)은 API를 통하지 않고 `lib/dino/`의 내부 함수가 prisma를 직접 호출. 관리자의 강제 조정은 별도 `/api/admin/dino` (D19).

**이유**:

- 사용자가 의도적으로 호출하는 동사(생성)와 시스템이 자동 처리하는 동사(보상·진화)는 책임이 다름. 같은 엔드포인트로 통합하면 권한 분기·트랜잭션 경계가 흐려짐.
- 미션 완료(D12) 시 클린에너지 갱신 + 진화 체크 + 미션 로그 기록이 한 트랜잭션. 클라이언트가 PATCH 호출하는 식이면 트랜잭션 분리됨.
- 관리자 강제 조정은 시연용이라 책임·권한 모두 분리.

**대안**:

- 단일 PATCH 엔드포인트로 모든 갱신 — 권한 매트릭스 복잡, 트랜잭션 깨짐.
- POST(생성) + PATCH(갱신) — D9에서 결정한 PUT 패턴과 어긋남.

**후속**: D12에서 `lib/dino/rewards.ts` 작성 — 미션 완료 트랜잭션 안에서 호출되는 내부 함수.

---

## 21. 부화는 진화의 일부 — PUT 시 EGG로 시작

**결정**: PUT 시 `stage: 'EGG'`로 생성. EGG → HATCHLING 전이는 미션 완료로 클린에너지 100 도달 시 자동 발생 (D14 진화 시스템). 별도 "부화" 액션·트랜지션 화면 없음. SC-08 진화 연출이 부화에도 재사용됨.

**이유**:

- 알을 받자마자 부화하면 사용자에게 EGG stage가 시각적으로 잠깐 보였다 사라짐 — 의미 없음.
- 부화를 게임 진행에 묶으면 첫 동기부여가 생김. 시연 시 미션 2~3개 클리어로 부화 임팩트까지 보여줄 수 있음.
- 진화 메커니즘(EGG → HATCHLING → ADULT)이 균일한 한 시스템으로 통합. D14 진화 시스템이 두 단계 모두 처리.

**대안** (한 번 결정했다가 뒤집은 것):

- 부화를 SC-04에서 별도 처리 + PUT 시 HATCHLING으로 직행 — EGG stage가 데드 코드 되고, 첫 진화 임팩트가 약해짐.

**후속**: D14에서 `lib/dino/evolution.ts`의 `shouldEvolve`가 미션 완료 트랜잭션 안에서 호출. SC-08 연출 컴포넌트는 stage 인자로 두 전이 모두 처리.

---

## 22. 공룡 이름 — 사용자 입력 + species별 디폴트

**결정**: Dino 모델에 `name VARCHAR(12)` 컬럼 추가. SC-04b에서 사용자가 직접 입력. species별 디폴트 이름(`SPECIES_META[species].defaultName`)을 input 초기값으로 채워둠. 검증 규칙은 닉네임과 동일(2~12자 한글·영문·숫자).

**이유**:

- 펫 육성 게임 컨셉에서 이름 부여는 강한 애착 형성 장치.
- 디폴트 채워두기 = 입력 안 해도 자연스러운 흐름(즉시 확정 가능), 입력하면 더 강한 소유감.
- 닉네임 검증 규칙 재사용 — 정책 통일, 검증 코드 재활용 가능.

**대안**:

- 종에 따라 고정된 이름 (티라노=라프토라) — 컨셉 약화.
- 빈 input 강제 — UX 마찰.

**후속**: SC-08 진화 연출에서 "{name}가 성체로 진화합니다" 같은 카피 활용.

---

## 23. DinoDisplay — placeholder SVG + CSS keyframes, D21 호환

**결정**: 공룡 표시 컴포넌트는 placeholder SVG (단순 도형)로 시작. 단계별 다른 SVG + 다른 CSS keyframes 애니메이션 (egg-wobble·hatchling-bob·adult-sway). 배경은 species color 기반 그라데이션 + 점 패턴. `prefers-reduced-motion` 지원.

D21에 정식 일러스트로 교체할 때 props 인터페이스(`species`·`stage`·`size`) 유지 — 호출자(SC-04, SC-04b, SC-05, 향후 SC-09 던전)는 변경 없음.

**이유**:

- "활동하는 펫" 컨셉이 시연 임팩트의 핵심. 정적 이미지로 두면 컨셉 약화.
- D21 본격 디자인까지 의존 없이 시각 효과 확보.
- CSS keyframes만 — JS 없이 GPU 가속, 배터리·성능 영향 최소.

**대안**:

- 정적 placeholder 이미지 — 컨셉 약화.
- JS state로 위치 lerp — 복잡도 증가.
- 외부 라이브러리(Lottie, Framer Motion) — 번들 사이즈 증가.

**후속**: D21에서 일러스트 교체 시 SVG 부분만 PNG·SVG asset으로 변경. 애니메이션·배경 그대로.

---

## 11. 일일 미션 선정 — 슬롯 기반 알고리즘

**결정**: 사용자별 일일 미션 3개를 "시간대 슬롯 1개씩(DAY/EVENING/ANYTIME)" 강제 선정하고, 그 안에서 카테고리 중복 회피·직전일 풀 제외를 적용한다. 발급 트리거는 KST 자정 Cron + Lazy 백필(`/api/missions/today` 호출 시 누락분 발급) 이중화. 사용자 1명 실패가 전체 일괄 작업을 막지 않도록 사용자별 commit.

**이유**:

- 슬롯 강제로 시연 화면이 항상 "낮·저녁·종일" 3종 구성이라 시각적으로 풍성. 풀이 15개로 작아도 슬롯별 4·5·6개라 후보 충분.
- Lazy 백필이 있으면 데모 중 신규 가입자도 미션 0개 상태를 피할 수 있음.
- 사용자별 commit으로 한 명 실패가 전체 자정 작업을 막지 않음. 누락된 사용자는 Lazy 백필이 안전망.

**대안**:

- 단순 가중치(셔플 + 후처리 회피) — 코드 짧지만 풀 작을 때 제약 위반 가능
- 제약 만족 탐색 — 풀이 커지면 안정적이나 MVP에 과함
- Cron 단일 트리거 — 신규 가입자가 다음 자정까지 미션 0개라 시연 위험
- 전체 1트랜잭션 — 한 명 실패 시 전부 롤백, 가용성 떨어짐

**후속**:

- D12에서 미션 완료 흐름(전투 결과 + 보상 계산) 연결.
- D15에서 더미 사용자 50~100명 추가 시 Cron 시간 측정 — `maxDuration=60` 한도 안에 드는지 확인. 초과 시 청크 분할.
- 알고리즘 검증은 `lib/missions/daily-selector.test.ts`(Vitest)로 1000회 시뮬레이션. 카테고리 중복·relaxation이 없어야 통과.
- 미션 풀 deleteMany는 D11 이후 금지(Mission이 poolId FK 참조). 풀 수정 필요 시 개별 update 또는 마이그레이션.

---

## 12. 보상 계산 — 클라이언트 미리보기 + 서버 검증

**결정**: 미션 보상 계산식(`baseReward × carbonWeight × dungeonMultiplier`)을 `lib/missions/reward-calculator.ts` 순수 함수로 분리하고, 클라이언트(SC-06 모달의 보상 박스)와 서버(/api/missions/complete) 양쪽에서 import해 동일 식 사용. 클라이언트는 폴링 캐시의 carbonIntensity로 미리 표시, 서버는 POST 시점에 최신 WorldSnapshot을 다시 조회해 재계산한다.

**이유**:

- SC-06 모달의 "기본 보상 → 가중치 → 최종 보상" 박스를 즉시 표시하려면 클라이언트 계산이 필요.
- 서버 재계산은 정직성·감사 가능성 차원. MissionLog에 기록되는 값은 항상 서버 기준.
- /api/world/state는 이미 5초 폴링 중이라 carbonIntensity 추가 호출 없음.
- 5초 사이 carbonIntensity가 카테고리 경계(<300/<500/≥500)를 넘는 경우만 표시값과 실제 적립값 차이 발생. 흔치 않음.

**대안**:

- preview-reward API 호출 — 추가 라운드트립. 일치 보장이나 호출 1회 늘어남.
- 모달은 baseReward만 표시 — 와이어프레임 SC-06의 보상 박스 표현 손실.

**후속**:

- D9 환경부 배출계수(`lib/static-data/emission-factors.ts`)의 정식 도입은 미정. 현재 reward-calculator의 `CO2_FACTOR_KG_PER_KWH = 0.4781`은 임시 상수. Phase 2 또는 D24 회고에서 결정.
- 친밀도 cap(100)은 미션당 +5라 24일 시연 내 도달 가능. 도달 후 cap 동작은 통계 화면에서 확인 가능해야 함.

---

## 13. 전투 결과 화면 — 별도 페이지 + phase 전환

**결정**: 미션 완료 후 결과 페이지(`/battle/[missionLogId]`)로 라우팅. 한 페이지 안에서 `cutscene → result` 두 phase를 useState로 전환. 적은 전장(carbonIntensity 구간)에 따라 3종(미세먼지/운석/화염) 분기. 애니메이션은 motion 12 (구 framer-motion) 사용.

**이유**:

- 결과 페이지를 URL로 가져 시연 시 새로고침·재진입 가능. 모달/오버레이로 띄우면 새로고침 시 사라짐.
- phase 전환을 한 페이지로 묶어 새로고침 시점에 따른 컷씬 건너뜀/이중 재생 방지.
- 적 3종 분기로 "월드 상태가 게임에 반영된다"는 컨셉 가시화. carbonIntensity가 다른 시점에 미션 완료 시 다른 적 등장.
- motion v12는 React 19 정식 지원. 자체 카운트업·진척도 바 구현보다 훨씬 짧음. D14 진화 연출에서 재사용.

**대안**:

- 모달/오버레이 — URL 미보존, 시연 재현성 떨어짐.
- 컷씬·결과 페이지 분리 — 새로고침 시점 의존, 두 번 보거나 건너뜀 발생.
- 적 1종 placeholder — 단조로움, 컨셉 약화.
- 자체 애니메이션 — 카운트업 + 진척도 바 + 충돌 컷씬을 직접 구현하면 시간 손해.

**후속**:

- 진화 발생 시 결과 페이지에서 분기해 D14 진화 연출로 전환. 현재는 stageBefore=stageAfter로 처리.
- MissionLog에 stageBefore 컬럼 추가 검토 (D14 진행 시).
- motion의 keyframes/times/ease 배열 길이 규칙(N/N/N-1) 주의. 길이 불일치 시 경고 없이 폴백되므로 D14·이후 작업에서도 의식.

---

## 14. 진화 시스템 — 트랜잭션 일체화 + MissionLog에 stageBefore/After 기록

**결정**: 미션 완료(D12) 트랜잭션 안에서 진화 판정·적용을 함께 처리. 진화 발생 시 Dino.stage·hatchedAt|evolvedAt 갱신과 MissionLog 기록을 같은 `prisma.$transaction`에서 커밋. 진화 정보는 두 곳에 이중 기록 — `/api/missions/complete` 응답의 `evolved: { from, to } | null` 필드와 MissionLog의 `stageBefore`/`stageAfter` 컬럼. battle 페이지는 MissionLog 두 값을 비교해 evolution phase 트리거 여부를 결정.

`lib/dino/evolution.ts`는 순수 판정(`shouldEvolve`)과 부수효과 적용(`applyEvolution`)을 분리. completer는 두 함수를 조합하기만 함. battle 페이지의 phase 흐름은 `cutscene → result → evolution`으로 확장하되, evolution은 진화 발생 시에만 진입. result 화면의 DinoDisplay·진척도 바는 모두 stageBefore 기준 — 진화 직전 단계로 표시되고, 진척도 바는 임계값 100%로 꽉 차서 다음 evolution phase의 시각적 빌드업이 됨.

**이유**:

- 보상 적립과 진화는 의미적으로 같은 트랜잭션의 일부. cleanEnergy가 임계값을 넘는 순간이 곧 진화 시점이라 분리하면 일관성 깨짐(예: 적립 성공 + 진화 실패 시 다음 미션 완료까지 진화 지연).
- MissionLog에 두 stage를 넣은 이유는 시연 재현성. battle URL을 다시 방문해도 진화 phase가 동일하게 재생됨. 응답 필드만 있으면 새로고침 시 진화 정보 소실. ADR 13에서 phase 전환을 한 페이지로 묶은 정책(새로고침 시 컷씬 재생)과 일관.
- 응답 필드도 같이 두는 이유는 클라이언트가 MissionLog 두 컬럼을 또 fetch하지 않아도 즉시 분기 가능. battle 페이지는 서버 컴포넌트라 어차피 DB 조회를 하므로 응답 필드는 mission-complete-modal 등 다른 클라이언트 호출자를 위한 잔여 자산.
- `shouldEvolve`(순수)와 `applyEvolution`(부수효과) 분리는 테스트 용이성·재사용성 + 진화 로직 SSoT 보장. 호출자가 stage 전이별 timestamp 분기(hatchedAt vs evolvedAt)를 직접 알 필요 없음.
- result 화면이 stageBefore를 표시하는 이유는 인과 흐름 — "이 단계의 dino가 미션 수행 → 보상 → 진화". stageAfter로 표시하면 "이미 진화한 상태에서 보상 받음"이 되어 evolution phase의 클라이맥스가 약해짐. 진척도 바도 같은 기준으로 통일.

**대안**:

- 진화를 별도 API/cron으로 분리 — 사용자 액션과 진화 시점이 분리되어 시연 임팩트 손해. 트랜잭션 일관성도 깨짐.
- MissionLog에 진화 정보 미기록, 응답에만 — 시연 재현성 손해(ADR 13 정책 위반).
- 별도 페이지 `/evolution/[id]` — ADR 13에서 phase 묶음 결정을 뒤집는 셈. 새로고침 시점에 따른 건너뜀/이중 재생 문제 재발.
- `applyEvolution` 인라인 — completer 안에서 stage별 timestamp 분기를 인라인으로 처리하면 D17 관리자 패널이 강제 진화시킬 때 또 같은 분기 작성. SSoT 깨짐.
- result도 stageAfter — D13 코드 그대로지만 인과 흐름 깨짐.

**후속**:

- D17 관리자 패널의 "공룡 단계 직접 설정"이 `applyEvolution`을 재사용하면 stage·timestamp 갱신이 자동 일관. shouldEvolve 우회 강제 진화도 같은 함수로 처리 가능.
- BRACHIO·TRICERA의 `evolutionLines` 카피는 빈 문자열 placeholder. Phase 2에서 두 종 활성화 시 작성. EvolutionScene이 빈 문자열일 때 대사 블록 자체를 안 렌더링하도록 가드되어 있음.
- 진화 임계값(100, 500)은 evolution.ts의 SSoT 상수. D24 회고에서 24일 시연 데이터 기준으로 재검토 — 너무 빠르면 진화가 시연 초반에 다 끝나고, 너무 느리면 ADULT 못 봄. 더미 사용자 데이터(D15)로도 검증.
- 진화 두 번이 한 미션에서 발생할 수 없음(EGG→ADULT 점프). `shouldEvolve`가 한 단계씩만 반환하기 때문. 미션 보상이 500 이상이면 발생 가능하나 현재 풀의 baseReward 최대가 그 미만이라 실질적으로 불가. 정책으로 기록.
- D18 더미 데이터 시드에서 일부 사용자를 ADULT로 초기화하려면 `applyEvolution`을 두 번 호출하거나 직접 Dino update + stageBefore/After를 적당히 채운 MissionLog 시드. 두 단계 점프는 안 함.

---

## 15. 더미 사용자 — User row만 생성, 활동은 시드 시점 MissionLog로

**결정**: 75명 더미(15 길드 × 5명) 시드. Supabase Auth 우회, User row + `isDummy: true`만 생성. 자정 cron은 더미 제외. 더미의 "활동"은 시드 시점에 과거 MissionLog 5~20개를 결정론적 hash로 입력하는 방식. 닉네임·Dino 분포·MissionLog 모두 인덱스 기반이라 재실행 시 동일 결과. MissionPool과 `calculateCo2Reduced`를 그대로 재사용해 본인 데이터와 동일 경로로 생성.

**이유**:

- 길드 점수·리더보드·통계가 본인 1명만으로는 시연 임팩트 부족. 길드당 5명은 "동네 단위"가 살아나는 최소치.
- Auth 우회는 시연 토이 범위 결정. createUser API·이메일 충돌 회피 비용이 시연 가치보다 큼.
- Cron 더미 제외는 ADR 11 후속(60초 한도)을 해소. 더미는 매일 미션 받을 필요 없음 — 시드 시점 입력으로 충분.
- 시드로 재현성·디버깅·시연 일관성 확보.

**대안**:

- Supabase Admin API로 진짜 auth user → 인증 비용 무가치.
- 더미 활동 시뮬레이션 cron → Phase 2로 미룸.

**후속**:

- D17 리더보드·D18 던전 기여도 카운트에서 더미 처리 정책 확정 필요.
- D20 통계: 본인 통계는 본인 로그만, 길드 평균은 더미 포함.

---

## 16. 길드 점수 — Dino.totalCleanEnergy 합산 + 5분 Lazy 캐시 (캐시는 ADR 29로 폐기)

**결정**: 길드 시즌 점수는 `Dino.totalCleanEnergy` 합산으로 계산. 리더보드 조회 시 read-through 5분 캐시 (`LeaderboardCache` 단일 행, `id='global'`). 캐시 stale 시 재계산 + `Guild.seasonScore` 컬럼도 동기화. 길드원 리스트는 점수 desc 정렬, 본인 강조는 UI 책임.

**이유**:

- Dino.totalCleanEnergy가 클린에너지의 SSoT(D12 reward 트랜잭션·D14 진화 임계값과 동일 소스). MissionLog는 영구 이력이지만 행 수가 10배 이상 많아 집계 비용 큼.
- 동네 변경 시 누적값 그대로 가져간다는 요약본 정책과 일관 — User.guildId만 보면 됨.
- Lazy 캐시는 cron 추가 없이 정책 충족. 5분 TTL이라 첫 조회자만 50ms 미만 부담.
- Guild.seasonScore 컬럼도 같이 갱신 — 캐시 만료 시점에 다른 화면(통계 등)에서 일관된 값 보장.

**대안**:

- MissionLog 합산 — 행 수 많아 집계 비용↑, 동네 변경 시 정책 어긋남.
- Cron 주기 갱신 — cron 추가 부담.
- 미션 완료 시 즉시 무효화 — 정확하지만 잦은 쓰기.

**후속**:

- Phase 2에 LeaderboardCache를 Redis로 이전 (schema 정책 명시).
- D17 SC-11 리더보드 UI가 이 두 엔드포인트 소비.
- D18 던전 발령 시 길드 기여도 카운트와의 관계 정리 필요.

---

## 17. 피크 던전 — Lifecycle SSoT + 결정론적 미션 분배 + 더미 가상 기여

**결정**: 던전 라이프사이클(activate·end·sweep·getCurrentActive)을 `lib/dungeon/lifecycle.ts` SSoT로 분리하고, 단일 활성을 트랜잭션 안에서 보장한다(idempotent). 발령 = 60분, 만료는 lazy + 호출 시 sweep — 별도 cron schedule 추가 없이 기존 `cron/realtime`에 monitor 한 호출을 얹는다. 던전 미션은 MissionPool에서 dungeonId hash 기반으로 결정론적으로 2개 선정해 같은 던전의 모든 실유저가 동일한 미션을 받는다. 더미는 발급 제외, 대신 길드 기여도 위젯에서 `hash(dungeonId, userId) % 3`로 가상 카운트를 합산한다. 던전 종료 후에도 발급된 미션은 당일 자정까지 유효(완료 가능) — 시연 안전망. /world/state의 dungeon 응답은 `expiresAt > now` 가드로 lazy 만료가 자연스럽게 작동.

**이유**:

- lifecycle SSoT 분리: trigger·end·monitor 세 진입점이 같은 activate/end를 호출하므로 단일 활성 보장과 sweep 로직이 한 곳에 있어야 일관. 트랜잭션 안에서 sweep + 활성 확인 + 생성을 묶어 동시 호출(관리자 더블 클릭)에도 정확히 1개만 created.
- 신규 cron schedule 미추가: 기존 `cron/realtime`이 이미 5분마다 도는 hot path. monitor 추가 비용은 쿼리 2~3개 + 수십 ms. 시연 토이 범위에서 자동 트리거 발생은 거의 0이지만 sweep 가치는 있음.
- 결정론적 미션 분배: 같은 던전에서 모든 사용자가 같은 미션 2개를 받는 게 "전국 단위 비상" 컨셉에 부합. UUID 첫 8자 hash로 풀에서 modulo 선택 — 재실행 안전, 풀 변동 시에도 안정.
- 더미 가상 기여(ADR 15 후속 회수): 시드 시점 MissionLog는 던전 발령 시각과 매칭 안 됨. 시연 직후 발령된 던전에서 더미 기여 0이면 "동네가 함께" 카피가 깨짐. hash 가상 카운트는 ADR 15의 결정론적 데이터 원칙과 일관.
- 미션 만료 정책: 요약본의 "별도 Cron 없이 조회 시 expiresAt 필터로 처리"와 동일. 던전 종료 시 미션 일괄 만료 안 함 — 던전 시각보다 미션 사용성이 우선.

**대안**:

- 신규 cron `/api/cron/dungeon-monitor` — schedule 1개 추가, 비용 분리되지만 5분 주기가 realtime과 동일이라 통합 이득이 큼.
- 별도 dungeon 미션 풀 시드 — 시드 추가 + idempotent 가드(ADR 11 후속) 다시 짜야 함. UI 카피 오버라이드로 임팩트 확보 가능해 풀 추가 불필요.
- 사용자별 무작위 미션 — "전국 비상" 컨셉 약화, 가상 기여 검증도 복잡.
- 더미 가상 기여 미적용 — 시연 임팩트 손해.
- 던전 종료 시 미션 일괄 만료 — 사용자가 막 완료하려던 미션 사라짐. 시연 도중 발생 시 치명적.

**후속**:

- ADR 16의 LeaderboardCache는 시즌 누적이라 던전 기여도와 별개. 던전 contribution은 캐시 없이 던전 페이지 진입 시 1회 조회 — 던전 활성 동안만 호출되는 페이지라 부하 미미.
- MissionLog에 `dungeonId` 컬럼 없음 → 기여도 집계가 `missionType + 시각 필터`에 의존. 정확도보다 단순함 우선. 두 던전이 같은 사용자에게 겹치는 시나리오(현 정책상 불가)에선 잔여 미션이 다른 던전의 기여도로 합산될 가능성 있음. Phase 2에서 컬럼 추가 검토.
- 자동 발령 임계(예비율 10%)는 한국 전력망에서 실제 발생 가능성 낮음. monitor가 항상 ALREADY_ACTIVE 또는 ABOVE_THRESHOLD 반환할 것 — 정상.
- D19 관리자 패널이 trigger·end 두 엔드포인트를 호출 (SC-13). 본인 user.id가 ADMIN_USER_IDS에 등록되어 있어야 시연 가능.
- UI(SC-09 던전 페이지 + 메인 배너)는 D18 후속 묶음. 메인 배너는 자체 /world/state 폴링 — CarbonClock의 useWorldState 훅과 통합은 메인 페이지 리팩토링 유발해 Phase 2.
- 와이어프레임의 "보상 2배 표기"는 reward-calculator의 `dungeonMultiplier=2.0`(D12 기 반영)으로 자동. UI는 baseReward × 2 표시.

---

## 18. 관리자 공룡 강제 조정 — applyEvolution 우회 + 인라인 timestamp 분기

**결정**: `/api/admin/dino` PATCH는 `lib/dino/evolution.ts`의 `applyEvolution`을 호출하지 않고, stage·hatchedAt·evolvedAt을 라우트 안에서 직접 분기 update한다. timestamp 규칙은 "기존값 유지, null이면 now" — EGG로 되돌릴 때만 두 timestamp 모두 클리어, HATCHLING/ADULT로 갈 때는 해당 단계에 필요한 timestamp가 null이면 now로 채우고 기존값은 보존. ADR 14의 "관리자 패널이 applyEvolution을 재사용한다"는 후속 가설을 뒤집는 결정.

**이유**:

- `applyEvolution`은 단방향 전제(EGG→HATCHLING→ADULT)로 설계됨. 시연 컨트롤은 임의 방향 전환이 의미 있는 동사(EGG로 되돌려 진화 연출 다시 보기). 단방향 함수를 양방향에 재사용하면 timestamp 일관성 깨짐.
- evolution.ts의 SSoT를 시연 도구가 깨지 않도록 보호. completer 트랜잭션이 호출하는 핵심 경로는 그대로 유지.
- "기존값 유지" 규칙으로 ADULT→HATCHLING→ADULT 왕복 같은 비정상 흐름에서도 `evolvedAt`이 첫 시점에 가깝게 보존되어 게임 이력처럼 보임 — 시연 일관성.
- 분기 로직 자체는 stage 3개 × timestamp 2개로 작아 인라인이 부담스럽지 않음. ADR 18(컴포넌트 추출 트리거)의 "두 번째 호출자가 등장하면 추출" 정책과 일관.

**대안**:

- `applyEvolution` 재사용 — 단방향만 안전, 역방향 시 timestamp 불일치.
- `applyEvolution`을 양방향 지원으로 확장 — completer 경로의 SSoT가 시연 컨트롤 요구사항으로 오염됨.
- `lib/dino/admin-adjust.ts` 같은 별도 함수로 추출 — 호출자가 한 곳(/api/admin/dino)뿐이라 추출 가치 낮음.

**후속**:

- "기존값 유지, null이면 now" 규칙의 알려진 한계: HATCHLING으로 되돌렸다가 다시 ADULT로 가면 `evolvedAt`이 첫 ADULT 시점이 아닌 두 번째 시점으로 박힘. 시연 토이에서 발생 가능성·영향 모두 미미라 정책으로 수용.
- `withAdmin` HOF가 D18 시점엔 NextRequest를 handler에 안 넘겼음. body 파싱이 필요한 PATCH/POST를 위해 시그니처를 `(ctx, req)`로 확장. 기존 dungeon/trigger·end 라우트는 `_req` 인자 추가만으로 호환.
- BRACHIO·TRICERA 활성화 시 stage select 옵션은 동일 — species는 별도 컬럼이라 관리자 컨트롤 범위 밖.

---

## 19. 통계 대시보드 — 라인차트 1개 우선, 히트맵 컷, recharts 도입

**결정**: SC-10 통계 대시보드를 4개 블록(상단 카드 3개·7일 탄소강도 라인차트·동네 평균 비교·NDR 시장 비교)으로 구성. 와이어프레임의 "차트 2 — 시간대별 활동 히트맵(Should)"은 D20 시점에 컷. 차트 라이브러리는 recharts. `/api/me/stats`·`/api/world/history` 별도 라우트 없이 page에서 prisma 직접 호출 (D17 리더보드 패턴 재사용). 7일 탄소강도는 시간별 평균으로 다운샘플(2,016행 → 168행)해 raw `$queryRaw`로 집계.

**이유**:

- D20은 일정상 "통계 대시보드 + 시연 시나리오 완주" 두 작업이 묶인 날. 통계에 시간 다 쓰면 시연 리허설을 못 함 → 시연 완주가 D24 영상 녹화 사전 검증으로 더 큰 가치.
- 히트맵은 와이어프레임도 "Should" 표기 = 필수 아님. D21 폴리싱 또는 Phase 2로 미뤄도 시연 시나리오에 영향 없음(SC-10 자체가 5분 시연 마지막 30초만 등장).
- recharts 채택: motion 도입(ADR 13)과 같은 논리 — "직접 구현보다 라이브러리가 시간 절약 + 시연 품질 확보". LineChart 1개에 30줄. React 19 호환.
- 별도 API 라우트 미작성: D17 리더보드에서 정한 "서버 컴포넌트가 lib 직접 호출, API self-loopback 회피" 정책 그대로. 통계 페이지 외 다른 호출자가 없으면 라우트는 죽은 코드.
- 시간별 다운샘플: 5분 단위 원본을 라인차트에 그대로 그리는 것 보다는 시간 평균이 추이 표현에 효율적.

**대안**:

- 히트맵 포함 — 일정 압박, 시연 비중 대비 비용 큼.
- Chart.js·SVG 자체 구현 — 전자는 React 래퍼 코드 필요, 후자는 시간 소모.
- `/api/me/stats`·`/api/world/history` 별도 라우트 — 다른 호출자 없는 시점에 작성은 ADR 18(컴포넌트 추출 트리거) "두 번째 호출자가 등장하면 추출" 정책과 어긋남.
- 5분 원본 그대로 표시 — 시각적 노이즈.

**후속**:

- 히트맵·NDR 차트(라인)는 D21 폴리싱 후보. 시간 남으면 추가, 안 남으면 Phase 2. 레포 구조의 `components/stats/ndr-comparison-chart.tsx` placeholder는 D20 시점에 단순 비교 카드(`ndr-comparison-card.tsx`)로 대체.
- raw `$queryRaw` 컬럼명: world_snapshots 테이블은 `@@map`으로 snake_case지만 컬럼(`carbonIntensity`)은 매핑 없이 camelCase. raw에서 큰따옴표로 감싸야 함.
- CLEAN_TO_KWH_RATIO(0.005)는 reward-calculator 평균 비율 추정값. NDR 카드 카피용 정밀도 부담 없음. 정식 환산이 필요하면 reward-calculator에서 상수 끌어와 통일.
- 동네 비교는 길드원 Dino.totalCleanEnergy 평균 — D16 길드 점수(합계)와 별개 집계. 같은 데이터에 두 집계가 공존하지만 한 화면에서만 평균을 쓰므로 SSoT 부담 없음.

---

## 24. 수집 파이프라인 — 가정용 회선에서 DB 직접 기록 (ADR 1 대체)

**결정**: KPX 수집을 독립 스크립트 `jobs/collect.ts`로 옮기고, 가정용 회선의 기기(홈서버 crontab, 준비 전까지는 개인 PC의 PowerShell 루프)에서 5분마다 실행한다. 스크립트는 KPX를 호출해 **DB에 직접** UPSERT하고 이어서 던전 모니터를 실행한다. Vercel의 `/api/ingest/world-snapshot`, `/api/cron/realtime`, `/api/cron/daily`, `vercel.json`의 cron, `CRON_SECRET`은 제거한다. Vercel은 호스팅만 맡는다.

스냅샷의 신선도는 저장 플래그(`isFallback`)가 아니라 읽는 시점에 판정한다. 최신 스냅샷이 15분(수집 3회분)을 넘기면 `/api/world/state`의 `world.isStale`이 true가 되고 화면에 "데이터 지연"을 표시한다. 지연 상태에서는 던전을 자동 발령하지 않는다.

**이유**:

- ADR 1의 구조는 "PC → Vercel 엔드포인트 → DB"로 한 단계가 더 있었다. 수집기가 DB 접속 정보를 가지면 중간 엔드포인트와 공유 비밀이 필요 없다.
- 던전 모니터는 `/api/cron/realtime`에서만 호출됐는데 이 라우트는 어디에도 스케줄되지 않았다. 실제 운영 경로(PC ingest)에서는 자동 발령과 sweep이 한 번도 실행되지 않았다. 수집 스크립트에 합쳐 실제로 동작하게 한다.
- 자정 미션 cron은 `/api/missions/today`의 lazy 발급과 같은 일을 했다. 접속하지 않은 사용자에게 미션을 미리 만들어 둘 이유가 없어 제거한다.
- `isFallback`은 한 번도 true로 기록된 적이 없었다. 수집기가 멈추면 플래그를 쓸 주체도 없으므로 읽는 쪽에서 판정해야 한다.

**대안**:

- 홈서버가 Vercel 엔드포인트를 호출하는 구조 유지 — 엔드포인트·비밀·함수 실행 시간 제한을 계속 관리해야 함.
- DB까지 홈서버로 이전 — Vercel 서버리스가 가정집 Postgres에 붙어야 해 노출·지연·커넥션 문제가 생김.

**후속**:

- `world_snapshots.isFallback` 컬럼은 더 이상 쓰지도 읽지도 않는다. DB 정합성 단계에서 삭제.
- 홈서버 준비 후 crontab 등록 + 수집 중단 알림(dead-man ping) 추가. 종료 코드(0/1)와 한 줄 JSON 로그가 그 연동 지점.
- 수집 기기에는 `DATABASE_URL`과 `KPX_API_KEY`가, Vercel에는 `KPX_API_KEY`·`CRON_SECRET`이 필요 없다.
- 일일 미션 중복 발급 방지는 여전히 앱 레벨 확인뿐이다. DB 정합성 단계에서 유니크 제약으로 보장.

---

## 25. KPX API를 공공데이터포털 게이트웨이로 이전 (ADR 6 대체)

**결정**: KPX D1·D2 호출 주소를 `openapi.kpx.or.kr`에서 공공데이터포털 게이트웨이 `apis.data.go.kr/B552115`로 바꾼다. D1은 `sukub5mMaxDatetime2/getSukub5mMaxDatetime2`, D2는 `sumperfuel5m/getSumperfuel5m`. 서비스 키도 새로 발급받은 것을 쓴다. D1·D2는 병렬로 호출하고, 재시도는 3초 간격 2회로 둔다.

**이유**:

- 2026-11-17 기준 이전 주소의 D2가 요청의 80% 이상에서 500("허용되지 않는 요청을 하셨습니다")을 반환했다. 5분 간격으로 6회 요청해도 전부 실패했고 요청 헤더를 바꿔도 같았다. 호출 빈도나 방식의 문제가 아니라 이전 서비스가 종료 수순이었던 것으로 보인다. ADR 6의 "간헐 500"도 같은 원인이었을 가능성이 높다.
- 새 주소는 같은 조건에서 매번 0.1~3초 안에 응답했다.
- 응답 형식은 거의 같다. D2의 최상위 태그가 `tbAllSumperfuel5mResponse`에서 `response`로 바뀌었고 항목에 `rn`이 추가됐다. 필드 이름과 단위는 그대로다.
- 이전 서버는 같은 키의 동시 호출을 거부해 D1 → 5초 대기 → D2로 직렬 호출했다. 새 게이트웨이는 동시 호출을 받으므로 대기를 없앴다. 수집 1회가 약 80초에서 4초로 줄었다.

**대안**:

- 이전 주소에 재시도를 늘려 버티기 — 5초 간격 8회 재시도로도 한 주기 성공률이 70%에 못 미쳤다.

**후속**:

- ADR 1·24의 "KPX가 클라우드 IP를 차단한다"는 전제는 이전 주소에서 확인한 것이다. 새 게이트웨이에서도 차단되는지는 확인하지 않았다. 차단되지 않는다면 수집을 클라우드(예: GitHub Actions 스케줄)에서 돌릴 수 있어 홈서버가 필수가 아니게 된다.
- 인증 실패 시 응답은 HTTP 403 + `OpenAPI_ServiceResponse` XML이다. 현재는 일반 HTTP 오류로 처리된다.

---

## 26. 수집 실행기 — GitHub Actions 스케줄 (ADR 24의 "가정용 회선" 대체)

**결정**: `jobs/collect.ts`를 GitHub Actions의 schedule(`*/5 * * * *`)로 실행한다. 홈서버 crontab 계획과 개인 PC의 PowerShell 루프는 폐기한다. 스크립트가 DB에 직접 기록하는 구조(ADR 24)는 그대로다.

**이유**:

- 홈서버가 필요했던 이유는 KPX의 클라우드 IP 차단뿐이었다. 새 게이트웨이(ADR 25)는 GitHub 러너에서 호출된다 — 2026-11-17에 수동 워크플로로 3회 모두 성공을 확인.
- 공개 레포라 실행 비용이 없고, 관리할 기기가 없다. 실패한 실행은 GitHub이 메일로 알려 수집 중단 알림을 따로 만들 필요가 없다.
- Vercel Cron은 Hobby 요금제에서 하루 1회만 가능하고, Phase 1에서 지운 라우트를 되살려야 한다.

**대안**:

- 홈서버 crontab — 주기가 정확하지만 기기 준비와 가동 관리가 필요.
- Vercel Cron(Pro) — 주기가 정확하지만 유료.

**후속**:

- GitHub의 schedule은 정시를 보장하지 않는다. 수 분 지연되거나 혼잡 시 건너뛸 수 있다. 화면의 "데이터 지연"이 자주 보이면 실행기를 옮긴다 — 스크립트는 어디서든 같은 것을 쓴다.
- 레포에 60일간 활동이 없으면 schedule이 자동으로 꺼진다. Actions 탭에서 다시 켠다.
- 실행마다 의존성 설치에 수십 초가 든다. 문제가 되면 수집 스크립트를 번들해 설치를 생략한다.
- DB 스키마를 바꿀 때는 수집 작업이 5분마다 같은 DB에 쓰고 있다는 점을 고려한다.

---

## 27. 수집 주기 20분 — 공공데이터포털 일일 한도 (ADR 26 보완)

**결정**: 수집 주기를 5분에서 20분으로 바꾼다. 지연 판정 기준은 "수집 3회분"을 유지해 15분에서 60분이 된다. KPX 호출 재시도는 1회로 줄인다.

**이유**:

- 공공데이터포털의 개발계정 한도가 API당 하루 100회다. 5분 주기는 하루 288회로 한도의 3배에 가깝다.
- 20분 주기는 하루 72회다. 남는 28회는 재시도와 로컬 수동 실행에 쓴다. 15분 주기(96회)는 여유가 4회뿐이라 재시도 몇 번이면 그날 수집이 멈춘다.
- 실패한 호출도 한도를 쓰므로 재시도를 줄였다.

**대안**:

- 운영계정 전환 신청으로 한도 상향 — 승인되면 주기를 다시 줄일 수 있다. `COLLECT_INTERVAL_MIN`과 워크플로의 cron 두 곳만 바꾸면 된다.

**후속**:

- KPX 원본은 5분 단위로 갱신되지만 우리는 20분마다 한 점만 저장한다. 통계의 시간별 평균은 시간당 3점으로 계산된다.
- 던전 자동 발령 판정도 20분 간격이 된다. 던전 만료는 조회 시점에 판정하므로 영향이 없다.

---

## 28. 정합성을 DB 제약으로 보장 (3단계 A)

**결정**: 앱 코드의 "확인 후 쓰기"에 맡겼던 정합성을 DB 제약으로 옮긴다. 마이그레이션 `20261117000000_integrity_constraints`.

- **일일 미션 중복 발급**: `missions.slot`(0=DAY, 1=EVENING, 2=ANYTIME) 컬럼과 `(userId, assignedDate, type, slot)` 유니크. 발급은 `skipDuplicates`로 한다. 던전 미션은 `slot`이 NULL이고 `(userId, dungeonId, poolId)` 유니크로 막는다.
- **던전 단일 활성**: 부분 유니크 인덱스 `dungeons_single_active`(`WHERE "isActive"`). 동시 발령 시 늦은 쪽은 유니크 위반을 잡아 먼저 만들어진 던전을 돌려준다.
- **보상 유실**: 미션 완료 트랜잭션이 Dino 행을 `SELECT ... FOR UPDATE`로 잠근 뒤 읽는다. 진화 판정이 읽은 값에 의존하므로 `increment`가 아니라 잠금을 택했다.
- **미션 완료 기록**: `mission_logs.missionId`를 Mission에 대한 FK(ON DELETE SET NULL) + 유니크로 바꾸고 NULL을 허용한다. `dungeonId` 컬럼을 추가해 던전 기여도를 시간 범위 추정 대신 직접 집계한다.
- `dungeons.triggerReason`은 VARCHAR에서 enum으로.

**이유**:

- 일일 미션 발급과 던전 발령은 "조회 → 없으면 생성" 구조라 동시 요청에 중복이 생길 수 있었다. 기본 격리 수준의 트랜잭션은 이를 막지 못한다.
- 미션 완료는 Dino의 누적값을 읽어 계산한 뒤 절대값으로 썼다. 한 사용자의 미션 두 개가 동시에 완료되면 로그는 2건인데 누적값에는 1건만 반영됐다.
- 시드의 더미 로그 676건은 `missionId`에 Mission이 아닌 MissionPool의 id를 넣고 있었다. 컬럼 이름과 실제 의미가 달랐고, 이 때문에 유니크를 걸 수 없었다. 가리키는 Mission이 없는 값은 NULL로 바꿨다 (완료 기록 자체는 남는다).

**대안**:

- 직렬화 격리 수준 — 재시도 로직이 필요하고 전체 성능에 영향.
- `missionId`에 FK 없이 유니크만 — 관리자 "미션 재생성"이 Mission을 지워도 로그가 사라진 id를 계속 들고 있게 된다.
- `slot`에 NOT NULL/CHECK — 배포 중 몇 분간 이전 코드가 `slot` 없이 발급할 수 있어 걸지 않았다.

**후속**:

- 적용 전 실제 데이터 확인: 일일 미션은 모두 사용자·날짜별 정확히 3개, 던전 미션 중복 없음, 활성 던전 0개였다. 기존 데이터에서 실제로 중복이 발견된 것은 없다.
- 배포 순서: Vercel 빌드가 마이그레이션을 먼저 적용하고 새 코드가 뒤따른다. 그 사이 이전 코드가 던전을 발령하면 enum 타입 불일치로 실패할 수 있다 (관리자 수동 발령뿐이라 영향 없음).
- 마이그레이션 SQL은 `prisma/migrations.test.ts`가 PGlite(메모리 Postgres)에서 실행해 검증한다. 마이그레이션 이전 형태의 데이터(더미 로그, 단일 활성 위반 던전 등)를 넣고 적용한 뒤 결과와 제약을 확인한다. 로컬 Postgres나 Docker 없이 `pnpm test`만으로 돌아간다.
- `users.regionCode`는 `guildId`와 중복이지만 남긴다. 한 지역에 길드 여러 개를 두는 기능을 염두에 둔 결정이다.

---

## 29. 중복 컬럼·캐시 테이블 삭제 (3단계 B, ADR 16의 캐시 폐기)

**결정**: 다른 데이터에서 다시 계산할 수 있는 사본과 쓰지 않는 컬럼을 지운다. 마이그레이션 `20261117010000_drop_redundant_columns`.

- `leaderboard_cache` 테이블, `guilds.seasonScore`·`scoreUpdatedAt` 삭제. 길드 점수는 조회할 때마다 길드원 `Dino.totalCleanEnergy`의 합으로 계산한다. 계산은 순수 함수 `lib/guilds/ranking.ts`로 분리. 화면의 "시즌 점수"는 "길드 점수"로 바꾼다.
- `world_snapshots.isFallback`·`temperature` 삭제, PK와 중복인 `ts` 인덱스 삭제.
- `users.regionCode`는 남긴다.

**이유**:

- 길드 점수가 세 곳(`Dino` 합계, `guilds.seasonScore`, `leaderboard_cache`의 JSON)에 있었다. 캐시가 만료될 때만 사본이 갱신돼, 그 사이에는 화면마다 다른 값을 볼 수 있었다. 길드 15개·사용자 수십 명 규모에서 집계는 쿼리 한 번이라 캐시가 필요 없다.
- "시즌 점수"라는 이름과 달리 시즌 개념(기간, 초기화)이 스키마에 없었다. 누적 점수로 두기로 하고 이름을 맞췄다. 시즌제는 기능 추가 단계의 후보.
- `isFallback`은 한 번도 true로 기록된 적이 없고, 지연 여부는 읽는 시점에 판정한다 (ADR 24). `temperature`는 수집한 적이 없다.
- `ts`는 PK라 이미 인덱스가 있고, B-tree는 양방향으로 읽으므로 DESC 인덱스가 따로 필요 없다.
- `users.regionCode`는 지금은 `guildId`와 중복이지만(지역과 길드가 1:1), 한 지역에 길드 여러 개를 두는 기능을 염두에 두고 남긴다.

**대안**:

- 캐시를 남기고 미션 완료 시 무효화 — 쓰기 경로가 복잡해지고, 지금 규모에서는 얻는 것이 없다.
- 사용자가 늘어 집계가 느려지면 그때 `guilds`에 점수 컬럼을 두고 미션 완료 트랜잭션에서 `increment`한다.

**후속**:

- 적용 전 운영 DB 확인: 저장된 길드 점수가 15개 길드 모두 계산값과 일치, `isFallback`은 전 행 false, `temperature`는 전 행 NULL. 지워지는 값 중 다시 만들 수 없는 것은 없다.
- 배포는 두 번에 나눈다. 필드를 뺀 코드를 먼저 배포하고, 그 뒤에 삭제 마이그레이션을 올린다. 이전 코드의 Prisma 클라이언트가 모든 컬럼을 SELECT하기 때문이다. 컬럼을 지우는 변경은 앞으로도 이 순서를 따른다.
- 한 지역에 길드 여러 개를 두려면 `guilds.regionCode`의 유니크 제약을 풀어야 한다.
