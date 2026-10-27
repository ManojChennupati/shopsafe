"use strict";

/**
 * escrowService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Internal blockchain integration service.
 * Customers never interact with these functions directly.
 * The Express routes call these functions; all blockchain complexity stays here.
 */

const { ethers } = require("ethers");
const path = require("path");
const fs = require("fs");

let provider, operatorWallet, contract, config;

// ── State enum (mirrors Solidity) ───────────────────────────────────────────
const EscrowState = {
  0: "AWAITING_PAYMENT",
  1: "FUNDED",
  2: "DELIVERY_CONFIRMED",
  3: "DISPUTED",
  4: "RELEASED",
  5: "REFUNDED",
  AWAITING_PAYMENT: 0,
  FUNDED: 1,
  DELIVERY_CONFIRMED: 2,
  DISPUTED: 3,
  RELEASED: 4,
  REFUNDED: 5,
};

/**
 * Initialise the escrow service.
 * Must be called once on backend startup after .env is loaded.
 */
async function init() {
  const rpcUrl = process.env.HARDHAT_RPC_URL || "http://127.0.0.1:8545";
  const privateKey = process.env.OPERATOR_PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!privateKey) throw new Error("OPERATOR_PRIVATE_KEY not set in .env");
  if (!contractAddress) throw new Error("CONTRACT_ADDRESS not set in .env");

  // Load ABI
  const abiPath = path.join(__dirname, "..", "config", "SecureEscrow.abi.json");
  if (!fs.existsSync(abiPath)) {
    throw new Error(
      `ABI not found at ${abiPath}. Run: npx hardhat run scripts/deploy-local.js --network localhost`
    );
  }
  const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));

  provider = new ethers.JsonRpcProvider(rpcUrl);
  operatorWallet = new ethers.Wallet(privateKey, provider);
  contract = new ethers.Contract(contractAddress, abi, operatorWallet);

  // Verify connection
  const network = await provider.getNetwork();
  console.log(
    `[EscrowService] Connected — chain ${network.chainId}, contract ${contractAddress}`
  );

  config = {
    contractAddress,
    escrowAmountEth: process.env.ESCROW_AMOUNT_ETH || "0.001",
    disputeWindowSeconds: parseInt(process.env.DISPUTE_WINDOW_SECONDS || "300", 10),
    sellerAddress: process.env.SELLER_ADDRESS,
    buyerAddress: process.env.BUYER_ADDRESS,
  };

  return config;
}

/**
 * Register a new escrow for an order on-chain.
 */
async function registerEscrow(orderId) {
  const amount = ethers.parseEther(config.escrowAmountEth);
  const tx = await contract.createEscrow(
    orderId,
    config.buyerAddress,
    config.sellerAddress,
    amount,
    config.disputeWindowSeconds
  );
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("createEscrow transaction failed");
  return { txHash: receipt.hash, amount: config.escrowAmountEth };
}

/**
 * Fund the escrow (sends test ETH from operator wallet).
 */
async function fundEscrow(orderId) {
  const amount = ethers.parseEther(config.escrowAmountEth);
  const tx = await contract.fundEscrow(orderId, { value: amount });
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("fundEscrow transaction failed");
  return { txHash: receipt.hash };
}

/**
 * Confirm delivery on-chain (called after OTP verification).
 */
async function confirmDelivery(orderId) {
  const tx = await contract.confirmDelivery(orderId);
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("confirmDelivery transaction failed");
  return { txHash: receipt.hash };
}

/**
 * Raise a dispute on-chain.
 */
async function raiseDispute(orderId) {
  const tx = await contract.raiseDispute(orderId);
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("raiseDispute transaction failed");
  return { txHash: receipt.hash };
}

/**
 * Release funds to seller after dispute window (normal path).
 */
async function releaseFunds(orderId) {
  const tx = await contract.releaseFunds(orderId);
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("releaseFunds transaction failed");
  return { txHash: receipt.hash };
}

/**
 * Admin: release funds to seller from disputed escrow.
 */
async function adminRelease(orderId) {
  const tx = await contract.adminRelease(orderId);
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("adminRelease transaction failed");
  return { txHash: receipt.hash };
}

/**
 * Admin: refund funds to buyer from disputed escrow.
 */
async function adminRefund(orderId) {
  const tx = await contract.adminRefund(orderId);
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error("adminRefund transaction failed");
  return { txHash: receipt.hash };
}

/**
 * Read the current on-chain escrow state (as a string label).
 */
async function getOnChainState(orderId) {
  const stateNum = await contract.getEscrowState(orderId);
  return {
    stateNum: Number(stateNum),
    stateLabel: EscrowState[Number(stateNum)] || "UNKNOWN",
  };
}

/**
 * Read full escrow details from chain.
 */
async function getEscrowDetails(orderId) {
  const result = await contract.getEscrow(orderId);
  return {
    buyer: result[0],
    seller: result[1],
    amount: ethers.formatEther(result[2]),
    stateNum: Number(result[3]),
    stateLabel: EscrowState[Number(result[3])] || "UNKNOWN",
    fundedAt: Number(result[4]),
    deliveryConfirmedAt: Number(result[5]),
    disputeWindowSeconds: Number(result[6]),
    exists: result[7],
  };
}

/**
 * Check if the dispute window has passed and funds can be released.
 */
async function canRelease(orderId) {
  return contract.canRelease(orderId);
}

/**
 * Check if the dispute window is still open.
 */
async function isDisputeWindowOpen(orderId) {
  return contract.isDisputeWindowOpen(orderId);
}

/**
 * Check blockchain connectivity.
 */
async function healthCheck() {
  try {
    const blockNumber = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    return { connected: true, blockNumber, chainId: network.chainId.toString() };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = {
  init,
  registerEscrow,
  fundEscrow,
  confirmDelivery,
  raiseDispute,
  releaseFunds,
  adminRelease,
  adminRefund,
  getOnChainState,
  getEscrowDetails,
  canRelease,
  isDisputeWindowOpen,
  healthCheck,
  EscrowState,
};
