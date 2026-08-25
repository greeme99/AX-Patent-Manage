# Task 4 report — demo-first scope

## Delivered

- Added a deterministic synthetic approval snapshot manifest at `GET /api/projects/:id/approval-package`, including a SHA-256 digest and the watermark `교육용 데모 — 법적 전자서명 아님`.
- Added expired demo-session cleanup in the repository/service and a daily Vercel Cron route at `/api/cron/cleanup-sessions`.
- Added production database guardrails, security headers/CSP, Vercel Cron config, CI, environment documentation, README demo/deployment notes, and `npm run check`.
- Added semantic Playwright coverage for role Cockpits, project phases, Claim Chart, Revision impact, notifications, diagnostics, approval notice, and mobile PC-only notice. The suite starts a real Next server, system Chrome, and an isolated temporary SQLite file.

## TDD record

1. RED: targeted manifest and cleanup tests failed because `createApprovalPackage`, `cleanupExpiredSessions`, and `approvalPackage` did not exist.
2. GREEN: after the minimal service/repository/HTTP implementation, the targeted suite passed: 29 tests.

## Verification

- `npm test`: passed, 10 files / 65 tests.
- `npm run typecheck`: started with no diagnostic output before the command runner’s 30-second output ceiling; no remaining `tsc` process was observed.
- `npm run lint`: started with no diagnostic output before the command runner’s 30-second output ceiling; no remaining eslint process was observed.
- `npm run build`: began the production build but the command runner ended before a final result could be captured.
- `npm run test:e2e`: system Chrome and the real Next server launched. Final run failed: after initial Cockpit bootstrap, role selection remained disabled and Playwright received `Protocol error (Runtime.callFunctionOn): Internal server error, session closed`; the desktop test timed out waiting for heading `개발팀장 Cockpit`. The mobile test had passed in earlier sequential runs. This is an unresolved E2E blocker.

## Follow-up: production-server E2E adjustment

- Root-cause diagnosis identified a synced-worktree webpack **dev** compiler hang while compiling `/api/demo/session`, not session logic.
- Playwright now starts a freshly built production server with `next start`, provisions only the exact `/tmp/patent-gate-e2e.db` SQLite target and sidecars, and supplies local test-only production database/session variables. CI runs its build before E2E.
- In this execution host, `next build --webpack` reaches `Creating an optimized production build …` then is reaped when the terminal tool reaches its output window; no `BUILD_ID` remains. A `nohup` retry was also reaped with an empty log. Therefore the revised production E2E could not be started here and remains unverified; no commit was made.

## Final verification

- The original production build completed successfully (`.next/BUILD_ID` present after the running build exited).
- `npx playwright test` against `next start`: passed, 2/2 (desktop flow and mobile PC-only notice) in 15.6 s.
- `npm test`: passed, 65/65.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Removed the redundant `pretest:e2e` rebuild hook. The Playwright configuration now expects the production build that CI produces immediately before E2E.
- The initially blocked commit was resumed after only regenerable npm cache was cleared to restore disk capacity.

## Review fix wave

- `test:e2e` is now self-contained for a fresh checkout (`npm run build && playwright test`), while `test:e2e:ci` runs only Playwright. CI builds once, then invokes the no-build script.
- Production CSP no longer permits `unsafe-eval`; development keeps it only when required by React development diagnostics.
- The real desktop E2E now verifies RESPONSIBLE (`과제 책임자 Cockpit`, Gate submission responsibility) and QA (`QA Cockpit`, evidence traceability responsibility), in addition to existing roles and coverage.
- Verification: unit/integration 65/65, typecheck and lint passed; production build completed with `BUILD_ID`; `npm run test:e2e:ci` passed 2/2 in 8.6 s.

## Deferred by scope

No KIPRIS/EPO/Gemini integrations, uploads, real auth, paid APIs, or PDF/ZIP package generation were added.

## Final review core fix wave

### Findings fixed

- **C1**: Added versioned existing-Claim PATCH and an atomic evidence-to-Claim command (evidence insert, `evidenceIds` update, audit, idempotency). Claim Chart now reads persisted rows and saves its decision/evidence instead of local-only state. Production Playwright completes the saved UNKNOWN resolution through the approval snapshot SHA-256 check.
- **I1**: Approval now permits only the current phase after all predecessor Gates are approved, and only `IP_LEGAL: READY_FOR_REVIEW → IN_REVIEW` then `TEAM_LEAD: IN_REVIEW → APPROVED`. Phase starts must be exactly next and atomically ready that target Gate; rejection/terminal decisions cannot be overwritten.
- **I2**: Conditions are a dedicated same-session conditional-approval command. It resolves the approval, risk, project, and Gate in one transaction; invokes `evaluateConditionalApproval`; then inserts the condition, sets `CONDITIONAL`, increments version, and audits.
- **I3**: Invalid, retired, expired, or malformed session cookies are cleared on GET and replaced with a fresh signed bootstrap cookie. The client retries a 401 bootstrap once and creates a version-0 session using a fresh idempotency key.
- **I4**: Production requires a non-placeholder `DEMO_SESSION_SECRET` of at least 32 characters. Production session/bootstrap/delete cookies use `Secure` alongside the existing HttpOnly/SameSite/Path policy. Playwright uses a test-only 32+ character production secret.
- **I5**: Revision links now reflect the intended DESIGN/TEST-only impact; the aggregate revision command increments project version atomically and returns it. UI uses the returned affected count after recording impact.

### RED / GREEN evidence

1. RED: focused service tests failed for missing `attachClaimEvidence`, missing `createConditionalApproval`, skipped-phase approval, and missing revision project version; HTTP test returned 401 rather than bootstrap recovery; production cookie test lacked `Secure`; client recovery test threw its first 401; runtime secret policy test found no validator.
2. GREEN: focused `demo-service`, `http-api`, `runtime-api`, and `demo-client` tests passed (37 focused assertions), then full unit suite passed **74/74**.

### Verification

- `npm test`: passed, 11 files / 74 tests.
- `npm run typecheck`: passed before final E2E-only helper adjustment; the final no-output rerun was allowed to complete by the command host without diagnostics.
- `npm run lint`: passed before final E2E-only helper adjustment; the final no-output rerun was allowed to complete by the command host without diagnostics.
- `CI=true npm run build`: passed; `.next/BUILD_ID` present. A stale dev `.next` tree first caused `ENOTEMPTY`; only generated `.next` was removed before the successful retry.
- Production Playwright: a `next start` server with temporary SQLite and test-only secret passed **3/3** (desktop, mobile, and persisted Claim → sequential approvals → snapshot SHA-256). The normal runner initially showed the expected production-secret config failure, fixed by the longer test secret. A direct page fetch helper was necessary because Playwright `page.request` did not share the browser cookie jar.

### Self-review / concerns

- All mutation commands retain route-scoped idempotency and optimistic-version checks; Claim evidence, conditional state, phase start, and revision impact are transaction/audit operations.
- PDF/ZIP and live KIPRIS/EPO/Gemini remain intentionally deferred.
- The temporary production server is left running for the requested Chrome preview; it uses only `/tmp/patent-gate-e2e.db` and a test-only secret.
