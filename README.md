# Patent Gate 교육용 데모

FPCB 합성 프로젝트를 통해 개발 Gate, Claim Chart, 설계 revision 영향과 역할별 승인 흐름을 보여주는 Next.js 데모입니다. 로컬 주소는 [http://localhost:3000](http://localhost:3000)입니다.

## 실행

```bash
npm ci
npm run dev
```

검증 명령은 `npm test`, `npm run test:e2e`, `npm run typecheck`, `npm run lint`, `npm run build`이며, `npm run check`은 단위/통합 테스트·타입·린트를 함께 실행합니다.

## 데모 흐름

1. Cockpit에서 `개발팀장`, `IP·법무` 역할을 전환해 각 업무 큐를 확인합니다.
2. `프로젝트 열기`에서 기획 → 설계 → 시험 → 승인 네 단계 Gate를 이동합니다.
3. Claim Chart와 Revision 영향을 열어 차단 요소와 재검토 Gate를 확인합니다.
4. 승인 화면의 승인 체인과 교육용 워터마크를 확인합니다.
5. `GET /api/projects/:id/approval-package`는 SHA-256이 포함된 결정적 JSON snapshot manifest를 내려줍니다. 이 파일의 고지는 `교육용 데모 — 법적 전자서명 아님`입니다.

## 배포

Vercel에서 Git 저장소를 연결하면 `main` push는 Production, pull request는 Preview 배포가 됩니다. Production 환경 변수에는 `DATABASE_URL`, `TURSO_AUTH_TOKEN`, `DEMO_SESSION_SECRET`, `CRON_SECRET`를 설정해야 합니다. 로컬은 `DATABASE_URL`을 생략하면 `file:local.db` SQLite를 사용합니다. `vercel.json`은 매일 만료된 데모 세션을 정리하는 Cron을 등록합니다.

## 범위와 제한

모든 데이터는 합성 샘플이며 실제 인증·전자서명·법률 판단이 아닙니다. KIPRIS/EPO/Gemini 호출, 실사용자 인증, 파일 업로드, PDF/ZIP 패키지, 유료 API 및 실제 특허 검색은 다음 단계로 연기했습니다.
