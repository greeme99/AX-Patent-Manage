import { DiagnosticsScreen } from '../../components/diagnostics-screen';
import { ProjectShell } from '../../components/project-shell';
import { getHttpApi } from '../../server/runtime-api';
import { loadPrimaryProjectScreen } from '../../server/ui-data';

export default async function HealthPage() {
  const data = await loadPrimaryProjectScreen();
  let apiOk = false;
  try { apiOk = (await (await getHttpApi()).health()).ok; } catch { apiOk = false; }
  return <ProjectShell projectId={data.projectId} initialRole={data.role} initialVersion={data.sessionVersion} readOnly={data.readOnly} active="diagnostics"><DiagnosticsScreen apiOk={apiOk} readOnly={data.readOnly} /></ProjectShell>;
}
