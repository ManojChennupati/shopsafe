# 🛡️ ShopSafe — Secure E-Commerce with Internal Blockchain Escrow

> A full-stack e-commerce demonstration showing how blockchain-based escrow can protect payments — without exposing any blockchain complexity to customers.

---

## 📋 Project Overview

ShopSafe is a local-only educational prototype that combines a familiar e-commerce shopping experience with an internal blockchain escrow system. Customers browse products, add to cart, and check out exactly as they would on any normal shopping site. Behind the scenes, the backend automatically manages a Solidity smart contract escrow that holds payment until delivery is confirmed.

**The key design principle:** customers never see, interact with, or need to understand blockchain. It is a purely internal implementation detail.

---

## ✨ Features

### Customer Storefront
- Browse 8 sample products across multiple categories
- Add items to cart with quantity controls
- Checkout with simulated payment (demo card/UPI/net banking)
- View order confirmation with escrow protection notice
- Track order status with a visual progress bar
- Raise delivery disputes from the My Orders page

### Delivery Management Portal
- Password-protected delivery operator login
- View all pending/in-transit orders
- Mark orders as "Out for Delivery"
- Confirm delivery with an OTP (shown in dev panel for demo)
- Triggers on-chain delivery confirmation after OTP verification

### Admin Panel
- Password-protected admin login
- Dashboard with order stats and revenue
- Full order table with escrow/delivery/payment status
- Dispute queue with one-click resolve (release or refund)
- Blockchain health indicator
- Manual settlement trigger

---

## 🏗️ Architecture

```
Customer Browser
      │
      │  Normal HTTP (no blockchain)
      ▼
React Frontend (Vite, port 5173)
      │
      │  REST API calls to /api/*
      ▼
Express Backend (Node.js, port 5000)
      │
      ├── Product routes
      ├── Order routes  (create, checkout, status, dispute)
      ├── Admin routes  (all orders, resolve disputes)
      │
      ├── MongoDB (order/product/escrow data)
      │
      └── EscrowService (ethers.js v6)
              │
              │  Internal — never exposed to customer
              ▼
        Hardhat Local Network (port 8545)
              │
              ▼
        SecureEscrow.sol (Solidity 0.8.24)
```

### Blockchain Escrow — How It Works Internally

1. **Customer places an order** → backend creates an order in MongoDB AND calls `createEscrow()` on-chain with the order ID, buyer, and seller addresses.
2. **Customer confirms payment** → backend calls `fundEscrow()` using a pre-funded local test account (0.001 ETH demo amount). The INR total and ETH amount are **completely separate** — the ETH is for escrow demonstration only.
3. **Delivery operator verifies OTP** → backend calls `confirmDelivery()` on-chain; the dispute window (5 min demo) starts.
4. **Dispute window passes** → settlement poller calls `releaseFunds()` → ETH transferred to seller address.
5. **Customer raises dispute** → backend calls `raiseDispute()` on-chain; automatic release is blocked.
6. **Admin resolves** → calls `adminRelease()` or `adminRefund()` on-chain; on-chain state is the authoritative source.

### Payment Design (Important)
- Product prices are in **INR** — no conversion to ETH.
- Customer sees a simulated payment confirmation (no real money moves).
- Internally, **0.001 test ETH** from a Hardhat development account is used for the escrow demo.
- These are completely separate amounts. The ETH amount is fixed for demonstration.
- **No real funds are ever handled.**

---

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Vanilla CSS (dark mode, glassmorphism) |
| Backend | Node.js + Express.js |
| Database | MongoDB (local) + Mongoose |
| Smart Contract | Solidity 0.8.24 |
| Blockchain Dev | Hardhat v2 (local network) |
| Blockchain Client | Ethers.js v6 |
| OTP Security | bcryptjs (hashed, never plaintext) |

---

## 🚀 Local Installation

### Prerequisites
- **Node.js** v18+ (`node --version`)
- **MongoDB** installed and running locally
- **Git** (optional)

### 1. Clone / Navigate to project
```bash
cd shopsafe
```

### 2. Install root dependencies (Hardhat + toolchain)
```bash
npm install
```

### 3. Install backend dependencies
```bash
cd backend
npm install
cd ..
```

### 4. Install frontend dependencies
```bash
cd frontend
npm install
cd ..
```

---

## 🗄️ Local MongoDB Setup

1. Make sure MongoDB is running:
   ```bash
   # Windows (if installed as a service)
   net start MongoDB

   # Or start mongod directly
   mongod --dbpath C:\data\db
   ```
2. The backend will connect to `mongodb://127.0.0.1:27017/shopsafe` by default.
3. Products are seeded automatically on first startup.

---

## ⛓️ Hardhat Local Blockchain

### Start the local Hardhat node
```bash
# Terminal 1
npm run chain
```

This starts a local blockchain at `http://127.0.0.1:8545` with 20 pre-funded test accounts.
**Leave this terminal running.**

### Deploy the smart contract
```bash
# Terminal 2
npm run deploy
```

This will:
- Compile `contracts/SecureEscrow.sol`
- Deploy to the local Hardhat network
- Write `backend/config/deployment.json` and `backend/config/SecureEscrow.abi.json`
- Print the contract address

### Update backend/.env
After deployment, update `backend/.env`:
```
CONTRACT_ADDRESS=<address printed above>
```

The `OPERATOR_ADDRESS` is pre-filled with Hardhat account #1.

---

## 🖥️ Running the Application

Open **three separate terminals**:

```bash
# Terminal 1 — Hardhat blockchain
npm run chain

# Terminal 2 — Backend API
npm run backend

# Terminal 3 — React frontend
npm run frontend
```

Then open **http://localhost:5173** in your browser.

---

## 🎭 Demo Walkthrough

### Customer Flow
1. Open `http://localhost:5173`
2. Browse products and add items to cart
3. Click **Cart** → **Proceed to Checkout**
4. Fill in name, email, shipping address
5. Select a payment method → **Place Order**
6. Note your **Order ID** on the confirmation page
7. Go to **My Orders** and enter your email to track

### Delivery Operator Flow
1. Go to `/delivery`
2. Login with password: `deliver123`
3. Find the order and click **Mark Out for Delivery**
4. Click **Confirm Delivery with OTP**
5. The dev OTP is shown automatically — copy and paste it
6. Click **Confirm Delivery** → blockchain delivery confirmed!

### Admin Flow
1. Go to `/admin`
2. Login with password: `admin123`
3. View all orders and their blockchain escrow statuses
4. If a customer raised a dispute, go to the **Disputes** tab
5. Click **Release to Seller** or **Refund Buyer**
6. Click **Run Settlement** to manually trigger the auto-release cycle

---

## 🧪 Running Tests

### Smart Contract Tests
```bash
npm run test:contracts
```

Tests cover:
- ✅ Deployment — owner/operator setup
- ✅ `createEscrow` — valid creation, duplicate prevention, authorization
- ✅ `fundEscrow` — correct amount, duplicate funding, unauthorized calls
- ✅ `confirmDelivery` — state transition, invalid state revert
- ✅ `raiseDispute` — within window, after window closed
- ✅ `releaseFunds` — after window, during window (blocked), dispute state (blocked), duplicate release
- ✅ `adminRelease` / `adminRefund` — authorized/unauthorized
- ✅ View helpers — `canRelease`, `isDisputeWindowOpen`, non-existent escrow

### Compile Only
```bash
npm run compile
```

---

## ⚠️ Known Limitations

1. **No real authentication** — admin/delivery passwords are fixed strings in `.env`. Use only for local demo.
2. **Simulated payment** — the INR total is not converted to ETH. The 0.001 ETH escrow is a fixed demo amount.
3. **Single operator wallet** — all escrows share one backend operator account. Production would use a proper key-management system.
4. **No email/SMS** — OTPs are shown in the dev panel. A real system would send via SMS/email.
5. **No customer authentication** — orders are looked up by email. A real system would have user accounts.
6. **Dispute window is 5 minutes** — shortened for demo. Adjust `DISPUTE_WINDOW_SECONDS` in `.env`.
7. **Localhost only** — do not attempt to deploy this to any public network.
8. **Test ETH only** — all blockchain transactions use disposable Hardhat test accounts with test ETH.

---

## 📁 Project Structure

```
shopsafe/
├── contracts/
│   └── SecureEscrow.sol          # Solidity escrow contract
├── scripts/
│   └── deploy-local.js           # Deploy to local Hardhat network
├── test/
│   └── SecureEscrow.test.js      # Contract tests (Mocha + Chai)
├── backend/
│   ├── server.js                 # Express app entry point
│   ├── .env                      # Local config (never commit)
│   ├── models/
│   │   ├── Product.js
│   │   ├── Order.js
│   │   ├── EscrowRecord.js
│   │   └── DeliveryVerification.js
│   ├── routes/
│   │   ├── products.js
│   │   ├── orders.js             # Checkout, OTP, disputes
│   │   └── admin.js              # Admin panel API
│   ├── services/
│   │   ├── escrowService.js      # All blockchain interactions
│   │   ├── settlementService.js  # Background auto-release poller
│   │   └── seedProducts.js       # Sample product data
│   ├── middleware/
│   │   └── auth.js               # Demo role authorization
│   └── config/                   # Generated by deploy script
│       ├── deployment.json
│       └── SecureEscrow.abi.json
├── frontend/
│   └── src/
│       ├── api/client.js         # Centralized API client
│       ├── context/CartContext.jsx
│       ├── components/Shared.jsx
│       ├── pages/
│       │   ├── Home.jsx           # Product listing
│       │   ├── Cart.jsx           # Cart + checkout
│       │   ├── Confirmation.jsx   # Order confirmation
│       │   ├── Orders.jsx         # Order tracking + disputes
│       │   ├── Delivery.jsx       # Delivery operator portal
│       │   └── Admin.jsx          # Admin dashboard
│       ├── App.jsx
│       └── main.jsx
├── hardhat.config.js
├── package.json
└── README.md
```

---

## 🔐 Security Notes (for local demo)

- The `OPERATOR_PRIVATE_KEY` in `.env` is **Hardhat account #1's well-known test key**. It is public knowledge and has zero real value. Never use it outside a local Hardhat network.
- OTPs are stored as bcrypt hashes in MongoDB — plaintext is only shown in the dev panel (`NODE_ENV=development`).
- All authorization checks happen on the backend AND the smart contract enforces them independently.
- The smart contract is the authoritative source of truth for escrow state — the backend always verifies transaction receipts.
