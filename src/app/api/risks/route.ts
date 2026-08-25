import { getHttpApi } from '@/server/runtime-api';
export async function GET(request: Request) { return (await getHttpApi()).resource('risks').GET(request); }
export async function POST(request: Request) { return (await getHttpApi()).resource('risks').POST(request); }
