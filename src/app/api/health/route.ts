import { getHttpApi } from '@/server/runtime-api';
export async function GET() { return (await getHttpApi()).health(); }
