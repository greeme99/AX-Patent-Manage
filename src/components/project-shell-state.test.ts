import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  ProjectShellFeedback,
  createProjectShellState,
  performProjectRoleSwitch,
} from './project-shell-state';

describe('project shell session state', () => {
  it('서버 version과 직전 응답 version을 연속 역할 변경에 사용한다', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'session-1', role: 'QA', version: 8 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'session-1', role: 'IP_LEGAL', version: 9 } }), { status: 200 }));
    let state = createProjectShellState('PRACTITIONER', 7, false);

    state = await performProjectRoleSwitch(state, 'QA', fetcher, () => 'role-1');
    state = await performProjectRoleSwitch(state, 'IP_LEGAL', fetcher, () => 'role-2');

    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/demo/role', expect.objectContaining({
      body: JSON.stringify({ role: 'QA', version: 7 }),
    }));
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/demo/role', expect.objectContaining({
      body: JSON.stringify({ role: 'IP_LEGAL', version: 8 }),
    }));
    expect(state).toMatchObject({ role: 'IP_LEGAL', version: 9, readOnly: false, error: null });
  });

  it('409 충돌 시 비파괴 읽기 전용 상태와 접근 가능한 오류 UI를 제공한다', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'VERSION_CONFLICT', message: 'Session was modified concurrently' },
    }), { status: 409 }));
    const state = await performProjectRoleSwitch(
      createProjectShellState('PRACTITIONER', 7, false),
      'TEAM_LEAD',
      fetcher,
      () => 'conflict-key',
    );
    const html = renderToStaticMarkup(createElement(ProjectShellFeedback, state));

    expect(state).toMatchObject({ role: 'PRACTITIONER', version: 7, readOnly: true });
    expect(html).toContain('role="alert"');
    expect(html).toContain('역할 전환 실패 · 읽기 전용으로 전환');
    expect(html).toContain('Session was modified concurrently');
  });
});
