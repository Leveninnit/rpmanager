"use client";

import { useState } from "react";

const departmentData = {
  patrol: {
    title: "Active Patrol Roster & CAD Status",
    badge: "16 Units In Service",
    description: "Manage unit callsigns, live 10-codes, and specialty endorsements across active patrol shifts.",
    columns: ["Callsign", "Officer / Deputy", "Rank", "Current 10-Code", "Qualifications"],
    rows: [
      { id: "1-L-14", name: "J. Davies", rank: "Senior Officer", status: "10-8 Available", statusColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800", cert: "EVOC / Motor Unit" },
      { id: "2-A-02", name: "M. Miller", rank: "Corporal", status: "10-6 Traffic Stop", statusColor: "text-amber-400 bg-amber-950/60 border-amber-800", cert: "SWAT / Breacher" },
      { id: "3-K-09", name: "R. Campbell", rank: "Field Training Officer", status: "10-8 Available", statusColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800", cert: "Pursuit Lead Certified" },
      { id: "1-D-01", name: "D. Evans", rank: "Detective", status: "10-97 On Scene", statusColor: "text-blue-400 bg-blue-950/60 border-blue-800", cert: "Major Crimes Investigator" },
    ],
  },
  vetting: {
    title: "Applicant Screening & Whitelist Review",
    badge: "5 Pending Submissions",
    description: "Track incoming staff and department applications through custom scoring and background review.",
    columns: ["Application ID", "Applicant Tag", "Target Department", "Rule Test Score", "Stage Status"],
    rows: [
      { id: "APP-401", name: "Phantom_RP", rank: "Law Enforcement", status: "98% Pass", statusColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800", cert: "Scheduled for Voice Interview" },
      { id: "APP-402", name: "Vortex_9", rank: "EMS & Fire Rescue", status: "92% Pass", statusColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800", cert: "Awaiting Command Review" },
      { id: "APP-405", name: "Kev_Shift", rank: "Server Moderation Team", status: "89% Pass", statusColor: "text-blue-400 bg-blue-950/60 border-blue-800", cert: "Background Clearance Done" },
    ],
  },
  training: {
    title: "Field Training Logs & Certifications",
    badge: "12 Trainees Enrolled",
    description: "Verify rookie evaluations and solo patrol signoffs without scattered Discord ticket channels.",
    columns: ["Trainee Name", "Assigned FTO", "Training Module", "Observation Score", "Status"],
    rows: [
      { id: "FTO-102", name: "Cadet T. Hughes", rank: "Sgt. Harrison", status: "Code 3 Navigation & Radio", statusColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800", cert: "Phase 2 Solo Approved" },
      { id: "FTO-108", name: "Cadet B. Watson", rank: "Ofc. Davies", status: "Felony Stop & Weapon Safety", statusColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800", cert: "Passed Practical Test" },
      { id: "FTO-115", name: "Cadet A. Fletcher", rank: "Cpl. Miller", status: "Server SOP & Evidence Handling", statusColor: "text-amber-400 bg-amber-950/60 border-amber-800", cert: "Needs 1 Supervised Shift" },
    ],
  },
};

type DepartmentKey = keyof typeof departmentData;

export default function DepartmentTabs() {
  const [activeTab, setActiveTab] = useState<DepartmentKey>("patrol");
  const data = departmentData[activeTab];

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900/60 overflow-hidden">
      {/* Tab Controls (44px min touch target) */}
      <div className="flex flex-wrap border-b border-slate-800 bg-slate-950/80">
        <button
          onClick={() => setActiveTab("patrol")}
          className={`min-h-[44px] px-5 py-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === "patrol"
              ? "border-blue-500 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Active Patrol Roster
        </button>

        <button
          onClick={() => setActiveTab("vetting")}
          className={`min-h-[44px] px-5 py-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === "vetting"
              ? "border-blue-500 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Staff & Whitelist Applications
        </button>

        <button
          onClick={() => setActiveTab("training")}
          className={`min-h-[44px] px-5 py-3 text-sm font-semibold transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === "training"
              ? "border-blue-500 text-white bg-slate-900/80"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          FTO Certifications
        </button>
      </div>

      {/* Tab Header Detail */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-heading text-lg font-bold text-white mb-1">
            {data.title}
          </h3>
          <p className="text-sm text-slate-400">
            {data.description}
          </p>
        </div>
        <span className="self-start sm:self-auto inline-flex items-center px-3 py-1 text-xs font-mono font-medium rounded border border-blue-800 bg-blue-950 text-blue-300">
          {data.badge}
        </span>
      </div>

      {/* Tab Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase tracking-wider text-slate-400 font-mono">
              {data.columns.map((col) => (
                <th key={col} className="px-6 py-3 font-semibold">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 font-mono text-xs">
            {data.rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4 font-bold text-white whitespace-nowrap">
                  {row.id}
                </td>
                <td className="px-6 py-4 text-slate-300 font-sans font-medium whitespace-nowrap">
                  {row.name}
                </td>
                <td className="px-6 py-4 text-slate-400 font-sans whitespace-nowrap">
                  {row.rank}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs border ${row.statusColor}`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-300 font-sans whitespace-nowrap">
                  {row.cert}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
