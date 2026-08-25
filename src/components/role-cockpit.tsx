import type { CSSProperties } from 'react';
import Link from 'next/link';

import { syntheticFpcbProject, type Role } from '../domain';

const ROLE_CONTENT: Record<Role, {
  title: string;
  eyebrow: string;
  priority: string;
  supportingTask: string;
  queueLabel: string;
  kpis: readonly [string, string, string][];
  secondaryTasks: readonly [string, string, string, 'DESIGN' | 'TEST' | 'APPROVAL'][];
  gateLabel: string;
  gateResponsibility: string;
  gateStatus: string;
  readiness: number;
  readinessCount: string;
  blockers: readonly [string, string, string][];
  gateAction: string;
  alerts: readonly [string, string, string][];
  approvalAction: string;
  approvalSummary: string;
  approvalChain: readonly [string, string, 'done' | 'active' | 'pending'][];
}> = {
  PRACTITIONER: {
    title: '실무 담당자 Cockpit', eyebrow: 'MY WORK · PRACTITIONER',
    priority: 'Claim Chart 근거 보강', supportingTask: 'UNKNOWN 요소 1건에 R03 설계 근거를 연결하세요.',
    queueLabel: '내 작업 큐',
    kpis: [['오늘 마감', '3', '업무'], ['근거 미연결', '1', '요소'], ['열린 위험', '2', '건'], ['진행률', '68', '%']],
    secondaryTasks: [['검색식 키워드 보강', '동의어 4건을 검색식 #24에 추가하세요.', '내일 11:00', 'DESIGN'], ['시험 근거 초안 연결', '굴곡 시험 성적서 인용 위치를 표시하세요.', '8월 28일', 'TEST']],
    gateLabel: 'DESIGN · EVIDENCE', gateResponsibility: '근거 작성 책임', gateStatus: '작성 중', readiness: 58, readinessCount: '7 / 12',
    blockers: [['!', 'UNKNOWN 요소 직접 조치', '요소 3의 R03 근거를 연결'], ['△', '인용 위치 미확정', '도면 Sheet 4 좌표 필요'], ['✓', '검색 결과 분류', '실무 분류 24건 완료']],
    gateAction: '근거 연결 계속',
    alerts: [['D-0', '내 업무 마감 임박', 'Claim Chart 근거 · 오늘 17:00'], ['D-2', '검색식 보강 기한', '동의어 4건 추가 필요'], ['D-5', '시험 근거 초안', 'QA 전달 전 작성']],
    approvalAction: '근거 연결 계속', approvalSummary: '실무 제출 전 · 근거 1건 미완료',
    approvalChain: [['실무 근거 작성', '진행 중 · 오늘 17:00', 'active'], ['과제 책임자 검토', '제출 대기', 'pending'], ['IP·법무 결정', '선행 대기', 'pending'], ['개발팀장 최종 승인', '선행 대기', 'pending']],
  },
  RESPONSIBLE: {
    title: '과제 책임자 Cockpit', eyebrow: 'PROJECT CONTROL · RESPONSIBLE',
    priority: '설계 Gate 검토 요청', supportingTask: '담당자 근거 보강 후 검토 패키지를 동결하세요.',
    queueLabel: '과제 의사결정',
    kpis: [['검토 대기', '4', '건'], ['조건부 기한', '2', '건'], ['열린 위험', '2', '건'], ['Gate 준비도', '74', '%']],
    secondaryTasks: [['검색 범위 승인', 'KR·US·EP·PCT 검색 범위를 확정하세요.', '오늘 16:00', 'DESIGN'], ['R04 변경 영향 할당', '설계·QA 재검토 담당자를 지정하세요.', '내일 10:00', 'TEST']],
    gateLabel: 'DESIGN · SUBMISSION', gateResponsibility: 'Gate 제출 책임', gateStatus: '제출 검토', readiness: 74, readinessCount: '9 / 12',
    blockers: [['!', '실무 근거 미완료', 'UNKNOWN 1건 제출 차단'], ['△', '검토 패키지 미동결', 'R03 snapshot 확정 필요'], ['✓', '국가 범위 승인', 'KR·US·EP·PCT 확정']],
    gateAction: '책임자 검토 시작',
    alerts: [['D-0', '검토 패키지 동결 필요', '오늘 18:00 전 snapshot 확정'], ['D-2', '조건부 기한 검증', '생산일 이전인지 확인'], ['D-4', 'R04 담당자 지정', '설계·QA 재검토 배정']],
    approvalAction: '책임자 검토 시작', approvalSummary: '책임자 Gate 제출 검토 중',
    approvalChain: [['실무 담당자 제출', '완료 · 2026.08.23 16:40', 'done'], ['과제 책임자 Gate 제출', '검토 중 · 오늘 18:00', 'active'], ['IP·법무 결정', '제출 대기', 'pending'], ['개발팀장 최종 승인', '선행 대기', 'pending']],
  },
  TEAM_LEAD: {
    title: '개발팀장 Cockpit', eyebrow: 'FINAL DECISION · TEAM LEAD',
    priority: '최종 승인 대기', supportingTask: 'IP·법무 선행 승인 후 국가별 최종 결정을 확인하세요.',
    queueLabel: '최종 승인 큐',
    kpis: [['승인 대기', '2', '건'], ['HIGH 위험', '1', '건'], ['기한 초과', '1', '건'], ['출시 여유', '70', '일']],
    secondaryTasks: [['조건부 승인 범위 확인', 'Medium 위험 US 조건과 생산일을 비교하세요.', '오늘 15:30', 'APPROVAL'], ['출시 차단 여부 판단', 'KR HIGH 위험의 출시 영향을 검토하세요.', '오늘 17:30', 'APPROVAL']],
    gateLabel: 'APPROVAL · FINAL', gateResponsibility: '최종 승인 책임', gateStatus: '선행 승인 대기', readiness: 31, readinessCount: '2 / 4',
    blockers: [['!', 'IP·법무 결정 미완료', 'HIGH 위험 선행 승인 필수'], ['△', 'US 조건 기한 확인', '2026.09.18 이행 여부'], ['✓', '출시일 검증', '2026.11.03 · 조건 이후']],
    gateAction: '최종 결정 검토',
    alerts: [['대기', 'IP·법무 선행 승인 대기', '법무 결정 전 최종 승인 불가'], ['D-1', '최종 승인 SLA 예정', '선행 승인 후 1영업일'], ['D-3', '조건부 승인 만료 검토', 'US Micro-via 시험 조건']],
    approvalAction: '최종 결정 검토', approvalSummary: 'IP·법무 선행 결정 대기',
    approvalChain: [['실무 담당자 제출', '완료 · 2026.08.23 16:40', 'done'], ['과제 책임자 제출', '완료 · 2026.08.24 10:20', 'done'], ['IP·법무 결정', '검토 중 · 선행 승인', 'active'], ['개발팀장 최종 승인', '선행 승인 대기', 'pending']],
  },
  IP_LEGAL: {
    title: 'IP·법무 Cockpit', eyebrow: 'LEGAL REVIEW · IP / LEGAL',
    priority: 'HIGH 위험 법무 검토', supportingTask: 'KR102345678B1 청구항 중첩과 최신 법적 상태를 확인하세요.',
    queueLabel: '법무 검토 큐',
    kpis: [['법무 검토', '3', '건'], ['상태 갱신', '1', '건'], ['HIGH 위험', '1', '건'], ['대상 국가', '4', '개']],
    secondaryTasks: [['법적 상태 최신성 확인', 'KR·US 등록/계속 상태를 재확인하세요.', '오늘 16:30', 'APPROVAL'], ['회피 설계 차이점 판정', '보강층 재질 차이의 실질성을 기록하세요.', '내일 12:00', 'DESIGN']],
    gateLabel: 'LEGAL · DECISION', gateResponsibility: '법적 판단 책임', gateStatus: '법무 검토 중', readiness: 67, readinessCount: '2 / 3',
    blockers: [['!', 'HIGH 위험 결정 필요', 'KR 독립항 1 중첩 판단'], ['△', 'US 상태 재확인', '마지막 확인 6일 전'], ['✓', 'EP 가족 검토', '계속 출원 관계 확인']],
    gateAction: '법무 검토 기록',
    alerts: [['D-1', '법적 상태 갱신 기한', 'US 상태가 내일 7일 경과'], ['D-1', 'HIGH 위험 검토 SLA', 'KR 독립항 1 결정 필요'], ['D-4', 'PCT 가족관계 확인', '국내단계 진입 국가 검토']],
    approvalAction: '법무 검토 기록', approvalSummary: 'IP·법무 1차 결정 진행 중',
    approvalChain: [['실무 담당자 제출', '완료 · 2026.08.23 16:40', 'done'], ['과제 책임자 제출', '완료 · 2026.08.24 10:20', 'done'], ['IP·법무 1차 결정', '검토 중 · 2026.08.25 14:10', 'active'], ['개발팀장 최종 승인', '법무 결정 대기', 'pending']],
  },
  QA: {
    title: 'QA Cockpit', eyebrow: 'TRACEABILITY · QA',
    priority: '시험 증거 추적성 점검', supportingTask: '굴곡 20만 회 시험과 Claim 요소 연결을 확인하세요.',
    queueLabel: 'QA 점검 큐',
    kpis: [['점검 대기', '5', '건'], ['근거 누락', '1', '건'], ['재검증', '2', '건'], ['추적 완성도', '82', '%']],
    secondaryTasks: [['Micro-via 시험 계획 확정', '단면 분석 표본 수와 합격 기준을 확정하세요.', '오늘 16:00', 'TEST'], ['R04 재검증 범위 산정', '변경 배선 폭의 시험 영향을 기록하세요.', '내일 14:00', 'TEST']],
    gateLabel: 'TEST · TRACEABILITY', gateResponsibility: '시험 추적 책임', gateStatus: 'QA 점검 중', readiness: 82, readinessCount: '9 / 11',
    blockers: [['!', '시험 증거 미연결', 'Micro-via 단면 결과 없음'], ['△', 'R04 재검증 범위', '배선 폭 변경 영향 확인'], ['✓', '굴곡 수명 시험', '23.6만 회 PASS 연결됨']],
    gateAction: 'QA 추적성 확인',
    alerts: [['D-0', '시험 증거 누락', 'Micro-via 단면 근거 미연결'], ['D-2', 'R04 재검증 계획', '영향 항목 2건 범위 확정'], ['D-5', 'QA Gate 서명', '추적성 100% 후 가능']],
    approvalAction: 'QA 추적성 확인', approvalSummary: 'QA 증거 확인 후 Gate 전달',
    approvalChain: [['시험 수행', '굴곡 시험 완료 · 08.24', 'done'], ['QA 추적성 확인', '진행 중 · 근거 1건 누락', 'active'], ['과제 책임자 Gate 반영', 'QA 확인 대기', 'pending'], ['승인 체인 전달', '선행 대기', 'pending']],
  },
};

interface RoleCockpitProps {
  role?: Role;
  projectId?: string;
  readOnly?: boolean;
}

export function RoleCockpit({
  role = 'PRACTITIONER',
  projectId = syntheticFpcbProject.id,
  readOnly = false,
}: RoleCockpitProps) {
  const content = ROLE_CONTENT[role];
  const projectHref = `/projects/${projectId}`;

  return (
    <main id="main-content" className="cockpit-content" tabIndex={-1}>
      {readOnly ? (
        <div className="readonly-banner" role="status">
          <strong>샘플 읽기 전용</strong>
          <span>데이터 저장소에 연결할 수 없어 합성 기준 데이터를 표시합니다.</span>
        </div>
      ) : null}

      <header className="page-heading">
        <div>
          <p className="eyebrow">{content.eyebrow}</p>
          <h1>{content.title}</h1>
          <p>담당 범위의 Gate, 위험, 증거와 승인 요청을 한 화면에서 처리합니다.</p>
        </div>
        <div className="heading-actions">
          <span className="live-indicator"><i aria-hidden="true" /> 합성 데이터 동기화됨</span>
          <Link className="button button--primary" href={projectHref}>프로젝트 열기 <span aria-hidden="true">→</span></Link>
        </div>
      </header>

      <section className="kpi-grid" aria-label="핵심 지표">
        {content.kpis.map(([label, value, suffix], index) => (
          <article className="kpi-card" key={label}>
            <div className={`kpi-icon kpi-icon--${index + 1}`} aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
            <div>
              <p>{label}</p>
              <strong>{value}<small>{suffix}</small></strong>
            </div>
            <span className={index === 1 ? 'trend trend--warning' : 'trend'}>{index === 1 ? '확인 필요' : '정상 추적'}</span>
          </article>
        ))}
      </section>

      <div className="cockpit-grid">
        <section className="panel task-panel" aria-labelledby="today-title">
          <div className="panel-heading">
            <div><p className="eyebrow">{content.queueLabel}</p><h2 id="today-title">오늘의 우선 업무</h2></div>
            <span className="count-badge">4건</span>
          </div>
          <ol className="task-list">
            <li className="task-item task-item--priority">
              <span className="task-state">P1</span>
              <div><strong>{content.priority}</strong><p>{content.supportingTask}</p><span>오늘 17:00 · {syntheticFpcbProject.currentRevisionLabel}</span></div>
              <Link href={`${projectHref}/claim-chart`} aria-label={`${content.priority} 열기`}>열기</Link>
            </li>
            {content.secondaryTasks.map(([title, description, due, targetPhase], index) => <li className="task-item" key={title}>
              <span className="task-state">P{index + 2}</span>
              <div><strong>{title}</strong><p>{description}</p><span>{due} · {targetPhase} Gate</span></div>
              <Link href={`${projectHref}?phase=${targetPhase}`}>{index === 0 ? '확인' : '열기'}</Link>
            </li>)}
          </ol>
          <Link className="panel-footer-link" href={projectHref}>전체 업무와 체크리스트 보기 <span aria-hidden="true">→</span></Link>
        </section>

        <section className="panel readiness-panel" aria-labelledby="readiness-title">
          <div className="panel-heading">
            <div><p className="eyebrow">{content.gateLabel}</p><h2 id="readiness-title">Gate 준비도</h2><small>{content.gateResponsibility}</small></div>
            <span className="status-badge status-badge--review">{content.gateStatus}</span>
          </div>
          <div className="readiness-score">
            <div className="donut" style={{ '--progress': `${content.readiness}%` } as CSSProperties}><strong>{content.readiness}</strong><span>%</span></div>
            <div><strong>{content.readinessCount}</strong><p>역할 책임 항목 충족</p><small>{content.gateResponsibility}</small></div>
          </div>
          <div className="progress-track" aria-label={`Gate 준비도 ${content.readiness}%`}><span style={{ width: `${content.readiness}%` }} /></div>
          <ul className="blocker-list">
            {content.blockers.map(([icon, title, description], index) => <li key={title}><span className={`blocker-icon ${index === 1 ? 'blocker-icon--amber' : index === 2 ? 'blocker-icon--ok' : ''}`}>{icon}</span><div><strong>{title}</strong><p>{description}</p></div><span>{index === 2 ? '완료' : index === 1 ? '필수' : '차단'}</span></li>)}
          </ul>
          <Link className="button button--secondary button--wide" href={`${projectHref}?phase=${role === 'QA' ? 'TEST' : role === 'TEAM_LEAD' || role === 'IP_LEGAL' ? 'APPROVAL' : 'DESIGN'}`}>{content.gateAction}</Link>
        </section>

        <section className="panel alert-panel" aria-labelledby="alerts-title">
          <div className="panel-heading"><div><p className="eyebrow">DUE &amp; CONDITIONS</p><h2 id="alerts-title">기한·조건 알림</h2></div><Link href="/notifications">모두 보기</Link></div>
          <ul className="compact-list">
            {content.alerts.map(([due, title, description], index) => <li key={title}><span className={`alert-mark ${index === 0 ? 'alert-mark--red' : index === 1 ? 'alert-mark--amber' : ''}`}>{due}</span><div><strong>{title}</strong><p>{description}</p></div></li>)}
          </ul>
        </section>

        <section className="panel approval-panel" aria-label="승인 현황">
          <div className="panel-heading"><div><p className="eyebrow">APPROVAL CHAIN</p><h2>승인 현황</h2><small>{content.approvalSummary}</small></div><Link href={`${projectHref}?phase=${role === 'QA' ? 'TEST' : 'APPROVAL'}`}>{content.approvalAction}</Link></div>
          <div className="approval-chain" role="list">
            {content.approvalChain.map(([label, status, state], index) => <div role="listitem" className={`approval-step ${state === 'done' ? 'approval-step--done' : state === 'active' ? 'approval-step--active' : ''}`} key={label}><span>{state === 'done' ? '✓' : index + 1}</span><div><strong>{label}</strong><small>{status}</small></div></div>)}
          </div>
        </section>
      </div>

      <p className="demo-watermark" aria-label="교육용 데모 고지">교육용 데모 · 실제 인증 아님</p>
    </main>
  );
}
