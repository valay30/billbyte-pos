import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatCurrency, formatDate, getLoyaltyTierColor, formatDateTime } from '../../utils/helpers';
import { useToast } from '../../contexts/ToastContext';

const TIER_ICONS = { bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎' };

export default function CRM() {
  const [customers, setCustomers] = useState([]);
  const [activeTab, setActiveTab] = useState('customers');
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const [loyaltyStats, setLoyaltyStats] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '', birthday: '', anniversary: '', notes: '' });
  const [editCustomer, setEditCustomer] = useState(null);
  const toast = useToast();

  useEffect(() => { fetchData(); }, [search, tierFilter]);

  const fetchData = async () => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (tierFilter !== 'all') params.append('tier', tierFilter);
    const [custRes, fbRes, statsRes] = await Promise.all([
      api.get(`/crm?${params}`),
      api.get('/crm/feedback/all'),
      api.get('/crm/loyalty/stats'),
    ]);
    setCustomers(custRes.data);
    setFeedback(fbRes.data);
    setLoyaltyStats(statsRes.data);
  };

  const viewCustomer = async (id) => {
    const res = await api.get(`/crm/${id}`);
    setSelectedCustomer(res.data);
  };

  const saveCustomer = async () => {
    try {
      if (editCustomer) {
        await api.put(`/crm/${editCustomer.id}`, form);
        toast.success('Customer updated!');
      } else {
        await api.post('/crm', form);
        toast.success('Customer added!');
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const openAdd = () => {
    setEditCustomer(null);
    setForm({ name: '', phone: '', email: '', address: '', birthday: '', anniversary: '', notes: '' });
    setShowModal(true);
  };

  const avgRating = feedback.length > 0 ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1) : '-';

  return (
    <div>
      <div className="tab-bar" style={{ marginBottom: 20, maxWidth: 600 }}>
        {[['customers', `Customers (${customers.length})`], ['loyalty', 'Loyalty Stats'], ['feedback', 'Feedback']].map(([val, label]) => (
          <button key={val} className={`tab-btn ${activeTab === val ? 'active' : ''}`} onClick={() => setActiveTab(val)}>{label}</button>
        ))}
      </div>

      {activeTab === 'customers' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="form-control" placeholder="🔍 Search name, phone, email..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'bronze', 'silver', 'gold', 'platinum'].map(tier => (
                <button key={tier} className={`btn btn-sm ${tierFilter === tier ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTierFilter(tier)} style={{ textTransform: 'capitalize' }}>
                  {tier !== 'all' && TIER_ICONS[tier]} {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={openAdd} style={{ marginLeft: 'auto' }}>+ Add Customer</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedCustomer ? '1fr 380px' : '1fr', gap: 16 }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="data-table">
                <thead>
                  <tr><th>Customer</th><th>Phone</th><th>Tier</th><th>Points</th><th>Visits</th><th>Total Spent</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} onClick={() => viewCustomer(c.id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        {c.email && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.email}</div>}
                      </td>
                      <td style={{ fontSize: 13 }}>{c.phone}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: getLoyaltyTierColor(c.loyalty_tier) }}>
                          {TIER_ICONS[c.loyalty_tier]} {c.loyalty_tier?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{c.loyalty_points} pts</td>
                      <td>{c.total_visits}</td>
                      <td style={{ fontWeight: 700 }}>{formatCurrency(c.total_spent)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); viewCustomer(c.id); }}>View</button>
                          <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); setEditCustomer(c); setForm({ ...c }); setShowModal(true); }}>Edit</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {customers.length === 0 && <div className="empty-state"><div>👥</div><p>No customers found</p></div>}
            </div>

            {selectedCustomer && (
              <div className="card" style={{ position: 'sticky', top: 80, maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{selectedCustomer.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{selectedCustomer.phone}</div>
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCustomer(null)}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  {[
                    ['Points', selectedCustomer.loyalty_points, 'var(--accent)'],
                    ['Visits', selectedCustomer.total_visits, 'var(--info)'],
                    ['Spent', formatCurrency(selectedCustomer.total_spent), 'var(--success)'],
                  ].map(([label, val, color]) => (
                    <div key={label} style={{ flex: 1, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: getLoyaltyTierColor(selectedCustomer.loyalty_tier) }}>
                    {TIER_ICONS[selectedCustomer.loyalty_tier]} {selectedCustomer.loyalty_tier?.toUpperCase()} Member
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    {selectedCustomer.loyalty_tier === 'bronze' && 'Spend ₹3,000+ to reach Silver'}
                    {selectedCustomer.loyalty_tier === 'silver' && 'Spend ₹10,000+ to reach Gold'}
                    {selectedCustomer.loyalty_tier === 'gold' && 'Spend ₹25,000+ to reach Platinum'}
                    {selectedCustomer.loyalty_tier === 'platinum' && '⭐ Top tier — Thank you!'}
                  </div>
                </div>

                <div className="divider" />

                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Recent Orders</div>
                  {(selectedCustomer.orders || []).length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No orders yet</p> : (
                    (selectedCustomer.orders || []).map(o => (
                      <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: 'var(--primary)' }}>{o.order_number}</span>
                        <span style={{ fontWeight: 700 }}>{formatCurrency(o.total)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="divider" />

                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>Points History</div>
                  {(selectedCustomer.loyalty_history || []).slice(0, 5).map(tx => (
                    <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{tx.description}</span>
                      <span style={{ fontWeight: 700, color: tx.points > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {tx.points > 0 ? '+' : ''}{tx.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'loyalty' && loyaltyStats && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            {(loyaltyStats.tiers || []).map(tier => (
              <div key={tier.loyalty_tier} className="card" style={{ borderTop: `3px solid ${getLoyaltyTierColor(tier.loyalty_tier)}`, textAlign: 'center' }}>
                <div style={{ fontSize: 28 }}>{TIER_ICONS[tier.loyalty_tier]}</div>
                <div style={{ fontSize: 16, fontWeight: 800, textTransform: 'capitalize', color: getLoyaltyTierColor(tier.loyalty_tier) }}>{tier.loyalty_tier}</div>
                <div style={{ fontSize: 24, fontWeight: 900, marginTop: 4 }}>{tier.count}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>customers</div>
                <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 8, fontWeight: 700 }}>{tier.total_points?.toFixed(0)} total pts</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">🏆 Top Spenders</span></div>
            <table className="data-table">
              <thead><tr><th>Rank</th><th>Customer</th><th>Tier</th><th>Visits</th><th>Total Spent</th><th>Points</th></tr></thead>
              <tbody>
                {(loyaltyStats.top_customers || []).map((c, i) => (
                  <tr key={c.name}>
                    <td style={{ fontWeight: 800, color: i === 0 ? '#FFD700' : i === 1 ? '#C0C0C0' : i === 2 ? '#CD7F32' : 'var(--text-muted)' }}>#{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{c.name}<div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{c.phone}</div></td>
                    <td><span style={{ color: getLoyaltyTierColor(c.loyalty_tier), fontWeight: 700 }}>{TIER_ICONS[c.loyalty_tier]} {c.loyalty_tier}</span></td>
                    <td>{c.total_visits}</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(c.total_spent)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{c.loyalty_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'feedback' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              ['Total Reviews', feedback.length, '⭐'],
              ['Avg Rating', avgRating, '📊'],
              ['This Month', feedback.filter(f => new Date(f.created_at) > new Date(Date.now() - 30 * 86400000)).length, '📅'],
            ].map(([label, val, icon]) => (
              <div key={label} className="stat-card">
                <div className="stat-icon orange">{icon}</div>
                <div className="stat-info"><div className="stat-label">{label}</div><div className="stat-value">{val}</div></div>
              </div>
            ))}
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead><tr><th>Customer</th><th>Order</th><th>Rating</th><th>Food</th><th>Service</th><th>Comment</th><th>Date</th></tr></thead>
              <tbody>
                {feedback.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.customer_name || 'Anonymous'}</td>
                    <td style={{ color: 'var(--primary)' }}>{f.order_number || '-'}</td>
                    <td>{'⭐'.repeat(f.rating || 0)}</td>
                    <td>{f.food_rating}/5</td>
                    <td>{f.service_rating}/5</td>
                    <td style={{ maxWidth: 200, fontSize: 12, color: 'var(--text-secondary)' }}>{f.comment || '-'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(f.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {feedback.length === 0 && <div className="empty-state"><div>⭐</div><p>No feedback yet</p></div>}
          </div>
        </div>
      )}

      {/* Customer Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editCustomer ? 'Edit Customer' : 'Add Customer'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Full Name</label>
                <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="form-control" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Birthday</label>
                <input type="date" className="form-control" value={form.birthday || ''} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Anniversary</label>
                <input type="date" className="form-control" value={form.anniversary || ''} onChange={e => setForm(f => ({ ...f, anniversary: e.target.value }))} />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Notes</label>
                <textarea className="form-control" value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveCustomer}>{editCustomer ? 'Update' : 'Add Customer'}</button>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
