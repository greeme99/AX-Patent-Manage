'use client';

import Link from 'next/link';
import { useState } from 'react';

import { PHASES, syntheticFpcbProject, type Phase } from '../domain';

const PHASE_META: Record<Phase, {
  number: string;
  label: string;
  workTitle: string;
  description: string;
  status: string;
  readiness: number;
  checklist: readonly string[];
}> = {
  PLANNING: {
    number: '01', label: '기획', workTitle: '기술특징 구조화',
    description: '제품 기능을 독립 기술요소로 분해하고 검색 범위를 확정합니다.',
    status: '승인 완료', readiness: 100,
    checklist: ['제품·기능 범위 정의', '핵심 기술특징 6건 구조화', '대상 국가 KR·US·EP·PCT 확정', '검색 키워드 책임자 검토'],
  },
  DESIGN: {
    number: '02', label: '설계', workTitle: '선행기술·Claim 분석',
    description: 'FPCB 설계 R03을 선행 특허의 Claim 요소와 비교하고 근거를 연결합니다.',
    status: '검토 준비', readiness: 74,
    checklist: ['검색 결과 관련도 분류', 'Claim Chart 요소 매핑', '설계 근거·인용 연결', 'HIGH 위험 IP·법무 검토'],
  },
  TEST: {
    number: '03', label: '시험', workTitle: '비침해 검증',
    description: '시험 결과가 회피 설계 의도와 Claim 요소 차이를 입증하는지 검증합니다.',
    status: '착수 대기', readiness: 42,
    checklist: ['굴곡 20만 회 시험 계획', 'Micro-via 단면 분석', '비침해 가설 검증', 'QA 추적성 확인'],
  },
  APPROVAL: {
    number: '04', label: '승인', workTitle: '국가별 승인 결정',
    description: '법적 상태 최신성과 위험별 승인 순서를 확인하고 국가별 결정을 기록합니다.',
    status: '선행 Gate 대기', readiness: 31,
    checklist: ['국가별 법적 상태 7일 이내 확인', 'IP·법무 선행 승인', '개발팀장 최종 승인', '조건·생산/출시일 검증'],
  },
};

interface ProjectWorkspaceProps {
  phase?: Phase;
  projectId?: string;
  readOnly?: boolean;
  claimCount?: number;
  riskCount?: number;
}

export function ProjectWorkspace({
  phase = 'DESIGN',
  projectId = syntheticFpcbProject.id,
  readOnly = false,
  claimCount = syntheticFpcbProject.claimElements.length,
  riskCount = syntheticFpcbProject.risks.length,
}: ProjectWorkspaceProps) {
  const meta = PHASE_META[phase];
  const [checked, setChecked] = useState(() => meta.checklist.map((_, index) => phase === 'PLANNING' || index < 2));
  const [evidenceState, setEvidenceState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const projectHref = `/projects/${projectId}`;

  async function addEvidence() {
    if (readOnly || evidenceState === 'saving') return;
    setEvidenceState('saving');
    try {
      const response = await fetch(`${projectHref.replace('/projects', '/api/projects')}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': globalThis.crypto.randomUUID() },
        body: JSON.stringify({ quote: 'R03 동박 패턴의 굴곡 중립축 이격 0.42 mm', revision: 3, version: 0 }),
      });
      if (!response.ok) throw new Error('save failed');
      setEvidenceState('saved');
    } catch {
      setEvidenceState('failed');
    }
  }

  return (
    <main id="main-content" className="workspace-page" tabIndex={-1}>
      {readOnly ? <div className="readonly-banner" role="status"><strong>샘플 읽기 전용</strong><span>DB 연결 없이 단일 FPCB fixture를 표시합니다. 편집 기능은 잠겼습니다.</span></div> : null}
      <header className="project-heading">
        <div className="breadcrumbs" aria-label="현재 위치"><Link href="/">Cockpit</Link><span>/</span><span>프로젝트</span><span>/</span><strong>{syntheticFpcbProject.code}</strong></div>
        <div className="project-title-row">
          <div><div className="title-line"><span className="project-type">FPCB</span><h1>{syntheticFpcbProject.name}</h1><span className="revision-chip">설계 {syntheticFpcbProject.currentRevisionLabel}</span></div><p>{syntheticFpcbProject.product} · 생산 2026.10.15 · 출시 2026.11.03</p></div>
          <div className="project-utility"><Link href={`${projectHref}/revision-impact`} className="button button--secondary">Revision 영향</Link><Link href={`${projectHref}/claim-chart`} className="button button--primary">Claim Chart 열기</Link></div>
        </div>
      </header>

      <nav className="phase-progress" aria-label="4단계 Gate 진행">
        {PHASES.map((value, index) => {
          const item = PHASE_META[value];
          const active = value === phase;
          const completed = value === 'PLANNING';
          return (
            <Link key={value} href={`${projectHref}?phase=${value}`} className={`${active ? 'active' : ''} ${completed ? 'completed' : ''}`} aria-current={active ? 'step' : undefined}>
              <span className="phase-number">{completed ? '✓' : item.number}</span>
              <span><small>PHASE {index + 1}</small><strong>{item.label}</strong><em>상태: {item.status}</em></span>
            </Link>
          );
        })}
      </nav>

      <div className="workspace-grid">
        <aside className="workspace-left" aria-labelledby="checklist-title">
          <section className="workspace-card checklist-card">
            <header><div><p className="eyebrow">REQUIRED</p><h2 id="checklist-title">필수 체크리스트</h2></div><strong>{checked.filter(Boolean).length}/{checked.length}</strong></header>
            <div className="checklist-progress"><span style={{ width: `${checked.filter(Boolean).length / checked.length * 100}%` }} /></div>
            <ul>
              {meta.checklist.map((item, index) => (
                <li key={item}>
                  <label><input type="checkbox" checked={checked[index]} disabled={readOnly} onChange={() => setChecked((values) => values.map((value, itemIndex) => itemIndex === index ? !value : value))} /><span aria-hidden="true" />{item}</label>
                  <small>{checked[index] ? '상태: 완료' : '상태: 필요'}</small>
                </li>
              ))}
            </ul>
          </section>
          <section className="workspace-card artifact-card">
            <header><div><p className="eyebrow">ARTIFACTS</p><h2>필수 산출물</h2></div></header>
            <ul>
              <li><span className="file-mark">CC</span><div><strong>Claim Chart</strong><p>{claimCount}개 요소 · UNKNOWN 1</p></div><Link href={`${projectHref}/claim-chart`}>보기</Link></li>
              <li><span className="file-mark">RS</span><div><strong>위험 평가표</strong><p>{riskCount}건 · HIGH 1</p></div><button type="button">보기</button></li>
              <li><span className="file-mark">RV</span><div><strong>Revision Impact</strong><p>R03 · Gate 2개 연결</p></div><Link href={`${projectHref}/revision-impact`}>보기</Link></li>
            </ul>
          </section>
        </aside>

        <section className="workspace-center" aria-labelledby="work-title">
          <div className="workspace-card work-card">
            <header className="work-header"><div><p className="eyebrow">GUIDED WORKSPACE · {meta.number}</p><h2 id="work-title">{meta.workTitle}</h2><p>{meta.description}</p></div><span className="status-badge status-badge--review">{meta.status}</span></header>
            {phase === 'PLANNING' ? <PlanningWork /> : null}
            {phase === 'DESIGN' ? <DesignWork projectHref={projectHref} evidenceState={evidenceState} onAddEvidence={addEvidence} readOnly={readOnly} /> : null}
            {phase === 'TEST' ? <TestWork /> : null}
            {phase === 'APPROVAL' ? <ApprovalWork /> : null}
          </div>
        </section>

        <aside className="workspace-right" aria-label="Gate 판정">
          <section className="workspace-card gate-card">
            <header><div><p className="eyebrow">GATE READINESS</p><h2>Gate 준비도</h2></div><span className="status-badge status-badge--review">{meta.status}</span></header>
            <div className="gate-meter"><div className="donut" style={{ '--progress': `${meta.readiness}%` } as React.CSSProperties}><strong>{meta.readiness}</strong><span>%</span></div><div><strong>{checked.filter(Boolean).length} / {checked.length}</strong><p>체크리스트 충족</p></div></div>
            <div className="progress-track" aria-label={`Gate 준비도 ${meta.readiness}%`}><span style={{ width: `${meta.readiness}%` }} /></div>
            <h3>차단 사유 <span>2</span></h3>
            <ul className="gate-blockers">
              <li><span className="blocker-icon">!</span><div><strong>Claim 요소 UNKNOWN</strong><p>요소 3에 근거가 없습니다.</p></div></li>
              <li><span className="blocker-icon blocker-icon--amber">△</span><div><strong>IP·법무 검토 필요</strong><p>HIGH 위험은 선행 승인이 필수입니다.</p></div></li>
            </ul>
          </section>
          <section className="workspace-card next-action-card">
            <p className="eyebrow">NEXT BEST ACTION</p><h2>다음 권장 행동</h2><strong>UNKNOWN 요소 근거 연결</strong><p>설계 도면 R03에서 중립축과 동박 패턴의 차이를 인용하세요.</p><Link href={`${projectHref}/claim-chart`} className="button button--primary button--wide">Claim Chart에서 해결</Link>
          </section>
          <section className="ai-draft-card" aria-label="AI 초안 샘플"><span>AI</span><div><strong>AI 초안 · 샘플</strong><p>인용 2건 · 신뢰도 78% · 사람 검토 필요</p></div></section>
        </aside>
      </div>
      <p className="demo-watermark">교육용 데모 · 실제 인증 아님</p>
    </main>
  );
}

function PlanningWork() {
  return <div className="work-body"><div className="feature-summary"><p>핵심 기술특징</p><strong>고굴곡 환경에서 동박 피로를 줄이는 중립축 분리 FPCB 적층 구조</strong><span>6개 기술요소로 구조화됨</span></div><div className="country-grid"><span>KR<strong>필수</strong></span><span>US<strong>필수</strong></span><span>EP<strong>필수</strong></span><span>PCT<strong>패밀리</strong></span></div><div className="instruction-box"><strong>검토 포인트</strong><p>기능 표현과 구조 표현을 분리하고 경쟁사 제품명이 검색식에 직접 포함되지 않았는지 확인하세요.</p></div></div>;
}

function DesignWork({ projectHref, evidenceState, onAddEvidence, readOnly }: { projectHref: string; evidenceState: string; onAddEvidence: () => void; readOnly: boolean }) {
  return <div className="work-body"><div className="analysis-summary"><article><small>검색 특허</small><strong>24</strong><span>KR 8 · US 7 · EP 5 · PCT 4</span></article><article><small>상세 분석</small><strong>6</strong><span>HIGH 1 · MEDIUM 2</span></article><article><small>Claim 요소</small><strong>3</strong><span>PRESENT 1 · PARTIAL 1 · UNKNOWN 1</span></article></div><div className="focus-claim"><header><div><span className="risk-chip">HIGH</span><strong>KR102345678B1 · 청구항 1</strong></div><Link href={`${projectHref}/claim-chart`}>전체 Chart →</Link></header><p>“반복 굴곡 영역에 배치된 복수의 동박 배선과 중립축 이격 구조…”</p><div className="comparison-row"><div><small>특허 요소</small><strong>중립축으로부터 0.3 mm 이격</strong></div><span>부분 일치</span><div><small>우리 설계 R03</small><strong>실측 이격 0.42 mm · 보강층 상이</strong></div></div></div><button className="evidence-action" type="button" onClick={onAddEvidence} disabled={readOnly || evidenceState === 'saving'}><span>＋</span><div><strong>R03 설계 근거 연결</strong><small>{evidenceState === 'saved' ? '저장 완료 · 근거 1건 추가됨' : evidenceState === 'failed' ? '저장 실패 · 읽기 전용 샘플을 확인하세요' : '도면 인용과 revision을 현재 Claim 요소에 추가'}</small></div><b>{evidenceState === 'saving' ? '저장 중' : '추가'}</b></button></div>;
}

function TestWork() {
  return <div className="work-body"><div className="test-matrix"><div className="matrix-head"><span>검증 항목</span><span>기준</span><span>결과</span><span>추적 상태</span></div><div><strong>동적 굴곡 수명</strong><span>R=5 mm / 20만 회</span><span className="result-pass">PASS · 23.6만</span><span>상태: 연결됨</span></div><div><strong>Micro-via 단면</strong><span>균열 0건</span><span className="result-pending">시험 예정</span><span>상태: 필요</span></div><div><strong>중립축 이격 실측</strong><span>0.40 mm 이상</span><span className="result-pass">PASS · 0.42</span><span>상태: 연결됨</span></div></div><div className="instruction-box"><strong>QA 검토 포인트</strong><p>시험 결과만 첨부하지 말고 Claim 요소와 설계 revision에 각각 연결해 추적성을 완성하세요.</p></div></div>;
}

function ApprovalWork() {
  return <div className="work-body approval-work"><div className="approval-watermark">승인 검토본 · 교육용</div><div className="legal-freshness"><span className="blocker-icon blocker-icon--ok">✓</span><div><strong>법적 상태 최신성 충족</strong><p>2026.08.22 확인 · 기준일 3일 전 · 7일 이내</p></div></div><ol className="decision-chain" aria-label="승인 순서"><li className="active"><span>1</span><div><strong>1차 결정 · IP·법무</strong><p>검토 중 · 2026.08.25 14:10</p><small>HIGH 위험의 Claim 중첩과 법적 상태를 먼저 판단</small></div><b>현재 단계</b></li><li><span>2</span><div><strong>2차 최종 승인 · 개발팀장</strong><p>선행 승인 대기</p><small>IP·법무 승인 이후 국가별 생산·출시 결정을 확정</small></div><b>대기</b></li></ol><table><caption>국가별 결정 현황</caption><thead><tr><th>국가</th><th>위험</th><th>IP·법무</th><th>개발팀장</th><th>결정</th></tr></thead><tbody><tr><td>KR</td><td><span className="risk-chip">HIGH</span></td><td>검토 중</td><td>선행 대기</td><td>보류</td></tr><tr><td>US</td><td><span className="risk-chip risk-chip--medium">MEDIUM</span></td><td>승인</td><td>대기</td><td>조건부 가능</td></tr><tr><td>EP</td><td>LOW</td><td>승인</td><td>대기</td><td>승인 가능</td></tr><tr><td>PCT</td><td>LOW</td><td>가족 검토</td><td>대기</td><td>보류</td></tr></tbody></table><div className="condition-box"><strong>조건 제안 · US</strong><p>2026.09.18까지 Micro-via 보강 시험 완료. 생산일 2026.10.15 이전.</p><span>남은 기간 24일 · 허용 범위 1–30일</span></div></div>;
}
