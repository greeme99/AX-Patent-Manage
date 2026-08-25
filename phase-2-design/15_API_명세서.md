# 15. API 명세서

## 1. 문서 정보
- 프로젝트: 설계특허관리 웹앱 (Design Patent/FTO Management Platform)
- 기준일: 2026-08-25
- 상태: Draft v0.1
- 근거: 제공된 특허업무/기술특허 관리 가이드 및 Phase 문서 작성 가이드

## 2. 목적
화면과 데이터 모델을 연결하는 REST API 초안을 정의한다.

## 3. 범위
설계특허관리 웹앱

## 공통 사전

### 역할
| 코드 | 역할 | 주요 권한 |
|---|---|---|
| ROLE-RND | R&D/설계자 | Feature/설계안/Evidence 등록, 회피설계 수행 |
| ROLE-PM | 제품/프로젝트 관리자 | 프로젝트·Gate·일정·범위 관리 |
| ROLE-IP | IP 담당 | 검색, 특허 선별, Claim Chart, Risk 평가 |
| ROLE-LEGAL | 법무/변리사 | 법률 검토, Critical/High 승인 |
| ROLE-QA | 시험/품질 | 시제품·시험 Evidence, 변경 영향 검증 |
| ROLE-EXEC | 의사결정자 | 출시/라이선스/중단 등 최종 Business Decision |
| ROLE-ADMIN | 시스템 관리자 | 기준정보·권한·연동·감사 설정 |

### ID 규칙
`BR-xxx / FR-xxx / NFR-xxx / FS-xxx / US-xxx / UC-xxx / SCR-xxx / API-<DOMAIN>-xxx / TBL-<DOMAIN>-xxx / PG-xxx / TC-xxx / ASM-xxx / RSK-xxx`

### 핵심 상태값
- Project: DRAFT → ACTIVE → ON_HOLD → CLOSED
- Patent Review: CANDIDATE → SCREENED → CLAIM_ANALYSIS → LEGAL_REVIEW → DECIDED → MONITORING
- Risk: CRITICAL / HIGH / MEDIUM / LOW / CLEARED
- Gate: NOT_STARTED / IN_REVIEW / PASSED / CONDITIONAL / REJECTED
- Decision: DESIGN_AROUND / LICENSE / INVALIDITY_REVIEW / ACCEPT / STOP / MONITOR

### API Prefix
`/api/v1`

### 환경/서비스
`DEV / STG / PRD`, 서비스명 `web`, `api`, `worker`, `ai-gateway`, `search`, `db`, `object-storage`, `audit`


## 5. API 목록
| ID | Endpoint | 용도 |
|---|---|---|
| API-PROJ-001 | `GET/POST /projects` | 프로젝트 |
| API-SCOPE-001 | `GET/PUT /projects/{id}/scope` | FTO Scope |
| API-FEAT-001 | `GET/POST /projects/{id}/features` | Feature |
| API-REV-001 | `POST /products/{id}/revisions` | 설계 Rev |
| API-PAT-001 | `GET/POST /projects/{id}/patents` | Patent Workspace |
| API-CLM-001 | `GET/POST /claim-charts` | Claim Chart |
| API-RISK-001 | `GET/POST /projects/{id}/risks` | Risk |
| API-DEC-001 | `POST /risks/{id}/decisions` | Decision |
| API-GATE-001 | `GET/POST /projects/{id}/gates/{gate}` | Gate |
| API-APR-001 | `POST /approvals` | Approval |
| API-EVD-001 | `POST /evidence` | Evidence |
| API-MON-001 | `GET/POST /watch-rules` | Monitoring |
| API-AI-001 | `POST /ai/claim-assist` | AI Assist |
| API-ADM-001 | `GET/PUT /admin/config` | Admin |

### API-CLM-001 예시
```json
{
  "projectId": "uuid",
  "patentId": "uuid",
  "claimVersionId": "uuid",
  "designRevisionId": "uuid",
  "mappings": [
    {
      "claimElementId": "uuid",
      "featureId": "uuid",
      "mapping": "PARTIAL",
      "rationale": "구조는 유사하나 연결 순서가 다름",
      "evidenceIds": ["uuid"]
    }
  ]
}
```

### 오류코드
- AUTH-401-001 인증 필요
- AUTH-403-001 프로젝트 권한 없음
- VAL-400-001 입력 검증 실패
- REV-409-001 Revision 충돌
- GATE-409-001 Gate 선행조건 미충족
- LEGAL-409-001 Critical Risk 법무승인 필요
- EXT-503-001 외부 특허 데이터 연동 실패
- AI-422-001 근거 부족/출처 미확보

## 가정 및 확인 필요 사항

| ID | 항목 | 현재 가정 | 근거 | 상태 |
|---|---|---|---|---|
| ASM-001 | 조직 | 중견 전자 제조사 R&D/IP 협업 환경 | 제공 가이드의 대상 조직 | 확인 필요 |
| ASM-002 | 인증 | 사내 SSO(OIDC/SAML) + 애플리케이션 RBAC | 인증 상세 미제공 | 확인 필요 |
| ASM-003 | 배포 | Private Cloud 또는 VPC 기반 웹앱 | 특허/설계 비밀정보 보호 필요 | 확인 필요 |
| ASM-004 | 특허 데이터 | KIPRIS/WIPO/EPO/USPTO 및 상용 DB 연계 가능 구조 | 제공 가이드의 검색 DB | 확인 필요 |
| ASM-005 | AI | AI는 검색·분류·요약·Claim Chart 초안 보조만 수행 | 최종 법률 판단은 전문가 검토 필요 | 적용 |
| ASM-006 | PLM 연동 | 제품/설계 Rev, BOM, ECO/ECN 메타데이터 연계 | 설계변경 재검토 필요 | 확인 필요 |
| ASM-007 | MVP 국가 | KR/US 우선, 다국가 확장 가능 | 구체 사업국가 미제공 | 확인 필요 |
| ASM-008 | 법률판단 | FTO/침해 최종 판단은 IP/법무/변리사 승인 | 가이드 원칙 | 적용 |

## 9. 완료 기준
SCR-002~011의 주요 액션이 API로 연결됨.
