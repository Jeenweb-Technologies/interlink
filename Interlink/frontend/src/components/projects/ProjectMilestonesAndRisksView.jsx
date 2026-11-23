import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
    getProjectMilestones,
    createProjectMilestone,
    updateProjectMilestone,
    getProjectRisks,
    createProjectRisk,
    updateProjectRisk
} from "../../api/projectApi";

export default function ProjectMilestonesAndRisksView({ projectId, phases = [] }) {
    const [milestones, setMilestones] = useState([]);
    const [risksData, setRisksData] = useState({ risks: [], matrix: {} });
    const [loading, setLoading] = useState(true);

    // Modals
    const [createMilestoneOpen, setCreateMilestoneOpen] = useState(false);
    const [createRiskOpen, setCreateRiskOpen] = useState(false);

    // Milestone Form
    const [milestoneTitle, setMilestoneTitle] = useState("");
    const [milestoneDate, setMilestoneDate] = useState("");
    const [milestonePhaseId, setMilestonePhaseId] = useState("");

    // Risk Form
    const [riskTitle, setRiskTitle] = useState("");
    const [riskCategory, setRiskCategory] = useState("technical");
    const [riskProbability, setRiskProbability] = useState(3);
    const [riskImpact, setRiskImpact] = useState(3);
    const [mitigationPlan, setMitigationPlan] = useState("");

    const loadAll = async () => {
        try {
            setLoading(true);
            const [mRes, rRes] = await Promise.all([
                getProjectMilestones(projectId),
                getProjectRisks(projectId)
            ]);
            if (mRes.data?.success) setMilestones(mRes.data.data || []);
            if (rRes.data?.success) setRisksData(rRes.data.data || { risks: [], matrix: {} });
        } catch (err) {
            console.error("Load milestones and risks error:", err);
            toast.error("Failed to load milestones & risks");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) loadAll();
    }, [projectId]);

    const handleCreateMilestone = async (e) => {
        e.preventDefault();
        if (!milestoneTitle.trim() || !milestoneDate) {
            toast.error("Title and due date are required");
            return;
        }

        try {
            const res = await createProjectMilestone(projectId, {
                title: milestoneTitle.trim(),
                due_date: milestoneDate,
                phase_id: milestonePhaseId || null
            });
            if (res.data?.success) {
                toast.success("Milestone created!");
                setMilestoneTitle("");
                setMilestoneDate("");
                setCreateMilestoneOpen(false);
                loadAll();
            }
        } catch (err) {
            toast.error("Failed to create milestone");
        }
    };

    const handleToggleMilestone = async (m) => {
        const nextStatus = m.status === "achieved" ? "pending" : "achieved";
        const achievedDate = nextStatus === "achieved" ? new Date().toISOString().slice(0, 10) : null;
        try {
            await updateProjectMilestone(m.id, {
                status: nextStatus,
                achieved_date: achievedDate
            });
            toast.success(`Milestone marked as ${nextStatus}`);
            loadAll();
        } catch (err) {
            toast.error("Failed to update milestone");
        }
    };

    const handleCreateRisk = async (e) => {
        e.preventDefault();
        if (!riskTitle.trim()) {
            toast.error("Risk title is required");
            return;
        }

        try {
            const res = await createProjectRisk(projectId, {
                title: riskTitle.trim(),
                category: riskCategory,
                probability: Number(riskProbability),
                impact: Number(riskImpact),
                mitigation_plan: mitigationPlan.trim()
            });
            if (res.data?.success) {
                toast.success("Risk logged in register!");
                setRiskTitle("");
                setMitigationPlan("");
                setCreateRiskOpen(false);
                loadAll();
            }
        } catch (err) {
            toast.error("Failed to log risk");
        }
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
                <div className="h-96 bg-white rounded-xl border border-slate-200 p-6"></div>
                <div className="h-96 bg-white rounded-xl border border-slate-200 p-6"></div>
            </div>
        );
    }

    const risks = risksData.risks || [];
    const matrix = risksData.matrix || {};

    const getCellColor = (prob, imp) => {
        const score = prob * imp;
        if (score >= 16) return "bg-red-500/20 border-red-400 text-red-900";
        if (score >= 10) return "bg-amber-500/20 border-amber-400 text-amber-900";
        if (score >= 5) return "bg-yellow-400/20 border-yellow-300 text-yellow-900";
        return "bg-emerald-400/20 border-emerald-300 text-emerald-900";
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* ─── LEFT: Milestones & Checkpoints (5 cols) ───────────────── */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                            <h3 className="text-sm font-bold text-[#17212F] flex items-center gap-2">
                                <i className="fa-solid fa-flag-checkered text-[#2878C7]"></i>
                                <span>Milestones & Gates</span>
                            </h3>
                            <p className="text-[11px] text-[#5B6573]">Key checkpoints for stage releases</p>
                        </div>
                        <button
                            onClick={() => setCreateMilestoneOpen(true)}
                            className="px-2.5 py-1 text-xs font-bold text-[#17365D] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 cursor-pointer"
                        >
                            + Add Gate
                        </button>
                    </div>

                    {milestones.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[#5B6573]">
                            No milestones defined. Add major stage checkpoints to keep the team aligned.
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {milestones.map((m) => {
                                const isDone = m.status === "achieved";
                                return (
                                    <div
                                        key={m.id}
                                        className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                                            isDone ? "bg-emerald-50/40 border-emerald-200" : "bg-[#F8FAFC] border-slate-200"
                                        }`}
                                    >
                                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                            <button
                                                onClick={() => handleToggleMilestone(m)}
                                                className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center text-xs cursor-pointer transition-colors ${
                                                    isDone
                                                        ? "bg-emerald-500 border-emerald-600 text-white"
                                                        : "bg-white border-slate-300 text-transparent hover:border-slate-400"
                                                }`}
                                            >
                                                <i className="fa-solid fa-check"></i>
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <h4 className={`text-xs font-bold leading-snug truncate ${isDone ? "line-through text-slate-500" : "text-[#17212F]"}`}>
                                                    {m.title}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                                                    <span>
                                                        <i className="fa-regular fa-calendar mr-1"></i>
                                                        {new Date(m.due_date).toLocaleDateString()}
                                                    </span>
                                                    {m.phase_name && (
                                                        <span className="bg-slate-200/80 px-1.5 py-0.2 rounded text-[10px] font-semibold text-slate-700">
                                                            {m.phase_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize shrink-0 ${
                                            isDone ? "bg-emerald-100 text-emerald-800 border-emerald-300" : "bg-slate-200 text-slate-700 border-slate-300"
                                        }`}>
                                            {m.status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ─── RIGHT: Interactive 5x5 Risk Matrix & Heatmap (7 cols) ───── */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div>
                            <h3 className="text-sm font-bold text-[#17212F] flex items-center gap-2">
                                <i className="fa-solid fa-shield-halved text-amber-500"></i>
                                <span>Risk Matrix (5 &times; 5 Probability vs Impact)</span>
                            </h3>
                            <p className="text-[11px] text-[#5B6573]">Quantitative threat severity assessment</p>
                        </div>
                        <button
                            onClick={() => setCreateRiskOpen(true)}
                            className="px-2.5 py-1 text-xs font-bold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg shadow-sm cursor-pointer"
                        >
                            + Log Risk
                        </button>
                    </div>

                    {/* 5x5 Matrix Canvas */}
                    <div className="overflow-x-auto">
                        <div className="min-w-[420px] space-y-2">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1 pb-1">
                                <span className="flex items-center gap-1.5 text-[#17365D]">
                                    <i className="fa-solid fa-arrow-down text-[10px]"></i>
                                    <span>PROBABILITY (5 &rarr; 1)</span>
                                </span>
                                <span className="flex items-center gap-1.5 text-[#17365D]">
                                    <span>IMPACT (1 &rarr; 5)</span>
                                    <i className="fa-solid fa-arrow-right text-[10px]"></i>
                                </span>
                            </div>

                            <div className="grid grid-cols-5 gap-1.5">
                                {[5, 4, 3, 2, 1].map((p) => (
                                    <React.Fragment key={p}>
                                        {[1, 2, 3, 4, 5].map((i) => {
                                            const cellRisks = (matrix[p] && matrix[p][i]) || [];
                                            const score = p * i;
                                            return (
                                                <div
                                                    key={`${p}-${i}`}
                                                    className={`h-12 rounded-lg border p-1 text-[10px] font-bold flex flex-col justify-between transition-all ${getCellColor(p, i)}`}
                                                    title={`Probability: ${p}, Impact: ${i} (Severity: ${score})`}
                                                >
                                                    <span className="opacity-60">{score}</span>
                                                    {cellRisks.length > 0 && (
                                                        <div className="flex items-center gap-1 self-end bg-slate-900/80 text-white px-1.5 py-0.5 rounded-full text-[9px] font-black">
                                                            <i className="fa-solid fa-triangle-exclamation"></i>
                                                            <span>{cellRisks.length}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Risk Register Table */}
                    <div className="pt-2">
                        <h4 className="text-xs font-bold text-[#17212F] uppercase tracking-wider mb-2">Active Risk Register</h4>
                        {risks.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No risks logged yet.</p>
                        ) : (
                            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-[#F8FAFC] border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500">
                                        <tr>
                                            <th className="p-2.5">Risk Description</th>
                                            <th className="p-2.5">Severity</th>
                                            <th className="p-2.5">Category</th>
                                            <th className="p-2.5">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {risks.map((r) => (
                                            <tr key={r.id} className="hover:bg-slate-50">
                                                <td className="p-2.5">
                                                    <div className="font-bold text-[#17212F]">{r.title}</div>
                                                    {r.mitigation_plan && (
                                                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                                            <span className="font-semibold text-slate-700">Mitigation:</span> {r.mitigation_plan}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-2.5">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        r.severity_score >= 16 ? "bg-red-100 text-red-800" :
                                                        r.severity_score >= 10 ? "bg-amber-100 text-amber-800" :
                                                        "bg-emerald-100 text-emerald-800"
                                                    }`}>
                                                        {r.severity_score} ({r.probability}&times;{r.impact})
                                                    </span>
                                                </td>
                                                <td className="p-2.5 text-slate-600 capitalize">{r.category}</td>
                                                <td className="p-2.5">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 capitalize">
                                                        {r.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create Milestone Modal */}
            {createMilestoneOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-[#17212F]">Add Stage Milestone</h3>
                            <button onClick={() => setCreateMilestoneOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <form onSubmit={handleCreateMilestone} className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">Milestone Title *</label>
                                <input
                                    type="text"
                                    value={milestoneTitle}
                                    onChange={(e) => setMilestoneTitle(e.target.value)}
                                    placeholder="e.g. Architecture Sign-Off"
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">Target Due Date *</label>
                                <input
                                    type="date"
                                    value={milestoneDate}
                                    onChange={(e) => setMilestoneDate(e.target.value)}
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300"
                                    required
                                />
                            </div>
                            {phases.length > 0 && (
                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">Associated Phase</label>
                                    <select
                                        value={milestonePhaseId}
                                        onChange={(e) => setMilestonePhaseId(e.target.value)}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300"
                                    >
                                        <option value="">None (Project-level)</option>
                                        {phases.map((p) => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                <button type="button" onClick={() => setCreateMilestoneOpen(false)} className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-1.5 text-xs font-bold text-white bg-[#17365D] rounded-lg">Save Milestone</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Create Risk Modal */}
            {createRiskOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-[#17212F]">Log Initiative Risk</h3>
                            <button onClick={() => setCreateRiskOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <form onSubmit={handleCreateRisk} className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">Threat Title *</label>
                                <input
                                    type="text"
                                    value={riskTitle}
                                    onChange={(e) => setRiskTitle(e.target.value)}
                                    placeholder="e.g. Third-party vendor API rate limits"
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">Probability (1-5)</label>
                                    <select
                                        value={riskProbability}
                                        onChange={(e) => setRiskProbability(e.target.value)}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300"
                                    >
                                        <option value="1">1 - Rare</option>
                                        <option value="2">2 - Unlikely</option>
                                        <option value="3">3 - Moderate</option>
                                        <option value="4">4 - Likely</option>
                                        <option value="5">5 - Almost Certain</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">Impact (1-5)</label>
                                    <select
                                        value={riskImpact}
                                        onChange={(e) => setRiskImpact(e.target.value)}
                                        className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300"
                                    >
                                        <option value="1">1 - Negligible</option>
                                        <option value="2">2 - Minor</option>
                                        <option value="3">3 - Moderate</option>
                                        <option value="4">4 - Major</option>
                                        <option value="5">5 - Catastrophic</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">Category</label>
                                <select
                                    value={riskCategory}
                                    onChange={(e) => setRiskCategory(e.target.value)}
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 capitalize"
                                >
                                    <option value="technical">Technical</option>
                                    <option value="financial">Financial</option>
                                    <option value="schedule">Schedule</option>
                                    <option value="resource">Resource</option>
                                    <option value="operational">Operational</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">Mitigation Plan</label>
                                <textarea
                                    value={mitigationPlan}
                                    onChange={(e) => setMitigationPlan(e.target.value)}
                                    rows={2}
                                    placeholder="Preventative actions and fallback strategy..."
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300"
                                />
                            </div>
                            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                <button type="button" onClick={() => setCreateRiskOpen(false)} className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-4 py-1.5 text-xs font-bold text-white bg-[#17365D] rounded-lg">Save Risk</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
