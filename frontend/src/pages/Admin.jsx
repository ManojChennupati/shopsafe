import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { getStatusBadge, formatINR, Spinner } from '../components/Shared';

function LoginGate({ onLogin }) {
  const [pw, setPw] = useState('');
  function handleLogin() {
    if (!pw) { toast.error('Enter admin password'); return; }
    sessionStorage.setItem('admin_password', pw);
    onLogin();
  }
  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
      <h2 style={{ marginBottom: '0.5rem' }}>Admin Panel</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Authorized administrators only
      </p>
      <div className="card">
        <div className="form-group">
          <label className="form-label">Admin Password</label>
          <input
            id="admin-password"
            className="form-input"
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Enter admin password"
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <button id="admin-login-btn" className="btn btn-primary btn-full" onClick={handleLogin}>
          Login
        </button>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
          Demo password: <code>admin123</code>
        </p>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('admin_password'));
  const [tab, setTab] = useState('orders'); // 'orders' | 'disputes'
  const [orders, setOrders] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [blockchain, setBlockchain] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [resolveLoading, setResolveLoading] = useState('');

  useEffect(() => {
    if (authed) {
      fetchData();
      checkBlockchain();
    }
  }, [authed]);

  async function fetchData() {
    setLoading(true);
    try {
      const [od, dd] = await Promise.all([api.getAllOrders(), api.getDisputes()]);
      setOrders(od.orders);
      setDisputes(dd.orders);
    } catch (err) {
      if (err.message.includes('authorization')) {
        sessionStorage.removeItem('admin_password');
        setAuthed(false);
      }
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function checkBlockchain() {
    try {
      const h = await api.blockchainHealth();
      setBlockchain(h);
    } catch {
      setBlockchain({ connected: false });
    }
  }

  async function viewDetail(orderId) {
    try {
      const d = await api.getAdminOrder(orderId);
      setDetailOrder(orderId);
      setDetailData(d);
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleResolve(orderId, action) {
    setResolveLoading(action);
    try {
      const fn = action === 'release' ? api.adminRelease : api.adminRefund;
      const result = await fn(orderId);
      toast.success(result.message);
      fetchData();
      setDetailOrder(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setResolveLoading('');
    }
  }

  async function triggerSettlement() {
    try {
      await api.triggerSettlement();
      toast.success('Settlement cycle triggered');
      fetchData();
    } catch (err) {
      toast.error(err.message);
    }
  }

  if (!authed) return <div className="page container"><LoginGate onLogin={() => setAuthed(true)} /></div>;

  const totalRevenue = orders.filter(o => o.escrowStatus === 'RELEASED').reduce((s, o) => s + o.totalINR, 0);

  const stats = [
    { icon: '📦', label: 'Total Orders', value: orders.length, color: 'var(--primary-light)' },
    { icon: '🚚', label: 'In Transit', value: orders.filter(o => o.deliveryStatus === 'OUT_FOR_DELIVERY').length, color: 'var(--warning)' },
    { icon: '⚠️', label: 'Active Disputes', value: disputes.length, color: 'var(--danger)' },
    { icon: '✅', label: 'Completed', value: orders.filter(o => o.escrowStatus === 'RELEASED').length, color: 'var(--success)' },
    { icon: '💰', label: 'Revenue Released', value: formatINR(totalRevenue), color: 'var(--success)' },
  ];

  return (
    <div className="page container fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="section-title">🔐 Admin Panel</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Order management and dispute resolution
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" style={{ fontSize: '0.85rem' }} onClick={triggerSettlement}>
            ⚡ Run Settlement
          </button>
          <button className="btn btn-ghost" style={{ fontSize: '0.85rem' }} onClick={fetchData}>
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Blockchain health */}
      {blockchain && (
        <div className={`alert ${blockchain.connected ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: '1.5rem' }}>
          {blockchain.connected
            ? `⛓️ Blockchain connected — Chain ${blockchain.chainId}, Block #${blockchain.blockNumber}`
            : '⛓️ Blockchain disconnected — Start Hardhat node'}
        </div>
      )}

      {/* Stats */}
      <div className="admin-grid" style={{ marginBottom: '2rem' }}>
        {stats.map(s => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['orders', 'disputes'].map(t => (
          <button
            key={t}
            className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTab(t)}
          >
            {t === 'orders' ? `📋 All Orders (${orders.length})` : `⚠️ Disputes (${disputes.length})`}
          </button>
        ))}
      </div>

      {loading && <Spinner message="Loading..." />}

      {/* All orders table */}
      {tab === 'orders' && !loading && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Delivery</th>
                  <th>Escrow</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.map(o => {
                  const badge = getStatusBadge(o);
                  return (
                    <tr key={o.orderId}>
                      <td style={{ fontFamily: 'Outfit', fontWeight: 700, color: 'var(--primary-light)', fontSize: '0.83rem' }}>{o.orderId}</td>
                      <td>{o.customerName}</td>
                      <td style={{ fontWeight: 600 }}>{formatINR(o.totalINR)}</td>
                      <td><span className={`badge ${o.paymentStatus === 'CONFIRMED' ? 'badge-success' : 'badge-muted'}`} style={{ fontSize: '0.75rem' }}>{o.paymentStatus}</span></td>
                      <td><span className="badge badge-muted" style={{ fontSize: '0.75rem' }}>{o.deliveryStatus}</span></td>
                      <td><span className={`badge ${badge.cls}`} style={{ fontSize: '0.75rem' }}>{o.escrowStatus}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
                          onClick={() => viewDetail(o.orderId)}
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Disputes */}
      {tab === 'disputes' && !loading && (
        <div>
          {disputes.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <div className="empty-title">No active disputes</div>
            </div>
          )}
          {disputes.map(o => (
            <div key={o.orderId} className="order-card">
              <div className="order-header">
                <div>
                  <div className="order-id">{o.orderId}</div>
                  <div className="order-meta">{o.customerName} · {formatINR(o.totalINR)}</div>
                </div>
                <span className="badge badge-danger">⚠️ Disputed</span>
              </div>
              <div className="alert alert-warning" style={{ margin: '0.75rem 0' }}>
                <strong>Reason:</strong> {o.disputeReason}
                <br />
                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                  Raised: {new Date(o.disputeRaisedAt).toLocaleString('en-IN')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  id={`release-${o.orderId}`}
                  className="btn btn-success"
                  style={{ fontSize: '0.88rem' }}
                  disabled={!!resolveLoading}
                  onClick={() => handleResolve(o.orderId, 'release')}
                >
                  {resolveLoading === 'release' ? '⏳' : '✅'} Release to Seller
                </button>
                <button
                  id={`refund-${o.orderId}`}
                  className="btn btn-danger"
                  style={{ fontSize: '0.88rem' }}
                  disabled={!!resolveLoading}
                  onClick={() => handleResolve(o.orderId, 'refund')}
                >
                  {resolveLoading === 'refund' ? '⏳' : '↩'} Refund Buyer
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '0.88rem' }}
                  onClick={() => viewDetail(o.orderId)}
                >
                  🔍 View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order detail modal */}
      {detailOrder && detailData && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem'
        }}>
          <div className="card fade-in" style={{ maxWidth: 600, width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="card-title">Order Detail — {detailOrder}</div>

            <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
              ⛓️ On-chain state: <strong>{detailData.onChain?.stateLabel || detailData.onChain?.error}</strong>
            </div>

            {detailData.escrowRecord && (
              <>
                <div className="summary-row"><span style={{ color: 'var(--text-secondary)' }}>Contract</span><span style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{detailData.escrowRecord.contractAddress?.slice(0,20)}…</span></div>
                <div className="summary-row"><span style={{ color: 'var(--text-secondary)' }}>Escrow ETH</span><span>{detailData.escrowRecord.amountEth} ETH</span></div>
                {detailData.escrowRecord.fundTxHash && <div className="summary-row"><span style={{ color: 'var(--text-secondary)' }}>Fund TX</span><span style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>{detailData.escrowRecord.fundTxHash?.slice(0,24)}…</span></div>}
                {detailData.escrowRecord.settleTxHash && <div className="summary-row"><span style={{ color: 'var(--text-secondary)' }}>Settle TX</span><span style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>{detailData.escrowRecord.settleTxHash?.slice(0,24)}…</span></div>}
              </>
            )}

            <button className="btn btn-ghost btn-full" style={{ marginTop: '1.25rem' }} onClick={() => { setDetailOrder(null); setDetailData(null); }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
