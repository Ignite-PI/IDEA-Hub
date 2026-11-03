import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

/** Dropdown filter that allows several selections (checkbox list with search). Empty selection = "All". */
export function MultiSelect({ label, allLabel, options, value, onChange, labels }: {
  label: string; allLabel: string; options: string[]; value: string[]; onChange: (v: string[]) => void;
  /** Optional display labels for stored codes (e.g. 'sbf' → 'Specialized Business Functions'). */
  labels?: Record<string, string>;
}) {
  const show = (o: string) => labels?.[o] ?? o;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);
  const shown = useMemo(() => [...new Set(options)].filter((o) => show(o).toLowerCase().includes(q.trim().toLowerCase())), [options, q, labels]);
  const toggle = (o: string) => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  const summary = value.length === 0 ? allLabel : value.length === 1 ? show(value[0]!) : `${label}: ${value.length} selected`;

  return (
    <div className="ms" ref={ref}>
      <button type="button" className={`select ms-trigger${value.length ? ' on' : ''}`} aria-label={label} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="ms-sum">{summary}</span><ChevronDown size={14} aria-hidden />
      </button>
      {open && (
        <div className="ms-pop" role="listbox" aria-multiselectable="true" aria-label={label}>
          {options.length > 0 && <input className="input ms-search" autoFocus placeholder={`Search ${label.toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} />}
          <div className="ms-list">
            {shown.map((o) => (
              <button type="button" key={o} role="option" aria-selected={value.includes(o)} className={`ms-opt${value.includes(o) ? ' on' : ''}`} onClick={() => toggle(o)}>
                <span className="ms-box">{value.includes(o) && <Check size={12} />}</span>{show(o)}
              </button>
            ))}
            {!shown.length && <div className="small muted" style={{ padding: 8 }}>No matches</div>}
          </div>
          <div className="ms-foot">
            <span className="small muted">{value.length ? `${value.length} selected` : 'Showing all'}</span>
            {value.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([])}><X size={13} /> Clear</button>}
          </div>
        </div>
      )}
    </div>
  );
}
