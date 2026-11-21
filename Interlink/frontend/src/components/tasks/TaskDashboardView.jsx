import React from "react";
import { TaskStatusBadge, TaskPriorityBadge, BlockedWorkBadge } from "./TaskBadges";

export default function TaskDashboardView({
    dashboardData,
    onOpenDetail,
    onOpenCreate
}) {
    const metrics = dashboardData?.metrics || {};
    const priorities = dashboardData?.priorities || [];
    const statuses = dashboardData?.statuses || [];
    const workload = dashboardData?.workload || [];
    const blockedStream = dashboardData?.blocked_stream || [];

    const totalTasks = parseInt(metrics.total) || 0;

    return (
        <div className="space-y-6 overflow-y-auto pb-6" data-testid="TASK-01-dashboard">
            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Overdue */}
                <div className="bg-white p-5 rounded-xl border border-red-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Overdue Tasks
                        </span>
                        <span className="text-2xl font-extrabold text-[#EF4444]">
                            {metrics.overdue_count || 0}
                        </span>
                        <span className="text-[11px] text-red-500 block mt-1">Requires immediate attention</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-red-50 text-[#EF4444] flex items-center justify-center text-xl">
                        <i className="fa-solid fa-clock-rotate-left"></i>
                    </div>
                </div>

                {/* Due Today */}
                <div className="bg-white p-5 rounded-xl border border-amber-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Due Today
                        </span>
                        <span className="text-2xl font-extrabold text-[#F59E0B]">
                            {metrics.due_today_count || 0}
                        </span>
                        <span className="text-[11px] text-amber-600 block mt-1">Scheduled for delivery</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-amber-50 text-[#F59E0B] flex items-center justify-center text-xl">
                        <i className="fa-regular fa-calendar-check"></i>
                    </div>
                </div>

                {/* In Progress */}
                <div className="bg-white p-5 rounded-xl border border-blue-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            In Progress
                        </span>
                        <span className="text-2xl font-extrabold text-[#2878C7]">
                            {metrics.in_progress_count || 0}
                        </span>
                        <span className="text-[11px] text-blue-600 block mt-1">Actively executing</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2878C7] flex items-center justify-center text-xl">
                        <i className="fa-solid fa-spinner"></i>
                    </div>
                </div>

                {/* Completed This Week */}
                <div className="bg-white p-5 rounded-xl border border-emerald-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Completed This Week
                        </span>
                        <span className="text-2xl font-extrabold text-[#10B981]">
                            {metrics.completed_this_week || 0}
                        </span>
                        <span className="text-[11px] text-emerald-600 block mt-1">Delivered milestone tasks</span>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#10B981] flex items-center justify-center text-xl">
                        <i className="fa-solid fa-circle-check"></i>
                    </div>
                </div>
            </div>

            {/* Distribution Charts & Visuals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Priority Breakdown */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-bold text-[#17212F] uppercase tracking-wider">
                            Task Priority Distribution
                        </h3>
                        <span className="text-xs text-slate-400 font-semibold">{totalTasks} Total Tasks</span>
                    </div>

                    <div className="space-y-3">
                        {["urgent", "high", "medium", "low"].map((pLevel) => {
                            const found = priorities.find((p) => p.priority === pLevel);
                            const count = found ? parseInt(found.count) : 0;
                            const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;

                            const colors = {
                                urgent: "bg-[#EF4444]",
                                high: "bg-[#F59E0B]",
                                medium: "bg-[#2878C7]",
                                low: "bg-slate-400"
                            };

                            return (
                                <div key={pLevel} className="space-y-1">
                                    <div className="flex items-center justify-between text-xs font-semibold">
                                        <span className="capitalize text-slate-700">{pLevel} Priority</span>
                                        <span className="text-slate-500 font-mono">{count} ({pct}%)</span>
                                    </div>
                                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full ${colors[pLevel]} transition-all duration-300`}
                                            style={{ width: `${pct}%` }}
                                        ></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Status Breakdown */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-bold text-[#17212F] uppercase tracking-wider">
                            Workflow Status Breakdown
                        </h3>
                        <span className="text-xs text-slate-400 font-semibold">Pipeline Health</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {["backlog", "todo", "in_progress", "in_review", "done", "blocked"].map((st) => {
                            const found = statuses.find((s) => s.status === st);
                            const count = found ? parseInt(found.count) : 0;

                            return (
                                <div key={st} className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 flex flex-col justify-between">
                                    <TaskStatusBadge status={st} className="self-start mb-2" />
                                    <span className="text-xl font-bold text-[#17212F] font-mono">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Critical Path & Blocked Stream Banner */}
            {blockedStream.length > 0 && (
                <div className="bg-white p-5 rounded-xl border-2 border-red-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-red-100 text-[#EF4444] flex items-center justify-center text-xs">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                            </span>
                            <h3 className="text-xs font-bold text-[#EF4444] uppercase tracking-wider">
                                Blocked Work Alerts ({blockedStream.length})
                            </h3>
                        </div>
                        <span className="text-[11px] text-slate-500">Unresolved predecessor bottlenecks</span>
                    </div>

                    <div className="space-y-2">
                        {blockedStream.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => onOpenDetail(item.id)}
                                className="flex items-center justify-between p-3 rounded-lg bg-red-50/50 hover:bg-red-50 border border-red-100 transition-colors cursor-pointer text-xs"
                            >
                                <div className="flex items-center gap-3 truncate">
                                    <span className="font-mono font-bold text-[#17365D]">#{item.task_code}</span>
                                    <span className="font-semibold text-slate-800 truncate">{item.title}</span>
                                    <span className="text-red-600 text-[11px]">
                                        Blocked by #{item.blocker_code} ("{item.blocker_title}")
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <TaskPriorityBadge priority={item.priority} />
                                    <span className="text-xs text-[#2878C7] hover:underline font-semibold">
                                        Inspect
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Team Workload & Allocation Heatmap */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-blue-50 text-[#2878C7] flex items-center justify-center text-xs">
                            <i className="fa-solid fa-users"></i>
                        </span>
                        <h3 className="text-xs font-bold text-[#17212F] uppercase tracking-wider">
                            Team Workload & Capacity Heatmap
                        </h3>
                    </div>
                    <span className="text-xs text-slate-400">Hours allocation per member</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#17365D] text-white">
                            <tr>
                                <th className="py-2.5 px-4 font-semibold uppercase tracking-wider">Team Member</th>
                                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider text-center">Active Tasks</th>
                                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Estimated Load</th>
                                <th className="py-2.5 px-3 font-semibold uppercase tracking-wider">Actual Logged</th>
                                <th className="py-2.5 px-4 font-semibold uppercase tracking-wider">Workload Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                            {workload.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                                        No team workload data available.
                                    </td>
                                </tr>
                            ) : (
                                workload.map((member) => {
                                    const est = parseFloat(member.total_estimated_hours) || 0;
                                    const logged = parseFloat(member.total_logged_hours) || 0;

                                    let loadBadge = { label: "Balanced", bg: "bg-emerald-50 text-emerald-700 border-emerald-200" };
                                    if (est > 40) loadBadge = { label: "Overloaded (>40h)", bg: "bg-red-50 text-red-700 border-red-200" };
                                    else if (est < 10) loadBadge = { label: "Light (<10h)", bg: "bg-slate-50 text-slate-600 border-slate-200" };

                                    return (
                                        <tr key={member.user_id} className="hover:bg-slate-50/70 transition-colors">
                                            <td className="py-3 px-4 flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-[#17365D] text-white flex items-center justify-center font-bold text-xs">
                                                    {(member.name || "U")[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-[#17212F] block">{member.name}</span>
                                                    <span className="text-[10px] text-slate-400">{member.email}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-3 text-center font-bold text-slate-700">
                                                {member.active_tasks}
                                            </td>
                                            <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                                                {est} hrs
                                            </td>
                                            <td className="py-3 px-3 font-mono text-[#10B981] font-semibold">
                                                {logged} hrs
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold border ${loadBadge.bg}`}>
                                                    {loadBadge.label}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
