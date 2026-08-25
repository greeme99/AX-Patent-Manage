import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import {
  ROLES,
  assessGateReadiness,
  canStartPhase,
  markLinkedGatesStale,
  syntheticFpcbProject,
  type ClaimElementStatus,
  type GateStatus,
  type Phase,
  type RiskLevel,
  type Role,
} from '../domain';
import type {
  DemoRepository,
  GateRecord,
  ProjectRecord,
  ProjectResourceName,
  ResourceName,
  SessionRecord,
} from './demo-repository';

export type { ProjectResourceName, ResourceName } from './demo-repository';

const SESSION_COOKIE = 'demo_session';
const BOOTSTRAP_COOKIE = 'demo_bootstrap';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const BOOTSTRAP_TTL_MS = 10 * 60 * 1000;

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

interface SessionResult {
  session: ReturnType<DemoService['publicSession']>;
  cookie: string;
  bootstrapCookie?: string;
  demoAuth: true;
}

export class DemoService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: DemoRepository,
    private readonly options: ServiceOptions,
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async openSession(cookie?: string): Promise<SessionResult> {
    if (cookie) {
      const session = await this.resolveSession(cookie);
      return this.sessionResult(session);
    }
    return this.repository.transaction(async (repository) => {
      const session = await this.createSession(repository);
      return this.sessionResult(session);
    });
  }

  async readSession(cookie?: string) {
    if (!this.optionalCookieValue(cookie, SESSION_COOKIE)) {
      return {
        session: null,
        demoAuth: true as const,
        bootstrapCookie: this.serializeBootstrapCookie(this.bootstrapIdentity(cookie)),
      };
    }
    const session = await this.resolveSession(cookie ?? '');
    return { session: this.publicSession(session), demoAuth: true as const };
  }

  async createDemoSession(key: string, cookie?: string): Promise<SessionResult> {
    if (!key.trim()) throw new ApiError('IDEMPOTENCY_KEY_REQUIRED', 400);
    const identity = this.requireBootstrapIdentity(cookie);
    const scope = `BOOTSTRAP:${identity.bid}`;
    return this.repository.transaction(async (repository) => {
      const replay = await repository.findIdempotency(
        scope, '/api/demo/session', key,
      );
      if (replay) return replay as SessionResult;

      const session = await this.createSession(repository);
      const result = {
        ...this.sessionResult(session),
        bootstrapCookie: `${BOOTSTRAP_COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`,
      };
      const now = this.now();
      await repository.insertAudit({
        id: randomUUID(), sessionId: session.id, action: 'SESSION_CREATED',
        entityType: 'demo_session', entityId: session.id, beforeJson: null,
        afterJson: result.session, metadataJson: { demoAuth: true },
        version: 1, createdAt: now, updatedAt: now,
      });
      await repository.insertIdempotency({
        id: randomUUID(), sessionId: scope, route: '/api/demo/session', key,
        status: 201, responseJson: result, version: 1, createdAt: now, updatedAt: now,
      });
      return result;
    });
  }

  async resetSession(cookie: string, body?: { version: number }, key?: string): Promise<SessionResult> {
    const payload = this.verifyToken(this.cookieValue(cookie));
    return this.repository.transaction(async (repository) => {
      const oldSession = await repository.findSession(payload.sid);
      if (!oldSession) throw new ApiError('SESSION_NOT_FOUND', 401, 'Demo session not found');
      if (oldSession.expiresAt.getTime() <= this.now().getTime() || payload.exp <= this.now().getTime()) {
        throw new ApiError('SESSION_EXPIRED', 401, 'Demo session expired');
      }
      if (key) {
        const replay = await repository.findIdempotency(
          oldSession.id, '/api/demo/reset', key,
        );
        if (replay) return replay as SessionResult;
      }
      if (!oldSession.active) throw new ApiError('SESSION_RETIRED', 401, 'Demo session was reset');
      if (body && oldSession.version !== body.version) this.conflict(oldSession);
      const retired = await repository.retireSession(
        oldSession.id, oldSession.version, this.now(),
      );
      if (!retired) this.conflict(oldSession);

      const session = await this.createSession(repository);
      const result = this.sessionResult(session);
      const now = this.now();
      await repository.insertAudit({
        id: randomUUID(), sessionId: oldSession.id, action: 'SESSION_RESET',
        entityType: 'demo_session', entityId: oldSession.id, beforeJson: oldSession,
        afterJson: result.session, metadataJson: { replacementSessionId: session.id },
        version: 1, createdAt: now, updatedAt: now,
      });
      if (key) {
        await repository.insertIdempotency({
          id: randomUUID(), sessionId: oldSession.id, route: '/api/demo/reset', key,
          status: 200, responseJson: result, version: 1, createdAt: now, updatedAt: now,
        });
      }
      return result;
    });
  }

  async listProjects(cookie: string): Promise<ProjectRecord[]> {
    const session = await this.resolveSession(cookie);
    return this.repository.listProjects(session.id);
  }

  async getProject(cookie: string, id: string): Promise<ProjectRecord> {
    const session = await this.resolveSession(cookie);
    return this.requireProject(this.repository, session.id, id);
  }

  async getPhase(cookie: string, projectId: string, phase: Phase) {
    const session = await this.resolveSession(cookie);
    await this.requireProject(this.repository, session.id, projectId);
    const gate = await this.repository.findPhaseGate(session.id, projectId, phase);
    if (!gate) throw new ApiError('NOT_FOUND', 404, 'Phase gate not found');
    return { data: gate, demoAuth: true as const };
  }

  async listResource(cookie: string, resource: ResourceName, projectId?: string): Promise<unknown[]> {
    const session = await this.resolveSession(cookie);
    if (projectId) await this.requireProject(this.repository, session.id, projectId);
    return this.repository.listResource(resource, session.id, projectId);
  }

  async createResource(
    cookie: string,
    resource: ResourceName,
    body: Record<string, unknown> & { version: number },
    key: string,
  ): Promise<MutationResult<unknown>> {
    const session = await this.resolveSession(cookie);
    const operation = body.projectId
      ? `/api/projects/${String(body.projectId)}/${resource}`
      : `/api/${resource}`;
    return this.mutate(session.id, operation, key, async (repository) => {
      if (body.projectId) {
        await this.requireProject(repository, session.id, String(body.projectId));
      }
      const created = await repository.insertResource(resource, session.id, body, this.now());
      const entityTypes: Partial<Record<ResourceName, string>> = {
        'search-runs': 'search_run',
        'claim-charts': 'claim_element',
        gates: 'phase_gate',
      };
      const entityType = entityTypes[resource] ?? resource.replace(/s$/, '');
      await this.audit(repository, session.id, 'CREATED', entityType, created.id, null, created);
      return created;
    });
  }

  async switchRole(
    cookie: string,
    body: { role: Role; version: number },
    key: string,
  ): Promise<MutationResult<ReturnType<DemoService['publicSession']>>> {
    const session = await this.resolveSession(cookie);
    if (!ROLES.includes(body.role)) throw new ApiError('VALIDATION_ERROR', 400, 'Invalid role');

    return this.mutate(session.id, '/api/demo/role', key, async (repository) => {
      const current = await repository.findSession(session.id);
      if (!current) throw new ApiError('SESSION_NOT_FOUND', 401);
      if (current.version !== body.version) this.conflict(current);
      const updated = await repository.updateSessionRole(
        current.id, body.version, body.role, this.now(),
      );
      if (!updated) this.conflict(current);
      await this.audit(
        repository, current.id, 'ROLE_SWITCHED', 'demo_session', current.id, current, updated,
      );
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

    const operation = `/api/projects/${body.projectId}/gates/${body.gateId}/approvals`;
    return this.mutate(session.id, operation, key, async (repository) => {
      const project = await repository.findProject(session.id, body.projectId);
      const gate = await repository.findGate(session.id, body.projectId, body.gateId);
      if (!project || !gate) throw new ApiError('NOT_FOUND', 404, 'Project or gate not found');
      if (gate.version !== body.version) this.conflict(gate);

      const prior = await repository.listApprovals(session.id, undefined, gate.id);
      if (prior.some(
        (approval) => approval.role === 'IP_LEGAL' && approval.decision === 'REJECTED',
      )) {
        throw new ApiError('LEGAL_REJECTION_FINAL', 422, 'Legal rejection cannot be overridden');
      }

      const projectRisks = await repository.listRisks(session.id, project.id);
      const projectClaims = await repository.listClaims(session.id, project.id);
      const now = this.now();
      const latestLegalApproval = prior
        .filter((approval) => approval.role === 'IP_LEGAL' && approval.decision === 'APPROVED')
        .reduce((latest, approval) => Math.max(latest, approval.createdAt.getTime()), 0);
      const candidateAt = session.role === 'TEAM_LEAD'
        ? new Date(Math.max(now.getTime(), latestLegalApproval + 1))
        : now;
      if (body.decision === 'APPROVED') {
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
        const substantiveBlockers = readiness.blockers.filter((blocker) =>
          blocker === 'CLAIM_ELEMENT_UNKNOWN' ||
          blocker === 'CLAIM_ELEMENT_EVIDENCE_MISSING' ||
          blocker === 'LEGAL_STATUS_STALE',
        );
        if (substantiveBlockers.length > 0) {
          throw new ApiError(
            'GATE_NOT_READY', 422, 'Gate has unresolved substantive blockers', undefined,
            { blockers: substantiveBlockers },
          );
        }
        if (session.role === 'TEAM_LEAD' && readiness.blockers.includes('IP_LEGAL_APPROVAL_REQUIRED')) {
          throw new ApiError(
            'IP_LEGAL_APPROVAL_REQUIRED', 422,
            'IP Legal approval must precede Team Lead approval',
          );
        }
        if (session.role === 'TEAM_LEAD' && readiness.blockers.includes('TEAM_LEAD_APPROVAL_ORDER_INVALID')) {
          throw new ApiError(
            'TEAM_LEAD_APPROVAL_ORDER_INVALID', 422,
            'Team Lead approval must follow IP Legal approval',
          );
        }
        if (session.role === 'TEAM_LEAD' && !readiness.canApprove) {
          throw new ApiError(
            'GATE_NOT_READY', 422, 'Gate is not ready for final approval', undefined,
            { blockers: readiness.blockers },
          );
        }
      }

      const approval = await repository.insertApproval({
        id: randomUUID(), sessionId: session.id, projectId: project.id, gateId: gate.id,
        role: session.role, decision: body.decision, reason: body.reason,
        version: 1, createdAt: candidateAt, updatedAt: candidateAt,
      });
      const updatedGate = await repository.updateGate(gate.id, body.version, {
        status: body.decision === 'REJECTED'
          ? 'REJECTED'
          : session.role === 'TEAM_LEAD'
            ? 'APPROVED'
            : 'IN_REVIEW',
        version: gate.version + 1,
        updatedAt: now,
      });
      if (!updatedGate) this.conflict(gate);
      await this.audit(
        repository, session.id, `GATE_${body.decision}`, 'approval', approval.id, null, approval,
      );
      return { approval, gateVersion: updatedGate.version };
    });
  }

  async listApprovals(cookie: string, projectId?: string) {
    const session = await this.resolveSession(cookie);
    if (projectId) await this.requireProject(this.repository, session.id, projectId);
    return this.repository.listApprovals(session.id, projectId);
  }

  async createApprovalPackage(cookie: string, projectId: string) {
    const session = await this.resolveSession(cookie);
    const project = await this.requireProject(this.repository, session.id, projectId);
    const [gates, claims, risks, approvals] = await Promise.all([
      this.repository.listGates(session.id, project.id),
      this.repository.listClaims(session.id, project.id),
      this.repository.listRisks(session.id, project.id),
      this.repository.listApprovals(session.id, project.id),
    ]);
    const unsignedManifest = {
      format: 'patent-gate-demo/approval-snapshot-v1',
      project: {
        code: project.code,
        name: project.name,
        product: project.product,
        phase: project.phase,
        currentRevisionLabel: project.currentRevisionLabel,
        productionDate: project.productionDate,
        launchDate: project.launchDate,
        legalStatusCheckedAt: project.legalStatusCheckedAt,
      },
      gates: gates.sort((a, b) => a.phase.localeCompare(b.phase)).map((gate) => ({
        phase: gate.phase, status: gate.status,
      })),
      claimElements: claims.sort((a, b) => a.label.localeCompare(b.label)).map((claim) => ({
        label: claim.label, status: claim.status, evidenceCount: claim.evidenceIds.length,
      })),
      risks: risks.sort((a, b) => a.title.localeCompare(b.title)).map((risk) => ({
        level: risk.level, title: risk.title, status: risk.status,
      })),
      approvals: approvals.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.role.localeCompare(b.role))
        .map((approval) => ({
          role: approval.role,
          decision: approval.decision,
          reason: approval.reason ?? null,
          approvedAt: approval.createdAt.toISOString(),
        })),
      watermark: '교육용 데모 — 법적 전자서명 아님',
    };
    return {
      ...unsignedManifest,
      sha256: createHash('sha256').update(JSON.stringify(unsignedManifest)).digest('hex'),
    };
  }

  async cleanupExpiredSessions() {
    return { deletedSessions: await this.repository.transaction(
      (repository) => repository.deleteExpiredSessions(this.now()),
    ) };
  }

  async startPhase(
    cookie: string,
    projectId: string,
    phase: Phase,
    body: { version: number },
    key: string,
  ) {
    const session = await this.resolveSession(cookie);
    return this.mutate(session.id, `/api/projects/${projectId}/phases/${phase}`, key, async (repository) => {
      const project = await this.requireProject(repository, session.id, projectId);
      if (project.version !== body.version) this.conflict(project);
      const gates = await repository.listGates(session.id, project.id);
      if (!canStartPhase(phase, gates as Parameters<typeof canStartPhase>[1])) {
        throw new ApiError('PREVIOUS_PHASE_NOT_APPROVED', 422, 'Previous phase must be approved');
      }
      const updated = await repository.updateProjectPhase(
        project.id, body.version, phase, this.now(),
      );
      if (!updated) this.conflict(project);
      await this.audit(
        repository, session.id, 'PHASE_STARTED', 'project', project.id, project, updated,
      );
      return updated;
    });
  }

  async recordRevisionImpact(
    cookie: string,
    body: { projectId: string; changedRevisionId: string; version: number },
    key: string,
  ) {
    const session = await this.resolveSession(cookie);
    return this.mutate(
      session.id,
      `/api/projects/${body.projectId}/revision-impact`,
      key,
      async (repository) => {
        const project = await this.requireProject(repository, session.id, body.projectId);
        if (project.version !== body.version) this.conflict(project);
        const currentGates = await repository.listGates(session.id, project.id);
        const impacted = markLinkedGatesStale(
          currentGates as (GateRecord & { status: GateStatus })[],
          body.changedRevisionId,
        );
        const affected = impacted.filter(
          (gate, index) => gate.status === 'STALE' && currentGates[index].status !== 'STALE',
        );
        for (const gate of affected) {
          await repository.updateGate(gate.id, gate.version, {
            status: gate.status,
            version: gate.version + 1,
            updatedAt: this.now(),
          });
        }
        const result = {
          projectId: project.id,
          changedRevisionId: body.changedRevisionId,
          affectedGateIds: affected.map((gate) => gate.id),
        };
        await this.audit(
          repository, session.id, 'REVISION_IMPACT_RECORDED', 'project',
          project.id, null, result,
        );
        return result;
      },
    );
  }

  private async createSession(repository: DemoRepository): Promise<SessionRecord> {
    const now = this.now();
    const session = await repository.insertSession({
      id: randomUUID(), role: 'PRACTITIONER', active: true, version: 1,
      createdAt: now, updatedAt: now,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    });
    await this.seedSyntheticClone(repository, session.id, now);
    return session;
  }

  private async seedSyntheticClone(
    repository: DemoRepository,
    sessionId: string,
    now: Date,
  ): Promise<void> {
    const projectId = randomUUID();
    const revisionId = randomUUID();
    await repository.insertSyntheticClone({
      project: {
        id: projectId, sessionId, code: syntheticFpcbProject.code,
        name: syntheticFpcbProject.name, product: syntheticFpcbProject.product,
        phase: syntheticFpcbProject.phase, currentRevisionId: revisionId,
        currentRevisionLabel: syntheticFpcbProject.currentRevisionLabel,
        productionDate: syntheticFpcbProject.productionDate,
        launchDate: syntheticFpcbProject.launchDate,
        legalStatusCheckedAt: syntheticFpcbProject.legalStatusCheckedAt,
        version: 1, createdAt: now, updatedAt: now,
      },
      gates: syntheticFpcbProject.gates.map((gate) => ({
        id: randomUUID(), sessionId, projectId, phase: gate.phase, status: gate.status,
        linkedRevisionIds: gate.linkedRevisionIds.map(() => revisionId),
        version: 1, createdAt: now, updatedAt: now,
      })),
      claims: syntheticFpcbProject.claimElements.map((element, index) => ({
        id: randomUUID(), sessionId, projectId,
        label: element.label || `Synthetic claim element ${index + 1}`,
        status: element.status,
        evidenceIds: element.evidenceIds.map(() => randomUUID()),
        version: 1, createdAt: now, updatedAt: now,
      })),
      risks: syntheticFpcbProject.risks.map((risk) => ({
        id: randomUUID(), sessionId, projectId, level: risk.level, title: risk.title,
        status: 'OPEN', version: 1, createdAt: now, updatedAt: now,
      })),
    });
  }

  private async resolveSession(cookie: string): Promise<SessionRecord> {
    const payload = this.verifyToken(this.cookieValue(cookie));
    const session = await this.repository.findSession(payload.sid);
    if (!session) throw new ApiError('SESSION_NOT_FOUND', 401, 'Demo session not found');
    if (!session.active) throw new ApiError('SESSION_RETIRED', 401, 'Demo session was reset');
    if (session.expiresAt.getTime() <= this.now().getTime() || payload.exp <= this.now().getTime()) {
      throw new ApiError('SESSION_EXPIRED', 401, 'Demo session expired');
    }
    return session;
  }

  private cookieValue(cookie: string): string {
    const value = this.optionalCookieValue(cookie, SESSION_COOKIE);
    if (!value) throw new ApiError('SESSION_REQUIRED', 401, 'Demo session cookie required');
    return value;
  }

  private optionalCookieValue(cookie: string | undefined, name: string): string | undefined {
    return cookie?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1);
  }

  private bootstrapIdentity(cookie?: string): { bid: string; exp: number } {
    const token = this.optionalCookieValue(cookie, BOOTSTRAP_COOKIE);
    if (token) {
      try {
        const identity = this.verifyBootstrapToken(token);
        return { bid: identity.bid, exp: this.now().getTime() + BOOTSTRAP_TTL_MS };
      } catch {
        // GET replaces invalid/expired stateless bootstrap cookies without a server write.
      }
    }
    return { bid: randomUUID(), exp: this.now().getTime() + BOOTSTRAP_TTL_MS };
  }

  private requireBootstrapIdentity(cookie?: string): { bid: string; exp: number } {
    const token = this.optionalCookieValue(cookie, BOOTSTRAP_COOKIE);
    if (!token) throw new ApiError('BOOTSTRAP_REQUIRED', 401, 'Bootstrap cookie required');
    return this.verifyBootstrapToken(token);
  }

  private serializeBootstrapCookie(identity: { bid: string; exp: number }): string {
    const encoded = Buffer.from(JSON.stringify(identity), 'utf8').toString('base64url');
    return `${BOOTSTRAP_COOKIE}=${encoded}.${this.sign(encoded)}; Max-Age=600; Path=/; HttpOnly; SameSite=Lax`;
  }

  private verifyBootstrapToken(token: string): { bid: string; exp: number } {
    const separator = token.lastIndexOf('.');
    if (separator < 1) throw new ApiError('INVALID_BOOTSTRAP', 401, 'Invalid bootstrap signature');
    const encoded = token.slice(0, separator);
    const supplied = Buffer.from(token.slice(separator + 1));
    const expected = Buffer.from(this.sign(encoded));
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new ApiError('INVALID_BOOTSTRAP', 401, 'Invalid bootstrap signature');
    }
    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown;
      if (
        typeof parsed !== 'object' || parsed === null ||
        typeof (parsed as { bid?: unknown }).bid !== 'string' ||
        typeof (parsed as { exp?: unknown }).exp !== 'number'
      ) throw new Error('invalid payload');
      const identity = parsed as { bid: string; exp: number };
      if (identity.exp <= this.now().getTime()) {
        throw new ApiError('BOOTSTRAP_EXPIRED', 401, 'Bootstrap cookie expired');
      }
      return identity;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError('INVALID_BOOTSTRAP', 401, 'Invalid bootstrap payload');
    }
  }

  private sign(value: string): string {
    return createHmac('sha256', this.options.secret).update(value).digest('base64url');
  }

  private verifyToken(token: string): { sid: string; exp: number } {
    const separator = token.lastIndexOf('.');
    if (separator < 1) throw new ApiError('INVALID_SESSION', 401, 'Invalid session signature');
    const encoded = token.slice(0, separator);
    const supplied = Buffer.from(token.slice(separator + 1));
    const expected = Buffer.from(this.sign(encoded));
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new ApiError('INVALID_SESSION', 401, 'Invalid session signature');
    }
    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown;
      if (
        typeof parsed !== 'object' || parsed === null ||
        typeof (parsed as { sid?: unknown }).sid !== 'string' ||
        typeof (parsed as { exp?: unknown }).exp !== 'number'
      ) throw new Error('invalid payload');
      return parsed as { sid: string; exp: number };
    } catch {
      throw new ApiError('INVALID_SESSION', 401, 'Invalid session payload');
    }
  }

  private serializeCookie(session: SessionRecord): string {
    const encoded = Buffer.from(JSON.stringify({
      sid: session.id, exp: session.expiresAt.getTime(),
    }), 'utf8').toString('base64url');
    return `${SESSION_COOKIE}=${encoded}.${this.sign(encoded)}; Max-Age=86400; Path=/; HttpOnly; SameSite=Lax`;
  }

  private sessionResult(session: SessionRecord): SessionResult {
    return {
      session: this.publicSession(session),
      cookie: this.serializeCookie(session),
      demoAuth: true,
    };
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

  private async requireProject(
    repository: DemoRepository,
    sessionId: string,
    projectId: string,
  ): Promise<ProjectRecord> {
    const project = await repository.findProject(sessionId, projectId);
    if (!project) throw new ApiError('NOT_FOUND', 404, 'Project not found');
    return project;
  }

  private conflict(current: unknown): never {
    throw new ApiError('VERSION_CONFLICT', 409, 'The record has changed', current);
  }

  private async mutate<T>(
    sessionId: string,
    operation: string,
    key: string,
    mutation: (repository: DemoRepository) => Promise<T>,
  ): Promise<MutationResult<T>> {
    if (!key.trim()) throw new ApiError('IDEMPOTENCY_KEY_REQUIRED', 400);
    return this.repository.transaction(async (repository) => {
      const replay = await repository.findIdempotency(sessionId, operation, key);
      if (replay) return replay as MutationResult<T>;
      const data = await mutation(repository);
      const result: MutationResult<T> = { data, demoAuth: true };
      const now = this.now();
      await repository.insertIdempotency({
        id: randomUUID(), sessionId, route: operation, key, status: 200,
        responseJson: result, version: 1, createdAt: now, updatedAt: now,
      });
      return result;
    });
  }

  private async audit(
    repository: DemoRepository,
    sessionId: string,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ): Promise<void> {
    const now = this.now();
    await repository.insertAudit({
      id: randomUUID(), sessionId, action, entityType, entityId,
      beforeJson: before, afterJson: after, metadataJson: { demoAuth: true },
      version: 1, createdAt: now, updatedAt: now,
    });
  }
}
