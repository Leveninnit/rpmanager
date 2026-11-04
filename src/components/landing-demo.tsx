"use client";

import { useState } from "react";

const views = ["Overview", "Roster", "Duty"] as const;
type View = (typeof views)[number];

export default function LandingDemo() {
  const [view, setView] = useState<View>("Overview");

  return (
    <section aria-label="Interactive sample workspace preview" className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/90 font-mono text-xs shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="font-bold text-slate-200">WORKSPACE DEMO</span>
          <span className="rounded-full border border-amber-800/80 bg-amber-950/40 px-2.5 py-1 text-[10px] font-semibold text-amber-200">
            SAMPLE DATA
          </span>
        </div>
        <span className="text-slate-400">PREVIEW ONLY · NOT LIVE DATA</span>
      </div>

      <div role="group" aria-label="Workspace demo views" className="flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950/60 p-2">
        {views.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setView(item)}
            aria-pressed={view === item}
            className={`min-h-10 rounded-lg px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
              view === item
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <div
        aria-live="polite"
        className="min-h-52 p-4"
      >
        {view === "Overview" && (
          <>
            <p className="mb-3 text-sm text-slate-300">Northside Roleplay <span className="text-slate-500">· Community overview</span></p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Personnel", "48", "Across 3 departments"],
                ["Duty this week", "126.5 h", "Website-recorded hours"],
                ["Applications", "6", "2 awaiting review"],
              ].map(([label, value, note]) => (
                <div key={label} className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-xs font-medium text-slate-400">{label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-white">{value}</p>
                  <p className="mt-1 text-xs text-slate-400">{note}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                ["POLICE", "28 members", "border-blue-900/70 text-blue-200 bg-blue-950/20"],
                ["FIRE & EMS", "14 members", "border-emerald-900/70 text-emerald-200 bg-emerald-950/20"],
                ["STAFF", "6 members", "border-violet-900/70 text-violet-200 bg-violet-950/20"],
              ].map(([name, count, style]) => (
                <div key={name} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${style}`}>
                  <span className="font-semibold">{name}</span>
                  <span className="text-slate-300">{count}</span>
                </div>
              ))}
            </div>
          </>
        )}
        {view === "Roster" && (
          <>
            <p className="mb-3 text-slate-400">Example personnel roster</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-96 text-left">
                <caption className="sr-only">Sample workspace personnel roster</caption>
                <thead className="border-b border-slate-800 text-slate-400">
                  <tr>
                    <th scope="col" className="pb-2 font-semibold">Member</th>
                    <th scope="col" className="pb-2 font-semibold">Department</th>
                    <th scope="col" className="pb-2 font-semibold">Rank</th>
                    <th scope="col" className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {[
                    ["Member 014", "Police", "Sergeant", "Active"],
                    ["Member 027", "Fire & EMS", "Medic", "Active"],
                    ["Member 031", "Staff", "Supervisor", "LOA"],
                  ].map((row) => (
                    <tr key={row[0]}>
                      {row.map((cell) => <td key={cell} className="py-3 pr-3">{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {view === "Duty" && (
          <>
            <p className="mb-3 text-slate-400">Example duty records · website clock</p>
            <div className="space-y-2">
              {[
                ["Member 014", "Police · 2A-14", "2.4 h"],
                ["Member 027", "Fire & EMS · M-07", "1.8 h"],
                ["Member 042", "Police · 3B-02", "On duty"],
              ].map(([member, assignment, duration]) => (
                <div key={member} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <span className="text-slate-200">{member}</span>
                  <span className="text-slate-400">{assignment}</span>
                  <span className="text-blue-300">{duration}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
