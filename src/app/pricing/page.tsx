"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

const plans = [
  {
    key: "starter",
    name: "Starter Community",
    price: "£9.99",
    period: "/mo",
    description: "For new FiveM communities launching their first police and EMS departments.",
    highlighted: false,
    cta: "Start 7-day Starter trial",
    features: [
      "1 FiveM Server Link",
      "Up to 50 active department staff",
      "Roads Policing & EMS callsign rosters",
      "Staff application review pipeline",
      "Digital SOP repository",
      "Email support",
    ],
  },
  {
    key: "pro",
    name: "Pro Department Network",
    price: "£19.99",
    period: "/mo",
    description: "For active RP servers needing structured FTO driver signoffs and internal affairs cases.",
    highlighted: true,
    cta: "Start 7-day Pro trial",
    features: [
      "3 FiveM Server Links",
      "Up to 200 active department staff",
      "Everything in Starter Community",
      "Probationary FTO training passports",
      "Internal affairs & disciplinary records",
      "Patrol hours & activity audit log",
      "Priority technical support",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise Multi-Server",
    price: "£39.99",
    period: "/mo",
    description: "For large roleplay networks operating multiple public and whitelisted FiveM servers.",
    highlighted: false,
    cta: "Start 7-day Enterprise trial",
    features: [
      "Unlimited FiveM Server Links",
      "Unlimited staff and roster entries",
      "Everything in Pro Network",
      "Custom department branding",
      "REST API access for FiveM Lua scripts",
      "Cross-server ban & strike sync",
      "Dedicated account manager",
    ],
  },
];

export default function PricingPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (planKey: string) => {
    if (!session) {
      router.push("/auth/signup");
      return;
    }

    setLoadingPlan(planKey);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      // Handled silently
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 py-28 px-4 sm:px-6 lg:px-8 text-left">
      <div className="max-w-7xl mx-auto">
        {/* Header (Left-aligned, 1 sentence subtitle, concrete words) */}
        <div className="max-w-2xl mb-12">
          <span className="text-xs font-mono uppercase tracking-wider text-blue-400 mb-2 block">
            Server Subscriptions
          </span>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-3">
            Predictable pricing for FiveM communities
          </h1>
          <p className="text-slate-400 text-base">
            Every subscription includes a 7-day trial with full access to callsign management and applicant vetting.
          </p>
        </div>

        {/* Pricing Cards (Solid borders, zero gradient buttons, 44px touch targets) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch mb-12">
          {plans.map((plan) => (
            <div
              key={plan.key}
              className={`rounded-lg p-6 sm:p-8 flex flex-col justify-between border ${
                plan.highlighted
                  ? "border-blue-600 bg-slate-900/90 relative"
                  : "border-slate-800 bg-slate-900/40"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded bg-blue-600 text-white text-xs font-mono font-semibold">
                  Most Popular For Active Servers
                </div>
              )}

              <div>
                <div className="mb-4">
                  <h2 className="font-heading text-xl font-bold text-white mb-1">
                    {plan.name}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {plan.description}
                  </p>
                </div>

                <div className="flex items-baseline gap-1 mb-6 border-b border-slate-800 pb-6">
                  <span className="font-heading text-4xl font-bold text-white">
                    {plan.price}
                  </span>
                  <span className="text-slate-400 text-sm font-mono">
                    {plan.period}
                  </span>
                </div>

                <div className="space-y-3 mb-8">
                  <span className="text-xs font-mono uppercase text-slate-400 font-semibold block">
                    Included capabilities:
                  </span>
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5 text-xs text-slate-300">
                      <svg
                        className="w-4 h-4 text-blue-500 shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleSelectPlan(plan.key)}
                disabled={loadingPlan === plan.key}
                className={`w-full min-h-[44px] px-4 py-2.5 rounded text-sm font-semibold transition-colors flex items-center justify-center ${
                  plan.highlighted
                    ? "bg-blue-600 hover:bg-blue-500 text-white"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700"
                }`}
              >
                {loadingPlan === plan.key ? "Redirecting to Stripe..." : plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Back Link */}
        <div className="pt-4 border-t border-slate-800">
          <Link
            href="/"
            className="text-xs font-mono text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            ← Back to operations overview
          </Link>
        </div>
      </div>
    </div>
  );
}
