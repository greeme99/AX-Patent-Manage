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
}> = {
  PRACTITIONER: {
    title: '실무 담당자 Cockpit', eyebrow: 'MY WORK · PRACTITIONER',
    priority: 'Claim Chart 근거 보강', supportingTask: 'UNKNOWN 요소 1건에 R03 설계 근거를 연결하세요.',
    queueLabel: '내 작업 큐',
    kpis: [['오늘 마감', '3', '업무'], ['근거 미연결', '1', '요소'], ['열린 위험', '2', '건'], ['진행률', '68', '%']],
  },
  RESPONSIBLE: {
    title: '과제 책임자 Cockpit', eyebrow: 'PROJECT CONTROL · RESPONSIBLE',
    priority: '설계 Gate 검토 요청', supportingTask: '담당자 근거 보강 후 검토 패키지를 동결하세요.',
    queueLabel: '과제 의사결정',
    kpis: [['검토 대기', '4', '건'], ['조건부 기한', '2', '건'], ['열린 위험', '2', '건'], ['Gate 준비도', '74', '%']],
  },
  TEAM_LEAD: {
    title: '개발팀장 Cockpit', eyebrow: 'FINAL DECISION · TEAM LEAD',
    priority: '최종 승인 대기', supportingTask: 'IP·법무 선행 승인 후 국가별 최종 결정을 확인하세요.',
    queueLabel: '최종 승인 큐',
    kpis: [['승인 대기', '2', '건'], ['HIGH 위험', '1', '건'], ['기한 초과', '1', '건'], ['출시 여유', '70', '일']],
  },
  IP_LEGAL: {
    title: 'IP·법무 Cockpit', eyebrow: 'LEGAL REVIEW · IP / LEGAL',
    priority: 'HIGH 위험 법무 검토', supportingTask: 'KR102345678B1 청구항 중첩과 최신 법적 상태를 확인하세요.',
    queueLabel: '법무 검토 큐',
    kpis: [['법무 검토', '3', '건'], ['상태 갱신', '1', '건'], ['HIGH 위험', '1', '건'], ['대상 국가', '4', '개']],
  },
  QA: {
    title: 'QA Cockpit', eyebrow: 'TRACEABILITY · QA',
    priority: '시험 증거 추적성 점검', supportingTask: '굴곡 20만 회 시험과 Claim 요소 연결을 확인하세요.',
    queueLabel: 'QA 점검 큐',
    kpis: [['점검 대기', '5', '건'], ['근거 누락', '1', '건'], ['재검증', '2', '건'], ['추적 완성도', '82', '%']],
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
            <li className="task-item">
              <span className="task-state">P2</span>
              <div><strong>검색 결과 분류 확인</strong><p>US·EP 패밀리 6건의 관련도를 확정하세요.</p><span>내일 11:00 · Search #24</span></div>
              <Link href={`${projectHref}?phase=DESIGN`}>확인</Link>
            </li>
            <li className="task-item">
              <span className="task-state">P3</span>
              <div><strong>시험 계획 근거 연결</strong><p>굴곡 수명 시험 항목에 도면과 조건을 연결하세요.</p><span>8월 28일 · TEST Gate</span></div>
              <Link href={`${projectHref}?phase=TEST`}>확인</Link>
            </li>
          </ol>
          <Link className="panel-footer-link" href={projectHref}>전체 업무와 체크리스트 보기 <span aria-hidden="true">→</span></Link>
        </section>

        <section className="panel readiness-panel" aria-labelledby="readiness-title">
          <div className="panel-heading">
            <div><p className="eyebrow">DESIGN GATE</p><h2 id="readiness-title">Gate 준비도</h2></div>
            <span className="status-badge status-badge--review">검토 준비</span>
          </div>
          <div className="readiness-score">
            <div className="donut" style={{ '--progress': '74%' } as CSSProperties}><strong>74</strong><span>%</span></div>
            <div><strong>9 / 12</strong><p>필수 항목 충족</p><small>지난주 대비 +12%p</small></div>
          </div>
          <div className="progress-track" aria-label="Gate 준비도 74%"><span style={{ width: '74%' }} /></div>
          <ul className="blocker-list">
            <li><span className="blocker-icon">!</span><div><strong>UNKNOWN Claim 요소</strong><p>요소 3 · 설계 근거 없음</p></div><span>차단</span></li>
            <li><span className="blocker-icon blocker-icon--amber">△</span><div><strong>HIGH 위험 법무 검토</strong><p>IP·법무 승인 전 최종 승인 불가</p></div><span>필수</span></li>
            <li><span className="blocker-icon blocker-icon--ok">✓</span><div><strong>법적 상태 최신성</strong><p>2026.08.22 확인 · 유효</p></div><span>완료</span></li>
          </ul>
          <Link className="button button--secondary button--wide" href={`${projectHref}?phase=DESIGN`}>차단 사유 해결하기</Link>
        </section>

        <section className="panel alert-panel" aria-labelledby="alerts-title">
          <div className="panel-heading"><div><p className="eyebrow">DUE &amp; CONDITIONS</p><h2 id="alerts-title">기한·조건 알림</h2></div><Link href="/notifications">모두 보기</Link></div>
          <ul className="compact-list">
            <li><span className="alert-mark alert-mark--red">D-1</span><div><strong>법무 검토 SLA 임박</strong><p>HIGH 위험 · 담당 IP·법무</p></div></li>
            <li><span className="alert-mark alert-mark--amber">D-3</span><div><strong>Micro-via 보강 시험</strong><p>조건부 승인 선결 조건</p></div></li>
            <li><span className="alert-mark">D-8</span><div><strong>설계 R04 동결 예정</strong><p>Revision impact 재점검</p></div></li>
          </ul>
        </section>

        <section className="panel approval-panel" aria-label="승인 현황">
          <div className="panel-heading"><div><p className="eyebrow">APPROVAL CHAIN</p><h2>승인 현황</h2></div><span className="status-badge">2 / 4</span></div>
          <div className="approval-chain" role="list">
            <div role="listitem" className="approval-step approval-step--done"><span>✓</span><div><strong>실무 담당자</strong><small>제출 완료 · 08.23</small></div></div>
            <div role="listitem" className="approval-step approval-step--done"><span>✓</span><div><strong>과제 책임자</strong><small>검토 완료 · 08.24</small></div></div>
            <div role="listitem" className="approval-step approval-step--active"><span>3</span><div><strong>IP·법무</strong><small>검토 중 · HIGH 위험</small></div></div>
            <div role="listitem" className="approval-step"><span>4</span><div><strong>개발팀장</strong><small>선행 승인 대기</small></div></div>
          </div>
        </section>
      </div>

      <p className="demo-watermark" aria-label="교육용 데모 고지">교육용 데모 · 실제 인증 아님</p>
    </main>
  );
}
