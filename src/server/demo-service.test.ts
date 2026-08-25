import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { createDatabase, type AppDatabase } from './db/client';
import { approvals, auditEvents, claimElements, demoSessions, phaseGates, projects, risks } from './db/schema';
import { ApiError, DemoService } from './demo-service';
import { DrizzleDemoRepository } from './drizzle-demo-repository';

const NOW = new Date('2026-08-25T03:00:00.000Z');

describe('DemoService integration', () => {
  let directory: string;
  let database: AppDatabase;
  let service: DemoService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'patent-gate-'));
    database = createDatabase({ url: `file:${join(directory, 'test.db')}` });
    await database.initialize();
    service = new DemoService(new DrizzleDemoRepository(database), {
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

  it('marks production session and bootstrap cookies Secure', async () => {
    const production = new DemoService(new DrizzleDemoRepository(database), {
      secret: 'integration-test-secret-at-least-32-characters',
      secureCookies: true,
      now: () => NOW,
    });
    const bootstrap = await production.readSession();
    const session = await production.openSession();

    expect(bootstrap.bootstrapCookie).toContain('Secure');
    expect(session.cookie).toContain('Secure');
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

  it('returns a canonical approval snapshot manifest with a verifiable SHA-256 digest', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];

    const manifest = await service.createApprovalPackage(opened.cookie, project.id);
    const { sha256, ...unsignedManifest } = manifest;

    expect(manifest).toMatchObject({
      format: 'patent-gate-demo/approval-snapshot-v1',
      project: { code: 'FPCB-EV-BMS-001' },
      watermark: '교육용 데모 — 법적 전자서명 아님',
    });
    expect(sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await service.createApprovalPackage(opened.cookie, project.id)).toEqual(manifest);
    expect(sha256).toBe((await import('node:crypto')).createHash('sha256')
      .update(JSON.stringify(unsignedManifest)).digest('hex'));
  });

  it('removes expired demo sessions and their synthetic project state', async () => {
    const expired = await service.openSession();
    const active = await service.openSession();
    await database.db.update(demoSessions).set({ expiresAt: new Date('2026-08-25T02:59:59.999Z') })
      .where(eq(demoSessions.id, expired.session.id));

    expect(await service.cleanupExpiredSessions()).toEqual({ deletedSessions: 1 });
    expect(await database.db.select().from(demoSessions)).toHaveLength(1);
    expect((await database.db.select().from(projects)).map((project) => project.sessionId))
      .toEqual([active.session.id]);
    await expect(service.listProjects(expired.cookie)).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });

  it('rejects a lazily discovered expired session', async () => {
    const opened = await service.openSession();
    const expiredService = new DemoService(new DrizzleDemoRepository(database), {
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
    await database.db.update(claimElements).set({ status: 'ABSENT', evidenceIds: [] });
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

  it('rejects IP Legal approval when the seeded claim chart contains UNKNOWN', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];
    const gate = (await database.db.select().from(phaseGates)).find(
      (candidate) => candidate.sessionId === opened.session.id && candidate.phase === 'DESIGN',
    )!;
    await service.switchRole(opened.cookie, { role: 'IP_LEGAL', version: 1 }, 'legal-role');

    await expect(service.createApproval(opened.cookie, {
      gateId: gate.id,
      projectId: project.id,
      decision: 'APPROVED',
      version: gate.version,
    }, 'blocked-unknown')).rejects.toMatchObject({
      code: 'GATE_NOT_READY',
      status: 422,
      details: { blockers: expect.arrayContaining(['CLAIM_ELEMENT_UNKNOWN']) },
    });
    expect(await database.db.select().from(approvals)).toHaveLength(0);
  });

  it('rejects IP Legal approval when required claim evidence is missing', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];
    const gate = (await database.db.select().from(phaseGates)).find(
      (candidate) => candidate.sessionId === opened.session.id && candidate.phase === 'DESIGN',
    )!;
    await database.db.update(claimElements).set({ status: 'ABSENT', evidenceIds: [] });
    const [claim] = await database.db.select().from(claimElements);
    await database.db.update(claimElements).set({ status: 'PRESENT', evidenceIds: [] })
      .where(eq(claimElements.id, claim.id));
    await service.switchRole(opened.cookie, { role: 'IP_LEGAL', version: 1 }, 'legal-role');

    await expect(service.createApproval(opened.cookie, {
      gateId: gate.id,
      projectId: project.id,
      decision: 'APPROVED',
      version: gate.version,
    }, 'blocked-evidence')).rejects.toMatchObject({
      code: 'GATE_NOT_READY',
      details: { blockers: expect.arrayContaining(['CLAIM_ELEMENT_EVIDENCE_MISSING']) },
    });
  });

  it('rejects IP Legal approval when the legal status check is stale', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];
    const gate = (await database.db.select().from(phaseGates)).find(
      (candidate) => candidate.sessionId === opened.session.id && candidate.phase === 'DESIGN',
    )!;
    await database.db.update(claimElements).set({ status: 'ABSENT', evidenceIds: [] });
    await database.db.update(projects).set({ legalStatusCheckedAt: '2026-08-01T00:00:00.000Z' })
      .where(eq(projects.id, project.id));
    await service.switchRole(opened.cookie, { role: 'IP_LEGAL', version: 1 }, 'legal-role');

    await expect(service.createApproval(opened.cookie, {
      gateId: gate.id,
      projectId: project.id,
      decision: 'APPROVED',
      version: gate.version,
    }, 'blocked-legal-status')).rejects.toMatchObject({
      code: 'GATE_NOT_READY',
      details: { blockers: expect.arrayContaining(['LEGAL_STATUS_STALE']) },
    });
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

  it('makes an IP Legal rejection terminal for later IP Legal decisions', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];
    const gate = (await database.db.select().from(phaseGates)).find(
      (candidate) => candidate.sessionId === opened.session.id && candidate.phase === 'DESIGN',
    )!;
    await service.switchRole(opened.cookie, { role: 'IP_LEGAL', version: 1 }, 'legal-role');
    const rejected = await service.createApproval(opened.cookie, {
      gateId: gate.id,
      projectId: project.id,
      decision: 'REJECTED',
      reason: 'terminal legal decision',
      version: gate.version,
    }, 'first-rejection');

    await expect(service.createApproval(opened.cookie, {
      gateId: gate.id,
      projectId: project.id,
      decision: 'APPROVED',
      version: rejected.data.gateVersion,
    }, 'later-legal-decision')).rejects.toMatchObject({
      code: 'LEGAL_REJECTION_FINAL',
      status: 422,
    });
    expect(await database.db.select().from(approvals)).toHaveLength(1);
  });

  it('scopes the same approval idempotency key to its target gate', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];
    const gate = (await database.db.select().from(phaseGates)).find(
      (candidate) => candidate.sessionId === opened.session.id && candidate.phase === 'DESIGN',
    )!;
    const secondProject = { ...project, id: randomUUID(), code: 'FPCB-EV-BMS-002', currentRevisionId: randomUUID() };
    const secondGate = { ...gate, id: randomUUID(), projectId: secondProject.id };
    await database.db.insert(projects).values(secondProject);
    await database.db.insert(phaseGates).values(secondGate);
    await database.db.update(claimElements).set({ status: 'ABSENT', evidenceIds: [] });
    await service.switchRole(opened.cookie, { role: 'IP_LEGAL', version: 1 }, 'legal-role');
    const first = await service.createApproval(opened.cookie, {
      gateId: gate.id, projectId: project.id, decision: 'APPROVED', version: gate.version,
    }, 'shared-approval-key');
    const second = await service.createApproval(opened.cookie, {
      gateId: secondGate.id, projectId: secondProject.id, decision: 'APPROVED', version: secondGate.version,
    }, 'shared-approval-key');

    expect(first.data.approval.gateId).toBe(gate.id);
    expect(second.data.approval.gateId).toBe(secondGate.id);
    expect(await database.db.select().from(approvals)).toHaveLength(2);
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
    expect(first.data.affectedGateIds).toHaveLength(2);
    expect(gates.filter((gate) => first.data.affectedGateIds.includes(gate.id))
      .every((gate) => gate.status === 'STALE' && gate.version === 2)).toBe(true);
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

  it('resolves a seeded UNKNOWN claim by saving its decision and evidence together', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];
    const claim = (await database.db.select().from(claimElements)).find(
      (candidate) => candidate.sessionId === opened.session.id && candidate.status === 'UNKNOWN',
    )!;

    const result = await service.attachClaimEvidence(opened.cookie, {
      projectId: project.id, claimElementId: claim.id, status: 'ABSENT', claimVersion: claim.version,
      quote: 'R03 단면에서 수지 충전 blind via는 굴곡 경계 밖에 배치됨', revision: 3,
    }, 'resolve-unknown-claim');

    expect(result.data.claim).toMatchObject({ id: claim.id, status: 'ABSENT', version: 2 });
    expect(result.data.claim.evidenceIds).toHaveLength(1);
    expect((await database.db.select().from(auditEvents)).filter(
      (event) => event.action === 'CLAIM_EVIDENCE_ATTACHED',
    )).toHaveLength(1);
    await expect(service.attachClaimEvidence(opened.cookie, {
      projectId: project.id, claimElementId: claim.id, status: 'ABSENT', claimVersion: claim.version,
      quote: 'stale', revision: 3,
    }, 'resolve-unknown-claim-stale')).rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 409 });
  });

  it('allows approval only for the current phase and the IP Legal then Team Lead transition', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];
    const gates = (await database.db.select().from(phaseGates)).filter((gate) => gate.sessionId === opened.session.id);
    const design = gates.find((gate) => gate.phase === 'DESIGN')!;
    const test = gates.find((gate) => gate.phase === 'TEST')!;
    await database.db.update(claimElements).set({ status: 'ABSENT', evidenceIds: [] });
    await service.switchRole(opened.cookie, { role: 'IP_LEGAL', version: 1 }, 'legal-current-phase');

    await expect(service.createApproval(opened.cookie, {
      projectId: project.id, gateId: test.id, decision: 'APPROVED', version: test.version,
    }, 'skip-to-test')).rejects.toMatchObject({ code: 'GATE_PHASE_NOT_CURRENT', status: 422 });
    const legal = await service.createApproval(opened.cookie, {
      projectId: project.id, gateId: design.id, decision: 'APPROVED', version: design.version,
    }, 'legal-design');
    await expect(service.createApproval(opened.cookie, {
      projectId: project.id, gateId: design.id, decision: 'APPROVED', version: legal.data.gateVersion,
    }, 'legal-cannot-overwrite')).rejects.toMatchObject({ code: 'GATE_TRANSITION_INVALID', status: 422 });
    const lead = await service.switchRole(opened.cookie, { role: 'TEAM_LEAD', version: 2 }, 'lead-design');
    const final = await service.createApproval(opened.cookie, {
      projectId: project.id, gateId: design.id, decision: 'APPROVED', version: legal.data.gateVersion,
    }, 'lead-design');
    expect(lead.data.role).toBe('TEAM_LEAD');
    expect(final.data.gateStatus).toBe('APPROVED');
  });

  it('creates conditional approval only for a same-session medium risk before release', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];
    const gate = (await database.db.select().from(phaseGates)).find((value) => value.sessionId === opened.session.id && value.phase === 'DESIGN')!;
    const mediumRisk = (await database.db.select().from(risks)).find(
      (value) => value.sessionId === opened.session.id && value.level === 'MEDIUM',
    )!;
    await database.db.update(claimElements).set({ status: 'ABSENT', evidenceIds: [] });
    await service.switchRole(opened.cookie, { role: 'IP_LEGAL', version: 1 }, 'legal-conditional');
    const approval = await service.createApproval(opened.cookie, {
      projectId: project.id, gateId: gate.id, decision: 'APPROVED', version: gate.version,
    }, 'legal-for-condition');

    const conditional = await service.createConditionalApproval(opened.cookie, {
      projectId: project.id, gateId: gate.id, approvalId: approval.data.approval.id,
      riskId: mediumRisk.id, dueDate: '2026-09-18T00:00:00.000Z', description: 'Micro-via 보강 시험 완료',
      version: approval.data.gateVersion,
    }, 'conditional-medium');
    expect(conditional.data.gateStatus).toBe('CONDITIONAL');
  });

  it('increments the project version when revision impact stales its linked gates', async () => {
    const opened = await service.openSession();
    const project = (await service.listProjects(opened.cookie))[0];
    const result = await service.recordRevisionImpact(opened.cookie, {
      projectId: project.id, changedRevisionId: project.currentRevisionId, version: project.version,
    }, 'revision-project-version');
    expect(result.data).toMatchObject({ projectVersion: 2 });
    await expect(service.recordRevisionImpact(opened.cookie, {
      projectId: project.id, changedRevisionId: project.currentRevisionId, version: project.version,
    }, 'revision-project-version-stale')).rejects.toMatchObject({ code: 'VERSION_CONFLICT', status: 409 });
  });
});
