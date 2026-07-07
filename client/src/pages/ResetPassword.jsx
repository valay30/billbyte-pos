import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import api from '../utils/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const tenant = searchParams.get('tenant');
  
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [validating, setValidating] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || !tenant) {
      setValidating(false);
      setValidToken(false);
      return;
    }

    const validateToken = async () => {
      try {
        const res = await api.get(`/auth/reset-password/validate?token=${token}&tenant=${tenant}`);
        if (res.data.valid) {
          setValidToken(true);
          setUserEmail(res.data.email);
        } else {
          setValidToken(false);
        }
      } catch (err) {
        setValidToken(false);
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token, tenant]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, tenant, new_password: password });
      toast.success('Password has been reset successfully!');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, boxShadow: '0 8px 40px rgba(255,107,53,0.3)'
          }}>🔑</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>Set New Password</h1>
        </div>

        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)', padding: '32px',
          boxShadow: 'var(--shadow-lg)'
        }}>
          {validating ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <span className="loading-spinner" style={{ width: 32, height: 32, borderTopColor: 'var(--primary)', marginBottom: 16 }} />
              <p style={{ color: 'var(--text-muted)' }}>Validating secure link...</p>
            </div>
          ) : !validToken ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Link Expired</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
                This password reset link is invalid or has expired. For your security, reset links are only valid for 1 hour.
              </p>
              <button className="btn btn-primary w-full" onClick={() => navigate('/forgot-password')}>
                Request New Link
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: 'rgba(0,212,170,0.1)', border: '1px solid rgba(0,212,170,0.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 8 }}>
                <p style={{ margin: 0, fontSize: 13, color: '#00D4AA', textAlign: 'center' }}>
                  Resetting password for <strong>{userEmail}</strong>
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'} className="form-control"
                    placeholder="••••••••"
                    value={password} onChange={e => setPassword(e.target.value)}
                    required style={{ paddingRight: 44 }} minLength={6} autoFocus
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                  Must be at least 6 characters long.
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading} style={{ marginTop: 8 }}>
                {loading ? <span className="loading-spinner" /> : 'Save Password & Login'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
