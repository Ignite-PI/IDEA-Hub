import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  trigger: (toggle: () => void, open: boolean) => ReactNode;
  children: (close: () => void) => ReactNode;
  /** Horizontal alignment relative to the trigger. */
  align?: 'start' | 'end';
  className?: string;
}

const GAP = 6;
const EDGE = 8;

/**
 * Dropdown rendered in a portal with fixed positioning, so it can never be clipped
 * by a parent card's overflow or stacking context. Opens below or above depending on
 * available space, stays inside the viewport and scrolls if it is taller than the space.
 */
export function Menu({ trigger, children, align = 'start', className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  const place = useCallback(() => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    const menu = menuRef.current;
    if (!anchor || !menu) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = menu.offsetWidth;
    const natural = menu.scrollHeight;
    const below = vh - anchor.bottom - GAP - EDGE;
    const above = anchor.top - GAP - EDGE;
    const openUp = natural > below && above > below;
    const maxHeight = Math.max(120, openUp ? above : below);
    let left = align === 'end' ? anchor.right - width : anchor.left;
    left = Math.min(Math.max(EDGE, left), vw - width - EDGE);
    setStyle({
      left,
      maxHeight,
      ...(openUp ? { bottom: vh - anchor.top + GAP } : { top: anchor.bottom + GAP }),
      visibility: 'visible',
    });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) { setStyle({ visibility: 'hidden' }); return; }
    place();
    const first = menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
    first?.focus({ preventScroll: true });
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!anchorRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, place]);

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <span className="menu-wrap" ref={anchorRef}>
      {trigger(() => setOpen((o) => !o), open)}
      {open && createPortal(
        <div ref={menuRef} className={`menu ${className}`} role="menu" style={style} onKeyDown={onMenuKey}>
          {children(close)}
        </div>,
        document.body,
      )}
    </span>
  );
}
