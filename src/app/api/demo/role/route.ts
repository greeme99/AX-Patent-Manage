import { getHttpApi } from '@/server/runtime-api';

export const runtime = 'nodejs';
export async function POST(request: Request) { return (await getHttpApi()).demoRole(request); }
