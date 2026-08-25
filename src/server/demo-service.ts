import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import {
  ROLES,
  assessGateReadiness,
  canStartPhase,
  markLinkedGatesStale,
  syntheticFpcbProject,
  type GateStatus,
  type ClaimElementStatus,
  type Phase,
  type Role,
  type RiskLevel,
} from '../domain';
import { and, eq } from 'drizzle-orm';

import type { AppDatabase } from './db/client';
import {
  approvals,
  auditEvents,
  claimElements,
  conditions,
  demoSessions,
  evidence,
  features,
  idempotencyRecords,
  jobs,
  notifications,
  patents,
  phaseGates,
  projects,
  risks,
  searchRuns,
} from './db/schema';

const SESSION_COOKIE = 'demo_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type DbTransaction = Parameters<Parameters<AppDatabase['db']['transaction']>[0]>[0];
type SessionRecord = typeof demoSessions.$inferSelect;
type ProjectRecord = typeof projects.$inferSelect;

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message = code,
    public readonly current?: unknown,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ServiceOptions {
  secret: string;
  now?: () => Date;
}

interface MutationResult<T> {
  data: T;
  demoAuth: true;
}

export type ResourceName =
  | 'features'
  | 'search-runs'
  | 'patents'
  | 'claim-charts'
  | 'evidence'
  | 'risks'
  | 'gates'
  | 'conditions'
  | 'jobs'
  | 'notifications';

export type ProjectResourceName = Exclude<ResourceName, 'jobs' | 'notifications'>;

export class DemoService {
  private readonly now: () => Date;

  constructor(
    private readonly database: AppDatabase,
    private readonly options: ServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async openSession(cookie?: string) {
    if (cookie) {
      const session = await this.resolveSession(cookie);
      return {
        session: this.publicSession(session),
        cookie: this.serializeCookie(session),
        demoAuth: true as const,
      };
    }

    const session = await this.createSession();
    return {
      session: this.publicSession(session),
      cookie: this.serializeCookie(session),
      demoAuth: true as const,
    };
  }

  async resetSession(cookie: string, body?: { version: number }, key?: string) {
    const payload = this.verifyToken(this.cookieValue(cookie));
    const [oldSession] = await this.database.db.select().from(demoSessions)
      .where(eq(demoSessions.id, payload.sid)).limit(1);
    if (!oldSession) throw new ApiError('SESSION_NOT_FOUND', 401, 'Demo session not found');
    if (oldSession.expiresAt.getTime() <= this.now().getTime() || payload.exp <= this.now().getTime()) {
      throw new ApiError('SESSION_EXPIRED', 401, 'Demo session expired');
    }
    if (key) {
      const [replay] = await this.database.db.select().from(idempotencyRecords).where(and(
        eq(idempotencyRecords.sessionId, oldSession.id),
        eq(idempotencyRecords.route, '/api/demo/reset'),
        eq(idempotencyRecords.key, key),
      )).limit(1);
      if (replay) return replay.responseJson as {
        session: ReturnType<DemoService['publicSession']>; cookie: string; demoAuth: true;
      };
    }
    if (!oldSession.active) throw new ApiError('SESSION_RETIRED', 401, 'Demo session was reset');
    if (body && oldSession.version !== body.version) this.conflict(oldSession);
    const [retired] = await this.database.db
      .update(demoSessions)
      .set({ active: false, updatedAt: this.now(), version: oldSession.version + 1 })
      .where(and(eq(demoSessions.id, oldSession.id), eq(demoSessions.version, oldSession.version)))
      .returning();
    if (!retired) this.conflict(oldSession);
    const session = await this.createSession();
    const result = {
      session: this.publicSession(session),
      cookie: this.serializeCookie(session),
      demoAuth: true as const,
    };
    const now = this.now();
    await this.database.db.insert(auditEvents).values({
      id: randomUUID(), sessionId: oldSession.id, action: 'SESSION_RESET',
      entityType: 'demo_session', entityId: oldSession.id, beforeJson: oldSession,
      afterJson: result.session, metadataJson: { replacementSessionId: session.id },
      version: 1, createdAt: now, updatedAt: now,
    });
    if (key) {
      await this.database.db.insert(idempotencyRecords).values({
        id: randomUUID(), sessionId: oldSession.id, route: '/api/demo/reset', key,
        status: 200, responseJson: result, version: 1, createdAt: now, updatedAt: now,
      });
    }
    return result;
  }

  async listProjects(cookie: string): Promise<ProjectRecord[]> {
    const session = await this.resolveSession(cookie);
    return this.database.db.select().from(projects).where(eq(projects.sessionId, session.id));
  }

  async getProject(cookie: string, id: string): Promise<ProjectRecord> {
    const session = await this.resolveSession(cookie);
    const [project] = await this.database.db
      .select()
      .from(projects)
      .where(and(eq(projects.sessionId, session.id), eq(projects.id, id)))
      .limit(1);
    if (!project) throw new ApiError('NOT_FOUND', 404, 'Project not found');
    return project;
  }

  async getPhase(cookie: string, projectId: string, phase: Phase) {
    const session = await this.resolveSession(cookie);
    await this.requireProject(session.id, projectId);
    const [gate] = await this.database.db
      .select()
      .from(phaseGates)
      .where(
        and(
          eq(phaseGates.sessionId, session.id),
          eq(phaseGates.projectId, projectId),
          eq(phaseGates.phase, phase),
        ),
      )
      .limit(1);
    if (!gate) throw new ApiError('NOT_FOUND', 404, 'Phase gate not found');
    return { data: gate, demoAuth: true as const };
  }

  async listResource(cookie: string, resource: ResourceName, projectId?: string): Promise<unknown[]> {
    const session = await this.resolveSession(cookie);
    if (projectId) await this.requireProject(session.id, projectId);
    switch (resource) {
      case 'features':
        return this.database.db.select().from(features).where(projectId
          ? and(eq(features.sessionId, session.id), eq(features.projectId, projectId))
          : eq(features.sessionId, session.id));
      case 'search-runs':
        return this.database.db.select().from(searchRuns).where(projectId
          ? and(eq(searchRuns.sessionId, session.id), eq(searchRuns.projectId, projectId))
          : eq(searchRuns.sessionId, session.id));
      case 'patents':
        return this.database.db.select().from(patents).where(projectId
          ? and(eq(patents.sessionId, session.id), eq(patents.projectId, projectId))
          : eq(patents.sessionId, session.id));
      case 'claim-charts':
        return this.database.db.select().from(claimElements).where(projectId
          ? and(eq(claimElements.sessionId, session.id), eq(claimElements.projectId, projectId))
          : eq(claimElements.sessionId, session.id));
      case 'evidence':
        return this.database.db.select().from(evidence).where(projectId
          ? and(eq(evidence.sessionId, session.id), eq(evidence.projectId, projectId))
          : eq(evidence.sessionId, session.id));
      case 'risks':
        return this.database.db.select().from(risks).where(projectId
          ? and(eq(risks.sessionId, session.id), eq(risks.projectId, projectId))
          : eq(risks.sessionId, session.id));
      case 'gates':
        return this.database.db.select().from(phaseGates).where(projectId
          ? and(eq(phaseGates.sessionId, session.id), eq(phaseGates.projectId, projectId))
          : eq(phaseGates.sessionId, session.id));
      case 'conditions':
        return this.database.db.select().from(conditions).where(projectId
          ? and(eq(conditions.sessionId, session.id), eq(conditions.projectId, projectId))
          : eq(conditions.sessionId, session.id));
      case 'jobs':
        return this.database.db.select().from(jobs).where(eq(jobs.sessionId, session.id));
      case 'notifications':
        return this.database.db.select().from(notifications).where(eq(notifications.sessionId, session.id));
    }
  }

  async createResource(
    cookie: string,
    resource: ResourceName,
    body: Record<string, unknown> & { version: number },
    key: string,
  ): Promise<MutationResult<unknown>> {
    const session = await this.resolveSession(cookie);
    return this.mutate(session.id, `/api/${resource}`, key, async (tx) => {
      const now = this.now();
      const common = { id: randomUUID(), sessionId: session.id, version: 1, createdAt: now, updatedAt: now };
      let created: unknown;
      let entityType = resource.replace(/s$/, '');

      switch (resource) {
        case 'features': {
          await this.requireProjectTx(tx, session.id, String(body.projectId));
          [created] = await tx.insert(features).values({
            ...common, projectId: String(body.projectId), name: String(body.name),
            description: body.description ? String(body.description) : undefined,
            revisionId: body.revisionId ? String(body.revisionId) : undefined,
          }).returning();
          entityType = 'feature';
          break;
        }
        case 'search-runs': {
          await this.requireProjectTx(tx, session.id, String(body.projectId));
          [created] = await tx.insert(searchRuns).values({
            ...common, projectId: String(body.projectId), query: String(body.query),
            status: body.status ? String(body.status) : 'QUEUED',
          }).returning();
          entityType = 'search_run';
          break;
        }
        case 'patents': {
          await this.requireProjectTx(tx, session.id, String(body.projectId));
          [created] = await tx.insert(patents).values({
            ...common, projectId: String(body.projectId), searchRunId: body.searchRunId ? String(body.searchRunId) : undefined,
            publicationNumber: String(body.publicationNumber), title: String(body.title),
            legalStatus: body.legalStatus ? String(body.legalStatus) : undefined,
          }).returning();
          entityType = 'patent';
          break;
        }
        case 'claim-charts': {
          await this.requireProjectTx(tx, session.id, String(body.projectId));
          [created] = await tx.insert(claimElements).values({
            ...common, projectId: String(body.projectId),
            patentId: body.patentId ? String(body.patentId) : undefined,
            label: String(body.label), status: String(body.status),
            evidenceIds: body.evidenceIds as string[],
          }).returning();
          entityType = 'claim_element';
          break;
        }
        case 'evidence': {
          await this.requireProjectTx(tx, session.id, String(body.projectId));
          [created] = await tx.insert(evidence).values({
            ...common, projectId: String(body.projectId), claimElementId: body.claimElementId ? String(body.claimElementId) : undefined,
            sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined,
            quote: String(body.quote), revision: Number(body.revision),
          }).returning();
          entityType = 'evidence';
          break;
        }
        case 'risks': {
          await this.requireProjectTx(tx, session.id, String(body.projectId));
          [created] = await tx.insert(risks).values({
            ...common, projectId: String(body.projectId), level: String(body.level),
            title: String(body.title), status: body.status ? String(body.status) : 'OPEN',
          }).returning();
          entityType = 'risk';
          break;
        }
        case 'gates': {
          await this.requireProjectTx(tx, session.id, String(body.projectId));
          [created] = await tx.insert(phaseGates).values({
            ...common, projectId: String(body.projectId), phase: String(body.phase),
            status: String(body.status), linkedRevisionIds: body.linkedRevisionIds as string[],
          }).returning();
          entityType = 'phase_gate';
          break;
        }
        case 'conditions': {
          await this.requireProjectTx(tx, session.id, String(body.projectId));
          [created] = await tx.insert(conditions).values({
            ...common, projectId: String(body.projectId), approvalId: String(body.approvalId), description: String(body.description),
            dueDate: String(body.dueDate), status: body.status ? String(body.status) : 'OPEN',
          }).returning();
          entityType = 'condition';
          break;
        }
        case 'jobs': {
          [created] = await tx.insert(jobs).values({
            ...common, type: String(body.type), status: body.status ? String(body.status) : 'QUEUED',
            payload: body.payload as Record<string, unknown> | undefined,
          }).returning();
          entityType = 'job';
          break;
        }
        case 'notifications': {
          [created] = await tx.insert(notifications).values({
            ...common, title: String(body.title), message: String(body.message), read: false,
          }).returning();
          entityType = 'notification';
          break;
        }
      }

      const entity = created as { id: string };
      await this.audit(tx, session.id, 'CREATED', entityType, entity.id, null, entity);
      return entity;
    });
  }

  async switchRole(
    cookie: string,
    body: { role: Role; version: number },
    key: string,
  ): Promise<MutationResult<ReturnType<DemoService['publicSession']>>> {
    const session = await this.resolveSession(cookie);
    if (!ROLES.includes(body.role)) throw new ApiError('VALIDATION_ERROR', 400, 'Invalid role');

    return this.mutate(session.id, '/api/demo/role', key, async (tx) => {
      const [current] = await tx
        .select()
        .from(demoSessions)
        .where(eq(demoSessions.id, session.id))
        .limit(1);
      if (!current) throw new ApiError('SESSION_NOT_FOUND', 401);
      if (current.version !== body.version) this.conflict(current);

      const [updated] = await tx
        .update(demoSessions)
        .set({ role: body.role, version: current.version + 1, updatedAt: this.now() })
        .where(and(eq(demoSessions.id, current.id), eq(demoSessions.version, body.version)))
        .returning();
      if (!updated) this.conflict(current);
      await this.audit(tx, current.id, 'ROLE_SWITCHED', 'demo_session', current.id, current, updated);
      return this.publicSession(updated);
    });
  }

  async createApproval(
    cookie: string,
    body: {
      gateId: string;
      projectId: string;
      decision: 'APPROVED' | 'REJECTED';
      reason?: string;
      version: number;
    },
    key: string,
  ) {
    const session = await this.resolveSession(cookie);
    if (session.role !== 'IP_LEGAL' && session.role !== 'TEAM_LEAD') {
      throw new ApiError('ROLE_NOT_ALLOWED', 403, 'Only IP Legal or Team Lead may approve');
    }

    return this.mutate(session.id, '/api/approvals', key, async (tx) => {
      const [project] = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.id, body.projectId), eq(projects.sessionId, session.id)))
        .limit(1);
      const [gate] = await tx
        .select()
        .from(phaseGates)
        .where(
          and(
            eq(phaseGates.id, body.gateId),
            eq(phaseGates.projectId, body.projectId),
            eq(phaseGates.sessionId, session.id),
          ),
        )
        .limit(1);
      if (!project || !gate) throw new ApiError('NOT_FOUND', 404, 'Project or gate not found');
      if (gate.version !== body.version) this.conflict(gate);

      const prior = await tx
        .select()
        .from(approvals)
        .where(and(eq(approvals.sessionId, session.id), eq(approvals.gateId, gate.id)));
      const legalRejected = prior.some(
        (approval) => approval.role === 'IP_LEGAL' && approval.decision === 'REJECTED',
      );
      if (legalRejected && session.role === 'TEAM_LEAD') {
        throw new ApiError('LEGAL_REJECTION_FINAL', 422, 'Legal rejection cannot be overridden');
      }

      const projectRisks = await tx
        .select()
        .from(risks)
        .where(and(eq(risks.sessionId, session.id), eq(risks.projectId, project.id)));
      const projectClaims = await tx.select().from(claimElements).where(and(
        eq(claimElements.sessionId, session.id), eq(claimElements.projectId, project.id),
      ));
      const now = this.now();
      const latestLegalApproval = prior
        .filter((approval) => approval.role === 'IP_LEGAL' && approval.decision === 'APPROVED')
        .reduce((latest, approval) => Math.max(latest, approval.createdAt.getTime()), 0);
      const candidateAt = session.role === 'TEAM_LEAD'
        ? new Date(Math.max(now.getTime(), latestLegalApproval + 1))
        : now;
      if (session.role === 'TEAM_LEAD' && body.decision === 'APPROVED') {
        const readiness = assessGateReadiness({
          claimElements: projectClaims.map((element) => ({
            status: element.status as ClaimElementStatus,
            evidenceIds: element.evidenceIds,
          })),
          legalStatusCheckedAt: project.legalStatusCheckedAt ?? undefined,
          risks: projectRisks.map((risk) => ({ level: risk.level as RiskLevel })),
          approvals: [
            ...prior
              .filter((approval) => approval.decision === 'APPROVED')
              .map((approval) => ({ role: approval.role as Role, approvedAt: approval.createdAt })),
            { role: session.role as Role, approvedAt: candidateAt },
          ],
          now,
        });
        if (readiness.blockers.includes('IP_LEGAL_APPROVAL_REQUIRED')) {
          throw new ApiError(
            'IP_LEGAL_APPROVAL_REQUIRED',
            422,
            'IP Legal approval must precede Team Lead approval',
          );
        }
        if (readiness.blockers.includes('TEAM_LEAD_APPROVAL_ORDER_INVALID')) {
          throw new ApiError(
            'TEAM_LEAD_APPROVAL_ORDER_INVALID',
            422,
            'Team Lead approval must follow IP Legal approval',
          );
        }
      }

      const [approval] = await tx
        .insert(approvals)
        .values({
          id: randomUUID(),
          sessionId: session.id,
          projectId: project.id,
          gateId: gate.id,
          role: session.role,
          decision: body.decision,
          reason: body.reason,
          version: 1,
          createdAt: candidateAt,
          updatedAt: candidateAt,
        })
        .returning();
      const [updatedGate] = await tx
        .update(phaseGates)
        .set({
          status: body.decision === 'REJECTED'
            ? 'REJECTED'
            : session.role === 'TEAM_LEAD'
              ? 'APPROVED'
              : 'IN_REVIEW',
          version: gate.version + 1,
          updatedAt: now,
        })
        .where(and(eq(phaseGates.id, gate.id), eq(phaseGates.version, body.version)))
        .returning();
      if (!updatedGate) this.conflict(gate);
      await this.audit(
        tx,
        session.id,
        `GATE_${body.decision}`,
        'approval',
        approval.id,
        null,
        approval,
      );
      return { approval, gateVersion: updatedGate.version };
    });
  }

  async listApprovals(cookie: string, projectId?: string) {
    const session = await this.resolveSession(cookie);
    if (projectId) await this.requireProject(session.id, projectId);
    return this.database.db.select().from(approvals).where(projectId
      ? and(eq(approvals.sessionId, session.id), eq(approvals.projectId, projectId))
      : eq(approvals.sessionId, session.id));
  }

  async startPhase(
    cookie: string,
    projectId: string,
    phase: Phase,
    body: { version: number },
    key: string,
  ) {
    const session = await this.resolveSession(cookie);
    return this.mutate(session.id, `/api/projects/${projectId}/phases/${phase}`, key, async (tx) => {
      const [project] = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.sessionId, session.id)))
        .limit(1);
      if (!project) throw new ApiError('NOT_FOUND', 404, 'Project not found');
      if (project.version !== body.version) this.conflict(project);
      const gates = await tx
        .select()
        .from(phaseGates)
        .where(and(eq(phaseGates.sessionId, session.id), eq(phaseGates.projectId, project.id)));
      if (!canStartPhase(phase, gates as Parameters<typeof canStartPhase>[1])) {
        throw new ApiError('PREVIOUS_PHASE_NOT_APPROVED', 422, 'Previous phase must be approved');
      }
      const [updated] = await tx
        .update(projects)
        .set({ phase, version: project.version + 1, updatedAt: this.now() })
        .where(and(eq(projects.id, project.id), eq(projects.version, body.version)))
        .returning();
      if (!updated) this.conflict(project);
      await this.audit(tx, session.id, 'PHASE_STARTED', 'project', project.id, project, updated);
      return updated;
    });
  }

  async recordRevisionImpact(
    cookie: string,
    body: { projectId: string; changedRevisionId: string; version: number },
    key: string,
  ) {
    const session = await this.resolveSession(cookie);
    return this.mutate(session.id, `/api/projects/${body.projectId}/revision-impact`, key, async (tx) => {
      const project = await this.requireProjectTx(tx, session.id, body.projectId);
      if (project.version !== body.version) this.conflict(project);
      const currentGates = await tx.select().from(phaseGates).where(
        and(eq(phaseGates.sessionId, session.id), eq(phaseGates.projectId, project.id)),
      );
      const impacted = markLinkedGatesStale(
        currentGates as (typeof currentGates[number] & { status: GateStatus })[],
        body.changedRevisionId,
      );
      const affected = impacted.filter(
        (gate, index) => gate.status === 'STALE' && currentGates[index].status !== 'STALE',
      );
      for (const gate of affected) {
        await tx.update(phaseGates).set({
          status: gate.status,
          version: gate.version + 1,
          updatedAt: this.now(),
        }).where(and(eq(phaseGates.id, gate.id), eq(phaseGates.version, gate.version)));
      }
      const result = { projectId: project.id, changedRevisionId: body.changedRevisionId, affectedGateIds: affected.map((gate) => gate.id) };
      await this.audit(
        tx, session.id, 'REVISION_IMPACT_RECORDED', 'project', project.id, null, result,
      );
      return result;
    });
  }

  private async createSession(): Promise<SessionRecord> {
    const now = this.now();
    const session: typeof demoSessions.$inferInsert = {
      id: randomUUID(),
      role: 'PRACTITIONER',
      active: true,
      version: 1,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    };
    const [created] = await this.database.db.insert(demoSessions).values(session).returning();
    await this.seedSyntheticClone(created.id, now);
    return created;
  }

  private async seedSyntheticClone(sessionId: string, now: Date): Promise<void> {
    const projectId = randomUUID();
    const revisionId = randomUUID();
    await this.database.db.insert(projects).values({
      id: projectId,
      sessionId,
      code: syntheticFpcbProject.code,
      name: syntheticFpcbProject.name,
      product: syntheticFpcbProject.product,
      phase: syntheticFpcbProject.phase,
      currentRevisionId: revisionId,
      currentRevisionLabel: syntheticFpcbProject.currentRevisionLabel,
      productionDate: syntheticFpcbProject.productionDate,
      launchDate: syntheticFpcbProject.launchDate,
      legalStatusCheckedAt: syntheticFpcbProject.legalStatusCheckedAt,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    await this.database.db.insert(phaseGates).values(
      syntheticFpcbProject.gates.map((gate) => ({
        id: randomUUID(),
        sessionId,
        projectId,
        phase: gate.phase,
        status: gate.status,
        linkedRevisionIds: gate.linkedRevisionIds.map(() => revisionId),
        version: 1,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await this.database.db.insert(claimElements).values(
      syntheticFpcbProject.claimElements.map((element, index) => ({
        id: randomUUID(),
        sessionId,
        projectId,
        label: `Synthetic claim element ${index + 1}`,
        status: element.status,
        evidenceIds: element.evidenceIds.map(() => randomUUID()),
        version: 1,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await this.database.db.insert(risks).values(
      syntheticFpcbProject.risks.map((risk) => ({
        id: randomUUID(),
        sessionId,
        projectId,
        level: risk.level,
        title: risk.title,
        status: 'OPEN',
        version: 1,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  private async resolveSession(cookie: string): Promise<SessionRecord> {
    const token = this.cookieValue(cookie);
    const payload = this.verifyToken(token);
    const [session] = await this.database.db
      .select()
      .from(demoSessions)
      .where(eq(demoSessions.id, payload.sid))
      .limit(1);
    if (!session) throw new ApiError('SESSION_NOT_FOUND', 401, 'Demo session not found');
    if (!session.active) throw new ApiError('SESSION_RETIRED', 401, 'Demo session was reset');
    if (session.expiresAt.getTime() <= this.now().getTime() || payload.exp <= this.now().getTime()) {
      throw new ApiError('SESSION_EXPIRED', 401, 'Demo session expired');
    }
    return session;
  }

  private cookieValue(cookie: string): string {
    const value = cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1);
    if (!value) throw new ApiError('SESSION_REQUIRED', 401, 'Demo session cookie required');
    return value;
  }

  private sign(value: string): string {
    return createHmac('sha256', this.options.secret).update(value).digest('base64url');
  }

  private verifyToken(token: string): { sid: string; exp: number } {
    const separator = token.lastIndexOf('.');
    if (separator < 1) throw new ApiError('INVALID_SESSION', 401, 'Invalid session signature');
    const encoded = token.slice(0, separator);
    const suppliedSignature = token.slice(separator + 1);
    const expectedSignature = this.sign(encoded);
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new ApiError('INVALID_SESSION', 401, 'Invalid session signature');
    }
    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown;
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        typeof (parsed as { sid?: unknown }).sid !== 'string' ||
        typeof (parsed as { exp?: unknown }).exp !== 'number'
      ) {
        throw new Error('invalid payload');
      }
      return parsed as { sid: string; exp: number };
    } catch {
      throw new ApiError('INVALID_SESSION', 401, 'Invalid session payload');
    }
  }

  private serializeCookie(session: SessionRecord): string {
    const encoded = Buffer.from(
      JSON.stringify({ sid: session.id, exp: session.expiresAt.getTime() }),
      'utf8',
    ).toString('base64url');
    const token = `${encoded}.${this.sign(encoded)}`;
    return `${SESSION_COOKIE}=${token}; Max-Age=86400; Path=/; HttpOnly; SameSite=Lax`;
  }

  private publicSession(session: SessionRecord) {
    return {
      id: session.id,
      role: session.role as Role,
      version: session.version,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  private async requireProject(sessionId: string, projectId: string): Promise<ProjectRecord> {
    const [project] = await this.database.db
      .select()
      .from(projects)
      .where(and(eq(projects.sessionId, sessionId), eq(projects.id, projectId)))
      .limit(1);
    if (!project) throw new ApiError('NOT_FOUND', 404, 'Project not found');
    return project;
  }

  private async requireProjectTx(
    tx: DbTransaction,
    sessionId: string,
    projectId: string,
  ): Promise<ProjectRecord> {
    const [project] = await tx.select().from(projects).where(
      and(eq(projects.sessionId, sessionId), eq(projects.id, projectId)),
    ).limit(1);
    if (!project) throw new ApiError('NOT_FOUND', 404, 'Project not found');
    return project;
  }

  private conflict(current: unknown): never {
    throw new ApiError('VERSION_CONFLICT', 409, 'The record has changed', current);
  }

  private async mutate<T>(
    sessionId: string,
    route: string,
    key: string,
    mutation: (tx: DbTransaction) => Promise<T>,
  ): Promise<MutationResult<T>> {
    if (!key.trim()) throw new ApiError('IDEMPOTENCY_KEY_REQUIRED', 400);
    return this.database.db.transaction(async (tx) => {
      const [replay] = await tx
        .select()
        .from(idempotencyRecords)
        .where(
          and(
            eq(idempotencyRecords.sessionId, sessionId),
            eq(idempotencyRecords.route, route),
            eq(idempotencyRecords.key, key),
          ),
        )
        .limit(1);
      if (replay) return replay.responseJson as MutationResult<T>;

      const data = await mutation(tx);
      const result: MutationResult<T> = { data, demoAuth: true };
      const now = this.now();
      await tx.insert(idempotencyRecords).values({
        id: randomUUID(),
        sessionId,
        route,
        key,
        status: 200,
        responseJson: result,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      return result;
    });
  }

  private async audit(
    tx: DbTransaction,
    sessionId: string,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    const now = this.now();
    await tx.insert(auditEvents).values({
      id: randomUUID(),
      sessionId,
      action,
      entityType,
      entityId,
      beforeJson: before,
      afterJson: after,
      metadataJson: { demoAuth: true },
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }
}
