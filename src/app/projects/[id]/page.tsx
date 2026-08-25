import { PHASES, type Phase } from '../../../domain';
import { ProjectShell } from '../../../components/project-shell';
import { ProjectWorkspace } from '../../../components/project-workspace';
import { loadProjectScreen } from '../../../server/ui-data';

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ phase?: string | string[] }>;
};

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const requested = Array.isArray(query.phase) ? query.phase[0] : query.phase;
  const phase: Phase = requested && PHASES.includes(requested as Phase) ? requested as Phase : 'DESIGN';
  const data = await loadProjectScreen(id);

  return (
    <ProjectShell projectId={id} initialRole={data.role} readOnly={data.readOnly}>
      <ProjectWorkspace phase={phase} projectId={id} readOnly={data.readOnly} claimCount={data.claimCount} riskCount={data.riskCount} />
    </ProjectShell>
  );
}
