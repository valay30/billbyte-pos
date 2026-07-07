import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useToast } from '../../contexts/ToastContext';

export default function Settings() {
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get('/menu/settings').then(res => {
      setSettings(res.data);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load settings:', err);
      toast.error('Failed to load settings');
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/menu/settings', settings);
      toast.success('Settings saved!');
    } catch {
      toast.error('Failed to save');
    } finally { setSaving(false); }
  };

  const field = (key, label, type = 'text') => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input type={type} className="form-control" value={settings[key] || ''} onChange={e => setSettings(s => ({ ...s, [key]: e.target.value }))} />
    </div>
  );

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="loading-spinner" /></div>;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 20 }}>🏪 Restaurant Information</div>
        <div className="grid-2">
          {field('restaurant_name', 'Restaurant Name')}
          {field('restaurant_phone', 'Phone Number', 'tel')}
          {field('restaurant_email', 'Email', 'email')}
          {field('restaurant_gstin', 'GSTIN Number')}
        </div>
        <div className="form-group" style={{ marginTop: 14 }}>
          <label className="form-label">Address</label>
          <textarea className="form-control" value={settings.restaurant_address || ''} onChange={e => setSettings(s => ({ ...s, restaurant_address: e.target.value }))} rows={2} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 20 }}>💰 Tax & Billing</div>
        <div className="grid-2">
          {field('cgst_rate', 'CGST Rate (%)', 'number')}
          {field('sgst_rate', 'SGST Rate (%)', 'number')}
        </div>
        <div className="form-group" style={{ marginTop: 14 }}>
          <label className="form-label">Receipt Footer Message</label>
          <textarea className="form-control" value={settings.receipt_footer || ''} onChange={e => setSettings(s => ({ ...s, receipt_footer: e.target.value }))} rows={2} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 20 }}>🎁 Loyalty Program</div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Points Earned per ₹1 Spent</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="form-control"
              value={settings.loyalty_points_per_rupee || '0.1'}
              onChange={e => setSettings(s => ({ ...s, loyalty_points_per_rupee: e.target.value }))}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              e.g. 0.1 → ₹1000 bill = 100 pts &nbsp;|&nbsp; 0.5 → ₹1000 bill = 500 pts &nbsp;|&nbsp; 1 → ₹1000 bill = 1000 pts
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">₹ Value per 100 Points</label>
            <input
              type="number"
              step="1"
              min="0"
              className="form-control"
              value={settings.loyalty_redemption_ratio || '100'}
              onChange={e => setSettings(s => ({ ...s, loyalty_redemption_ratio: e.target.value }))}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              e.g. 100 → 100 pts = ₹100 &nbsp;|&nbsp; 50 → 100 pts = ₹50 &nbsp;|&nbsp; 10 → 100 pts = ₹10
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 20 }}>📱 QR Ordering</div>
        {field('table_qr_base_url', 'QR Base URL (e.g. https://yourdomain.com/menu)')}
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Full URL will be: {settings.table_qr_base_url}/{'{'} table_id {'}'}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-title" style={{ marginBottom: 20 }}>⚠️ Inventory Alerts</div>
        {field('low_stock_threshold', 'Low Stock Threshold (units)', 'number')}
      </div>

      <button className="btn btn-primary btn-lg" onClick={save} disabled={saving} style={{ justifyContent: 'center' }}>
        {saving ? <span className="loading-spinner" /> : '💾 Save All Settings'}
      </button>
    </div>
  );
}
