'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { ROLES, syntheticFpcbProject, type Role } from '../domain';
import { MobileNotice } from './mobile-notice';

const ROLE_LABELS: Record<Role, string> = {
  PRACTITIONER: '실무 담당자',
  RESPONSIBLE: '과제 책임자',
  TEAM_LEAD: '개발팀장',
  IP_LEGAL: 'IP·법무',
  QA: 'QA',
};

interface AppShellProps {
  children: ReactNode;
  role?: Role;
  projectId?: string;
  active?: 'cockpit' | 'project' | 'notifications' | 'diagnostics';
  busy?: boolean;
  onRoleChange?: (role: Role) => void;
  onReset?: () => void;
}

export function AppShell({
  children,
  role = 'PRACTITIONER',
  projectId = syntheticFpcbProject.id,
  active = 'cockpit',
  busy = false,
  onRoleChange,
  onReset,
}: AppShellProps) {
  const projectHref = `/projects/${projectId}`;

  return (
    <>
      <MobileNotice />
      <div className="desktop-app">
        <a className="skip-link" href="#main-content">본문으로 바로가기</a>
        <header className="topbar">
          <Link className="brand" href="/" aria-label="Patent Gate 홈">
            <span className="brand-mark" aria-hidden="true">PG</span>
            <span><strong>PATENT GATE</strong><small>개발특허 의사결정 시스템</small></span>
          </Link>
          <div className="project-switcher">
            <span className="project-switcher__label">활성 프로젝트</span>
            <Link href={projectHref}>
              <span className="project-code">{syntheticFpcbProject.code}</span>
              <strong>{syntheticFpcbProject.name}</strong>
              <span aria-hidden="true">⌄</span>
            </Link>
          </div>
          <div className="topbar-actions">
            <span className="training-chip">교육용 데모 · 실제 인증 아님</span>
            <label className="role-switcher">
              <span>데모 역할</span>
              <select
                aria-label="데모 역할 전환"
                value={role}
                disabled={busy || !onRoleChange}
                onChange={(event) => onRoleChange?.(event.target.value as Role)}
              >
                {ROLES.map((value) => <option value={value} key={value}>{ROLE_LABELS[value]}</option>)}
              </select>
            </label>
            {onReset ? <button className="icon-button" type="button" onClick={onReset} disabled={busy} aria-label="데모 초기화">↻</button> : null}
            <Link className="notification-button" href="/notifications" aria-label="알림 3건">♢<span>3</span></Link>
            <div className="avatar" aria-label={`현재 역할 ${ROLE_LABELS[role]}`}>{ROLE_LABELS[role].slice(0, 1)}</div>
          </div>
        </header>

        <aside className="sidebar" aria-label="주 메뉴">
          <nav>
            <p>WORKSPACE</p>
            <Link className={active === 'cockpit' ? 'active' : ''} href="/" aria-current={active === 'cockpit' ? 'page' : undefined}><span aria-hidden="true">⌂</span> Cockpit</Link>
            <Link className={active === 'project' ? 'active' : ''} href={projectHref} aria-current={active === 'project' ? 'page' : undefined}><span aria-hidden="true">▦</span> 프로젝트</Link>
            <Link href={`${projectHref}/claim-chart`}><span aria-hidden="true">≣</span> Claim Chart</Link>
            <Link href={`${projectHref}/revision-impact`}><span aria-hidden="true">↯</span> Revision 영향</Link>
            <p>MONITORING</p>
            <Link className={active === 'notifications' ? 'active' : ''} href="/notifications" aria-current={active === 'notifications' ? 'page' : undefined}><span aria-hidden="true">◇</span> 알림 <b>3</b></Link>
            <Link className={active === 'diagnostics' ? 'active' : ''} href="/health" aria-current={active === 'diagnostics' ? 'page' : undefined}><span aria-hidden="true">◉</span> 시스템 진단</Link>
          </nav>
          <div className="sidebar-guide">
            <span aria-hidden="true">?</span>
            <div><strong>교육 가이드</strong><p>Gate 진행 방법과 역할별 책임을 확인하세요.</p><Link href={`${projectHref}?phase=PLANNING`}>가이드 시작 →</Link></div>
          </div>
          <footer><span className="system-dot" aria-hidden="true" /> <span><strong>샘플 모드 정상</strong><small>합성 데이터 · v0.1</small></span></footer>
        </aside>

        <div className="app-stage">{children}</div>
      </div>
    </>
  );
}
