import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import socket from '../../utils/socket';
import { formatCurrency, printContent, generateBillHTML, generateKOTHTML } from '../../utils/helpers';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';

export default function POS() {
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCat, setSelectedCat] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedTable, setSelectedTable] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [discount, setDiscount] = useState({ type: 'percentage', value: 0 });
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitParts, setSplitParts] = useState(2);
  const [settings, setSettings] = useState({});
  const [existingOrder, setExistingOrder] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [mobileTab, setMobileTab] = useState('menu'); // 'menu' | 'cart'

  // Per-table cart memory: { [tableId]: { cart, existingOrder, customer, customerPhone, discount, couponCode, couponDiscount, loyaltyPoints, orderNotes } }
  // Persisted to localStorage so navigation away from POS does not lose draft orders.
  const LS_KEY = 'pos_table_states';
  const tableStates = useRef({});

  // Ref that always holds the latest state values — used in the unmount cleanup to save before leaving.
  const liveStateRef = useRef({});

  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Keep liveStateRef in sync with all state on every render
  useEffect(() => {
    liveStateRef.current = { cart, existingOrder, customer, customerPhone, discount, couponCode, couponDiscount, loyaltyPoints, orderNotes, selectedTable };
  });

  // Responsive: detect mobile/desktop on resize
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Load persisted table states from localStorage
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) tableStates.current = JSON.parse(saved);
    } catch { }

    fetchData();
    const tableId = searchParams.get('table');
    if (tableId) {
      // If we already have a saved draft for this table, restore it immediately
      if (tableStates.current[tableId]) {
        const snap = tableStates.current[tableId];
        setSelectedTable(snap.selectedTable || { id: tableId });
        restoreTableState(snap);
      } else {
        fetchTableOrder(tableId);
      }
    }

    const handlePosSocket = () => {
      api.get('/tables').then(res => setTables(res.data)).catch(() => { });
    };
    socket.on('table_updated', handlePosSocket);
    socket.on('new_order', handlePosSocket);
    socket.on('order_status_changed', handlePosSocket);
    socket.on('order_paid', handlePosSocket);
    socket.on('qr_order', handlePosSocket);

    // On unmount: save current table's live state to localStorage so navigation doesn't lose it
    return () => {
      socket.off('table_updated', handlePosSocket);
      socket.off('new_order', handlePosSocket);
      socket.off('order_status_changed', handlePosSocket);
      socket.off('order_paid', handlePosSocket);
      socket.off('qr_order', handlePosSocket);
      const { selectedTable: st, cart: c, existingOrder: eo, customer: cu, customerPhone: cp,
        discount: d, couponCode: cc, couponDiscount: cd, loyaltyPoints: lp, orderNotes: on } = liveStateRef.current;
      if (st && c && c.length > 0) {
        const all = { ...tableStates.current };
        all[st.id] = {
          cart: c, existingOrder: eo, customer: cu, customerPhone: cp,
          discount: d, couponCode: cc, couponDiscount: cd, loyaltyPoints: lp, orderNotes: on, selectedTable: st
        };
        localStorage.setItem(LS_KEY, JSON.stringify(all));
      }
    };
  }, []);

  const fetchData = async () => {
    const [catRes, itemRes, tableRes, settRes] = await Promise.all([
      api.get('/menu/categories'),
      api.get('/menu/items?available_only=true'),
      api.get('/tables'),
      api.get('/menu/settings'),
    ]);
    setCategories(catRes.data);
    setItems(itemRes.data);
    setTables(tableRes.data);
    setSettings(settRes.data);
  };

  const updateCartFromDbItems = (dbItems = []) => {
    setCart(dbItems.map(i => ({
      ...i, item_id: i.item_id, item_name: i.item_name, unit_price: i.unit_price,
      quantity: i.quantity, notes: i.notes || ''
    })));
  };

  const fetchTableOrder = async (tableId) => {
    const table = tables.find(t => t.id == tableId) || { id: tableId };
    setSelectedTable(table);
    try {
      const res = await api.get(`/orders?table_id=${tableId}&status=pending`);
      if (res.data.length > 0) {
        const order = res.data[0];
        setExistingOrder(order);
        const full = await api.get(`/orders/${order.id}`);
        updateCartFromDbItems(full.data.items);
        if (full.data.customer_id) setCustomer({ id: full.data.customer_id, name: full.data.customer_name });
      }
    } catch (e) { }
  };

  const filteredItems = items.filter(item => {
    const matchCat = selectedCat === 'all' || item.category_id == selectedCat;
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const addToCart = (item) => {
    // If this is the first item being added to a draft (no real order yet), mark the table as occupied
    if (cart.length === 0 && selectedTable && !existingOrder) {
      api.put(`/tables/${selectedTable.id}`, { ...selectedTable, status: 'occupied' }).catch(() => { });
    }
    setCart(prev => {
      const existing = prev.find(c => c.item_id === item.id);
      if (existing) return prev.map(c => c.item_id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { item_id: item.id, item_name: item.name, unit_price: item.price, quantity: 1, notes: '', tax_category: item.tax_category }];
    });
  };

  const updateQty = (itemId, delta) => {
    setCart(prev => prev.map(c => c.item_id === itemId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c).filter(c => c.quantity > 0));
  };

  const removeFromCart = (itemId) => setCart(prev => prev.filter(c => c.item_id !== itemId));

  const cartSubtotal = cart.reduce((sum, c) => sum + c.unit_price * c.quantity, 0);
  const cgst = (cartSubtotal * 2.5) / 100;
  const sgst = (cartSubtotal * 2.5) / 100;
  const discountAmt = discount.type === 'percentage' ? (cartSubtotal * discount.value) / 100 : discount.value;
  const ratio = parseFloat(settings.loyalty_redemption_ratio || '100');
  const loyaltyDiscount = loyaltyPoints > 0 ? (loyaltyPoints / 100) * ratio : 0;
  const cartTotal = Math.max(0, cartSubtotal + cgst + sgst - discountAmt - couponDiscount - loyaltyDiscount);

  const ensureCustomerLinked = async () => {
    if (customer) return customer;
    if (!customerPhone || !customerPhone.trim()) return null;
    const phoneStr = customerPhone.trim();
    try {
      const res = await api.get(`/crm/phone/${phoneStr}`);
      setCustomer(res.data);
      if (existingOrder) {
        try { await api.patch(`/orders/${existingOrder.id}/customer`, { customer_id: res.data.id }); } catch { }
      }
      return res.data;
    } catch {
      // Customer mobile number is not in database, add automatically!
      try {
        const createRes = await api.post('/crm', {
          name: `Customer (${phoneStr})`,
          phone: phoneStr,
        });
        setCustomer(createRes.data);
        if (existingOrder) {
          try { await api.patch(`/orders/${existingOrder.id}/customer`, { customer_id: createRes.data.id }); } catch { }
        }
        toast.success(`✨ New mobile number added to data: ${phoneStr}`);
        return createRes.data;
      } catch (err) {
        return null;
      }
    }
  };

  const lookupCustomer = async () => {
    if (!customerPhone || !customerPhone.trim()) return;
    const foundOrCreated = await ensureCustomerLinked();
    if (foundOrCreated) {
      toast.success(`👤 ${foundOrCreated.name} (${foundOrCreated.loyalty_points || 0} pts)`);
    }
  };

  const validateCoupon = async () => {
    try {
      const res = await api.post('/orders/validate-coupon', { code: couponCode, order_total: cartSubtotal });
      setCouponDiscount(res.data.discount_amount);
      toast.success(`Coupon applied! -${formatCurrency(res.data.discount_amount)}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid coupon');
      setCouponDiscount(0);
    }
  };

  const placeOrder = async () => {
    if (!cart.length) return toast.error('Cart is empty');
    setLoading(true);
    try {
      const activeCust = await ensureCustomerLinked();
      let orderData;
      if (existingOrder) {
        const newItems = cart.filter(c => !c.id);
        if (newItems.length > 0) {
          await api.post(`/orders/${existingOrder.id}/items`, { items: newItems });
          toast.success('Items added to order! KOT sent to kitchen.');
        }
        const updated = await api.get(`/orders/${existingOrder.id}`);
        orderData = updated.data;
        setExistingOrder(orderData);
        if (orderData.items) updateCartFromDbItems(orderData.items);
      } else {
        const res = await api.post('/orders', {
          table_id: selectedTable?.id || null,
          customer_id: activeCust?.id || customer?.id || null,
          items: cart,
          notes: orderNotes || null,
        });
        if (discount.value > 0) {
          await api.patch(`/orders/${res.data.id}/discount`, { discount_type: discount.type, discount_value: discount.value, coupon_code: couponCode || null });
        }
        orderData = res.data;
        setExistingOrder(orderData);
        if (orderData.items) updateCartFromDbItems(orderData.items);
        toast.success(`Order ${orderData.order_number} placed! KOT sent.`);
        printContent(generateKOTHTML({ ...orderData, table_name: selectedTable?.name || '-', items: cart, kot_number: orderData.kot_number }), 'KOT');
      }
      return orderData;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to place order');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const getBillData = (order, cust = customer) => ({
    ...order,
    customer_name: order.customer_name || cust?.name,
    customer_phone: order.customer_phone || cust?.phone,
    loyalty_points: order.loyalty_points !== undefined && order.loyalty_points !== null ? order.loyalty_points : (cust?.loyalty_points !== undefined ? cust.loyalty_points : 0),
    loyalty_points_used: loyaltyPoints || order.loyalty_points_used || 0,
  });

  const placeOrderSilent = async (activeCust) => {
    // Place order without printing KOT
    const res = await api.post('/orders', {
      table_id: selectedTable?.id || null,
      customer_id: activeCust?.id || customer?.id || null,
      items: cart,
      notes: orderNotes || null,
    });
    if (discount.value > 0) {
      await api.patch(`/orders/${res.data.id}/discount`, { discount_type: discount.type, discount_value: discount.value, coupon_code: couponCode || null });
    }
    setExistingOrder(res.data);
    if (res.data.items) updateCartFromDbItems(res.data.items);
    return res.data;
  };

  const handleGenerateBillOnly = async () => {
    if (!cart.length && !existingOrder) return toast.error('Cart is empty');
    setLoading(true);
    try {
      const activeCust = await ensureCustomerLinked();
      let orderToBill = existingOrder;
      if (!orderToBill) {
        // No prior KOT — place order silently without printing KOT
        orderToBill = await placeOrderSilent(activeCust);
      } else if (cart.some(c => !c.id)) {
        // New items added to existing order — add them silently
        const newItems = cart.filter(c => !c.id);
        if (newItems.length > 0) {
          await api.post(`/orders/${orderToBill.id}/items`, { items: newItems });
        }
        const updated = await api.get(`/orders/${orderToBill.id}`);
        orderToBill = updated.data;
        setExistingOrder(orderToBill);
        if (orderToBill.items) updateCartFromDbItems(orderToBill.items);
      } else {
        const res = await api.get(`/orders/${orderToBill.id}`);
        orderToBill = res.data;
        setExistingOrder(orderToBill);
        if (orderToBill.items) updateCartFromDbItems(orderToBill.items);
      }
      if (orderToBill) {
        if (activeCust && !orderToBill.customer_id) {
          try { await api.patch(`/orders/${orderToBill.id}/customer`, { customer_id: activeCust.id }); } catch { }
          orderToBill.customer_id = activeCust.id;
        }
        try {
          await api.post(`/orders/${orderToBill.id}/pay`, {
            payments: [{ method: 'cash', amount: cartTotal }],
            loyalty_points_used: loyaltyPoints,
            customer_id: activeCust?.id || customer?.id,
          });
        } catch { }
        const orderRes = await api.get(`/orders/${orderToBill.id}`);
        printContent(generateBillHTML(getBillData(orderRes.data || orderToBill, activeCust), settings), 'Bill');
        toast.success('🧾 Bill Generated & Order Completed!');
        clearCart();
      }
    } catch (err) {
      toast.error('Failed to generate bill');
    } finally {
      setLoading(false);
    }
  };

  const clearCart = () => {
    // Free the table status back to available if this was just a draft (no real order placed)
    if (selectedTable && !existingOrder) {
      api.put(`/tables/${selectedTable.id}`, { ...selectedTable, status: 'available' }).catch(() => { });
    }
    // Wipe this table's saved state from memory and localStorage
    if (selectedTable) {
      delete tableStates.current[selectedTable.id];
      localStorage.setItem(LS_KEY, JSON.stringify(tableStates.current));
    }
    setCart([]); setExistingOrder(null); setSelectedTable(null);
    setCustomer(null); setCustomerPhone(''); setDiscount({ type: 'percentage', value: 0 });
    setCouponCode(''); setCouponDiscount(0); setLoyaltyPoints(0); setOrderNotes('');
  };

  // Snapshot current table's state into the ref AND localStorage
  const saveCurrentTableState = (currentCart, currentExistingOrder, currentCustomer, currentCustomerPhone, currentDiscount, currentCouponCode, currentCouponDiscount, currentLoyaltyPoints, currentOrderNotes) => {
    if (!selectedTable) return;
    tableStates.current[selectedTable.id] = {
      cart: currentCart,
      existingOrder: currentExistingOrder,
      customer: currentCustomer,
      customerPhone: currentCustomerPhone,
      discount: currentDiscount,
      couponCode: currentCouponCode,
      couponDiscount: currentCouponDiscount,
      loyaltyPoints: currentLoyaltyPoints,
      orderNotes: currentOrderNotes,
      selectedTable,
    };
    // Persist immediately so page navigation doesn't lose the draft
    localStorage.setItem(LS_KEY, JSON.stringify(tableStates.current));
  };

  // Restore a table's state from the ref
  const restoreTableState = (snapshot) => {
    setCart(snapshot.cart);
    setExistingOrder(snapshot.existingOrder);
    setCustomer(snapshot.customer);
    setCustomerPhone(snapshot.customerPhone);
    setDiscount(snapshot.discount);
    setCouponCode(snapshot.couponCode);
    setCouponDiscount(snapshot.couponDiscount);
    setLoyaltyPoints(snapshot.loyaltyPoints);
    setOrderNotes(snapshot.orderNotes);
  };

  // Reset all cart-related state to empty defaults
  const resetCartState = () => {
    setCart([]);
    setExistingOrder(null);
    setCustomer(null);
    setCustomerPhone('');
    setDiscount({ type: 'percentage', value: 0 });
    setCouponCode('');
    setCouponDiscount(0);
    setLoyaltyPoints(0);
    setOrderNotes('');
  };

  const cartItemCount = cart.reduce((sum, c) => sum + c.quantity, 0);

  return (
    <div style={{
      margin: -24,
      height: isMobile ? 'calc(100vh - 56px)' : 'calc(100vh - 64px)',
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 400px',
      paddingBottom: isMobile ? 56 : 0,
      position: 'relative',
    }}>
      {/* Left: Menu Panel */}
      <div style={{
        overflow: 'hidden',
        display: isMobile && mobileTab !== 'menu' ? 'none' : 'flex',
        flexDirection: 'column',
        borderRight: isMobile ? 'none' : '1px solid var(--border)'
      }}>
        {/* Search + Table selector */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', gap: 8 }}>
          <input
            className="form-control"
            placeholder="🔍 Search menu items..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <select
            className="form-control"
            value={selectedTable?.id || ''}
            onChange={e => {
              const t = tables.find(t => t.id == e.target.value);

              // Save the current table's cart state before switching
              saveCurrentTableState(cart, existingOrder, customer, customerPhone, discount, couponCode, couponDiscount, loyaltyPoints, orderNotes);

              setSelectedTable(t || null);

              if (!t) {
                // Switched to "No Table" — reset to empty
                resetCartState();
                return;
              }

              if (tableStates.current[t.id]) {
                // We already have a saved local state for this table — restore it instantly
                restoreTableState(tableStates.current[t.id]);
              } else {
                // First time visiting this table — reset and fetch from server
                resetCartState();
                fetchTableOrder(t.id);
              }
            }}
            style={{ width: 130 }}
          >
            <option value="">No Table</option>
            {tables.map(t => (
              <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
            ))}
          </select>
        </div>

        {/* Categories */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, overflowX: 'auto', background: 'var(--bg-surface)' }}>
          <button
            className={`category-chip ${selectedCat === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCat('all')}
          >All</button>
          {categories.map(cat => (
            <button
              key={cat.id}
              className={`category-chip ${selectedCat === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCat(cat.id)}
              style={{ borderColor: selectedCat === cat.id ? cat.color : undefined, background: selectedCat === cat.id ? cat.color : undefined }}
            >
              {cat.icon} {cat.name}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {filteredItems.map(item => {
              const inCart = cart.find(c => c.item_id === item.id);
              return (
                <div
                  key={item.id}
                  className={`menu-item-card ${inCart ? 'selected' : ''}`}
                  onClick={() => addToCart(item)}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: 12 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                    <div className={`veg-dot ${item.is_veg ? 'veg' : 'nonveg'}`} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                      {inCart ? <span style={{ color: 'var(--primary)' }}>×{inCart.quantity}</span> : null}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, lineHeight: 1.3, color: 'var(--text-primary)' }}>{item.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary)', marginTop: 'auto' }}>{formatCurrency(item.price)}</div>
                </div>
              );
            })}
          </div>
          {filteredItems.length === 0 && (
            <div className="empty-state"><div>🍽️</div><p>No items found</p></div>
          )}
        </div>
      </div>

      {/* Right: Cart Panel */}
      <div style={{
        display: isMobile && mobileTab !== 'cart' ? 'none' : 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        overflow: 'hidden',
        height: isMobile ? 'calc(100vh - 56px - 56px)' : '100%', // topbar + tab bar on mobile
      }}>
        {/* Cart Header */}
        <div style={{
          padding: isMobile ? '12px 16px' : '14px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: isMobile ? 17 : 16 }}>
              🛒 Order {selectedTable ? `— ${selectedTable.name}` : ''}
            </span>
            {existingOrder && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {existingOrder.order_number}
              </div>
            )}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={clearCart}
            style={{ color: 'var(--danger)', fontSize: isMobile ? 13 : 12 }}
          >
            🗑 Clear
          </button>
        </div>

        {/* Customer Lookup */}
        <div style={{
          padding: isMobile ? '10px 16px' : '10px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 8,
          flexShrink: 0,
        }}>
          <input
            className="form-control"
            placeholder="📞 Customer phone"
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookupCustomer()}
            style={{ fontSize: isMobile ? 14 : 12, flex: 1 }}
          />
          <button
            className="btn btn-secondary btn-sm"
            onClick={lookupCustomer}
            style={{ whiteSpace: 'nowrap', minWidth: isMobile ? 56 : 'auto' }}
          >
            Find
          </button>
        </div>

        {customer && (
          <div style={{
            padding: isMobile ? '10px 16px' : '8px 12px',
            background: 'rgba(255,107,53,0.08)',
            borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexShrink: 0,
          }}>
            <div>
              <span style={{ fontSize: isMobile ? 14 : 13, fontWeight: 700, color: 'var(--primary)' }}>
                👤 {customer.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                {customer.loyalty_points} pts
              </span>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setCustomer(null);
                if (existingOrder) { try { api.patch(`/orders/${existingOrder.id}/customer`, { customer_id: null }); } catch { } }
              }}
              style={{ fontSize: 16, padding: '4px 8px' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Cart Items — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '4px 16px' : '8px 12px' }}>
          {cart.length === 0 ? (
            <div className="empty-state" style={{ padding: isMobile ? '48px 20px' : '40px 20px' }}>
              <div style={{ fontSize: isMobile ? 48 : 36 }}>🛒</div>
              <p style={{ fontSize: isMobile ? 15 : 14 }}>Cart is empty</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {isMobile ? 'Switch to Menu tab to add items' : 'Click items from the menu to add'}
              </p>
            </div>
          ) : (
            cart.map(item => (
              <div
                key={item.item_id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isMobile ? 10 : 8,
                  padding: isMobile ? '12px 0' : '8px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                {/* Item name + price */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: isMobile ? 14 : 13.5,
                    fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'var(--text-primary)',
                  }}>
                    {item.item_name}
                  </div>
                  <div style={{ fontSize: isMobile ? 13 : 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    {formatCurrency(item.unit_price)} each
                  </div>
                </div>

                {/* Qty controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 4, flexShrink: 0 }}>
                  <button
                    className="btn btn-secondary btn-sm btn-icon"
                    onClick={() => updateQty(item.item_id, -1)}
                    style={{
                      width: isMobile ? 34 : 28,
                      height: isMobile ? 34 : 28,
                      padding: 0,
                      fontSize: isMobile ? 18 : 14,
                      borderRadius: 8,
                    }}
                  >
                    −
                  </button>
                  <span style={{
                    fontSize: isMobile ? 16 : 14,
                    fontWeight: 700,
                    minWidth: isMobile ? 28 : 24,
                    textAlign: 'center',
                  }}>
                    {item.quantity}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm btn-icon"
                    onClick={() => updateQty(item.item_id, 1)}
                    style={{
                      width: isMobile ? 34 : 28,
                      height: isMobile ? 34 : 28,
                      padding: 0,
                      fontSize: isMobile ? 18 : 14,
                      borderRadius: 8,
                    }}
                  >
                    +
                  </button>
                </div>

                {/* Line total */}
                <div style={{
                  fontSize: isMobile ? 14 : 14,
                  fontWeight: 700,
                  color: 'var(--primary)',
                  minWidth: isMobile ? 68 : 64,
                  textAlign: 'right',
                  flexShrink: 0,
                }}>
                  {formatCurrency(item.unit_price * item.quantity)}
                </div>

                {/* Remove */}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => removeFromCart(item.item_id)}
                  style={{
                    color: 'var(--danger)',
                    padding: isMobile ? '6px 8px' : 4,
                    fontSize: isMobile ? 16 : 14,
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {/* Discount / Coupon */}
        <div style={{
          padding: isMobile ? '12px 16px' : '10px 12px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <select
              className="form-control"
              value={discount.type}
              onChange={e => setDiscount(d => ({ ...d, type: e.target.value }))}
              style={{ width: isMobile ? 130 : 120, fontSize: isMobile ? 14 : 12 }}
            >
              <option value="percentage">% Discount</option>
              <option value="flat">₹ Flat Off</option>
            </select>
            <input
              type="number"
              className="form-control"
              placeholder="0"
              value={discount.value || ''}
              onChange={e => setDiscount(d => ({ ...d, value: parseFloat(e.target.value) || 0 }))}
              style={{ flex: 1, fontSize: isMobile ? 14 : 12 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="form-control"
              placeholder="Coupon Code"
              value={couponCode}
              onChange={e => setCouponCode(e.target.value.toUpperCase())}
              style={{ flex: 1, fontSize: isMobile ? 14 : 12 }}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={validateCoupon}
              style={{ whiteSpace: 'nowrap', minWidth: isMobile ? 64 : 'auto' }}
            >
              Apply
            </button>
          </div>
          {customer?.loyalty_points > 0 && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                className="form-control"
                placeholder="Redeem points"
                value={loyaltyPoints || ''}
                max={customer.loyalty_points}
                onChange={e => setLoyaltyPoints(Math.min(parseInt(e.target.value) || 0, customer.loyalty_points))}
                style={{ flex: 1, fontSize: isMobile ? 14 : 12 }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                Max: {customer.loyalty_points}
              </span>
            </div>
          )}
        </div>

        {/* Bill Summary */}
        <div style={{
          padding: isMobile ? '12px 16px' : '10px 12px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-card)',
          flexShrink: 0,
        }}>
          {[
            ['Subtotal', formatCurrency(cartSubtotal)],
            discountAmt > 0 && ['Discount', `-${formatCurrency(discountAmt)}`, 'var(--success)'],
            couponDiscount > 0 && ['Coupon', `-${formatCurrency(couponDiscount)}`, 'var(--success)'],
            loyaltyDiscount > 0 && ['Points', `-${formatCurrency(loyaltyDiscount)}`, 'var(--accent)'],
            ['CGST (2.5%)', formatCurrency(cgst)],
            ['SGST (2.5%)', formatCurrency(sgst)],
          ].filter(Boolean).map(([label, val, col]) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: isMobile ? 13.5 : 12.5,
              marginBottom: isMobile ? 6 : 4,
            }}>
              <span style={{ color: 'var(--text-muted)' }}>{label}</span>
              <span style={{ color: col || 'var(--text-secondary)', fontWeight: 500 }}>{val}</span>
            </div>
          ))}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: isMobile ? 20 : 18,
            fontWeight: 800,
            marginTop: isMobile ? 10 : 8,
            paddingTop: isMobile ? 10 : 8,
            borderTop: '2px solid var(--border)',
          }}>
            <span>TOTAL</span>
            <span style={{ color: 'var(--primary)' }}>{formatCurrency(cartTotal)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          padding: isMobile ? '12px 16px' : 12,
          display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 8,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, height: isMobile ? 46 : 36, fontSize: isMobile ? 14 : 13 }}
              onClick={placeOrder}
              disabled={loading || !cart.length}
            >
              {loading ? <span className="loading-spinner" /> : '📋 Send KOT'}
            </button>
            <button
              className="btn btn-secondary btn-icon"
              onClick={() => setShowSplitModal(true)}
              title="Split Bill"
              style={{ width: isMobile ? 46 : 36, height: isMobile ? 46 : 36, fontSize: isMobile ? 18 : 14 }}
            >
              ⚡
            </button>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleGenerateBillOnly}
            disabled={loading || (!cart.length && !existingOrder)}
            style={{
              justifyContent: 'center',
              fontWeight: 700,
              height: isMobile ? 52 : 44,
              fontSize: isMobile ? 16 : 15,
              borderRadius: isMobile ? 12 : 8,
            }}
          >
            🧾 Generate Bill
          </button>
        </div>
      </div>


      {/* Mobile bottom tab bar — only shown on small screens */}
      {isMobile && (
        <div className="pos-mobile-tabs">
          <button
            className={`pos-mobile-tab ${mobileTab === 'menu' ? 'active' : ''}`}
            onClick={() => setMobileTab('menu')}
          >
            <span className="pos-mobile-tab-icon">🍽️</span>
            Menu
          </button>
          <button
            className={`pos-mobile-tab ${mobileTab === 'cart' ? 'active' : ''}`}
            onClick={() => setMobileTab('cart')}
          >
            <span className="pos-mobile-tab-icon" style={{ position: 'relative', display: 'inline-block' }}>
              🛒
              {cartItemCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: -6, right: -8,
                  background: 'var(--primary)',
                  color: 'white',
                  fontSize: 9,
                  fontWeight: 800,
                  width: 16, height: 16,
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {cartItemCount > 9 ? '9+' : cartItemCount}
                </span>
              )}
            </span>
            Cart{cartItemCount > 0 ? ` (${cartItemCount})` : ''}
          </button>
        </div>
      )}
    </div>
  );
}
