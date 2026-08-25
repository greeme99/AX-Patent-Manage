import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ClaimChart } from './claim-chart';

describe('ClaimChart', () => {
  it('청구항 요소, 설계 대응, 근거, 판정을 하나의 접근 가능한 고밀도 표로 제공한다', () => {
    const html = renderToStaticMarkup(createElement(ClaimChart));

    expect(html).toContain('<caption>KR102345678B1 청구항 1 요소별 대응표</caption>');
    expect(html).toContain('scope="col"');
    expect(html).toContain('요소 1 · 반복 굴곡 영역');
    expect(html).toContain('상태: PRESENT');
    expect(html).toContain('상태: PARTIAL');
    expect(html).toContain('상태: UNKNOWN');
    expect(html).toContain('AI 초안 · 사람 검토 필요');
  });
});
