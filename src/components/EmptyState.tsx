import type { ReactNode } from 'react';

export function EmptyState({ image, title, children, action }: { image: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <img src={image} alt="" />
      <div>
        <h3>{title}</h3>
        {children && <p>{children}</p>}
        {action}
      </div>
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading">
      <div className="spinner" />
      {label}
    </div>
  );
}
