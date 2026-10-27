import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

// Emoji map for product categories (replaces images for this demo)
export const PRODUCT_EMOJI = {
  'Electronics': { 'Wireless Noise-Cancelling Headphones': '🎧', 'Smart Fitness Band': '⌚', 'USB-C Hub — 7-in-1': '🔌', 'Mechanical Keyboard — TKL': '⌨️' },
  'Food & Beverages': '🍵',
  'Furniture': '🪑',
  'Kitchen': '🍶',
  'Sports': '🧘',
};

export function getProductEmoji(product) {
  const catEmojis = PRODUCT_EMOJI[product.category];
  if (typeof catEmojis === 'object' && catEmojis[product.name]) return catEmojis[product.name];
  if (typeof catEmojis === 'string') return catEmojis;
  return '📦';
}

// ── Navbar ────────────────────────────────────────────────────────────────────
export function Navbar() {
  const { count } = useCart();
  const navigate = useNavigate();

  return (
    <nav className="navbar">
      <div className="container">
        <Link to="/" className="navbar-brand">
          <span className="shield-icon">🛡️</span>
          ShopSafe
        </Link>
        <ul className="navbar-nav">
          <li><NavLink to="/">Shop</NavLink></li>
          <li><NavLink to="/orders">My Orders</NavLink></li>
          <li><NavLink to="/delivery">Delivery</NavLink></li>
          <li><NavLink to="/admin">Admin</NavLink></li>
        </ul>
        <button className="cart-btn" onClick={() => navigate('/cart')}>
          🛒 Cart
          {count > 0 && <span className="cart-badge">{count}</span>}
        </button>
      </div>
    </nav>
  );
}

// ── Status helpers ────────────────────────────────────────────────────────────
export function getStatusBadge(order) {
  const { escrowStatus, isDisputed, deliveryStatus, paymentStatus } = order;

  if (escrowStatus === 'RELEASED') return { cls: 'badge-success', label: '✅ Delivered' };
  if (escrowStatus === 'REFUNDED') return { cls: 'badge-info',    label: '↩ Refunded' };
  if (isDisputed)                  return { cls: 'badge-danger',  label: '⚠ Disputed' };
  if (escrowStatus === 'DELIVERY_CONFIRMED') return { cls: 'badge-success', label: '📦 Delivered' };
  if (deliveryStatus === 'OUT_FOR_DELIVERY') return { cls: 'badge-warning', label: '🚚 Out for Delivery' };
  if (escrowStatus === 'FUNDED')  return { cls: 'badge-primary', label: '🔄 Processing' };
  if (paymentStatus === 'PENDING') return { cls: 'badge-muted',  label: '⏳ Pending Payment' };
  return { cls: 'badge-muted', label: '📋 Order Placed' };
}

// ── Order Progress Bar ────────────────────────────────────────────────────────
export function OrderProgress({ order }) {
  const steps = [
    { key: 'placed',     label: 'Order\nPlaced',  icon: '📋' },
    { key: 'payment',    label: 'Payment\nHeld',   icon: '🔐' },
    { key: 'delivery',   label: 'Out for\nDelivery', icon: '🚚' },
    { key: 'delivered',  label: 'Delivered',       icon: '📦' },
    { key: 'complete',   label: 'Complete',        icon: '✅' },
  ];

  function getStepState(key) {
    const { escrowStatus, deliveryStatus, paymentStatus, isDisputed } = order;
    if (isDisputed) {
      if (key === 'placed' || key === 'payment') return 'done';
      return 'active';
    }
    switch (key) {
      case 'placed':   return 'done';
      case 'payment':  return ['FUNDED','DELIVERY_CONFIRMED','RELEASED'].includes(escrowStatus) ? 'done' : (paymentStatus === 'PENDING' ? '' : 'active');
      case 'delivery': return ['DELIVERY_CONFIRMED','RELEASED'].includes(escrowStatus) ? 'done' : (deliveryStatus === 'OUT_FOR_DELIVERY' ? 'active' : '');
      case 'delivered':return ['DELIVERY_CONFIRMED','RELEASED'].includes(escrowStatus) ? 'done' : '';
      case 'complete': return escrowStatus === 'RELEASED' ? 'done' : '';
      default: return '';
    }
  }

  return (
    <div className="order-progress">
      {steps.map((step, i) => {
        const state = getStepState(step.key);
        return (
          <React.Fragment key={step.key}>
            {i > 0 && <div className={`progress-line${state === 'done' || getStepState(steps[i-1].key) === 'done' ? ' done' : ''}`} />}
            <div className="progress-step">
              <div className={`progress-dot${state ? ' ' + state : ''}`}>{step.icon}</div>
              <span className="progress-label" style={{whiteSpace:'pre-line'}}>{step.label}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Currency formatter ────────────────────────────────────────────────────────
export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ── Generic Spinner ───────────────────────────────────────────────────────────
export function Spinner({ message = 'Loading...' }) {
  return (
    <div className="loading">
      <div className="spinner" />
      <p>{message}</p>
    </div>
  );
}
