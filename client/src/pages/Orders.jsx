import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { formatCurrency, formatDateTime, getStatusBadge, printContent, generateBillHTML } from '../utils/helpers';
import { useToast } from '../contexts/ToastContext';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [settings, setSettings] = useState({});
  const toast = useToast();

  useEffect(() => { fetchOrders(); fetchSettings(); }, [statusFilter, dateFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.append('status', statusFilter);
    if (dateFilter) params.append('date', dateFilter);
    const res = await api.get(`/orders?${params}`);
    setOrders(res.data);
    setLoading(false);
  };

  const fetchSettings = async () => {
    const res = await api.get('/menu/settings');
    setSettings(res.data);
  };

  const viewOrder = async (id) => {
    const res = await api.get(`/orders/${id}`);
    setSelectedOrder(res.data);
  };

  const cancelOrder = async (id) => {
    if (!window.confirm('Cancel this order?')) return;
    await api.patch(`/orders/${id}/status`, { status: 'cancelled' });
    toast.success('Order cancelled');
    fetchOrders();
    if (selectedOrder?.id === id) setSelectedOrder(null);
  };

  const statusMap = { pending: 'Pending', in_progress: 'In Progress', ready: 'Ready', served: 'Served', paid: 'Paid', cancelled: 'Cancelled' };

  return (
    <div>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="date" className="form-control" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ width: 150 }} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[['all', 'All'], ['pending', 'Pending'], ['in_progress', 'In Progress'], ['paid', 'Paid'], ['cancelled', 'Cancelled']].map(([val, label]) => (
            <button key={val} className={`btn btn-sm ${statusFilter === val ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(val)}>{label}</button>
          ))}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchOrders}>↻</button>
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{orders.length} orders</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedOrder ? '1fr 380px' : '1fr', gap: 20 }}>
        {/* Orders List */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="loading-spinner" /></div>
          ) : orders.length === 0 ? (
            <div className="empty-state"><div>📋</div><p>No orders found</p></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Table</th>
                  <th>Customer</th>
                  <th>Type</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} onClick={() => viewOrder(order.id)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{order.order_number}</td>
                    <td>{order.table_name || '-'}</td>
                    <td><span style={{ fontWeight: 600, color: order.customer_name ? 'var(--text-primary)' : 'var(--text-muted)' }}>{order.customer_name || 'Walk-in'}</span></td>
                    <td><span style={{ fontSize: 12, textTransform: 'capitalize' }}>{order.order_type?.replace('_', ' ')}</span></td>
                    <td><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>—</span></td>
                    <td style={{ fontWeight: 700 }}>{formatCurrency(order.total)}</td>
                    <td><span className={`badge ${getStatusBadge(order.status)}`}>{statusMap[order.status] || order.status}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDateTime(order.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); viewOrder(order.id); }}>View</button>
                        {order.status !== 'paid' && order.status !== 'cancelled' && (
                          <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); cancelOrder(order.id); }}>✕</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Order Detail */}
        {selectedOrder && (
          <div className="card" style={{ position: 'sticky', top: 80, maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>{selectedOrder.order_number}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(selectedOrder.created_at)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  printContent(generateBillHTML(selectedOrder, settings), 'Bill');
                }}>🖨️ Print</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedOrder(null)}>✕</button>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              {[
                ['Table', selectedOrder.table_name || '-'],
                ['Waiter', selectedOrder.waiter_name || '-'],
                ['Customer', selectedOrder.customer_name || '-'],
                ['Source', selectedOrder.source || 'pos'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                  <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>

            <div className="divider" />

            <div style={{ marginBottom: 14 }}>
              {(selectedOrder.items || []).map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                  <span>{item.item_name} × {item.quantity}</span>
                  <span style={{ fontWeight: 700 }}>{formatCurrency(item.total_price)}</span>
                </div>
              ))}
            </div>

            <div className="divider" />

            {[
              ['Subtotal', formatCurrency(selectedOrder.subtotal)],
              selectedOrder.discount_amount > 0 && ['Discount', `-${formatCurrency(selectedOrder.discount_amount)}`, 'var(--success)'],
              ['CGST', formatCurrency(selectedOrder.cgst)],
              ['SGST', formatCurrency(selectedOrder.sgst)],
            ].filter(Boolean).map(([k, v, col]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ color: col }}>{v}</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)', color: 'var(--primary)' }}>
              <span>TOTAL</span>
              <span>{formatCurrency(selectedOrder.total)}</span>
            </div>

            {/* Payments */}
            {selectedOrder.payments?.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>Payments</div>
                {selectedOrder.payments.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ textTransform: 'capitalize' }}>{p.payment_method?.replace('_', ' ')}</span>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <span className={`badge ${getStatusBadge(selectedOrder.status)}`} style={{ fontSize: 13, padding: '6px 16px' }}>
                {selectedOrder.status?.toUpperCase()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
