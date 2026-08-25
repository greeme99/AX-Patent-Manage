import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, type AppDatabase } from './db/client';
import { auditEvents, demoSessions, phaseGates } from './db/schema';
import { ApiError, DemoService } from './demo-service';

const NOW = new Date('2026-08-25T03:00:00.000Z');

describe('DemoService integration', () => {
  let directory: string;
  let database: AppDatabase;
  let service: DemoService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'patent-gate-'));
    database = createDatabase({ url: `file:${join(directory, 'test.db')}` });
    await database.initialize();
    service = new DemoService(database, {
      secret: 'integration-test-secret-at-least-32-characters',
      now: () => NOW,
    });
  });

  afterEach(async () => {
    await database.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('creates a signed 24-hour HttpOnly session and a synthetic project clone', async () => {
    const opened = await service.openSession();

    expect(opened.session.role).toBe('PRACTITIONER');
    expect(opened.session.expiresAt).toBe('2026-08-26T03:00:00.000Z');
    expect(opened.demoAuth).toBe(true);
    expect(opened.cookie).toContain('demo_session=');
    expect(opened.cookie).toContain('Max-Age=86400');
    expect(opened.cookie).toContain('HttpOnly');
    expect(opened.cookie).toContain('SameSite=Lax');

    const projects = await service.listProjects(opened.cookie);
    expect(projects).toHaveLength(1);
    expect(projects[0]).toMatchObject({
      code: 'FPCB-EV-BMS-001',
      phase: 'DESIGN',
      version: 1,
    });
  });

  it('isolates every query by session id', async () => {
    const first = await service.openSession();
    const second = await service.openSession();
    const firstProjects = await service.listProjects(first.cookie);
    const secondProjects = await service.listProjects(second.cookie);

    expect(first.session.id).not.toBe(second.session.id);
    expect(firstProjects[0].id).not.toBe(secondProjects[0].id);
    await expect(service.getProject(second.cookie, firstProjects[0].id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('rejects a lazily discovered expired session', async () => {
    const opened = await service.openSession();
    const expiredService = new DemoService(database, {
      secret: 'integration-test-secret-at-least-32-characters',
      now: () => new Date('2026-08-26T03:00:00.001Z'),
    });

    await expect(expiredService.listProjects(opened.cookie)).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
      status: 401,
    });
  });

  it('reset retires the old session and creates a fresh clone', async () => {
    const opened = await service.openSession();
    const oldProject = (await service.listProjects(opened.cookie))[0];
    const reset = await service.resetSession(opened.cookie);
    const newProject = (await service.listProjects(reset.cookie))[0];

    expect(reset.session.id).not.toBe(opened.session.id);
    expect(newProject.id).not.toBe(oldProject.id);
    await expect(service.listProjects(opened.cookie)).rejects.toMatchObject({
      code: 'SESSION_RETIRED',
      status: 401,
    });
  });

  it('replays role changes idempotently and returns the current record on stale version', async () => {
    const opened = await service.openSession();
    const first = await service.switchRole(
      opened.cookie,
      { role: 'IP_LEGAL', version: 1 },
      'role-change-1',
    );
    const replay = await service.switchRole(
      opened.cookie,
      { role: 'IP_LEGAL', version: 1 },
      'role-change-1',
    );

    expect(replay).toEqual(first);
    expect(first.data).toMatchObject({ role: 'IP_LEGAL', version: 2 });
    expect((await database.db.select().from(auditEvents))).toHaveLength(1);

    try {
      await service.switchRole(
        opened.cookie,
        { role: 'TEAM_LEAD', version: 1 },
        'role-change-2',
      );
      throw new Error('expected conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ code: 'VERSION_CONFLICT', status: 409 });
      expect((error as ApiError).current).toMatchObject({ role: 'IP_LEGAL', version: 2 });
    }
  });

  it('requires IP Legal approval before Team Lead for elevated risk', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];
    const gate = (await database.db.select().from(phaseGates)).find(
      (candidate) => candidate.sessionId === opened.session.id && candidate.phase === 'DESIGN',
    );
    expect(gate).toBeDefined();

    const lead = await service.switchRole(
      opened.cookie,
      { role: 'TEAM_LEAD', version: 1 },
      'become-lead',
    );
    await expect(
      service.createApproval(
        opened.cookie,
        {
          gateId: gate!.id,
          projectId: project.id,
          decision: 'APPROVED',
          version: gate!.version,
        },
        'lead-first',
      ),
    ).rejects.toMatchObject({ code: 'IP_LEGAL_APPROVAL_REQUIRED', status: 422 });

    const legal = await service.switchRole(
      opened.cookie,
      { role: 'IP_LEGAL', version: lead.data.version },
      'become-legal',
    );
    const legalApproval = await service.createApproval(
      opened.cookie,
      {
        gateId: gate!.id,
        projectId: project.id,
        decision: 'APPROVED',
        version: gate!.version,
      },
      'legal-approves',
    );
    const leadAgain = await service.switchRole(
      opened.cookie,
      { role: 'TEAM_LEAD', version: legal.data.version },
      'become-lead-again',
    );
    const leadApproval = await service.createApproval(
      opened.cookie,
      {
        gateId: gate!.id,
        projectId: project.id,
        decision: 'APPROVED',
        version: legalApproval.data.gateVersion,
      },
      'lead-approves',
    );

    expect(leadAgain.data.role).toBe('TEAM_LEAD');
    expect(legalApproval.data.approval.role).toBe('IP_LEGAL');
    expect(leadApproval.data.approval.role).toBe('TEAM_LEAD');
    expect(leadApproval.data.gateVersion).toBe(gate!.version + 2);
    expect((await database.db.select().from(phaseGates)).find(
      (candidate) => candidate.id === gate!.id,
    )?.status).toBe('APPROVED');
  });

  it('makes an IP Legal rejection final and enforces sequential phases', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];
    const designGate = (await database.db.select().from(phaseGates)).find(
      (candidate) => candidate.sessionId === opened.session.id && candidate.phase === 'DESIGN',
    )!;
    const legal = await service.switchRole(
      opened.cookie,
      { role: 'IP_LEGAL', version: 1 },
      'legal-role',
    );
    const rejection = await service.createApproval(
      opened.cookie,
      {
        gateId: designGate.id,
        projectId: project.id,
        decision: 'REJECTED',
        reason: 'blocking claim overlap',
        version: designGate.version,
      },
      'legal-rejects',
    );
    const lead = await service.switchRole(
      opened.cookie,
      { role: 'TEAM_LEAD', version: legal.data.version },
      'lead-role',
    );

    await expect(
      service.createApproval(
        opened.cookie,
        {
          gateId: designGate.id,
          projectId: project.id,
          decision: 'APPROVED',
          version: rejection.data.gateVersion,
        },
        'override-rejection',
      ),
    ).rejects.toMatchObject({ code: 'LEGAL_REJECTION_FINAL', status: 422 });
    expect(lead.data.role).toBe('TEAM_LEAD');

    await expect(
      service.startPhase(opened.cookie, project.id, 'TEST', { version: project.version }, 'start-test'),
    ).rejects.toMatchObject({ code: 'PREVIOUS_PHASE_NOT_APPROVED', status: 422 });
  });

  it('marks revision-linked gates stale once and audits the impact', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];

    const first = await service.recordRevisionImpact(
      opened.cookie,
      { projectId: project.id, changedRevisionId: project.currentRevisionId, version: project.version },
      'revision-impact-1',
    );
    const replay = await service.recordRevisionImpact(
      opened.cookie,
      { projectId: project.id, changedRevisionId: project.currentRevisionId, version: project.version },
      'revision-impact-1',
    );
    const gates = (await database.db.select().from(phaseGates)).filter(
      (gate) => gate.sessionId === opened.session.id,
    );

    expect(replay).toEqual(first);
    expect(first.data.affectedGateIds).toHaveLength(4);
    expect(gates.every((gate) => gate.status === 'STALE' && gate.version === 2)).toBe(true);
    expect((await database.db.select().from(auditEvents)).filter(
      (event) => event.action === 'REVISION_IMPACT_RECORDED',
    )).toHaveLength(1);
  });

  it('persists the required schema with versioned session-owned records', async () => {
    const tables = await database.client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    const names = tables.rows.map((row) => String(row.name));

    expect(names).toEqual(
      expect.arrayContaining([
        'approvals',
        'audit_events',
        'claim_elements',
        'conditions',
        'demo_sessions',
        'evidence',
        'features',
        'jobs',
        'notifications',
        'patents',
        'phase_gates',
        'projects',
        'risks',
        'search_runs',
      ]),
    );

    const sessions = await database.db.select().from(demoSessions);
    expect(sessions).toEqual([]);
  });
});
