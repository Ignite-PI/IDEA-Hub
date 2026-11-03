import { useState, type FormEvent } from 'react';
import { ExternalLink, Pencil, Plus, Presentation, Save, Trash2, X } from 'lucide-react';
import { api, type DeckInput } from '../api';
import type { ProjectDeck } from '../types';
import { formatDate } from '../utils/format';
import { useToast } from './Toast';

/**
 * Project Decks: references (name + SharePoint / OneDrive link + description) to PowerPoint presentations that
 * already live in Microsoft 365. Nothing is uploaded or stored here; removing a deck removes only the reference.
 * Separate from the single Project Link.
 */
const ALLOWED = ['sharepoint.com', 'collaborate.wellpoint.com'];
const linkProblem = (url: string) => {
  let u: URL;
  try { u = new URL(url.trim()); } catch { return 'Enter the full SharePoint or OneDrive link (https://…).'; }
  if (u.protocol !== 'https:') return 'The link must start with https://.';
  const host = u.hostname.toLowerCase();
  if (!ALLOWED.some((h) => host === h || host.endsWith(`.${h}`))) return 'Use a link to the company SharePoint or OneDrive for Business.';
  return null;
};
const EMPTY: DeckInput = { name: '', url: '', description: '' };

export function ProjectDecks({ projectId, decks, onChange, readOnly = false }: {
  projectId: string; decks: ProjectDeck[]; onChange: (decks: ProjectDeck[]) => void; readOnly?: boolean;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<DeckInput>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const start = (d?: ProjectDeck) => { setEditing(d ? d.id : 'new'); setForm(d ? { name: d.name, url: d.url, description: d.description } : EMPTY); setTouched(false); };
  const cancel = () => { setEditing(null); setForm(EMPTY); };
  const nameErr = touched && !form.name.trim() ? 'Deck Name is required.' : null;
  const urlErr = touched ? (form.url.trim() ? linkProblem(form.url) : 'SharePoint / OneDrive Link is required.') : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!form.name.trim() || !form.url.trim() || linkProblem(form.url)) return;
    setBusy(true);
    try {
      const payload = { name: form.name.trim(), url: form.url.trim(), description: form.description.trim() };
      if (editing === 'new') {
        const d = await api.addDeck(projectId, payload);
        onChange([...decks, d]);
        toast('Project deck added');
      } else if (editing) {
        const d = await api.updateDeck(editing, payload);
        onChange(decks.map((x) => (x.id === d.id ? d : x)));
        toast('Project deck updated');
      }
      cancel();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: ProjectDeck) => {
    if (!window.confirm(`Remove "${d.name}" from this project?\n\nOnly the reference in Clinical Towers Project Hub is removed. The PowerPoint file in SharePoint / OneDrive is NOT deleted.`)) return;
    try {
      await api.removeDeck(d.id);
      onChange(decks.filter((x) => x.id !== d.id));
      toast('Deck reference removed (the file in SharePoint / OneDrive was not touched)');
    } catch (err) {
      toast((err as Error).message, 'error');
    }
  };

  const formUi = (
    <form className="deck-form" onSubmit={submit} noValidate>
      <div className={`field${nameErr ? ' invalid' : ''}`}>
        <label className="label" htmlFor="deck-name">Deck Name<span className="req">*</span></label>
        <input id="deck-name" className="input" autoFocus maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Leadership Review" />
        {nameErr && <span className="error">{nameErr}</span>}
      </div>
      <div className={`field${urlErr ? ' invalid' : ''}`}>
        <label className="label" htmlFor="deck-url">SharePoint / OneDrive Link<span className="req">*</span></label>
        <input id="deck-url" className="input" type="url" maxLength={2048} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://collaborate.wellpoint.com/…  or  https://…sharepoint.com/…" />
        {urlErr ? <span className="error">{urlErr}</span> : <span className="hint">In SharePoint / OneDrive open the file's ⋯ menu → Copy link, then paste it here. The file stays in SharePoint / OneDrive.</span>}
      </div>
      <div className="field">
        <label className="label" htmlFor="deck-desc">Description <span className="small muted">(optional)</span></label>
        <textarea id="deck-desc" className="textarea" rows={2} maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this deck is for" />
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={cancel} disabled={busy}><X size={15} /> Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}><Save size={15} /> {busy ? 'Saving…' : editing === 'new' ? 'Add deck' : 'Save deck'}</button>
      </div>
    </form>
  );

  return (
    <section className="card" id="decks" style={{ marginTop: 20 }}>
      <div className="card-head" style={{ flexWrap: 'wrap' }}>
        <div className="row" style={{ gap: 14 }}>
          <span className="section-icon"><Presentation size={18} /></span>
          <div>
            <h2>Project Decks</h2>
            <p>PowerPoint presentations for this project, stored in SharePoint / OneDrive · {decks.length} deck{decks.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        {!readOnly && editing === null && <button className="btn btn-soft" onClick={() => start()}><Plus size={15} /> Add Project Deck</button>}
      </div>
      <div className="card-body">
        {editing === 'new' && formUi}
        {decks.length === 0 && editing !== 'new' && (
          <p className="muted small">No project decks yet.{!readOnly && ' Use “Add Project Deck” to link a PowerPoint stored in SharePoint or OneDrive.'}</p>
        )}
        <ul className="deck-list">
          {decks.map((d) => (
            <li key={d.id} className="deck">
              {editing === d.id ? formUi : (
                <>
                  <span className="deck-icon" aria-hidden><Presentation size={18} /></span>
                  <div className="deck-main">
                    <b>{d.name}</b>
                    {d.description && <span className="small">{d.description}</span>}
                    <span className="small muted">Added {formatDate(d.created_at)}{d.created_by ? ` by ${d.created_by}` : ''}{d.updated_at !== d.created_at ? ` · updated ${formatDate(d.updated_at)}` : ''}</span>
                  </div>
                  <div className="row" style={{ gap: 6 }}>
                    <a className="btn btn-primary btn-sm" href={d.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Open Deck</a>
                    {!readOnly && <button className="btn btn-ghost btn-icon" aria-label={`Edit ${d.name}`} title="Edit name / link / description" onClick={() => start(d)}><Pencil size={15} /></button>}
                    {!readOnly && <button className="btn btn-ghost btn-icon" aria-label={`Remove ${d.name}`} title="Remove reference (file is not deleted)" onClick={() => void remove(d)}><Trash2 size={15} color="#b4234a" /></button>}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
