import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';

import { schema, schemaDdl } from './schema';

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

export function createDatabase(config: DatabaseConfig = {}): AppDatabase {
  const url = config.url ?? process.env.DATABASE_URL ?? 'file:local.db';
  const authToken = config.authToken ?? process.env.TURSO_AUTH_TOKEN;
  const client = createClient({ url, ...(authToken ? { authToken } : {}) });
  const db = drizzle(client, { schema });

  return {
    client,
    db,
    async initialize() {
      await client.executeMultiple(schemaDdl);
    },
    async close() {
      client.close();
    },
  };
}
