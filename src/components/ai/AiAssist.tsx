import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, Copy, CornerDownLeft, RefreshCw, Replace, Sparkles } from 'lucide-react';
import { api, type AiContext } from '../../api';
import { copyText } from '../../utils/links';
import { Menu } from '../Menu';
import { Modal } from '../Modal';
import { useToast } from '../Toast';
import { TEXT_ACTION_LABELS, WRITING_ACTIONS, useAiStatus } from './AiContext';

type Phase = { state: 'loading' } | { state: 'error'; message: string } | { state: 'text'; suggestion: string } | { state: 'rows'; rows: Record<string, string>[] };

function useAiRequest(action: string, text: string, field: string, getContext: () => AiContext) {
  const [phase, setPhase] = useState<Phase>({ state: 'loading' });
  const { status } = useAiStatus();
  const contextRef = useRef(getContext);
  contextRef.current = getContext;
  const reasonRef = useRef(status.reason);
  reasonRef.current = status.reason;
  const run = useCallback(async () => {
    setPhase({ state: 'loading' });
    try {
      const r = await api.ai.assist(action, text, field, contextRef.current());
      setPhase(r.kind === 'rows' ? { state: 'rows', rows: r.rows } : { state: 'text', suggestion: r.suggestion });
    } catch (e) {
      setPhase({ state: 'error', message: (e as Error).message || reasonRef.current || 'The AI assistant is unavailable.' });
    }
  }, [action, text, field]);
  useEffect(() => { void run(); }, [run]);
  return { phase, setPhase, run };
}

function AiError({ message }: { message: string }) {
  return (
    <div className="ai-error" role="alert">
      <AlertCircle size={18} />
      <div><strong>AI suggestion unavailable</strong><p>{message}</p><p className="small">Your original text has not been changed.</p></div>
    </div>
  );
}

function AiLoading() {
  return <div className="ai-loading"><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> Generating a suggestion…</div>;
}

// ─── Text fields ─────────────────────────────────────────────────────────────
interface TextProps {
  field: string;
  value: string;
  onChange: (value: string) => void;
  getContext: () => AiContext;
  extraActions?: string[];
}

/** "AI" button beside a long-text field. Never edits the field until the user picks Replace or Insert. */
export function AiAssistButton({ field, value, onChange, getContext, extraActions = [] }: TextProps) {
  const [action, setAction] = useState<string | null>(null);
  const actions = [...extraActions, ...WRITING_ACTIONS];
  return (
    <>
      <Menu
        align="end"
        trigger={(toggle) => (
          <button type="button" className="ai-btn" onClick={toggle} title={`AI writing assistant for ${field}`}>
            <Sparkles size={13} /> AI assist <ChevronDown size={12} />
          </button>
        )}
      >
        {(close) => (
          <>
            {extraActions.length > 0 && <div className="menu-label">For {field}</div>}
            {actions.map((a, i) => (
              <span key={a}>
                {i === extraActions.length && extraActions.length > 0 && <div className="menu-label">Writing</div>}
                <button type="button" onClick={() => { close(); setAction(a); }}><Sparkles size={14} color="#794CFF" /> {TEXT_ACTION_LABELS[a]}</button>
              </span>
            ))}
          </>
        )}
      </Menu>
      {action && (
        <TextSuggestModal
          key={action}
          action={action}
          field={field}
          original={value}
          getContext={getContext}
          onClose={() => setAction(null)}
          onApply={(next) => { onChange(next); setAction(null); }}
        />
      )}
    </>
  );
}

function TextSuggestModal({ action, field, original, getContext, onClose, onApply }: {
  action: string; field: string; original: string; getContext: () => AiContext; onClose: () => void; onApply: (v: string) => void;
}) {
  const toast = useToast();
  const { phase, setPhase, run } = useAiRequest(action, original, field, getContext);
  const suggestion = phase.state === 'text' ? phase.suggestion : '';
  const ready = phase.state === 'text' && suggestion.trim().length > 0;

  return (
    <Modal
      wide
      icon={<Sparkles size={18} />}
      title={`${TEXT_ACTION_LABELS[action]} · ${field}`}
      subtitle="Review the AI suggestion. Nothing changes until you choose Replace or Insert, and nothing is saved until you save the form."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-secondary" disabled={phase.state === 'loading'} onClick={() => void run()}><RefreshCw size={15} /> Regenerate</button>
          <button type="button" className="btn btn-secondary" disabled={!ready} onClick={async () => { await copyText(suggestion); toast('Suggestion copied'); }}><Copy size={15} /> Copy suggestion</button>
          <button type="button" className="btn btn-soft" disabled={!ready} onClick={() => onApply(original.trim() ? `${original.trimEnd()}\n\n${suggestion}` : suggestion)}>
            <CornerDownLeft size={15} /> Insert suggestion
          </button>
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => onApply(suggestion)}><Replace size={15} /> Replace original</button>
        </>
      }
    >
      <div className="ai-compare">
        <div>
          <div className="ai-col-label">Original</div>
          <div className="ai-original">{original.trim() ? original : <span className="muted">(empty)</span>}</div>
        </div>
        <div>
          <div className="ai-col-label"><span className="ai-tag"><Sparkles size={11} /> AI suggestion</span> <span className="muted small">editable before you apply it</span></div>
          {phase.state === 'loading' && <AiLoading />}
          {phase.state === 'error' && <AiError message={phase.message} />}
          {phase.state === 'text' && (
            <textarea className="textarea ai-suggestion" value={suggestion} onChange={(e) => setPhase({ state: 'text', suggestion: e.target.value })} rows={10} />
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Row-based sections (Key Metrics, Milestones) ────────────────────────────
interface RowsProps<T> {
  action: 'suggest_metrics_rows' | 'suggest_milestones_rows';
  field: string;
  rows: T[];
  columns: { key: keyof T & string; label: string }[];
  getContext: () => AiContext;
  toRow: (r: Record<string, string>) => T;
  onReplace: (rows: T[]) => void;
  onInsert: (rows: T[]) => void;
}

export function AiRowsButton<T extends object>(props: RowsProps<T>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="ai-btn" onClick={() => setOpen(true)} title={`AI suggestions for ${props.field}`}>
        <Sparkles size={13} /> {TEXT_ACTION_LABELS[props.action]}
      </button>
      {open && <RowsSuggestModal {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function RowsSuggestModal<T extends object>({ action, field, rows, columns, getContext, toRow, onReplace, onInsert, onClose }: RowsProps<T> & { onClose: () => void }) {
  const toast = useToast();
  const existing = (rows as Record<string, unknown>[]).filter((r) => columns.some((c) => String(r[c.key] ?? '').trim()));
  const asText = (list: Record<string, unknown>[]) => list.map((r) => columns.map((c) => `${c.label}: ${r[c.key] ?? ''}`).join(' | ')).join('\n');
  const { phase, run } = useAiRequest(action, asText(existing), field, getContext);
  const suggested = phase.state === 'rows' ? phase.rows : [];
  const ready = suggested.length > 0;

  const table = (list: Record<string, unknown>[]) => (
    <div className="table-wrap ai-rows">
      <table className="table">
        <thead><tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
        <tbody>{list.map((r, i) => <tr key={i} style={{ cursor: 'default' }}>{columns.map((c) => <td key={c.key}>{String(r[c.key] ?? '') || <span className="empty-dash">—</span>}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );

  return (
    <Modal
      wide
      icon={<Sparkles size={18} />}
      title={`${TEXT_ACTION_LABELS[action]} · ${field}`}
      subtitle="Review the AI suggestions. Nothing changes until you choose Replace or Insert, and nothing is saved until you save."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-secondary" disabled={phase.state === 'loading'} onClick={() => void run()}><RefreshCw size={15} /> Regenerate</button>
          <button type="button" className="btn btn-secondary" disabled={!ready} onClick={async () => { await copyText(asText(suggested)); toast('Suggestions copied'); }}><Copy size={15} /> Copy suggestion</button>
          <button type="button" className="btn btn-soft" disabled={!ready} onClick={() => { onInsert(suggested.map(toRow)); onClose(); }}><CornerDownLeft size={15} /> Insert suggestion</button>
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => { onReplace(suggested.map(toRow)); onClose(); }}><Replace size={15} /> Replace original</button>
        </>
      }
    >
      <div className="stack" style={{ gap: 16 }}>
        <div>
          <div className="ai-col-label">Original</div>
          {existing.length ? table(existing) : <div className="ai-original"><span className="muted">(no rows yet)</span></div>}
        </div>
        <div>
          <div className="ai-col-label"><span className="ai-tag"><Sparkles size={11} /> AI suggestion</span></div>
          {phase.state === 'loading' && <AiLoading />}
          {phase.state === 'error' && <AiError message={phase.message} />}
          {ready && table(suggested)}
        </div>
      </div>
    </Modal>
  );
}
