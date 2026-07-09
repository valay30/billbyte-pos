import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../contexts/AuthContext';

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/pos': 'Point of Sale',
  '/tables': 'Table Management',
  '/kitchen': 'Kitchen Display System',
  '/orders': 'Order Management',
  '/menu': 'Menu Manager',
  '/inventory': 'Inventory Management',
  '/crm': 'CRM & Loyalty',
  '/reports': 'Reports & Analytics',
  '/settings': 'Settings',
};

const getTime = () => new Date().toLocaleString('en-IN', {
  weekday: 'short', day: '2-digit', month: 'short',
  hour: '2-digit', minute: '2-digit', hour12: true
});

export default function Layout() {
  const location = useLocation();
  const { user } = useAuth();
  const [time, setTime] = React.useState(getTime());
  const [theme, setTheme] = React.useState(() => localStorage.getItem('savoria_theme') || 'light');
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    const interval = setInterval(() => setTime(getTime()), 30000);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('savoria_theme', theme);
  }, [theme]);

  // Close sidebar on route change (mobile)
  React.useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when sidebar overlay is open on mobile
  React.useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');
  const closeSidebar = () => setSidebarOpen(false);

  const title = PAGE_TITLES[location.pathname] || 'BillByte POS';

  return (
    <div className="app-layout">
      {/* Sidebar overlay backdrop (mobile) */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <Sidebar open={sidebarOpen} onClose={closeSidebar} />

      <div className="main-content">
        <header className="topbar">
          {/* Hamburger — only visible on mobile/tablet via CSS */}
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(prev => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>

          <h1 className="topbar-title">{title}</h1>

          <div className="topbar-actions">
            <button
              className="topbar-theme"
              onClick={toggleTheme}
              style={{
                padding: '6px 14px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Toggle Light/Dark Theme"
            >
              {theme === 'light' ? '🌙' : '☀️'}
              <span className="theme-label">
                {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              </span>
            </button>

            <span
              className="topbar-clock"
              style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
            >
              {time}
            </span>

            <div
              className="topbar-online"
              style={{
                padding: '5px 12px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap'
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
              Online
            </div>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
