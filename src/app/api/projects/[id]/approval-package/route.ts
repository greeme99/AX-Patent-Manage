import { getHttpApi } from '@/server/runtime-api';
export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return (await getHttpApi()).approvalPackage(request, (await context.params).id);
}
