const mongoose = require("mongoose");

const OrderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
});

const OrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },

    // Customer info (demo — no auth system)
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true },
    shippingAddress: { type: String, required: true },

    items: [OrderItemSchema],
    totalINR: { type: Number, required: true },

    // Payment status (customer-facing)
    paymentStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "FAILED", "REFUNDED"],
      default: "PENDING",
    },

    // Delivery status (customer-facing)
    deliveryStatus: {
      type: String,
      enum: ["PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED"],
      default: "PROCESSING",
    },

    // Escrow status (mirrors on-chain state)
    escrowStatus: {
      type: String,
      enum: [
        "AWAITING_PAYMENT",
        "FUNDED",
        "DELIVERY_CONFIRMED",
        "DISPUTED",
        "RELEASED",
        "REFUNDED",
        "FAILED",
      ],
      default: "AWAITING_PAYMENT",
    },

    // Dispute
    isDisputed: { type: Boolean, default: false },
    disputeReason: { type: String, default: "" },
    disputeRaisedAt: { type: Date },
    disputeResolvedAt: { type: Date },
    disputeResolution: { type: String, enum: ["RELEASED", "REFUNDED", null], default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", OrderSchema);
