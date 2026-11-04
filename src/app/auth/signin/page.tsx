"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn, type ClientSafeProvider } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [discordProvider, setDiscordProvider] = useState<ClientSafeProvider | null>(null);
  const [discordAuthState, setDiscordAuthState] = useState<
    "loading" | "available" | "unconfigured" | "error"
  >("loading");

  useEffect(() => {
    let active = true;
    getProviders().then((providers) => {
      if (!active) return;
      const provider = providers?.discord ?? null;
      setDiscordProvider(provider);
      setDiscordAuthState(provider ? "available" : "unconfigured");
    }).catch(() => {
      if (active) setDiscordAuthState("error");
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid email or password. Please try again.");
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
            Sign in to server workspace
          </h1>
          <p className="text-slate-400 text-sm">
            Access your department rosters and recruitment queue.
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
            {discordAuthState === "available" && discordProvider ? (
              <>
                <button
                  type="button"
                  onClick={() => signIn("discord", { callbackUrl: "/dashboard" })}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors"
                >
                  Continue with Discord
                </button>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="h-px flex-1 bg-slate-800" />
                  <span>or sign in with email</span>
                  <span className="h-px flex-1 bg-slate-800" />
                </div>
              </>
            ) : discordAuthState !== "loading" ? (
              <div
                role="status"
                className="mb-4 rounded border border-slate-800 bg-slate-950/70 p-3 text-sm text-slate-400"
              >
                {discordAuthState === "unconfigured"
                  ? "Discord sign-in is not configured yet. The website administrator must set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in the website environment and restart the server."
                  : "Discord sign-in setup could not be checked. Refresh the page and try again."}
              </div>
            ) : null}
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-mono uppercase text-slate-400 mb-1.5"
              >
                Operator Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="commander@your-community.com"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-mono uppercase text-slate-400 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[44px] px-4 py-2.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign In to Workspace"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-400">
            Need a community account?{" "}
            <Link
              href="/auth/signup"
              className="text-blue-400 hover:text-blue-300 font-medium"
            >
              Create workspace
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
