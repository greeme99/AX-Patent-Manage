import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Phase } from '../domain';
import { ProjectWorkspace } from './project-workspace';

describe('ProjectWorkspace', () => {
  it.each<[Phase, string]>([
    ['PLANNING', '기술특징 구조화'],
    ['DESIGN', '선행기술·Claim 분석'],
    ['TEST', '비침해 검증'],
    ['APPROVAL', '국가별 승인 결정'],
  ])('%s 단계의 안내 작업과 전체 Gate 맥락을 제공한다', (phase, workTitle) => {
    const html = renderToStaticMarkup(createElement(ProjectWorkspace, { phase }));

    expect(html).toContain(workTitle);
    expect(html).toContain('aria-label="4단계 Gate 진행"');
    expect(html).toContain('필수 체크리스트');
    expect(html).toContain('Gate 준비도');
    expect(html).toContain('차단 사유');
    expect(html).toContain('상태:');
  });

  it('승인 단계에서 IP·법무 결정 뒤 개발팀장 최종 승인 순서를 명시한다', () => {
    const html = renderToStaticMarkup(createElement(ProjectWorkspace, { phase: 'APPROVAL' }));

    expect(html).toContain('aria-label="승인 순서"');
    expect(html).toContain('1차 결정 · IP·법무');
    expect(html).toContain('검토 중 · 2026.08.25 14:10');
    expect(html).toContain('2차 최종 승인 · 개발팀장');
    expect(html).toContain('선행 승인 대기');
  });
});
