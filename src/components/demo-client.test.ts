import { describe, expect, it, vi } from 'vitest';

import { ensureDemoSession, switchDemoRole } from './demo-client';

describe('demo client API', () => {
  it('세션이 없으면 nonce GET 뒤 version 0과 idempotency key로 생성한다', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ session: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session: { id: 'session-1', role: 'PRACTITIONER', version: 1 },
      }), { status: 201 }));

    const result = await ensureDemoSession(fetcher, () => 'bootstrap-key');

    expect(result.session.id).toBe('session-1');
    expect(fetcher).toHaveBeenNthCalledWith(1, '/api/demo/session', expect.objectContaining({ method: 'GET' }));
    expect(fetcher).toHaveBeenNthCalledWith(2, '/api/demo/session', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Idempotency-Key': 'bootstrap-key' }),
      body: JSON.stringify({ version: 0 }),
    }));
  });

  it('기존 세션은 새로 만들지 않고 그대로 사용한다', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      session: { id: 'session-1', role: 'QA', version: 4 },
    }), { status: 200 }));

    const result = await ensureDemoSession(fetcher, () => 'unused');

    expect(result.session.role).toBe('QA');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('역할 전환 요청에 선택 역할과 현재 version을 포함한다', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { id: 'session-1', role: 'IP_LEGAL', version: 3 },
    }), { status: 200 }));

    await switchDemoRole(fetcher, 'IP_LEGAL', 2, () => 'role-key');

    expect(fetcher).toHaveBeenCalledWith('/api/demo/role', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'Idempotency-Key': 'role-key' }),
      body: JSON.stringify({ role: 'IP_LEGAL', version: 2 }),
    }));
  });
});
