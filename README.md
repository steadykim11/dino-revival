# 디노 리바이벌 (Dino Revival)

DR(전력수요반응)을 게이미피케이션으로 풀어낸 토이 프로젝트.
6,600만 년 전 멸종한 공룡들이 기후위기를 감지하고 깨어나 인류와 함께 싸운다는
설정으로, 일상의 절전 행동을 통해 공룡에게 클린 에너지를 공급해 함께 성장한다.
실시간 한국 전력망 데이터(탄소강도·예비율)가 게임 세계의 환경으로 작용한다.

- **버전**: 1.0 (MVP)
- **상태**: 개발 중 (24일 일정, 2026-05-01 ~ 2026-05-25)
- **목적**: 포트폴리오용 시연 프로젝트

## 기술 스택

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- Supabase Postgres + Prisma 6.x
- Supabase Auth (이메일/비밀번호)
- Vercel (호스팅)
- pnpm

## 셋업

### 1. 사전 준비물

- Node.js 22+
- pnpm 9+
- Supabase 프로젝트 (Postgres + Auth)
- 공공데이터포털 API 키 (전력거래소 "현재전력수급현황", "발전원별 발전량" 활용신청 필요)
- Vercel 계정 (배포)

### 2. 클론 및 의존성 설치

```bash
git clone <repo-url>
cd dino-revival
pnpm install
```

### 3. 환경변수 설정

`.env.example`을 `.env.local`로 복사하고 값을 채웁니다.

```bash
cp .env.example .env.local
```

각 키의 의미는 `.env.example`의 주석 참조.

### 4. DB 마이그레이션 + 시드

```bash
pnpm prisma migrate deploy        # 또는 dev 환경에선 migrate dev
pnpm prisma db seed
```

시드는 미션 풀(15개)과 길드(15개)를 채웁니다. 더미 사용자는 D15 작업으로 별도 시드.

### 5. 개발 서버

```bash
pnpm dev
```

http://localhost:3000 접속.

### 6. KPX 데이터 적재

운영 환경에서는 GitHub Actions(`.github/workflows/collect.yml`)가 20분마다 수집 작업을 실행합니다(공공데이터포털 한도가 API당 하루 100회). 작업은 KPX를 호출해 DB에 직접 기록하고, 던전 만료 정리와 자동 발령도 함께 처리합니다. 레포 Secrets에 `DATABASE_URL`과 `KPX_API_KEY`가 필요합니다.

로컬에서 직접 실행할 수도 있습니다.

```bash
pnpm job:collect             # 1회 실행 (.env.local의 DATABASE_URL, KPX_API_KEY 사용)
pnpm job:collect --dry-run   # KPX만 호출하고 DB에는 쓰지 않음
```

상세 결정은 `docs/architecture.md`의 ADR 24~26 참조.

수집이 60분 넘게 멈추면 메인 화면의 탄소 시계에 "데이터 지연"이 표시됩니다. 스냅샷이 하나도 없으면 `/api/world/state`는 503을 반환하고, 메인 화면은 "데이터 준비 중입니다" 스켈레톤을 표시합니다.

## 디렉토리 구조

```
app/
  api/            # API 라우트
  (auth)/         # 비로그인 페이지 (로그인·가입 등)
  onboarding/   # 온보딩 (프로필 등록, 알 선택)
  (main)/         # 로그인 후 페이지 + 공통 레이아웃
  admin/          # 관리자 패널 (시연용)
components/
  admin/          # 관리자 시연용
  layout/         # 헤더·탭바·사이드바
  world/          # 탄소 시계 등 월드 관련
  dino/           # 공룡 표시·진화 컷씬
  missions/       # 미션 카드·바텀시트·모달
  battle/         # 전투
  dungeon/        # 던전 배너·페이지 요소
  leaderboard/    # 길드/전국 리더보드
  stats/          # 통계 차트
  profile/        # 이름, 지역 등 온보딩 요소
lib/
  auth/           # 계정 인증 및 세션 유지
  battle/         # 전투 출현 적 도메인
  external/       # KPX 외부 API
  world/          # 월드 상태 도메인 로직
  dino/           # 공룡 도메인
  missions/       # 미션 선정·보상 로직
  dungeon/        # 던전 도메인
  guilds/         # 길드 도메인
  static-data/    # 정적 자료 (배출계수, 주간 피크 전망 등)
  http/           # Route Handler 래퍼·에러 응답
  types/          # 도메인 타입
  time/           # KST 시간 유틸
  profile/        # 닉네임/동네 변경 쿨다운 상태
  stats/          # 통계 도메인
  users/          # 시드용 더미 유저 풀
prisma/
  schema.prisma   # DB 스키마
  seeds/          # 시드 스크립트
jobs/             # 수집 작업 (Next와 무관하게 실행)
scripts/          # 수동 실행 스크립트
docs/             # 의사결정 기록·자료 출처
public/
  images/         # 스프라이트 이미지
```

자세한 의사결정 기록은 `docs/architecture.md` 참조.

## 주요 스크립트

```bash
pnpm dev                    # 개발 서버
pnpm build                  # 프로덕션 빌드
pnpm check                  # 타입 체크 + ESLint + 테스트 (커밋 전 실행)
pnpm typecheck              # 타입 체크만
pnpm lint                   # ESLint
pnpm test                   # Vitest (DB·외부 API 불필요)

pnpm prisma migrate dev     # DB 스키마 변경 시
pnpm prisma db seed         # 시드 (멱등)
pnpm prisma studio          # DB 브라우저 GUI
```

## 시연

던전은 실제 발생 가능성이 낮아 관리자 패널(`/admin`)의 수동 트리거를 사용합니다.

## 라이선스

[MIT License](./LICENSE)
