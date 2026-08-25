# 설계특허관리 웹앱 (Design Patent/FTO Management Platform) — 개발문서 패키지

이 패키지는 특허/FTO 업무를 개발 Gate와 설계 Rev에 연결하는 웹앱의 Phase 기반 기획·설계·개발/운영 문서입니다.

## 핵심 설계
- G0~G8 개발 특허 Gate
- Project/Product/Feature/Patent/Family/Claim/Claim Chart/Evidence/Risk/Decision
- Critical/High/Medium/Low FTO 검토 우선순위
- 설계 Rev/ECO 변경 시 재검토
- Human-in-the-loop AI/RAG
- SSO/RBAC/Audit
- 외부 Patent DB/PLM 확장 구조

## 문서
- `00_문서목록_및_추적성.md`
- `phase-1-requirements/` 01~10
- `phase-2-design/` 11~20
- `phase-3-delivery/` 21~30
- `scripts/package_docs.py`

## 상태
조건부 완료. ASM-001~008의 실제 회사 환경을 확정하면 구현용 v1.0으로 승격할 수 있습니다.
