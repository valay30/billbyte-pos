import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [slug, setSlug] = useState(localStorage.getItem('billbyte_tenant_slug') || '');
  const { login, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!slug.trim()) return toast.error('Please enter your Restaurant Code.');

    // Pass the slug explicitly to the login function to ensure it doesn't rely on cached localStorage state
    const result = await login(slug.trim(), email.trim(), password);
    if (result.success) {
      toast.success('Login successful!');
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
                  required
                />
              </div>
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
              disabled={loading} style={{ marginTop: 4 }}>
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
