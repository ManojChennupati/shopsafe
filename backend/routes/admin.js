"use strict";

const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const EscrowRecord = require("../models/EscrowRecord");
const escrowService = require("../services/escrowService");
const { requireAdmin } = require("../middleware/auth");
const { runSettlementCycle } = require("../services/settlementService");

// All admin routes require admin password header
router.use(requireAdmin);

// ── GET /api/admin/orders — All orders ───────────────────────────────────────
router.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/disputes — Disputed orders ────────────────────────────────
router.get("/disputes", async (req, res) => {
  try {
    const orders = await Order.find({ isDisputed: true, disputeResolution: null }).sort({
      disputeRaisedAt: -1,
    });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/orders/:orderId — Order + escrow detail ───────────────────
router.get("/orders/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const escrowRecord = await EscrowRecord.findOne({ orderId });

    // Read on-chain state for accurate information
    let onChain = null;
    try {
      onChain = await escrowService.getEscrowDetails(orderId);
    } catch (e) {
      onChain = { error: e.message };
    }

    res.json({ success: true, order, escrowRecord, onChain });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/resolve/:orderId/release — Admin releases to seller ───────
router.post("/resolve/:orderId/release", async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (!order.isDisputed) {
      return res.status(400).json({ success: false, message: "Order is not disputed" });
    }
    if (order.disputeResolution) {
      return res.status(400).json({ success: false, message: "Dispute already resolved" });
    }

    const result = await escrowService.adminRelease(orderId);

    await Order.findOneAndUpdate(
      { orderId },
      {
        escrowStatus: "RELEASED",
        paymentStatus: "CONFIRMED",
        deliveryStatus: "DELIVERED",
        disputeResolution: "RELEASED",
        disputeResolvedAt: new Date(),
      }
    );

    await EscrowRecord.findOneAndUpdate(
      { orderId },
      {
        onChainState: 4,
        settleTxHash: result.txHash,
        settledAt: new Date(),
        settlementOutcome: "RELEASED",
        settlementRecipient: process.env.SELLER_ADDRESS,
      }
    );

    res.json({
      success: true,
      message: "Dispute resolved — funds released to seller",
      txHash: result.txHash,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/resolve/:orderId/refund — Admin refunds buyer ─────────────
router.post("/resolve/:orderId/refund", async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (!order.isDisputed) {
      return res.status(400).json({ success: false, message: "Order is not disputed" });
    }
    if (order.disputeResolution) {
      return res.status(400).json({ success: false, message: "Dispute already resolved" });
    }

    const result = await escrowService.adminRefund(orderId);

    await Order.findOneAndUpdate(
      { orderId },
      {
        escrowStatus: "REFUNDED",
        paymentStatus: "REFUNDED",
        disputeResolution: "REFUNDED",
        disputeResolvedAt: new Date(),
      }
    );

    await EscrowRecord.findOneAndUpdate(
      { orderId },
      {
        onChainState: 5,
        settleTxHash: result.txHash,
        settledAt: new Date(),
        settlementOutcome: "REFUNDED",
        settlementRecipient: process.env.BUYER_ADDRESS,
      }
    );

    res.json({
      success: true,
      message: "Dispute resolved — funds refunded to buyer",
      txHash: result.txHash,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/admin/trigger-settlement — Manually trigger settlement cycle ───
router.post("/trigger-settlement", async (req, res) => {
  try {
    await runSettlementCycle();
    res.json({ success: true, message: "Settlement cycle triggered" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/blockchain-health — Check blockchain connection ─────────────
router.get("/blockchain-health", async (req, res) => {
  try {
    const health = await escrowService.healthCheck();
    res.json({ success: true, ...health });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
