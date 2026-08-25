# 기술특허 개발게이트 교육용 데모 구현 계획

## Global Constraints

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM, Zod, libSQL/Turso를 사용한다.
- 로컬은 SQLite `file:` URL, Vercel은 Turso URL/토큰을 사용하는 동일 저장소 인터페이스를 사용한다.
- 공개 데모는 방문자별 합성 FPCB 프로젝트만 사용하고 24시간 후 만료하며 임의 파일 업로드를 금지한다.
- 역할은 PRACTITIONER, RESPONSIBLE, TEAM_LEAD, IP_LEGAL, QA이며 실제 인증이 아닌 데모 전환으로 표시한다.
- 단계는 PLANNING, DESIGN, TEST, APPROVAL이며 순차 승인을 강제한다.
- 상태 타입은 사용자 확정본의 Role, Phase, GateStatus, RiskLevel, JobStatus, ClaimElementStatus 값을 정확히 사용한다.
- Critical/High는 IP/법무 승인 후 개발팀장이 최종 승인하며 조건부 승인을 허용하지 않는다.
- Medium/Low만 1–30일 조건부 승인이 가능하고 생산·출시일을 넘을 수 없다.
- UNKNOWN, 증거 없는 PRESENT/PARTIAL, 7일을 초과한 법적 상태는 최종 승인을 차단한다.
- 모든 수정은 version과 Idempotency-Key를 사용하고 오래된 version은 409 VERSION_CONFLICT를 반환한다.
- 공개 데모 기본은 합성 검색이며 실시간 검색은 할당량을 적용한다. 모든 외부 작업은 최대 2회 지수 백오프 재시도 후 수동/샘플 경로를 연다.
- Gemini에는 합성 또는 비식별 텍스트만 명시적 확인 후 전송하고, 인용·신뢰도·`AI 초안` 표시를 강제한다.
- PC 1280px 이상 전용 UI를 제공하고 모바일에서는 PC 이용 안내를 표시한다.
- 내장 FPCB 샘플로 기획부터 승인 패키지까지 완주하는 E2E를 제공한다.

## Task 1: App scaffold and domain rules

- Next.js App Router 프로젝트, 패키지 스크립트, Tailwind, Vitest, Playwright, ESLint, 환경변수 예시를 구성한다.
- `src/domain` 아래에 공개 상태 타입과 Gate 판정, 조건부 승인, 법적 상태 신선도, revision stale 규칙을 순수 함수로 구현한다.
- 합성 FPCB 프로젝트 픽스처를 단일 소스로 정의한다.
- 도메인 규칙은 반드시 RED→GREEN TDD 증거를 남긴다.

## Task 2: Persistence, demo session, and APIs

- Drizzle/libSQL 스키마와 repository interface를 구현하고 local SQLite/Turso를 URL로 전환한다.
- 필수 테이블은 demo_sessions, projects, phase_gates, features, search_runs, patents, claim_elements, evidence, risks, approvals, conditions, jobs, notifications, audit_events를 포함한다.
- 24시간 signed HttpOnly 데모 세션, 롤 전환, 초기화, 만료 검사를 구현한다.
- 계획의 API 경로를 Route Handler로 제공하되 동일 패턴 CRUD는 하나의 검증된 도메인 서비스를 공유한다.
- version conflict, idempotency, 역할 승인 규칙, 만료 세션을 integration test로 검증한다.

## Task 3: Role Cockpit and four-phase workspace

- 상단 헤더, 데모 롤 전환, 좌측 네비게이션, 역할별 Cockpit을 구현한다.
- 프로젝트 상세에 4단계 진행표시, 필수 체크리스트, 중앙 작업, 우측 Gate 준비도/차단 사유를 구현한다.
- 기획, 설계, 테스트, 승인 각 페이지와 고밀도 Claim Chart, revision impact, 알림, 진단 화면을 제공한다.
- 실제 인증이 아님과 AI 초안/승인 워터마크를 상시 표시한다.
- 1280/1440/1920px 반응형, 키보드 이동, 색 외 상태표시, 모바일 PC 안내를 component test로 검증한다.

## Task 4: Connectors, approval package, deployment, and E2E

- KIPRIS/EPO/Gemini connector adapter, 할당량, 두 번 지수 백오프, typed failure와 수동/샘플 fallback을 구현한다. 키가 없으면 샘플 모드로 정상 동작해야 한다.
- 비식별화 preview/confirm, 금지정보 차단, AI 인용/신뢰도 검증을 구현한다.
- 승인 snapshot을 PDF/ZIP으로 생성하고 포함 파일의 SHA-256 manifest를 검증한다.
- health endpoint, 구조화 로그, 보안 헤더, Vercel config/Cron, GitHub Actions Preview 품질 게이트, README 실행/배포 안내를 완성한다.
- Playwright로 샘플 프로젝트의 기획→설계→테스트→승인 패키지 완주, 역할별 Cockpit, 모바일 안내를 검증한다.
