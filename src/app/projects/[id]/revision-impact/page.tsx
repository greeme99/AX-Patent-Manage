import { ProjectShell } from '../../../../components/project-shell';
import { RevisionImpact } from '../../../../components/revision-impact';
import { loadProjectScreen } from '../../../../server/ui-data';

export default async function RevisionImpactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadProjectScreen(id);
  return <ProjectShell projectId={id} initialRole={data.role} readOnly={data.readOnly}><RevisionImpact projectId={id} revisionId={data.currentRevisionId} version={data.projectVersion} readOnly={data.readOnly} /></ProjectShell>;
}
