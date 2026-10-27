"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const escrowService = require("./services/escrowService");
const { startSettlementPoller } = require("./services/settlementService");
const { seedProducts } = require("./services/seedProducts");

const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", async (req, res) => {
  const bcHealth = await escrowService.healthCheck();
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    blockchain: bcHealth,
    mongoState: mongoose.connection.readyState,
  });
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("[Server Error]", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// ── Startup ───────────────────────────────────────────────────────────────────
async function start() {
  // Connect to MongoDB
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/shopsafe";
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
    console.log("[MongoDB] Connected to", mongoUri.split("@").pop() || mongoUri);
  } catch (err) {
    console.error("[MongoDB] Connection failed:", err.message);
    console.error("[MongoDB] Set MONGO_URI in backend/.env to your Atlas connection string,");
    console.error("[MongoDB] or start a local MongoDB instance on port 27017.");
    process.exit(1);
  }

  // Seed products if needed
  await seedProducts();

  // Initialise blockchain escrow service
  try {
    await escrowService.init();
  } catch (err) {
    console.warn(
      "[EscrowService] Could not connect to blockchain (is Hardhat running?):",
      err.message
    );
    console.warn("[EscrowService] Order/product browsing still works, but checkout requires Hardhat.");
  }

  // Start background settlement poller (every 2 minutes for demo)
  startSettlementPoller(120_000);

  app.listen(PORT, () => {
    console.log(`[Server] ShopSafe backend running on http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV}`);
  });
}

start().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});

module.exports = app;
