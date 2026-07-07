import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatCurrency } from '../../utils/helpers';
import { useToast } from '../../contexts/ToastContext';

export default function MenuManager() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('items');
  const [selectedCat, setSelectedCat] = useState('all');
  const [search, setSearch] = useState('');
  const [showItemModal, setShowItemModal] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editCat, setEditCat] = useState(null);
  const [itemForm, setItemForm] = useState({ category_id: '', name: '', description: '', price: '', cost_price: '', is_veg: true, is_available: true, tax_category: 'gst5', preparation_time: 15 });
  const [catForm, setCatForm] = useState({ name: '', description: '', icon: '🍽️', color: '#FF6B35' });
  const toast = useToast();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [catRes, itemRes] = await Promise.all([api.get('/menu/categories'), api.get('/menu/items')]);
    setCategories(catRes.data);
    setItems(itemRes.data);
  };

  const openAddItem = () => {
    setEditItem(null);
    setItemForm({ category_id: categories[0]?.id || '', name: '', description: '', price: '', cost_price: '', is_veg: true, is_available: true, tax_category: 'gst5', preparation_time: 15 });
    setShowItemModal(true);
  };

  const openEditItem = (item) => {
    setEditItem(item);
    setItemForm({ ...item });
    setShowItemModal(true);
  };

  const saveItem = async () => {
    try {
      if (editItem) {
        await api.put(`/menu/items/${editItem.id}`, itemForm);
        toast.success('Item updated!');
      } else {
        await api.post('/menu/items', itemForm);
        toast.success('Item added!');
      }
      setShowItemModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const toggleItem = async (id) => {
    await api.patch(`/menu/items/${id}/toggle`);
    fetchData();
  };

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this item?')) return;
    await api.delete(`/menu/items/${id}`);
    toast.success('Item deleted');
    fetchData();
  };

  const saveCat = async () => {
    try {
      if (editCat) {
        await api.put(`/menu/categories/${editCat.id}`, catForm);
        toast.success('Category updated!');
      } else {
        await api.post('/menu/categories', catForm);
        toast.success('Category added!');
      }
      setShowCatModal(false);
      fetchData();
    } catch (err) {
      toast.error('Failed');
    }
  };

  const filteredItems = items.filter(item => {
    const matchCat = selectedCat === 'all' || item.category_id == selectedCat;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div>
      <div className="tab-bar" style={{ marginBottom: 20, maxWidth: 400 }}>
        <button className={`tab-btn ${activeTab === 'items' ? 'active' : ''}`} onClick={() => setActiveTab('items')}>Menu Items ({items.length})</button>
        <button className={`tab-btn ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}>Categories ({categories.length})</button>
      </div>

      {activeTab === 'items' && (
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="form-control" placeholder="🔍 Search items..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 260 }} />
            <select className="form-control" value={selectedCat} onChange={e => setSelectedCat(e.target.value)} style={{ maxWidth: 200 }}>
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <div style={{ marginLeft: 'auto' }}>
              <button className="btn btn-primary" onClick={openAddItem}>+ Add Item</button>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr><th>Item</th><th>Category</th><th>Price</th><th>Cost</th><th>GST</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className={`veg-dot ${item.is_veg ? 'veg' : 'nonveg'}`} />
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.description?.slice(0, 40)}</div>
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 12 }}>{item.category_name}</span></td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(item.price)}</td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.cost_price > 0 ? formatCurrency(item.cost_price) : '-'}</td>
                    <td><span className="badge badge-muted" style={{ fontSize: 10 }}>{item.tax_category?.toUpperCase()}</span></td>
                    <td>
                      <button
                        className={`badge ${item.is_available ? 'badge-success' : 'badge-danger'}`}
                        onClick={() => toggleItem(item.id)}
                        style={{ cursor: 'pointer', border: 'none', background: 'none' }}
                      >
                        {item.is_available ? '● Available' : '○ Off'}
                      </button>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => openEditItem(item)}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteItem(item.id)}>Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredItems.length === 0 && <div className="empty-state"><div>🍽️</div><p>No items found</p></div>}
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={() => { setEditCat(null); setCatForm({ name: '', description: '', icon: '🍽️', color: '#FF6B35' }); setShowCatModal(true); }}>+ Add Category</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {categories.map(cat => (
              <div key={cat.id} className="card" style={{ borderLeft: `4px solid ${cat.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{cat.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{cat.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{cat.description}</div>
                    <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 6 }}>{cat.item_count} items</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditCat(cat); setCatForm({ ...cat }); setShowCatModal(true); }}>Edit</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="modal-overlay" onClick={() => setShowItemModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem ? 'Edit Item' : 'Add Menu Item'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowItemModal(false)}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Item Name</label>
                <input className="form-control" value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Paneer Tikka" />
              </div>
              <div className="form-group" style={{ gridColumn: '1/-1' }}>
                <label className="form-label">Description</label>
                <textarea className="form-control" value={itemForm.description || ''} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-control" value={itemForm.category_id} onChange={e => setItemForm(f => ({ ...f, category_id: e.target.value }))}>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tax Category</label>
                <select className="form-control" value={itemForm.tax_category} onChange={e => setItemForm(f => ({ ...f, tax_category: e.target.value }))}>
                  <option value="gst5">GST 5%</option>
                  <option value="gst12">GST 12%</option>
                  <option value="gst18">GST 18%</option>
                  <option value="exempt">Exempt</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Selling Price (₹)</label>
                <input type="number" className="form-control" value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Cost Price (₹)</label>
                <input type="number" className="form-control" value={itemForm.cost_price || ''} onChange={e => setItemForm(f => ({ ...f, cost_price: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Prep Time (min)</label>
                <input type="number" className="form-control" value={itemForm.preparation_time} onChange={e => setItemForm(f => ({ ...f, preparation_time: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button className={`btn ${itemForm.is_veg ? 'btn-success' : 'btn-secondary'}`} onClick={() => setItemForm(f => ({ ...f, is_veg: true }))} style={{ flex: 1 }}>🟢 Veg</button>
                  <button className={`btn ${!itemForm.is_veg ? 'btn-danger' : 'btn-secondary'}`} onClick={() => setItemForm(f => ({ ...f, is_veg: false }))} style={{ flex: 1 }}>🔴 Non-Veg</button>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveItem}>
                {editItem ? 'Update Item' : 'Add Item'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowItemModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editCat ? 'Edit Category' : 'Add Category'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCatModal(false)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Name</label>
                <input className="form-control" value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-control" value={catForm.description || ''} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Icon (Emoji)</label>
                  <input className="form-control" value={catForm.icon} onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))} maxLength={4} />
                </div>
                <div className="form-group">
                  <label className="form-label">Color</label>
                  <input type="color" className="form-control" value={catForm.color} onChange={e => setCatForm(f => ({ ...f, color: e.target.value }))} style={{ padding: '4px', height: 40 }} />
                </div>
              </div>
              <button className="btn btn-primary" onClick={saveCat}>{editCat ? 'Update' : 'Add Category'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
