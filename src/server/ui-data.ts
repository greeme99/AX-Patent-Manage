import { cookies } from 'next/headers';

import { ROLES, syntheticFpcbProject, type Role } from '../domain';
import { getHttpApi } from './runtime-api';

export interface ProjectScreenData {
  projectId: string;
  role: Role;
  readOnly: boolean;
  claimCount: number;
  riskCount: number;
  currentRevisionId: string;
  projectVersion: number;
}

export async function loadProjectScreen(projectId: string): Promise<ProjectScreenData> {
  const fallback: ProjectScreenData = {
    projectId,
    role: 'PRACTITIONER',
    readOnly: true,
    claimCount: syntheticFpcbProject.claimElements.length,
    riskCount: syntheticFpcbProject.risks.length,
    currentRevisionId: syntheticFpcbProject.currentRevisionId,
    projectVersion: 1,
  };

  try {
    const cookieHeader = (await cookies()).toString();
    if (!cookieHeader.includes('demo_session=')) return fallback;
    const api = await getHttpApi();
    const request = (path: string) => new Request(`http://demo.local${path}`, { headers: { cookie: cookieHeader } });
    const [sessionResponse, projectsResponse] = await Promise.all([
      api.demoSession(request('/api/demo/session')),
      api.projects(request('/api/projects')),
    ]);
    if (!sessionResponse.ok || !projectsResponse.ok) return fallback;
    const sessionPayload = await sessionResponse.json() as { session: { role: string } | null };
    const projectPayload = await projectsResponse.json() as { data: { id: string; currentRevisionId: string; version: number }[] };
    const project = projectPayload.data.find((item) => item.id === projectId);
    if (!project || !sessionPayload.session) return fallback;
    const role = ROLES.includes(sessionPayload.session.role as Role)
      ? sessionPayload.session.role as Role
      : 'PRACTITIONER';
    const [claimsResponse, risksResponse] = await Promise.all([
      api.projectResource('claim-charts', request(`/api/projects/${projectId}/claim-charts`), projectId, 'GET'),
      api.projectResource('risks', request(`/api/projects/${projectId}/risks`), projectId, 'GET'),
    ]);
    const claims = claimsResponse.ok ? await claimsResponse.json() as { data: unknown[] } : { data: syntheticFpcbProject.claimElements as readonly unknown[] };
    const risks = risksResponse.ok ? await risksResponse.json() as { data: unknown[] } : { data: syntheticFpcbProject.risks as readonly unknown[] };
    return { projectId, role, readOnly: false, claimCount: claims.data.length, riskCount: risks.data.length, currentRevisionId: project.currentRevisionId, projectVersion: project.version };
  } catch {
    return fallback;
  }
}

export async function loadPrimaryProjectScreen(): Promise<ProjectScreenData> {
  try {
    const cookieHeader = (await cookies()).toString();
    if (cookieHeader.includes('demo_session=')) {
      const api = await getHttpApi();
      const response = await api.projects(new Request('http://demo.local/api/projects', { headers: { cookie: cookieHeader } }));
      if (response.ok) {
        const payload = await response.json() as { data: { id: string }[] };
        if (payload.data[0]) return loadProjectScreen(payload.data[0].id);
      }
    }
  } catch {
    // The route remains useful with the deterministic sample fixture.
  }
  return loadProjectScreen(syntheticFpcbProject.id);
}
