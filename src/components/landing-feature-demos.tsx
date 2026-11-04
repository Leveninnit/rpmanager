"use client";

import { useRef, useState } from "react";

const demoDepartments = {
  Police: {
    code: "POLICE",
    members: 28,
    subdivisions: ["Patrol", "Traffic", "Air Support"],
    sopCount: 12,
    training: "86%",
    color: "blue",
    roster: [
      { member: "Member 014", rank: "Sergeant", callsign: "2A-14", status: "Active" },
      { member: "Member 022", rank: "Officer", callsign: "2B-22", status: "Active" },
      { member: "Member 031", rank: "Officer", callsign: "3A-31", status: "LOA" },
    ],
  },
  "Fire & EMS": {
    code: "FIRE-EMS",
    members: 14,
    subdivisions: ["Fire Rescue", "Medical", "Training"],
    sopCount: 8,
    training: "92%",
    color: "emerald",
    roster: [
      { member: "Member 027", rank: "Paramedic", callsign: "MED-07", status: "Active" },
      { member: "Member 035", rank: "Firefighter", callsign: "ENG-05", status: "Active" },
      { member: "Member 041", rank: "Recruit", callsign: "MED-11", status: "Probationary" },
    ],
  },
  Staff: {
    code: "STAFF",
    members: 6,
    subdivisions: ["Moderation", "Community Support"],
    sopCount: 5,
    training: "78%",
    color: "violet",
    roster: [
      { member: "Member 003", rank: "Supervisor", callsign: "ADMIN-03", status: "Active" },
      { member: "Member 009", rank: "Moderator", callsign: "MOD-09", status: "Active" },
      { member: "Member 018", rank: "Trainee", callsign: "MOD-18", status: "Probationary" },
    ],
  },
  Custom: {
    code: "CUSTOM",
    members: 9,
    subdivisions: ["Operations", "Logistics"],
    sopCount: 4,
    training: "81%",
    color: "cyan",
    roster: [
      { member: "Member 051", rank: "Lead", callsign: "OPS-51", status: "Active" },
      { member: "Member 058", rank: "Specialist", callsign: "LOG-58", status: "Active" },
      { member: "Member 062", rank: "Member", callsign: "OPS-62", status: "Active" },
    ],
  },
} as const;

type DepartmentName = keyof typeof demoDepartments;
type RankLabel = "Rank" | "Grade" | "Role";
type CallsignStyle = "Unit first" | "Number first";

const colorStyles = {
  blue: { border: "border-blue-900/70", accent: "text-blue-300", bar: "bg-blue-500" },
  emerald: { border: "border-emerald-900/70", accent: "text-emerald-300", bar: "bg-emerald-500" },
  violet: { border: "border-violet-900/70", accent: "text-violet-300", bar: "bg-violet-500" },
  cyan: { border: "border-cyan-900/70", accent: "text-cyan-300", bar: "bg-cyan-500" },
} as const;

const controlClass =
  "min-h-11 rounded border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400";
const departments = Object.keys(demoDepartments) as DepartmentName[];

type LeaveRequest = {
  id: number;
  member: string;
  department: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: "Pending" | "Approved" | "Declined";
};

function formatDemoDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function LandingLeaveDemo() {
  const nextRequestId = useRef(3);
  const [requests, setRequests] = useState<LeaveRequest[]>([
    {
      id: 1,
      member: "Member 031",
      department: "Police",
      startDate: "2026-11-10",
      endDate: "2026-11-16",
      reason: "Away for school exams",
      status: "Pending",
    },
    {
      id: 2,
      member: "Member 041",
      department: "Fire & EMS",
      startDate: "2026-11-02",
      endDate: "2026-11-08",
      reason: "Personal leave",
      status: "Approved",
    },
  ]);
  const [notice, setNotice] = useState("");

  function submitLeave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const id = nextRequestId.current;
    nextRequestId.current += 1;
    setRequests((current) => [
      {
        id,
        member: "You · Sample member",
        department: String(formData.get("department")),
        startDate: String(formData.get("startDate")),
        endDate: String(formData.get("endDate")),
        reason: String(formData.get("reason")).trim(),
        status: "Pending",
      },
      ...current,
    ]);
    setNotice("Sample request submitted. Try approving or declining it below.");
    event.currentTarget.reset();
  }

  function decideRequest(id: number, status: "Approved" | "Declined") {
    setRequests((current) =>
      current.map((request) => (request.id === id ? { ...request, status } : request))
    );
    setNotice(`Sample leave request ${status.toLowerCase()}.`);
  }

  const pendingCount = requests.filter((request) => request.status === "Pending").length;
  const approvedCount = requests.filter((request) => request.status === "Approved").length;

  return (
    <section
      aria-labelledby="leave-preview-title"
      className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/20"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-5 py-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-blue-300">
            Interactive example
          </p>
          <h3 id="leave-preview-title" className="mt-1 text-base font-bold text-white">
            Leave request workflow
          </h3>
        </div>
        <span className="rounded-full border border-amber-800/80 bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-200">
          Sample data · preview only
        </span>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <form onSubmit={submitLeave} className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4">
          <div>
            <h4 className="text-sm font-semibold text-white">Submit a sample request</h4>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Preview the member flow. This does not save to a workspace.
            </p>
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-slate-200">
            Department
            <select
              name="department"
              required
              defaultValue="Police"
              className={`${controlClass} w-full`}
            >
              {departments.map((name) => <option key={name}>{name}</option>)}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-slate-200">
              Start date
              <input
                type="date"
                name="startDate"
                required
                defaultValue="2026-11-18"
                className={`${controlClass} w-full`}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-200">
              End date
              <input
                type="date"
                name="endDate"
                required
                defaultValue="2026-11-24"
                className={`${controlClass} w-full`}
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium text-slate-200">
            Reason
            <textarea
              name="reason"
              required
              maxLength={240}
              rows={3}
              placeholder="Add a short reason"
              className={`${controlClass} min-h-20 w-full py-2`}
            />
          </label>
          <button
            type="submit"
            className="min-h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          >
            Add sample request
          </button>
        </form>

        <div>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3">
              <p className="text-xs font-medium text-slate-300">Awaiting decision</p>
              <p className="mt-1 text-2xl font-bold text-amber-200">{pendingCount}</p>
            </div>
            <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 p-3">
              <p className="text-xs font-medium text-slate-300">Approved · pauses quota</p>
              <p className="mt-1 text-2xl font-bold text-emerald-200">{approvedCount}</p>
            </div>
          </div>

          <div className="space-y-3">
            {requests.map((request) => (
              <article
                key={request.id}
                className="rounded-lg border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{request.member}</p>
                    <p className="mt-1 text-xs text-slate-400">{request.department}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    request.status === "Approved"
                      ? "bg-emerald-950 text-emerald-200"
                      : request.status === "Declined"
                        ? "bg-red-950 text-red-200"
                        : "bg-amber-950 text-amber-200"
                  }`}>
                    {request.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-200">
                  {formatDemoDate(request.startDate)} – {formatDemoDate(request.endDate)}
                </p>
                <p className="mt-1 text-sm leading-5 text-slate-400">{request.reason}</p>
                {request.status === "Approved" && (
                  <p className="mt-3 rounded border border-blue-900/60 bg-blue-950/20 px-3 py-2 text-xs text-blue-200">
                    Approved leave pauses this member&apos;s weekly hour requirement.
                  </p>
                )}
                {request.status === "Pending" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => decideRequest(request.id, "Approved")}
                      className="min-h-10 rounded-lg border border-emerald-800 px-3 text-xs font-semibold text-emerald-200 hover:bg-emerald-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      Approve sample
                    </button>
                    <button
                      type="button"
                      onClick={() => decideRequest(request.id, "Declined")}
                      className="min-h-10 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      Decline sample
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
          <p role="status" aria-live="polite" className="mt-3 min-h-5 text-sm text-blue-200">
            {notice}
          </p>
        </div>
      </div>
    </section>
  );
}

export function LandingInactivityDemo() {
  const [department, setDepartment] = useState<DepartmentName>("Police");
  const [weeklyHours, setWeeklyHours] = useState(4);
  const [excludeLeave, setExcludeLeave] = useState(true);

  const records = {
    Police: [
      { member: "Member 014", hours: 3.2, status: "Active" },
      { member: "Member 022", hours: 5.1, status: "Active" },
      { member: "Member 031", hours: 0.6, status: "LOA" },
      { member: "Member 042", hours: 1.8, status: "Active" },
    ],
    "Fire & EMS": [
      { member: "Member 027", hours: 3.6, status: "Active" },
      { member: "Member 035", hours: 4.8, status: "Active" },
      { member: "Member 041", hours: 1.2, status: "Probationary" },
    ],
    Staff: [
      { member: "Member 003", hours: 2.4, status: "Active" },
      { member: "Member 009", hours: 4.5, status: "Active" },
      { member: "Member 018", hours: 0.8, status: "Active" },
    ],
    Custom: [
      { member: "Member 051", hours: 5.2, status: "Active" },
      { member: "Member 058", hours: 2.3, status: "Active" },
      { member: "Member 062", hours: 0.5, status: "Active" },
    ],
  } satisfies Record<DepartmentName, Array<{ member: string; hours: number; status: string }>>;

  const reviewRecords = records[department].filter(
    (record) =>
      record.hours < weeklyHours &&
      !(excludeLeave && record.status === "LOA")
  );

  return (
    <section
      aria-labelledby="inactivity-preview-title"
      className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/20"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-5 py-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-blue-300">
            Interactive example
          </p>
          <h3 id="inactivity-preview-title" className="mt-1 text-base font-bold text-white">
            Weekly activity review
          </h3>
        </div>
        <span className="rounded-full border border-amber-800/80 bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-200">
          Sample data · preview only
        </span>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.7fr)]">
        <div>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-slate-200">
              Preview department
              <select
                className={controlClass}
                value={department}
                onChange={(event) => setDepartment(event.target.value as DepartmentName)}
              >
                {departments.map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-slate-200">
              Weekly hour requirement
              <span className="flex min-h-11 items-center gap-3 rounded border border-slate-700 bg-slate-950 px-3">
                <input
                  type="range"
                  min={0}
                  max={8}
                  step={0.5}
                  value={weeklyHours}
                  onChange={(event) => setWeeklyHours(Number(event.target.value))}
                  className="min-w-0 flex-1 accent-blue-500"
                  aria-label="Weekly hour requirement for this preview"
                  aria-valuetext={`${weeklyHours} hours per week`}
                />
                <output className="w-16 text-right font-mono text-sm text-white">
                  {weeklyHours} h
                </output>
              </span>
            </label>
          </div>

          <label className="mb-4 flex min-h-11 items-center gap-3 rounded border border-slate-800 bg-slate-950/70 px-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={excludeLeave}
              onChange={(event) => setExcludeLeave(event.target.checked)}
              className="h-4 w-4 accent-blue-500"
            />
            Exclude members on approved leave
          </label>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <caption className="sr-only">
                Example weekly hours by member and the result of the selected quota
              </caption>
              <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold">Member</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Hours</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Progress</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {records[department].map((record) => {
                  const paused = excludeLeave && record.status === "LOA";
                  const progress = weeklyHours === 0
                    ? 100
                    : Math.min(100, Math.round((record.hours / weeklyHours) * 100));
                  const needsReview = record.hours < weeklyHours && !paused;
                  return (
                    <tr key={record.member} className="bg-slate-900/50">
                      <th scope="row" className="whitespace-nowrap px-3 py-3 font-medium text-slate-100">
                        {record.member}
                        <span className="mt-0.5 block text-xs font-normal text-slate-500">
                          {record.status}
                        </span>
                      </th>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-300">
                        {record.hours.toFixed(1)} / {weeklyHours} h
                      </td>
                      <td className="px-3 py-3">
                        <div
                          className="h-2 w-20 overflow-hidden rounded-full bg-slate-700"
                          role="progressbar"
                          aria-label={`${record.member} weekly quota progress`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={progress}
                        >
                          <div
                            className={`h-full rounded-full ${needsReview ? "bg-amber-400" : "bg-emerald-400"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="mt-1 block text-xs text-slate-400">{progress}%</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          paused
                            ? "bg-blue-950 text-blue-200"
                            : needsReview
                              ? "bg-amber-950 text-amber-200"
                              : "bg-emerald-950 text-emerald-200"
                        }`}>
                          {paused ? "LOA pause" : needsReview ? "Review" : "On track"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="flex flex-col rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-semibold text-white">Review summary</p>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-1">
            <div className="rounded-lg border border-amber-900/60 bg-amber-950/20 p-3">
              <p className="text-sm text-slate-300">Needs review</p>
              <p className="mt-1 text-2xl font-bold text-amber-200">
                {reviewRecords.length}
                <span className="ml-1 text-sm font-normal text-slate-400">
                  {reviewRecords.length === 1 ? "member" : "members"}
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-blue-900/60 bg-blue-950/20 p-3">
              <p className="text-sm text-slate-300">Leave exclusions</p>
              <p className="mt-1 text-2xl font-bold text-blue-200">
                {excludeLeave ? records[department].filter((record) => record.status === "LOA").length : 0}
                <span className="ml-1 text-sm font-normal text-slate-400">paused</span>
              </p>
            </div>
          </div>
          <p aria-live="polite" className="mt-4 text-sm leading-6 text-slate-400">
            With a {weeklyHours}-hour quota, {reviewRecords.length} of {records[department].length} example members
            {reviewRecords.length === 1 ? " needs" : " need"} review in {department}.
            {excludeLeave ? " Approved leave is excluded." : " Leave is not excluded in this preview."}
          </p>
          <p className="mt-auto border-t border-slate-800 pt-4 text-xs leading-5 text-slate-500">
            Example only. Real reviews use saved web duty, department quotas,
            leave dates, and workspace policy.
          </p>
        </aside>
      </div>
    </section>
  );
}

export function LandingDepartmentDemo() {
  const [department, setDepartment] = useState<DepartmentName>("Police");
  const [rankLabel, setRankLabel] = useState<RankLabel>("Rank");
  const [callsignStyle, setCallsignStyle] = useState<CallsignStyle>("Unit first");
  const details = demoDepartments[department];
  const styles = colorStyles[details.color];

  return (
    <section
      aria-labelledby="department-preview-title"
      className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-black/20"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-5 py-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wider text-blue-300">
            Interactive example
          </p>
          <h3 id="department-preview-title" className="mt-1 text-base font-bold text-white">
            Department workspace
          </h3>
        </div>
        <span className="rounded-full border border-amber-800/80 bg-amber-950/40 px-3 py-1 text-xs font-semibold text-amber-200">
          Sample data · preview only
        </span>
      </header>

      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.7fr)]">
        <div>
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Choose a sample department">
            {departments.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={department === name}
                onClick={() => setDepartment(name)}
                className={`min-h-11 rounded-lg border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  department === name
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500 hover:text-white"
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Roster", `${details.members} members`],
              ["Subdivisions", String(details.subdivisions.length)],
              ["Published SOPs", String(details.sopCount)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-xs font-medium text-slate-400">{label}</p>
                <p className="mt-1 text-lg font-bold text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full min-w-[33rem] text-left text-sm">
              <caption className="sr-only">{department} example roster</caption>
              <thead className="bg-slate-950 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold">Member</th>
                  <th scope="col" className="px-3 py-3 font-semibold">{rankLabel}</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Callsign</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {details.roster.map((member) => {
                  const [unit, number] = member.callsign.split("-");
                  const callsign = callsignStyle === "Unit first"
                    ? member.callsign
                    : `${number}-${unit}`;
                  return (
                    <tr key={member.member} className="bg-slate-900/50">
                      <th scope="row" className="whitespace-nowrap px-3 py-3 font-medium text-slate-100">
                        {member.member}
                      </th>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-300">{member.rank}</td>
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-slate-300">{callsign}</td>
                      <td className="whitespace-nowrap px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          member.status === "Active"
                            ? "bg-emerald-950 text-emerald-200"
                            : member.status === "LOA"
                              ? "bg-blue-950 text-blue-200"
                              : "bg-amber-950 text-amber-200"
                        }`}>
                          {member.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-sm font-semibold text-white">Preview your terminology</p>
          <p className="mt-1 text-sm leading-5 text-slate-400">
            See how department labels and callsigns could be presented to your community.
          </p>

          <label className="mt-4 grid gap-1.5 text-sm font-medium text-slate-200">
            Personnel title
            <select
              className={controlClass}
              value={rankLabel}
              onChange={(event) => setRankLabel(event.target.value as RankLabel)}
            >
              <option>Rank</option>
              <option>Grade</option>
              <option>Role</option>
            </select>
          </label>
          <label className="mt-3 grid gap-1.5 text-sm font-medium text-slate-200">
            Callsign display
            <select
              className={controlClass}
              value={callsignStyle}
              onChange={(event) => setCallsignStyle(event.target.value as CallsignStyle)}
            >
              <option>Unit first</option>
              <option>Number first</option>
            </select>
          </label>

          <div className={`mt-4 rounded-lg border ${styles.border} bg-slate-900/60 p-4`}>
            <p className={`font-mono text-xs uppercase tracking-wide ${styles.accent}`}>
              {department} · {details.code}
            </p>
            <p className="mt-2 text-sm text-slate-200">
              {details.subdivisions.join(" · ")}
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span>Training completion</span>
              <span className="font-semibold text-slate-200">{details.training}</span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-slate-700"
              role="progressbar"
              aria-label={`${department} example training completion`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Number.parseInt(details.training, 10)}
            >
              <div
                className={`h-full rounded-full ${styles.bar}`}
                style={{ width: details.training }}
              />
            </div>
          </div>
          <p aria-live="polite" className="mt-4 text-xs leading-5 text-slate-500">
            Previewing {department.toLowerCase()} with “{rankLabel}” terminology and {callsignStyle.toLowerCase()} callsigns.
            These example controls do not save workspace settings.
          </p>
        </aside>
      </div>
    </section>
  );
}
