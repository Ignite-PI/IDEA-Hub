import { Copy, ExternalLink } from 'lucide-react';
import { copyText, resolveLink } from '../utils/links';
import { useToast } from './Toast';

/** Opens a free-text project link when possible; always allows copying it. */
export function useLinkActions() {
  const toast = useToast();
  const copy = async (link: string) => {
    await copyText(link);
    toast('Project link copied to clipboard');
  };
  const open = async (link: string) => {
    const { href, kind } = resolveLink(link);
    if (!href) return copy(link);
    if (kind === 'network') {
      await copyText(link);
      toast('Network path copied — browsers may block file links, so paste it into File Explorer if it does not open');
    }
    window.open(href, '_blank', 'noopener');
  };
  return { open, copy };
}

export function LinkIconButtons({ link }: { link: string }) {
  const { open, copy } = useLinkActions();
  if (!link.trim()) return <span className="empty-dash">—</span>;
  const { href } = resolveLink(link);
  return (
    <span className="row" style={{ gap: 4 }} onClick={(e) => e.stopPropagation()}>
      {href && (
        <button className="btn btn-ghost btn-icon" title={`Open: ${link}`} onClick={() => open(link)}>
          <ExternalLink size={16} />
        </button>
      )}
      <button className="btn btn-ghost btn-icon" title={`Copy: ${link}`} onClick={() => copy(link)}>
        <Copy size={15} />
      </button>
    </span>
  );
}
