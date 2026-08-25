import { getHttpApi } from '@/server/runtime-api';
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { return (await getHttpApi()).projectApprovals(request, (await context.params).id); }
export async function POST(request: Request, context: Context) { return (await getHttpApi()).projectApprovals(request, (await context.params).id); }
