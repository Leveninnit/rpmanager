"use client";

import { useState } from "react";

// Mock audit of officers under weekly hour quota
const initialInactivityAudits = [
  {
    id: "STRK-201",
    officerName: "C. Reynolds",
    callsign: "3-K-02",
    department: "Patrol Operations",
    hoursLogged: 1.2,
    hoursRequired: 4.0,
    deficitHours: 2.8,
    priorStrikes: 1,
    proposedAction: "Strike Level 2 (Formal Warning)",
    status: "DRAFT",
    explanation: "No active LOA on record. Joined patrol voice channel once this week.",
  },
  {
    id: "STRK-202",
    officerName: "T. Fletcher",
    callsign: "2-A-09",
    department: "EMS & Rescue",
    hoursLogged: 0.0,
    hoursRequired: 3.5,
    deficitHours: 3.5,
    priorStrikes: 0,
    proposedAction: "Automated Warning Notice",
    status: "DRAFT",
    explanation: "Zero shifts recorded in 7 days.",
  },
  {
    id: "STRK-198",
    officerName: "K. Davies",
    callsign: "1-L-04",
    department: "Special Operations",
    hoursLogged: 2.1,
    hoursRequired: 4.0,
    deficitHours: 1.9,
    priorStrikes: 0,
    proposedAction: "Pardoned by High Command",
    status: "PARDONED",
    explanation: "Command verified offline CAD admin work and event setup.",
  },
];

export default function InactivityConsole() {
  const [audits, setAudits] = useState(initialInactivityAudits);
  const [activeNotice, setActiveNotice] = useState("");

  const handleConfirmStrike = (id: string) => {
    setAudits((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: "CONFIRMED",
              proposedAction: "Strike Applied & Discord DM Dispatched",
            }
          : a
      )
    );
    setActiveNotice(`Strike confirmed for ${id}. Notification sent via Discord bot.`);
    setTimeout(() => setActiveNotice(""), 4000);
  };

  const handlePardon = (id: string) => {
    setAudits((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              status: "PARDONED",
              proposedAction: "Pardoned (Hours Excused)",
            }
          : a
      )
    );
    setActiveNotice(`Officer excused for ${id}. Quota requirement waived.`);
    setTimeout(() => setActiveNotice(""), 4000);
  };

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900/60 overflow-hidden">
      {/* Console Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <h3 className="font-heading text-lg font-bold text-white">
              Automated Inactivity Strikes & Warnings
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Weekly automated quota auditor. High Command can review deficit hours, adjust strike levels, or pardon excused staff before Discord notices dispatch.
          </p>
        </div>

        <span className="text-xs font-mono px-3 py-1.5 rounded border border-amber-800 bg-amber-950/60 text-amber-300 self-start sm:self-auto">
          Audit Period: Oct 28 – Nov 04
        </span>
      </div>

      {activeNotice && (
        <div className="px-6 py-3 bg-blue-950/80 border-b border-blue-800 text-blue-300 text-xs font-mono flex items-center justify-between">
          <span>{activeNotice}</span>
          <button onClick={() => setActiveNotice("")} className="text-blue-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Inactivity Queue */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-3 font-semibold">Audit ID</th>
              <th className="px-6 py-3 font-semibold font-sans">Officer / Callsign</th>
              <th className="px-6 py-3 font-semibold font-sans">Department</th>
              <th className="px-6 py-3 font-semibold">Hours Logged</th>
              <th className="px-6 py-3 font-semibold">Prior Strikes</th>
              <th className="px-6 py-3 font-semibold">System Recommendation</th>
              <th className="px-6 py-3 font-semibold text-right">Command Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {audits.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4 font-bold text-white whitespace-nowrap">
                  {item.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-sans font-medium text-slate-200">
                  {item.officerName}
                  <span className="block text-xs font-mono text-slate-400">{item.callsign}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-sans text-slate-300">
                  {item.department}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-red-400 font-bold">{item.hoursLogged} hrs</span>
                  <span className="text-slate-400"> / {item.hoursRequired} req</span>
                  <span className="block text-[11px] text-amber-400 font-mono">(-{item.deficitHours} hrs deficit)</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                  {item.priorStrikes} strike(s) on file
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.status === "DRAFT" && (
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] border border-amber-800 bg-amber-950/60 text-amber-300">
                      Draft: {item.proposedAction}
                    </span>
                  )}
                  {item.status === "CONFIRMED" && (
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] border border-red-800 bg-red-950/60 text-red-300">
                      Confirmed & Dispatched
                    </span>
                  )}
                  {item.status === "PARDONED" && (
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] border border-slate-700 bg-slate-900 text-slate-300">
                      Pardoned / Excused
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {item.status === "DRAFT" ? (
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => handleConfirmStrike(item.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 font-sans text-xs font-semibold"
                      >
                        Confirm Strike
                      </button>
                      <button
                        onClick={() => handlePardon(item.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-sans text-xs"
                      >
                        Pardon
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-sans">
                      {item.status === "CONFIRMED" ? "Logged in Audit File" : "No Action Taken"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
