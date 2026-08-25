'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import type { Role } from '../domain';
import { AppShell } from './app-shell';
import { resetDemoSession } from './demo-client';
import { createProjectShellState, performProjectRoleSwitch, ProjectShellFeedback } from './project-shell-state';

interface ProjectShellProps {
  children: ReactNode;
  projectId: string;
  initialRole: Role;
  initialVersion: number;
  readOnly: boolean;
  active?: 'project' | 'notifications' | 'diagnostics';
}

export function ProjectShell({ children, projectId, initialRole, initialVersion, readOnly, active = 'project' }: ProjectShellProps) {
  const router = useRouter();
  const [shellState, setShellState] = useState(() => createProjectShellState(initialRole, initialVersion, readOnly));
  const [busy, setBusy] = useState(false);
  const keyFactory = () => globalThis.crypto.randomUUID();

  async function changeRole(nextRole: Role) {
    if (shellState.readOnly) {
      if (!shellState.error) setShellState((state) => ({ ...state, role: nextRole }));
      return;
    }
    setBusy(true);
    try {
      setShellState(await performProjectRoleSwitch(shellState, nextRole, fetch, keyFactory));
    } finally { setBusy(false); }
  }

  async function reset() {
    if (shellState.readOnly) { router.push('/'); return; }
    setBusy(true);
    try {
      await resetDemoSession(fetch, shellState.version, keyFactory);
      router.push('/');
      router.refresh();
    } catch (error) {
      setShellState((state) => ({ ...state, readOnly: true, error: error instanceof Error ? error.message : '세션 초기화 실패' }));
    } finally { setBusy(false); }
  }

  return <AppShell role={shellState.role} projectId={projectId} active={active} busy={busy} onRoleChange={shellState.error ? undefined : changeRole} onReset={reset}><ProjectShellFeedback {...shellState} />{children}</AppShell>;
}
