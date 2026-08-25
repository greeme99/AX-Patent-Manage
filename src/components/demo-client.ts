import type { Role } from '../domain';

export interface DemoSessionView {
  id: string;
  role: Role;
  version: number;
  expiresAt?: string;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
type KeyFactory = () => string;

async function parseOrThrow<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `요청 실패 (${response.status})`);
  }
  return payload;
}

export async function ensureDemoSession(fetcher: Fetcher, keyFactory: KeyFactory) {
  const existingResponse = await fetcher('/api/demo/session', {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
  });
  const existing = await parseOrThrow<{ session: DemoSessionView | null }>(existingResponse);
  if (existing.session) return { session: existing.session };

  const createdResponse = await fetcher('/api/demo/session', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': keyFactory(),
    },
    body: JSON.stringify({ version: 0 }),
  });
  return parseOrThrow<{ session: DemoSessionView }>(createdResponse);
}

export async function switchDemoRole(
  fetcher: Fetcher,
  role: Role,
  version: number,
  keyFactory: KeyFactory,
) {
  const response = await fetcher('/api/demo/role', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': keyFactory(),
    },
    body: JSON.stringify({ role, version }),
  });
  const payload = await parseOrThrow<{ data: DemoSessionView }>(response);
  return payload.data;
}

export async function resetDemoSession(
  fetcher: Fetcher,
  version: number,
  keyFactory: KeyFactory,
) {
  const response = await fetcher('/api/demo/reset', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': keyFactory(),
    },
    body: JSON.stringify({ version }),
  });
  return parseOrThrow<{ session: DemoSessionView }>(response);
}
