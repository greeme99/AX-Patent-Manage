import { getHttpApi } from '@/server/runtime-api';
export async function GET(request: Request) { return (await getHttpApi()).resource('search-runs').GET(request); }
export async function POST(request: Request) { return (await getHttpApi()).resource('search-runs').POST(request); }
