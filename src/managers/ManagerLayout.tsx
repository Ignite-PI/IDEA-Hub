import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, Briefcase, ClipboardList, FolderKanban, LayoutDashboard, LogOut, Menu as MenuIcon, Presentation, Stethoscope, Table2 } from 'lucide-react';
import { useProjects } from '../components/ProjectsContext';
import { BRAND } from '../characters';
import { useAuth } from '../components/Auth';
import { Loading } from '../components/EmptyState';
import { useSavings } from './SavingsContext';
import { ExportButton } from './ui';

/** Separate shell for the MANAGERS account (Senior Manager savings module). */
export function ManagerLayout() {
  const { signOut } = useAuth();
  const { loading, error, all } = useSavings();
  const { projects } = useProjects();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
  const incomplete = all.filter((e) => e.incomplete).length;

  return (
    <div className="shell managers">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><img src={BRAND.fire} alt="IGNITE" /></div>
          <div>
            <div className="brand-title">{BRAND.name}</div>
            <div className="brand-sub">Senior Managers · Projects &amp; 30% Savings</div>
          </div>
        </div>
        <div className="nav-label">Clinical Tower Projects</div>
        <NavLink to="/managers/portfolio/all" className="nav-link"><FolderKanban size={18} /> All <span className="count">{projects.length}</span></NavLink>
        <NavLink to="/managers/portfolio/clinical" className="nav-link"><Stethoscope size={18} /> Clinical Functions <span className="count">{projects.filter((p) => p.business_function === 'clinical').length}</span></NavLink>
        <NavLink to="/managers/portfolio/sbf" className="nav-link"><Briefcase size={18} /> Specialized Business Functions <span className="count">{projects.filter((p) => p.business_function === 'sbf').length}</span></NavLink>
        <div className="nav-label">Savings Management</div>
        <NavLink to="/managers" end className="nav-link"><LayoutDashboard size={18} /> Savings Summary</NavLink>
        <NavLink to="/managers/input" className="nav-link"><ClipboardList size={18} /> Manager Input {incomplete > 0 && <span className="count warn" title="Records needing information">{incomplete}</span>}</NavLink>
        <NavLink to="/managers/grid" className="nav-link"><Table2 size={18} /> Grid View</NavLink>
        <NavLink to="/managers/storyboard" className="nav-link"><Presentation size={18} /> Storyboard</NavLink>
        <NavLink to="/managers/instructions" className="nav-link"><BookOpen size={18} /> Instructions</NavLink>
        <div style={{ marginTop: 'auto' }} />
        <button className="nav-link signout-link" onClick={() => void signOut()}><LogOut size={18} /> Sign out</button>
      </aside>
      <div className={`backdrop${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar scrolled">
          <button className="btn btn-secondary btn-icon menu-btn" onClick={() => setOpen(true)} aria-label="Open navigation"><MenuIcon size={18} /></button>
          <div className="mgr-banner"><b>MANAGERS</b> · Clinical Tower Projects &amp; Savings Management</div>
          <div className="topbar-spacer" />
          <ExportButton />
        </header>
        <main className="content">
          {loading ? <Loading label="Loading savings data…" /> : error ? <div className="card card-pad" role="alert">{error}</div> : <Outlet />}
        </main>
      </div>
    </div>
  );
}
