import Link from "next/link";
import LandingDemo from "@/components/landing-demo";
import {
  LandingDepartmentDemo,
  LandingInactivityDemo,
  LandingLeaveDemo,
} from "@/components/landing-feature-demos";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* 1. Asymmetrical Hero Section */}
      <section className="pt-28 pb-16 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column (Left-Aligned Value Prop) */}
            <div className="lg:col-span-7 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-slate-800 bg-slate-900 text-xs font-mono text-slate-300 mb-6">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Secure multi-department community workspace
              </div>

              <h1 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6">
                Roleplay community operations, organized in one workspace
              </h1>

              <p className="text-slate-300 text-base sm:text-lg mb-8 max-w-xl">
                Manage personnel, departments, duty hours, leave, applications, training, SOPs, and confidential investigations for your roleplay community.
              </p>

              {/* Single Clear Specific CTA + Status indicator */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8">
                <Link
                  href="/auth/signup"
                  className="min-h-[44px] inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                >
                  Create your server workspace
                </Link>
                <Link
                  href="/pricing"
                  className="min-h-[44px] inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-slate-300 hover:text-white border border-slate-800 bg-slate-900 hover:bg-slate-800 rounded transition-colors"
                >
                  Compare server pricing plans
                </Link>
              </div>

              <div className="flex items-center gap-6 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Email and optional Discord OAuth2
                </span>
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  7-day free trial
                </span>
              </div>
            </div>

            <div className="lg:col-span-5">
              <LandingDemo />
            </div>
          </div>
        </div>
      </section>

      {/* 2. LOA Engine Section */}
      <section id="loa" className="py-20 border-b border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-400 mb-2 block">
              Leave of Absence Management
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-3">
              Website-based leave requests
            </h2>
            <p className="text-slate-400 text-base">
              Submit date-based leave requests, review decisions, track leave history, and pause weekly activity requirements for approved leave.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <p className="max-w-2xl text-sm leading-6 text-slate-300">The signed-in workspace records the request, review decision, status, and expiry. Discord notifications and role changes are not currently connected.</p>
            <Link href="/dashboard" className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 sm:mt-0">Open leave management</Link>
          </div>
          <div className="mt-8">
            <LandingLeaveDemo />
          </div>
        </div>
      </section>

      {/* 3. Inactivity Strikes & Warnings Section */}
      <section id="inactivity" className="py-20 border-b border-slate-800 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-mono uppercase tracking-wider text-amber-400 mb-2 block">
              Disciplinary & Quota Automation
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-3">
              Inactivity audits with High Command override
            </h2>
            <p className="text-slate-400 text-base">
              High Command can run a previous-week quota review, inspect draft warnings, issue or pardon records, and configure grace and expiry rules.
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <p className="max-w-2xl text-sm leading-6 text-slate-300">Audits use website duty records and department quotas. Approved leave, grace periods, and exemptions are considered; no Discord notifications or automatic bot actions are sent.</p>
            <Link href="/dashboard" className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500 sm:mt-0">Open inactivity controls</Link>
          </div>
          <div className="mt-8">
            <LandingInactivityDemo />
          </div>
        </div>
      </section>

      {/* 4. Interactive Folded Operations */}
      <section id="features" className="py-20 border-b border-slate-800">
        <span id="departments" className="relative -top-20" aria-hidden="true" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          <div className="max-w-2xl mb-10">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-400 mb-2 block">
              Department Operations & Subdivisions
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-3">
              Dedicated rosters and SOPs for every department
            </h2>
            <p className="text-slate-400 text-base">
              Configure Police, Fire/EMS, Staff, or custom departments with independent rosters, subdivisions, callsigns, quotas, SOPs, and training records.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Personnel", "Ranks, badge numbers, callsigns, status, promotions, and transfers."],
              ["Department structure", "Custom departments, subdivisions, leaders, and role access."],
              ["Operations", "Website duty clock, weekly reports, leave, applications, and training."],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-lg border border-slate-800 bg-slate-900/60 p-5">
                <h3 className="font-heading text-base font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm text-slate-400">{detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-8">
            <LandingDepartmentDemo />
          </div>
        </div>
      </section>

      {/* 5. Direct Comparison Matrix */}
      <section id="comparison" className="py-14 border-b border-slate-800 bg-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          <div className="max-w-2xl mb-8">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-400 mb-2 block">
              Operational Difference
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-3">
              Why communities retire shared spreadsheets
            </h2>
            <p className="text-slate-400 text-base">
              Managing 80 staff members across 15 Google Sheets leads to overwritten formulas, untracked rank changes, and missing patrol logs.
            </p>
          </div>

          <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-900/60">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-xs font-mono uppercase text-slate-400">
                  <th className="px-6 py-4">Capability</th>
                  <th className="px-6 py-4 text-slate-400">Discord Bots & Google Sheets</th>
                  <th className="px-6 py-4 text-blue-400 font-bold">RPManager Workspace</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                <tr>
                  <td className="px-6 py-4 font-semibold text-white">LOA & Absence Tracking</td>
                  <td className="px-6 py-4 text-slate-400">Manual sheet entries, staff forget to remove roles after return.</td>
                  <td className="px-6 py-4 text-slate-200 font-medium">Website requests, command decisions, quota exclusions, status tracking, and expiry.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-white">Inactivity Quota Auditing</td>
                  <td className="px-6 py-4 text-slate-400">Command spends 3+ hours every Sunday manually counting hours.</td>
                  <td className="px-6 py-4 text-slate-200 font-medium">Previous-week web-hour audit with draft review, confirmation, and pardon controls.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-white">Multi-Department Linking</td>
                  <td className="px-6 py-4 text-slate-400">Separate bots across multiple Discords with conflicting data.</td>
                  <td className="px-6 py-4 text-slate-200 font-medium">Multi-department workspaces with Discord server links ready for future bot synchronization.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-semibold text-white">Security & Audit Logs</td>
                  <td className="px-6 py-4 text-slate-400">Anyone with editor permissions can wipe columns permanently.</td>
                  <td className="px-6 py-4 text-slate-200 font-medium">Role-protected, append-only application audit events for management actions.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 6. Compact Action Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-left">
          <div className="border border-slate-800 rounded-lg bg-slate-900 p-8 sm:p-12 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-2xl">
              <h2 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-2">
                Start your 7-day server trial
              </h2>
              <p className="text-slate-400 text-base">
                Set up your departments, configure officer ranks, and test the recruitment review queue today.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Link
                href="/auth/signup"
                className="min-h-[44px] inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors whitespace-nowrap"
              >
                Create your server workspace
              </Link>
              <Link
                href="/pricing"
                className="min-h-[44px] inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-slate-300 hover:text-white border border-slate-800 bg-slate-950 hover:bg-slate-800 rounded transition-colors whitespace-nowrap"
              >
                Inspect plan specifications
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-10 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">
              RP
            </div>
            <span className="font-sans font-bold text-slate-200">RPManager</span>
            <span>— FiveM Roleplay Department Systems</span>
          </div>
          <p>&copy; 2026 RPManager. Built for FiveM server operators.</p>
        </div>
      </footer>
    </main>
  );
}
