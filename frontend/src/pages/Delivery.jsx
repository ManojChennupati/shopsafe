import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { formatINR, Spinner } from '../components/Shared';

function LoginGate({ onLogin }) {
  const [pw, setPw] = useState('');
  function handleLogin() {
    if (!pw) { toast.error('Enter delivery password'); return; }
    sessionStorage.setItem('delivery_password', pw);
    onLogin();
  }
  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚚</div>
      <h2 style={{ marginBottom: '0.5rem' }}>Delivery Portal</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Authorized delivery operators only
      </p>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Delivery Password</label>
          <input
            id="delivery-password"
            className="form-input"
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Enter operator password"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <button id="delivery-login-btn" className="btn btn-primary btn-full" onClick={handleLogin}>
          Login
        </button>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          Demo password: <code>deliver123</code>
        </p>
      </div>
    </div>
  );
}

export default function Delivery() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('delivery_password'));
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmResult, setConfirmResult] = useState(null);

  useEffect(() => { if (authed) fetchOrders(); }, [authed]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const d = await api.getPendingDeliveries();
      setOrders(d.orders);
    } catch (err) {
      if (err.message.includes('authorization')) {
        sessionStorage.removeItem('delivery_password');
        setAuthed(false);
      }
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }

  async function handleMarkOutForDelivery(orderId) {
    try {
      await api.markOutForDelivery(orderId);
      toast.success('Marked as out for delivery');
      fetchOrders();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleLoadOtp(orderId) {
    try {
      const d = await api.getDeliveryOtp(orderId);
      setDevOtp(d.otp);
    } catch (err) {
      toast.error('Could not load OTP');
    }
  }

  async function handleConfirmDelivery() {
    if (!otp) { toast.error('Enter OTP'); return; }
    setConfirmLoading(true);
    setConfirmResult(null);
    try {
      const result = await api.confirmDelivery(selectedOrder.orderId, otp);
      setConfirmResult({ success: true, message: result.message });
      toast.success('Delivery confirmed!');
      fetchOrders();
      setSelectedOrder(null);
      setOtp('');
      setDevOtp(null);
    } catch (err) {
      setConfirmResult({ success: false, message: err.message });
      toast.error(err.message);
    } finally {
      setConfirmLoading(false);
    }
  }

  if (!authed) return <div className="page container"><LoginGate onLogin={() => setAuthed(true)} /></div>;

  return (
    <div className="page container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="section-title">🚚 Delivery Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Manage and confirm customer deliveries
          </p>
        </div>
        <button className="btn btn-ghost" onClick={fetchOrders}>🔄 Refresh</button>
      </div>

      {loading && <Spinner message="Loading orders..." />}

      {!loading && orders.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <div className="empty-title">All deliveries complete!</div>
          <div className="empty-desc">No pending deliveries at the moment</div>
        </div>
      )}

      {orders.map(order => (
        <div key={order.orderId} className="order-card fade-in">
          <div className="order-header">
            <div>
              <div className="order-id">{order.orderId}</div>
              <div className="order-meta">
                {order.customerName} · {order.shippingAddress?.slice(0, 60)}…
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {order.items?.map(i => `${i.name} × ${i.quantity}`).join(', ')} · {formatINR(order.totalINR)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
              <span className={`badge ${order.deliveryStatus === 'OUT_FOR_DELIVERY' ? 'badge-warning' : 'badge-primary'}`}>
                {order.deliveryStatus === 'OUT_FOR_DELIVERY' ? '🚚 Out for Delivery' : '📦 Processing'}
              </span>
              {order.paymentStatus === 'CONFIRMED' && order.deliveryStatus !== 'OUT_FOR_DELIVERY' && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}
                  onClick={() => handleMarkOutForDelivery(order.orderId)}
                >
                  Mark Out for Delivery
                </button>
              )}
            </div>
          </div>

          {order.paymentStatus === 'CONFIRMED' && (
            <button
              id={`confirm-delivery-${order.orderId}`}
              className="btn btn-success"
              style={{ marginTop: '0.75rem' }}
              onClick={async () => {
                setSelectedOrder(order);
                setOtp('');
                setDevOtp(null);
                setConfirmResult(null);
                await handleLoadOtp(order.orderId);
              }}
            >
              🔢 Confirm Delivery with OTP
            </button>
          )}
        </div>
      ))}

      {/* OTP Confirm Modal */}
      {selectedOrder && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem'
        }}>
          <div className="card fade-in" style={{ maxWidth: 440, width: '100%' }}>
            <div className="card-title">🔢 Delivery Confirmation OTP</div>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Order: <strong>{selectedOrder.orderId}</strong><br />
              Customer: {selectedOrder.customerName}
            </p>

            {devOtp && (
              <div className="otp-display">
                <div className="otp-note">Dev Mode — Customer OTP</div>
                <div className="otp-code">{devOtp}</div>
                <div className="otp-note">Use this code to simulate delivery confirmation</div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Enter OTP from Customer</label>
              <input
                id="otp-input"
                className="form-input"
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="6-digit OTP"
                maxLength={6}
                style={{ fontSize: '1.2rem', textAlign: 'center', letterSpacing: '0.2em' }}
              />
            </div>

            {confirmResult && (
              <div className={`alert ${confirmResult.success ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '1rem' }}>
                {confirmResult.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                id="submit-otp-btn"
                className="btn btn-success"
                style={{ flex: 1 }}
                onClick={handleConfirmDelivery}
                disabled={confirmLoading}
              >
                {confirmLoading ? '⏳ Confirming...' : '✅ Confirm Delivery'}
              </button>
              <button className="btn btn-ghost" onClick={() => { setSelectedOrder(null); setDevOtp(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
