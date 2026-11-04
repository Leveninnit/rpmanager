"use client";

import { useState } from "react";

// Realistic LOA mock records for community officers
const initialLoaRequests = [
  {
    id: "LOA-108",
    officerName: "Marcus Vance",
    callsign: "2-ADAM-14",
    department: "Patrol Operations",
    startDate: "2026-11-06",
    endDate: "2026-11-14",
    daysCount: 8,
    reason: "College midterms and travel with limited internet access.",
    status: "PENDING",
    submittedAt: "2 hours ago",
    hoursQuotaFrozen: true,
  },
  {
    id: "LOA-105",
    officerName: "Sarah Croft",
    callsign: "MED-04",
    department: "EMS & Rescue",
    startDate: "2026-11-01",
    endDate: "2026-11-08",
    daysCount: 7,
    reason: "Work shift schedule conflict.",
    status: "APPROVED",
    submittedAt: "3 days ago",
    hoursQuotaFrozen: true,
    reviewedBy: "Commander Sterling",
  },
  {
    id: "LOA-099",
    officerName: "David Miller",
    callsign: "SWAT-02",
    department: "Special Operations",
    startDate: "2026-10-20",
    endDate: "2026-10-25",
    daysCount: 5,
    reason: "GPU hardware failure, waiting for replacement parts.",
    status: "EXPIRED",
    submittedAt: "14 days ago",
    hoursQuotaFrozen: false,
    reviewedBy: "Capt. Reynolds",
  },
];

export default function LoaConsole() {
  const [requests, setRequests] = useState(initialLoaRequests);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [formCallsign, setFormCallsign] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formReason, setFormReason] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleApprove = (id: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "APPROVED",
              reviewedBy: "High Command (You)",
              hoursQuotaFrozen: true,
            }
          : r
      )
    );
  };

  const handleDeny = (id: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: "DENIED",
              reviewedBy: "High Command (You)",
              hoursQuotaFrozen: false,
            }
          : r
      )
    );
  };

  const handleSubmitNewLoa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStartDate || !formEndDate || !formReason) return;

    const newRequest = {
      id: `LOA-${Math.floor(100 + Math.random() * 900)}`,
      officerName: "You (Active Officer)",
      callsign: formCallsign || "1-L-99",
      department: "Active Patrol",
      startDate: formStartDate,
      endDate: formEndDate,
      daysCount: 7,
      reason: formReason,
      status: "PENDING",
      submittedAt: "Just now",
      hoursQuotaFrozen: true,
    };

    setRequests([newRequest, ...requests]);
    setShowSubmitModal(false);
    setFormStartDate("");
    setFormEndDate("");
    setFormReason("");
    setFormCallsign("");
    setSuccessMessage("LOA request logged and forwarded to Discord command channel.");
    setTimeout(() => setSuccessMessage(""), 5000);
  };

  return (
    <div className="border border-slate-800 rounded-lg bg-slate-900/60 overflow-hidden">
      {/* Console Header */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <h3 className="font-heading text-lg font-bold text-white">
              Leave of Absence (LOA) Engine
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Officers submit leave via Discord bot or web. High Command approves to freeze weekly quota and assign temporary Discord status.
          </p>
        </div>

        <button
          onClick={() => setShowSubmitModal(true)}
          className="min-h-[44px] px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors self-start sm:self-auto flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Request LOA
        </button>
      </div>

      {successMessage && (
        <div className="px-6 py-3 bg-emerald-950/80 border-b border-emerald-800 text-emerald-300 text-xs font-mono flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")} className="text-emerald-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* LOA Request Queue Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 uppercase tracking-wider">
              <th className="px-6 py-3 font-semibold">ID</th>
              <th className="px-6 py-3 font-semibold font-sans">Officer / Unit</th>
              <th className="px-6 py-3 font-semibold font-sans">Department</th>
              <th className="px-6 py-3 font-semibold">Duration</th>
              <th className="px-6 py-3 font-semibold font-sans">Reason Summary</th>
              <th className="px-6 py-3 font-semibold">Quota Status</th>
              <th className="px-6 py-3 font-semibold text-right">Command Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {requests.map((item) => (
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
                <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                  <div>{item.startDate} → {item.endDate}</div>
                  <span className="text-[11px] text-slate-400">({item.daysCount} days)</span>
                </td>
                <td className="px-6 py-4 text-slate-300 font-sans max-w-xs truncate">
                  {item.reason}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.status === "APPROVED" && (
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] border border-emerald-800 bg-emerald-950/60 text-emerald-300">
                      Quota Frozen (Active)
                    </span>
                  )}
                  {item.status === "PENDING" && (
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] border border-amber-800 bg-amber-950/60 text-amber-300">
                      Awaiting Command
                    </span>
                  )}
                  {item.status === "DENIED" && (
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] border border-red-800 bg-red-950/60 text-red-300">
                      Denied (Normal Quota)
                    </span>
                  )}
                  {item.status === "EXPIRED" && (
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] border border-slate-700 bg-slate-900 text-slate-400">
                      Expired / Reinstated
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  {item.status === "PENDING" ? (
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => handleApprove(item.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 font-sans text-xs font-semibold"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleDeny(item.id)}
                        className="min-h-[36px] px-3 py-1.5 rounded bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 font-sans text-xs"
                      >
                        Decline
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-sans">
                      {item.reviewedBy ? `Signed by ${item.reviewedBy}` : "Completed"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Submit LOA Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-6 text-left">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h4 className="font-heading text-lg font-bold text-white">
                Submit Leave of Absence
              </h4>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitNewLoa} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Unit Callsign / Badge
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1-L-14"
                  value={formCallsign}
                  onChange={(e) => setFormCallsign(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 bg-slate-950 border border-slate-800 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                  Reason for Absence
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Brief explanation for High Command review..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSubmitModal(false)}
                  className="min-h-[44px] px-4 py-2 text-xs font-medium text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                >
                  Submit for Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
