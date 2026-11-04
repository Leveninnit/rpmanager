import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder", {
  apiVersion: "2026-10-28.endive",
  typescript: true,
});

export const PLANS = {
  starter: {
    name: "Starter",
    description: "Perfect for small communities",
    price: "£9.99",
    priceId: process.env.STRIPE_STARTER_PRICE_ID || "price_starter",
    features: [
      "1 FiveM Server",
      "Up to 50 staff members",
      "Staff applications",
      "Department management",
      "Basic roster tracking",
      "Email support",
    ],
    limits: {
      servers: 1,
      staffMembers: 50,
    },
  },
  pro: {
    name: "Pro",
    description: "For growing RP communities",
    price: "£19.99",
    priceId: process.env.STRIPE_PRO_PRICE_ID || "price_pro",
    features: [
      "3 FiveM Servers",
      "Up to 200 staff members",
      "Everything in Starter",
      "Training logs & certifications",
      "SOP management",
      "Internal affairs tracking",
      "Activity/hours tracking",
      "Priority support",
    ],
    limits: {
      servers: 3,
      staffMembers: 200,
    },
  },
  enterprise: {
    name: "Enterprise",
    description: "For large, established communities",
    price: "£39.99",
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || "price_enterprise",
    features: [
      "Unlimited FiveM Servers",
      "Unlimited staff members",
      "Everything in Pro",
      "Custom branding",
      "API access",
      "Dedicated support",
      "Advanced analytics",
      "Multi-community management",
    ],
    limits: {
      servers: -1, // unlimited
      staffMembers: -1, // unlimited
    },
  },
} as const;

export type PlanKey = keyof typeof PLANS;

