// Simple API client — all calls go through Vite proxy to /api
const BASE = '/api';

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);

  // Inject demo passwords if stored in session
  const adminPw = sessionStorage.getItem('admin_password');
  const deliverPw = sessionStorage.getItem('delivery_password');
  if (adminPw) opts.headers['x-admin-password'] = adminPw;
  if (deliverPw) opts.headers['x-delivery-password'] = deliverPw;

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

export const api = {
  // Products
  getProducts: () => request('GET', '/products'),
  getProduct: (id) => request('GET', `/products/${id}`),

  // Orders
  createOrder: (body) => request('POST', '/orders', body),
  checkout: (orderId, body) => request('POST', `/orders/${orderId}/checkout`, body),
  getOrder: (orderId) => request('GET', `/orders/${orderId}`),
  getOrdersByEmail: (email) => request('GET', `/orders/customer/${email}`),
  raiseDispute: (orderId, reason) => request('POST', `/orders/${orderId}/dispute`, { reason }),
  getDeliveryOtp: (orderId) => request('GET', `/orders/${orderId}/delivery-otp`),

  // Delivery operator
  getPendingDeliveries: () => request('GET', '/orders/delivery/pending'),
  markOutForDelivery: (orderId) => request('PATCH', `/orders/${orderId}/out-for-delivery`),
  confirmDelivery: (orderId, otp) =>
    request('POST', `/orders/${orderId}/confirm-delivery`, { otp }),

  // Admin
  getAllOrders: () => request('GET', '/admin/orders'),
  getDisputes: () => request('GET', '/admin/disputes'),
  getAdminOrder: (orderId) => request('GET', `/admin/orders/${orderId}`),
  adminRelease: (orderId) => request('POST', `/admin/resolve/${orderId}/release`),
  adminRefund: (orderId) => request('POST', `/admin/resolve/${orderId}/refund`),
  triggerSettlement: () => request('POST', '/admin/trigger-settlement'),
  blockchainHealth: () => request('GET', '/admin/blockchain-health'),
};
