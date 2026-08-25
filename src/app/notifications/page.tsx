import { NotificationsScreen } from '../../components/notifications-screen';
import { ProjectShell } from '../../components/project-shell';
import { loadPrimaryProjectScreen } from '../../server/ui-data';

export default async function NotificationsPage() {
  const data = await loadPrimaryProjectScreen();
  return <ProjectShell projectId={data.projectId} initialRole={data.role} initialVersion={data.sessionVersion} readOnly={data.readOnly} active="notifications"><NotificationsScreen projectId={data.projectId} /></ProjectShell>;
}
