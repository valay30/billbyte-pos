import React, { useState, useEffect, useCallback } from 'react';
import api from '../../utils/api';
import socket, { playChime } from '../../utils/socket';
import { useToast } from '../../contexts/ToastContext';
import { getMinutesSince } from '../../utils/helpers';
import { printContent, generateKOTHTML } from '../../utils/helpers';

const STATIONS = ['All', 'kitchen', 'bar', 'cold'];

export default function Kitchen() {
  const [kots, setKots] = useState([]);
  const [station, setStation] = useState('All');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    fetchKots();
    socket.emit('join_kitchen');
    const interval = setInterval(fetchKots, 30000);

    const handleNewKot = () => {
      fetchKots();
      playChime();
      toast.success('🔔 New KOT arrived in Kitchen!');
    };

    const handleUpdate = () => {
      fetchKots();
    };

    socket.on('new_order', handleNewKot);
    socket.on('order_updated', handleNewKot);
    socket.on('qr_order', handleNewKot);
    socket.on('kot_updated', handleUpdate);
    socket.on('order_status_changed', handleUpdate);
    socket.on('order_paid', handleUpdate);

    return () => {
      clearInterval(interval);
      socket.off('new_order', handleNewKot);
      socket.off('order_updated', handleNewKot);
      socket.off('qr_order', handleNewKot);
      socket.off('kot_updated', handleUpdate);
      socket.off('order_status_changed', handleUpdate);
      socket.off('order_paid', handleUpdate);
    };
  }, [station, statusFilter]);

  const fetchKots = async () => {
    try {
      const params = new URLSearchParams();
      if (station !== 'All') params.append('station', station);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await api.get(`/orders/kot/all?${params}`);
      setKots(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const updateItemStatus = async (kotId, itemId, status) => {
    try {
      const res = await api.patch(`/orders/kot/${kotId}/items/${itemId}`, { status });
      if (res.data.kot_completed) toast.success('KOT Completed! Order ready.');
      fetchKots();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const markAllReady = async (kotId, items) => {
    for (const item of items) {
      if (item.status !== 'ready') {
        await api.patch(`/orders/kot/${kotId}/items/${item.id}`, { status: 'ready' });
      }
    }
    toast.success('All items marked ready!');
    fetchKots();
  };

  const getTimerClass = (minutes) => {
    if (minutes < 10) return 'fresh';
    if (minutes < 20) return 'medium';
    return 'late';
  };

  const pendingCount = kots.filter(k => k.status === 'pending').length;
  const urgentCount = kots.filter(k => getMinutesSince(k.created_at) >= 20 && k.status === 'pending').length;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
      <div className="loading-spinner" style={{ width: 40, height: 40 }} />
    </div>
  );

  return (
    <div>
      {/* Header Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="stat-card" style={{ padding: '12px 20px', minWidth: 0 }}>
            <div className="stat-icon orange" style={{ width: 40, height: 40, fontSize: 18 }}>🔥</div>
            <div className="stat-info">
              <div className="stat-label">Pending</div>
              <div className="stat-value" style={{ fontSize: 22 }}>{pendingCount}</div>
            </div>
          </div>
          {urgentCount > 0 && (
            <div className="stat-card" style={{ padding: '12px 20px', borderColor: 'var(--danger)', minWidth: 0 }}>
              <div className="stat-icon red" style={{ width: 40, height: 40, fontSize: 18 }}>🚨</div>
              <div className="stat-info">
                <div className="stat-label">Urgent (&gt;20min)</div>
                <div className="stat-value" style={{ fontSize: 22, color: 'var(--danger)' }}>{urgentCount}</div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Station Filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {STATIONS.map(s => (
              <button key={s} className={`btn btn-sm ${station === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStation(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          {/* Status Filter */}
          <div style={{ display: 'flex', gap: 4 }}>
            {[['pending', 'Pending'], ['completed', 'Done'], ['all', 'All']].map(([val, label]) => (
              <button key={val} className={`btn btn-sm ${statusFilter === val ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(val)}>
                {label}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={fetchKots}>↻ Refresh</button>
        </div>
      </div>

      {kots.length === 0 ? (
        <div className="empty-state" style={{ height: 400 }}>
          <div style={{ fontSize: 64 }}>👨‍🍳</div>
          <p style={{ fontSize: 18, fontWeight: 700 }}>Kitchen is clear!</p>
          <p>No {statusFilter !== 'all' ? statusFilter : ''} orders</p>
        </div>
      ) : (
        <div className="kds-grid">
          {kots.map(kot => {
            const minutes = getMinutesSince(kot.created_at);
            const timerClass = getTimerClass(minutes);
            const isUrgent = minutes >= 20 && kot.status === 'pending';
            return (
              <div key={kot.id} className={`kot-card ${isUrgent ? 'urgent' : ''}`}>
                <div className="kot-header">
                  <div>
                    <div className="kot-table">{kot.table_name || 'Takeaway'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {kot.kot_number} • {kot.order_number}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span className={`kot-timer ${timerClass}`}>{minutes}m</span>
                    <span className={`badge ${kot.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>{kot.status}</span>
                  </div>
                </div>

                <div className="kot-items">
                  {(kot.items || []).map(item => (
                    <div key={item.id} className="kot-item">
                      <div className="kot-item-qty">{item.quantity}</div>
                      <div className="kot-item-name">
                        {item.item_name}
                        {item.notes && <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 2 }}>📝 {item.notes}</div>}
                      </div>
                      {item.status !== 'ready' ? (
                        <button
                          className="btn btn-success btn-sm"
                          style={{ fontSize: 11, padding: '3px 8px' }}
                          onClick={() => updateItemStatus(kot.id, item.id, 'ready')}
                        >
                          Ready ✓
                        </button>
                      ) : (
                        <span className="badge badge-success">✓ Done</span>
                      )}
                    </div>
                  ))}
                </div>

                {kot.status !== 'completed' && (
                  <div className="kot-footer">
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, fontSize: 13 }}
                      onClick={() => markAllReady(kot.id, kot.items)}
                    >
                      ✅ Mark All Ready
                    </button>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 13 }}
                      onClick={() => printContent(generateKOTHTML(kot), 'KOT')}
                    >
                      🖨️
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
