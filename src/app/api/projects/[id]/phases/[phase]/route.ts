import { getHttpApi } from '@/server/runtime-api';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string; phase: string }> };
export async function GET(request: Request, context: Context) {
  return (await getHttpApi()).projectPhase(request, await context.params, 'GET');
}
export async function PATCH(request: Request, context: Context) {
  return (await getHttpApi()).projectPhase(request, await context.params, 'PATCH');
}
