import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, type AppDatabase } from './db/client';
import { auditEvents, demoSessions, features } from './db/schema';
import { DemoService } from './demo-service';
import { createHttpApi } from './http-api';

describe('HTTP API contract', () => {
  let directory: string;
  let database: AppDatabase;
  let api: ReturnType<typeof createHttpApi>;
  let cookie: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'patent-gate-http-'));
    database = createDatabase({ url: `file:${join(directory, 'test.db')}` });
    await database.initialize();
    const service = new DemoService(database, {
      secret: 'integration-test-secret-at-least-32-characters',
      now: () => new Date('2026-08-25T03:00:00.000Z'),
    });
    api = createHttpApi(service);
    const response = await api.demoSession(new Request('http://demo.test/api/demo/session'));
    cookie = response.headers.get('set-cookie')!;
  });

  afterEach(async () => {
    await database.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('returns a demo session contract and secure cookie attributes', async () => {
    const response = await api.demoSession(new Request('http://demo.test/api/demo/session'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(body).toMatchObject({ demoAuth: true, session: { role: 'PRACTITIONER', version: 1 } });
  });

  it('requires an Idempotency-Key and body version for role mutations', async () => {
    const missingKey = await api.demoRole(
      new Request('http://demo.test/api/demo/role', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'IP_LEGAL', version: 1 }),
      }),
    );
    const missingVersion = await api.demoRole(
      new Request('http://demo.test/api/demo/role', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json', 'idempotency-key': 'missing-version' },
        body: JSON.stringify({ role: 'IP_LEGAL' }),
      }),
    );

    expect(missingKey.status).toBe(400);
    expect(await missingKey.json()).toMatchObject({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
    expect(missingVersion.status).toBe(400);
    expect(await missingVersion.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });

  it('replays reset without creating another session or audit event', async () => {
    const request = () => new Request('http://demo.test/api/demo/reset', {
      method: 'POST',
      headers: {
        cookie,
        'content-type': 'application/json',
        'idempotency-key': 'reset-1',
      },
      body: JSON.stringify({ version: 1 }),
    });

    const first = await api.demoReset(request());
    const replay = await api.demoReset(request());

    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
    expect(replay.headers.get('set-cookie')).toBe(first.headers.get('set-cookie'));
    expect(await database.db.select().from(demoSessions)).toHaveLength(2);
    expect((await database.db.select().from(auditEvents)).filter(
      (event) => event.action === 'SESSION_RESET',
    )).toHaveLength(1);
  });

  it('returns the required VERSION_CONFLICT shape', async () => {
    const headers = {
      cookie,
      'content-type': 'application/json',
      'idempotency-key': 'first-role',
    };
    await api.demoRole(
      new Request('http://demo.test/api/demo/role', {
        method: 'POST', headers, body: JSON.stringify({ role: 'IP_LEGAL', version: 1 }),
      }),
    );
    const conflict = await api.demoRole(
      new Request('http://demo.test/api/demo/role', {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'stale-role' },
        body: JSON.stringify({ role: 'TEAM_LEAD', version: 1 }),
      }),
    );

    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({
      error: { code: 'VERSION_CONFLICT' },
      current: { role: 'IP_LEGAL', version: 2 },
    });
  });

  it('creates a feature once when an idempotency key is replayed', async () => {
    const projectsResponse = await api.projects(
      new Request('http://demo.test/api/projects', { headers: { cookie } }),
    );
    const projectBody = await projectsResponse.json();
    const request = () =>
      new Request('http://demo.test/api/features', {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'application/json',
          'idempotency-key': 'feature-create-1',
        },
        body: JSON.stringify({
          projectId: projectBody.data[0].id,
          name: 'High-flex copper routing',
          description: 'Synthetic feature',
          version: 0,
        }),
      });

    const first = await api.resource('features').POST(request());
    const replay = await api.resource('features').POST(request());
    const listed = await api.resource('features').GET(
      new Request('http://demo.test/api/features', { headers: { cookie } }),
    );

    expect(first.status).toBe(201);
    expect(await replay.json()).toEqual(await first.json());
    expect((await listed.json()).data).toHaveLength(1);
    expect(await database.db.select().from(features)).toHaveLength(1);
    expect((await database.db.select().from(auditEvents)).filter((event) => event.entityType === 'feature')).toHaveLength(1);
  });

  it('enforces the project id from a nested resource path', async () => {
    const projectsResponse = await api.projects(
      new Request('http://demo.test/api/projects', { headers: { cookie } }),
    );
    const project = (await projectsResponse.json()).data[0];
    const response = await api.projectResource(
      'features',
      new Request(`http://demo.test/api/projects/${project.id}/features`, {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'application/json',
          'idempotency-key': 'wrong-project',
        },
        body: JSON.stringify({
          projectId: '8bb257da-c2ba-44e7-8875-744f6ce850f1',
          name: 'Wrong project feature',
          version: 0,
        }),
      }),
      project.id,
      'POST',
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'PROJECT_ID_MISMATCH' } });
  });

  it('returns a typed Task 4 placeholder for approval packages', async () => {
    const response = await api.notImplementedUntilTask4();
    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({
      error: {
        code: 'NOT_IMPLEMENTED_UNTIL_TASK_4',
        message: 'This connector-heavy contract is implemented in Task 4',
      },
    });
  });
});
