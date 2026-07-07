require('dotenv').config();
const bcrypt = require('bcryptjs');
const { getTenantDb, saveTenantDb } = require('./db');
const { initSchema } = require('./schema');

async function seed() {
  await initSchema('demo');
  const db = await getTenantDb('demo');

  console.log('🌱 Seeding database...');

  const cleanDuplicates = () => {
    const tablesToDedupe = [
      ['tables', 'name'],
      ['menu_categories', 'name'],
      ['menu_items', 'name'],
      ['inventory_items', 'name'],
      ['customers', 'phone'],
      ['users', 'email']
    ];
    tablesToDedupe.forEach(([tbl, col]) => {
      try {
        db.prepare(`DELETE FROM ${tbl} WHERE id NOT IN (SELECT MIN(id) FROM ${tbl} GROUP BY ${col})`).run();
      } catch(e) {}
    });
  };
  cleanDuplicates();

  // Settings
  const settings = [
    ['restaurant_name', 'BillByte Restaurant'],
    ['restaurant_address', '123 Food Street, Mumbai, Maharashtra 400001'],
    ['restaurant_phone', '+91 98765 43210'],
    ['restaurant_email', 'info@billbyte.in'],
    ['restaurant_gstin', '27AABCU9603R1ZX'],
    ['currency_symbol', '₹'],
    ['gst_type', 'cgst_sgst'],
    ['cgst_rate', '2.5'],
    ['sgst_rate', '2.5'],
    ['loyalty_points_per_rupee', '0.1'],
    ['loyalty_redemption_ratio', '100'],
    ['table_qr_base_url', 'http://localhost:5173/menu'],
    ['kot_printer', 'browser'],
    ['receipt_footer', 'Thank you for dining with us! Visit again.'],
    ['low_stock_threshold', '10'],
  ];

  settings.forEach(([key, value]) => {
    try {
      db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run([key, value]);
    } catch (e) {}
  });

  // Admin User
  const adminPass = bcrypt.hashSync('admin123', 10);
  const managerPass = bcrypt.hashSync('manager123', 10);
  const cashierPass = bcrypt.hashSync('cashier123', 10);
  const waiterPass = bcrypt.hashSync('waiter123', 10);
  const kitchenPass = bcrypt.hashSync('kitchen123', 10);

  const users = [
    ['Admin User', 'admin@savoria.in', adminPass, 'admin', '+91 98765 00001'],
    ['Riya Sharma', 'manager@savoria.in', managerPass, 'manager', '+91 98765 00002'],
    ['Arjun Patel', 'cashier@savoria.in', cashierPass, 'cashier', '+91 98765 00003'],
    ['Priya Singh', 'waiter1@savoria.in', waiterPass, 'waiter', '+91 98765 00004'],
    ['Raj Kumar', 'waiter2@savoria.in', waiterPass, 'waiter', '+91 98765 00005'],
    ['Chef Mahesh', 'kitchen@savoria.in', kitchenPass, 'kitchen', '+91 98765 00006'],
  ];

  users.forEach(([name, email, password, role, phone]) => {
    try {
      db.prepare('INSERT OR IGNORE INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)').run([name, email, password, role, phone]);
    } catch (e) {}
  });

  // Tables
  const tables = [
    ['T1', 2, 'Main Hall', 50, 80, 'circle'],
    ['T2', 4, 'Main Hall', 200, 80, 'square'],
    ['T3', 4, 'Main Hall', 350, 80, 'square'],
    ['T4', 6, 'Main Hall', 50, 220, 'rectangle'],
    ['T5', 4, 'Main Hall', 200, 220, 'square'],
    ['T6', 4, 'Main Hall', 350, 220, 'square'],
    ['T7', 2, 'Outdoor', 50, 80, 'circle'],
    ['T8', 4, 'Outdoor', 200, 80, 'square'],
    ['T9', 8, 'Private Room', 50, 80, 'rectangle'],
    ['T10', 4, 'Bar', 50, 80, 'circle'],
  ];

  tables.forEach(([name, capacity, section, x_pos, y_pos, shape]) => {
    try {
      db.prepare('INSERT OR IGNORE INTO tables (name, capacity, section, x_pos, y_pos, shape, status) VALUES (?, ?, ?, ?, ?, ?, ?)').run([name, capacity, section, x_pos, y_pos, shape, 'available']);
    } catch (e) {}
  });

  // Menu Categories
  const categories = [
    ['Starters', 'Appetizers & Soups', '🥗', '#FF6B35'],
    ['Main Course', 'Indian & Continental Mains', '🍛', '#E74C3C'],
    ['Breads', 'Fresh Baked Breads & Rotis', '🫓', '#F39C12'],
    ['Rice & Biryani', 'Dum Biryani & Pulao', '🍚', '#9B59B6'],
    ['Desserts', 'Sweets & Ice Creams', '🍮', '#E91E63'],
    ['Beverages', 'Drinks & Juices', '🥤', '#2196F3'],
    ['Pizza & Pasta', 'Italian Specialties', '🍕', '#4CAF50'],
    ['Combos & Meals', 'Value Meal Combos', '🍱', '#FF9800'],
  ];

  categories.forEach(([name, description, icon, color], i) => {
    try {
      db.prepare('INSERT OR IGNORE INTO menu_categories (name, description, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)').run([name, description, icon, color, i]);
    } catch (e) {}
  });

  // Menu Items (Sample)
  const items = [
    // Starters (cat 1)
    [1, 'Veg Spring Rolls', 'Crispy fried rolls with vegetable filling', 180, 1, 'gst5', 10],
    [1, 'Paneer Tikka', 'Grilled cottage cheese with spices', 280, 1, 'gst5', 15],
    [1, 'Chicken 65', 'Spicy deep-fried chicken', 320, 0, 'gst5', 12],
    [1, 'Soup of the Day', 'Chef\'s special soup', 150, 1, 'gst5', 8],
    [1, 'Mushroom Crispy', 'Battered crispy mushrooms', 220, 1, 'gst5', 10],
    // Main Course (cat 2)
    [2, 'Dal Makhani', 'Slow cooked black lentils in butter', 260, 1, 'gst5', 20],
    [2, 'Paneer Butter Masala', 'Cottage cheese in rich tomato gravy', 300, 1, 'gst5', 20],
    [2, 'Chicken Tikka Masala', 'Grilled chicken in creamy masala', 380, 0, 'gst5', 20],
    [2, 'Fish Curry', 'Coastal style fish curry', 420, 0, 'gst5', 25],
    [2, 'Mix Veg Curry', 'Seasonal vegetables in curry sauce', 240, 1, 'gst5', 18],
    // Breads (cat 3)
    [3, 'Butter Naan', 'Soft leavened bread with butter', 60, 1, 'gst5', 8],
    [3, 'Garlic Naan', 'Naan with garlic and coriander', 80, 1, 'gst5', 8],
    [3, 'Tandoori Roti', 'Whole wheat tandoor bread', 40, 1, 'gst5', 5],
    [3, 'Lachha Paratha', 'Layered whole wheat bread', 70, 1, 'gst5', 8],
    // Rice & Biryani (cat 4)
    [4, 'Veg Biryani', 'Aromatic basmati rice with vegetables', 280, 1, 'gst5', 25],
    [4, 'Chicken Biryani', 'Dum style chicken biryani', 380, 0, 'gst5', 30],
    [4, 'Mutton Biryani', 'Slow cooked mutton biryani', 460, 0, 'gst5', 35],
    [4, 'Jeera Rice', 'Basmati rice with cumin', 140, 1, 'gst5', 10],
    // Desserts (cat 5)
    [5, 'Gulab Jamun', 'Soft khoya balls in sugar syrup', 120, 1, 'gst5', 5],
    [5, 'Kulfi', 'Traditional Indian ice cream', 140, 1, 'gst5', 5],
    [5, 'Rasgulla', 'Soft cottage cheese balls in syrup', 110, 1, 'gst5', 5],
    [5, 'Ice Cream (2 scoops)', 'Vanilla, Chocolate or Strawberry', 160, 1, 'gst5', 3],
    // Beverages (cat 6)
    [6, 'Masala Chai', 'Spiced Indian tea', 60, 1, 'gst5', 5],
    [6, 'Fresh Lime Soda', 'Lime, soda and mint', 80, 1, 'gst5', 3],
    [6, 'Mango Lassi', 'Yogurt based mango drink', 120, 1, 'gst5', 5],
    [6, 'Cold Coffee', 'Chilled blended coffee', 160, 1, 'gst5', 5],
    [6, 'Fresh Juice', 'Seasonal fruit juice', 140, 1, 'gst5', 5],
    // Pizza (cat 7)
    [7, 'Margherita Pizza', 'Classic tomato and cheese pizza', 299, 1, 'gst12', 20],
    [7, 'Paneer Pizza', 'Spiced paneer topping pizza', 349, 1, 'gst12', 20],
    [7, 'Chicken Supreme Pizza', 'Loaded chicken pizza', 399, 0, 'gst12', 20],
    [7, 'Veg Pasta Arrabiata', 'Penne in spicy tomato sauce', 249, 1, 'gst12', 15],
  ];

  items.forEach(([cat_id, name, desc, price, is_veg, tax, prep]) => {
    try {
      db.prepare('INSERT OR IGNORE INTO menu_items (category_id, name, description, price, is_veg, tax_category, preparation_time) VALUES (?, ?, ?, ?, ?, ?, ?)').run([cat_id, name, desc, price, is_veg, tax, prep]);
    } catch (e) {}
  });

  // Coupons
  const coupons = [
    ['WELCOME10', 'Welcome 10% off', 'percentage', 10, 200, 100, null],
    ['FLAT50', '₹50 flat discount', 'flat', 50, 300, null, null],
    ['WEEKEND20', 'Weekend 20% off', 'percentage', 20, 500, 200, 10],
    ['LOYALTY15', '15% off for loyal customers', 'percentage', 15, 400, 150, null],
  ];

  coupons.forEach(([code, desc, type, value, min_amt, max_disc, limit]) => {
    try {
      db.prepare('INSERT OR IGNORE INTO coupons (code, description, discount_type, discount_value, min_order_amount, max_discount, usage_limit) VALUES (?, ?, ?, ?, ?, ?, ?)').run([code, desc, type, value, min_amt, max_disc, limit]);
    } catch (e) {}
  });

  // Inventory Items
  const invItems = [
    ['Tomato', 'kg', 5, 2, 30, 'Vegetables'],
    ['Onion', 'kg', 8, 3, 25, 'Vegetables'],
    ['Paneer', 'kg', 3, 1, 280, 'Dairy'],
    ['Chicken', 'kg', 5, 2, 180, 'Meat'],
    ['Basmati Rice', 'kg', 10, 3, 90, 'Grains'],
    ['Cooking Oil', 'litre', 5, 2, 140, 'Oils'],
    ['Milk', 'litre', 8, 3, 60, 'Dairy'],
    ['Wheat Flour', 'kg', 10, 3, 45, 'Grains'],
    ['Butter', 'kg', 2, 1, 500, 'Dairy'],
    ['Garam Masala', 'kg', 0.5, 0.2, 900, 'Spices'],
  ];

  invItems.forEach(([name, unit, stock, min_stock, cost, category]) => {
    try {
      db.prepare('INSERT OR IGNORE INTO inventory_items (name, unit, current_stock, min_stock, cost_per_unit, category) VALUES (?, ?, ?, ?, ?, ?)').run([name, unit, stock, min_stock, cost, category]);
    } catch (e) {}
  });

  // Sample Customers
  const customers = [
    ['Rahul Verma', '+91 98001 11111', 'rahul@email.com', 250, 'silver', 8, 4500],
    ['Sneha Gupta', '+91 98001 22222', 'sneha@email.com', 100, 'bronze', 3, 1200],
    ['Amit Shah', '+91 98001 33333', 'amit@email.com', 500, 'gold', 15, 9800],
    ['Priya Nair', '+91 98001 44444', 'priya@email.com', 50, 'bronze', 2, 600],
    ['Vikram Malhotra', '+91 98001 55555', 'vikram@email.com', 1200, 'platinum', 40, 25000],
  ];

  customers.forEach(([name, phone, email, points, tier, visits, spent]) => {
    try {
      db.prepare('INSERT OR IGNORE INTO customers (name, phone, email, loyalty_points, loyalty_tier, total_visits, total_spent) VALUES (?, ?, ?, ?, ?, ?, ?)').run([name, phone, email, points, tier, visits, spent]);
    } catch (e) {}
  });

  cleanDuplicates();
  saveTenantDb('demo');
  console.log('✅ Database seeded successfully!');
  console.log('\n🔐 Demo Login Credentials:');
  console.log('  Admin:   admin@savoria.in   / admin123');
  console.log('  Manager: manager@savoria.in / manager123');
  console.log('  Cashier: cashier@savoria.in / cashier123');
  console.log('  Waiter:  waiter1@savoria.in / waiter123');
  console.log('  Kitchen: kitchen@savoria.in / kitchen123');
}

seed().catch(console.error);
