import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import HomePage from './page';

describe('교육용 역할 Cockpit', () => {
  it('실무 담당자의 오늘 업무와 실제 인증이 아니라는 고지를 제공한다', () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain('실무 담당자 Cockpit');
    expect(html).toContain('오늘의 우선 업무');
    expect(html).toContain('교육용 데모 · 실제 인증 아님');
  });

  it('작은 화면 사용자에게 제목이 연결된 PC 이용 안내 대화상자를 제공한다', () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-labelledby="pc-only-title"');
    expect(html).toContain('id="pc-only-title"');
    expect(html).toContain('PC에서 이용해 주세요');
  });
});
