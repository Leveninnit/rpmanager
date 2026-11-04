"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { DISCORD_INVITE_URL } from "@/lib/site";

export default function Navbar() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/95 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link href="/" className="flex items-center gap-3 min-h-[44px] py-2">
            <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-sm text-white">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-white">
              RPManager
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/#features"
              className="min-h-[44px] inline-flex items-center px-3 text-slate-300 hover:text-white transition-colors text-sm font-medium"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              className="min-h-[44px] inline-flex items-center px-3 text-slate-300 hover:text-white transition-colors text-sm font-medium"
            >
              Pricing
            </Link>
            <Link
              href="/docs"
              className="min-h-[44px] inline-flex items-center px-3 text-slate-300 hover:text-white transition-colors text-sm font-medium"
            >
              Documentation
            </Link>
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noreferrer"
              className="min-h-[44px] inline-flex items-center px-3 text-blue-300 hover:text-blue-200 transition-colors text-sm font-semibold"
            >
              Join our Discord
            </a>
          </div>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="min-h-[44px] inline-flex items-center px-3 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <span className="text-xs font-mono text-slate-400 border border-slate-800 bg-slate-900 px-2.5 py-1 rounded">
                  {session.user?.name || session.user?.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="min-h-[44px] px-4 py-2 text-sm font-medium text-slate-300 hover:text-white border border-slate-800 bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <>
                <Link
                  href="/auth/signin"
                  className="min-h-[44px] inline-flex items-center px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/signup"
                  className="min-h-[44px] inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                >
                  Create Workspace
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 text-slate-400 hover:text-white"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 py-4 space-y-1">
            <Link
              href="/#features"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center min-h-[44px] px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-900 rounded text-sm font-medium"
            >
              Features
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center min-h-[44px] px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-900 rounded text-sm font-medium"
            >
              Pricing
            </Link>
            <Link
              href="/docs"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center min-h-[44px] px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-900 rounded text-sm font-medium"
            >
              Documentation
            </Link>
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center min-h-[44px] px-3 py-2 text-blue-300 hover:text-blue-200 hover:bg-slate-900 rounded text-sm font-semibold"
            >
              Join our Discord
            </a>
            {session && (
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center min-h-[44px] px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-900 rounded text-sm font-medium"
              >
                Dashboard
              </Link>
            )}
            <div className="border-t border-slate-800 pt-3 mt-3 space-y-2">
              {session ? (
                <button
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full min-h-[44px] px-3 py-2 text-slate-300 hover:text-white hover:bg-slate-900 rounded text-sm font-medium text-left"
                >
                  Sign Out
                </button>
              ) : (
                <>
                  <Link
                    href="/auth/signin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center min-h-[44px] px-3 py-2 text-slate-300 hover:text-white rounded text-sm font-medium"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/auth/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center min-h-[44px] px-4 py-2 text-white bg-blue-600 rounded text-sm font-semibold"
                  >
                    Create Workspace
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
