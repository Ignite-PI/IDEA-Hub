import type { Charter, CharterData, Project, ProjectDetail, ProjectInput, ProjectStatus } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

const send = <T>(method: string, path: string, body?: unknown) =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  listProjects: () => request<Project[]>('/projects'),
  getProject: (id: string) => request<ProjectDetail>(`/projects/${id}`),
  createProject: (data: ProjectInput) => send<ProjectDetail>('POST', '/projects', data),
  updateProject: (id: string, data: Partial<ProjectInput>) => send<ProjectDetail>('PUT', `/projects/${id}`, data),
  updateStatus: (id: string, status: ProjectStatus) => send<ProjectDetail>('PATCH', `/projects/${id}`, { status }),
  deleteProject: (id: string) => send<{ success: boolean }>('DELETE', `/projects/${id}`),
  saveCharter: (id: string, data: CharterData, status: Charter['status']) =>
    send<ProjectDetail>('PUT', `/projects/${id}/charter`, { data, status }),
};
