import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Role } from '../domain';
import { RoleCockpit } from './role-cockpit';

describe('RoleCockpit', () => {
  it.each<[Role, string, string]>([
    ['PRACTITIONER', '실무 담당자 Cockpit', 'Claim Chart 근거 보강'],
    ['RESPONSIBLE', '과제 책임자 Cockpit', '설계 Gate 검토 요청'],
    ['TEAM_LEAD', '개발팀장 Cockpit', '최종 승인 대기'],
    ['IP_LEGAL', 'IP·법무 Cockpit', 'HIGH 위험 법무 검토'],
    ['QA', 'QA Cockpit', '시험 증거 추적성 점검'],
  ])('%s 역할에 맞는 제목과 최우선 업무를 제공한다', (role, title, priority) => {
    const html = renderToStaticMarkup(createElement(RoleCockpit, { role }));

    expect(html).toContain(`<h1>${title}</h1>`);
    expect(html).toContain(priority);
    expect(html).toContain('aria-label="핵심 지표"');
    expect(html).toContain('aria-label="승인 현황"');
  });
});
