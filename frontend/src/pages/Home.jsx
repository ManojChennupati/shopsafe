import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';
import { getProductEmoji, formatINR, Spinner } from '../components/Shared';

// ── Star rating helper ────────────────────────────────────────────────────────
function Stars({ rating }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <span className="stars">
      {'★'.repeat(full)}{half ? '⯨' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
    </span>
  );
}

// ── Product Quick-View Modal ──────────────────────────────────────────────────
function QuickView({ product, onClose, onAdd }) {
  if (!product) return null;
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300, padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="card fade-in"
        style={{ maxWidth: 480, width: '100%', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '0.75rem', right: '0.75rem',
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1
          }}
        >✕</button>

        {/* Product image */}
        <div style={{
          background: 'var(--bg-card2)', borderRadius: '12px',
          padding: '2rem', textAlign: 'center', marginBottom: '1.25rem'
        }}>
          <span style={{ fontSize: '6rem' }}>{getProductEmoji(product)}</span>
        </div>

        <div className="product-category" style={{ marginBottom: '0.4rem' }}>
          {product.category}
        </div>
        <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.3rem', marginBottom: '0.5rem' }}>
          {product.name}
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.6 }}>
          {product.description}
        </div>

        <div className="product-rating" style={{ marginBottom: '1rem' }}>
          <Stars rating={product.rating} />
          <span>{product.rating} ({product.reviews} reviews)</span>
        </div>

        {product.stock <= 5 && product.stock > 0 && (
          <div style={{ color: 'var(--warning)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
            ⚠️ Only {product.stock} left in stock!
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.6rem', color: 'var(--primary-light)' }}>
            {formatINR(product.price)}
          </div>
          <button
            id={`quickview-add-${product._id}`}
            className="btn btn-primary"
            style={{ flex: 1, maxWidth: 180 }}
            onClick={() => { onAdd(product); onClose(); }}
          >
            🛒 Add to Cart
          </button>
        </div>

        <div className="escrow-badge" style={{ marginTop: '1rem' }}>
          🔐 Payment protected by blockchain escrow
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickView, setQuickView] = useState(null);
  const { addItem } = useCart();

  useEffect(() => {
    api.getProducts()
      .then(d => setProducts(d.products))
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, []);

  function handleAdd(product) {
    addItem(product);
    toast.success(`${product.name.split(' ').slice(0,2).join(' ')} added to cart`, {
      icon: '🛒',
      style: { background: '#1a1a2e', color: '#f1f5f9', border: '1px solid rgba(255,255,255,0.08)' },
    });
  }

  return (
    <div className="page">
      {/* Hero */}
      <div className="hero container fade-in">
        <div className="hero-badge">🛡️ Blockchain-Secured Escrow</div>
        <h1>
          Shop with <span className="gradient-text">Confidence</span><br />
          Your money, protected.
        </h1>
        <p>
          Every purchase is held in a secure blockchain escrow — your payment
          is only released when your order is successfully delivered.
        </p>
        <div className="hero-features">
          {['Secure Escrow on Every Order', 'Instant Dispute Resolution', 'Verified Delivery'].map(f => (
            <div key={f} className="hero-feature"><span className="dot" />{f}</div>
          ))}
        </div>
      </div>

      {/* Trust Bar */}
      <div className="container">
        <div className="trust-bar">
          {[
            { icon: '🔐', text: 'Blockchain Escrow' },
            { icon: '🚚', text: 'OTP-Verified Delivery' },
            { icon: '⚡', text: 'Auto Settlement' },
            { icon: '🛡️', text: 'Dispute Protection' },
            { icon: '🔄', text: 'Easy Refunds' },
          ].map(t => (
            <div key={t.text} className="trust-item">
              <span className="icon">{t.icon}</span>
              <span>{t.text}</span>
            </div>
          ))}
        </div>

        {/* Product Grid */}
        <div className="section-header">
          <h2 className="section-title">Featured Products</h2>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {products.length} items
          </span>
        </div>

        {loading ? (
          <Spinner message="Loading products..." />
        ) : (
          <div className="products-grid fade-in">
            {products.map(product => (
              <div
                key={product._id}
                className="product-card"
                style={{ cursor: 'pointer' }}
                onClick={() => setQuickView(product)}
              >
                <div className="product-image" style={{ background: 'var(--bg-card2)' }}>
                  <span style={{ fontSize: '5rem' }}>{getProductEmoji(product)}</span>
                </div>
                <div className="product-body">
                  <div className="product-category">{product.category}</div>
                  <div className="product-name">{product.name}</div>
                  <div className="product-desc">{product.description}</div>
                  <div className="product-rating">
                    <Stars rating={product.rating} />
                    <span>{product.rating} ({product.reviews} reviews)</span>
                  </div>
                  <div className="product-footer">
                    <div className="product-price">
                      {formatINR(product.price)}
                    </div>
                    <button
                      id={`add-${product._id}`}
                      className="add-btn"
                      onClick={e => { e.stopPropagation(); handleAdd(product); }}
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      <QuickView
        product={quickView}
        onClose={() => setQuickView(null)}
        onAdd={handleAdd}
      />
    </div>
  );
}
