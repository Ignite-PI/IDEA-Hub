import { useRef, useState, type FormEvent } from 'react';
import { ChevronDown, Copy, CornerDownLeft, Send, Sparkles, X } from 'lucide-react';
import { api, type AiContext } from '../../api';
import { copyText } from '../../utils/links';
import { Menu } from '../Menu';
import { useToast } from '../Toast';
import { useAiStatus } from './AiContext';

export interface InsertTarget {
  key: string;
  label: string;
  /** Appends the text to the field in the (unsaved) form. */
  insert: (text: string) => void;
}

const PRESETS = [
  { id: 'problem', label: 'Help me improve this problem statement' },
  { id: 'goals', label: 'Suggest measurable project goals' },
  { id: 'metrics', label: 'Suggest key metrics for this project' },
  { id: 'deliverables', label: 'Turn this description into project deliverables' },
  { id: 'risks', label: 'Suggest possible project risks' },
  { id: 'summary', label: 'Summarize this Project Charter' },
  { id: 'gaps', label: 'Check which Charter sections need more detail' },
];

interface Entry { id: number; prompt: string; reply?: string; error?: string }

/** Collapsible assistant drawer. Uses only the current project's (unsaved) information as context. */
export function AiPanel({ getContext, targets }: { getContext: () => AiContext; targets: InsertTarget[] }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { status } = useAiStatus();
  const toast = useToast();
  const listRef = useRef<HTMLDivElement>(null);

  const ask = async (body: { preset?: string; message?: string }, label: string) => {
    if (busy) return;
    const id = Date.now();
    setEntries((xs) => [...xs, { id, prompt: label }]);
    setBusy(true);
    setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 0);
    try {
      const r = await api.ai.chat({ ...body, context: getContext() });
      setEntries((xs) => xs.map((e) => (e.id === id ? { ...e, reply: r.reply } : e)));
    } catch (e) {
      setEntries((xs) => xs.map((x) => (x.id === id ? { ...x, error: (e as Error).message } : x)));
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 0);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const m = message.trim();
    if (!m) return;
    setMessage('');
    void ask({ message: m }, m);
  };

  if (!open) {
    return (
      <button type="button" className="ai-fab" onClick={() => setOpen(true)} aria-expanded={false}>
        <Sparkles size={17} /> AI Assistant
      </button>
    );
  }

  return (
    <aside className="ai-panel" aria-label="AI Assistant">
      <div className="ai-panel-head">
        <span className="icon"><Sparkles size={16} /></span>
        <div style={{ flex: 1 }}>
          <h3>AI Assistant</h3>
          <p>{status.configured ? `Azure OpenAI · uses only this project's information` : 'Not available yet'}</p>
        </div>
        <button type="button" className="btn btn-ghost btn-icon" onClick={() => setOpen(false)} aria-label="Collapse AI Assistant"><X size={17} /></button>
      </div>

      <div className="ai-panel-body" ref={listRef}>
        {!status.configured && (
          <div className="ai-error" style={{ marginBottom: 12 }}>
            <Sparkles size={16} />
            <div><strong>AI assistant unavailable</strong><p>{status.reason}</p><p className="small">You can keep working normally — nothing in your form is affected.</p></div>
          </div>
        )}
        <div className="ai-presets">
          {PRESETS.map((p) => (
            <button type="button" key={p.id} className="ai-chip" disabled={busy} onClick={() => void ask({ preset: p.id }, p.label)}>{p.label}</button>
          ))}
        </div>
        {entries.map((e) => (
          <div key={e.id} className="ai-entry">
            <div className="ai-q">{e.prompt}</div>
            {!e.reply && !e.error && <div className="ai-loading"><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Thinking…</div>}
            {e.error && <div className="ai-error"><div><strong>No suggestion</strong><p>{e.error}</p></div></div>}
            {e.reply && (
              <div className="ai-a">
                <span className="ai-tag"><Sparkles size={11} /> AI suggestion — review before using</span>
                <div className="prose small" style={{ marginTop: 6 }}>{e.reply}</div>
                <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { await copyText(e.reply!); toast('Suggestion copied'); }}><Copy size={13} /> Copy</button>
                  {targets.length > 0 && (
                    <Menu trigger={(toggle) => <button type="button" className="btn btn-soft btn-sm" onClick={toggle}><CornerDownLeft size={13} /> Insert into… <ChevronDown size={12} /></button>}>
                      {(close) => (
                        <>
                          <div className="menu-label">Append to field (not saved yet)</div>
                          {targets.map((t) => (
                            <button type="button" key={t.key} onClick={() => { close(); t.insert(e.reply!); toast(`Inserted into ${t.label} — review and save when ready`); }}>{t.label}</button>
                          ))}
                        </>
                      )}
                    </Menu>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <form className="ai-panel-foot" onSubmit={submit}>
        <input className="input" placeholder="Ask about this project…" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} disabled={busy} />
        <button className="btn btn-primary btn-icon" disabled={busy || !message.trim()} aria-label="Send"><Send size={16} /></button>
      </form>
    </aside>
  );
}
