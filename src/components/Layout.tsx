import { useEffect, useState, type FormEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, FileText, FolderKanban, LayoutDashboard, LogOut, Menu as MenuIcon, Plus, Search, UserRound } from 'lucide-react';
import { getUserName, setUserName } from '../api';
import { BRAND, CHARACTERS } from '../characters';
import { useAuth } from './Auth';
import { Menu } from './Menu';
import { useProjects } from './ProjectsContext';

export function Layout() {
  const { projects } = useProjects();
  const { state, signOut } = useAuth();
  const account = state.status === 'signed-in' ? state.username : '';
  const [user, setUser] = useState(getUserName());
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setOpen(false); window.scrollTo(0, 0); }, [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const search = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/projects${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`);
    setQ('');
  };

  const chartersStarted = projects.filter((p) => p.charter_status !== 'Not Started').length;

  return (
    <div className="shell">
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><img src={BRAND.fire} alt="IGNITE" /></div>
          <div>
            <div className="brand-title">{BRAND.name}</div>
            <div className="brand-sub">Payment Integrity · IGNITE</div>
          </div>
        </div>
        <div className="nav-label">Workspace</div>
        <NavLink to="/" end className="nav-link"><LayoutDashboard size={18} /> Dashboard</NavLink>
        <NavLink to="/projects" className="nav-link">
          <FolderKanban size={18} /> All Projects <span className="count">{projects.length}</span>
        </NavLink>
        <NavLink to="/new" className="nav-link"><Plus size={18} /> Add Project / Idea</NavLink>
        <NavLink to="/charters" className="nav-link">
          <FileText size={18} /> Project Charters <span className="count">{chartersStarted}</span>
        </NavLink>
        <div className="sidebar-foot">
          <strong>Got an idea?</strong>
          <p>Capture it in seconds and grow it into a project.</p>
          <img src={CHARACTERS.corix} alt="" />
        </div>
        <button className="nav-link signout-link" onClick={() => void signOut()}><LogOut size={18} /> Sign out</button>
      </aside>
      <div className={`backdrop${open ? ' open' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className={`topbar${scrolled ? ' scrolled' : ''}`}>
          <button className="btn btn-secondary btn-icon menu-btn" onClick={() => setOpen(true)} aria-label="Open navigation">
            <MenuIcon size={18} />
          </button>
          <form className="topbar-search" onSubmit={search}>
            <Search size={16} />
            <input className="input" placeholder="Search projects, owners, areas…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <div className="topbar-spacer" />
          <Menu
            align="end"
            trigger={(toggle, isOpen) => (
              <button className="btn btn-ghost btn-sm user-chip" onClick={toggle} aria-haspopup="menu" aria-expanded={isOpen} title="Account">
                <UserRound size={15} /> {user ? `${user} · ${account}` : account} <ChevronDown size={13} />
              </button>
            )}
          >
            {(close) => (
              <>
                <div className="menu-label">Signed in as {account}</div>
                <button onClick={() => {
                  close();
                  const name = window.prompt('Optional display name (recorded with project status changes):', user);
                  if (name !== null) { setUserName(name); setUser(name.trim()); }
                }}><UserRound size={15} /> {user ? 'Change display name' : 'Set display name'}</button>
                <button onClick={() => { close(); void signOut(); }}><LogOut size={15} /> Sign out</button>
              </>
            )}
          </Menu>
          <button className="btn btn-primary" onClick={() => navigate('/new')}><Plus size={16} /> New Project / Idea</button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
