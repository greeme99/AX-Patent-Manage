'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CLAIM_ELEMENT_STATUSES, syntheticFpcbProject, type ClaimElementStatus } from '../domain';

interface ClaimChartProps {
  projectId?: string;
  readOnly?: boolean;
}

export function ClaimChart({ projectId = syntheticFpcbProject.id, readOnly = false }: ClaimChartProps) {
  const [statuses, setStatuses] = useState<ClaimElementStatus[]>(() => syntheticFpcbProject.claimElements.map((element) => element.status));
  const patent = syntheticFpcbProject.patents[0];

  return (
    <main id="main-content" className="claim-page" tabIndex={-1}>
      {readOnly ? <div className="readonly-banner" role="status"><strong>샘플 읽기 전용</strong><span>상태 변경은 저장되지 않습니다.</span></div> : null}
      <div className="breadcrumbs"><Link href="/">Cockpit</Link><span>/</span><Link href={`/projects/${projectId}`}>{syntheticFpcbProject.code}</Link><span>/</span><strong>Claim Chart</strong></div>
      <header className="claim-heading">
        <div><p className="eyebrow">HIGH-DENSITY REVIEW</p><h1>Claim Chart</h1><p>청구항 요소와 설계 {syntheticFpcbProject.currentRevisionLabel}의 대응 근거를 한 줄씩 확정합니다.</p></div>
        <div><span className="ai-review-chip">AI 초안 · 사람 검토 필요</span><Link className="button button--secondary" href={`/projects/${projectId}?phase=DESIGN`}>설계 Gate로 돌아가기</Link></div>
      </header>
      <section className="patent-summary" aria-label="분석 대상 특허">
        <div><span className="country-flag">{patent.jurisdiction}</span><div><small>{patent.publicationNumber}</small><strong>{patent.title}</strong></div></div>
        <dl><div><dt>법적 상태</dt><dd>{patent.legalStatus}</dd></div><div><dt>최신 확인</dt><dd>2026.08.22 · 3일 전</dd></div><div><dt>위험 수준</dt><dd><span className="risk-chip">{patent.risk}</span></dd></div><div><dt>대상 청구항</dt><dd>독립항 1</dd></div></dl>
      </section>
      <div className="chart-toolbar"><div><button type="button" className="active">청구항 1 <span>3</span></button><button type="button">청구항 8 <span>4</span></button><button type="button">청구항 12 <span>2</span></button></div><div><label>표시 <select aria-label="Claim 요소 필터"><option>전체 요소</option><option>UNKNOWN만</option><option>근거 누락</option></select></label><span>근거 연결 2 / 3</span></div></div>
      <div className="claim-table-wrap">
        <table className="claim-table">
          <caption>KR102345678B1 청구항 1 요소별 대응표</caption>
          <thead><tr><th scope="col"># / 청구항 요소</th><th scope="col">우리 설계 {syntheticFpcbProject.currentRevisionLabel}</th><th scope="col">연결 근거</th><th scope="col">판정</th><th scope="col">위험·검토</th></tr></thead>
          <tbody>
            {syntheticFpcbProject.claimElements.map((element, index) => {
              const evidence = syntheticFpcbProject.evidence[index];
              const status = statuses[index];
              return <tr key={element.label} className={status === 'UNKNOWN' ? 'claim-row--blocked' : ''}>
                <th scope="row"><span className="element-index">E{index + 1}</span><strong>{element.label}</strong><p>{element.claimText}</p><small>원문 위치 · Claim 1, col. {4 + index}:{12 + index * 7}</small></th>
                <td><strong>{element.designResponse}</strong><p>{index === 1 ? '차이점: 보강층 재질 및 굴곡부 배선 폭 단계가 상이함' : index === 2 ? '담당자 확인과 단면 근거 연결 필요' : '기능 대응 확인됨'}</p><span className="revision-chip">{syntheticFpcbProject.currentRevisionLabel}</span></td>
                <td>{evidence ? <div className="evidence-cell"><span className="file-mark">EV</span><div><strong>{evidence.label}</strong><p>“{evidence.quote}”</p><small>{evidence.source}</small></div></div> : <button className="missing-evidence" type="button" disabled={readOnly}><span>＋</span><strong>근거 연결 필요</strong><small>도면 또는 시험 인용 추가</small></button>}</td>
                <td><label className={`claim-status claim-status--${status.toLowerCase()}`}><span>상태: {status}</span><select aria-label={`${element.label} 판정`} value={status} disabled={readOnly} onChange={(event) => setStatuses((values) => values.map((value, itemIndex) => itemIndex === index ? event.target.value as ClaimElementStatus : value))}>{CLAIM_ELEMENT_STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label><small>{status === 'UNKNOWN' ? '최종 승인 차단' : status === 'PARTIAL' ? '법무 검토 필요' : '근거 확인 완료'}</small></td>
                <td><span className={status === 'UNKNOWN' ? 'risk-chip' : index === 1 ? 'risk-chip risk-chip--medium' : 'status-badge'}>{status === 'UNKNOWN' ? 'HIGH' : index === 1 ? 'MEDIUM' : 'LOW'}</span><p>{status === 'UNKNOWN' ? '담당: 실무자' : '담당: IP·법무'}</p><button type="button">검토 메모 {index + 1}</button></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
      <footer className="claim-footer"><div><span className="blocker-icon">!</span><div><strong>최종 승인 차단 요소 1건</strong><p>UNKNOWN 상태 또는 근거 없는 PRESENT/PARTIAL은 승인할 수 없습니다.</p></div></div><div><span>마지막 편집: 2026.08.25 14:30 · 합성 데이터</span><button className="button button--primary" type="button" disabled={readOnly || statuses.includes('UNKNOWN')}>검토 완료로 표시</button></div></footer>
      <p className="demo-watermark">교육용 데모 · 실제 인증 아님 · AI 초안</p>
    </main>
  );
}
