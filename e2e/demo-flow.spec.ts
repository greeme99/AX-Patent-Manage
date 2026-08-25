import { expect, test } from '@playwright/test';

test('desktop demo covers role cockpits, project phases, detail views, and approval notice', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '실무 담당자 Cockpit' })).toBeVisible();

  const roles = page.getByRole('combobox', { name: '데모 역할 전환' });
  await roles.selectOption('TEAM_LEAD');
  await expect(page.getByRole('heading', { name: '개발팀장 Cockpit' })).toBeVisible();
  await expect(page.getByText('IP·법무 선행 승인 대기', { exact: true })).toBeVisible();
  await roles.selectOption('IP_LEGAL');
  await expect(page.getByRole('heading', { name: 'IP·법무 Cockpit' })).toBeVisible();
  await expect(page.getByText('HIGH 위험 법무 검토', { exact: true })).toBeVisible();

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
