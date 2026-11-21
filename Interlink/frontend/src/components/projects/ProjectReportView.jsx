import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getProjectReport } from "../../api/projectApi";

export default function ProjectReportView({ projectId }) {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadReport = async () => {
        try {
            setLoading(true);
            const res = await getProjectReport(projectId);
            if (res.data?.success) {
                setReport(res.data.data);
            }
        } catch (err) {
            console.error("Load report error:", err);
            toast.error("Failed to load project report");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) loadReport();
    }, [projectId]);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 animate-pulse space-y-4">
                <div className="h-8 w-64 bg-slate-200 rounded"></div>
                <div className="h-44 bg-slate-100 rounded-xl"></div>
            </div>
        );
    }

    if (!report) return null;

    const p = report.project;
    const b = report.budgetSummary;
    const taskBreakdown = report.taskBreakdown || [];
    const milestoneBreakdown = report.milestoneBreakdown || [];
    const topRisks = report.topRisks || [];

    const totalTasks = taskBreakdown.reduce((acc, t) => acc + Number(t.count), 0);
    const completedTasks = taskBreakdown.find((t) => t.status === "done")?.count || 0;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 sm:p-8 shadow-sm space-y-6 print:p-0 print:border-0">
            {/* Header / Report Metadata */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md uppercase tracking-wider">
                        Executive Status Report
                    </span>
                    <h2 className="text-xl font-black text-[#17212F] mt-2">{p.name}</h2>
                    <p className="text-xs text-[#5B6573] mt-0.5">
                        Code: <span className="font-mono font-bold text-[#17365D]">{p.code}</span> &bull; Generated: {new Date().toLocaleDateString()}
                    </p>
                </div>

                <button
                    onClick={() => window.print()}
                    className="self-start sm:self-auto px-4 py-2 bg-[#17365D] hover:bg-[#102642] text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5 print:hidden"
                >
                    <i className="fa-solid fa-print"></i>
                    <span>Print Report</span>
                </button>
            </div>

            {/* Financial & Schedule Scorecard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#F8FAFC] border border-[#EDF2F7] rounded-xl p-4">
                    <p className="text-[11px] font-bold text-[#5B6573] uppercase tracking-wider">Budget Health</p>
                    <h3 className="text-xl font-black text-[#17212F] mt-1">
                        ${b.actual?.toLocaleString()} / ${b.approved?.toLocaleString()}
                    </h3>
                    <p className={`text-xs font-semibold mt-1 ${b.variance < 0 ? "text-red-600" : "text-emerald-700"}`}>
                        Variance: ${b.variance?.toLocaleString()} ({b.burnRate}% consumed)
                    </p>
                </div>

                <div className="bg-[#F8FAFC] border border-[#EDF2F7] rounded-xl p-4">
                    <p className="text-[11px] font-bold text-[#5B6573] uppercase tracking-wider">Task Execution Velocity</p>
                    <h3 className="text-xl font-black text-[#17212F] mt-1">
                        {completedTasks} / {totalTasks} Completed
                    </h3>
                    <p className="text-xs text-blue-600 font-semibold mt-1">
                        {completionRate}% Delivery rate
                    </p>
                </div>

                <div className="bg-[#F8FAFC] border border-[#EDF2F7] rounded-xl p-4">
                    <p className="text-[11px] font-bold text-[#5B6573] uppercase tracking-wider">Stakeholders</p>
                    <p className="text-xs font-bold text-[#17212F] mt-1">
                        Project Lead: <span className="text-[#17365D]">{p.owner_name || "Unassigned"}</span>
                    </p>
                    <p className="text-xs font-bold text-[#17212F] mt-0.5">
                        Sponsor: <span className="text-purple-700">{p.sponsor_name || "None"}</span>
                    </p>
                </div>
            </div>

            {/* Task Breakdown */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#17212F] uppercase tracking-wider">Work Breakdown Structure by Status</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {taskBreakdown.map((t) => (
                        <div key={t.status} className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">{t.status}</span>
                            <p className="text-lg font-black text-[#17212F] mt-0.5">{t.count}</p>
                            <span className="text-[10px] text-slate-400">Est: {Number(t.total_est || 0)}h</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Critical Risks */}
            <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#17212F] uppercase tracking-wider">Key Monitored Risks</h4>
                {topRisks.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">No open high-severity risks recorded.</p>
                ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                        {topRisks.map((r, idx) => (
                            <div key={idx} className="p-3.5 bg-white flex items-start justify-between gap-4">
                                <div>
                                    <h5 className="text-xs font-bold text-[#17212F]">{r.title}</h5>
                                    {r.mitigation_plan && (
                                        <p className="text-[11px] text-[#5B6573] mt-0.5">
                                            <strong>Mitigation:</strong> {r.mitigation_plan}
                                        </p>
                                    )}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                    r.severity_score >= 12 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                                }`}>
                                    Score: {r.severity_score}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
