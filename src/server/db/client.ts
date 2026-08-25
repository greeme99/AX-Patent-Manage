import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';

import * as schema from './schema';

export interface DatabaseConfig {
  url?: string;
  authToken?: string;
}

export interface AppDatabase {
  client: Client;
  db: LibSQLDatabase<typeof schema>;
  initialize(): Promise<void>;
  close(): Promise<void>;
}

const ddl = `
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

export function createDatabase(config: DatabaseConfig = {}): AppDatabase {
  const url = config.url ?? process.env.DATABASE_URL ?? 'file:local.db';
  const authToken = config.authToken ?? process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });
  const db = drizzle(client, { schema });

  return {
    client,
    db,
    async initialize() {
      await client.executeMultiple(ddl);
    },
    async close() {
      client.close();
    },
  };
}
