"use strict";

const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcryptjs");

const Order = require("../models/Order");
const Product = require("../models/Product");
const EscrowRecord = require("../models/EscrowRecord");
const DeliveryVerification = require("../models/DeliveryVerification");
const escrowService = require("../services/escrowService");
const { requireDelivery } = require("../middleware/auth");

// ── POST /api/orders — Create a new order ────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { customerName, customerEmail, shippingAddress, items } = req.body;

    // Validate input
    if (!customerName || !customerEmail || !shippingAddress) {
      return res.status(400).json({ success: false, message: "Customer details are required" });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    // Validate products and calculate total
    let totalINR = 0;
    const orderItems = [];

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ success: false, message: "Invalid cart item" });
      }
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(400).json({ success: false, message: `Product not found: ${item.productId}` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`,
        });
      }
      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
      });
      totalINR += product.price * item.quantity;
    }

    const orderId = `SS-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;

    // Create order in DB
    const order = await Order.create({
      orderId,
      customerName,
      customerEmail,
      shippingAddress,
      items: orderItems,
      totalINR,
      paymentStatus: "PENDING",
      deliveryStatus: "PROCESSING",
      escrowStatus: "AWAITING_PAYMENT",
    });

    // Reduce stock
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity },
      });
    }

    // Register escrow on-chain (internal operation — not shown to customer)
    let escrowCreated = false;
    let createTxHash = null;
    try {
      const result = await escrowService.registerEscrow(orderId);
      createTxHash = result.txHash;
      escrowCreated = true;
    } catch (escrowErr) {
      console.error("[Order] Escrow registration failed:", escrowErr.message);
    }

    // Store escrow record
    await EscrowRecord.create({
      orderId,
      contractAddress: process.env.CONTRACT_ADDRESS,
      buyerAddress: process.env.BUYER_ADDRESS,
      sellerAddress: process.env.SELLER_ADDRESS,
      amountEth: process.env.ESCROW_AMOUNT_ETH || "0.001",
      onChainState: 0,
      createTxHash,
      lastError: escrowCreated ? null : "Escrow registration failed on creation",
    });

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      orderId: order.orderId,
      totalINR: order.totalINR,
    });
  } catch (err) {
    console.error("[Order] Create error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/orders/:orderId/checkout — Simulate payment & fund escrow ──────
router.post("/:orderId/checkout", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod = "SIMULATED_CARD" } = req.body;

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.paymentStatus !== "PENDING") {
      return res.status(400).json({ success: false, message: "Order already paid or processed" });
    }

    // ── Simulated customer payment (NOT real money) ───────────────────────────
    // This represents the customer's familiar payment action.
    // The actual blockchain escrow is funded separately using test ETH.
    console.log(`[Checkout] Simulating ${paymentMethod} payment for order ${orderId} (₹${order.totalINR})`);

    // ── Internal escrow funding (test ETH on local Hardhat network) ───────────
    let fundTxHash = null;
    let escrowFunded = false;
    try {
      const result = await escrowService.fundEscrow(orderId);
      fundTxHash = result.txHash;
      escrowFunded = true;
      console.log(`[Checkout] Escrow funded. TX: ${fundTxHash}`);
    } catch (escrowErr) {
      console.error("[Checkout] Escrow funding failed:", escrowErr.message);
      // Do not mark order as paid if escrow failed
      await EscrowRecord.findOneAndUpdate(
        { orderId },
        { lastError: escrowErr.message }
      );
      return res.status(500).json({
        success: false,
        message: "Payment processing failed. Please try again.",
      });
    }

    // Update order and escrow record
    await Order.findOneAndUpdate(
      { orderId },
      { paymentStatus: "CONFIRMED", escrowStatus: "FUNDED" }
    );

    await EscrowRecord.findOneAndUpdate(
      { orderId },
      {
        onChainState: 1,
        fundTxHash,
        fundedAt: new Date(),
        lastError: null,
      }
    );

    // Generate delivery OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    await DeliveryVerification.findOneAndUpdate(
      { orderId },
      {
        orderId,
        otpHash,
        otpExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h
        attempts: 0,
        verified: false,
        devOtp: process.env.NODE_ENV === "development" ? otp : null,
      },
      { upsert: true, new: true }
    );

    console.log(`[Checkout] Delivery OTP for order ${orderId}: ${otp} (dev only)`);

    res.json({
      success: true,
      message: "Payment confirmed! Your order is being processed.",
      orderId,
      paymentStatus: "CONFIRMED",
      // NOTE: OTP is NOT returned here — it's for delivery operator only
    });
  } catch (err) {
    console.error("[Checkout] Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/orders/:orderId — Get order status (customer view) ──────────────
router.get("/:orderId", async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).populate(
      "items.product",
      "name image"
    );
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    // Customer-friendly status labels
    const statusLabel = getCustomerStatusLabel(order);

    res.json({
      success: true,
      order: {
        orderId: order.orderId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        shippingAddress: order.shippingAddress,
        items: order.items,
        totalINR: order.totalINR,
        paymentStatus: order.paymentStatus,
        deliveryStatus: order.deliveryStatus,
        escrowStatus: order.escrowStatus,
        isDisputed: order.isDisputed,
        disputeReason: order.disputeReason,
        disputeResolution: order.disputeResolution,
        disputeResolvedAt: order.disputeResolvedAt,
        statusLabel,
        createdAt: order.createdAt,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/orders/customer/:email — Orders by email ────────────────────────
router.get("/customer/:email", async (req, res) => {
  try {
    const orders = await Order.find({ customerEmail: req.params.email })
      .sort({ createdAt: -1 })
      .limit(20);

    const ordersWithLabels = orders.map((o) => ({
      orderId: o.orderId,
      totalINR: o.totalINR,
      paymentStatus: o.paymentStatus,
      deliveryStatus: o.deliveryStatus,
      escrowStatus: o.escrowStatus,
      isDisputed: o.isDisputed,
      statusLabel: getCustomerStatusLabel(o),
      createdAt: o.createdAt,
      items: o.items,
    }));

    res.json({ success: true, orders: ordersWithLabels });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/orders/:orderId/dispute — Customer raises a dispute ────────────
router.post("/:orderId/dispute", async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, message: "Please provide a dispute reason" });
    }

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.isDisputed) {
      return res.status(400).json({ success: false, message: "Dispute already raised for this order" });
    }

    // Only deliveries that are confirmed can be disputed
    if (!["FUNDED", "DELIVERY_CONFIRMED"].includes(order.escrowStatus)) {
      return res.status(400).json({
        success: false,
        message: "Order is not eligible for a dispute at this stage",
      });
    }

    // If not yet delivery-confirmed, just record the dispute (delivery will see it)
    let disputeTxHash = null;
    if (order.escrowStatus === "DELIVERY_CONFIRMED") {
      try {
        // Check window is still open
        const windowOpen = await escrowService.isDisputeWindowOpen(orderId);
        if (!windowOpen) {
          return res.status(400).json({
            success: false,
            message: "The dispute window for this order has closed",
          });
        }
        const result = await escrowService.raiseDispute(orderId);
        disputeTxHash = result.txHash;
      } catch (escrowErr) {
        return res.status(500).json({ success: false, message: escrowErr.message });
      }
    }

    await Order.findOneAndUpdate(
      { orderId },
      {
        isDisputed: true,
        disputeReason: reason.trim(),
        disputeRaisedAt: new Date(),
        escrowStatus: order.escrowStatus === "DELIVERY_CONFIRMED" ? "DISPUTED" : order.escrowStatus,
      }
    );

    if (disputeTxHash) {
      await EscrowRecord.findOneAndUpdate(
        { orderId },
        { onChainState: 3, disputeTxHash }
      );
    }

    res.json({
      success: true,
      message: "Dispute raised. Our team will review and contact you shortly.",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/orders/:orderId/delivery-otp — Dev: retrieve OTP for delivery ───
router.get("/:orderId/delivery-otp", async (req, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(403).json({ success: false, message: "Not available in production" });
  }
  try {
    const dv = await DeliveryVerification.findOne({ orderId: req.params.orderId });
    if (!dv) return res.status(404).json({ success: false, message: "No OTP found" });
    res.json({ success: true, otp: dv.devOtp, expiresAt: dv.otpExpiresAt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/orders/:orderId/confirm-delivery — Delivery operator ────────────
router.post("/:orderId/confirm-delivery", requireDelivery, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { otp } = req.body;

    if (!otp) return res.status(400).json({ success: false, message: "OTP is required" });

    const order = await Order.findOne({ orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.deliveryStatus === "DELIVERED") {
      return res.status(400).json({ success: false, message: "Delivery already confirmed" });
    }
    if (order.escrowStatus !== "FUNDED") {
      return res.status(400).json({
        success: false,
        message: "Order is not in the correct state for delivery confirmation",
      });
    }

    // Verify OTP
    const dv = await DeliveryVerification.findOne({ orderId });
    if (!dv) return res.status(404).json({ success: false, message: "Delivery verification not found" });
    if (dv.verified) return res.status(400).json({ success: false, message: "Delivery already verified" });

    if (dv.attempts >= dv.maxAttempts) {
      return res.status(429).json({ success: false, message: "Too many failed attempts" });
    }
    if (new Date() > dv.otpExpiresAt) {
      return res.status(400).json({ success: false, message: "OTP has expired" });
    }

    const otpValid = await bcrypt.compare(otp.toString(), dv.otpHash);
    if (!otpValid) {
      await DeliveryVerification.findOneAndUpdate({ orderId }, { $inc: { attempts: 1 } });
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${dv.maxAttempts - dv.attempts - 1} attempts remaining.`,
      });
    }

    // Mark OTP verified
    await DeliveryVerification.findOneAndUpdate(
      { orderId },
      { verified: true, verifiedAt: new Date() }
    );

    // Confirm delivery on-chain
    let confirmTxHash = null;
    try {
      const result = await escrowService.confirmDelivery(orderId);
      confirmTxHash = result.txHash;
    } catch (escrowErr) {
      console.error("[DeliveryConfirm] Blockchain error:", escrowErr.message);
      return res.status(500).json({ success: false, message: "Blockchain confirmation failed" });
    }

    await Order.findOneAndUpdate(
      { orderId },
      { deliveryStatus: "DELIVERED", escrowStatus: "DELIVERY_CONFIRMED" }
    );

    await EscrowRecord.findOneAndUpdate(
      { orderId },
      { onChainState: 2, confirmTxHash, deliveryConfirmedAt: new Date() }
    );

    res.json({
      success: true,
      message: "Delivery confirmed successfully. Payment will be released after review period.",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/orders/delivery/pending — Delivery: list undelivered orders ─────
router.get("/delivery/pending", requireDelivery, async (req, res) => {
  try {
    const orders = await Order.find({
      deliveryStatus: { $in: ["PROCESSING", "OUT_FOR_DELIVERY"] },
    }).sort({ createdAt: -1 });

    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/orders/:orderId/out-for-delivery — Mark out for delivery ───────
router.patch("/:orderId/out-for-delivery", requireDelivery, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.paymentStatus !== "CONFIRMED") {
      return res.status(400).json({ success: false, message: "Payment not confirmed for this order" });
    }
    await Order.findOneAndUpdate({ orderId: req.params.orderId }, { deliveryStatus: "OUT_FOR_DELIVERY" });
    res.json({ success: true, message: "Order marked as out for delivery" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getCustomerStatusLabel(order) {
  if (order.escrowStatus === "REFUNDED") return "Refund Completed";
  if (order.escrowStatus === "RELEASED") return "Delivered — Payment Completed";
  if (order.isDisputed) return "Dispute Under Review";
  if (order.escrowStatus === "DELIVERY_CONFIRMED") return "Delivered — Awaiting Confirmation";
  if (order.deliveryStatus === "DELIVERED") return "Delivered";
  if (order.deliveryStatus === "OUT_FOR_DELIVERY") return "Out for Delivery";
  if (order.paymentStatus === "CONFIRMED") return "Order Processing";
  if (order.paymentStatus === "PENDING") return "Awaiting Payment";
  return "Order Placed";
}

module.exports = router;
