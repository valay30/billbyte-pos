import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import api from '../utils/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [tenantInfo, setTenantInfo] = useState(null);
  const [tenantLoading, setTenantLoading] = useState(false);
  const [slug, setSlug] = useState(localStorage.getItem('billbyte_tenant_slug') || '');
  const { login, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  // Auto-fetch tenant info whenever the slug changes (with debounce)
  useEffect(() => {
    if (!slug.trim()) {
      setTenantInfo(null);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      localStorage.setItem('billbyte_tenant_slug', slug.trim());
      fetchTenantInfo();
    }, 500);
    return () => clearTimeout(debounceRef.current);
  }, [slug]);

  // On first load, if we have a saved slug, load tenant info immediately
  useEffect(() => {
    if (slug.trim()) {
      fetchTenantInfo();
    }
  }, []);

  const fetchTenantInfo = async () => {
    setTenantLoading(true);
    try {
      const res = await api.get('/tenant-info');
      setTenantInfo(res.data);
    } catch {
      setTenantInfo(null);
    } finally {
      setTenantLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tenantInfo) return toast.error('Please enter a valid Restaurant Code first.');
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
      {/* Background glows */}
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
          <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>Restaurant Management Platform</p>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', padding: '32px',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 22, color: 'var(--text-primary)' }}>
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Restaurant Code */}
            <div className="form-group">
              <label className="form-label">Restaurant Code</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-control"
                  placeholder="e.g. cafetwo, myrestaurant"
                  value={slug}
                  onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s/g, ''))}
                  autoFocus
                  style={{ paddingRight: 44 }}
                />
                <div style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  fontSize: 16, lineHeight: 1,
                }}>
                  {tenantLoading ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>⏳</span>
                  ) : tenantInfo ? (
                    <span style={{ color: '#00D4AA' }}>✓</span>
                  ) : slug.trim() ? (
                    <span style={{ color: '#EF4444' }}>✗</span>
                  ) : null}
                </div>
              </div>

              {/* Tenant status pill */}
              {tenantInfo ? (
                <div style={{
                  marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)',
                  borderRadius: 20, padding: '4px 12px'
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4AA', display: 'inline-block' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#00D4AA' }}>{tenantInfo.name}</span>
                </div>
              ) : slug.trim() && !tenantLoading ? (
                <div style={{
                  marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 20, padding: '4px 12px'
                }}>
                  <span style={{ fontSize: 12, color: '#EF4444' }}>Restaurant not found — check the code</span>
                </div>
              ) : null}
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                type="email" className="form-control"
                placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password */}
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

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          Powered by <span style={{ fontWeight: 700, color: 'var(--primary)' }}>BillByte POS</span>
        </div>
      </div>
    </div>
  );
}
