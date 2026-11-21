import React from "react";

export function TaskStatusBadge({ status, className = "" }) {
    const config = {
        backlog: { label: "Backlog", bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200", icon: "fa-regular fa-circle" },
        todo: { label: "To Do", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: "fa-solid fa-circle-dot" },
        in_progress: { label: "In Progress", bg: "bg-sky-50", text: "text-[#2878C7]", border: "border-sky-200", icon: "fa-solid fa-spinner fa-spin-pulse" },
        in_review: { label: "In Review", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "fa-solid fa-magnifying-glass" },
        done: { label: "Completed", bg: "bg-emerald-50", text: "text-[#10B981]", border: "border-emerald-200", icon: "fa-solid fa-circle-check" },
        cancelled: { label: "Cancelled", bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-300", icon: "fa-solid fa-ban" },
        blocked: { label: "Blocked", bg: "bg-red-50", text: "text-[#EF4444]", border: "border-red-200", icon: "fa-solid fa-hand" }
    };

    const s = config[status] || config.todo;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.border} ${className}`}>
            <i className={`${s.icon} text-[10px]`}></i>
            <span>{s.label}</span>
        </span>
    );
}

export function TaskPriorityBadge({ priority, className = "" }) {
    const config = {
        low: { label: "Low", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", icon: "fa-solid fa-arrow-down" },
        medium: { label: "Medium", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200", icon: "fa-solid fa-minus" },
        high: { label: "High", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-300", icon: "fa-solid fa-arrow-up" },
        urgent: { label: "Urgent", bg: "bg-red-50", text: "text-[#EF4444]", border: "border-red-300", icon: "fa-solid fa-angles-up" }
    };

    const p = config[priority] || config.medium;

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border ${p.bg} ${p.text} ${p.border} ${className}`}>
            <i className={`${p.icon} text-[10px]`}></i>
            <span>{p.label}</span>
        </span>
    );
}

export function BlockedWorkBadge({ blockers = [], className = "" }) {
    if (!blockers || blockers.length === 0) return null;

    const count = blockers.length;
    const first = blockers[0];

    return (
        <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-[#EF4444] text-xs font-semibold group relative cursor-help ${className}`}
            title={`Blocked by ${count} predecessor task(s): ${blockers.map(b => b.pred_code || b.task_code || b.title).join(", ")}`}
        >
            <i className="fa-solid fa-triangle-exclamation text-xs animate-bounce"></i>
            <span>Blocked by #{first.pred_code || first.task_code || first.predecessor_id}</span>
            {count > 1 && (
                <span className="ml-0.5 px-1 bg-red-200 text-red-800 rounded text-[10px]">
                    +{count - 1}
                </span>
            )}

            {/* Hover Tooltip */}
            <div className="absolute left-0 bottom-full mb-1.5 hidden group-hover:block z-50 w-64 p-2 bg-[#17212F] text-white text-[11px] rounded-lg shadow-xl pointer-events-none">
                <div className="font-bold border-b border-slate-700 pb-1 mb-1 text-red-300 flex items-center justify-between">
                    <span>Active Blocker Prerequisites</span>
                    <span>{count}</span>
                </div>
                <div className="space-y-1">
                    {blockers.map((b, idx) => (
                        <div key={idx} className="truncate">
                            <span className="font-semibold text-slate-300">#{b.pred_code || b.task_code}:</span> {b.pred_title || b.title}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function TaskLabelChip({ name, color = "#2878C7" }) {
    return (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border"
            style={{
                backgroundColor: `${color}15`,
                borderColor: `${color}40`,
                color: color
            }}
        >
            #{name}
        </span>
    );
}

export function AssigneeAvatarGroup({ assignees = [], max = 3 }) {
    if (!assignees || assignees.length === 0) {
        return (
            <span className="text-xs text-slate-400 italic">Unassigned</span>
        );
    }

    const visible = assignees.slice(0, max);
    const extra = assignees.length - max;

    return (
        <div className="flex items-center -space-x-1.5 overflow-hidden">
            {visible.map((a, i) => (
                <div
                    key={i}
                    className="w-6 h-6 rounded-full bg-[#17365D] text-white flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-xs"
                    title={a.name || a.username || "Assignee"}
                >
                    {(a.name || a.username || "U")[0].toUpperCase()}
                </div>
            ))}
            {extra > 0 && (
                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold border-2 border-white">
                    +{extra}
                </div>
            )}
        </div>
    );
}
