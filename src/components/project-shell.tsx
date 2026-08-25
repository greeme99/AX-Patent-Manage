'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import type { Role } from '../domain';
import { AppShell } from './app-shell';
import { resetDemoSession, switchDemoRole } from './demo-client';

interface ProjectShellProps {
  children: ReactNode;
  projectId: string;
  initialRole: Role;
  readOnly: boolean;
  active?: 'project' | 'notifications' | 'diagnostics';
}

export function ProjectShell({ children, projectId, initialRole, readOnly, active = 'project' }: ProjectShellProps) {
  const router = useRouter();
  const [role, setRole] = useState(initialRole);
  const [version, setVersion] = useState(1);
  const [busy, setBusy] = useState(false);
  const keyFactory = () => globalThis.crypto.randomUUID();

  async function changeRole(nextRole: Role) {
    if (readOnly) { setRole(nextRole); return; }
    setBusy(true);
    try {
      const updated = await switchDemoRole(fetch, nextRole, version, keyFactory);
      setRole(updated.role);
      setVersion(updated.version);
    } finally { setBusy(false); }
  }

  async function reset() {
    if (readOnly) { router.push('/'); return; }
    setBusy(true);
    try {
      await resetDemoSession(fetch, version, keyFactory);
      router.push('/');
      router.refresh();
    } finally { setBusy(false); }
  }

  return <AppShell role={role} projectId={projectId} active={active} busy={busy} onRoleChange={changeRole} onReset={reset}>{children}</AppShell>;
}
