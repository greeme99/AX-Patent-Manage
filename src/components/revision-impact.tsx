'use client';

import Link from 'next/link';
import { useState } from 'react';

import { syntheticFpcbProject } from '../domain';

export function RevisionImpact({ projectId, revisionId, version, readOnly }: { projectId: string; revisionId: string; version: number; readOnly: boolean }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle');
  const [affectedGateIds, setAffectedGateIds] = useState<string[] | null>(null);

  async function recordImpact() {
    if (readOnly) return;
    setState('saving');
    try {
      const response = await fetch(`/api/projects/${projectId}/revision-impact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': globalThis.crypto.randomUUID() },
        body: JSON.stringify({ changedRevisionId: revisionId, version }),
      });
      const payload = await response.json() as { data?: { affectedGateIds: string[] } };
      if (!response.ok || !payload.data) throw new Error('failed');
      setAffectedGateIds(payload.data.affectedGateIds);
      setState('done');
    } catch { setState('failed'); }
  }

  return <main id="main-content" className="detail-page" tabIndex={-1}>
    {readOnly ? <div className="readonly-banner" role="status"><strong>샘플 읽기 전용</strong><span>영향 기록은 저장되지 않습니다.</span></div> : null}
    <div className="breadcrumbs"><Link href="/">Cockpit</Link><span>/</span><Link href={`/projects/${projectId}`}>{syntheticFpcbProject.code}</Link><span>/</span><strong>Revision 영향</strong></div>
    <header className="detail-heading"><div><p className="eyebrow">REVISION TRACEABILITY</p><h1>Revision 영향 분석</h1><p>설계 변경이 기존 검색, Claim Chart, 시험과 승인 Gate를 무효화하는지 확인합니다.</p></div><Link href={`/projects/${projectId}`} className="button button--secondary">워크스페이스로 돌아가기</Link></header>
    <div className="revision-summary"><div><small>현재 revision</small><strong>R03</strong><span>2026.08.21 동결</span></div><span aria-hidden="true">→</span><div><small>변경 예정</small><strong>R04</strong><span>ECO-2026-081</span></div><div className="revision-risk"><span className="risk-chip">HIGH 영향</span><strong>Gate {affectedGateIds?.length ?? 2}개 재검토 필요</strong><p>{affectedGateIds ? '저장된 영향 분석 결과를 반영했습니다.' : '설계·시험 Gate가 R03 근거에 연결되어 있습니다.'}</p></div></div>
    <section className="detail-card"><header><div><p className="eyebrow">CHANGESET</p><h2>변경 항목과 Claim 영향</h2></div><span className="status-badge">3개 항목</span></header><div className="impact-table"><div className="impact-head"><span>변경 항목</span><span>이전 R03</span><span>변경 R04</span><span>Claim 영향</span><span>필요 조치</span></div><div><strong>Micro-via 위치</strong><span>굴곡 경계 +0.8 mm</span><span>경계 +1.4 mm</span><span className="risk-chip">요소 3 · HIGH</span><span>단면 근거 재연결</span></div><div><strong>보강층 재질</strong><span>PI 25 μm</span><span>LCP 20 μm</span><span className="risk-chip risk-chip--medium">요소 2 · MEDIUM</span><span>차이점 법무 확인</span></div><div><strong>배선 폭 단계</strong><span>0.18 → 0.24</span><span>0.16 → 0.26</span><span>요소 1 · LOW</span><span>굴곡 시험 재수행</span></div></div></section>
    <div className="revision-grid"><section className="detail-card"><header><div><p className="eyebrow">AFFECTED GATES</p><h2>연결 Gate 영향</h2></div></header><ul className="impact-gates"><li className="done"><span>✓</span><div><strong>기획 Gate</strong><p>기술특징 범위 변경 없음</p></div><b>유효</b></li><li><span>!</span><div><strong>설계 Gate</strong><p>Claim Chart R03 근거 연결</p></div><b>STALE 예정</b></li><li><span>!</span><div><strong>시험 Gate</strong><p>굴곡 시험 TR-2408 재검증</p></div><b>STALE 예정</b></li><li><span>4</span><div><strong>승인 Gate</strong><p>선행 Gate 완료 후 재평가</p></div><b>대기</b></li></ul></section><section className="detail-card"><header><div><p className="eyebrow">REVIEW PLAN</p><h2>재검토 순서</h2></div></header><ol className="review-plan"><li><span>1</span><div><strong>변경 도면 R04 등록</strong><p>실무 담당자 · 오늘</p></div></li><li><span>2</span><div><strong>Claim 요소 2·3 재판정</strong><p>IP·법무 · D+2</p></div></li><li><span>3</span><div><strong>굴곡·단면 시험 재수행</strong><p>QA · D+5</p></div></li></ol><button type="button" className="button button--primary button--wide" onClick={recordImpact} disabled={readOnly || state === 'saving' || state === 'done'}>{state === 'saving' ? '기록 중…' : state === 'done' ? '영향 기록 완료' : state === 'failed' ? '실패 · 다시 시도' : 'Revision 영향 기록'}</button></section></div>
    <p className="demo-watermark">교육용 데모 · 실제 인증 아님</p>
  </main>;
}
