import React, { useState } from "react";
import toast from "react-hot-toast";
import { TaskPriorityBadge, BlockedWorkBadge, AssigneeAvatarGroup, TaskLabelChip } from "./TaskBadges";

const COLUMNS = [
    { key: "backlog", label: "Backlog", bg: "bg-slate-100/60", border: "border-slate-200" },
    { key: "todo", label: "To Do", bg: "bg-blue-50/40", border: "border-blue-200" },
    { key: "in_progress", label: "In Progress", bg: "bg-sky-50/50", border: "border-sky-200" },
    { key: "in_review", label: "In Review", bg: "bg-amber-50/40", border: "border-amber-200" },
    { key: "done", label: "Done", bg: "bg-emerald-50/40", border: "border-emerald-200" }
];

export default function TaskKanbanView({
    tasks = [],
    onOpenDetail,
    onStatusChange,
    onOpenCreate
}) {
    const [draggingTaskId, setDraggingTaskId] = useState(null);

    const handleDragStart = (e, taskId) => {
        setDraggingTaskId(taskId);
        e.dataTransfer.setData("text/plain", String(taskId));
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e, targetStatus) => {
        e.preventDefault();
        const taskIdStr = e.dataTransfer.getData("text/plain");
        const taskId = Number(taskIdStr) || draggingTaskId;
        setDraggingTaskId(null);

        if (!taskId) return;

        const targetTask = tasks.find((t) => t.id === taskId);
        if (!targetTask) return;

        if (targetTask.status === targetStatus) return;

        // Check if moving to 'done' while actively blocked
        if (targetStatus === "done" && targetTask.is_blocked) {
            toast.error(`Cannot move to Done: Blocked by unfinished predecessor!`, { icon: "⛔" });
            return;
        }

        onStatusChange(taskId, targetStatus);
    };

    return (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4 select-none" data-testid="TASK-02-kanban">
            {COLUMNS.map((col) => {
                const colTasks = tasks.filter((t) => (t.status || "todo") === col.key);
                const totalHours = colTasks.reduce((acc, t) => acc + (parseFloat(t.estimated_hours) || 0), 0);

                return (
                    <div
                        key={col.key}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, col.key)}
                        className={`flex flex-col w-80 shrink-0 rounded-xl border ${col.border} ${col.bg} p-3 shadow-2xs max-h-[calc(100vh-220px)]`}
                    >
                        {/* Column Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3 px-1">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-[#17212F] uppercase tracking-wider">
                                    {col.label}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-white text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs">
                                    {colTasks.length}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#5B6573]">
                                <span>{totalHours}h</span>
                                {onOpenCreate && (
                                    <button
                                        onClick={onOpenCreate}
                                        className="w-5 h-5 rounded hover:bg-white text-slate-500 hover:text-[#17365D] flex items-center justify-center cursor-pointer ml-1"
                                        title={`Add task to ${col.label}`}
                                    >
                                        <i className="fa-solid fa-plus text-[10px]"></i>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Cards Stream */}
                        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                            {colTasks.length === 0 ? (
                                <div className="h-28 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center text-xs text-slate-400">
                                    Drop task here
                                </div>
                            ) : (
                                colTasks.map((t) => {
                                    const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== "done";

                                    return (
                                        <div
                                            key={t.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, t.id)}
                                            onClick={() => onOpenDetail(t.id)}
                                            className={`p-3.5 rounded-xl bg-white border border-slate-200 hover:border-[#2878C7] hover:shadow-md transition-all cursor-grab active:cursor-grabbing space-y-2.5 ${
                                                t.is_blocked ? "border-l-4 border-l-[#EF4444]" : ""
                                            }`}
                                        >
                                            {/* Top Row */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-mono text-[11px] font-bold text-[#17365D]">
                                                        #{t.task_code}
                                                    </span>
                                                    {t.project_code && (
                                                        <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[80px]">
                                                            {t.project_code}
                                                        </span>
                                                    )}
                                                </div>
                                                <TaskPriorityBadge priority={t.priority} />
                                            </div>

                                            {/* Title */}
                                            <h4 className="text-xs font-bold text-[#17212F] leading-snug line-clamp-2">
                                                {t.title}
                                            </h4>

                                            {/* Blocked Alert Banner if blocked */}
                                            {t.is_blocked && (
                                                <BlockedWorkBadge blockers={t.active_blockers} />
                                            )}

                                            {/* Labels */}
                                            {t.labels?.length > 0 && (
                                                <div className="flex flex-wrap gap-1">
                                                    {t.labels.slice(0, 2).map((l) => (
                                                        <TaskLabelChip key={l.id} name={l.name} color={l.color} />
                                                    ))}
                                                    {t.labels.length > 2 && (
                                                        <span className="text-[10px] text-slate-400">+{t.labels.length - 2}</span>
                                                    )}
                                                </div>
                                            )}

                                            {/* Bottom Meta */}
                                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    {t.checklist_total > 0 && (
                                                        <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                                                            <i className="fa-regular fa-square-check text-[10px]"></i>
                                                            {t.checklist_completed}/{t.checklist_total}
                                                        </span>
                                                    )}
                                                    {t.due_date && (
                                                        <span className={`inline-flex items-center gap-1 ${isOverdue ? "text-red-600 font-bold" : "text-slate-500"}`}>
                                                            <i className="fa-regular fa-calendar text-[10px]"></i>
                                                            {new Date(t.due_date).toLocaleDateString([], { month: "short", day: "numeric" })}
                                                        </span>
                                                    )}
                                                </div>
                                                <AssigneeAvatarGroup assignees={t.assignees} max={2} />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
