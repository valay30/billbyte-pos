import axios from 'axios';

/**
 * Extract tenant slug from subdomain.
 * Production:  caferoy.billbyte.com → "caferoy"
 * Development: localhost            → from localStorage or "demo"
 */
export function getTenantSlug() {
  const hostname = window.location.hostname;
  
  // Do not try to extract subdomains if we are using free hosting domains
  if (hostname.includes('onrender.com') || hostname.includes('vercel.app') || hostname === 'localhost') {
    return localStorage.getItem('billbyte_tenant_slug') || 'demo';
  }

  const parts = hostname.split('.');
  // Subdomain detected (e.g. caferoy.billbyte.com)
  if (parts.length >= 3 && parts[0] !== 'www' && parts[0] !== 'admin') {
    return parts[0];
  }
  
  // Local development / Fallback
  return localStorage.getItem('billbyte_tenant_slug') || 'demo';
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
