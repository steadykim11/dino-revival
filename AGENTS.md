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
pnpm test         # vitest run (DB·외부 API 호출 없음)
pnpm dev          # 개발 서버
pnpm db:migrate   # prisma migrate dev (.env.local 사용)
```

`pnpm build`는 `prisma migrate deploy`를 포함하므로 실제 DB에 마이그레이션을 적용한다. 검증 목적으로 실행하지 말 것.

## 작업 방식

- 한 번에 한 단계만. 단계마다 `refactor/<단계>` 브랜치를 쓰고, 범위를 먼저 합의한 뒤 구현한다.
- 구현 후 `pnpm check`를 통과시키고, 사용자가 검토한 뒤에 커밋한다. 커밋·푸시는 요청받았을 때만 한다.
- 리팩터링과 동작 변경을 한 커밋에 섞지 않는다. 범위 밖에서 발견한 문제는 고치지 말고 보고한다.
- 새 로직은 순수 함수로 분리해 테스트와 함께 추가한다. 테스트 파일은 대상 옆에 `*.test.ts`로 둔다.
- 결정 사항은 `docs/architecture.md`(ADR)에 기록한다. 기존 결정을 뒤집을 때도 이유를 남긴다.

## 구조 규칙

아래는 목표 상태다. 기존 코드는 아직 다 따르지 않으며(로드맵 참조), **새로 쓰거나 고치는 코드는 반드시 따른다.**

1. **DB 접근은 `lib/` 안에서만.** `app/`과 `components/`는 `prisma`를 import하지 않고 `lib`의 이름 붙은 함수를 호출한다. DB에 접근하는 파일은 `*.server.ts`로 이름 짓고, 클라이언트 컴포넌트에서의 import는 ESLint 규칙으로 막는다. (`server-only` 패키지는 쓰지 않는다 — `jobs/`가 일반 Node로 같은 파일을 실행하는데 그 환경에서는 예외를 던진다.)
2. **읽기는 서버 컴포넌트가 `lib`을 직접 호출, 쓰기는 Route Handler.** 자기 화면만 쓰는 GET 라우트를 새로 만들지 않는다. (쓰기를 Route Handler로 두는 이유는 ADR 10.)
3. **세션 확인은 헬퍼로.** 페이지·레이아웃은 `lib/auth/session.server.ts`의 `requireSession`/`getSession`/`getAuthUser`를, Route Handler는 `lib/auth/require-user.ts`의 `requireUser`를 쓴다. `supabase.auth.getUser()`를 직접 부르지 않는다.
4. **라우트 보일러플레이트는 래퍼 하나로.** 인증·JSON 파싱·zod 검증·에러 응답을 라우트마다 손으로 쓰지 않는다.
5. **월드 상태 폴링은 Provider 하나로.** 컴포넌트가 각자 `/api/world/state`를 폴링하지 않는다.

그 밖에:

- 타입·상수는 도메인 폴더(`lib/<도메인>/`)에 둔다. UI는 `@prisma/client` 타입 대신 도메인 타입을 쓴다.
- 같은 상수·계산을 두 곳에 두지 않는다 (전장 임계값, 닉네임 규칙, KST 날짜 계산 등).
- 시간은 DB에 UTC로 저장하고 KST 변환은 `lib/time/kst.ts`만 쓴다.

## DB 규칙

- 스키마 변경은 Prisma 마이그레이션으로만 한다. Supabase 대시보드에서 직접 고치지 않는다.
- **새 테이블을 만드는 마이그레이션에는 `ALTER TABLE "<table>" ENABLE ROW LEVEL SECURITY;`를 반드시 넣는다.** Supabase는 `public` 스키마를 anon key로 REST 노출한다. 정책은 만들지 않는다 — 앱은 Prisma(소유자 역할)로만 접근한다.
- 정합성(중복 방지, 단일 활성 등)은 앱 코드가 아니라 DB 제약으로 보장한다.
- 누적값 갱신은 읽고 덮어쓰지 말고 `increment` 또는 행 잠금을 쓴다.
- 테이블은 snake_case(`@@map`), 컬럼은 camelCase다. raw SQL에서는 컬럼명을 큰따옴표로 감싼다.

## 인프라

- Vercel은 호스팅만 맡는다. Vercel Cron과 수집용 API 라우트는 없다.
- KPX가 클라우드 IP를 차단하므로 수집은 가정용 회선에서 한다. `jobs/collect.ts`(`pnpm job:collect`)가 5분마다 KPX를 호출해 DB에 직접 기록하고 던전 모니터를 실행한다 (ADR 24).
- `jobs/`는 Next와 무관하게 `tsx`로 실행된다. 여기서 import하는 `lib` 코드는 Next 전용 API(`next/headers`, `server-only` 등)에 의존하면 안 된다.
- 현재 실행기는 개인 PC의 `scripts/run-collect-loop.ps1`이다. 홈서버가 준비되면 crontab으로 옮기고 수집 중단 알림을 붙인다 (미완).
- 일일 미션은 자정 cron 없이 `/api/missions/today` 접속 시에만 발급된다.

## 로드맵

| 단계 | 내용 | 상태 |
|---|---|---|
| 0 | 안전망: Vitest, CI, 지침 정리, RLS 마이그레이션 | 완료 |
| 1 | 수집 이전: `jobs/` 신설, Vercel cron·ingest 제거, 데이터 지연 표시 | 진행 중 (crontab 등록은 홈서버 준비 후) |
| 2 | 구조 전반부: DB 접근을 `lib`으로 모으기(규칙 1), 세션 헬퍼(규칙 3) | 완료 |
| 3 | DB 정합성: 유니크 제약, increment, 중복 컬럼·캐시 테이블 정리 | |
| 4 | 구조 후반부: 규칙 2·4·5, 타입·파일 재배치, ADR 정리 | |
| 5 | 기능 추가 | |

단계를 마치면 이 표의 상태를 갱신한다.

## 알려진 문제 (해당 단계에서 수정)

- `components/dungeon/dungeon-banner.tsx`의 `if (!cancelled) return;` 조건이 반대라 배너가 갱신되지 않는다 (4단계, Provider 도입 시).
- `/admin`은 비로그인 상태에서 404가 아니라 500을 낸다 (`requireUser`가 던진 예외를 페이지가 처리하지 않음, 4단계).
- `lib/types/api.ts`의 응답 필드명 `datails`는 `details`의 오타다 (4단계, 라우트 래퍼 도입 시).
- 미션 완료의 보상 유실, 일일 미션 중복 발급, 던전 단일 활성 미보장 (3단계).
- `lib/static-data/weekly-peak-forecast.ts` 데이터가 2026-05-17에 끝나 "오늘의 예상 피크"가 비어 있다 (5단계, KPX `forecastLoad`로 대체 검토).
