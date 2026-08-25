import { getHttpApi } from '@/server/runtime-api';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) { return (await getHttpApi()).revisionImpact(request, (await context.params).id); }
