import { mkdtemp, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, type AppDatabase } from './db/client';
import { auditEvents, demoSessions, features, projects } from './db/schema';
import { DemoService } from './demo-service';
import { DrizzleDemoRepository } from './drizzle-demo-repository';
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
    const service = new DemoService(new DrizzleDemoRepository(database), {
      secret: 'integration-test-secret-at-least-32-characters',
      now: () => new Date('2026-08-25T03:00:00.000Z'),
    });
    api = createHttpApi(service);
    const bootstrapResponse = await api.demoSession(
      new Request('http://demo.test/api/demo/session'),
    );
    const bootstrapCookie = bootstrapResponse.headers.get('set-cookie')!;
    const response = await api.demoSession(new Request('http://demo.test/api/demo/session', {
      method: 'POST',
      headers: {
        cookie: bootstrapCookie,
        'content-type': 'application/json',
        'idempotency-key': randomUUID(),
      },
      body: JSON.stringify({ version: 0 }),
    }));
    cookie = response.headers.get('set-cookie')!;
  });

  afterEach(async () => {
    await database.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('returns the current demo session without mutating its cookie', async () => {
    const response = await api.demoSession(new Request('http://demo.test/api/demo/session', {
      headers: { cookie },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(body).toMatchObject({ demoAuth: true, session: { role: 'PRACTITIONER', version: 1 } });
  });

  it('issues a short-lived HttpOnly bootstrap cookie without persistent mutation', async () => {
    const before = await database.db.select().from(demoSessions);
    const response = await api.demoSession(new Request('http://demo.test/api/demo/session'));
    const after = await database.db.select().from(demoSessions);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ session: null, demoAuth: true });
    expect(response.headers.get('set-cookie')).toContain('demo_bootstrap=');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=600');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax');
    expect(after).toHaveLength(before.length);
  });

  it('requires version zero and an idempotency key to create a demo session once', async () => {
    const auditsBefore = (await database.db.select().from(auditEvents)).filter(
      (event) => event.action === 'SESSION_CREATED',
    ).length;
    const missingKey = await api.demoSession(new Request('http://demo.test/api/demo/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 0 }),
    }));
    const bootstrapResponse = await api.demoSession(
      new Request('http://demo.test/api/demo/session'),
    );
    const bootstrapCookie = bootstrapResponse.headers.get('set-cookie')!;
    const request = () => new Request('http://demo.test/api/demo/session', {
      method: 'POST',
      headers: {
        cookie: bootstrapCookie,
        'content-type': 'application/json',
        'idempotency-key': 'create-session-2',
      },
      body: JSON.stringify({ version: 0 }),
    });

    const first = await api.demoSession(request());
    const replay = await api.demoSession(request());

    expect(missingKey.status).toBe(400);
    expect(await missingKey.json()).toMatchObject({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
    expect(await replay.json()).toEqual(await first.json());
    expect(replay.headers.get('set-cookie')).toBe(first.headers.get('set-cookie'));
    expect(first.headers.get('set-cookie')).toContain('HttpOnly');
    expect(first.headers.get('set-cookie')).toContain('SameSite=Lax');
    expect(first.headers.get('set-cookie')).toContain('Max-Age=86400');
    expect(first.headers.get('set-cookie')).toContain('demo_bootstrap=; Max-Age=0');
    expect((await database.db.select().from(auditEvents)).filter(
      (event) => event.action === 'SESSION_CREATED',
    )).toHaveLength(auditsBefore + 1);
  });

  it('isolates the same predictable idempotency key across browser bootstrap contexts', async () => {
    const bootstrap = async () => {
      const response = await api.demoSession(new Request('http://demo.test/api/demo/session'));
      return response.headers.get('set-cookie')!;
    };
    const create = (bootstrapCookie: string) => api.demoSession(new Request(
      'http://demo.test/api/demo/session',
      {
        method: 'POST',
        headers: {
          cookie: bootstrapCookie,
          'content-type': 'application/json',
          'idempotency-key': 'predictable-key',
        },
        body: JSON.stringify({ version: 0 }),
      },
    ));
    const firstBootstrap = await bootstrap();
    const secondBootstrap = await bootstrap();

    const first = await create(firstBootstrap);
    const second = await create(secondBootstrap);
    const firstBody = await first.json();
    const secondBody = await second.json();

    expect(firstBody.session.id).not.toBe(secondBody.session.id);
    expect(first.headers.get('set-cookie')).not.toBe(second.headers.get('set-cookie'));
  });

  it('rejects a tampered browser bootstrap cookie', async () => {
    const bootstrapResponse = await api.demoSession(
      new Request('http://demo.test/api/demo/session'),
    );
    const pair = bootstrapResponse.headers.get('set-cookie')!.split(';')[0];
    const token = pair.slice('demo_bootstrap='.length);
    const tampered = `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}`;
    const response = await api.demoSession(new Request('http://demo.test/api/demo/session', {
      method: 'POST',
      headers: {
        cookie: `demo_bootstrap=${tampered}`,
        'content-type': 'application/json',
        'idempotency-key': 'tampered-bootstrap',
      },
      body: JSON.stringify({ version: 0 }),
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_BOOTSTRAP' } });
  });

  it('rejects an expired browser bootstrap cookie', async () => {
    const bootstrapResponse = await api.demoSession(
      new Request('http://demo.test/api/demo/session'),
    );
    const bootstrapCookie = bootstrapResponse.headers.get('set-cookie')!;
    const expiredApi = createHttpApi(new DemoService(new DrizzleDemoRepository(database), {
      secret: 'integration-test-secret-at-least-32-characters',
      now: () => new Date('2026-08-25T03:10:00.001Z'),
    }));
    const response = await expiredApi.demoSession(new Request(
      'http://demo.test/api/demo/session',
      {
        method: 'POST',
        headers: {
          cookie: bootstrapCookie,
          'content-type': 'application/json',
          'idempotency-key': 'expired-bootstrap',
        },
        body: JSON.stringify({ version: 0 }),
      },
    ));

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'BOOTSTRAP_EXPIRED' } });
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

  it('does not replay a project resource result on another project path', async () => {
    const [firstProject] = await database.db.select().from(projects);
    const secondProject = {
      ...firstProject,
      id: randomUUID(),
      currentRevisionId: randomUUID(),
      code: 'FPCB-EV-BMS-002',
    };
    await database.db.insert(projects).values(secondProject);
    const request = (projectId: string) => new Request(
      `http://demo.test/api/projects/${projectId}/features`,
      {
        method: 'POST',
        headers: {
          cookie,
          'content-type': 'application/json',
          'idempotency-key': 'same-key-different-project',
        },
        body: JSON.stringify({ name: `Feature for ${projectId}`, version: 0 }),
      },
    );

    const first = await api.projectResource('features', request(firstProject.id), firstProject.id, 'POST');
    const second = await api.projectResource('features', request(secondProject.id), secondProject.id, 'POST');

    expect((await first.json()).data.projectId).toBe(firstProject.id);
    expect((await second.json()).data.projectId).toBe(secondProject.id);
    expect(await database.db.select().from(features)).toHaveLength(2);
  });

  it('downloads the synthetic project approval snapshot manifest as JSON', async () => {
    const projectResponse = await api.projects(new Request('http://demo.test/api/projects', { headers: { cookie } }));
    const project = (await projectResponse.json()).data[0];
    const response = await api.approvalPackage(new Request(
      `http://demo.test/api/projects/${project.id}/approval-package`, { headers: { cookie } },
    ), project.id);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('content-disposition')).toContain('FPCB-EV-BMS-001-approval-snapshot.json');
    expect(await response.json()).toMatchObject({
      watermark: '교육용 데모 — 법적 전자서명 아님',
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });
});
