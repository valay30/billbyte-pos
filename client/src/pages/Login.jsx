import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api, { getTenantSlug } from '../utils/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [devSlug, setDevSlug] = useState(localStorage.getItem('billbyte_tenant_slug') || 'demo');
  const { login, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('onrender.com');

  useEffect(() => {
    fetchTenantInfo();
  }, [devSlug]);

  const fetchTenantInfo = async () => {
    try {
      const res = await api.get('/tenant-info');
      setTenantInfo(res.data);
    } catch (err) {
      setTenantInfo(null);
    }
  };

  const handleDevSlugChange = (slug) => {
    setDevSlug(slug);
    localStorage.setItem('billbyte_tenant_slug', slug);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantInfo) return toast.error('Restaurant not found. Check the URL or Restaurant Code.');
    const result = await login(email, password);
    if (result.success) {
      toast.success(`Welcome to ${tenantInfo.name}!`);
      navigate('/dashboard');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, position: 'relative', overflow: 'hidden'
    }}>
      <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50vw', height: '50vh', background: 'radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-10%', right: '-10%', width: '40vw', height: '40vh', background: 'radial-gradient(circle, rgba(0,212,170,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, boxShadow: '0 8px 40px rgba(255,107,53,0.3)'
          }}>🍽️</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>BillByte POS</h1>

          {/* Restaurant name from subdomain */}
          {tenantInfo ? (
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)',
              borderRadius: 20, padding: '4px 14px' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00D4AA', display: 'inline-block' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#00D4AA' }}>{tenantInfo.name}</span>
            </div>
          ) : (
            <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 20, padding: '4px 14px' }}>
              <span style={{ fontSize: 13, color: '#EF4444' }}>⚠ Restaurant not found</span>
            </div>
          )}
        </div>

        {/* Dev-mode tenant switcher */}
        {isLocalDev && (
          <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              🔧 Dev Mode — Restaurant Code
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-control"
                style={{ fontSize: 12, flex: 1 }}
                value={devSlug}
                onChange={e => handleDevSlugChange(e.target.value)}
                placeholder="e.g. demo, caferoy"
              />
              <button className="btn btn-secondary btn-sm" onClick={fetchTenantInfo}>Apply</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              In production, this auto-detects from subdomain (e.g. caferoy.billbyte.com)
            </div>
          </div>
        )}

        {/* Login Card */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', padding: '32px',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 22, color: 'var(--text-primary)' }}>
            Sign in to continue
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email" className="form-control"
                placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus
              />
            </div>
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                <button type="button" onClick={() => navigate('/forgot-password')} 
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative', marginTop: 8 }}>
                <input
                  type={showPass ? 'text' : 'password'} className="form-control"
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required style={{ paddingRight: 44 }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary btn-lg w-full"
              disabled={loading || !tenantInfo} style={{ marginTop: 4 }}>
              {loading ? <span className="loading-spinner" /> : '→ Sign In'}
            </button>
          </form>
        </div>

        {/* Powered by */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          Powered by <span style={{ fontWeight: 700, color: 'var(--primary)' }}>BillByte POS</span>
        </div>
      </div>
    </div>
  );
}
