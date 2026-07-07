import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import POS from './pages/pos/POS';
import Tables from './pages/tables/Tables';
import Kitchen from './pages/kitchen/Kitchen';
import Orders from './pages/Orders';
import MenuManager from './pages/menu/MenuManager';
import Inventory from './pages/inventory/Inventory';
import CRM from './pages/crm/CRM';
import Reports from './pages/reports/Reports';
import Settings from './pages/settings/Settings';
import CustomerMenu from './pages/customer/CustomerMenu';
import SuperAdmin from './pages/superadmin/SuperAdmin';

function ProtectedRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      {/* Super Admin — no auth required, protected by master key inside */}
      <Route path="/superadmin" element={<SuperAdmin />} />

      {/* Public customer QR page */}
      <Route path="/menu/:tableId" element={<CustomerMenu />} />

      {/* Auth */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/forgot-password" element={user ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />
      <Route path="/reset-password" element={user ? <Navigate to="/dashboard" replace /> : <ResetPassword />} />

      {/* Protected app */}
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="tables" element={<Tables />} />
        <Route path="kitchen" element={<Kitchen />} />
        <Route path="orders" element={<Orders />} />
        <Route path="menu" element={<ProtectedRoute roles={['admin', 'manager']}><MenuManager /></ProtectedRoute>} />
        <Route path="inventory" element={<ProtectedRoute roles={['admin', 'manager']}><Inventory /></ProtectedRoute>} />
        <Route path="crm" element={<ProtectedRoute roles={['admin', 'manager']}><CRM /></ProtectedRoute>} />
        <Route path="reports" element={<ProtectedRoute roles={['admin', 'manager']}><Reports /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute roles={['admin']}><Settings /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  React.useEffect(() => {
    const theme = localStorage.getItem('billbyte_theme') || 'light';
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
