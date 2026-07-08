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

  // 2. localStorage (set on login / restaurant code input)
  const stored = localStorage.getItem('billbyte_tenant_slug');
  if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim()) {
    return stored.trim().toLowerCase();
  }

  return 'demo';
}

const api = axios.create({
  // Use relative '/api' so it automatically uses the current domain (e.g. Render or localhost)
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('billbyte_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Only set the tenant slug if it hasn't been explicitly passed in the request headers
  // (e.g. during the login request where we want to use what the user typed)
  if (!config.headers['X-Tenant-Slug'] && !config.headers['x-tenant-slug']) {
    config.headers['X-Tenant-Slug'] = getTenantSlug();
  }

  return config;
});

api.interceptors.response.use(
  response => response,
  error => {
    // If unauthorized, OR if the restaurant was deleted (404 Restaurant not found)
    const isTenantMissing = error.response?.status === 404 && error.response?.data?.error?.includes('not found');
    
    if (error.response?.status === 401 || isTenantMissing) {
      localStorage.removeItem('billbyte_token');
      localStorage.removeItem('billbyte_user');
      localStorage.removeItem('billbyte_tenant_slug');
      
      // Only redirect if we are not already on the login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
