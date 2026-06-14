// backend/server.js — Stripe PaymentIntents (authenticated)
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const { createClient } = require("@supabase/supabase-js");

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_PAYMENT_UGX = 50_000_000;
const MIN_PAYMENT_UGX = 1_000;

if (!stripeSecretKey) {
  console.error("Missing STRIPE_SECRET_KEY in .env");
  process.exit(1);
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY for payment auth.",
  );
  process.exit(1);
}

const app = express();
const stripe = new Stripe(stripeSecretKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsOrigins = (process.env.PAYMENTS_CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    methods: ["GET", "POST", "OPTIONS"],
  }),
);
app.use(express.json({ limit: "32kb" }));

function ugxToStripeAmount(amountUGX) {
  const wholeUGX = Math.round(Number(amountUGX || 0));

  if (!Number.isFinite(wholeUGX) || wholeUGX <= 0) {
    throw new Error("Invalid UGX amount");
  }

  if (wholeUGX < MIN_PAYMENT_UGX) {
    throw new Error(`Minimum payment is ${MIN_PAYMENT_UGX} UGX`);
  }

  if (wholeUGX > MAX_PAYMENT_UGX) {
    throw new Error(`Maximum payment is ${MAX_PAYMENT_UGX} UGX`);
  }

  return wholeUGX * 100;
}

async function requireAuthUser(req, res) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return null;
  }

  return user;
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "mataim-payments",
    currency: "UGX",
  });
});

app.post("/api/payments/create-payment-intent", async (req, res) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;

    const { amountUGX, customerEmail, metadata } = req.body || {};

    const safeMetadata = {};
    if (metadata && typeof metadata === "object") {
      for (const [key, value] of Object.entries(metadata)) {
        if (typeof value === "string" && value.length <= 500) {
          safeMetadata[key] = value;
        }
      }
    }

    safeMetadata.customer_id = user.id;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: ugxToStripeAmount(amountUGX),
      currency: "ugx",
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: customerEmail || user.email || undefined,
      metadata: {
        app: "mataim",
        currency: "UGX",
        ...safeMetadata,
      },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      currency: "ugx",
    });
  } catch (error) {
    console.error("Stripe PaymentIntent error:", error);

    return res.status(400).json({
      error: error.message || "Could not create payment intent",
    });
  }
});

app.post("/api/payments/verify-payment-intent", async (req, res) => {
  try {
    const user = await requireAuthUser(req, res);
    if (!user) return;

    const { paymentIntentId } = req.body || {};

    if (!paymentIntentId || typeof paymentIntentId !== "string") {
      return res.status(400).json({ error: "paymentIntentId is required" });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!paymentIntent) {
      return res.status(404).json({ error: "Payment intent not found" });
    }

    // Verify the payment intent belongs to this customer
    if (paymentIntent.metadata?.customer_id !== user.id) {
      return res.status(403).json({ error: "Payment intent does not belong to this user" });
    }

    // Return payment status and details
    return res.json({
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      created: paymentIntent.created,
      charges: paymentIntent.charges?.data || [],
      client_secret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Verify PaymentIntent error:", error);

    return res.status(400).json({
      error: error.message || "Could not verify payment intent",
    });
  }
});

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.info(`Payments API running on http://localhost:${port}`);
});
