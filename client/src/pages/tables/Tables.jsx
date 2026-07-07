import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import socket from '../../utils/socket';
import { useToast } from '../../contexts/ToastContext';

const STATUS_COLORS = {
  available: 'var(--success)',
  occupied: 'var(--danger)',
  reserved: 'var(--warning)',
  merged: 'var(--info)',
};

const SECTIONS = ['All', 'Main Hall', 'Outdoor', 'Private Room', 'Bar'];

export default function Tables() {
  const [tables, setTables] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [section, setSection] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResvModal, setShowResvModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [form, setForm] = useState({ name: '', capacity: 4, section: 'Main Hall', shape: 'square' });
  const [resvForm, setResvForm] = useState({ table_id: '', customer_name: '', customer_phone: '', party_size: 2, reservation_date: '', reservation_time: '19:00', notes: '' });
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTables();
    fetchReservations();
    const interval = setInterval(fetchTables, 30000);

    const handleTableChange = () => {
      fetchTables();
      fetchReservations();
    };

    socket.on('table_updated', handleTableChange);
    socket.on('new_order', handleTableChange);
    socket.on('order_updated', handleTableChange);
    socket.on('order_status_changed', handleTableChange);
    socket.on('order_paid', handleTableChange);
    socket.on('qr_order', handleTableChange);

    return () => {
      clearInterval(interval);
      socket.off('table_updated', handleTableChange);
      socket.off('new_order', handleTableChange);
      socket.off('order_updated', handleTableChange);
      socket.off('order_status_changed', handleTableChange);
      socket.off('order_paid', handleTableChange);
      socket.off('qr_order', handleTableChange);
    };
  }, []);

  const fetchTables = async () => {
    const res = await api.get('/tables');
    setTables(res.data);
  };

  const fetchReservations = async () => {
    const res = await api.get('/tables/reservations');
    setReservations(res.data);
  };

  const generateQR = async (table) => {
    try {
      const res = await api.get(`/tables/${table.id}/qr`);
      setShowQRModal({ ...table, qr_code: res.data.qr_code, url: res.data.url });
      fetchTables();
    } catch (err) {
      toast.error('Failed to generate QR');
    }
  };

  const addTable = async () => {
    try {
      await api.post('/tables', form);
      toast.success('Table added!');
      setShowAddModal(false);
      setForm({ name: '', capacity: 4, section: 'Main Hall', shape: 'square' });
      fetchTables();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const addReservation = async () => {
    try {
      await api.post('/tables/reservations', resvForm);
      toast.success('Reservation created!');
      setShowResvModal(false);
      fetchReservations();
    } catch (err) {
      toast.error('Failed to create reservation');
    }
  };

  const updateStatus = async (tableId, status) => {
    try {
      const table = tables.find(t => t.id === tableId);
      await api.put(`/tables/${tableId}`, { ...table, status });
      fetchTables();
    } catch (err) { toast.error('Failed'); }
  };

  const filteredTables = section === 'All' ? tables : tables.filter(t => t.section === section);
  const stats = {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
    occupied: tables.filter(t => t.status === 'occupied').length,
    reserved: tables.filter(t => t.status === 'reserved').length,
  };

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[['Total Tables', stats.total, '🪑', 'blue'],
          ['Available', stats.available, '✅', 'green'],
          ['Occupied', stats.occupied, '🔴', 'red'],
          ['Reserved', stats.reserved, '🟡', 'purple']].map(([label, val, icon, color]) => (
          <div key={label} className="stat-card" style={{ padding: '16px' }}>
            <div className={`stat-icon ${color}`}>{icon}</div>
            <div className="stat-info">
              <div className="stat-label">{label}</div>
              <div className="stat-value">{val}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        {/* Section Filter */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SECTIONS.map(s => (
            <button key={s} className={`btn ${section === s ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setSection(s)}>{s}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowResvModal(true)}>📅 Add Reservation</button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Table</button>
        </div>
      </div>

      {/* Tables Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 28, alignItems: 'start' }}>
        {filteredTables.map(table => (
          <div
            key={table.id}
            className="table-card"
            style={{ borderColor: STATUS_COLORS[table.status] || 'var(--border)' }}
          >
            <div style={{ position: 'absolute', top: 8, right: 8 }}>
              <span className={`table-status-dot ${table.status}`} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 900, color: STATUS_COLORS[table.status] }}>{table.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>👥 {table.capacity} seats</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{table.section}</div>
            {table.active_order && (
              <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700 }}>
                {table.active_order.order_number}
              </div>
            )}
            {table.status === 'occupied' && !table.active_order && (
              <div style={{ fontSize: 10, color: 'var(--warning)', fontWeight: 600 }}>
                🛒 Draft
              </div>
            )}
            <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
              {table.status === 'available' && (
                <button className="btn btn-primary btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => navigate(`/pos?table=${table.id}`)}>
                  New Order
                </button>
              )}
              {table.status === 'occupied' && table.active_order && (
                <button className="btn btn-warning btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => navigate(`/pos?table=${table.id}`)}>
                  Add Items
                </button>
              )}
              {table.status === 'occupied' && !table.active_order && (
                <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => navigate(`/pos?table=${table.id}`)}>
                  🛒 Continue
                </button>
              )}
              <button className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => generateQR(table)}>
                QR
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reservations */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📅 Reservations</span>
          <button className="btn btn-primary btn-sm" onClick={() => setShowResvModal(true)}>+ Add</button>
        </div>
        {reservations.length === 0 ? (
          <div className="empty-state"><div>📅</div><p>No reservations</p></div>
        ) : (
          <table className="data-table">
            <thead><tr><th>Customer</th><th>Phone</th><th>Table</th><th>Party</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
            <tbody>
              {reservations.map(r => (
                <tr key={r.id}>
                  <td>{r.customer_name}</td>
                  <td>{r.customer_phone}</td>
                  <td>{r.table_name}</td>
                  <td>👥 {r.party_size}</td>
                  <td>{r.reservation_date}</td>
                  <td>{r.reservation_time}</td>
                  <td><span className={`badge ${r.status === 'confirmed' ? 'badge-success' : 'badge-muted'}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Table Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add Table</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Table Name</label>
                <input className="form-control" placeholder="e.g. T11" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Capacity</label>
                  <input type="number" className="form-control" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Shape</label>
                  <select className="form-control" value={form.shape} onChange={e => setForm(f => ({ ...f, shape: e.target.value }))}>
                    <option value="square">Square</option>
                    <option value="circle">Round</option>
                    <option value="rectangle">Rectangle</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Section</label>
                <select className="form-control" value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))}>
                  {SECTIONS.filter(s => s !== 'All').map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <button className="btn btn-primary" onClick={addTable}>Add Table</button>
            </div>
          </div>
        </div>
      )}

      {/* Reservation Modal */}
      {showResvModal && (
        <div className="modal-overlay" onClick={() => setShowResvModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">New Reservation</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowResvModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Customer Name</label>
                  <input className="form-control" value={resvForm.customer_name} onChange={e => setResvForm(f => ({ ...f, customer_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={resvForm.customer_phone} onChange={e => setResvForm(f => ({ ...f, customer_phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Table</label>
                  <select className="form-control" value={resvForm.table_id} onChange={e => setResvForm(f => ({ ...f, table_id: e.target.value }))}>
                    <option value="">Select table</option>
                    {tables.filter(t => t.status === 'available').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Party Size</label>
                  <input type="number" className="form-control" value={resvForm.party_size} onChange={e => setResvForm(f => ({ ...f, party_size: parseInt(e.target.value) }))} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input type="date" className="form-control" value={resvForm.reservation_date} onChange={e => setResvForm(f => ({ ...f, reservation_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Time</label>
                  <input type="time" className="form-control" value={resvForm.reservation_time} onChange={e => setResvForm(f => ({ ...f, reservation_time: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" value={resvForm.notes} onChange={e => setResvForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <button className="btn btn-primary" onClick={addReservation}>Create Reservation</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQRModal && (
        <div className="modal-overlay" onClick={() => setShowQRModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div className="modal-header">
              <span className="modal-title">QR Code — {showQRModal.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowQRModal(null)}>✕</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>Customers scan this to order from their phone</p>
            {showQRModal.qr_code && <img src={showQRModal.qr_code} alt="QR Code" style={{ width: 260, height: 260, borderRadius: 12, margin: '0 auto' }} />}
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>{showQRModal.url}</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => {
                const link = document.createElement('a');
                link.download = `table-${showQRModal.name}-qr.png`;
                link.href = showQRModal.qr_code;
                link.click();
              }}>⬇️ Download QR</button>
              <button className="btn btn-secondary" onClick={() => window.open(showQRModal.url, '_blank')}>🔗 Preview Menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
