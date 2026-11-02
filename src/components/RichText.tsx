import { useEffect, useRef, type ReactNode } from 'react';
import { Bold, List, ListOrdered, Pilcrow } from 'lucide-react';
import { domToText, parseRich, richToHtml, type Inline } from '../utils/richText';

/**
 * Rich text field: paragraphs, bulleted lists, numbered lists and bold, mixed freely in one field.
 * Stores lightweight text (see utils/richText.ts) so existing plain-text values display unchanged.
 */
export function RichTextEditor({ value, onChange, placeholder, minRows = 4, ariaLabel, invalid }: {
  value: string; onChange: (v: string) => void; placeholder?: string; minRows?: number; ariaLabel: string; invalid?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);

  // Re-render the DOM only when the value changes from outside (AI insert, load, reset) — not while typing
  useEffect(() => {
    const el = ref.current;
    if (!el || value === last.current) return;
    el.innerHTML = richToHtml(value);
    last.current = value;
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const text = domToText(el);
    last.current = text;
    if (text !== value) onChange(text);
  };
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    emit();
  };
  const inList = () => {
    const sel = window.getSelection();
    let n: Node | null = sel?.anchorNode ?? null;
    while (n && n !== ref.current) {
      if (n instanceof HTMLElement && (n.tagName === 'UL' || n.tagName === 'OL')) return n.tagName;
      n = n.parentNode;
    }
    return null;
  };
  const toParagraph = () => {
    const l = inList();
    if (l === 'UL') exec('insertUnorderedList');
    else if (l === 'OL') exec('insertOrderedList');
    else exec('formatBlock', 'p');
  };
  const btn = (label: string, icon: ReactNode, onClick: () => void) => (
    <button type="button" className="rt-btn" title={label} aria-label={label} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>{icon}</button>
  );

  return (
    <div className={`rt${invalid ? ' invalid' : ''}`}>
      <div className="rt-toolbar" role="toolbar" aria-label={`${ariaLabel} formatting`}>
        {btn('Paragraph / text', <Pilcrow size={15} />, toParagraph)}
        {btn('Bulleted list', <List size={15} />, () => exec('insertUnorderedList'))}
        {btn('Numbered list', <ListOrdered size={15} />, () => exec('insertOrderedList'))}
        {btn('Bold', <Bold size={15} />, () => exec('bold'))}
        <span className="rt-tip">Mix paragraphs and bullets freely · type "- " for a bullet</span>
      </div>
      <div
        ref={ref}
        className="rt-area"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-placeholder={placeholder ?? ''}
        style={{ minHeight: `${minRows * 1.55 + 1.2}em` }}
        onInput={emit}
        onBlur={() => { emit(); if (ref.current) { ref.current.innerHTML = richToHtml(last.current ?? ''); } }}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); exec('bold'); }
          // "- " / "1. " at the start of an empty line starts a list (like Word)
          if (e.key === ' ') {
            const sel = window.getSelection();
            const node = sel?.anchorNode;
            const text = node?.nodeType === Node.TEXT_NODE ? (node.textContent ?? '').slice(0, sel!.anchorOffset) : '';
            if (!inList() && (text === '-' || text === '*' || text === '•' || text === '1.')) {
              e.preventDefault();
              const range = document.createRange();
              range.setStart(node!, 0); range.setEnd(node!, sel!.anchorOffset);
              sel!.removeAllRanges(); sel!.addRange(range);
              document.execCommand('delete');
              exec(text === '1.' ? 'insertOrderedList' : 'insertUnorderedList');
            }
          }
        }}
        onPaste={(e) => {
          // Paste as text; bullets / numbering in the pasted text are recognised by the parser
          e.preventDefault();
          const t = e.clipboardData.getData('text/plain');
          document.execCommand('insertHTML', false, richToHtml(t).replace(/^<p>|<\/p>$/g, ''));
          emit();
        }}
      />
    </div>
  );
}

const runs = (rs: Inline[]) => rs.map((r, i) => (r.bold ? <strong key={i}>{r.text}</strong> : <span key={i}>{r.text}</span>));

/** Read-only rendering of rich text (paragraphs, bullets, numbering, bold). */
export function RichTextView({ value, empty }: { value: string | undefined | null; empty?: ReactNode }) {
  const blocks = parseRich(value);
  if (!blocks.length) return <>{empty ?? null}</>;
  return (
    <div className="rt-view">
      {blocks.map((b, i) => {
        if (b.type === 'p') return <p key={i}>{b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}{runs(l)}</span>)}</p>;
        const Tag = b.type;
        return <Tag key={i}>{b.items.map((it, j) => <li key={j}>{runs(it)}</li>)}</Tag>;
      })}
    </div>
  );
}
