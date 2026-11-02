import { useNavigate } from 'react-router-dom';
import { LayoutList, Table2 } from 'lucide-react';

/** Switch between the record (dashboard) view and the grid view of Manager Input. Filters live in context, so they carry over. */
export function ViewToggle({ current }: { current: 'dashboard' | 'grid' }) {
  const navigate = useNavigate();
  return (
    <div className="view-toggle" role="group" aria-label="Manager Input view">
      <button type="button" className={current === 'dashboard' ? 'on' : ''} aria-pressed={current === 'dashboard'} onClick={() => navigate('/managers/input')}><LayoutList size={15} /> Dashboard View</button>
      <button type="button" className={current === 'grid' ? 'on' : ''} aria-pressed={current === 'grid'} onClick={() => navigate('/managers/grid')}><Table2 size={15} /> Grid View</button>
    </div>
  );
}
