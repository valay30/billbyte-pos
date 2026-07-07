import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { formatCurrency } from '../../utils/helpers';

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const api = axios.create({ baseURL: apiBase });

api.interceptors.request.use(config => {
  const urlParams = new URLSearchParams(window.location.search);
  let slug = urlParams.get('tenant');
  if (!slug) {
    const hostname = window.location.hostname;
    if (!hostname.includes('onrender.com') && !hostname.includes('vercel.app') && hostname !== 'localhost') {
      slug = hostname.split('.')[0];
    } else {
      slug = localStorage.getItem('billbyte_tenant_slug') || 'demo';
    }
  }
  if (slug) config.headers['X-Tenant-Slug'] = slug;
  return config;
});

export default function CustomerMenu() {
  const { tableId } = useParams();
  const [data, setData] = useState(null);
  const [cart, setCart] = useState([]);
  const [selectedCat, setSelectedCat] = useState('all');
  const [search, setSearch] = useState('');
  const [activeView, setActiveView] = useState('menu'); // menu | cart | status | feedback
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [fbForm, setFbForm] = useState({ rating: 5, food_rating: 5, service_rating: 5, ambiance_rating: 4, comment: '' });
  const [fbSubmitted, setFbSubmitted] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchMenu();
    const interval = setInterval(checkOrder, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchMenu = async () => {
    try {
      const res = await api.get(`/customer/table/${tableId}`);
      setData(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const checkOrder = async () => {
    try {
      const res = await api.get(`/customer/order/${tableId}`);
      if (res.data.order) setOrder(res.data.order);
    } catch {}
  };

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.item_id === item.id);
      if (existing) return prev.map(c => c.item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { item_id: item.id, item_name: item.name, unit_price: item.price, quantity: 1, tax_category: item.tax_category }];
    });
  };

  const updateQty = (itemId, delta) => {
    setCart(prev => prev.map(c => c.item_id === itemId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  };

  const cartTotal = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const placeOrder = async () => {
    if (!cart.length) return;
    setPlacing(true);
    try {
      const res = await api.post('/customer/order', {
        table_id: tableId,
        items: cart,
        notes,
      });
      setOrderPlaced(res.data);
      setCart([]);
      setNotes('');
      setActiveView('status');
      checkOrder();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const submitFeedback = async () => {
    try {
      await api.post('/customer/feedback', { ...fbForm, order_id: order?.id });
      setFbSubmitted(true);
    } catch {}
  };

  const filteredItems = (data?.items || []).filter(item => {
    const matchCat = selectedCat === 'all' || item.category_id == selectedCat;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0D0F14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🍽️</div>
        <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
        <p style={{ color: '#8B93B8', marginTop: 12 }}>Loading menu...</p>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: '100vh', background: '#0D0F14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textAlign: 'center', padding: 20 }}>
      <div>
        <div style={{ fontSize: 48 }}>😕</div>
        <h2 style={{ marginTop: 16 }}>Table not found</h2>
        <p style={{ color: '#8B93B8', marginTop: 8 }}>Please scan a valid table QR code</p>
      </div>
    </div>
  );

  const { table, categories, settings } = data;

  return (
    <div style={{ minHeight: '100vh', background: '#0D0F14', color: '#F0F2FF', fontFamily: 'Inter, sans-serif', maxWidth: 480, margin: '0 auto', position: 'relative' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #1C2030, #141720)', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{settings.restaurant_name || 'BillByte POS'}</div>
            <div style={{ fontSize: 13, color: '#8B93B8', marginTop: 2 }}>Table {table.name} · Self-Order</div>
          </div>
          <div style={{ fontSize: 28 }}>🍽️</div>
        </div>

        {/* Nav tabs */}
        <div style={{ display: 'flex', gap: 4, marginTop: 12, background: '#1E2235', borderRadius: 10, padding: 4 }}>
          {[['menu', '🍽️ Menu'], ['cart', `🛒 Cart${cartCount > 0 ? ` (${cartCount})` : ''}`], ['status', '📋 Order']].map(([val, label]) => (
            <button key={val}
              onClick={() => setActiveView(val)}
              style={{
                flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: activeView === val ? '#FF6B35' : 'transparent',
                color: activeView === val ? 'white' : '#8B93B8',
                fontWeight: 600, fontSize: 12, fontFamily: 'Inter, sans-serif',
                transition: 'all 0.2s'
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* MENU VIEW */}
      {activeView === 'menu' && (
        <div style={{ paddingBottom: cartCount > 0 ? 100 : 20 }}>
          {/* Search */}
          <div style={{ padding: '12px 16px' }}>
            <input
              style={{ width: '100%', background: '#1E2235', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 14px', color: '#F0F2FF', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              placeholder="🔍 Search dishes..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Categories */}
          <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            <button
              onClick={() => setSelectedCat('all')}
              style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', background: selectedCat === 'all' ? '#FF6B35' : '#1C2030', color: selectedCat === 'all' ? 'white' : '#8B93B8' }}
            >All</button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setSelectedCat(cat.id)}
                style={{ padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', background: selectedCat == cat.id ? cat.color : '#1C2030', color: selectedCat == cat.id ? 'white' : '#8B93B8' }}
              >{cat.icon} {cat.name}</button>
            ))}
          </div>

          {/* Items */}
          <div style={{ padding: '0 16px' }}>
            {filteredItems.map(item => {
              const inCart = cart.find(c => c.item_id === item.id);
              return (
                <div key={item.id} style={{ background: '#1C2030', borderRadius: 14, padding: '14px', marginBottom: 10, display: 'flex', gap: 12, border: inCart ? '1px solid rgba(255,107,53,0.4)' : '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 2, border: `2px solid ${item.is_veg ? '#22C55E' : '#EF4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: item.is_veg ? '#22C55E' : '#EF4444' }} />
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{item.name}</span>
                    </div>
                    {item.description && <p style={{ fontSize: 12, color: '#8B93B8', margin: '0 0 8px', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.description}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#FF6B35' }}>{formatCurrency(item.price)}</span>
                      {inCart ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => updateQty(item.id, -1)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#FF6B35', color: 'white', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>−</button>
                          <span style={{ fontWeight: 800, fontSize: 16, minWidth: 20, textAlign: 'center' }}>{inCart.quantity}</span>
                          <button onClick={() => updateQty(item.id, 1)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: '#FF6B35', color: 'white', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>+</button>
                        </div>
                      ) : (
                        <button onClick={() => addToCart(item)} style={{ padding: '6px 16px', borderRadius: 20, border: 'none', background: 'rgba(255,107,53,0.15)', color: '#FF6B35', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredItems.length === 0 && <div style={{ textAlign: 'center', padding: '40px 20px', color: '#4A5280' }}>🍽️<br />No items found</div>}
          </div>
        </div>
      )}

      {/* CART VIEW */}
      {activeView === 'cart' && (
        <div style={{ padding: '16px', paddingBottom: 100 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Your Order</h2>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4A5280' }}>
              <div style={{ fontSize: 48 }}>🛒</div>
              <p style={{ marginTop: 12, fontSize: 15 }}>Your cart is empty</p>
              <button onClick={() => setActiveView('menu')} style={{ marginTop: 16, padding: '10px 24px', background: '#FF6B35', border: 'none', borderRadius: 24, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Browse Menu →</button>
            </div>
          ) : (
            <>
              {cart.map(item => (
                <div key={item.item_id} style={{ background: '#1C2030', borderRadius: 12, padding: '12px 14px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{item.item_name}</div>
                    <div style={{ color: '#FF6B35', fontWeight: 700, fontSize: 13, marginTop: 2 }}>{formatCurrency(item.unit_price)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => updateQty(item.item_id, -1)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#2A2E45', color: 'white', fontSize: 14, cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                    <span style={{ fontWeight: 800, fontSize: 15, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                    <button onClick={() => updateQty(item.item_id, 1)} style={{ width: 26, height: 26, borderRadius: '50%', border: 'none', background: '#FF6B35', color: 'white', fontSize: 14, cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  </div>
                  <div style={{ fontWeight: 800, color: '#F0F2FF', minWidth: 70, textAlign: 'right' }}>{formatCurrency(item.unit_price * item.quantity)}</div>
                </div>
              ))}
              <div style={{ background: '#1C2030', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <textarea
                  style={{ width: '100%', background: '#1E2235', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: '10px', color: '#F0F2FF', fontSize: 13, resize: 'none', boxSizing: 'border-box', outline: 'none' }}
                  placeholder="Any special instructions? (e.g. less spicy, no onion)"
                  value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                />
              </div>
              <div style={{ background: '#1C2030', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 18, fontWeight: 800, color: '#FF6B35' }}>
                <span>Total</span>
                <span>{formatCurrency(cartTotal * 1.05)}</span>
              </div>
              <button
                onClick={placeOrder}
                disabled={placing}
                style={{ width: '100%', padding: '16px', background: 'linear-gradient(135deg, #FF6B35, #E55A24)', border: 'none', borderRadius: 14, color: 'white', fontWeight: 800, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {placing ? '⏳ Placing...' : '✅ Place Order →'}
              </button>
            </>
          )}
        </div>
      )}

      {/* STATUS VIEW */}
      {activeView === 'status' && (
        <div style={{ padding: 16 }}>
          {orderPlaced && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 14, padding: 20, marginBottom: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 40 }}>✅</div>
              <h2 style={{ marginTop: 8, color: '#22C55E' }}>Order Placed!</h2>
              <p style={{ color: '#8B93B8', marginTop: 6, fontSize: 13 }}>Your order has been sent to the kitchen.<br />You'll be served shortly.</p>
              <div style={{ marginTop: 12, fontSize: 13, color: '#8B93B8' }}>Order: <strong style={{ color: '#FF6B35' }}>{orderPlaced.order_number || orderPlaced.kot_number}</strong></div>
            </div>
          )}

          {order ? (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>📋 Live Order Status</h2>
              <div style={{ background: '#1C2030', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontWeight: 700, color: '#FF6B35' }}>{order.order_number}</span>
                  <span style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>{order.status}</span>
                </div>
                {(order.items || []).map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                    <span>{item.item_name} × {item.quantity}</span>
                    <span style={{ color: item.status === 'ready' ? '#22C55E' : '#F59E0B', fontWeight: 700, fontSize: 12 }}>
                      {item.status === 'ready' ? '✅ Ready' : item.status === 'pending' ? '⏳ Cooking' : item.status}
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
                  <span>Total</span>
                  <span style={{ color: '#FF6B35' }}>{formatCurrency(order.total)}</span>
                </div>
              </div>

              {/* Add more items */}
              <button onClick={() => setActiveView('menu')} style={{ width: '100%', padding: 14, background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.3)', borderRadius: 12, color: '#FF6B35', fontWeight: 700, cursor: 'pointer', marginBottom: 12, fontSize: 14 }}>
                + Add More Items
              </button>

              {/* Feedback */}
              {order.status === 'paid' && !fbSubmitted && (
                <div style={{ background: '#1C2030', borderRadius: 14, padding: 16 }}>
                  <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>⭐ Rate Your Experience</h3>
                  {[['Overall', 'rating'], ['Food', 'food_rating'], ['Service', 'service_rating'], ['Ambiance', 'ambiance_rating']].map(([label, key]) => (
                    <div key={key} style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 12, color: '#8B93B8', marginBottom: 4 }}>{label}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[1,2,3,4,5].map(n => (
                          <button key={n} onClick={() => setFbForm(f => ({ ...f, [key]: n }))} style={{ fontSize: 24, background: 'none', border: 'none', cursor: 'pointer', opacity: fbForm[key] >= n ? 1 : 0.3 }}>⭐</button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <textarea style={{ width: '100%', background: '#1E2235', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, padding: 10, color: '#F0F2FF', resize: 'none', boxSizing: 'border-box', outline: 'none', fontSize: 13 }} placeholder="Tell us about your experience..." rows={3} value={fbForm.comment} onChange={e => setFbForm(f => ({ ...f, comment: e.target.value }))} />
                  <button onClick={submitFeedback} style={{ width: '100%', marginTop: 12, padding: 14, background: '#FF6B35', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Submit Feedback ✨</button>
                </div>
              )}
              {fbSubmitted && <div style={{ textAlign: 'center', padding: 20, color: '#22C55E', fontWeight: 700 }}>🙏 Thank you for your feedback!</div>}
            </div>
          ) : !orderPlaced ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#4A5280' }}>
              <div style={{ fontSize: 48 }}>📋</div>
              <p style={{ marginTop: 12, fontSize: 15 }}>No active order for this table</p>
              <button onClick={() => setActiveView('menu')} style={{ marginTop: 16, padding: '10px 24px', background: '#FF6B35', border: 'none', borderRadius: 24, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Start Ordering →</button>
            </div>
          ) : null}
        </div>
      )}

      {/* Floating Cart Button */}
      {activeView === 'menu' && cartCount > 0 && (
        <div
          onClick={() => setActiveView('cart')}
          style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #FF6B35, #E55A24)',
            color: 'white', borderRadius: 28, padding: '14px 28px',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 8px 30px rgba(255,107,53,0.5)',
            fontWeight: 800, fontSize: 15, cursor: 'pointer',
            zIndex: 100, maxWidth: 360,
            animation: 'slideUp 0.3s ease',
          }}
        >
          <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>{cartCount}</span>
          <span>View Cart</span>
          <span style={{ marginLeft: 'auto' }}>{formatCurrency(cartTotal)}</span>
        </div>
      )}
    </div>
  );
}
