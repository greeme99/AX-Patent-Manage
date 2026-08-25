import type { Role } from '../domain';
import { switchDemoRole } from './demo-client';

export interface ProjectShellState {
  role: Role;
  version: number;
  readOnly: boolean;
  error: string | null;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function createProjectShellState(role: Role, version: number, readOnly: boolean): ProjectShellState {
  return { role, version, readOnly, error: null };
}

export async function performProjectRoleSwitch(
  state: ProjectShellState,
  nextRole: Role,
  fetcher: Fetcher,
  keyFactory: () => string,
): Promise<ProjectShellState> {
  try {
    const updated = await switchDemoRole(fetcher, nextRole, state.version, keyFactory);
    return { role: updated.role, version: updated.version, readOnly: false, error: null };
  } catch (error) {
    return {
      ...state,
      readOnly: true,
      error: error instanceof Error ? error.message : '알 수 없는 네트워크 오류',
    };
  }
}

export function ProjectShellFeedback({ error }: ProjectShellState) {
  if (!error) return null;
  return (
    <div className="session-error-banner" role="alert">
      <strong>역할 전환 실패 · 읽기 전용으로 전환</strong>
      <span>{error}</span>
      <small>화면 데이터는 유지되었습니다. Cockpit에서 세션을 초기화한 뒤 다시 시도하세요.</small>
    </div>
  );
}
