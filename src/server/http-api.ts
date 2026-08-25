import { CLAIM_ELEMENT_STATUSES, PHASES, RISK_LEVELS, ROLES, type Phase } from '../domain';
import { z, ZodError, type ZodTypeAny } from 'zod';

import { ApiError, type DemoService, type ProjectResourceName, type ResourceName } from './demo-service';

const roleSchema = z.object({ role: z.enum(ROLES), version: z.number().int().positive() }).strict();
const phaseMutationSchema = z.object({ version: z.number().int().positive() }).strict();
const approvalSchema = z.object({
  gateId: z.string().uuid(),
  projectId: z.string().uuid(),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().min(1).optional(),
  version: z.number().int().positive(),
}).strict();
const createVersion = z.literal(0);

const resourceSchemas: Record<ResourceName, ZodTypeAny> = {
  features: z.object({
    projectId: z.string().uuid().optional(), name: z.string().min(1), description: z.string().optional(),
    revisionId: z.string().uuid().optional(), version: createVersion,
  }).strict(),
  'search-runs': z.object({
    projectId: z.string().uuid().optional(), query: z.string().min(1),
    status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']).optional(),
    version: createVersion,
  }).strict(),
  patents: z.object({
    projectId: z.string().uuid().optional(), searchRunId: z.string().uuid().optional(), publicationNumber: z.string().min(1),
    title: z.string().min(1), legalStatus: z.string().optional(), version: createVersion,
  }).strict(),
  'claim-charts': z.object({
    projectId: z.string().uuid().optional(), patentId: z.string().uuid().optional(), label: z.string().min(1),
    status: z.enum(CLAIM_ELEMENT_STATUSES), evidenceIds: z.array(z.string().uuid()), version: createVersion,
  }).strict(),
  evidence: z.object({
    projectId: z.string().uuid().optional(), claimElementId: z.string().uuid().optional(), sourceUrl: z.string().url().optional(),
    quote: z.string().min(1), revision: z.number().int().positive(), version: createVersion,
  }).strict(),
  risks: z.object({
    projectId: z.string().uuid().optional(), level: z.enum(RISK_LEVELS), title: z.string().min(1),
    status: z.string().min(1).optional(), version: createVersion,
  }).strict(),
  gates: z.object({
    projectId: z.string().uuid().optional(), phase: z.enum(PHASES), status: z.string().min(1),
    linkedRevisionIds: z.array(z.string().uuid()), version: createVersion,
  }).strict(),
  conditions: z.object({
    projectId: z.string().uuid().optional(), approvalId: z.string().uuid(), description: z.string().min(1), dueDate: z.string().datetime(),
    status: z.string().min(1).optional(), version: createVersion,
  }).strict(),
  jobs: z.object({
    type: z.string().min(1), status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']).optional(),
    payload: z.record(z.unknown()).optional(), version: createVersion,
  }).strict(),
  notifications: z.object({
    title: z.string().min(1), message: z.string().min(1), version: createVersion,
  }).strict(),
};

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

function cookie(request: Request): string {
  return request.headers.get('cookie') ?? '';
}

function idempotencyKey(request: Request): string {
  const key = request.headers.get('idempotency-key');
  if (!key?.trim()) throw new ApiError('IDEMPOTENCY_KEY_REQUIRED', 400, 'Idempotency-Key is required');
  return key;
}

async function body<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new ApiError('VALIDATION_ERROR', 400, 'A JSON request body is required');
  }
  return schema.parse(value);
}

async function respond(work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ZodError) {
      return json({
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: error.flatten() },
      }, 400);
    }
    if (error instanceof ApiError) {
      return json({
        error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) },
        ...(error.current !== undefined ? { current: error.current } : {}),
      }, error.status);
    }
    console.error(error);
    return json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } }, 500);
  }
}

export function createHttpApi(service: DemoService) {
  const createResource = async (
    request: Request,
    name: ResourceName,
    projectId?: string,
  ): Promise<Response> => {
    const key = idempotencyKey(request);
    const input = await body(request, resourceSchemas[name]) as Record<string, unknown> & { version: number };
    const suppliedProjectId = input.projectId;
    if (projectId && suppliedProjectId !== undefined && suppliedProjectId !== projectId) {
      throw new ApiError('PROJECT_ID_MISMATCH', 400, 'Body projectId must match the route');
    }
    if (projectId) input.projectId = projectId;
    if (name !== 'jobs' && name !== 'notifications' && typeof input.projectId !== 'string') {
      throw new ApiError('VALIDATION_ERROR', 400, 'projectId is required');
    }
    return json(await service.createResource(cookie(request), name, input, key), 201);
  };

  return {
    demoSession: (request: Request) => respond(async () => {
      if (request.method === 'GET') {
        return json(await service.readSession(request.headers.get('cookie') ?? undefined));
      }
      const key = idempotencyKey(request);
      await body(request, z.object({ version: z.literal(0) }).strict());
      const result = await service.createDemoSession(key);
      return json(
        { session: result.session, demoAuth: result.demoAuth },
        201,
        { 'set-cookie': result.cookie },
      );
    }),

    demoReset: (request: Request) => respond(async () => {
      const key = idempotencyKey(request);
      const input = await body(request, z.object({ version: z.number().int().positive() }).strict());
      const result = await service.resetSession(cookie(request), input, key);
      return json({ session: result.session, demoAuth: result.demoAuth }, 200, { 'set-cookie': result.cookie });
    }),

    demoRole: (request: Request) => respond(async () => {
      const key = idempotencyKey(request);
      const input = await body(request, roleSchema);
      return json(await service.switchRole(cookie(request), input, key));
    }),

    projects: (request: Request) => respond(async () => {
      const data = await service.listProjects(cookie(request));
      return json({ data, demoAuth: true });
    }),

    projectPhase: (
      request: Request,
      params: { id: string; phase: string },
      method: 'GET' | 'PATCH',
    ) => respond(async () => {
      const phase = z.enum(PHASES).parse(params.phase) as Phase;
      if (method === 'GET') return json(await service.getPhase(cookie(request), params.id, phase));
      const key = idempotencyKey(request);
      const input = await body(request, phaseMutationSchema);
      return json(await service.startPhase(cookie(request), params.id, phase, input, key));
    }),

    resource: (name: ResourceName) => ({
      GET: (request: Request) => respond(async () => {
        const data = await service.listResource(cookie(request), name);
        return json({ data, demoAuth: true });
      }),
      POST: (request: Request) => respond(async () => {
        return createResource(request, name);
      }),
    }),

    projectResource: (
      name: ProjectResourceName,
      request: Request,
      projectId: string,
      method: 'GET' | 'POST',
    ) => respond(async () => {
      if (method === 'GET') {
        const data = await service.listResource(cookie(request), name, projectId);
        return json({ data, demoAuth: true });
      }
      return createResource(request, name, projectId);
    }),

    approvals: (request: Request) => respond(async () => {
      if (request.method === 'GET') {
        return json({ data: await service.listApprovals(cookie(request)), demoAuth: true });
      }
      const key = idempotencyKey(request);
      const input = await body(request, approvalSchema);
      return json(await service.createApproval(cookie(request), input, key), 201);
    }),

    projectApprovals: (request: Request, projectId: string) => respond(async () => {
      if (request.method === 'GET') {
        return json({ data: await service.listApprovals(cookie(request), projectId), demoAuth: true });
      }
      const key = idempotencyKey(request);
      const input = await body(request, approvalSchema);
      if (input.projectId !== projectId) {
        throw new ApiError('PROJECT_ID_MISMATCH', 400, 'Body projectId must match the route');
      }
      return json(await service.createApproval(cookie(request), input, key), 201);
    }),

    revisionImpact: (request: Request, projectId: string) => respond(async () => {
      const key = idempotencyKey(request);
      const input = await body(request, z.object({
        projectId: z.string().uuid().optional(),
        changedRevisionId: z.string().uuid(),
        version: z.number().int().positive(),
      }).strict());
      if (input.projectId !== undefined && input.projectId !== projectId) {
        throw new ApiError('PROJECT_ID_MISMATCH', 400, 'Body projectId must match the route');
      }
      return json(await service.recordRevisionImpact(
        cookie(request), { ...input, projectId }, key,
      ));
    }),

    health: async () => json({ status: 'ok', demoAuth: true }),

    notImplementedUntilTask4: async () => json({
      error: {
        code: 'NOT_IMPLEMENTED_UNTIL_TASK_4',
        message: 'This connector-heavy contract is implemented in Task 4',
      },
    }, 501),
  };
}
