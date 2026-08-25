import { expect, test } from '@playwright/test';

test('desktop demo covers role cockpits, project phases, detail views, and approval notice', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '실무 담당자 Cockpit' })).toBeVisible();

  const roles = page.getByRole('combobox', { name: '데모 역할 전환' });
  await roles.selectOption('RESPONSIBLE');
  await expect(page.getByRole('heading', { name: '과제 책임자 Cockpit' })).toBeVisible();
  await expect(page.getByText('설계 Gate 검토 요청', { exact: true })).toBeVisible();
  await roles.selectOption('TEAM_LEAD');
  await expect(page.getByRole('heading', { name: '개발팀장 Cockpit' })).toBeVisible();
  await expect(page.getByText('IP·법무 선행 승인 대기', { exact: true })).toBeVisible();
  await roles.selectOption('IP_LEGAL');
  await expect(page.getByRole('heading', { name: 'IP·법무 Cockpit' })).toBeVisible();
  await expect(page.getByText('HIGH 위험 법무 검토', { exact: true })).toBeVisible();
  await roles.selectOption('QA');
  await expect(page.getByRole('heading', { name: 'QA Cockpit' })).toBeVisible();
  await expect(page.getByText('시험 증거 추적성 점검', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: /프로젝트 열기/ }).click();
  await expect(page.getByRole('heading', { name: 'EV 배터리 관리 모듈용 고굴곡 FPCB' })).toBeVisible();
  for (const [number, phase, work] of [[1, '기획', '기술특징 구조화'], [2, '설계', '선행기술·Claim 분석'], [3, '시험', '비침해 검증'], [4, '승인', '국가별 승인 결정']] as const) {
    await page.getByRole('navigation', { name: '4단계 Gate 진행' })
      .getByRole('link', { name: new RegExp(`PHASE ${number} ${phase}`) }).click();
    await expect(page.getByRole('heading', { name: work })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: '승인' })).toBeVisible();
  await expect(page.getByRole('list', { name: '승인 순서' })).toBeVisible();
  await expect(page.getByText('승인 검토본 · 교육용')).toBeVisible();
  await expect(page.getByText('교육용 데모 · 실제 인증 아님').last()).toBeVisible();

  const mainMenu = page.getByRole('complementary', { name: '주 메뉴' });
  await mainMenu.getByRole('link', { name: 'Claim Chart', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Claim Chart' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'KR102345678B1 청구항 1 요소별 대응표' })).toBeVisible();
  await mainMenu.getByRole('link', { name: 'Revision 영향', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Revision 영향 분석' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '연결 Gate 영향' })).toBeVisible();

  await page.getByRole('link', { name: /알림 3건/ }).click();
  await expect(page.getByRole('heading', { name: '알림', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '시스템 진단' }).click();
  await expect(page.getByRole('heading', { name: '시스템 진단' })).toBeVisible();
  await expect(page.getByText('상태: SAMPLE', { exact: true })).toBeVisible();
});

test('mobile viewport shows the PC-only notice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'PC에서 이용해 주세요' })).toBeVisible();
});

test('completes the persisted claim-to-approval snapshot flow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: '데모 역할 전환' })).toBeEnabled();
  async function api(path: string, init?: { method?: string; data?: unknown; key?: string }) {
    return page.evaluate(async ({ path, init }) => {
      const response = await fetch(path, {
        method: init?.method,
        headers: {
          ...(init?.data ? { 'Content-Type': 'application/json' } : {}),
          ...(init?.key ? { 'Idempotency-Key': init.key } : {}),
        },
        body: init?.data ? JSON.stringify(init.data) : undefined,
      });
      return { ok: response.ok, status: response.status, data: await response.json() };
    }, { path, init });
  }
  const project = (await api('/api/projects')).data.data[0] as { id: string; version: number };

  await page.goto(`/projects/${project.id}/claim-chart`);
  await page.getByLabel('요소 3 · 수지 충전 Micro-via 판정').selectOption('ABSENT');
  await expect(page.getByText('판정이 저장되었습니다.')).toBeVisible();
  await page.getByRole('button', { name: '근거 연결 필요' }).click();
  await expect(page.getByText('근거가 Claim 요소에 연결되었습니다.')).toBeVisible();
  const claims = (await api(`/api/projects/${project.id}/claim-charts`)).data as {
    data: { status: string; evidenceIds: string[] }[];
  };
  expect(claims.data.some((claim) => claim.status === 'UNKNOWN')).toBe(false);

  async function role(role: string) {
    const current = (await api('/api/demo/session')).data as { session: { version: number } };
    const response = await api('/api/demo/role', { method: 'POST', key: crypto.randomUUID(), data: { role, version: current.session.version } });
    expect(response.ok).toBe(true);
  }
  async function approve(gateId: string, version: number) {
    const response = await api(`/api/projects/${project.id}/approvals`, {
      method: 'POST', key: crypto.randomUUID(), data: { projectId: project.id, gateId, decision: 'APPROVED', version },
    });
    expect(response.ok).toBe(true);
    return response.data.data as { gateVersion: number; gateStatus: string };
  }
  async function currentProject() {
    return (await api('/api/projects')).data.data.find(
      (value: { id: string }) => value.id === project.id,
    ) as { id: string; version: number };
  }
  async function gates() {
    return (await api(`/api/projects/${project.id}/gates`)).data.data as {
      id: string; phase: string; version: number;
    }[];
  }
  async function approveCurrentPhase(phase: string) {
    const gate = (await gates()).find((value) => value.phase === phase)!;
    await role('IP_LEGAL');
    const legal = await approve(gate.id, gate.version);
    expect(legal.gateStatus).toBe('IN_REVIEW');
    await role('TEAM_LEAD');
    const final = await approve(gate.id, legal.gateVersion);
    expect(final.gateStatus).toBe('APPROVED');
  }
  async function start(phase: string) {
    const current = await currentProject();
    const response = await api(`/api/projects/${project.id}/phases/${phase}`, {
      method: 'PATCH', key: crypto.randomUUID(), data: { version: current.version },
    });
    expect(response.ok).toBe(true);
  }

  await approveCurrentPhase('DESIGN');
  await start('TEST');
  await approveCurrentPhase('TEST');
  await start('APPROVAL');
  await approveCurrentPhase('APPROVAL');

  const snapshot = (await api(`/api/projects/${project.id}/approval-package`)).data as Record<string, unknown>;
  const expected = await page.evaluate(async (manifest) => {
    const { sha256: _sha256, ...unsigned } = manifest as Record<string, unknown>;
    const bytes = new TextEncoder().encode(JSON.stringify(unsigned));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }, snapshot);
  expect(snapshot.sha256).toBe(expected);
});
