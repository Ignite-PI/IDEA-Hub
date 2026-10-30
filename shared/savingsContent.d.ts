export declare const INSTRUCTIONS: {
  title: string; purpose: string; target: string; steps: string[]; logic: [string, string][]; guardrails: string[]; source: string; workbookNotes: string[];
};
export interface StoryboardRow { slide: string; purpose: string; headline: string; metric: string; metricLabel: string; evidence: string; owner: string }
export declare const STORYBOARD: StoryboardRow[];
export interface ColumnDef {
  col: string; header: string; key: string; kind: 'system' | 'input' | 'rate' | 'calc' | 'linked' | 'raci';
  list?: string; linked?: boolean; type?: 'number' | 'currency' | 'percent' | 'fte' | 'date' | 'text'; letter?: string; help: string;
}
export declare const COLUMNS: ColumnDef[];
