import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ArcElement, BarElement);

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#8B93B8', font: { size: 12 } } } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8B93B8' } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8B93B8' } }
  }
};

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/reports/dashboard');
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
      <div className="loading-spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  const stats = [
    { label: "Today's Revenue", value: formatCurrency(data?.today_revenue), icon: '💰', color: 'orange', sub: `${data?.today_orders} orders` },
    { label: 'Active Orders', value: data?.active_orders, icon: '📋', color: 'blue', sub: 'In progress' },
    { label: 'Tables Occupied', value: `${data?.active_tables}/${data?.total_tables}`, icon: '🪑', color: 'red', sub: 'Dine-in' },
    { label: 'Pending KOTs', value: data?.pending_kots, icon: '👨‍🍳', color: 'purple', sub: 'Kitchen queue' },
    { label: 'Low Stock Items', value: data?.low_stock_count, icon: '⚠️', color: 'red', sub: 'Needs restock' },
  ];

  const revenueChart = {
    labels: (data?.daily_revenue || []).map(d => d.day?.slice(5)),
    datasets: [{
      label: 'Revenue (₹)',
      data: (data?.daily_revenue || []).map(d => d.revenue),
      borderColor: '#FF6B35',
      backgroundColor: 'rgba(255,107,53,0.1)',
      tension: 0.4, fill: true,
      pointBackgroundColor: '#FF6B35',
      pointRadius: 4,
    }]
  };

  const paymentChart = {
    labels: (data?.payment_breakdown || []).map(p => p.payment_method?.replace('_', ' ').toUpperCase()),
    datasets: [{
      data: (data?.payment_breakdown || []).map(p => p.total),
      backgroundColor: ['#FF6B35', '#00D4AA', '#3B82F6', '#F59E0B', '#EF4444'],
      borderWidth: 0,
    }]
  };

  return (
    <div>
      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/pos')} className="btn btn-primary">
          🧾 New Order
        </button>
        <button onClick={() => navigate('/tables')} className="btn btn-secondary">
          🪑 Tables
        </button>
        <button onClick={() => navigate('/kitchen')} className="btn btn-secondary">
          👨‍🍳 Kitchen Display
        </button>
        <button onClick={() => navigate('/orders')} className="btn btn-secondary">
          📋 View Orders
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        {stats.map((stat, i) => (
          <div key={i} className="stat-card">
            <div className={`stat-icon ${stat.color}`}>{stat.icon}</div>
            <div className="stat-info">
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value">{stat.value ?? 0}</div>
              <div className="stat-change" style={{ color: 'var(--text-muted)' }}>{stat.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
        {/* Revenue Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Revenue — Last 7 Days</span>
          </div>
          <div style={{ height: 220 }}>
            <Line data={revenueChart} options={{ ...chartDefaults, plugins: { ...chartDefaults.plugins, legend: { display: false } } }} />
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Payment Methods (Today)</span>
          </div>
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(data?.payment_breakdown || []).length === 0 ? (
              <div className="empty-state">
                <div>💳</div>
                <p>No payments today</p>
              </div>
            ) : (
              <Doughnut data={paymentChart} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: '#8B93B8', font: { size: 11 } } } }
              }} />
            )}
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        {/* Top Items */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔥 Top Items Today</span>
          </div>
          {(data?.top_items || []).length === 0 ? (
            <div className="empty-state"><div>🍽️</div><p>No sales yet today</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(data?.top_items || []).map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--primary)', flexShrink: 0 }}>#{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{item.item_name}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item.qty} sold</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{formatCurrency(item.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Status */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">System Status</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'POS System', status: 'Online', ok: true },
              { label: 'Kitchen Display', status: 'Online', ok: true },
              { label: 'QR Ordering', status: 'Active', ok: true },
              { label: 'Database', status: 'Connected', ok: true },
              { label: 'Low Stock Alerts', status: data?.low_stock_count > 0 ? `${data.low_stock_count} items low` : 'All OK', ok: data?.low_stock_count === 0 },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, color: 'var(--text-secondary)' }}>{s.label}</span>
                <span className={`badge ${s.ok ? 'badge-success' : 'badge-warning'}`}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
