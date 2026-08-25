import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Single schema-owned initialization migration used by local SQLite and Turso. */
export const schemaDdl = `
CREATE TABLE IF NOT EXISTS demo_sessions (id TEXT PRIMARY KEY, role TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, code TEXT NOT NULL, name TEXT NOT NULL, product TEXT NOT NULL, phase TEXT NOT NULL, current_revision_id TEXT NOT NULL, current_revision_label TEXT NOT NULL, production_date TEXT, launch_date TEXT, legal_status_checked_at TEXT, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS phase_gates (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, project_id TEXT NOT NULL, phase TEXT NOT NULL, status TEXT NOT NULL, linked_revision_ids TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(project_id, phase));
CREATE TABLE IF NOT EXISTS features (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, project_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, revision_id TEXT, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS search_runs (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, project_id TEXT NOT NULL, query TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS patents (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, project_id TEXT NOT NULL, search_run_id TEXT, publication_number TEXT NOT NULL, title TEXT NOT NULL, legal_status TEXT, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS claim_elements (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, patent_id TEXT, project_id TEXT NOT NULL, label TEXT NOT NULL, status TEXT NOT NULL, evidence_ids TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, project_id TEXT NOT NULL, claim_element_id TEXT, source_url TEXT, quote TEXT NOT NULL, revision INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS risks (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, project_id TEXT NOT NULL, level TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, project_id TEXT NOT NULL, gate_id TEXT NOT NULL, role TEXT NOT NULL, decision TEXT NOT NULL, reason TEXT, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS conditions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, project_id TEXT NOT NULL, approval_id TEXT NOT NULL, description TEXT NOT NULL, due_date TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, type TEXT NOT NULL, status TEXT NOT NULL, payload TEXT, result TEXT, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, title TEXT NOT NULL, message TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, before_json TEXT, after_json TEXT, metadata_json TEXT, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS idempotency_records (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, route TEXT NOT NULL, key TEXT NOT NULL, status INTEGER NOT NULL, response_json TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(session_id, route, key));
`;

const id = () => text('id').primaryKey();
const sessionId = () => text('session_id').notNull();
const version = () => integer('version').notNull().default(1);
const createdAt = () => integer('created_at', { mode: 'timestamp_ms' }).notNull();
const updatedAt = () => integer('updated_at', { mode: 'timestamp_ms' }).notNull();

export const demoSessions = sqliteTable('demo_sessions', {
  id: id(),
  role: text('role').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  version: version(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
});

export const projects = sqliteTable('projects', {
  id: id(),
  sessionId: sessionId(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  product: text('product').notNull(),
  phase: text('phase').notNull(),
  currentRevisionId: text('current_revision_id').notNull(),
  currentRevisionLabel: text('current_revision_label').notNull(),
  productionDate: text('production_date'),
  launchDate: text('launch_date'),
  legalStatusCheckedAt: text('legal_status_checked_at'),
  version: version(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const phaseGates = sqliteTable(
  'phase_gates',
  {
    id: id(),
    sessionId: sessionId(),
    projectId: text('project_id').notNull(),
    phase: text('phase').notNull(),
    status: text('status').notNull(),
    linkedRevisionIds: text('linked_revision_ids', { mode: 'json' })
      .$type<string[]>()
      .notNull(),
    version: version(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('phase_gates_project_phase').on(table.projectId, table.phase)],
);

export const features = sqliteTable('features', {
  id: id(), sessionId: sessionId(), projectId: text('project_id').notNull(),
  name: text('name').notNull(), description: text('description'), revisionId: text('revision_id'),
  version: version(), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const searchRuns = sqliteTable('search_runs', {
  id: id(), sessionId: sessionId(), projectId: text('project_id').notNull(),
  query: text('query').notNull(), status: text('status').notNull(),
  version: version(), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const patents = sqliteTable('patents', {
  id: id(), sessionId: sessionId(), projectId: text('project_id').notNull(), searchRunId: text('search_run_id'),
  publicationNumber: text('publication_number').notNull(), title: text('title').notNull(),
  legalStatus: text('legal_status'), version: version(), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const claimElements = sqliteTable('claim_elements', {
  id: id(), sessionId: sessionId(), patentId: text('patent_id'), projectId: text('project_id').notNull(),
  label: text('label').notNull(), status: text('status').notNull(),
  evidenceIds: text('evidence_ids', { mode: 'json' }).$type<string[]>().notNull(),
  version: version(), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const evidence = sqliteTable('evidence', {
  id: id(), sessionId: sessionId(), projectId: text('project_id').notNull(), claimElementId: text('claim_element_id'),
  sourceUrl: text('source_url'), quote: text('quote').notNull(), revision: integer('revision').notNull(),
  version: version(), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const risks = sqliteTable('risks', {
  id: id(), sessionId: sessionId(), projectId: text('project_id').notNull(),
  level: text('level').notNull(), title: text('title').notNull(), status: text('status').notNull(),
  version: version(), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const approvals = sqliteTable('approvals', {
  id: id(), sessionId: sessionId(), projectId: text('project_id').notNull(), gateId: text('gate_id').notNull(),
  role: text('role').notNull(), decision: text('decision').notNull(), reason: text('reason'),
  version: version(), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const conditions = sqliteTable('conditions', {
  id: id(), sessionId: sessionId(), projectId: text('project_id').notNull(), approvalId: text('approval_id').notNull(),
  description: text('description').notNull(), dueDate: text('due_date').notNull(), status: text('status').notNull(),
  version: version(), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const jobs = sqliteTable('jobs', {
  id: id(), sessionId: sessionId(), type: text('type').notNull(), status: text('status').notNull(),
  payload: text('payload', { mode: 'json' }).$type<Record<string, unknown>>(),
  result: text('result', { mode: 'json' }).$type<Record<string, unknown>>(),
  version: version(), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const notifications = sqliteTable('notifications', {
  id: id(), sessionId: sessionId(), title: text('title').notNull(), message: text('message').notNull(),
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  version: version(), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const auditEvents = sqliteTable('audit_events', {
  id: id(), sessionId: sessionId(), action: text('action').notNull(), entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(), beforeJson: text('before_json', { mode: 'json' }).$type<unknown>(),
  afterJson: text('after_json', { mode: 'json' }).$type<unknown>(), metadataJson: text('metadata_json', { mode: 'json' }).$type<unknown>(),
  version: version(), createdAt: createdAt(), updatedAt: updatedAt(),
});

export const idempotencyRecords = sqliteTable(
  'idempotency_records',
  {
    id: id(), sessionId: sessionId(), route: text('route').notNull(), key: text('key').notNull(),
    status: integer('status').notNull(), responseJson: text('response_json', { mode: 'json' }).$type<unknown>().notNull(),
    version: version(), createdAt: createdAt(), updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex('idempotency_session_route_key').on(table.sessionId, table.route, table.key)],
);

export const schema = {
  demoSessions, projects, phaseGates, features, searchRuns, patents, claimElements,
  evidence, risks, approvals, conditions, jobs, notifications, auditEvents, idempotencyRecords,
};
