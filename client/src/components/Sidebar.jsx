import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const NAV = [
  {
    section: 'Operations',
    items: [
      { to: '/dashboard', icon: '📊', label: 'Dashboard' },
      { to: '/pos', icon: '🧾', label: 'POS / Billing', roles: ['admin', 'manager', 'cashier', 'waiter'] },
      { to: '/tables', icon: '🪑', label: 'Tables', roles: ['admin', 'manager', 'cashier', 'waiter'] },
      { to: '/kitchen', icon: '👨‍🍳', label: 'Kitchen (KDS)', roles: ['admin', 'manager', 'kitchen', 'waiter'] },
      { to: '/orders', icon: '📋', label: 'Orders', roles: ['admin', 'manager', 'cashier', 'waiter'] },
    ]
  },
  {
    section: 'Management',
    items: [
      { to: '/menu', icon: '🍽️', label: 'Menu Manager', roles: ['admin', 'manager'] },
      { to: '/inventory', icon: '📦', label: 'Inventory', roles: ['admin', 'manager'] },
      { to: '/crm', icon: '👥', label: 'CRM & Loyalty', roles: ['admin', 'manager'] },
      { to: '/reports', icon: '📈', label: 'Reports', roles: ['admin', 'manager'] },
    ]
  },
  {
    section: 'Settings',
    items: [
      { to: '/settings', icon: '⚙️', label: 'Settings', roles: ['admin'] },
    ]
  }
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const canSee = (roles) => !roles || roles.includes(user?.role);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🍽️</div>
        <div className="sidebar-logo-text">
          <strong>BillByte POS</strong>
          <span>Restaurant System</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(section => (
          <div key={section.section}>
            <div className="sidebar-section-title">{section.section}</div>
            {section.items.filter(item => canSee(item.roles)).map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: 'white'
          }}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          className="btn btn-secondary btn-sm w-full"
          style={{ justifyContent: 'center' }}
        >
          🚪 Logout
        </button>
      </div>
    </aside>
  );
}
