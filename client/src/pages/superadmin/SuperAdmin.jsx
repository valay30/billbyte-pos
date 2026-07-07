import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') + '/superadmin';

export default function SuperAdmin() {
  const [key, setKey] = useState(localStorage.getItem('billbyte_sa_key') || '');
  const [authenticated, setAuthenticated] = useState(false);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    slug: '', name: '', admin_name: 'Admin',
    admin_email: '', admin_password: ''
  });

  const headers = { 'x-superadmin-key': key };

  const authenticate = async () => {
    setLoading(true); setError('');
    try {
      await axios.get(`${API}/stats`, { headers });
      localStorage.setItem('billbyte_sa_key', key);
      setAuthenticated(true);
      loadTenants();
    } catch {
      setError('Invalid super admin key');
    } finally { setLoading(false); }
  };

  const loadTenants = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/tenants`, { headers });
      setTenants(res.data);
    } catch (e) { setError(e.response?.data?.error || 'Failed to load'); }
    finally { setLoading(false); }
  };

  const createTenant = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await axios.post(`${API}/tenants`, form, { headers });
      setShowCreate(false);
      setForm({ slug: '', name: '', admin_name: 'Admin', admin_email: '', admin_password: '' });
      loadTenants();
    } catch (e) { setError(e.response?.data?.error || 'Failed to create'); }
    finally { setLoading(false); }
  };

  const toggleStatus = async (slug, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    try {
      await axios.put(`${API}/tenants/${slug}`, { status: newStatus }, { headers });
      loadTenants();
    } catch (e) { setError(e.response?.data?.error || 'Failed'); }
  };

  const deleteTenant = async (slug) => {
    if (!confirm(`Archive "${slug}"? Their data will be preserved but they cannot login.`)) return;
    try {
      await axios.delete(`${API}/tenants/${slug}`, { headers });
      loadTenants();
    } catch (e) { setError(e.response?.data?.error || 'Failed'); }
  };

  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#0A0C14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: '#131620', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 40, width: '100%', maxWidth: 420 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
            <h1 style={{ color: '#F0F2FF', fontSize: 22, fontWeight: 800 }}>BillByte Platform Admin</h1>
            <p style={{ color: '#8B93B8', fontSize: 14, marginTop: 6 }}>Manage all restaurant tenants</p>
          </div>
          {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <input
            type="password" placeholder="Super Admin Key"
            value={key} onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && authenticate()}
            style={{ width: '100%', padding: '12px 16px', background: '#1E2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#F0F2FF', fontSize: 14, marginBottom: 12, boxSizing: 'border-box', outline: 'none' }}
          />
          <button onClick={authenticate} disabled={loading}
            style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg,#FF6B35,#E55A24)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>
            {loading ? 'Verifying...' : '→ Enter Admin Panel'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0C14', padding: '24px', color: '#F0F2FF', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🍽️ BillByte Platform Admin</h1>
          <p style={{ color: '#8B93B8', fontSize: 13, margin: '4px 0 0' }}>Manage all restaurant tenants</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={loadTenants} style={{ padding: '8px 16px', background: '#1E2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#8B93B8', cursor: 'pointer', fontSize: 13 }}>
            🔄 Refresh
          </button>
          <button onClick={() => setShowCreate(true)}
            style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#FF6B35,#E55A24)', border: 'none', borderRadius: 8, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            + Add Restaurant
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Total Restaurants', value: tenants.length, color: '#FF6B35' },
          { label: 'Active', value: tenants.filter(t => t.status === 'active').length, color: '#00D4AA' },
          { label: 'Suspended', value: tenants.filter(t => t.status === 'suspended').length, color: '#EF4444' },
        ].map(s => (
          <div key={s.label} style={{ background: '#131620', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#8B93B8', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: '10px 14px', color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {/* Tenants Table */}
      <div style={{ background: '#131620', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Restaurant', 'Slug / URL', 'Status', 'Orders', 'Users', 'Created', 'Actions'].map(h => (
                <th key={h} style={{ padding: '14px 18px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#8B93B8', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8B93B8' }}>Loading...</td></tr>
            )}
            {!loading && tenants.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#8B93B8' }}>No restaurants yet. Click "+ Add Restaurant" to create one.</td></tr>
            )}
            {tenants.map(t => (
              <tr key={t.slug} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: '#8B93B8', marginTop: 2 }}>{t.admin_email}</div>
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <code style={{ fontSize: 12, background: 'rgba(255,107,53,0.1)', color: '#FF6B35', padding: '2px 8px', borderRadius: 6 }}>{t.slug}</code>
                  <div style={{ fontSize: 11, color: '#8B93B8', marginTop: 4 }}>{t.slug}.billbyte.com</div>
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    background: t.status === 'active' ? 'rgba(0,212,170,0.1)' : 'rgba(239,68,68,0.1)',
                    color: t.status === 'active' ? '#00D4AA' : '#EF4444' }}>
                    {t.status?.toUpperCase()}
                  </span>
                </td>
                <td style={{ padding: '14px 18px', fontSize: 14, fontWeight: 600 }}>{t.total_orders || 0}</td>
                <td style={{ padding: '14px 18px', fontSize: 14 }}>{t.total_users || 0}</td>
                <td style={{ padding: '14px 18px', fontSize: 12, color: '#8B93B8' }}>
                  {t.created_at ? new Date(t.created_at).toLocaleDateString('en-IN') : '-'}
                </td>
                <td style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => toggleStatus(t.slug, t.status)}
                      style={{ padding: '5px 12px', fontSize: 12, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, background: 'transparent', color: t.status === 'active' ? '#EF4444' : '#00D4AA', cursor: 'pointer', fontWeight: 600 }}>
                      {t.status === 'active' ? 'Suspend' : 'Activate'}
                    </button>
                    <button onClick={() => deleteTenant(t.slug)}
                      style={{ padding: '5px 12px', fontSize: 12, border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, background: 'transparent', color: '#EF4444', cursor: 'pointer' }}>
                      Archive
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Tenant Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#131620', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 500 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24 }}>➕ Add New Restaurant</h2>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', padding: '10px 14px', borderRadius: 8, color: '#EF4444', fontSize: 13, marginBottom: 16 }}>{error}</div>}
            <form onSubmit={createTenant} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'name', label: 'Restaurant Name', placeholder: 'Cafe Roy' },
                { key: 'slug', label: 'Subdomain / Code', placeholder: 'caferoy (lowercase, no spaces)' },
                { key: 'admin_name', label: 'Admin Name', placeholder: 'Admin' },
                { key: 'admin_email', label: 'Admin Email', placeholder: 'admin@caferoy.com', type: 'email' },
                { key: 'admin_password', label: 'Admin Password', placeholder: 'Min 8 characters', type: 'password' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#8B93B8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</label>
                  <input
                    type={f.type || 'text'}
                    placeholder={f.placeholder}
                    value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    required
                    style={{ width: '100%', padding: '10px 14px', background: '#1E2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, color: '#F0F2FF', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
                  />
                  {f.key === 'slug' && form.slug && (
                    <div style={{ fontSize: 11, color: '#8B93B8', marginTop: 4 }}>
                      URL: <span style={{ color: '#FF6B35' }}>{form.slug}.billbyte.com</span>
                    </div>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => { setShowCreate(false); setError(''); }}
                  style={{ flex: 1, padding: 12, background: '#1E2235', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, color: '#8B93B8', cursor: 'pointer', fontWeight: 600 }}>
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  style={{ flex: 2, padding: 12, background: 'linear-gradient(135deg,#FF6B35,#E55A24)', border: 'none', borderRadius: 10, color: 'white', fontWeight: 800, cursor: 'pointer' }}>
                  {loading ? 'Creating...' : '✅ Create Restaurant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
