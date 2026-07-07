import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';
import { useToast } from '../../contexts/ToastContext';

export default function Inventory() {
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [activeTab, setActiveTab] = useState('stock');
  const [showItemModal, setShowItemModal] = useState(false);
  const [showAdjModal, setShowAdjModal] = useState(null);
  const [showPOModal, setShowPOModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [form, setForm] = useState({ name: '', unit: 'kg', current_stock: 0, min_stock: 1, cost_per_unit: 0, category: 'General', supplier: '' });
  const [adjForm, setAdjForm] = useState({ quantity: 0, type: 'add', notes: '' });
  const [poForm, setPOForm] = useState({ supplier: '', items: [], notes: '' });
  const [poItems, setPOItems] = useState([{ inventory_item_id: '', quantity: 0, unit_price: 0 }]);
  const toast = useToast();

  useEffect(() => { fetchData(); }, [showLowOnly]);

  const fetchData = async () => {
    const [invRes, poRes] = await Promise.all([
      api.get(`/inventory?${showLowOnly ? 'low_stock=true' : ''}`),
      api.get('/inventory/purchases'),
    ]);
    setItems(invRes.data);
    setPurchases(poRes.data);
  };

  const saveItem = async () => {
    try {
      if (editItem) {
        await api.put(`/inventory/${editItem.id}`, form);
        toast.success('Item updated!');
      } else {
        await api.post('/inventory', form);
        toast.success('Item added!');
      }
      setShowItemModal(false);
      fetchData();
    } catch (err) { toast.error('Failed'); }
  };

  const adjustStock = async () => {
    try {
      await api.post(`/inventory/${showAdjModal.id}/adjust`, adjForm);
      toast.success(`Stock ${adjForm.type === 'add' ? 'added' : 'deducted'} successfully`);
      setShowAdjModal(null);
      fetchData();
    } catch (err) { toast.error('Failed'); }
  };

  const createPO = async () => {
    try {
      await api.post('/inventory/purchases', { supplier: poForm.supplier, items: poItems.filter(i => i.inventory_item_id && i.quantity > 0), notes: poForm.notes });
      toast.success('Purchase order created!');
      setShowPOModal(false);
      fetchData();
    } catch (err) { toast.error('Failed'); }
  };

  const receivePO = async (id) => {
    if (!window.confirm('Mark as received and update stock?')) return;
    await api.patch(`/inventory/purchases/${id}/receive`);
    toast.success('Stock updated!');
    fetchData();
  };

  const filteredItems = items.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));
  const lowStockCount = items.filter(i => i.current_stock <= i.min_stock).length;
  const totalValue = items.reduce((s, i) => s + i.current_stock * i.cost_per_unit, 0);

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          ['Total Items', items.length, '📦', 'blue'],
          ['Low Stock', lowStockCount, '⚠️', 'red'],
          ['Stock Value', formatCurrency(totalValue), '💰', 'green'],
        ].map(([label, val, icon, color]) => (
          <div key={label} className="stat-card">
            <div className={`stat-icon ${color}`}>{icon}</div>
            <div className="stat-info"><div className="stat-label">{label}</div><div className="stat-value">{val}</div></div>
          </div>
        ))}
      </div>

      <div className="tab-bar" style={{ marginBottom: 20, maxWidth: 500 }}>
        {[['stock', 'Stock Items'], ['purchases', `Purchase Orders (${purchases.length})`]].map(([val, label]) => (
          <button key={val} className={`tab-btn ${activeTab === val ? 'active' : ''}`} onClick={() => setActiveTab(val)}>{label}</button>
        ))}
      </div>

      {activeTab === 'stock' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="form-control" placeholder="🔍 Search..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={showLowOnly} onChange={e => setShowLowOnly(e.target.checked)} />
              Low stock only
            </label>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowPOModal(true)}>📋 New PO</button>
              <button className="btn btn-primary" onClick={() => { setEditItem(null); setForm({ name: '', unit: 'kg', current_stock: 0, min_stock: 1, cost_per_unit: 0, category: 'General', supplier: '' }); setShowItemModal(true); }}>+ Add Item</button>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr><th>Item</th><th>Category</th><th>Current Stock</th><th>Min Stock</th><th>Unit Cost</th><th>Value</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredItems.map(item => {
                  const isLow = item.current_stock <= item.min_stock;
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td style={{ fontSize: 12 }}>{item.category}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: isLow ? 'var(--danger)' : 'var(--text-primary)' }}>
                          {item.current_stock} {item.unit}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.min_stock} {item.unit}</td>
                      <td style={{ fontSize: 12 }}>{formatCurrency(item.cost_per_unit)}/{item.unit}</td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(item.current_stock * item.cost_per_unit)}</td>
                      <td>
                        <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`}>
                          {isLow ? '⚠️ Low' : '✅ OK'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setShowAdjModal(item); setAdjForm({ quantity: 0, type: 'add', notes: '' }); }}>Adjust</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => { setEditItem(item); setForm({ ...item }); setShowItemModal(true); }}>Edit</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredItems.length === 0 && <div className="empty-state"><div>📦</div><p>No inventory items</p></div>}
          </div>
        </div>
      )}

      {activeTab === 'purchases' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => setShowPOModal(true)}>+ New Purchase Order</button>
          </div>
          {purchases.length === 0 ? (
            <div className="empty-state"><div>📋</div><p>No purchase orders</p></div>
          ) : (
            purchases.map(po => (
              <div key={po.id} className="card" style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{po.po_number}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 12 }}>{po.supplier}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className={`badge ${po.status === 'received' ? 'badge-success' : 'badge-warning'}`}>{po.status}</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(po.total_amount)}</span>
                    {po.status !== 'received' && (
                      <button className="btn btn-success btn-sm" onClick={() => receivePO(po.id)}>✓ Receive</button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(po.items || []).map(item => (
                    <div key={item.id} style={{ background: 'var(--bg-input)', borderRadius: 8, padding: '4px 10px', fontSize: 12 }}>
                      {item.item_name}: {item.quantity} {item.unit} @ {formatCurrency(item.unit_price)}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Inventory Item Modal */}
      {showItemModal && (
        <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem ? 'Edit Item' : 'Add Inventory Item'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowItemModal(false)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Item Name</label>
                <input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-control" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                  {['kg', 'g', 'litre', 'ml', 'piece', 'dozen', 'packet'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-control" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {['Vegetables', 'Fruits', 'Dairy', 'Meat', 'Grains', 'Oils', 'Spices', 'Beverages', 'General'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Current Stock</label>
                <input type="number" className="form-control" value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock: parseFloat(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Min Stock (Alert)</label>
                <input type="number" className="form-control" value={form.min_stock} onChange={e => setForm(f => ({ ...f, min_stock: parseFloat(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Cost Per Unit (₹)</label>
                <input type="number" className="form-control" value={form.cost_per_unit} onChange={e => setForm(f => ({ ...f, cost_per_unit: parseFloat(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Supplier</label>
                <input className="form-control" value={form.supplier || ''} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveItem}>{editItem ? 'Update' : 'Add Item'}</button>
              <button className="btn btn-secondary" onClick={() => setShowItemModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {showAdjModal && (
        <div className="modal-overlay" onClick={() => setShowAdjModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Adjust Stock — {showAdjModal.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAdjModal(null)}>✕</button>
            </div>
            <div style={{ marginBottom: 12, color: 'var(--text-secondary)', fontSize: 13 }}>
              Current: <strong style={{ color: 'var(--text-primary)' }}>{showAdjModal.current_stock} {showAdjModal.unit}</strong>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button className={`btn ${adjForm.type === 'add' ? 'btn-success' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setAdjForm(f => ({ ...f, type: 'add' }))}>+ Add Stock</button>
              <button className={`btn ${adjForm.type === 'remove' ? 'btn-danger' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setAdjForm(f => ({ ...f, type: 'remove' }))}>− Remove</button>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Quantity ({showAdjModal.unit})</label>
              <input type="number" className="form-control" value={adjForm.quantity} onChange={e => setAdjForm(f => ({ ...f, quantity: parseFloat(e.target.value) }))} />
            </div>
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">Notes</label>
              <input className="form-control" value={adjForm.notes} onChange={e => setAdjForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason for adjustment" />
            </div>
            <button className="btn btn-primary w-full" onClick={adjustStock}>Confirm Adjustment</button>
          </div>
        </div>
      )}

      {/* PO Modal */}
      {showPOModal && (
        <div className="modal-overlay" onClick={() => setShowPOModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">New Purchase Order</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowPOModal(false)}>✕</button>
            </div>
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">Supplier Name</label>
              <input className="form-control" value={poForm.supplier} onChange={e => setPOForm(f => ({ ...f, supplier: e.target.value }))} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label className="form-label">Items</label>
                <button className="btn btn-secondary btn-sm" onClick={() => setPOItems(prev => [...prev, { inventory_item_id: '', quantity: 0, unit_price: 0 }])}>+ Add Row</button>
              </div>
              {poItems.map((pi, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginBottom: 8 }}>
                  <select className="form-control" value={pi.inventory_item_id} onChange={e => { const arr = [...poItems]; arr[idx].inventory_item_id = e.target.value; setPOItems(arr); }}>
                    <option value="">Select item</option>
                    {items.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                  </select>
                  <input type="number" className="form-control" placeholder="Qty" value={pi.quantity} onChange={e => { const arr = [...poItems]; arr[idx].quantity = parseFloat(e.target.value); setPOItems(arr); }} />
                  <input type="number" className="form-control" placeholder="Unit ₹" value={pi.unit_price} onChange={e => { const arr = [...poItems]; arr[idx].unit_price = parseFloat(e.target.value); setPOItems(arr); }} />
                  <button className="btn btn-danger btn-sm" onClick={() => setPOItems(prev => prev.filter((_, i) => i !== idx))}>✕</button>
                </div>
              ))}
              <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 700, color: 'var(--primary)', marginTop: 8 }}>
                Total: {formatCurrency(poItems.reduce((s, i) => s + (i.quantity * i.unit_price || 0), 0))}
              </div>
            </div>
            <button className="btn btn-primary w-full" onClick={createPO}>Create Purchase Order</button>
          </div>
        </div>
      )}
    </div>
  );
}
