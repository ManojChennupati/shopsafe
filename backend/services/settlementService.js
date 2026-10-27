"use strict";

/**
 * settlementService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Polls for orders in DELIVERY_CONFIRMED state whose dispute window has passed
 * and automatically triggers fund release.
 */

const Order = require("../models/Order");
const EscrowRecord = require("../models/EscrowRecord");
const escrowService = require("./escrowService");

let settlementTimer = null;

async function runSettlementCycle() {
  try {
    // Find all orders that are delivery-confirmed and not disputed
    const eligibleOrders = await Order.find({
      escrowStatus: "DELIVERY_CONFIRMED",
      isDisputed: false,
    });

    for (const order of eligibleOrders) {
      try {
        const releaseable = await escrowService.canRelease(order.orderId);
        if (!releaseable) continue;

        console.log(`[Settlement] Releasing funds for order ${order.orderId}`);
        const result = await escrowService.releaseFunds(order.orderId);

        // Update DB
        await Order.findOneAndUpdate(
          { orderId: order.orderId },
          {
            escrowStatus: "RELEASED",
            paymentStatus: "CONFIRMED",
            deliveryStatus: "DELIVERED",
          }
        );

        await EscrowRecord.findOneAndUpdate(
          { orderId: order.orderId },
          {
            onChainState: 4, // RELEASED
            settleTxHash: result.txHash,
            settledAt: new Date(),
            settlementOutcome: "RELEASED",
            settlementRecipient: process.env.SELLER_ADDRESS,
          }
        );

        console.log(`[Settlement] Order ${order.orderId} released. TX: ${result.txHash}`);
      } catch (err) {
        console.error(`[Settlement] Error for order ${order.orderId}:`, err.message);
        await EscrowRecord.findOneAndUpdate(
          { orderId: order.orderId },
          { lastError: err.message }
        );
      }
    }
  } catch (err) {
    console.error("[Settlement] Cycle error:", err.message);
  }
}

function startSettlementPoller(intervalMs = 60_000) {
  console.log(`[Settlement] Poller started (every ${intervalMs / 1000}s)`);
  settlementTimer = setInterval(runSettlementCycle, intervalMs);
}

function stopSettlementPoller() {
  if (settlementTimer) clearInterval(settlementTimer);
}

module.exports = { startSettlementPoller, stopSettlementPoller, runSettlementCycle };
