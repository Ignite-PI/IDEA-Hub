/**
 * Project links are free text: web URLs, SharePoint, app protocols, UNC/network
 * paths or plain references. We never validate them — we only try to turn them
 * into something a browser can open, and always offer "copy" as a fallback.
 */
export type LinkKind = 'web' | 'app' | 'network' | 'text';

export function resolveLink(raw: string): { href: string | null; kind: LinkKind } {
  const link = raw.trim();
  if (!link) return { href: null, kind: 'text' };
  if (/^https?:\/\//i.test(link)) return { href: link, kind: 'web' };
  if (/^www\./i.test(link)) return { href: `https://${link}`, kind: 'web' };
  if (/^\\\\[^\\]+\\/.test(link)) return { href: `file:${link.replace(/\\/g, '/')}`, kind: 'network' };
  if (/^[a-z]:\\/i.test(link)) return { href: `file:///${link.replace(/\\/g, '/')}`, kind: 'network' };
  if (/^[a-z][a-z0-9+.-]*:/i.test(link)) return { href: link, kind: 'app' };
  return { href: null, kind: 'text' };
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  el.remove();
}
