import Link from "next/link";
import { DISCORD_INVITE_URL } from "@/lib/site";

const guides = [
  {
    title: "Create a workspace",
    detail:
      "Register with your name, email, and password. RPManager creates a private community workspace with Police, Fire & EMS, and Staff departments.",
  },
  {
    title: "Set up departments",
    detail:
      "From the dashboard, configure department ranks and quotas, create subdivisions, and manage department membership and callsigns.",
  },
  {
    title: "Manage daily operations",
    detail:
      "Use the web duty clock, review leave requests and applications, publish SOP versions, record training, and run weekly inactivity reviews.",
  },
  {
    title: "Control access",
    detail:
      "Workspace membership determines access. High Command and the owner manage confidential and administrative features; investigators only see assigned cases.",
  },
  {
    title: "Connect the Discord bot",
    detail:
      "A community owner connects each main, department, or subdivision guild from Workspace settings, configures notification channels and supervisor role IDs, then enables that guild. Members link accounts with /link and confirm the one-time code on the dashboard.",
  },
  {
    title: "Use Discord commands safely",
    detail:
      "The bot supports personal status, scoped rosters, website duty clock-in/out, private leave requests and reviews, SOP lookup/acknowledgement, and personal application status. Commands use a signed tenant-scoped service API. Voice tracking and automatic role changes are not implemented.",
  },
];

export default function DocumentationPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 pb-16 pt-28 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 border-b border-slate-800 pb-8">
          <p className="font-mono text-xs uppercase tracking-wider text-blue-400">
            RPManager guide
          </p>
          <h1 className="mt-3 font-heading text-3xl font-bold text-white sm:text-4xl">
            Documentation
          </h1>
          <p className="mt-4 max-w-2xl text-slate-400">
            Get started with your community workspace and learn which operations
            are available on the website today.
          </p>
        </div>

        <div className="grid gap-4">
          {guides.map((guide, index) => (
            <section
              key={guide.title}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-5 sm:p-6"
            >
              <p className="font-mono text-xs text-blue-400">
                GUIDE {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-2 font-heading text-lg font-bold text-white">
                {guide.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {guide.detail}
              </p>
            </section>
          ))}
        </div>

        <section
          id="discord"
          className="mt-8 rounded-lg border border-slate-800 bg-slate-900/60 p-5 sm:p-6"
        >
          <h2 className="font-heading text-lg font-bold text-white">
            Discord integration
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            The bot does not request privileged Discord intents or database access.
            Leave reasons, application answers, Internal Affairs records, and
            disciplinary details are never sent to Discord. See the project&apos;s
            <code className="mx-1 text-blue-300">bot/README.md</code> for setup,
            permissions, commands, privacy, and troubleshooting.
          </p>
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-11 items-center rounded bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Join our Discord
          </a>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/auth/signup"
            className="inline-flex min-h-11 items-center rounded bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Create a workspace
          </Link>
          <Link
            href="/pricing"
            className="inline-flex min-h-11 items-center rounded border border-slate-700 px-5 text-sm font-medium text-slate-300 hover:bg-slate-900 hover:text-white"
          >
            View pricing
          </Link>
        </div>
      </div>
    </main>
  );
}
