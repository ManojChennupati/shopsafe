import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { Spinner, formatINR } from '../components/Shared';

export default function Confirmation() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getOrder(orderId)
      .then(d => setOrder(d.order))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) return <div className="page container"><Spinner message="Loading order..." /></div>;

  return (
    <div className="page container fade-in" style={{ maxWidth: 580, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div className="confirmation-icon">✅</div>
        <h1 style={{ fontFamily: 'Outfit', fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>
          Order Confirmed!
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Thank you for your purchase. Your payment is secured with blockchain escrow.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-title">Order Details</div>
        <div className="summary-row">
          <span style={{ color: 'var(--text-secondary)' }}>Order ID</span>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, color: 'var(--primary-light)', fontSize: '0.9rem' }}>{orderId}</span>
        </div>
        <div className="summary-row">
          <span style={{ color: 'var(--text-secondary)' }}>Customer</span>
          <span>{order?.customerName}</span>
        </div>
        <div className="summary-row">
          <span style={{ color: 'var(--text-secondary)' }}>Amount</span>
          <span style={{ fontWeight: 700 }}>{formatINR(order?.totalINR || 0)}</span>
        </div>
        <div className="summary-row">
          <span style={{ color: 'var(--text-secondary)' }}>Payment Status</span>
          <span className="badge badge-success">✅ Confirmed</span>
        </div>
        <div className="summary-row">
          <span style={{ color: 'var(--text-secondary)' }}>Escrow Status</span>
          <span className="badge badge-info">🔐 Payment Held Securely</span>
        </div>
      </div>

      <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
        🔐 <strong>Your payment is protected.</strong> The amount will be held in a secure escrow
        and released to the seller only after you receive your delivery.
        You can raise a dispute within 5 minutes of delivery if there's an issue.
      </div>

      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-title">What happens next?</div>
        {[
          { icon: '📦', title: 'Order Processing', desc: 'Your order is being prepared by the seller.' },
          { icon: '🚚', title: 'Out for Delivery', desc: 'A delivery agent will pick up and deliver your order.' },
          { icon: '🔢', title: 'OTP Verification', desc: 'On delivery, the agent will confirm with a unique OTP.' },
          { icon: '✅', title: 'Payment Released', desc: 'After delivery is confirmed, payment is released to the seller.' },
        ].map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', padding: '0.75rem 0', borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{s.icon}</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{s.title}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to={`/orders?email=${order?.customerEmail || ''}`} className="btn btn-primary" style={{ flex: 1 }}>
          📋 Track Order
        </Link>
        <Link to="/" className="btn btn-ghost" style={{ flex: 1 }}>
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
