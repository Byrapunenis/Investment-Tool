import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const canEditProperties = user?.role === 'admin' || !!user?.can_edit_properties;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Real Estate Optimizer</h1>
        <nav>
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Dashboard
          </NavLink>
          <NavLink to="/properties" className={({ isActive }) => (isActive ? 'active' : '')}>
            Properties
          </NavLink>
          <NavLink to="/cash-flow" className={({ isActive }) => (isActive ? 'active' : '')}>
            Cash Flow
          </NavLink>
          {canEditProperties && (
            <NavLink to="/properties/new" className={({ isActive }) => (isActive ? 'active' : '')}>
              Add Property
            </NavLink>
          )}
          {user && !user.workspace.is_personal && user.role === 'admin' && (
            <NavLink to="/team" className={({ isActive }) => (isActive ? 'active' : '')}>
              Team
            </NavLink>
          )}
        </nav>

        {user && (
          <div className="sidebar-account">
            <div className="sidebar-account-email">{user.email}</div>
            <div className="sidebar-account-workspace">
              {user.workspace.is_personal ? 'Personal' : user.workspace.name}
            </div>
            {!user.workspace.is_personal && (
              <div className="sidebar-account-workspace">
                {user.role === 'admin' ? 'Admin' : canEditProperties ? 'Member · can edit' : 'Member · view only'}
              </div>
            )}
            {!user.workspace.is_personal && (
              <div className="sidebar-account-invite">
                Invite code: <code>{user.workspace.invite_code}</code>
              </div>
            )}
            <button className="btn secondary" onClick={handleLogout}>
              Log Out
            </button>
          </div>
        )}
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
