import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, ArcElement, Title, Tooltip, Legend);

const chartOpts = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#8B93B8', font: { size: 11 } } } },
  scales: {
    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8B93B8', font: { size: 11 } } },
    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#8B93B8', font: { size: 11 } } }
  }
};

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales');
  const [sales, setSales] = useState(null);
  const [pnl, setPnl] = useState(null);
  const [staff, setStaff] = useState([]);
  const [customers, setCustomers] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchReports(); }, [from, to]);

  const fetchReports = async () => {
    setLoading(true);
    const p = `from=${from}&to=${to}`;
    const [salesRes, pnlRes, staffRes, custRes, invRes] = await Promise.all([
      api.get(`/reports/sales?${p}`),
      api.get(`/reports/pnl?${p}`),
      api.get(`/reports/staff?${p}`),
      api.get('/reports/customers'),
      api.get('/reports/inventory'),
    ]);
    setSales(salesRes.data);
    setPnl(pnlRes.data);
    setStaff(staffRes.data);
    setCustomers(custRes.data);
    setInventory(invRes.data);
    setLoading(false);
  };

  const revenueChart = sales ? {
    labels: sales.sales.map(s => s.period?.slice(5)),
    datasets: [
      { label: 'Revenue', data: sales.sales.map(s => s.revenue), backgroundColor: 'rgba(255,107,53,0.7)', borderColor: '#FF6B35', borderWidth: 1 },
      { label: 'Orders', data: sales.sales.map(s => s.orders), backgroundColor: 'rgba(0,212,170,0.4)', borderColor: '#00D4AA', borderWidth: 1, type: 'line', yAxisID: 'y1', tension: 0.4 },
    ]
  } : null;

  const catChart = sales ? {
    labels: sales.category_wise?.map(c => c.category),
    datasets: [{ data: sales.category_wise?.map(c => c.revenue), backgroundColor: ['#FF6B35','#00D4AA','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#EC4899','#10B981'], borderWidth: 0 }]
  } : null;

  const tabs = [['sales', 'Sales'], ['pnl', 'P&L'], ['staff', 'Staff'], ['customers', 'Customers'], ['inventory', 'Inventory']];

  return (
    <div>
      {/* Date Range */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <input type="date" className="form-control" value={from} onChange={e => setFrom(e.target.value)} style={{ width: 150 }} />
        <span style={{ color: 'var(--text-muted)' }}>to</span>
        <input type="date" className="form-control" value={to} onChange={e => setTo(e.target.value)} style={{ width: 150 }} />
        <button className="btn btn-secondary btn-sm" onClick={() => { setFrom(new Date().toISOString().slice(0, 10)); setTo(new Date().toISOString().slice(0, 10)); }}>Today</button>
        <button className="btn btn-secondary btn-sm" onClick={() => { setFrom(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)); setTo(new Date().toISOString().slice(0, 10)); }}>7 Days</button>
        <button className="btn btn-secondary btn-sm" onClick={() => { setFrom(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)); setTo(new Date().toISOString().slice(0, 10)); }}>30 Days</button>
        {loading && <div className="loading-spinner" />}
      </div>

      <div className="tab-bar" style={{ marginBottom: 20, maxWidth: 600 }}>
        {tabs.map(([val, label]) => (
          <button key={val} className={`tab-btn ${activeTab === val ? 'active' : ''}`} onClick={() => setActiveTab(val)}>{label}</button>
        ))}
      </div>

      {activeTab === 'sales' && sales && (
        <div>
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              ['Total Revenue', formatCurrency(sales.totals?.revenue), '💰', 'orange'],
              ['Total Orders', sales.totals?.orders, '📋', 'blue'],
              ['Total GST', formatCurrency((sales.totals?.cgst || 0) + (sales.totals?.sgst || 0)), '🏛️', 'purple'],
              ['Discounts Given', formatCurrency(sales.totals?.discount), '🏷️', 'red'],
            ].map(([label, val, icon, color]) => (
              <div key={label} className="stat-card">
                <div className={`stat-icon ${color}`}>{icon}</div>
                <div className="stat-info"><div className="stat-label">{label}</div><div className="stat-value">{val}</div></div>
              </div>
            ))}
          </div>

          <div className="grid-2" style={{ gap: 20, marginBottom: 20 }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Daily Revenue & Orders</div>
              <div style={{ height: 240 }}>
                {revenueChart && <Bar data={revenueChart} options={{ ...chartOpts, scales: { ...chartOpts.scales, y1: { position: 'right', grid: { display: false }, ticks: { color: '#00D4AA', font: { size: 10 } } } } }} />}
              </div>
            </div>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Revenue by Category</div>
              <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {catChart && <Doughnut data={catChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#8B93B8', font: { size: 11 } } } } }} />}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>🔥 Top Selling Items</div>
            <table className="data-table">
              <thead><tr><th>Item</th><th>Category</th><th>Qty Sold</th><th>Revenue</th></tr></thead>
              <tbody>
                {(sales.item_wise || []).map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{item.item_name}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.category || '-'}</td>
                    <td>{item.qty}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(item.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pnl' && pnl && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 20 }}>
            {[
              ['Total Revenue', formatCurrency(pnl.revenue), '💰', 'green'],
              ['GST Collected', formatCurrency(pnl.gst), '🏛️', 'blue'],
              ['Discounts', formatCurrency(pnl.discounts), '🏷️', 'orange'],
              ['Expenses', formatCurrency(pnl.expenses), '💸', 'red'],
              ['Gross Profit', formatCurrency(pnl.gross_profit), '📈', pnl.gross_profit >= 0 ? 'green' : 'red'],
              ['Net Profit', formatCurrency(pnl.net_profit), '🏆', pnl.net_profit >= 0 ? 'green' : 'red'],
            ].map(([label, val, icon, color]) => (
              <div key={label} className="stat-card">
                <div className={`stat-icon ${color}`}>{icon}</div>
                <div className="stat-info">
                  <div className="stat-label">{label}</div>
                  <div className="stat-value" style={{ fontSize: 20 }}>{val}</div>
                </div>
              </div>
            ))}
          </div>

          {pnl.expense_by_category?.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 12 }}>Expenses by Category</div>
              <table className="data-table">
                <thead><tr><th>Category</th><th>Amount</th><th>%</th></tr></thead>
                <tbody>
                  {pnl.expense_by_category.map(e => (
                    <tr key={e.category}>
                      <td>{e.category}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(e.total)}</td>
                      <td>{pnl.expenses > 0 ? ((e.total / pnl.expenses) * 100).toFixed(1) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead><tr><th>Name</th><th>Role</th><th>Orders Handled</th><th>Revenue Generated</th></tr></thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.name}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td style={{ textTransform: 'capitalize' }}><span className="badge badge-info">{s.role}</span></td>
                  <td>{s.orders_handled || 0}</td>
                  <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(s.revenue_generated)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {staff.length === 0 && <div className="empty-state"><div>👷</div><p>No staff data</p></div>}
        </div>
      )}

      {activeTab === 'customers' && customers && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {[['Total Customers', customers.total, '👥', 'blue'], ['New This Month', customers.new_this_month, '🆕', 'green'], ['Avg Tiers', customers.by_tier?.length, '🎖️', 'orange']].map(([l, v, i, c]) => (
              <div key={l} className="stat-card"><div className={`stat-icon ${c}`}>{i}</div><div className="stat-info"><div className="stat-label">{l}</div><div className="stat-value">{v}</div></div></div>
            ))}
          </div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}>Top Spenders</div>
            <table className="data-table">
              <thead><tr><th>Customer</th><th>Phone</th><th>Tier</th><th>Visits</th><th>Total Spent</th><th>Points</th></tr></thead>
              <tbody>
                {(customers.top_spenders || []).map(c => (
                  <tr key={c.name}><td style={{ fontWeight: 600 }}>{c.name}</td><td>{c.phone}</td><td style={{ textTransform: 'capitalize' }}>{c.loyalty_tier}</td><td>{c.total_visits}</td><td style={{ fontWeight: 700 }}>{formatCurrency(c.total_spent)}</td><td style={{ color: 'var(--accent)' }}>{c.loyalty_points}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && inventory && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {[['Total Items', inventory.items?.length, '📦', 'blue'], ['Low Stock', inventory.low_stock?.length, '⚠️', 'red'], ['Stock Value', formatCurrency(inventory.total_value), '💰', 'green']].map(([l, v, i, c]) => (
              <div key={l} className="stat-card"><div className={`stat-icon ${c}`}>{i}</div><div className="stat-info"><div className="stat-label">{l}</div><div className="stat-value">{v}</div></div></div>
            ))}
          </div>
          {inventory.low_stock?.length > 0 && (
            <div className="card" style={{ borderColor: 'var(--danger)', marginBottom: 16 }}>
              <div className="card-title" style={{ marginBottom: 12, color: 'var(--danger)' }}>⚠️ Low Stock Alert</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {inventory.low_stock.map(i => (
                  <div key={i.name} style={{ background: 'var(--danger-bg)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '6px 12px', fontSize: 12 }}>
                    <strong>{i.name}</strong> — {i.current_stock} {i.unit} left (min: {i.min_stock})
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Item</th><th>Stock</th><th>Min</th><th>Unit Cost</th><th>Value</th><th>Status</th></tr></thead>
              <tbody>
                {inventory.items?.map(i => (
                  <tr key={i.name}>
                    <td style={{ fontWeight: 600 }}>{i.name}</td>
                    <td>{i.current_stock} {i.unit}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{i.min_stock} {i.unit}</td>
                    <td>{formatCurrency(i.cost_per_unit)}</td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(i.stock_value)}</td>
                    <td><span className={`badge ${i.is_low ? 'badge-danger' : 'badge-success'}`}>{i.is_low ? 'Low' : 'OK'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
