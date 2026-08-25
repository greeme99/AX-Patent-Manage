import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Role } from '../domain';
import { RoleCockpit } from './role-cockpit';

describe('RoleCockpit', () => {
  it.each<[Role, string, string, string, string, string]>([
    ['PRACTITIONER', '실무 담당자 Cockpit', 'Claim Chart 근거 보강', '근거 작성 책임', '내 업무 마감 임박', '근거 연결 계속'],
    ['RESPONSIBLE', '과제 책임자 Cockpit', '설계 Gate 검토 요청', 'Gate 제출 책임', '검토 패키지 동결 필요', '책임자 검토 시작'],
    ['TEAM_LEAD', '개발팀장 Cockpit', '최종 승인 대기', '최종 승인 책임', 'IP·법무 선행 승인 대기', '최종 결정 검토'],
    ['IP_LEGAL', 'IP·법무 Cockpit', 'HIGH 위험 법무 검토', '법적 판단 책임', '법적 상태 갱신 기한', '법무 검토 기록'],
    ['QA', 'QA Cockpit', '시험 증거 추적성 점검', '시험 추적 책임', '시험 증거 누락', 'QA 추적성 확인'],
  ])('%s 역할에 맞는 제목, Gate 책임, 알림, 승인 액션을 제공한다', (role, title, priority, responsibility, alert, approvalAction) => {
    const html = renderToStaticMarkup(createElement(RoleCockpit, { role }));

    expect(html).toContain(`<h1>${title}</h1>`);
    expect(html).toContain(priority);
    expect(html).toContain(responsibility);
    expect(html).toContain(alert);
    expect(html).toContain(approvalAction);
    expect(html).toContain('aria-label="핵심 지표"');
    expect(html).toContain('aria-label="승인 현황"');
  });
});
