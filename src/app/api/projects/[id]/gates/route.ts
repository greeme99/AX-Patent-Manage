import { getHttpApi } from '@/server/runtime-api';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { return (await getHttpApi()).projectResource('gates', request, (await context.params).id, 'GET'); }
export async function POST(request: Request, context: Context) { return (await getHttpApi()).projectResource('gates', request, (await context.params).id, 'POST'); }
