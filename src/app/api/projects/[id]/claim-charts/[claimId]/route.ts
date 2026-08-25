import { getHttpApi } from '@/server/runtime-api';

type Context = { params: Promise<{ id: string; claimId: string }> };

export async function PATCH(request: Request, context: Context) {
  const { id, claimId } = await context.params;
  return (await getHttpApi()).claim(request, id, claimId);
}
