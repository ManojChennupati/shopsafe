"use strict";

/**
 * auth.js — Simple demo middleware.
 * Uses fixed passwords from .env — NOT for production use.
 */

function requireAdmin(req, res, next) {
  const password = req.headers["x-admin-password"] || req.body?.adminPassword;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: "Admin authorization required" });
  }
  next();
}

function requireDelivery(req, res, next) {
  const password = req.headers["x-delivery-password"] || req.body?.deliveryPassword;
  if (!password || password !== process.env.DELIVERY_PASSWORD) {
    return res.status(401).json({ success: false, message: "Delivery operator authorization required" });
  }
  next();
}

module.exports = { requireAdmin, requireDelivery };
