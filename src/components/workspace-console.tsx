"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type Row = Record<string, unknown>;
type Department = Row & {
  id: string;
  name: string;
  code: string;
  weeklyQuotaHours: number;
  rankStructureJson: string;
  discordGuildId: string | null;
  discordRoleId: string | null;
  discordRoleMappingsJson: string;
  subdivisions: Array<{
    id: string;
    name: string;
    code: string;
    members: Array<{
      id: string;
      userId: string;
      role: string;
      user: { id: string; name: string | null };
    }>;
  }>;
  _count: { members: number; subdivisions: number; sops: number };
};
type RosterMember = Row & {
  id: string;
  userId: string;
  rank: string;
  callsign: string | null;
  badgeNumber: string | null;
  status: string;
  user: { id: string; name: string | null; email: string | null };
  department: { id: string; name: string; code: string };
};
type WorkspaceData = {
  discordAccountLinked: boolean;
  community: {
    id: string;
    name: string;
    gamePreset: string;
    customTerminologyJson: string;
    permissionConfigJson: string;
    mainDiscordGuildId: string | null;
    role: string;
  };
  memberships: Array<Row & { community: { id: string; name: string; gamePreset: string } }>;
  communityPeople: Array<Row & {
    role: string;
    discordMainMember: boolean | null;
    discordSyncedAt: string | null;
    user: { id: string; name: string | null; email: string | null };
  }>;
  departments: Department[];
  roster: RosterMember[];
  dutyShifts: Array<Row & {
    id: string;
    userId: string;
    callsign: string;
    startTime: string;
    endTime: string | null;
    durationMinutes: number | null;
    user: { id: string; name: string | null };
    department: { id: string; name: string } | null;
    subdivision: { id: string; name: string } | null;
  }>;
  weeklyHours: Array<{ userId: string; departmentId: string; minutes: number; hours: number }>;
  weekStartsAt: string;
  leaveRequests: Array<Row & {
    id: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: string;
    user: { id: string; name: string | null };
    department: { id: string; name: string } | null;
  }>;
  strikes: Array<Row & {
    id: string;
    status: string;
    strikeLevel: number;
    hoursLogged: number;
    hoursRequired: number;
    expiresAt: string | null;
    officer: { id: string; name: string | null; callsign: string | null };
    department: { id: string; name: string } | null;
  }>;
  disciplinaryRecords: Array<Row & {
    id: string;
    type: string;
    title: string;
    details: string;
    status: string;
    expiresAt: string | null;
    pardonedAt: string | null;
    subject: { id: string; name: string | null };
    issuer: { name: string | null };
    department: { id: string; name: string };
  }>;
  sops: Array<Row & {
    id: string;
    title: string;
    category: string;
    content: string;
    version: string;
    department: { id: string; name: string };
    subdivision: { id: string; name: string } | null;
    _count: { acknowledgements: number };
    acknowledgements?: Array<{
      version: string;
      acknowledgedAt: string;
      user: { id: string; name: string | null };
    }>;
    versions?: Array<{ id: string; version: string; createdAt: string; changeNotes: string | null }>;
  }>;
  applicationForms: Array<{ id: string; title: string; departmentId: string; questionsJson: string; description: string | null }>;
  applications: Array<Row & {
    id: string;
    status: string;
    stage: string;
    score: number | null;
    answersJson: string;
    applicantName: string;
    reviewerNotes: string | null;
    department: { id: string; name: string };
  }>;
  courses: Array<Row & {
    id: string;
    title: string;
    certification: string | null;
    description: string | null;
    required: boolean;
    department: { id: string; name: string } | null;
    _count: { records: number };
  }>;
  trainingRecords: Array<Row & {
    id: string;
    courseId: string;
    status: string;
    completedAt: string;
    expiresAt: string | null;
    user: { id: string; name: string | null };
    course: { id: string; title: string; certification: string | null };
  }>;
  auditLogs: Array<Row & {
    id: string;
    actorName: string;
    action: string;
    targetId: string | null;
    details: string;
    createdAt: string;
  }>;
  connectedServers: Array<Row & {
    id: string;
    name: string;
    guildId: string;
    kind: string;
    departmentId: string | null;
    subdivisionId: string | null;
    botEnabled: boolean;
    supervisorRoleIdsJson: string;
    notificationChannelId: string | null;
    notifyLeave: boolean;
    notifyApplications: boolean;
    notifyInactivity: boolean;
    lastBotSeenAt: string | null;
  }>;
  investigations: Array<Row & {
    id: string;
    caseNumber: string;
    title: string;
    allegations: string;
    status: string;
    finding: string | null;
    outcome: string | null;
    subject: { id: string; name: string | null } | null;
    investigator: { id: string; name: string | null } | null;
    entries: Array<{ id: string; type: string; content: string; referenceUrl: string | null; createdAt: string; createdBy: { name: string | null } }>;
  }>;
  policy: {
    weeklyQuotaHours: number;
    warningThreshold: number;
    strikeThreshold: number;
    gracePeriodDays: number;
    strikeExpiryDays: number;
    autoApplyWarnings: boolean;
  } | null;
  notifications: Array<{ id: string; title: string; message: string; readAt: string | null; createdAt: string }>;
  analytics: {
    members: number;
    departments: number;
    subdivisions: number;
    pendingApplications: number;
    activeShifts: number;
    collectiveHours: number;
    trainingRecords: number;
    pendingLeave: number;
  };
  capabilities: {
    manager: boolean;
    highCommand: boolean;
    internalAffairs: boolean;
    iaCommand: boolean;
  };
};

const navigation = [
  { id: "overview", label: "Overview" },
  { id: "roster", label: "Personnel" },
  { id: "departments", label: "Departments" },
  { id: "subdivisions", label: "Subdivisions" },
  { id: "duty", label: "Duty & hours" },
  { id: "leave", label: "Leave" },
  { id: "inactivity", label: "Inactivity & discipline" },
  { id: "sops", label: "SOP library" },
  { id: "applications", label: "Applications" },
  { id: "training", label: "Training" },
  { id: "ia", label: "Internal affairs" },
  { id: "analytics", label: "Analytics" },
  { id: "audit", label: "Audit history" },
  { id: "account", label: "Discord account" },
  { id: "settings", label: "Workspace settings" },
];

const inputClass =
  "w-full min-h-[44px] px-3 py-2 rounded bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
const buttonClass =
  "min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:opacity-50";

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden">
      <header className="min-h-14 flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-800 bg-slate-950/60">
        <h2 className="font-heading text-base font-bold text-white">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  defaultValue,
  min,
  max,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number;
  min?: number;
  max?: number;
  children?: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-slate-300">
      {label}
      {children || (
        <input
          className={inputClass}
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          min={min}
          max={max}
        />
      )}
    </label>
  );
}

function Empty({ children = "No records yet." }: { children?: React.ReactNode }) {
  return (
    <p className="rounded border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </p>
  );
}

function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-950 text-xs font-mono uppercase tracking-wider text-slate-400">
          <tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-800/80">{children}</tbody>
      </table>
    </div>
  );
}

function Cell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-top text-slate-300 ${className}`}>{children}</td>;
}

function readList(value: string, fallback: string[]) {
  try {
    const result: unknown = JSON.parse(value);
    return Array.isArray(result) ? result : fallback;
  } catch {
    return fallback;
  }
}

function commaSeparatedList(value: FormDataEntryValue | undefined) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function WorkspaceConsole() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [activePage, setActivePage] = useState("overview");
  const [communityId, setCommunityId] = useState("");
  const [applicationFormId, setApplicationFormId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [clock, setClock] = useState(0);

  const loadWorkspace = useCallback(async (id?: string) => {
    setLoading(true);
    setError("");
    try {
      const query = id ? `?communityId=${encodeURIComponent(id)}` : "";
      const response = await fetch(`/api/workspace${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load workspace");
      setData(result as WorkspaceData);
      setCommunityId(result.community.id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load workspace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
    if (status !== "authenticated") return;
    const timeout = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timeout);
  }, [status, router, loadWorkspace]);

  useEffect(() => {
    const tick = () => setClock(Date.now());
    const initialTick = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(timer);
    };
  }, []);

  const runAction = useCallback(
    async (action: string, values: Record<string, unknown> = {}, form?: HTMLFormElement) => {
      setBusy(true);
      setError("");
      setNotice("");
      try {
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, communityId, ...values }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Action failed");
        form?.reset();
        if (action === "inactivity.audit" && typeof result.created === "number") {
          setNotice(`Weekly review complete. ${result.created} item(s) require review.`);
        } else if (action === "discord.sync") {
          const memberText =
            result.isMainGuildMember === null
              ? "main server not configured"
              : result.isMainGuildMember
                ? "main server membership verified"
                : "not found in main server";
          setNotice(`Discord identity checked: ${memberText}.`);
        } else {
          setNotice("Changes saved.");
        }
        await loadWorkspace(communityId);
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Action failed");
      } finally {
        setBusy(false);
      }
    },
    [communityId, loadWorkspace]
  );

  const submit =
    (action: string, transform?: (values: Record<string, FormDataEntryValue>) => Record<string, unknown>) =>
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const values = Object.fromEntries(new FormData(form).entries());
        await runAction(action, transform ? transform(values) : values, form);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Check the form values");
      }
    };

  const visibleNavigation = useMemo(() => {
    if (!data) return navigation.filter((item) => !["ia", "audit", "settings"].includes(item.id));
    return navigation.filter((item) => {
      if (item.id === "ia") return data.capabilities.internalAffairs;
      if (item.id === "audit") return data.capabilities.manager;
      if (item.id === "settings") return data.community.role === "OWNER" || data.capabilities.highCommand;
      return true;
    });
  }, [data]);

  const activeShift = data?.dutyShifts.find((shift) => shift.userId === session?.user?.id && !shift.endTime);
  const departments = data?.departments ?? [];
  const roster = data?.roster ?? [];
  const people = data?.communityPeople ?? [];
  const ownCommunityMembership = people.find((person) => person.user.id === session?.user?.id);

  if (status === "loading" || loading) {
    return (
      <main className="min-h-screen bg-slate-950 pt-24 px-4 flex items-center justify-center">
        <p className="text-sm font-mono text-slate-400">Loading workspace…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-950 pt-24 px-4">
        <div className="mx-auto max-w-3xl rounded-lg border border-red-900 bg-red-950/30 p-6">
          <h1 className="font-heading text-xl font-bold text-white">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-red-200">{error || "No community workspace is associated with this account."}</p>
          <a className="mt-4 inline-flex text-sm font-semibold text-blue-300 hover:text-blue-200" href="/auth/signup">
            Create a workspace
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 pt-20 pb-16 text-left">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-mono uppercase tracking-widest text-blue-400">
              {data.community.gamePreset.replaceAll("_", " ")} / {data.community.role.replaceAll("_", " ")}
            </p>
            <h1 className="font-heading text-2xl font-bold text-white sm:text-3xl">
              {data.community.name}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Community operations workspace
            </p>
          </div>
          <div className="flex items-center gap-3">
            {data.memberships.length > 1 && (
              <select
                className={`${inputClass} min-w-48`}
                value={communityId}
                onChange={(event) => void loadWorkspace(event.target.value)}
                aria-label="Select community workspace"
              >
                {data.memberships.map((membership) => (
                  <option key={membership.community.id} value={membership.community.id}>
                    {membership.community.name}
                  </option>
                ))}
              </select>
            )}
            <span className="hidden rounded border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400 sm:inline-flex">
              {session?.user?.name || session?.user?.email}
            </span>
          </div>
        </header>

        <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-800 pb-2" aria-label="Workspace modules">
          {visibleNavigation.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`min-h-[40px] whitespace-nowrap rounded px-3 text-sm transition-colors ${
                activePage === item.id
                  ? "bg-blue-600/15 text-blue-300 border border-blue-500/30"
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {(error || notice) && (
          <div className={`mb-5 flex items-center justify-between rounded border px-4 py-3 text-sm ${
            error
              ? "border-red-900 bg-red-950/40 text-red-200"
              : "border-emerald-900 bg-emerald-950/30 text-emerald-200"
          }`}>
            <span>{error || notice}</span>
            <button type="button" onClick={() => { setError(""); setNotice(""); }} className="ml-4 text-slate-400 hover:text-white" aria-label="Dismiss message">×</button>
          </div>
        )}

        {activePage === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Personnel", data.analytics.members],
                ["Departments", data.analytics.departments],
                ["Open applications", data.analytics.pendingApplications],
                ["Duty hours this week", data.analytics.collectiveHours],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-slate-800 bg-slate-900 p-5">
                  <p className="text-sm text-slate-400">{label}</p>
                  <p className="mt-2 font-heading text-3xl font-bold text-white">{String(value)}</p>
                </div>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Department readiness">
                {departments.length ? (
                  <div className="space-y-3">
                    {departments.map((department) => (
                      <div key={department.id} className="flex items-center justify-between gap-4 rounded border border-slate-800 bg-slate-950/50 px-4 py-3">
                        <div>
                          <p className="font-semibold text-slate-100">{department.name}</p>
                          <p className="text-xs font-mono text-slate-500">{department.code} · {department.weeklyQuotaHours} weekly hours</p>
                        </div>
                        <span className="text-sm text-slate-300">{roster.filter((member) => member.department.id === department.id).length} rostered</span>
                      </div>
                    ))}
                  </div>
                ) : <Empty>No departments are configured yet.</Empty>}
              </Card>
              <Card title="Current operations">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Units on duty", data.analytics.activeShifts],
                    ["Leave awaiting review", data.analytics.pendingLeave],
                    ["Subdivisions", data.analytics.subdivisions],
                    ["Training completions", data.analytics.trainingRecords],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded border border-slate-800 bg-slate-950/50 p-4">
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="mt-1 font-heading text-2xl font-bold text-white">{String(value)}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  Duty tracking and management actions are recorded by this workspace. Discord voice tracking and bot functions are not connected.
                </p>
              </Card>
            </div>
            <Card title="Your notifications">
              {data.notifications.length ? (
                <div className="space-y-2">
                  {data.notifications.slice(0, 5).map((notification) => (
                    <div key={notification.id} className={`rounded border px-3 py-2 ${notification.readAt ? "border-slate-800 bg-slate-950/40" : "border-blue-900 bg-blue-950/20"}`}>
                      <p className="text-sm font-semibold text-slate-200">{notification.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{notification.message}</p>
                      <p className="mt-1 text-[11px] text-slate-600">{new Date(notification.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              ) : <Empty>No notifications.</Empty>}
            </Card>
            <Card title="Discord membership">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-200">
                    Main server: {!ownCommunityMembership || ownCommunityMembership.discordMainMember === null
                      ? "not checked"
                      : ownCommunityMembership.discordMainMember
                        ? "verified"
                        : "not verified"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {data.community.mainDiscordGuildId
                      ? "Sync checks your own Discord membership and configured role mappings."
                      : "A workspace owner must configure the main Discord server first."}
                  </p>
                </div>
                <button className={buttonClass} disabled={busy || !data.community.mainDiscordGuildId} onClick={() => void runAction("discord.sync")}>Sync my Discord identity</button>
              </div>
            </Card>
            <Card title="Recent duty shifts">
              {data.dutyShifts.length ? (
                <Table headers={["Member", "Department", "Callsign", "Started", "Duration"]}>
                  {data.dutyShifts.slice(0, 8).map((shift) => (
                    <tr key={shift.id}>
                      <Cell>{shift.user.name || "Unnamed member"}</Cell>
                      <Cell>{shift.department?.name || "—"}</Cell>
                      <Cell>{shift.callsign}</Cell>
                      <Cell>{new Date(shift.startTime).toLocaleString()}</Cell>
                      <Cell>{shift.durationMinutes == null ? `${((clock - new Date(shift.startTime).getTime()) / 3600000).toFixed(1)} h · active` : `${(shift.durationMinutes / 60).toFixed(1)} h`}</Cell>
                    </tr>
                  ))}
                </Table>
              ) : <Empty>No duty has been recorded yet.</Empty>}
            </Card>
          </div>
        )}

        {activePage === "roster" && (
          <div className="space-y-6">
            {data.capabilities.highCommand && (
              <Card title="Add a roster member">
                <form onSubmit={submit("member.add")} className="grid gap-4 md:grid-cols-4">
                  <Field label="Member email" name="email" type="email" required placeholder="member@example.com" />
                  <Field label="Department" name="departmentId" required>
                    <select className={inputClass} name="departmentId" required defaultValue="">
                      <option value="" disabled>Select department</option>
                      {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Initial rank" name="rank" defaultValue="Member" />
                  <div className="flex items-end"><button className={buttonClass} disabled={busy}>Add member</button></div>
                  <Field label="Badge number" name="badgeNumber" required={false} />
                  <Field label="Callsign" name="callsign" required={false} />
                </form>
              </Card>
            )}
            <Card title={`Personnel roster · ${roster.length}`}>
              {roster.length ? (
                <Table headers={["Member", "Department", "Rank", "Badge / Callsign", "Status", ...(data.capabilities.highCommand ? ["Actions"] : [])]}>
                  {roster.map((member) => (
                    <tr key={member.id}>
                      <Cell>
                        <span className="font-medium text-white">{member.user.name || "Unnamed member"}</span>
                        <span className="block text-xs text-slate-500">{member.user.email}</span>
                      </Cell>
                      <Cell>{member.department.name}</Cell>
                      <Cell>{member.rank}</Cell>
                      <Cell>{member.badgeNumber || "—"} / {member.callsign || "—"}</Cell>
                      <Cell><span className={`rounded border px-2 py-1 text-xs ${member.status === "ACTIVE" ? "border-emerald-800 bg-emerald-950/40 text-emerald-300" : "border-amber-800 bg-amber-950/30 text-amber-300"}`}>{member.status}</span></Cell>
                      {data.capabilities.highCommand && (
                        <Cell>
                          <details>
                            <summary className="cursor-pointer text-blue-300 hover:text-blue-200">Manage</summary>
                            <form onSubmit={submit("member.update")} className="mt-3 min-w-56 space-y-2">
                              <input type="hidden" name="memberId" value={member.id} />
                              <input className={inputClass} name="rank" aria-label="Rank" defaultValue={member.rank} required />
                              <select className={inputClass} name="status" defaultValue={member.status} aria-label="Status">
                                {["ACTIVE", "LOA", "PROBATIONARY", "SUSPENDED"].map((statusOption) => <option key={statusOption}>{statusOption}</option>)}
                              </select>
                              <input className={inputClass} name="badgeNumber" aria-label="Badge" defaultValue={member.badgeNumber || ""} />
                              <input className={inputClass} name="callsign" aria-label="Callsign" defaultValue={member.callsign || ""} />
                              <label className="flex items-center gap-2 text-xs text-slate-300">
                                <input type="checkbox" name="inactivityExempt" defaultChecked={Boolean(member.inactivityExempt)} className="accent-blue-500" />
                                Exempt from inactivity checks
                              </label>
                              <input className={inputClass} name="exemptionReason" aria-label="Exemption reason" placeholder="Exemption reason" defaultValue={String(member.exemptionReason || "")} />
                              <button className={buttonClass} disabled={busy}>Save member</button>
                            </form>
                            <form onSubmit={submit("member.transfer")} className="mt-2 flex gap-2">
                              <input type="hidden" name="memberId" value={member.id} />
                              <select className={inputClass} name="departmentId" defaultValue="" aria-label="Transfer to department" required>
                                <option value="" disabled>Transfer to…</option>
                                {departments.filter((department) => department.id !== member.department.id).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                              </select>
                              <button className="rounded border border-slate-700 px-3 text-xs text-slate-200 hover:bg-slate-800" disabled={busy}>Transfer</button>
                            </form>
                          </details>
                        </Cell>
                      )}
                    </tr>
                  ))}
                </Table>
              ) : <Empty>Add members to departments to start building rosters.</Empty>}
            </Card>
          </div>
        )}

        {activePage === "departments" && (
          <div className="space-y-6">
            {data.capabilities.highCommand && (
              <Card title="Configure a department">
                <form onSubmit={submit("department.create", (values) => ({
                  ...values,
                  weeklyQuotaHours: values.weeklyQuotaHours,
                  ranks: commaSeparatedList(values.ranks),
                }))} className="grid gap-4 md:grid-cols-5">
                  <Field label="Department name" name="name" required />
                  <Field label="Short code" name="code" required placeholder="POLICE" />
                  <Field label="Weekly duty target (hours)" name="weeklyQuotaHours" type="number" defaultValue={4} min={0} max={168} />
                  <Field label="Ranks · lowest to highest" name="ranks" defaultValue="Member, Supervisor, High Command" required />
                  <div className="flex items-end"><button className={buttonClass} disabled={busy}>Create department</button></div>
                </form>
                <p className="mt-3 text-xs leading-5 text-slate-400">Enter ranks separated by commas in the order members progress. For example: Recruit, Officer, Sergeant, Chief.</p>
              </Card>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              {departments.map((department) => (
                <Card key={department.id} title={`${department.name} · ${department.code}`}>
                  <div className="mb-4 grid grid-cols-3 gap-3 text-center">
                    {[
                      ["Members", roster.filter((member) => member.department.id === department.id).length],
                      ["Subdivisions", department._count.subdivisions],
                      ["SOPs", department._count.sops],
                    ].map(([label, value]) => <div key={label} className="rounded bg-slate-950 p-3"><strong className="block text-xl text-white">{value}</strong><span className="text-xs text-slate-500">{label}</span></div>)}
                  </div>
                  {data.capabilities.highCommand && (
                    <details>
                      <summary className="cursor-pointer text-sm text-blue-300">Department settings</summary>
                      <form onSubmit={submit("department.update", (values) => ({
                        ...values,
                        ranks: commaSeparatedList(values.ranks),
                      }))} className="mt-3 grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="departmentId" value={department.id} />
                        <Field label="Name" name="name" defaultValue={department.name} required />
                        <Field label="Weekly duty target (hours)" name="weeklyQuotaHours" type="number" min={0} max={168} defaultValue={department.weeklyQuotaHours} />
                        <Field label="Ranks · lowest to highest" name="ranks" defaultValue={readList(department.rankStructureJson, ["Member", "Supervisor", "High Command"]).join(", ")} required />
                        <p className="text-xs leading-5 text-slate-400 sm:col-span-2">Separate rank names with commas. Members move through the list from left to right.</p>
                        <details className="sm:col-span-2">
                          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">Advanced Discord role mapping</summary>
                          <div className="mt-2 grid gap-3 rounded border border-slate-800 bg-slate-950/60 p-3 sm:grid-cols-2">
                            <Field label="Discord server ID" name="discordGuildId" defaultValue={department.discordGuildId || ""} required={false} />
                            <Field label="Discord role ID" name="discordRoleId" defaultValue={department.discordRoleId || ""} required={false} />
                            <Field label="Role IDs mapped to rank names (JSON)" name="discordRoleMappings" required><textarea className={`${inputClass} min-h-20 font-mono normal-case tracking-normal`} name="discordRoleMappings" defaultValue={department.discordRoleMappingsJson} rows={3} aria-describedby={`role-mapping-help-${department.id}`} /></Field>
                            <p id={`role-mapping-help-${department.id}`} className="self-center text-xs leading-5 text-slate-400">Optional. Map each Discord role ID to the rank name used above. Example: {`{"ROLE_ID":"Officer"}`}.</p>
                          </div>
                        </details>
                        <div className="flex items-end"><button className={buttonClass} disabled={busy}>Save department</button></div>
                      </form>
                    </details>
                  )}
                  {department.subdivisions.length > 0 && (
                    <p className="mt-4 text-xs text-slate-400">Subdivisions: {department.subdivisions.map((subdivision) => subdivision.name).join(", ")}</p>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {activePage === "subdivisions" && (
          <div className="space-y-6">
            {data.capabilities.highCommand && (
              <Card title="Create a subdivision">
                <form onSubmit={submit("subdivision.create")} className="grid gap-4 md:grid-cols-4">
                  <Field label="Department" name="departmentId" required><select className={inputClass} name="departmentId" required defaultValue=""><option value="" disabled>Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>
                  <Field label="Subdivision name" name="name" required />
                  <Field label="Code" name="code" required />
                  <Field label="Callsign prefix" name="callsignPrefix" required={false} placeholder="e.g. SWAT" />
                  <Field label="Callsign pattern" name="callsignPattern" required={false} placeholder="e.g. PREFIX-##" />
                  <div className="flex items-end gap-3"><Field label="Roster capacity" name="maxUnits" type="number" defaultValue={10} min={1} max={1000} /><button className={buttonClass} disabled={busy}>Create</button></div>
                </form>
              </Card>
            )}
            {departments.flatMap((department) => department.subdivisions.map((subdivision) => ({ ...subdivision, department }))).length ? (
              <Card title="Subdivision directory">
                <Table headers={["Subdivision", "Department", "Code", "Members", "Leadership / roster"]}>
                  {departments.flatMap((department) => department.subdivisions.map((subdivision) => (
                    <tr key={subdivision.id}>
                      <Cell>{subdivision.name}</Cell>
                      <Cell>{department.name}</Cell>
                      <Cell>{subdivision.code}</Cell>
                      <Cell>{subdivision.members?.length ?? 0}</Cell>
                      <Cell>
                        <div className="space-y-2">
                          {subdivision.members?.map((member) => (
                            <div key={member.id} className="flex items-center justify-between gap-2 text-xs">
                              <span>{member.user.name || "Unnamed"} · {member.role}</span>
                              {data.capabilities.highCommand && <button className="text-red-300 hover:text-red-200" disabled={busy} onClick={() => void runAction("subdivision.member.remove", { subdivisionId: subdivision.id, userId: member.userId })}>Remove</button>}
                            </div>
                          ))}
                          {data.capabilities.highCommand && (
                            <form onSubmit={submit("subdivision.member.add")} className="mt-2 flex gap-2">
                              <input type="hidden" name="subdivisionId" value={subdivision.id} />
                              <select className={inputClass} name="userId" defaultValue="" required>
                                <option value="" disabled>Add department member</option>
                                {roster.filter((member) => member.department.id === department.id && !subdivision.members?.some((existing) => existing.userId === member.userId)).map((member) => <option key={member.userId} value={member.userId}>{member.user.name || member.user.email}</option>)}
                              </select>
                              <select className={inputClass} name="role" defaultValue="OPERATOR"><option>OPERATOR</option><option>SUPERVISOR</option><option>LEAD</option></select>
                              <button className="rounded border border-blue-800 px-2 text-xs text-blue-300" disabled={busy}>Add</button>
                            </form>
                          )}
                        </div>
                      </Cell>
                    </tr>
                  )))}
                </Table>
              </Card>
            ) : <Empty>No subdivisions are configured.</Empty>}
          </div>
        )}

        {activePage === "duty" && (
          <div className="space-y-6">
            <Card title="Website duty clock">
              {activeShift ? (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-emerald-300">Clocked in · {activeShift.callsign}</p>
                    <p className="text-sm text-slate-400">{activeShift.department?.name} · since {new Date(activeShift.startTime).toLocaleString()}</p>
                  </div>
                  <button className="min-h-[44px] rounded bg-red-950 px-5 text-sm font-semibold text-red-200 border border-red-800 hover:bg-red-900" disabled={busy} onClick={() => void runAction("duty.clockOut")}>Clock out</button>
                </div>
              ) : (
                <form onSubmit={submit("duty.clockIn")} className="grid gap-4 md:grid-cols-4">
                  <Field label="Department" name="departmentId" required><select className={inputClass} name="departmentId" required defaultValue=""><option value="" disabled>Select your department</option>{departments.filter((department) => roster.some((member) => member.department.id === department.id && member.userId === session?.user?.id && ["ACTIVE", "PROBATIONARY"].includes(member.status))).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>
                  <Field label="Callsign" name="callsign" placeholder="Use your roster callsign" required={false} />
                  <Field label="Subdivision (optional)" name="subdivisionId" required={false}><select className={inputClass} name="subdivisionId" defaultValue=""><option value="">No subdivision</option>{departments.flatMap((department) => department.subdivisions.map((subdivision) => <option key={subdivision.id} value={subdivision.id}>{department.name} / {subdivision.name}</option>))}</select></Field>
                  <div className="flex items-end"><button className={buttonClass} disabled={busy}>Clock in</button></div>
                </form>
              )}
              <p className="mt-4 text-xs text-slate-500">Web clock records are stored in the workspace; Discord voice tracking is not enabled.</p>
            </Card>
            {data.capabilities.highCommand && (
              <Card title="Authorized hour adjustment">
                <form onSubmit={submit("duty.adjust")} className="grid gap-4 md:grid-cols-3">
                  <Field label="Member" name="userId" required><select className={inputClass} name="userId" required defaultValue=""><option value="" disabled>Select roster member</option>{people.map((person) => <option key={person.user.id} value={person.user.id}>{person.user.name || person.user.email}</option>)}</select></Field>
                  <Field label="Department" name="departmentId" required><select className={inputClass} name="departmentId" required defaultValue=""><option value="" disabled>Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>
                  <Field label="Callsign" name="callsign" required={false} />
                  <Field label="Start time" name="startTime" type="datetime-local" required />
                  <Field label="End time" name="endTime" type="datetime-local" required />
                  <div className="flex items-end"><button className={buttonClass} disabled={busy}>Add adjustment</button></div>
                </form>
              </Card>
            )}
            <Card title="Duty history">
              {data.dutyShifts.length ? (
                <Table headers={["Personnel", "Department / subdivision", "Callsign", "Start", "End", "Hours"]}>
                  {data.dutyShifts.map((shift) => <tr key={shift.id}><Cell>{shift.user.name || "Unnamed"}</Cell><Cell>{shift.department?.name || "—"}{shift.subdivision ? ` / ${shift.subdivision.name}` : ""}</Cell><Cell>{shift.callsign}</Cell><Cell>{new Date(shift.startTime).toLocaleString()}</Cell><Cell>{shift.endTime ? new Date(shift.endTime).toLocaleString() : "Active"}</Cell><Cell>{shift.durationMinutes == null ? "—" : (shift.durationMinutes / 60).toFixed(2)}</Cell></tr>)}
                </Table>
              ) : <Empty>No shifts recorded.</Empty>}
            </Card>
          </div>
        )}

        {activePage === "leave" && (
          <div className="space-y-6">
            <Card title="Request a leave of absence">
              <form onSubmit={submit("loa.create")} className="grid gap-4 md:grid-cols-4">
                <Field label="Department" name="departmentId" required><select className={inputClass} name="departmentId" required defaultValue=""><option value="" disabled>Select department</option>{departments.filter((department) => roster.some((member) => member.department.id === department.id && member.userId === session?.user?.id)).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>
                <Field label="Start date" name="startDate" type="date" required />
                <Field label="End date" name="endDate" type="date" required />
                <Field label="Reason" name="reason" required><textarea className={`${inputClass} min-h-11`} name="reason" required maxLength={2000} rows={2} placeholder="Reason for your request" /></Field>
                <div className="md:col-span-4"><button className={buttonClass} disabled={busy}>Submit leave request</button></div>
              </form>
            </Card>
            <Card title="Leave request history">
              {data.leaveRequests.length ? (
                <Table headers={["Member", "Department", "Period", "Reason", "Status", ...(data.capabilities.highCommand ? ["Review"] : [])]}>
                  {data.leaveRequests.map((leave) => <tr key={leave.id}><Cell>{leave.user.name || "Unnamed"}</Cell><Cell>{leave.department?.name || "—"}</Cell><Cell>{new Date(leave.startDate).toLocaleDateString()} – {new Date(leave.endDate).toLocaleDateString()}</Cell><Cell>{leave.reason}</Cell><Cell>{leave.status}</Cell>{data.capabilities.highCommand && <Cell>{leave.status === "PENDING" ? <div className="flex gap-2"><button className="rounded border border-emerald-800 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-950" disabled={busy} onClick={() => void runAction("loa.review", { leaveId: leave.id, decision: "APPROVED" })}>Approve</button><button className="rounded border border-red-800 px-3 py-1 text-xs text-red-300 hover:bg-red-950" disabled={busy} onClick={() => void runAction("loa.review", { leaveId: leave.id, decision: "DENIED" })}>Decline</button></div> : "—"}</Cell>}</tr>)}
                </Table>
              ) : <Empty>No leave requests recorded.</Empty>}
            </Card>
          </div>
        )}

        {activePage === "inactivity" && (
          <div className="space-y-6">
            {data.capabilities.highCommand && (
              <>
                <Card title="Weekly inactivity controls" action={<button className={buttonClass} disabled={busy} onClick={() => void runAction("inactivity.audit")}>Run weekly review</button>}>
                  <form onSubmit={submit("inactivity.policy")} className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                    <Field label="Default weekly hours" name="weeklyQuotaHours" type="number" min={0} max={168} defaultValue={data.policy?.weeklyQuotaHours ?? 4} />
                    <Field label="Warning threshold" name="warningThreshold" type="number" min={1} max={20} defaultValue={data.policy?.warningThreshold ?? 1} />
                    <Field label="Strike threshold" name="strikeThreshold" type="number" min={1} max={20} defaultValue={data.policy?.strikeThreshold ?? 2} />
                    <Field label="Grace days" name="gracePeriodDays" type="number" min={0} max={365} defaultValue={data.policy?.gracePeriodDays ?? 7} />
                    <Field label="Expiry days" name="strikeExpiryDays" type="number" min={1} max={3650} defaultValue={data.policy?.strikeExpiryDays ?? 90} />
                    <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" name="autoApplyWarnings" defaultChecked={data.policy?.autoApplyWarnings ?? false} className="accent-blue-500" /> Auto-apply warning-level actions</label>
                    <div className="flex items-end"><button className={buttonClass} disabled={busy}>Save policy</button></div>
                  </form>
                  <p className="mt-3 text-xs text-slate-500">Department-specific quotas take precedence. Approved leave is prorated against weekly requirements. Review items are drafts until confirmed.</p>
                </Card>
                <Card title="Inactivity and discipline review">
                  {data.strikes.length ? <Table headers={["Member", "Department", "Week", "Logged / required", "Level", "Expiry", "Action"]}>
                    {data.strikes.map((strike) => <tr key={strike.id}><Cell>{strike.officer.name || "Unnamed"}<span className="block text-xs text-slate-500">{strike.officer.callsign}</span></Cell><Cell>{strike.department?.name || "—"}</Cell><Cell>{new Date(String(strike.weekStartDate)).toLocaleDateString()}</Cell><Cell>{strike.hoursLogged} / {strike.hoursRequired} h</Cell><Cell>{strike.strikeLevel}</Cell><Cell>{strike.expiresAt ? new Date(strike.expiresAt).toLocaleDateString() : "—"}</Cell><Cell>{strike.status === "DRAFT" ? <div className="flex gap-2"><button className="rounded border border-amber-800 px-2 py-1 text-xs text-amber-200" disabled={busy} onClick={() => void runAction("inactivity.strike", { strikeId: strike.id, decision: "CONFIRMED" })}>Issue</button><button className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300" disabled={busy} onClick={() => void runAction("inactivity.strike", { strikeId: strike.id, decision: "PARDONED" })}>Pardon</button></div> : strike.status}</Cell></tr>)}
                  </Table> : <Empty>No inactivity review items. Run the weekly review to calculate current quotas.</Empty>}
                </Card>
              </>
            )}
            {!data.capabilities.highCommand && <Card title="Your discipline records">{data.strikes.filter((strike) => strike.officer.id === session?.user?.id).length ? <Table headers={["Week", "Department", "Level", "Status", "Expires"]}>{data.strikes.filter((strike) => strike.officer.id === session?.user?.id).map((strike) => <tr key={strike.id}><Cell>{new Date(String(strike.weekStartDate)).toLocaleDateString()}</Cell><Cell>{strike.department?.name}</Cell><Cell>{strike.strikeLevel}</Cell><Cell>{strike.status}</Cell><Cell>{strike.expiresAt ? new Date(strike.expiresAt).toLocaleDateString() : "—"}</Cell></tr>)}</Table> : <Empty>No discipline records.</Empty>}</Card>}
            {data.capabilities.highCommand && <Card title="Issue a disciplinary record">
              <form onSubmit={submit("discipline.create", (values) => {
                const [departmentId, subjectId] = String(values.memberKey || "").split("|");
                return { ...values, departmentId, subjectId };
              })} className="grid gap-4 md:grid-cols-3">
                <Field label="Department member" name="memberKey" required><select className={inputClass} name="memberKey" required defaultValue=""><option value="" disabled>Select personnel</option>{roster.map((member) => <option key={member.id} value={`${member.department.id}|${member.userId}`}>{member.user.name || member.user.email} · {member.department.name}</option>)}</select></Field>
                <Field label="Action type" name="type" required><select className={inputClass} name="type" defaultValue="WARNING">{["WARNING", "REPRIMAND", "SUSPENSION", "DEMOTION", "OTHER"].map((type) => <option key={type}>{type}</option>)}</select></Field>
                <Field label="Record title" name="title" required />
                <Field label="Expiry date (optional)" name="expiresAt" type="date" required={false} />
                <Field label="Details" name="details" required><textarea className={`${inputClass} min-h-24`} name="details" required rows={3} /></Field>
                <div className="md:col-span-3"><button className={buttonClass} disabled={busy}>Issue record</button></div>
              </form>
            </Card>}
            <Card title="Disciplinary history">
              {data.disciplinaryRecords.length ? <Table headers={["Member", "Department", "Type / title", "Details", "Issued by", "Status / expiry", ...(data.capabilities.highCommand ? ["Action"] : [])]}>
                {data.disciplinaryRecords.map((record) => <tr key={record.id}><Cell>{record.subject.name || "Unnamed"}</Cell><Cell>{record.department.name}</Cell><Cell>{record.type}<span className="block text-xs text-slate-400">{record.title}</span></Cell><Cell>{record.details}</Cell><Cell>{record.issuer.name || "Staff"}</Cell><Cell>{record.status}{record.expiresAt ? <span className="block text-xs text-slate-500">Expires {new Date(record.expiresAt).toLocaleDateString()}</span> : null}</Cell>{data.capabilities.highCommand && <Cell>{record.status === "ACTIVE" ? <button className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800" disabled={busy} onClick={() => void runAction("discipline.pardon", { recordId: record.id })}>Pardon</button> : "—"}</Cell>}</tr>)}
              </Table> : <Empty>No disciplinary records.</Empty>}
            </Card>
          </div>
        )}

        {activePage === "sops" && (
          <div className="space-y-6">
            {data.capabilities.highCommand && <Card title="Publish an SOP">
              <form onSubmit={submit("sop.create")} className="grid gap-4 md:grid-cols-3">
                <Field label="Department" name="departmentId" required><select className={inputClass} name="departmentId" required defaultValue=""><option value="" disabled>Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>
                <Field label="Title" name="title" required />
                <Field label="Category" name="category" required placeholder="Radio procedure" />
                <Field label="Subdivision (optional)" name="subdivisionId" required={false}><select className={inputClass} name="subdivisionId" defaultValue=""><option value="">Department-wide</option>{departments.flatMap((department) => department.subdivisions.map((subdivision) => <option key={subdivision.id} value={subdivision.id}>{department.name} / {subdivision.name}</option>))}</select></Field>
                <Field label="Require acknowledgement" name="requireSignOff" required={false}><select className={inputClass} name="requireSignOff" defaultValue="true"><option value="true">Required</option><option value="false">Optional</option></select></Field>
                <Field label="Content" name="content" required><textarea className={`${inputClass} min-h-32`} name="content" required rows={5} maxLength={20000} /></Field>
                <div className="md:col-span-3"><button className={buttonClass} disabled={busy}>Publish SOP</button></div>
              </form>
            </Card>}
            {data.sops.length ? data.sops.map((sop) => <Card key={sop.id} title={`${sop.title} · v${sop.version}`}>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-400"><span>{sop.department.name}</span><span>·</span><span>{sop.category}</span><span>·</span><span>{sop._count.acknowledgements} acknowledgement(s)</span><span>·</span><span>{sop.subdivision?.name || "Department-wide"}</span></div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">{sop.content}</p>
              {data.capabilities.manager && sop.acknowledgements && (
                <p className="mt-3 text-xs text-slate-500">
                  Current version acknowledgements: {sop.acknowledgements.filter((acknowledgement) => acknowledgement.version === sop.version).map((acknowledgement) => acknowledgement.user.name || "Unnamed member").join(", ") || "None"}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <button className="rounded border border-blue-800 px-3 py-2 text-xs text-blue-300 hover:bg-blue-950/40" disabled={busy} onClick={() => void runAction("sop.acknowledge", { sopId: sop.id })}>Acknowledge current version</button>
                {data.capabilities.highCommand && <details className="basis-full">
                  <summary className="cursor-pointer text-xs text-slate-400">Update SOP / version history</summary>
                  <form onSubmit={submit("sop.update")} className="mt-3 grid gap-3 md:grid-cols-2">
                    <input type="hidden" name="sopId" value={sop.id} />
                    <Field label="New content" name="content" required><textarea className={`${inputClass} min-h-28`} name="content" defaultValue={sop.content} required rows={4} /></Field>
                    <div className="space-y-3"><Field label="Change notes" name="changeNotes" required={false} /><button className={buttonClass} disabled={busy}>Save new version</button><div className="text-xs text-slate-500">History: {sop.versions?.map((version) => `v${version.version}`).join(", ") || "visible to command"}</div></div>
                  </form>
                </details>}
              </div>
            </Card>) : <Empty>No SOPs have been published.</Empty>}
          </div>
        )}

        {activePage === "applications" && (
          <div className="space-y-6">
            {data.capabilities.highCommand && <Card title="Build an application form">
              <form onSubmit={submit("application.form.create", (values) => ({
                ...values,
                questions: JSON.parse(String(values.questions || "[]")),
                autoScore: values.autoScore === "on",
              }))} className="grid gap-4 md:grid-cols-3">
                <Field label="Department" name="departmentId" required><select className={inputClass} name="departmentId" required defaultValue=""><option value="" disabled>Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>
                <Field label="Form title" name="title" required />
                <Field label="Description" name="description" required={false} />
                <Field label="Questions (JSON)" name="questions" required><textarea className={`${inputClass} min-h-32 font-mono`} name="questions" required rows={5} defaultValue={'[{"id":"experience","prompt":"Describe your roleplay experience","type":"written"},{"id":"scenario","prompt":"How would you respond to a difficult scenario?","type":"scenario"}]'} /></Field>
                <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" name="autoScore" className="accent-blue-500" /> Score multiple-choice answers automatically</label>
                <div className="flex items-end"><button className={buttonClass} disabled={busy}>Create form</button></div>
              </form>
            </Card>}
            {data.applicationForms.length > 0 && <Card title="Apply to a department">
              <form onSubmit={async (event) => {
                event.preventDefault();
                const form = event.currentTarget;
                const values = Object.fromEntries(new FormData(form).entries());
                const answers = Object.fromEntries(Object.entries(values).filter(([key]) => key.startsWith("answer_")));
                await runAction("application.submit", { formId: values.formId, answers }, form);
              }} className="space-y-4">
                <select className={inputClass} name="formId" value={applicationFormId} onChange={(event) => setApplicationFormId(event.target.value)} required>
                  <option value="">Select an application form</option>
                  {data.applicationForms.map((form) => <option key={form.id} value={form.id}>{form.title}</option>)}
                </select>
                {data.applicationForms.find((form) => form.id === applicationFormId)?.description && <p className="text-sm text-slate-400">{data.applicationForms.find((form) => form.id === applicationFormId)?.description}</p>}
                {readList(data.applicationForms.find((form) => form.id === applicationFormId)?.questionsJson || "[]", []).map((question: unknown, index: number) => {
                  if (!question || typeof question !== "object") return null;
                  const q = question as { id?: string; prompt?: string; type?: string; options?: string[] };
                  const key = q.id || String(index);
                  return <Field key={key} label={q.prompt || `Question ${index + 1}`} name={`answer_${key}`} required>
                    {Array.isArray(q.options) && q.options.length ? <select className={inputClass} name={`answer_${key}`} required><option value="">Select an answer</option>{q.options.map((option) => <option key={option}>{option}</option>)}</select> : <textarea className={`${inputClass} min-h-20`} name={`answer_${key}`} required rows={3} />}
                  </Field>;
                })}
                <button className={buttonClass} disabled={busy || !applicationFormId}>Submit application</button>
              </form>
            </Card>}
            {data.capabilities.highCommand && <Card title="Application review queue">
              {data.applications.length ? <Table headers={["Applicant", "Department", "Score", "Status", "Answers", "Decision"]}>
                {data.applications.map((application) => <tr key={application.id}><Cell>{application.applicantName}</Cell><Cell>{application.department.name}</Cell><Cell>{application.score == null ? "—" : `${application.score}%`}</Cell><Cell>{application.status}</Cell><Cell><details><summary className="cursor-pointer text-blue-300">Read application</summary><pre className="mt-2 max-w-lg whitespace-pre-wrap break-words text-xs text-slate-400">{application.answersJson}</pre></details></Cell><Cell><form onSubmit={submit("application.review")} className="flex min-w-52 flex-col gap-2"><input type="hidden" name="applicationId" value={application.id} /><select className={inputClass} name="status" defaultValue={application.status === "SUBMITTED" ? "UNDER_REVIEW" : application.status}>{["UNDER_REVIEW", "INTERVIEW", "ACCEPTED", "DENIED"].map((option) => <option key={option}>{option}</option>)}</select><input className={inputClass} name="notes" placeholder="Reviewer notes" defaultValue={application.reviewerNotes || ""} /><button className="rounded border border-blue-800 px-3 py-2 text-xs text-blue-300" disabled={busy}>Save decision</button></form></Cell></tr>)}
              </Table> : <Empty>No applications submitted.</Empty>}
            </Card>}
            {!data.capabilities.highCommand && <Card title="My application history">
              {data.applications.length ? <Table headers={["Department", "Submitted", "Status", "Score", "Reviewer notes"]}>
                {data.applications.map((application) => <tr key={application.id}><Cell>{application.department.name}</Cell><Cell>{new Date(String(application.createdAt)).toLocaleDateString()}</Cell><Cell>{application.status}</Cell><Cell>{application.score == null ? "—" : `${application.score}%`}</Cell><Cell>{application.reviewerNotes || "—"}</Cell></tr>)}
              </Table> : <Empty>You have not submitted an application.</Empty>}
            </Card>}
          </div>
        )}

        {activePage === "training" && (
          <div className="space-y-6">
            {data.capabilities.highCommand && <>
              <Card title="Training courses and certifications">
                <form onSubmit={submit("training.course.create")} className="grid gap-4 md:grid-cols-4">
                  <Field label="Course name" name="title" required />
                  <Field label="Department (optional)" name="departmentId" required={false}><select className={inputClass} name="departmentId" defaultValue=""><option value="">Community-wide</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>
                  <Field label="Certification" name="certification" required={false} />
                  <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" name="required" className="accent-blue-500" /> Required training</label>
                  <Field label="Description" name="description" required={false} />
                  <div className="flex items-end"><button className={buttonClass} disabled={busy}>Create course</button></div>
                </form>
              </Card>
              {data.courses.length > 0 && <Card title="Record a completion">
                <form onSubmit={submit("training.record")} className="grid gap-4 md:grid-cols-4">
                  <Field label="Course" name="courseId" required><select className={inputClass} name="courseId" required defaultValue=""><option value="" disabled>Select course</option>{data.courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></Field>
                  <Field label="Member" name="userId" required><select className={inputClass} name="userId" required defaultValue=""><option value="" disabled>Select member</option>{people.map((person) => <option key={person.user.id} value={person.user.id}>{person.user.name || person.user.email}</option>)}</select></Field>
                  <Field label="Expiry (optional)" name="expiresAt" type="date" required={false} />
                  <div className="flex items-end"><button className={buttonClass} disabled={busy}>Record certification</button></div>
                  <Field label="Notes" name="notes" required={false} />
                </form>
              </Card>}
            </>}
            <Card title="Courses and member certifications">
              {data.courses.length ? <Table headers={["Course", "Certification", "Department", "Required", "Completions"]}>{data.courses.map((course) => <tr key={course.id}><Cell>{course.title}</Cell><Cell>{course.certification || "—"}</Cell><Cell>{course.department?.name || "Community-wide"}</Cell><Cell>{course.required ? "Yes" : "No"}</Cell><Cell>{course._count.records}</Cell></tr>)}</Table> : <Empty>No training courses configured.</Empty>}
              {data.trainingRecords.length > 0 && <div className="mt-5"><Table headers={["Member", "Course", "Status", "Completed", "Expires"]}>{data.trainingRecords.map((record) => <tr key={record.id}><Cell>{record.user.name || "Unnamed"}</Cell><Cell>{record.course.title} · {record.course.certification || "Training"}</Cell><Cell>{record.status}</Cell><Cell>{new Date(record.completedAt).toLocaleDateString()}</Cell><Cell>{record.expiresAt ? new Date(record.expiresAt).toLocaleDateString() : "Never"}</Cell></tr>)}</Table></div>}
            </Card>
          </div>
        )}

        {activePage === "ia" && data.capabilities.internalAffairs && (
          <div className="space-y-6">
            <div className="rounded border border-red-900/70 bg-red-950/20 px-4 py-3 text-sm text-red-200">Confidential Internal Affairs records. Access is restricted and logged.</div>
            {data.capabilities.iaCommand && <Card title="Open an investigation">
              <form onSubmit={submit("ia.case.create")} className="grid gap-4 md:grid-cols-3">
                <Field label="Case title" name="title" required />
                <Field label="Subject" name="subjectUserId" required={false}><select className={inputClass} name="subjectUserId" defaultValue=""><option value="">Unassigned subject</option>{people.map((person) => <option key={person.user.id} value={person.user.id}>{person.user.name || person.user.email}</option>)}</select></Field>
                <Field label="Assigned investigator" name="investigatorUserId" required={false}><select className={inputClass} name="investigatorUserId" defaultValue={session?.user?.id || ""}><option value="">Assign to me</option>{people.map((person) => <option key={person.user.id} value={person.user.id}>{person.user.name || person.user.email}</option>)}</select></Field>
                <Field label="Allegations" name="allegations" required><textarea className={`${inputClass} min-h-28`} name="allegations" required rows={4} /></Field>
                <div className="flex items-end"><button className={buttonClass} disabled={busy}>Create confidential case</button></div>
              </form>
            </Card>}
            {data.investigations.length ? data.investigations.map((investigation) => <Card key={investigation.id} title={`${investigation.caseNumber} · ${investigation.title}`}>
              <div className="grid gap-3 text-sm sm:grid-cols-3"><p className="text-slate-400">Status: <span className="text-white">{investigation.status}</span></p><p className="text-slate-400">Subject: <span className="text-white">{investigation.subject?.name || "Unassigned"}</span></p><p className="text-slate-400">Investigator: <span className="text-white">{investigation.investigator?.name || "Unassigned"}</span></p></div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{investigation.allegations}</p>
              {data.capabilities.iaCommand && <form onSubmit={submit("ia.case.update")} className="mt-4 grid gap-3 md:grid-cols-4">
                <input type="hidden" name="caseId" value={investigation.id} />
                <select className={inputClass} name="status" defaultValue={investigation.status}>{["OPEN", "IN_PROGRESS", "PENDING_REVIEW", "CLOSED", "UNSUBSTANTIATED"].map((option) => <option key={option}>{option}</option>)}</select>
                <select className={inputClass} name="investigatorUserId" defaultValue={investigation.investigator?.id || ""}><option value="">Unassigned</option>{people.map((person) => <option key={person.user.id} value={person.user.id}>{person.user.name || person.user.email}</option>)}</select>
                <input className={inputClass} name="finding" placeholder="Finding" defaultValue={investigation.finding || ""} />
                <input className={inputClass} name="outcome" placeholder="Outcome" defaultValue={investigation.outcome || ""} />
                <button className={buttonClass} disabled={busy}>Update case</button>
              </form>}
              <div className="mt-5 space-y-2 border-t border-slate-800 pt-4">
                {investigation.entries.map((entry) => <div key={entry.id} className="rounded border border-slate-800 bg-slate-950/60 p-3 text-sm"><p className="mb-1 text-xs font-mono text-blue-300">{entry.type} · {entry.createdBy.name || "Staff"} · {new Date(entry.createdAt).toLocaleString()}</p><p className="whitespace-pre-wrap text-slate-300">{entry.content}</p>{entry.referenceUrl && <a className="mt-1 inline-block break-all text-xs text-blue-300 underline" href={entry.referenceUrl} target="_blank" rel="noreferrer">{entry.referenceUrl}</a>}</div>)}
                <form onSubmit={submit("ia.case.entry")} className="grid gap-3 md:grid-cols-4">
                  <input type="hidden" name="caseId" value={investigation.id} />
                  <select className={inputClass} name="type" defaultValue="NOTE">{["NOTE", "INTERVIEW", "EVIDENCE", "FINDING"].map((option) => <option key={option}>{option}</option>)}</select>
                  <input className={inputClass} name="content" placeholder="Record notes or interview summary" required />
                  <input className={inputClass} name="referenceUrl" placeholder="Evidence reference URL (optional)" />
                  <button className={buttonClass} disabled={busy}>Add record</button>
                </form>
              </div>
            </Card>) : <Empty>No investigations created.</Empty>}
          </div>
        )}

        {activePage === "analytics" && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Community members", data.analytics.members],
                ["Applications pending", data.analytics.pendingApplications],
                ["Collective hours this week", data.analytics.collectiveHours],
                ["Training completions", data.analytics.trainingRecords],
              ].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-2 text-3xl font-bold text-white">{value}</p></div>)}
            </div>
            <Card title="Department activity">
              {departments.length ? <Table headers={["Department", "Members", "Active shifts", "Recorded hours", "Training records", "Applications"]}>
                {departments.map((department) => {
                  const departmentRoster = roster.filter((member) => member.department.id === department.id);
                  const shifts = data.dutyShifts.filter((shift) => shift.department?.id === department.id);
                  const hours = data.weeklyHours.filter((entry) => entry.departmentId === department.id).reduce((sum, entry) => sum + entry.hours, 0);
                  const departmentRecords = data.trainingRecords.filter((record) => data.courses.find((course) => course.id === record.courseId)?.department?.id === department.id);
                  const applications = data.applications.filter((application) => application.department.id === department.id);
                  return <tr key={department.id}><Cell>{department.name}</Cell><Cell>{new Set(departmentRoster.map((member) => member.userId)).size}</Cell><Cell>{shifts.filter((shift) => !shift.endTime).length}</Cell><Cell>{hours.toFixed(1)}</Cell><Cell>{departmentRecords.length}</Cell><Cell>{applications.length}</Cell></tr>;
                })}
              </Table> : <Empty>No department analytics are available.</Empty>}
              <p className="mt-3 text-xs text-slate-500">Reports are based on website records currently stored in this workspace. Discord voice activity is not included.</p>
            </Card>
            <Card title={`Individual weekly activity · week of ${new Date(data.weekStartsAt).toLocaleDateString()}`}>
              {roster.length ? <Table headers={["Member", "Department", "Hours logged", "Quota", "Progress"]}>
                {roster.map((member) => {
                  const hours = data.weeklyHours.find((entry) => entry.userId === member.userId && entry.departmentId === member.department.id)?.hours ?? 0;
                  const quota = member.status === "LOA" ? 0 : departments.find((department) => department.id === member.department.id)?.weeklyQuotaHours ?? 0;
                  const percent = quota === 0 ? 100 : Math.min(100, Math.round((hours / quota) * 100));
                  return <tr key={member.id}><Cell>{member.user.name || "Unnamed member"}</Cell><Cell>{member.department.name}</Cell><Cell>{hours.toFixed(2)} h</Cell><Cell>{quota.toFixed(1)} h{member.inactivityExempt ? " · exempt" : ""}</Cell><Cell><div className="h-2 w-28 rounded bg-slate-800"><div className={`h-2 rounded ${percent >= 100 ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${percent}%` }} /></div><span className="mt-1 inline-block text-xs text-slate-500">{quota === 0 ? "Paused" : `${percent}%`}</span></Cell></tr>;
                })}
              </Table> : <Empty>No rostered members to report.</Empty>}
            </Card>
          </div>
        )}

        {activePage === "audit" && data.capabilities.manager && (
          <Card title="Administrative audit history">
            <p className="mb-4 text-xs text-slate-500">Audit entries are append-only through the workspace interface; there are no edit or delete actions.</p>
            {data.auditLogs.length ? <Table headers={["Time", "Actor", "Action", "Record", "Details"]}>{data.auditLogs.map((entry) => <tr key={entry.id}><Cell>{new Date(entry.createdAt).toLocaleString()}</Cell><Cell>{entry.actorName}</Cell><Cell>{entry.action}</Cell><Cell className="font-mono">{entry.targetId || "—"}</Cell><Cell>{entry.details}</Cell></tr>)}</Table> : <Empty>No administrative actions logged.</Empty>}
          </Card>
        )}

        {activePage === "account" && (
          <Card title="Discord account link">
            {data.discordAccountLinked ? (
              <p className="text-sm text-emerald-300">
                Your RPManager account is linked to your Discord account. Bot commands
                can now show your own workspace status and records.
              </p>
            ) : (
              <>
                <p className="mb-4 text-sm text-slate-400">
                  Run <code className="text-blue-300">/link</code> in a bot-enabled server,
                  then enter its one-time code here. Codes expire after 10 minutes and
                  can link only one RPManager account.
                </p>
                <form
                  onSubmit={submit("discord.link.complete")}
                  className="flex flex-col gap-3 sm:flex-row sm:items-end"
                >
                  <Field
                    label="One-time Discord link code"
                    name="code"
                    required
                    placeholder="Paste the code from /link"
                  />
                  <button className={buttonClass} disabled={busy}>
                    Link Discord account
                  </button>
                </form>
              </>
            )}
          </Card>
        )}

        {activePage === "settings" && (
          <div className="space-y-6">
            {data.community.role === "OWNER" && <Card title="Community and game configuration">
              <form onSubmit={submit("settings.update", (values) => ({
                ...values,
                customTerminology: JSON.parse(String(values.customTerminology || "{}")),
                permissionConfig: JSON.parse(String(values.permissionConfig || "{}")),
              }))} className="grid gap-4 md:grid-cols-2">
                <Field label="Game preset" name="gamePreset" required><select className={inputClass} name="gamePreset" defaultValue={data.community.gamePreset}>{["MODERN_POLICE", "UK_POLICE", "US_POLICE", "FIRE_EMS", "MILITARY", "REDM_WILD_WEST", "SCP", "ROBLOX", "CUSTOM"].map((preset) => <option key={preset} value={preset}>{preset.replaceAll("_", " ")}</option>)}</select></Field>
                <Field label="Main Discord server ID" name="mainDiscordGuildId" required={false} defaultValue={data.community.mainDiscordGuildId || ""} />
                <Field label="Custom terminology (JSON object)" name="customTerminology" required><textarea className={`${inputClass} min-h-24 font-mono`} name="customTerminology" defaultValue={data.community.customTerminologyJson} rows={4} /></Field>
                <Field label="Role permissions (JSON object)" name="permissionConfig" required><textarea className={`${inputClass} min-h-24 font-mono`} name="permissionConfig" defaultValue={data.community.permissionConfigJson} rows={4} /></Field>
                <p className="text-xs text-slate-500 md:col-span-2">Permission format: {`{"permissions":{"operations":["OWNER","HIGH_COMMAND","SUPERVISOR"],"administrative":["OWNER","HIGH_COMMAND"],"highCommand":["OWNER","HIGH_COMMAND"]}}`}. The owner always retains access; Internal Affairs remains restricted to owner, High Command, and investigators.</p>
                <p className="text-xs text-slate-500 md:col-span-2">Discord role-to-community-role format: {`{"discordRoleMapping":{"DISCORD_ROLE_ID":"SUPERVISOR"}}`}. Only the owner can change these mappings.</p>
                <div><button className={buttonClass} disabled={busy}>Save workspace</button></div>
              </form>
            </Card>}
            {data.capabilities.highCommand && <Card title="Connected Discord servers">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-400">
                  Your Discord membership: {!ownCommunityMembership || ownCommunityMembership.discordMainMember === null
                    ? "not checked"
                    : ownCommunityMembership.discordMainMember
                      ? "verified in the main server"
                      : "not verified"}
                  {ownCommunityMembership?.discordSyncedAt
                    ? ` · checked ${new Date(String(ownCommunityMembership.discordSyncedAt)).toLocaleString()}`
                    : ""}
                </p>
                <button className={buttonClass} disabled={busy} onClick={() => void runAction("discord.sync")}>Sync my Discord identity</button>
              </div>
              <form onSubmit={submit("server.connect")} className="grid gap-4 md:grid-cols-4">
                <Field label="Server name" name="name" required />
                <Field label="Discord server ID" name="guildId" required />
                <Field label="Type" name="kind" required><select className={inputClass} name="kind" defaultValue="DEPARTMENT"><option value="MAIN">Main community</option><option value="DEPARTMENT">Department server</option></select></Field>
                <Field label="Department" name="departmentId" required={false}><select className={inputClass} name="departmentId" defaultValue=""><option value="">Main server</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></Field>
                <Field label="Optional subdivision" name="subdivisionId" required={false}><select className={inputClass} name="subdivisionId" defaultValue=""><option value="">Entire department</option>{departments.flatMap((department) => department.subdivisions.map((subdivision) => <option key={subdivision.id} value={subdivision.id}>{department.name} · {subdivision.name}</option>))}</select></Field>
                <div><button className={buttonClass} disabled={busy}>Save server link</button></div>
              </form>
              <p className="mt-3 text-xs text-slate-500">Bot-only capabilities stay disabled until the owner enables a connected guild. Voice duty and automatic Discord role changes are not implemented.</p>
              {data.connectedServers.length > 0 && (
                <div className="mt-5 space-y-4">
                  {data.connectedServers.map((server) => {
                    const lastSeen = server.lastBotSeenAt ? new Date(server.lastBotSeenAt) : null;
                    const online = Boolean(lastSeen && clock - lastSeen.getTime() < 120_000);
                    return (
                      <div key={server.id} className="rounded border border-slate-800 bg-slate-950/60 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-white">{server.name}</p>
                            <p className="text-xs text-slate-500">
                              {server.guildId} · {server.kind} · {departments.find((department) => department.id === server.departmentId)?.name || "Community"}
                              {server.subdivisionId ? ` · ${departments.flatMap((department) => department.subdivisions).find((subdivision) => subdivision.id === server.subdivisionId)?.name || "Subdivision"}` : ""}
                            </p>
                          </div>
                          <p className={`text-xs ${!server.botEnabled ? "text-amber-300" : online ? "text-emerald-300" : "text-slate-500"}`}>
                            {!server.botEnabled
                              ? "Bot disabled for this server"
                              : online
                                ? "Bot online"
                                : lastSeen
                                  ? `Last seen ${lastSeen.toLocaleString()}`
                                  : "Bot has not connected"}
                          </p>
                        </div>
                        {data.community.role === "OWNER" && (
                          <form
                            onSubmit={submit("server.bot-config.update", (values) => ({
                              ...values,
                              supervisorRoleIds: String(values.supervisorRoleIds || "")
                                .split(",")
                                .map((roleId) => roleId.trim())
                                .filter(Boolean),
                              notifyLeave: values.notifyLeave === "on",
                              notifyApplications: values.notifyApplications === "on",
                              notifyInactivity: values.notifyInactivity === "on",
                              botEnabled: values.botEnabled === "on",
                            }))}
                            className="grid gap-3 md:grid-cols-2"
                          >
                            <input type="hidden" name="guildId" value={server.guildId} />
                            <Field
                              label="Notification channel ID"
                              name="notificationChannelId"
                              required={false}
                              defaultValue={server.notificationChannelId || ""}
                            />
                            <Field
                              label="Supervisor role IDs (comma-separated)"
                              name="supervisorRoleIds"
                              required={false}
                              defaultValue={readList(server.supervisorRoleIdsJson, []).join(", ")}
                            />
                            <div className="flex flex-wrap gap-4 text-xs text-slate-300 md:col-span-2">
                              <label className="flex items-center gap-2"><input type="checkbox" name="notifyLeave" defaultChecked={server.notifyLeave} /> Leave notifications</label>
                              <label className="flex items-center gap-2"><input type="checkbox" name="notifyApplications" defaultChecked={server.notifyApplications} /> Application notifications</label>
                              <label className="flex items-center gap-2"><input type="checkbox" name="notifyInactivity" defaultChecked={server.notifyInactivity} /> Inactivity review notifications</label>
                              <label className="flex items-center gap-2"><input type="checkbox" name="botEnabled" defaultChecked={server.botEnabled} /> Enable bot for this guild</label>
                            </div>
                            <p className="text-xs text-slate-500 md:col-span-2">
                              Supervisor actions require both RPManager management access and a matching configured Discord role ID. Notifications omit leave reasons, application answers, and personnel case details.
                            </p>
                            <div><button className={buttonClass} disabled={busy}>Save bot configuration</button></div>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>}
            {data.capabilities.highCommand && <Card title="Workspace access roles">
              {data.communityPeople.length ? <Table headers={["Member", "Current role", ...(data.community.role === "OWNER" ? ["Change role"] : [])]}>                            {data.communityPeople.map((person) => <tr key={person.user.id}><Cell>{person.user.name || person.user.email}</Cell><Cell>{String(person.role)}</Cell>{data.community.role === "OWNER" && <Cell>{person.user.id === session?.user?.id ? "Workspace owner" : <form onSubmit={submit("member.role")} className="flex gap-2"><input type="hidden" name="userId" value={person.user.id} /><select className={inputClass} name="role" defaultValue={String(person.role)}>{["MEMBER", "SUPERVISOR", "HIGH_COMMAND", "INVESTIGATOR"].map((role) => <option key={role}>{role}</option>)}</select><button className="rounded border border-blue-800 px-3 text-xs text-blue-300" disabled={busy}>Save</button></form>}</Cell>}</tr>)}</Table> : <Empty>No community members yet.</Empty>}
            </Card>}
          </div>
        )}
      </div>
    </main>
  );
}
