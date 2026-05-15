# 아키텍처 결정 기록

주요 결정 사항을 ADR(Architecture Decision Record) 형식으로 정리.
시간이 지나서 "왜 이렇게 했지?"를 다시 확인할 때 보는 문서.

각 항목은 **결정 / 이유 / 대안 / 후속**으로 구성.

---

## 1. 외부 데이터 파이프 — 본인 PC에서 ingest

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

## 6. KPX D2 간헐 500 회피 — 다층 처방

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

- 27개 API 명세서에 이미 `/api/auth/{signup,signin,signout,reset-password}` 4개가 박혀 있어 일관성.
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

- middleware는 API Route 포함 모든 요청을 통과한다. 거기서 redirect를 박으면 401 JSON을 반환해야 할 API 호출이 HTML redirect로 변질됨.
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
