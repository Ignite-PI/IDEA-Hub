import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { Project } from '../types';

interface ProjectsState {
  projects: Project[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const ProjectsContext = createContext<ProjectsState>({ projects: [], loading: true, error: null, refresh: async () => {} });

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setProjects(await api.listProjects());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return <ProjectsContext.Provider value={{ projects, loading, error, refresh }}>{children}</ProjectsContext.Provider>;
}

export const useProjects = () => useContext(ProjectsContext);
