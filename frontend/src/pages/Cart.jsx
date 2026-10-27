import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';
import { getProductEmoji, formatINR } from '../components/Shared';

export default function Cart() {
  const { cart, removeItem, updateQty, clearCart, total } = useCart();
  const navigate = useNavigate();

  // Customer form state
  const [form, setForm] = useState({ customerName: '', customerEmail: '', shippingAddress: '' });
  const [payMethod, setPayMethod] = useState('SIMULATED_CARD');
  const [step, setStep] = useState('cart'); // 'cart' | 'checkout' | 'paying'
  const [placedOrderId, setPlacedOrderId] = useState(null);

  function handleFormChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handlePlaceOrder() {
    if (!form.customerName || !form.customerEmail || !form.shippingAddress) {
      toast.error('Please fill in all fields');
      return;
    }
    setStep('paying');
    try {
      // Step 1: Create order
      const { orderId } = await api.createOrder({
        ...form,
        items: cart.map(i => ({ productId: i._id, quantity: i.quantity })),
      });

      // Step 2: Simulate payment & fund escrow internally
      await api.checkout(orderId, { paymentMethod: payMethod });

      clearCart();
      setPlacedOrderId(orderId);
      navigate(`/confirmation/${orderId}`);
    } catch (err) {
      toast.error(err.message || 'Order failed. Please try again.');
      setStep('checkout');
    }
  }

  if (cart.length === 0 && step === 'cart') {
    return (
      <div className="page container fade-in">
        <div className="empty-state">
          <div className="empty-icon">🛒</div>
          <div className="empty-title">Your cart is empty</div>
          <div className="empty-desc">Browse our products and add items to get started</div>
          <br />
          <Link to="/" className="btn btn-primary">Continue Shopping</Link>
        </div>
      </div>
    );
  }

  if (step === 'paying') {
    return (
      <div className="page container fade-in" style={{ textAlign: 'center', padding: '5rem 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
        <h2 style={{ marginBottom: '0.75rem' }}>Processing your order...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Confirming payment and securing your escrow. Please wait.
        </p>
        <div className="spinner" style={{ margin: '2rem auto' }} />
      </div>
    );
  }

  return (
    <div className="page container fade-in">
      <h1 className="section-title" style={{ marginBottom: '2rem' }}>
        {step === 'cart' ? '🛒 Shopping Cart' : '📝 Checkout'}
      </h1>

      <div className="cart-layout">
        {/* Left — items or checkout form */}
        <div>
          {step === 'cart' ? (
            <div className="card">
              <div className="card-title">Cart Items ({cart.length})</div>
              {cart.map(item => (
                <div key={item._id} className="cart-item slide-in">
                  <div className="cart-item-icon">{getProductEmoji(item)}</div>
                  <div className="cart-item-details">
                    <div className="cart-item-name">{item.name}</div>
                    <div className="cart-item-price">{formatINR(item.price)} each</div>
                  </div>
                  <div className="qty-control">
                    <button className="qty-btn" onClick={() => updateQty(item._id, item.quantity - 1)}>−</button>
                    <span className="qty-num">{item.quantity}</span>
                    <button className="qty-btn" onClick={() => updateQty(item._id, item.quantity + 1)}>+</button>
                  </div>
                  <div style={{ fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
                    {formatINR(item.price * item.quantity)}
                  </div>
                  <button className="remove-btn" onClick={() => removeItem(item._id)}>🗑</button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-title">Delivery Details</div>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    id="customerName"
                    className="form-input"
                    name="customerName"
                    value={form.customerName}
                    onChange={handleFormChange}
                    placeholder="Rahul Sharma"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input
                    id="customerEmail"
                    className="form-input"
                    type="email"
                    name="customerEmail"
                    value={form.customerEmail}
                    onChange={handleFormChange}
                    placeholder="rahul@example.com"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Shipping Address</label>
                  <textarea
                    id="shippingAddress"
                    className="form-input"
                    name="shippingAddress"
                    value={form.shippingAddress}
                    onChange={handleFormChange}
                    placeholder="Flat 4B, Green View Apartments, MG Road, Bengaluru 560001"
                    rows={3}
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="card">
                <div className="card-title">Payment Method</div>
                <div className="alert alert-info">
                  ℹ️ This is a <strong>demo checkout</strong>. No real payment is processed.
                  All payments are simulated for demonstration purposes.
                </div>
                {[
                  { id: 'SIMULATED_CARD', icon: '💳', label: 'Credit / Debit Card', sub: 'Simulated — Demo only' },
                  { id: 'SIMULATED_UPI',  icon: '📱', label: 'UPI Payment',         sub: 'Simulated — Demo only' },
                  { id: 'SIMULATED_NETBANKING', icon: '🏦', label: 'Net Banking',   sub: 'Simulated — Demo only' },
                ].map(m => (
                  <label key={m.id} className={`payment-method${payMethod === m.id ? ' selected' : ''}`}>
                    <input
                      type="radio"
                      className="payment-radio"
                      name="payMethod"
                      value={m.id}
                      checked={payMethod === m.id}
                      onChange={() => setPayMethod(m.id)}
                    />
                    <span className="payment-icon">{m.icon}</span>
                    <div>
                      <div className="payment-label">{m.label}</div>
                      <div className="payment-sub">{m.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right — order summary */}
        <div className="card" style={{ position: 'sticky', top: '90px' }}>
          <div className="card-title">Order Summary</div>
          {cart.map(i => (
            <div key={i._id} className="summary-row" style={{ fontSize: '0.88rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{i.name.slice(0,28)}{i.name.length>28?'…':''} × {i.quantity}</span>
              <span>{formatINR(i.price * i.quantity)}</span>
            </div>
          ))}
          <div className="summary-row">
            <span style={{ color: 'var(--text-secondary)' }}>Shipping</span>
            <span style={{ color: 'var(--success)' }}>Free</span>
          </div>
          <div className="summary-row total">
            <span>Total</span>
            <span>{formatINR(total)}</span>
          </div>

          <div className="escrow-badge">
            🔐 Your payment is protected by blockchain escrow
          </div>

          {step === 'cart' ? (
            <button
              id="proceed-checkout-btn"
              className="btn btn-primary btn-full"
              onClick={() => setStep('checkout')}
            >
              Proceed to Checkout →
            </button>
          ) : (
            <>
              <button
                id="place-order-btn"
                className="btn btn-success btn-full"
                onClick={handlePlaceOrder}
                style={{ marginBottom: '0.75rem' }}
              >
                🔐 Place Order & Pay {formatINR(total)}
              </button>
              <button
                className="btn btn-ghost btn-full"
                onClick={() => setStep('cart')}
              >
                ← Back to Cart
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
