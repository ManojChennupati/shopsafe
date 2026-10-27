import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { getStatusBadge, OrderProgress, formatINR, Spinner } from '../components/Shared';

function DisputeModal({ orderId, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (reason.trim().length < 5) { toast.error('Please describe the issue'); return; }
    setLoading(true);
    try {
      await onSubmit(reason);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem'
    }}>
      <div className="card fade-in" style={{ maxWidth: 480, width: '100%' }}>
        <div className="card-title">⚠️ Raise a Dispute</div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Please describe the delivery issue. Our team will review and resolve within 24 hours.
        </p>
        <div className="form-group">
          <label className="form-label">Reason for Dispute</label>
          <textarea
            id="dispute-reason"
            className="form-input"
            rows={4}
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Received wrong item, package was damaged, item not delivered..."
            style={{ resize: 'vertical' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-danger" onClick={handleSubmit} disabled={loading} style={{ flex: 1 }}>
            {loading ? '...' : '⚠️ Submit Dispute'}
          </button>
          <button className="btn btn-ghost" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderCard({ order, onDispute }) {
  const badge = getStatusBadge(order);
  const canDispute = ['FUNDED', 'DELIVERY_CONFIRMED'].includes(order.escrowStatus) && !order.isDisputed;

  return (
    <div className="order-card fade-in">
      <div className="order-header">
        <div>
          <div className="order-id">{order.orderId}</div>
          <div className="order-meta">
            {order.items?.length || 0} item(s) · {formatINR(order.totalINR)} ·{' '}
            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
      </div>

      {order.items && (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
          {order.items.map(i => `${i.name} × ${i.quantity}`).join(' · ')}
        </div>
      )}

      <OrderProgress order={order} />

      {order.isDisputed && (
        <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
          ⚠️ <strong>Dispute under review.</strong> {order.disputeReason}
          {order.disputeResolution && (
            <span> — <strong>Resolution: {order.disputeResolution === 'REFUNDED' ? '↩ Refund issued' : '✅ Released to seller'}</strong></span>
          )}
        </div>
      )}

      {order.escrowStatus === 'RELEASED' && (
        <div className="alert alert-success" style={{ marginTop: '1rem' }}>
          ✅ Delivered and payment completed successfully.
        </div>
      )}

      {order.escrowStatus === 'REFUNDED' && (
        <div className="alert alert-info" style={{ marginTop: '1rem' }}>
          ↩ Refund has been processed.
        </div>
      )}

      {canDispute && (
        <button
          className="btn btn-danger"
          style={{ marginTop: '1rem', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          onClick={() => onDispute(order.orderId)}
        >
          ⚠️ Report an Issue
        </button>
      )}
    </div>
  );
}

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [input, setInput] = useState(searchParams.get('email') || '');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [disputeOrderId, setDisputeOrderId] = useState(null);

  useEffect(() => {
    if (email) fetchOrders();
  }, [email]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const d = await api.getOrdersByEmail(email);
      setOrders(d.orders);
    } catch (err) {
      toast.error('Could not load orders');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    if (!input.trim()) return;
    setEmail(input.trim());
    setSearchParams({ email: input.trim() });
  }

  async function handleDispute(orderId, reason) {
    await api.raiseDispute(orderId, reason);
    toast.success('Dispute submitted');
    fetchOrders();
  }

  return (
    <div className="page container fade-in">
      <h1 className="section-title" style={{ marginBottom: '0.5rem' }}>📋 My Orders</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Enter your email address to view your orders
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', maxWidth: 480, marginBottom: '2rem' }}>
        <input
          id="orders-email-input"
          className="form-input"
          type="email"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="your@email.com"
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1 }}
        />
        <button id="orders-search-btn" className="btn btn-primary" onClick={handleSearch}>
          Search
        </button>
      </div>

      {loading && <Spinner message="Loading orders..." />}

      {!loading && email && orders.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <div className="empty-title">No orders found</div>
          <div className="empty-desc">No orders found for {email}</div>
          <br />
          <Link to="/" className="btn btn-primary">Start Shopping</Link>
        </div>
      )}

      {orders.map(o => (
        <OrderCard key={o.orderId} order={o} onDispute={(id) => setDisputeOrderId(id)} />
      ))}

      {disputeOrderId && (
        <DisputeModal
          orderId={disputeOrderId}
          onClose={() => setDisputeOrderId(null)}
          onSubmit={(reason) => handleDispute(disputeOrderId, reason)}
        />
      )}
    </div>
  );
}
