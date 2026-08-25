'use client';

import { useEffect, useState } from 'react';

import { syntheticFpcbProject, type Role } from '../domain';
import { AppShell } from './app-shell';
import { ensureDemoSession, resetDemoSession, switchDemoRole, type DemoSessionView } from './demo-client';
import { RoleCockpit } from './role-cockpit';

function keyFactory() {
  return globalThis.crypto?.randomUUID?.() ?? `demo-${Date.now()}`;
}

export function DemoCockpit() {
  const [session, setSession] = useState<DemoSessionView>({ id: 'pending', role: 'PRACTITIONER', version: 1 });
  const [projectId, setProjectId] = useState(syntheticFpcbProject.id);
  const [busy, setBusy] = useState(true);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    let current = true;
    async function bootstrap() {
      try {
        const result = await ensureDemoSession(fetch, keyFactory);
        if (!current) return;
        setSession(result.session);
        const projects = await fetch('/api/projects', { cache: 'no-store' });
        if (!projects.ok) throw new Error('프로젝트 조회 실패');
        const payload = await projects.json() as { data: { id: string }[] };
        if (current && payload.data[0]) setProjectId(payload.data[0].id);
      } catch {
        if (current) setReadOnly(true);
      } finally {
        if (current) setBusy(false);
      }
    }
    void bootstrap();
    return () => { current = false; };
  }, []);

  async function changeRole(role: Role) {
    if (readOnly) {
      setSession((value) => ({ ...value, role }));
      return;
    }
    setBusy(true);
    try {
      setSession(await switchDemoRole(fetch, role, session.version, keyFactory));
    } catch {
      setReadOnly(true);
      setSession((value) => ({ ...value, role }));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (readOnly) {
      setSession({ id: 'sample', role: 'PRACTITIONER', version: 1 });
      return;
    }
    setBusy(true);
    try {
      const result = await resetDemoSession(fetch, session.version, keyFactory);
      setSession(result.session);
      const projects = await fetch('/api/projects', { cache: 'no-store' });
      const payload = await projects.json() as { data: { id: string }[] };
      if (payload.data[0]) setProjectId(payload.data[0].id);
    } catch {
      setReadOnly(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell role={session.role} projectId={projectId} busy={busy} onRoleChange={changeRole} onReset={reset}>
      <RoleCockpit role={session.role} projectId={projectId} readOnly={readOnly} />
    </AppShell>
  );
}
