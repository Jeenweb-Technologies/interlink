import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getProjectWorkload } from "../../api/projectApi";

export default function ProjectWorkloadView({ projectId }) {
    const [workload, setWorkload] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadWorkload = async () => {
        try {
            setLoading(true);
            const res = await getProjectWorkload(projectId);
            if (res.data?.success) {
                setWorkload(res.data.data || []);
            }
        } catch (err) {
            console.error("Load workload error:", err);
            toast.error("Failed to load workload data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) loadWorkload();
    }, [projectId]);

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-4">
                <div className="h-6 w-48 bg-slate-200 rounded"></div>
                <div className="h-20 bg-slate-100 rounded-xl"></div>
                <div className="h-20 bg-slate-100 rounded-xl"></div>
            </div>
        );
    }

    const overAllocatedCount = workload.filter((w) => w.isOverAllocated).length;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <h3 className="text-base font-bold text-[#17212F]">Team Workload &amp; Resource Allocation</h3>
                    <p className="text-xs text-[#5B6573]">
                        Balance weekly capacity against estimated task hours to prevent team burnout
                    </p>
                </div>

                {overAllocatedCount > 0 && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-1.5 rounded-lg font-bold">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        <span>{overAllocatedCount} Member(s) Over-Allocated (&gt;100% Capacity)</span>
                    </div>
                )}
            </div>

            {workload.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                    <p className="text-xs text-[#5B6573]">No team members assigned to this project yet.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {workload.map((w) => {
                        const isOver = w.isOverAllocated;
                        const utilization = w.utilizationPercentage || 0;
                        return (
                            <div
                                key={w.user_id}
                                className={`bg-white rounded-xl border p-5 shadow-sm transition-all ${
                                    isOver ? "border-red-300 ring-1 ring-red-200" : "border-[#E2E8F0]"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#17365D] to-[#2878C7] text-white flex items-center justify-center font-bold text-sm">
                                            {w.name ? w.name[0].toUpperCase() : "U"}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-[#17212F]">{w.name}</h4>
                                            <p className="text-xs text-[#5B6573] capitalize">
                                                {w.role?.replace("_", " ")} &bull; {w.allocation_percentage}% assigned
                                            </p>
                                        </div>
                                    </div>

                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                            isOver
                                                ? "bg-red-50 text-red-700 border-red-200"
                                                : utilization >= 80
                                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        }`}
                                    >
                                        {utilization}% Capacity
                                    </span>
                                </div>

                                {/* Utilization Bar */}
                                <div className="space-y-1.5 mb-3">
                                    <div className="flex justify-between text-xs text-[#5B6573] font-medium">
                                        <span>Allocated Hours</span>
                                        <span>
                                            <strong className="text-[#17212F]">{w.total_estimated_hours}h</strong> / {w.weeklyCapacityHours}h week
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-300 ${
                                                isOver ? "bg-[#EF4444]" : utilization >= 80 ? "bg-[#F59E0B]" : "bg-[#10B981]"
                                            }`}
                                            style={{ width: `${Math.min(utilization, 100)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-[#5B6573]">
                                    <span>
                                        <i className="fa-solid fa-list-check mr-1.5 text-slate-400"></i>
                                        {w.assigned_tasks} Active Task(s)
                                    </span>
                                    <span>
                                        Actual Spent: <strong>{w.total_actual_hours}h</strong>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
