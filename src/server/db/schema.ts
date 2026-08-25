import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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
