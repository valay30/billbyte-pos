export const formatCurrency = (amount) => {
  return `₹${parseFloat(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

export const formatTime = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
};

export const getTimeSince = (dateStr) => {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const min = Math.floor(diff / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m ago`;
};

export const getMinutesSince = (dateStr) => {
  return Math.floor((Date.now() - new Date(dateStr)) / 60000);
};

export const calculateGST = (subtotal, taxCategory = 'gst5') => {
  const rates = { gst5: 5, gst12: 12, gst18: 18, exempt: 0 };
  const rate = rates[taxCategory] || 5;
  const cgst = (subtotal * (rate / 2)) / 100;
  const sgst = (subtotal * (rate / 2)) / 100;
  return { cgst, sgst, rate, total_tax: cgst + sgst };
};

export const getLoyaltyTierColor = (tier) => {
  const colors = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
  };
  return colors[tier] || '#CD7F32';
};

export const getStatusBadge = (status) => {
  const map = {
    pending: 'badge-warning',
    confirmed: 'badge-info',
    in_progress: 'badge-primary',
    ready: 'badge-success',
    served: 'badge-muted',
    paid: 'badge-success',
    cancelled: 'badge-danger',
    available: 'badge-success',
    occupied: 'badge-danger',
    reserved: 'badge-warning',
    low: 'badge-danger',
    completed: 'badge-success',
  };
  return map[status] || 'badge-muted';
};

export const printContent = (html, title = 'Print') => {
  const win = window.open('', '_blank', 'width=380,height=600');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <meta charset="utf-8">
      <style>
        @page {
          size: 80mm auto;
          margin: 0mm;
        }
        @media print {
          body {
            width: 76mm;
            margin: 0 auto;
            padding: 2mm;
            background: #fff;
            color: #000;
          }
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          color: #000;
          background: #fff;
          width: 76mm;
          max-width: 76mm;
          margin: 10px auto;
          padding: 6px;
          box-sizing: border-box;
          line-height: 1.35;
        }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .solid-divider { border-top: 1px solid #000; margin: 6px 0; }
        .double-divider { border-top: 3px double #000; margin: 6px 0; }
        .center { text-align: center; }
        .right { text-align: right; }
        .left { text-align: left; }
        .bold { font-weight: bold; }
        .title { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
        .subtitle { font-size: 11px; margin-bottom: 2px; }
        .meta-table { width: 100%; font-size: 11px; margin: 4px 0; border-collapse: collapse; }
        .meta-table td { padding: 1px 0; vertical-align: top; }
        .items-table { width: 100%; font-size: 12px; margin: 6px 0; border-collapse: collapse; }
        .items-table th { border-bottom: 1px dashed #000; padding: 4px 0; font-size: 11px; text-transform: uppercase; }
        .items-table td { padding: 4px 0; vertical-align: top; }
        .summary-table { width: 100%; font-size: 12px; margin: 4px 0; border-collapse: collapse; }
        .summary-table td { padding: 2px 0; }
        .total-row { font-size: 15px; font-weight: bold; }
        .total-row td { border-top: 1px solid #000; border-bottom: 2px solid #000; padding: 6px 0; }
        .footer { font-size: 11px; text-align: center; margin-top: 10px; padding-top: 6px; border-top: 1px dashed #000; }
        .barcode-box { text-align: center; margin: 10px auto; font-family: 'Courier New', monospace; font-size: 13px; font-weight: bold; letter-spacing: 2px; border: 1px solid #000; padding: 4px; width: 80%; }
        table { width: 100%; border-collapse: collapse; }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `);
  win.document.close();
  setTimeout(() => { win.print(); win.close(); }, 350);
};

export const generateBillHTML = (order, settings = {}) => {
  const items = order.items || [];
  const restName = settings.restaurant_name || 'BillByte Restaurant';
  const restAddr = settings.restaurant_address || '';
  const restPhone = settings.restaurant_phone || '';
  const restGST = settings.restaurant_gstin || '';
  const footer = settings.receipt_footer || 'Thank you for dining with us! Visit again.';

  const itemRows = items.map(i => `
    <tr>
      <td class="left" style="width: 15%;">${i.quantity}x</td>
      <td class="left" style="width: 55%;">
        <div class="bold">${i.item_name}</div>
        ${i.notes ? `<div style="font-size: 10px; color: #444;">* ${i.notes}</div>` : ''}
      </td>
      <td class="right" style="width: 30%;">₹${parseFloat(i.total_price || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  return `
    <div class="center">
      <div class="title">${restName}</div>
      ${restAddr ? `<div class="subtitle">${restAddr}</div>` : ''}
      ${restPhone ? `<div class="subtitle">Tel: ${restPhone}</div>` : ''}
      ${restGST ? `<div class="subtitle bold">GSTIN: ${restGST}</div>` : ''}
    </div>
    <div class="double-divider"></div>
    <table class="meta-table">
      <tr>
        <td class="left"><b>Bill #:</b> ${order.order_number || '-'}</td>
        <td class="right"><b>Table:</b> ${order.table_name || '-'}</td>
      </tr>
      <tr>
        <td class="left"><b>Date:</b> ${new Date(order.created_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
        <td class="right"><b>Time:</b> ${new Date(order.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
      </tr>
      ${order.customer_name ? `<tr><td colspan="2" class="left"><b>Customer:</b> ${order.customer_name}</td></tr>` : ''}
      <tr>
        <td colspan="2" class="left"><b>Type:</b> ${(order.order_type || 'Dine In').toUpperCase().replace('_', ' ')}</td>
      </tr>
    </table>
    <div class="divider"></div>
    <table class="items-table">
      <thead>
        <tr>
          <th class="left" style="width: 15%;">QTY</th>
          <th class="left" style="width: 55%;">ITEM</th>
          <th class="right" style="width: 30%;">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
    <div class="divider"></div>
    <table class="summary-table">
      <tr>
        <td class="left">Subtotal</td>
        <td class="right">₹${parseFloat(order.subtotal || 0).toFixed(2)}</td>
      </tr>
      ${parseFloat(order.discount_amount) > 0 ? `
      <tr>
        <td class="left">Discount ${order.coupon_code ? `(${order.coupon_code})` : ''}${order.loyalty_points_used > 0 ? ` (${order.loyalty_points_used} pts redeemed)` : ''}</td>
        <td class="right">-₹${parseFloat(order.discount_amount).toFixed(2)}</td>
      </tr>` : ''}
      ${parseFloat(order.cgst) > 0 ? `
      <tr>
        <td class="left">CGST</td>
        <td class="right">₹${parseFloat(order.cgst).toFixed(2)}</td>
      </tr>` : ''}
      ${parseFloat(order.sgst) > 0 ? `
      <tr>
        <td class="left">SGST</td>
        <td class="right">₹${parseFloat(order.sgst).toFixed(2)}</td>
      </tr>` : ''}
      <tr class="total-row">
        <td class="left">GRAND TOTAL</td>
        <td class="right">₹${parseFloat(order.total || 0).toFixed(2)}</td>
      </tr>
    </table>
    ${(() => {
      const ptsPerRupee = parseFloat(settings.loyalty_points_per_rupee || '0.1');
      const earnedPoints = Math.floor((order.total || 0) * ptsPerRupee);
      const redeemedPoints = parseInt(order.loyalty_points_used || 0, 10);
      const currentBalance = order.loyalty_points !== undefined && order.loyalty_points !== null ? parseInt(order.loyalty_points, 10) : null;
      const newBalance = currentBalance !== null ? (currentBalance + earnedPoints - redeemedPoints) : null;
      return order.customer_name ? `
      <div class="divider"></div>
      <div style="font-size: 11px; margin: 6px 0; background: #f8f9fa; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
        <div class="bold center" style="font-size: 11px; margin-bottom: 4px; color: #000;">🎁 LOYALTY PROGRAM</div>
        <table class="summary-table" style="font-size: 11px; width: 100%;">
          <tr>
            <td class="left">Phone:</td>
            <td class="right bold">${order.customer_phone || order.customer_name}</td>
          </tr>
          <tr>
            <td class="left">Points Earned (This Bill):</td>
            <td class="right bold" style="color: #1a7f37;">+${earnedPoints} pts</td>
          </tr>
          ${redeemedPoints > 0 ? `
          <tr>
            <td class="left">Points Redeemed:</td>
            <td class="right bold" style="color: #d1242f;">-${redeemedPoints} pts</td>
          </tr>` : ''}
          ${currentBalance !== null ? `
          <tr>
            <td class="left" style="border-top: 1px dashed #bbb; padding-top: 3px;"><b>Total Balance:</b></td>
            <td class="right bold" style="border-top: 1px dashed #bbb; padding-top: 3px;">${order.status === 'paid' ? currentBalance : newBalance} pts</td>
          </tr>` : ''}
        </table>
      </div>` : '';
    })()}
    <div class="divider"></div>
    <div class="center">
      <div class="barcode-box">*${order.order_number || 'ORDER'}*</div>
    </div>
    <div class="footer">
      ${footer.replace(/\n/g, '<br>')}
      <div style="margin-top: 4px; font-size: 9px; color: #555;">Printed on ${new Date().toLocaleString('en-IN')}</div>
    </div>
  `;
};

export const generateKOTHTML = (kot) => {
  const items = kot.items || [];
  return `
    <div class="center">
      <div class="title" style="font-size: 18px; border-bottom: 2px solid #000; padding-bottom: 4px;">KITCHEN ORDER TICKET</div>
    </div>
    <table class="meta-table" style="margin-top: 8px; font-size: 13px;">
      <tr>
        <td class="left"><b>KOT #:</b> ${kot.kot_number || '-'}</td>
        <td class="right"><b>Table:</b> <span style="font-size: 15px; font-weight: bold; background: #000; color: #fff; padding: 1px 4px;">${kot.table_name || '-'}</span></td>
      </tr>
      <tr>
        <td class="left"><b>Order #:</b> ${kot.order_number || '-'}</td>
        <td class="right"><b>Time:</b> ${new Date(kot.created_at || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
      </tr>
      ${kot.waiter_name ? `<tr><td colspan="2"><b>Waiter:</b> ${kot.waiter_name}</td></tr>` : ''}
    </table>
    <div class="double-divider"></div>
    <table class="items-table" style="font-size: 14px;">
      <thead>
        <tr>
          <th class="left" style="width: 20%; border-bottom: 2px solid #000;">QTY</th>
          <th class="left" style="width: 80%; border-bottom: 2px solid #000;">ITEM & NOTES</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td class="left bold" style="font-size: 16px;">${i.quantity}x</td>
            <td class="left">
              <div class="bold" style="font-size: 15px;">${i.item_name}</div>
              ${i.notes ? `<div style="font-size: 12px; font-weight: bold; border-left: 2px solid #000; padding-left: 4px; margin-top: 2px;">⚠️ Note: ${i.notes}</div>` : ''}
            </td>
          </tr>
          <tr><td colspan="2"><div class="divider" style="margin: 3px 0;"></div></td></tr>
        `).join('')}
      </tbody>
    </table>
    <div class="center" style="margin-top: 10px; font-size: 11px; font-weight: bold;">
      --- END OF KOT ---
    </div>
  `;
};
