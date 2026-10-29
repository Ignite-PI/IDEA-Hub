import type {
  Charter, CharterData, Project, ProjectDetail, ProjectInput, ProjectStatus, StatusHistoryEntry, TimelineActivity,
} from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
const USER_KEY = 'sbf.userName';

export const getUserName = () => localStorage.getItem(USER_KEY) ?? '';
export const setUserName = (name: string) => localStorage.setItem(USER_KEY, name.trim());

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

/** Fired when the server says the session is missing/expired, so the app can show the sign-in page. */
export const UNAUTHORIZED_EVENT = 'sbf:unauthorized';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-SBF-Client': '1',
        'X-User-Name': encodeURIComponent(getUserName()),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError('Could not reach the SBF Project Hub server. Check your connection and try again.', 0, 'network');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 401 && body.code === 'unauthenticated') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status, body.code);
  }
  return res.json() as Promise<T>;
}

export interface SessionInfo { authenticated: boolean; username?: string; expiresAt?: string }

const send = <T>(method: string, path: string, body?: unknown) =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export interface AiContext {
  project?: Partial<ProjectInput>;
  charter?: Partial<CharterData>;
  timeline?: Partial<TimelineActivity>[];
}
export interface AiStatus { configured: boolean; provider: string; deployment: string | null; reason: string | null }
export type AiAssistResult = { kind: 'text'; suggestion: string } | { kind: 'rows'; rows: Record<string, string>[] };

export const api = {
  auth: {
    session: () => request<SessionInfo>('/auth/session'),
    login: (username: string, password: string) => send<SessionInfo>('POST', '/auth/login', { username, password }),
    logout: () => send<SessionInfo>('POST', '/auth/logout'),
  },
  listProjects: () => request<Project[]>('/projects'),
  getProject: (id: string) => request<ProjectDetail>(`/projects/${id}`),
  createProject: (data: ProjectInput) => send<ProjectDetail>('POST', '/projects', data),
  updateProject: (id: string, data: Partial<ProjectInput>) => send<ProjectDetail>('PUT', `/projects/${id}`, data),
  updateStatus: (id: string, status: ProjectStatus) => send<ProjectDetail>('PATCH', `/projects/${id}`, { status }),
  deleteProject: (id: string) => send<{ success: boolean }>('DELETE', `/projects/${id}`),
  saveCharter: (id: string, data: CharterData, status: Charter['status'], completeness: number) =>
    send<ProjectDetail>('PUT', `/projects/${id}/charter`, { data, status, completeness }),
  history: (id: string) => request<StatusHistoryEntry[]>(`/projects/${id}/history`),
  saveTimeline: (id: string, activities: TimelineActivity[]) =>
    send<TimelineActivity[]>('PUT', `/projects/${id}/timeline`, { activities }),
  updateActivity: (activityId: string, patch: Partial<Pick<TimelineActivity, 'status' | 'progress'>>) =>
    send<TimelineActivity>('PATCH', `/timeline/${activityId}`, patch),

  ai: {
    status: () => request<AiStatus>('/ai/status'),
    assist: (action: string, text: string, field: string, context: AiContext) =>
      send<AiAssistResult>('POST', '/ai/assist', { action, text, field, context }),
    chat: (body: { preset?: string; message?: string; context: AiContext }) =>
      send<{ reply: string; prompt: string }>('POST', '/ai/chat', body),
  },
};
