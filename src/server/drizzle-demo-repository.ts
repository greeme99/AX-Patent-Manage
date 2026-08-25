import { randomUUID } from 'node:crypto';

import { and, eq, inArray, lt } from 'drizzle-orm';

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
import type {
  ApprovalInsert,
  ApprovalRecord,
  AuditInsert,
  ClaimRecord,
  ConditionRecord,
  DemoRepository,
  GateRecord,
  IdempotencyInsert,
  ProjectRecord,
  ResourceName,
  RiskRecord,
  SessionInsert,
  SessionRecord,
  SyntheticCloneInsert,
} from './demo-repository';

type DbTransaction = Parameters<Parameters<AppDatabase['db']['transaction']>[0]>[0];

export class DrizzleDemoRepository implements DemoRepository {
  constructor(
    private readonly database: AppDatabase,
    private readonly transactionalQuery?: DbTransaction,
  ) {}

  private get query(): DbTransaction {
    return (this.transactionalQuery ?? this.database.db) as unknown as DbTransaction;
  }

  async transaction<T>(work: (repository: DemoRepository) => Promise<T>): Promise<T> {
    if (this.transactionalQuery) return work(this);
    return this.database.db.transaction((tx) => work(new DrizzleDemoRepository(this.database, tx)));
  }

  async findSession(id: string): Promise<SessionRecord | null> {
    const [record] = await this.query.select().from(demoSessions).where(eq(demoSessions.id, id)).limit(1);
    return record ?? null;
  }

  async insertSession(value: SessionInsert): Promise<SessionRecord> {
    const [record] = await this.query.insert(demoSessions).values(value).returning();
    return record;
  }

  async retireSession(id: string, expectedVersion: number, now: Date): Promise<SessionRecord | null> {
    const [record] = await this.query.update(demoSessions).set({
      active: false, version: expectedVersion + 1, updatedAt: now,
    }).where(and(eq(demoSessions.id, id), eq(demoSessions.version, expectedVersion))).returning();
    return record ?? null;
  }

  async updateSessionRole(
    id: string,
    expectedVersion: number,
    role: string,
    now: Date,
  ): Promise<SessionRecord | null> {
    const [record] = await this.query.update(demoSessions).set({
      role, version: expectedVersion + 1, updatedAt: now,
    }).where(and(eq(demoSessions.id, id), eq(demoSessions.version, expectedVersion))).returning();
    return record ?? null;
  }

  async deleteExpiredSessions(now: Date): Promise<number> {
    const expired = await this.query.select({ id: demoSessions.id }).from(demoSessions)
      .where(lt(demoSessions.expiresAt, now));
    const sessionIds = expired.map((session) => session.id);
    if (sessionIds.length === 0) return 0;

    await this.query.delete(approvals).where(inArray(approvals.sessionId, sessionIds));
    await this.query.delete(auditEvents).where(inArray(auditEvents.sessionId, sessionIds));
    await this.query.delete(claimElements).where(inArray(claimElements.sessionId, sessionIds));
    await this.query.delete(conditions).where(inArray(conditions.sessionId, sessionIds));
    await this.query.delete(evidence).where(inArray(evidence.sessionId, sessionIds));
    await this.query.delete(features).where(inArray(features.sessionId, sessionIds));
    await this.query.delete(idempotencyRecords).where(inArray(idempotencyRecords.sessionId, sessionIds));
    await this.query.delete(jobs).where(inArray(jobs.sessionId, sessionIds));
    await this.query.delete(notifications).where(inArray(notifications.sessionId, sessionIds));
    await this.query.delete(patents).where(inArray(patents.sessionId, sessionIds));
    await this.query.delete(phaseGates).where(inArray(phaseGates.sessionId, sessionIds));
    await this.query.delete(projects).where(inArray(projects.sessionId, sessionIds));
    await this.query.delete(risks).where(inArray(risks.sessionId, sessionIds));
    await this.query.delete(searchRuns).where(inArray(searchRuns.sessionId, sessionIds));
    await this.query.delete(demoSessions).where(inArray(demoSessions.id, sessionIds));
    return sessionIds.length;
  }

  async insertSyntheticClone(value: SyntheticCloneInsert): Promise<void> {
    await this.query.insert(projects).values(value.project);
    await this.query.insert(phaseGates).values(value.gates);
    await this.query.insert(claimElements).values(value.claims);
    await this.query.insert(evidence).values(value.evidence);
    await this.query.insert(risks).values(value.risks);
  }

  listProjects(sessionId: string): Promise<ProjectRecord[]> {
    return this.query.select().from(projects).where(eq(projects.sessionId, sessionId));
  }

  async findProject(sessionId: string, projectId: string): Promise<ProjectRecord | null> {
    const [record] = await this.query.select().from(projects).where(and(
      eq(projects.sessionId, sessionId), eq(projects.id, projectId),
    )).limit(1);
    return record ?? null;
  }

  async findGate(sessionId: string, projectId: string, gateId: string): Promise<GateRecord | null> {
    const [record] = await this.query.select().from(phaseGates).where(and(
      eq(phaseGates.sessionId, sessionId), eq(phaseGates.projectId, projectId), eq(phaseGates.id, gateId),
    )).limit(1);
    return record ?? null;
  }

  async findPhaseGate(sessionId: string, projectId: string, phase: string): Promise<GateRecord | null> {
    const [record] = await this.query.select().from(phaseGates).where(and(
      eq(phaseGates.sessionId, sessionId), eq(phaseGates.projectId, projectId), eq(phaseGates.phase, phase),
    )).limit(1);
    return record ?? null;
  }

  listGates(sessionId: string, projectId: string): Promise<GateRecord[]> {
    return this.query.select().from(phaseGates).where(and(
      eq(phaseGates.sessionId, sessionId), eq(phaseGates.projectId, projectId),
    ));
  }

  async updateGate(
    id: string,
    expectedVersion: number,
    patch: { status: string; version: number; updatedAt: Date },
  ): Promise<GateRecord | null> {
    const [record] = await this.query.update(phaseGates).set(patch).where(and(
      eq(phaseGates.id, id), eq(phaseGates.version, expectedVersion),
    )).returning();
    return record ?? null;
  }

  async updateProjectPhase(
    id: string,
    expectedVersion: number,
    phase: string,
    now: Date,
  ): Promise<ProjectRecord | null> {
    const [record] = await this.query.update(projects).set({
      phase, version: expectedVersion + 1, updatedAt: now,
    }).where(and(eq(projects.id, id), eq(projects.version, expectedVersion))).returning();
    return record ?? null;
  }

  async updateProjectVersion(id: string, expectedVersion: number, now: Date): Promise<ProjectRecord | null> {
    const [record] = await this.query.update(projects).set({
      version: expectedVersion + 1, updatedAt: now,
    }).where(and(eq(projects.id, id), eq(projects.version, expectedVersion))).returning();
    return record ?? null;
  }

  listClaims(sessionId: string, projectId: string): Promise<ClaimRecord[]> {
    return this.query.select().from(claimElements).where(and(
      eq(claimElements.sessionId, sessionId), eq(claimElements.projectId, projectId),
    ));
  }

  async findClaim(sessionId: string, projectId: string, claimId: string): Promise<ClaimRecord | null> {
    const [record] = await this.query.select().from(claimElements).where(and(
      eq(claimElements.sessionId, sessionId), eq(claimElements.projectId, projectId), eq(claimElements.id, claimId),
    )).limit(1);
    return record ?? null;
  }

  async updateClaim(
    id: string,
    expectedVersion: number,
    patch: { status: string; evidenceIds: string[]; version: number; updatedAt: Date },
  ): Promise<ClaimRecord | null> {
    const [record] = await this.query.update(claimElements).set(patch).where(and(
      eq(claimElements.id, id), eq(claimElements.version, expectedVersion),
    )).returning();
    return record ?? null;
  }

  listRisks(sessionId: string, projectId: string): Promise<RiskRecord[]> {
    return this.query.select().from(risks).where(and(
      eq(risks.sessionId, sessionId), eq(risks.projectId, projectId),
    ));
  }

  listConditions(sessionId: string, projectId: string): Promise<ConditionRecord[]> {
    return this.query.select().from(conditions).where(and(
      eq(conditions.sessionId, sessionId), eq(conditions.projectId, projectId),
    ));
  }

  listApprovals(sessionId: string, projectId?: string, gateId?: string): Promise<ApprovalRecord[]> {
    return this.query.select().from(approvals).where(
      gateId
        ? and(eq(approvals.sessionId, sessionId), eq(approvals.gateId, gateId))
        : projectId
          ? and(eq(approvals.sessionId, sessionId), eq(approvals.projectId, projectId))
          : eq(approvals.sessionId, sessionId),
    );
  }

  async insertApproval(value: ApprovalInsert): Promise<ApprovalRecord> {
    const [record] = await this.query.insert(approvals).values(value).returning();
    return record;
  }

  listResource(resource: ResourceName, sessionId: string, projectId?: string): Promise<unknown[]> {
    switch (resource) {
      case 'features': return this.query.select().from(features).where(projectId ? and(eq(features.sessionId, sessionId), eq(features.projectId, projectId)) : eq(features.sessionId, sessionId));
      case 'search-runs': return this.query.select().from(searchRuns).where(projectId ? and(eq(searchRuns.sessionId, sessionId), eq(searchRuns.projectId, projectId)) : eq(searchRuns.sessionId, sessionId));
      case 'patents': return this.query.select().from(patents).where(projectId ? and(eq(patents.sessionId, sessionId), eq(patents.projectId, projectId)) : eq(patents.sessionId, sessionId));
      case 'claim-charts': return this.query.select().from(claimElements).where(projectId ? and(eq(claimElements.sessionId, sessionId), eq(claimElements.projectId, projectId)) : eq(claimElements.sessionId, sessionId));
      case 'evidence': return this.query.select().from(evidence).where(projectId ? and(eq(evidence.sessionId, sessionId), eq(evidence.projectId, projectId)) : eq(evidence.sessionId, sessionId));
      case 'risks': return this.query.select().from(risks).where(projectId ? and(eq(risks.sessionId, sessionId), eq(risks.projectId, projectId)) : eq(risks.sessionId, sessionId));
      case 'gates': return this.query.select().from(phaseGates).where(projectId ? and(eq(phaseGates.sessionId, sessionId), eq(phaseGates.projectId, projectId)) : eq(phaseGates.sessionId, sessionId));
      case 'conditions': return this.query.select().from(conditions).where(projectId ? and(eq(conditions.sessionId, sessionId), eq(conditions.projectId, projectId)) : eq(conditions.sessionId, sessionId));
      case 'jobs': return this.query.select().from(jobs).where(eq(jobs.sessionId, sessionId));
      case 'notifications': return this.query.select().from(notifications).where(eq(notifications.sessionId, sessionId));
    }
  }

  async insertResource(
    resource: ResourceName,
    sessionId: string,
    body: Record<string, unknown>,
    now: Date,
  ): Promise<{ id: string; [key: string]: unknown }> {
    const common = { id: randomUUID(), sessionId, version: 1, createdAt: now, updatedAt: now };
    switch (resource) {
      case 'features': return (await this.query.insert(features).values({ ...common, projectId: String(body.projectId), name: String(body.name), description: body.description ? String(body.description) : undefined, revisionId: body.revisionId ? String(body.revisionId) : undefined }).returning())[0];
      case 'search-runs': return (await this.query.insert(searchRuns).values({ ...common, projectId: String(body.projectId), query: String(body.query), status: body.status ? String(body.status) : 'QUEUED' }).returning())[0];
      case 'patents': return (await this.query.insert(patents).values({ ...common, projectId: String(body.projectId), searchRunId: body.searchRunId ? String(body.searchRunId) : undefined, publicationNumber: String(body.publicationNumber), title: String(body.title), legalStatus: body.legalStatus ? String(body.legalStatus) : undefined }).returning())[0];
      case 'claim-charts': return (await this.query.insert(claimElements).values({ ...common, projectId: String(body.projectId), patentId: body.patentId ? String(body.patentId) : undefined, label: String(body.label), status: String(body.status), evidenceIds: body.evidenceIds as string[] }).returning())[0];
      case 'evidence': return (await this.query.insert(evidence).values({ ...common, projectId: String(body.projectId), claimElementId: body.claimElementId ? String(body.claimElementId) : undefined, sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined, quote: String(body.quote), revision: Number(body.revision) }).returning())[0];
      case 'risks': return (await this.query.insert(risks).values({ ...common, projectId: String(body.projectId), level: String(body.level), title: String(body.title), status: body.status ? String(body.status) : 'OPEN' }).returning())[0];
      case 'gates': return (await this.query.insert(phaseGates).values({ ...common, projectId: String(body.projectId), phase: String(body.phase), status: String(body.status), linkedRevisionIds: body.linkedRevisionIds as string[] }).returning())[0];
      case 'conditions': return (await this.query.insert(conditions).values({ ...common, projectId: String(body.projectId), approvalId: String(body.approvalId), description: String(body.description), dueDate: String(body.dueDate), status: body.status ? String(body.status) : 'OPEN' }).returning())[0];
      case 'jobs': return (await this.query.insert(jobs).values({ ...common, type: String(body.type), status: body.status ? String(body.status) : 'QUEUED', payload: body.payload as Record<string, unknown> | undefined }).returning())[0];
      case 'notifications': return (await this.query.insert(notifications).values({ ...common, title: String(body.title), message: String(body.message), read: false }).returning())[0];
    }
  }

  async findIdempotency(sessionId: string, operation: string, key: string): Promise<unknown | null> {
    const [record] = await this.query.select().from(idempotencyRecords).where(and(
      eq(idempotencyRecords.sessionId, sessionId),
      eq(idempotencyRecords.route, operation),
      eq(idempotencyRecords.key, key),
    )).limit(1);
    return record?.responseJson ?? null;
  }

  async insertIdempotency(value: IdempotencyInsert): Promise<void> {
    await this.query.insert(idempotencyRecords).values(value);
  }

  async insertAudit(value: AuditInsert): Promise<void> {
    await this.query.insert(auditEvents).values(value);
  }
}
