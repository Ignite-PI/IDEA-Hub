import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, type AiStatus } from '../../api';

const UNKNOWN: AiStatus = { configured: false, provider: 'Azure OpenAI Service', deployment: null, reason: 'Checking AI assistant availability…' };
const AiStatusContext = createContext<{ status: AiStatus; refresh: () => void }>({ status: UNKNOWN, refresh: () => {} });

export function AiStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AiStatus>(UNKNOWN);
  const refresh = useCallback(() => {
    api.ai.status().then(setStatus).catch(() =>
      setStatus({ ...UNKNOWN, reason: 'The AI assistant is unavailable because the server could not be reached.' }));
  }, []);
  useEffect(refresh, [refresh]);
  return <AiStatusContext.Provider value={{ status, refresh }}>{children}</AiStatusContext.Provider>;
}

export const useAiStatus = () => useContext(AiStatusContext);

export const TEXT_ACTION_LABELS: Record<string, string> = {
  rephrase: 'Rephrase',
  clarity: 'Improve clarity',
  concise: 'Make concise',
  professional: 'Make more professional',
  grammar: 'Correct grammar',
  expand: 'Expand the explanation',
  summarize: 'Summarize',
  improve_problem: 'Improve the problem statement',
  improve_goals: 'Improve project goals',
  improve_impact: 'Improve the business impact / benefit',
  improve_scope: 'Clarify scope & constraints',
  suggest_metrics: 'Suggest measurable key metrics',
  suggest_deliverables: 'Suggest project deliverables',
  suggest_milestones: 'Suggest milestones or tasks',
  suggest_metrics_rows: 'Suggest key metrics',
  suggest_milestones_rows: 'Suggest milestones / tasks',
};

export const WRITING_ACTIONS = ['rephrase', 'clarity', 'concise', 'professional', 'grammar', 'expand', 'summarize'];
