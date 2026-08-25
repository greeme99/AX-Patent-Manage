import { createDatabase } from './db/client';
import { DemoService } from './demo-service';
import { DrizzleDemoRepository } from './drizzle-demo-repository';
import { createHttpApi } from './http-api';

type HttpApi = ReturnType<typeof createHttpApi>;
let runtimeApi: Promise<HttpApi> | undefined;

const LOCAL_DEMO_SESSION_SECRET = 'local-demo-session-secret-change-in-production';

export function resolveDemoSessionSecret(environment: Record<string, string | undefined> = process.env): string {
  const secret = environment.DEMO_SESSION_SECRET;
  if (environment.NODE_ENV !== 'production') return secret ?? LOCAL_DEMO_SESSION_SECRET;
  if (!secret || secret === LOCAL_DEMO_SESSION_SECRET || secret.length < 32) {
    throw new Error('DEMO_SESSION_SECRET must be a non-placeholder value of at least 32 characters in production');
  }
  return secret;
}

export async function getHttpApi() {
  runtimeApi ??= (async () => {
    const database = createDatabase();
    await database.initialize();
    const service = new DemoService(new DrizzleDemoRepository(database), {
      secret: resolveDemoSessionSecret(),
      secureCookies: process.env.NODE_ENV === 'production',
    });
    return createHttpApi(service);
  })();
  return runtimeApi;
}
