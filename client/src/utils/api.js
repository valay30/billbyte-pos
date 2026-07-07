import axios from 'axios';

/**
 * Extract tenant slug from subdomain.
 * Production:  caferoy.billbyte.com → "caferoy"
 * Development: localhost            → from localStorage or "demo"
 */
export function getTenantSlug() {
  // 1. URL query param (used by QR menu links: /menu/1?tenant=cafetwo)
  const urlParams = new URLSearchParams(window.location.search);
  const urlTenant = urlParams.get('tenant');
  if (urlTenant) return urlTenant.trim().toLowerCase();

  const hostname = window.location.hostname;

  // 2. Custom subdomain on a real domain (e.g. caferoy.billbyte.com)
  const isSharedHost = hostname.includes('onrender.com') || hostname.includes('vercel.app') || hostname === 'localhost' || hostname === '127.0.0.1';
  if (!isSharedHost) {
    const parts = hostname.split('.');
    if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'admin') {
      return parts[0];
    }
  }

  // 3. localStorage (set on login / restaurant code input)
  const stored = localStorage.getItem('billbyte_tenant_slug');
  if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim()) {
    return stored.trim().toLowerCase();
  }

  return 'demo';
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('billbyte_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Always send tenant slug so server knows which restaurant DB to use
  config.headers['X-Tenant-Slug'] = getTenantSlug();

  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('billbyte_token');
      localStorage.removeItem('billbyte_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
