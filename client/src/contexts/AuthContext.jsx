import React, { createContext, useContext, useState } from 'react';
import api, { getTenantSlug } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('billbyte_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token, user } = res.data;
      localStorage.setItem('billbyte_token', token);
      localStorage.setItem('billbyte_user', JSON.stringify(user));
      // ✅ Persist the tenant slug from the server's response so all
      // subsequent API calls (menu, orders, etc.) use the correct restaurant.
      if (user?.tenantSlug) {
        localStorage.setItem('billbyte_tenant_slug', user.tenantSlug);
      }
      setUser(user);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('billbyte_token');
    localStorage.removeItem('billbyte_user');
    localStorage.removeItem('billbyte_tenant_slug');
    setUser(null);
  };

  const hasRole = (...roles) => roles.includes(user?.role);
  const isAdmin = () => user?.role === 'admin';
  const isManager = () => ['admin', 'manager'].includes(user?.role);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, hasRole, isAdmin, isManager }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
