import { getHttpApi } from '@/server/runtime-api';

export const runtime = 'nodejs';
export async function GET(request: Request) { return (await getHttpApi()).demoSession(request); }
export async function POST(request: Request) { return (await getHttpApi()).demoSession(request); }
