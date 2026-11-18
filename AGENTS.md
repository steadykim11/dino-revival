# 디노 리바이벌 — 작업 지침

DR(전력수요반응) 게이미피케이션 토이 프로젝트. 한국 전력망 실시간 데이터(KPX)가 게임 세계의 환경이 되고, 사용자는 절전 미션으로 공룡을 키운다. 현재 MVP를 단계적으로 리팩터링하는 중이다.

## 스택

- Next.js **15.5** (App Router) + React 19 + TypeScript. Next 16이 아니다 — `middleware.ts`, 비동기 `cookies()`/`params` 등 15 기준 API를 쓴다.
- Prisma 6 + Supabase Postgres, Supabase Auth (`@supabase/ssr`)
- Tailwind 4, zod 4, motion, recharts
- Vitest, ESLint 9 (flat config), pnpm, Node 22

## 명령어

```bash
pnpm check        # typecheck + lint + test — 변경 후 항상 실행
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint .
pnpm test         # vitest run (운영 DB·외부 API 호출 없음. 마이그레이션은 메모리 Postgres로 검증)
pnpm dev          # 개발 서버
pnpm db:migrate   # prisma migrate dev (.env.local 사용)
```

`pnpm build`는 `prisma migrate deploy`를 포함하므로 실제 DB에 마이그레이션을 적용한다. 검증 목적으로 실행하지 말 것.

## 작업 방식

- 한 번에 한 단계만. 단계마다 `refactor/<단계>` 브랜치를 쓰고, 범위를 먼저 합의한 뒤 구현한다.
- 구현 후 `pnpm check`를 통과시키고, 사용자가 검토한 뒤에 커밋한다. 커밋·푸시는 요청받았을 때만 한다.
- 리팩터링과 동작 변경을 한 커밋에 섞지 않는다. 범위 밖에서 발견한 문제는 고치지 말고 보고한다.
- 새 로직은 순수 함수로 분리해 테스트와 함께 추가한다. 테스트 파일은 대상 옆에 `*.test.ts`로 둔다.
- 브라우저 테스트 환경(jsdom 등)은 없다. 컴포넌트는 `renderToString`으로 첫 렌더링 결과만 검사하고(`*.test.tsx`), 타이머·폴링 같은 로직은 React 밖의 모듈로 빼서 가짜 타이머로 검사한다 (예: `lib/world/state-poller.ts`).
- 마이그레이션은 `prisma/migrations.test.ts`가 메모리 Postgres(PGlite)에서 실제로 실행해 검증한다. 기존 데이터를 바꾸거나 제약을 추가하는 마이그레이션은 여기에 검증을 덧붙인다.
- 결정 사항은 `docs/architecture.md`(ADR)에 기록한다. 기존 결정을 뒤집을 때도 이유를 남긴다.

## 구조 규칙

4단계 이후 기존 코드도 아래 규칙을 따른다. 규칙 1과 "UI는 Prisma 타입을 쓰지 않는다"는 ESLint가 검사한다.

1. **DB 접근은 `lib/` 안에서만.** `app/`과 `components/`는 `prisma`를 import하지 않고 `lib`의 이름 붙은 함수를 호출한다. DB에 접근하는 파일은 `*.server.ts`로 이름 짓고, 클라이언트 컴포넌트에서의 import는 ESLint 규칙으로 막는다. (`server-only` 패키지는 쓰지 않는다 — `jobs/`가 일반 Node로 같은 파일을 실행하는데 그 환경에서는 예외를 던진다.)
2. **읽기는 서버 컴포넌트가 `lib`을 직접 호출, 쓰기는 Route Handler.** 자기 화면만 쓰는 GET 라우트를 새로 만들지 않는다. (쓰기를 Route Handler로 두는 이유는 ADR 10.)
3. **세션 확인은 헬퍼로.** 페이지·레이아웃은 `lib/auth/session.server.ts`의 `requireSession`/`getSession`/`getAuthUser`를 쓴다. Route Handler는 래퍼(규칙 4)가 대신 확인한다. `supabase.auth.getUser()`를 직접 부르지 않는다.
4. **모든 Route Handler는 `lib/http/route.ts`의 `route()`로 감싼다.** `route({ auth: "public" | "user" | "admin", body: zodSchema }, async ({ req, user, body }) => ...)`. 인증·JSON 파싱·zod 검증·예외 처리를 라우트에서 손으로 쓰지 않는다. 도메인 오류는 `errorResponse(code, message, status)`로 돌려준다. 에러 응답 형식은 `{ error: { code, message, details? } }`.
5. **월드 상태는 `WorldStateProvider` 하나로.** 첫 값은 서버 컴포넌트가 `readWorldState()`로 읽어 넘기고, 이후 갱신은 Provider만 `/api/world/state`를 폴링한다(30초). 컴포넌트는 `useWorldState()`로 받고 직접 폴링하지 않는다. 시간에 따라 바뀌는 표시는 `useNow()`를 쓴다 — 서버와 브라우저의 첫 렌더링 결과가 같아야 한다.

그 밖에:

- 타입·상수는 도메인 폴더(`lib/<도메인>/`)에 둔다. UI는 `@prisma/client` 타입 대신 도메인 타입을 쓴다.
- 같은 상수·계산을 두 곳에 두지 않는다 (전장 임계값, 닉네임 규칙, KST 날짜 계산 등).
- 시간은 DB에 UTC로 저장하고 KST 변환은 `lib/time/kst.ts`만 쓴다.

## DB 규칙

- 스키마 변경은 Prisma 마이그레이션으로만 한다. Supabase 대시보드에서 직접 고치지 않는다.
- **새 테이블을 만드는 마이그레이션에는 `ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;`를 반드시 넣는다.** Supabase는 `public` 스키마를 anon key로 REST 노출한다. 정책은 만들지 않는다 — 앱은 Prisma(소유자 역할)로만 접근한다.
- 정합성(중복 방지, 단일 활성 등)은 앱 코드가 아니라 DB 제약으로 보장한다.
- 누적값 갱신은 읽고 덮어쓰지 말고 `increment` 또는 행 잠금을 쓴다. (미션 완료는 Dino 행을 `FOR UPDATE`로 잠근다.)
- 부분 유니크 인덱스처럼 Prisma 스키마로 표현할 수 없는 제약은 마이그레이션 SQL에 직접 쓰고 스키마 주석에 남긴다. `prisma migrate dev`는 운영 DB를 가리키는 `.env.local`로 실행하지 않는다 — SQL은 `prisma migrate diff`로 초안을 뽑아 손으로 다듬는다.
- 테이블은 snake_case(`@@map`), 컬럼은 camelCase다. raw SQL에서는 컬럼명을 큰따옴표로 감싼다.

## 인프라

- Vercel은 호스팅만 맡는다. Vercel Cron과 수집용 API 라우트는 없다.
- 수집은 GitHub Actions가 한다. `.github/workflows/collect.yml`이 20분마다 `jobs/collect.ts`를 실행해 KPX를 호출하고 DB에 직접 기록한 뒤 던전 모니터를 돌린다 (ADR 24·26). Secrets는 `DATABASE_URL`, `KPX_API_KEY`. **공공데이터포털 한도는 API당 하루 100회**라 주기를 20분(하루 72회)으로 둔다 — 주기를 줄이거나 재시도를 늘리기 전에 이 한도를 확인할 것.
- `jobs/`는 Next와 무관하게 `tsx`로 실행된다. 여기서 import하는 `lib` 코드는 Next 전용 API(`next/headers`, `server-only` 등)에 의존하면 안 된다.
- GitHub의 schedule은 정시를 보장하지 않는다(지연·건너뜀 가능). 로컬에서는 `pnpm job:collect`로 1회 실행할 수 있고, `--dry-run`을 붙이면 DB에 쓰지 않는다. 이전의 "KPX가 클라우드 IP를 차단한다"는 제약은 새 주소(`apis.data.go.kr`)에는 해당하지 않는다 (ADR 25).
- 일일 미션은 자정 cron 없이 홈 화면을 열 때 발급된다 (`getTodayMissions`).

## 로드맵

| 단계 | 내용 | 상태 |
|---|---|---|
| 0 | 안전망: Vitest, CI, 지침 정리, RLS 마이그레이션 | 완료 |
| 1 | 수집 이전: `jobs/` 신설, Vercel cron·ingest 제거, 데이터 지연 표시, GitHub Actions 스케줄 수집 | 완료 |
| 2 | 구조 전반부: DB 접근을 `lib`으로 모으기(규칙 1), 세션 헬퍼(규칙 3) | 완료 |
| 3 | DB 정합성: 유니크 제약, 행 잠금, 중복 컬럼·캐시 테이블 정리 | 완료 (운영 DB 적용 확인 2026-11-17) |
| 4 | 구조 후반부: 규칙 2·4·5, 타입·파일 재배치, ADR 정리 | 완료 (2026-11-18) |
| 5 | 기능 추가 | |

단계를 마치면 이 표의 상태를 갱신한다.

### 남은 정리

- [ ] Vercel 환경변수 `CRON_SECRET`, `KPX_API_KEY`, `VERCEL_INGEST_URL`, `SUPABASE_SERVICE_ROLE_KEY` 삭제 (선택).

### 3단계 진행 상황

3단계는 PR 두 개로 나눈다. 20분마다 수집 작업이 같은 DB에 쓰고 있으므로, 스키마 변경은 이전 코드와 새 코드가 모두 동작하는 순서로 적용한다.

- **3-A (제약 추가, 데이터 삭제 없음)** — 완료, 운영 DB 적용 확인(2026-11-17). 마이그레이션 `20261117000000_integrity_constraints`. 내용은 ADR 28.
- **3-B (중복 컬럼·테이블 삭제)** — 완료, 운영 DB 적용 확인(2026-11-17). 내용은 ADR 29. 배포를 두 번에 나눴다:
  1. 코드와 Prisma 스키마에서 필드를 뺀 커밋을 먼저 배포한다 (마이그레이션 없음).
  2. 그 배포가 끝난 뒤 삭제 마이그레이션 `20261117010000_drop_redundant_columns`를 올린다.
  순서를 지키는 이유: 이전 코드의 Prisma 클라이언트는 모든 컬럼을 SELECT하므로, 컬럼을 먼저 지우면 새 코드가 배포될 때까지 조회가 실패한다. **컬럼이나 테이블을 지우는 변경은 앞으로도 이 순서로 한다.**
- `users.regionCode`는 **삭제하지 않는다** (2026-11-17 결정). 지금은 지역과 길드가 1:1이라 `guildId`와 중복이지만, 한 지역에 길드 여러 개를 두는 기능을 5단계 후보로 남겼다. 그때는 `guilds.regionCode`의 유니크 제약을 풀어야 한다.
- 길드 점수는 누적 점수다 (2026-11-17 결정). 저장하지 않고 조회 시 계산한다 (`lib/guilds/ranking.ts`). 시즌제는 5단계 후보.

## 알려진 문제 (해당 단계에서 수정)

- `lib/static-data/weekly-peak-forecast.ts` 데이터가 2026-05-17에 끝나 "오늘의 예상 피크"가 비어 있다 (5단계, KPX `forecastLoad`로 대체 검토).
