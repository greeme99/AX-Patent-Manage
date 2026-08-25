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
});
