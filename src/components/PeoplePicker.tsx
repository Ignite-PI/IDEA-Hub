import { useId, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';

/**
 * People are stored as text: several people are separated by "; " (older values with line breaks are read too),
 * so the value flows unchanged into exports and the MANAGERS module.
 */
export const splitPeople = (v: string | undefined | null) =>
  String(v ?? '').split(/\s*;\s*|\s*\n+\s*/).map((s) => s.trim()).filter(Boolean);
export const joinPeople = (list: string[]) => list.join('; ');

/** Unique, sorted people names from any list of values (each value may hold several people). */
export const peopleOptions = (...values: (string | undefined | null)[]) =>
  [...new Set(values.flatMap(splitPeople))].sort((a, b) => a.localeCompare(b));

/** Searchable people selector with chips. multiple=false keeps exactly one person (e.g. Accountable). */
export function PeoplePicker({ value, onChange, options, multiple = true, placeholder, ariaLabel, invalid }: {
  value: string; onChange: (v: string) => void; options: string[]; multiple?: boolean; placeholder?: string; ariaLabel: string; invalid?: boolean;
}) {
  const selected = splitPeople(value);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return options.filter((o) => !selected.some((x) => x.toLowerCase() === o.toLowerCase()) && (!s || o.toLowerCase().includes(s))).slice(0, 8);
  }, [q, options, selected]);
  const exact = options.some((o) => o.toLowerCase() === q.trim().toLowerCase()) || selected.some((o) => o.toLowerCase() === q.trim().toLowerCase());

  const add = (name: string) => {
    const n = name.trim().replace(/;/g, ',');
    if (!n) return;
    onChange(joinPeople(multiple ? [...selected.filter((s) => s.toLowerCase() !== n.toLowerCase()), n] : [n]));
    setQ('');
    setHi(0);
    if (!multiple) setOpen(false);
  };
  const remove = (name: string) => onChange(joinPeople(selected.filter((s) => s !== name)));
  const showInput = multiple || selected.length === 0;

  return (
    <div className={`pp${invalid ? ' invalid' : ''}`} onClick={() => inputRef.current?.focus()}>
      {selected.map((s) => (
        <span key={s} className="pp-chip">{s}
          <button type="button" aria-label={`Remove ${s}`} onClick={(e) => { e.stopPropagation(); remove(s); }}><X size={12} /></button>
        </span>
      ))}
      {showInput ? (
        <input
          ref={inputRef}
          className="pp-input"
          value={q}
          aria-label={ariaLabel}
          role="combobox"
          aria-expanded={open && (matches.length > 0 || !!q.trim())}
          aria-controls={listId}
          placeholder={selected.length ? (multiple ? 'Add another…' : '') : placeholder ?? (multiple ? 'Search or type names…' : 'Search or type a name…')}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => { setOpen(false); if (q.trim()) add(q); }, 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, Math.max(matches.length - 1, 0))); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            else if (e.key === 'Enter' || e.key === ';' || (e.key === 'Tab' && q.trim())) {
              if (q.trim() || matches[hi]) { e.preventDefault(); add(open && matches[hi] && (!q.trim() || matches[hi]!.toLowerCase().includes(q.trim().toLowerCase())) ? matches[hi]! : q); }
            } else if (e.key === 'Backspace' && !q && selected.length) remove(selected[selected.length - 1]!);
            else if (e.key === 'Escape') setOpen(false);
          }}
        />
      ) : (
        <button type="button" className="pp-change" onClick={(e) => { e.stopPropagation(); onChange(''); setTimeout(() => inputRef.current?.focus(), 0); }}>Change</button>
      )}
      {open && showInput && (matches.length > 0 || (q.trim() && !exact)) && (
        <ul className="pp-menu" id={listId} role="listbox">
          {matches.map((m, i) => (
            <li key={m} role="option" aria-selected={i === hi} className={i === hi ? 'on' : undefined} onMouseDown={(e) => { e.preventDefault(); add(m); }}>{m}</li>
          ))}
          {q.trim() && !exact && (
            <li role="option" aria-selected={false} className="pp-new" onMouseDown={(e) => { e.preventDefault(); add(q); }}><Plus size={13} /> Add “{q.trim()}”</li>
          )}
        </ul>
      )}
    </div>
  );
}
