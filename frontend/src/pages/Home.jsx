import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    api.getProducts()
      .then(d => setProducts(d.products))
      .catch(() => toast.error('Failed to load products'))
      .finally(() => setLoading(false));
  }, []);

  function handleAdd(e, product) {
    e.stopPropagation();
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
                onClick={() => navigate(`/product/${product._id}`)}
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
                      onClick={e => handleAdd(e, product)}
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
    </div>
  );
}
