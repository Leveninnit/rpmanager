"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    if (password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        router.push("/auth/signin");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-16 text-left">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              RP
            </div>
            <span className="font-heading text-lg font-bold text-white">RPManager</span>
          </Link>
          <h1 className="font-heading text-2xl font-bold text-white mb-1">
            Create community workspace
          </h1>
          <p className="text-slate-400 text-sm">
            Set up your FiveM server instance and start your 7-day trial.
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 sm:p-8">
          {error && (
            <div className="mb-4 p-3 rounded bg-red-950/50 border border-red-800 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-mono uppercase text-slate-400 mb-1.5"
              >
                Community Name / Server Tag
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. London City RP"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-mono uppercase text-slate-400 mb-1.5"
              >
                Owner Contact Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="owner@your-community.com"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-mono uppercase text-slate-400 mb-1.5"
              >
                Password (min 8 characters)
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-mono uppercase text-slate-400 mb-1.5"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] px-4 py-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "Initializing..." : "Create Server Workspace"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-400">
            Already registered?{" "}
            <Link
              href="/auth/signin"
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
