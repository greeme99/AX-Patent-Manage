import { ClaimChart } from '../../../../components/claim-chart';
import { ProjectShell } from '../../../../components/project-shell';
import { loadProjectScreen } from '../../../../server/ui-data';

export default async function ClaimChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProjectScreen(id);
  return <ProjectShell projectId={id} initialRole={data.role} readOnly={data.readOnly}><ClaimChart projectId={id} readOnly={data.readOnly} /></ProjectShell>;
}
