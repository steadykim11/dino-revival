# 아키텍처 결정 기록

D1~D6 동안 내린 주요 결정 사항을 가볍게 ADR(Architecture Decision Record) 형식으로 정리.
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

## 시연 시나리오 (5분)

| 시간      | 내용                        | 화면          |
| --------- | --------------------------- | ------------- |
| 0:00~0:30 | 컨셉 소개                   | SC-01 → SC-02 |
| 0:30~1:00 | 가입·온보딩                 | SC-03 → SC-04 |
| 1:00~2:00 | 메인 + 탄소시계 + 공룡 소개 | SC-05         |
| 2:00~3:00 | 미션 클리어 → 전투          | SC-06 → SC-07 |
| 3:00~3:30 | 진화 연출                   | SC-08         |
| 3:30~4:30 | 던전 발령(수동) → 진입      | SC-13 → SC-09 |
| 4:30~5:00 | 통계·리더보드               | SC-10 → SC-11 |

던전은 실제 예비율 10% 미만 발생 가능성이 거의 없으므로 관리자 패널(`/admin`)의 수동 트리거를 시연 중 사용.

---

## Phase 2 후보

MVP 완료 후 시간 여유 시 검토:

- Redis(Upstash) 캐시 — 리더보드 캐시 등
- WebSocket — 던전 발령 실시간 알림
- NestJS 백엔드 분리 — 도메인 로직과 Next.js의 결합도 낮춤
- OAuth 로그인 — 카카오·Google
- 데스크톱 2열 레이아웃
- 시간대별 활동 히트맵 (SC-10 차트 2)
- 주간 피크 전망 자동 갱신

---

## Week 1 회고 (D1~D7)

### 진척 — 일정대로

D1~D7을 일정 그대로 마무리. 큰 reschedule 없음.

- D1: 셋업·배포·헬스체크
- D2: Prisma 스키마 9개 + 시드 (미션 풀 15·길드 15)
- D3: KPX D1·D2 클라이언트 (Zod 검증, XML 파싱)
- D4: WorldSnapshot 적재 파이프 (PC 루프 + Vercel ingest 엔드포인트)
- D5: /api/world/state + 탄소 시계 컴포넌트 + 메인 페이지 골격
- D6: 전역 레이아웃(헤더·탭바·사이드바) + 주간 피크 전망 데이터 도입
- D7: 데이터 안정성 스폿 체크 + 문서화

### 도중에 변경된 결정

- **D6의 "D3 API + 피크 시간대 표시"** 일정 항목이 "주간 피크 전망 정적 자료 + 메인에 부가 정보 표시"로 재정의됨. 사유는 ADR 8 참조. 일정 영향 없음.
- **전역 레이아웃**이 일정표에 명시되어 있지 않았는데 D6에 흡수. 자연스러운 통합이라 부담 없었음.

### 발견된 트레이드오프와 처방

- **KPX D2 간헐 500**: D5 패치 4가지(UA 헤더, 대기 1초, retry true, libuv 어설션 회피)로 처방. D17 무렵 본격 누적 시 추가 관찰.
- **fuelMixPercent 분모 정합성**: 표시용과 계산용이 다를 뻔 했음. ADR 3에서 통일.
- **데스크톱 레이아웃 폭**: 콘텐츠 폭 늘리기 vs 고정 vs 2열 — 시간 비용 고려해 고정으로(ADR 7), 본격 디자인은 D21로.

### Week 2 전 남은 risk

- **인증 도입 시 (main) 라우트 가드**: 현재 layout에 가드 없음. D8에 작업 예정. SC-05가 비인증으로도 접근되는 상태라 안 통제하면 D9 이후 페이지 추가 시 혼란.
- **세션 정책**: HTTP-only 쿠키 사용 결정만 됐고 만료·갱신 정책 미정. D8에 결정.
- **관리자 권한**: `ADMIN_USER_IDS` 환경변수 화이트리스트 정책만 결정. 실제 미들웨어는 D19.
- **메인 화면 폴링 비용**: 5초 간격 + 인증 도입 시 사용자별 세션 검증이 매 요청마다 발생. /api/world/state는 Public이라 면제(ADR 5)지만 다른 핫 엔드포인트(/api/missions/today 등)는 캐싱 정책 별도 검토 필요.

### Week 2 진입 전 체크

- [ ] `.env.example`을 Vercel 환경변수와 diff
- [ ] `.env.local`이 git 히스토리에 들어간 적 없는지 `git log -- .env.local`로 확인
- [ ] `pnpm build` 무에러
- [ ] 시연 영상 녹화 환경 준비 — 모바일 시뮬레이션 또는 실제 폰
- [ ] D8 들어가기 전 Supabase Auth 설정 화면 한 번 둘러보기

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
- 그룹의 장점(URL에서 안 보임)이 오히려 단점으로 작용한 케이스. 예상 레포 구조의 `(onboarding)` 표기는 정정.

**대안**: SC-12를 `/settings`로 옮김 — 요약본·와이어프레임의 "프로필/설정" 명명이 바뀜.

**후속**: D9에서 `/onboarding`을 SC-03 프로필 등록 화면으로 본격 구현.

---

## Week 2 진입 회고 (D8)

### 진척 — 일정대로

D8 일정인 "Supabase Auth, 가입·로그인" 끝. 산출물:

- `lib/auth/` 3개 (supabase-server·supabase-client·require-user)
- `middleware.ts` (토큰 자동 갱신)
- `/api/auth/{signup,signin,signout,reset-password}` 4개
- `(auth)/{signup,signin,reset-password}` 페이지 3개 + `(auth)/layout.tsx`
- `onboarding/{layout,page}` (SC-03 stub)
- `(main)/layout.tsx`에 인증 가드 추가

시연 흐름 전 단계 동작 확인: `/` → `/signin` redirect → 가입 → `/onboarding` → 로그아웃 → `/signin`.

### 도중에 변경된 결정

- **예상 레포 구조의 `(onboarding)` 그룹**: SC-12 `/profile`과 URL 충돌. 일반 디렉토리 `onboarding/`으로 정정 (ADR 13).
- **Supabase 클라이언트 함수명**: `createClient` 단일에서 환경별 명명으로 변경 (ADR 11).
- **OAuth 영역**: Could 우선순위지만 와이어프레임 SC-02에 자리 있음 → "Phase 2" 라벨로 disabled 버튼 자리 표시.

### Week 1 회고에서 짚었던 risk 처리

- ✅ (main) 라우트 가드: ADR 12로 정리.
- ✅ 세션 정책: HTTP-only 쿠키, 만료는 `@supabase/ssr` 기본값(access 1h, refresh 60d) + middleware 자동 갱신. 추가 정책 불필요.
- ◯ 관리자 권한: D19에 처리 예정 — 변경 없음.
- ◯ 메인 화면 폴링 비용: `/api/world/state`만 Public이라 영향 없음 — 변경 없음.

### D9 진입 전 남은 갭

- **인증된 사용자가 User row 없이 `/` 직접 접근 가능**: 의도된 갭. D9에서 `(main)/layout.tsx`에 "User row 없으면 `/onboarding` redirect" 추가하면 막힘.
- **`/api/me` 엔드포인트 없음**: D9 첫 작업. 인증된 사용자의 프로필 조회·갱신용.
- **로그아웃 버튼 위치**: 임시로 `onboarding/page.tsx`에 박혀 있음. 정식 위치는 SC-12 프로필 페이지 — D9 이후.
- **랜딩 SC-01 URL**: A안(생략)으로 D8 진행. D9 또는 D21에 결정.

### D9 들어가기 전 체크

- [ ] `pnpm build` 무에러
- [ ] Supabase Auth Users 페이지에서 D8 테스트 계정 정리 (또는 D9 테스트용으로 일부 유지)
- [ ] `.env.local`과 `.env.example` diff 재확인 — D8에 추가된 환경변수 없음 (Supabase 키는 D1부터)
