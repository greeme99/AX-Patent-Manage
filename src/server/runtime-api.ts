import { createDatabase } from './db/client';
import { DemoService } from './demo-service';
import { DrizzleDemoRepository } from './drizzle-demo-repository';
import { createHttpApi } from './http-api';

type HttpApi = ReturnType<typeof createHttpApi>;
let runtimeApi: Promise<HttpApi> | undefined;

export async function getHttpApi() {
  runtimeApi ??= (async () => {
    const database = createDatabase();
    await database.initialize();
    const service = new DemoService(new DrizzleDemoRepository(database), {
      secret: process.env.DEMO_SESSION_SECRET ?? 'local-demo-session-secret-change-in-production',
    });
    return createHttpApi(service);
  })();
  return runtimeApi;
}
