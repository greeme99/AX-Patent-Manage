import type {
  approvals,
  auditEvents,
  claimElements,
  demoSessions,
  idempotencyRecords,
  phaseGates,
  projects,
  risks,
} from './db/schema';

export type SessionRecord = typeof demoSessions.$inferSelect;
export type SessionInsert = typeof demoSessions.$inferInsert;
export type ProjectRecord = typeof projects.$inferSelect;
export type ProjectInsert = typeof projects.$inferInsert;
export type GateRecord = typeof phaseGates.$inferSelect;
export type GateInsert = typeof phaseGates.$inferInsert;
export type ClaimRecord = typeof claimElements.$inferSelect;
export type ClaimInsert = typeof claimElements.$inferInsert;
export type RiskRecord = typeof risks.$inferSelect;
export type RiskInsert = typeof risks.$inferInsert;
export type ApprovalRecord = typeof approvals.$inferSelect;
export type ApprovalInsert = typeof approvals.$inferInsert;
export type AuditInsert = typeof auditEvents.$inferInsert;
export type IdempotencyInsert = typeof idempotencyRecords.$inferInsert;

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

export interface SyntheticCloneInsert {
  project: ProjectInsert;
  gates: GateInsert[];
  claims: ClaimInsert[];
  risks: RiskInsert[];
}

export interface DemoRepository {
  transaction<T>(work: (repository: DemoRepository) => Promise<T>): Promise<T>;
  findSession(id: string): Promise<SessionRecord | null>;
  insertSession(value: SessionInsert): Promise<SessionRecord>;
  retireSession(id: string, expectedVersion: number, now: Date): Promise<SessionRecord | null>;
  updateSessionRole(id: string, expectedVersion: number, role: string, now: Date): Promise<SessionRecord | null>;
  insertSyntheticClone(value: SyntheticCloneInsert): Promise<void>;
  listProjects(sessionId: string): Promise<ProjectRecord[]>;
  findProject(sessionId: string, projectId: string): Promise<ProjectRecord | null>;
  findGate(sessionId: string, projectId: string, gateId: string): Promise<GateRecord | null>;
  findPhaseGate(sessionId: string, projectId: string, phase: string): Promise<GateRecord | null>;
  listGates(sessionId: string, projectId: string): Promise<GateRecord[]>;
  updateGate(
    id: string,
    expectedVersion: number,
    patch: { status: string; version: number; updatedAt: Date },
  ): Promise<GateRecord | null>;
  updateProjectPhase(
    id: string,
    expectedVersion: number,
    phase: string,
    now: Date,
  ): Promise<ProjectRecord | null>;
  listClaims(sessionId: string, projectId: string): Promise<ClaimRecord[]>;
  listRisks(sessionId: string, projectId: string): Promise<RiskRecord[]>;
  listApprovals(sessionId: string, projectId?: string, gateId?: string): Promise<ApprovalRecord[]>;
  insertApproval(value: ApprovalInsert): Promise<ApprovalRecord>;
  listResource(resource: ResourceName, sessionId: string, projectId?: string): Promise<unknown[]>;
  insertResource(
    resource: ResourceName,
    sessionId: string,
    body: Record<string, unknown>,
    now: Date,
  ): Promise<{ id: string; [key: string]: unknown }>;
  findIdempotency(sessionId: string, operation: string, key: string): Promise<unknown | null>;
  insertIdempotency(value: IdempotencyInsert): Promise<void>;
  insertAudit(value: AuditInsert): Promise<void>;
}
