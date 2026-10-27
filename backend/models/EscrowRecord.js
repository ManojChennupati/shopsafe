const mongoose = require("mongoose");

const EscrowRecordSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },

    // On-chain state (numeric enum from contract)
    onChainState: { type: Number, default: 0 }, // 0=AWAITING_PAYMENT ... 5=REFUNDED

    // Transaction hashes
    createTxHash: { type: String, default: null },
    fundTxHash: { type: String, default: null },
    confirmTxHash: { type: String, default: null },
    disputeTxHash: { type: String, default: null },
    settleTxHash: { type: String, default: null },

    // Blockchain addresses used
    contractAddress: { type: String, required: true },
    buyerAddress: { type: String, required: true },
    sellerAddress: { type: String, required: true },

    // Amount in ETH string
    amountEth: { type: String, required: true },

    // Timestamps
    fundedAt: { type: Date, default: null },
    deliveryConfirmedAt: { type: Date, default: null },
    settledAt: { type: Date, default: null },

    // Settlement outcome
    settlementOutcome: {
      type: String,
      enum: ["RELEASED", "REFUNDED", null],
      default: null,
    },
    settlementRecipient: { type: String, default: null },

    // Error tracking
    lastError: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("EscrowRecord", EscrowRecordSchema);
