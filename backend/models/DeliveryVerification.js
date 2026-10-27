const mongoose = require("mongoose");

const DeliveryVerificationSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },

    // OTP stored only as bcrypt hash — never plaintext
    otpHash: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },

    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },

    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },

    // Development-only: store OTP for display in dev panel
    // In production this would be removed entirely
    devOtp: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeliveryVerification", DeliveryVerificationSchema);
