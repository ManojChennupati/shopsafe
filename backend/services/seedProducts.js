"use strict";

/**
 * seedProducts.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds the product catalog if the collection is empty.
 */

const Product = require("../models/Product");

const SAMPLE_PRODUCTS = [
  {
    name: "Wireless Noise-Cancelling Headphones",
    description: "Premium over-ear headphones with 30-hour battery, deep bass, and crystal-clear audio. Perfect for work and travel.",
    price: 4999,
    image: "/images/headphones.jpg",
    category: "Electronics",
    stock: 15,
    rating: 4.7,
    reviews: 312,
  },
  {
    name: "Smart Fitness Band",
    description: "Track heart rate, steps, sleep, and calories. 7-day battery life, waterproof IP68 rating.",
    price: 1999,
    image: "/images/fitness-band.jpg",
    category: "Electronics",
    stock: 20,
    rating: 4.4,
    reviews: 178,
  },
  {
    name: "Organic Green Tea — 100 bags",
    description: "Premium Darjeeling first-flush green tea. Rich in antioxidants. No artificial additives.",
    price: 499,
    image: "/images/green-tea.jpg",
    category: "Food & Beverages",
    stock: 50,
    rating: 4.8,
    reviews: 892,
  },
  {
    name: "Ergonomic Desk Chair",
    description: "Adjustable lumbar support, breathable mesh back, padded armrests. Designed for all-day comfort.",
    price: 8999,
    image: "/images/desk-chair.jpg",
    category: "Furniture",
    stock: 8,
    rating: 4.5,
    reviews: 245,
  },
  {
    name: "Stainless Steel Water Bottle — 1L",
    description: "Double-wall vacuum insulation. Keeps drinks cold 24h, hot 12h. Leak-proof lid.",
    price: 799,
    image: "/images/water-bottle.jpg",
    category: "Kitchen",
    stock: 35,
    rating: 4.6,
    reviews: 567,
  },
  {
    name: "USB-C Hub — 7-in-1",
    description: "HDMI 4K, 3× USB-A, SD card, TF card, 100W PD charging. Compact aluminium design.",
    price: 1499,
    image: "/images/usb-hub.jpg",
    category: "Electronics",
    stock: 25,
    rating: 4.3,
    reviews: 134,
  },
  {
    name: "Mechanical Keyboard — TKL",
    description: "Tenkeyless layout with Cherry MX Blue switches. RGB backlit, PBT keycaps, detachable USB-C cable.",
    price: 3499,
    image: "/images/keyboard.jpg",
    category: "Electronics",
    stock: 12,
    rating: 4.6,
    reviews: 201,
  },
  {
    name: "Yoga Mat — Non-Slip 6mm",
    description: "Eco-friendly TPE material. Extra-thick 6mm cushioning. Includes carry strap.",
    price: 999,
    image: "/images/yoga-mat.jpg",
    category: "Sports",
    stock: 30,
    rating: 4.5,
    reviews: 423,
  },
];

async function seedProducts() {
  const count = await Product.countDocuments();
  if (count > 0) return;

  await Product.insertMany(SAMPLE_PRODUCTS);
  console.log(`[Seed] Inserted ${SAMPLE_PRODUCTS.length} sample products.`);
}

module.exports = { seedProducts };
