import { getHttpApi } from '@/server/runtime-api';
export async function GET(request: Request) { return (await getHttpApi()).resource('evidence').GET(request); }
export async function POST(request: Request) { return (await getHttpApi()).resource('evidence').POST(request); }
