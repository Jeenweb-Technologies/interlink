import React, { useState, useMemo, useRef, useEffect } from "react";
import DataTable from "../DataTable";
import {
    TaskStatusBadge,
    TaskPriorityBadge,
    BlockedWorkBadge,
    AssigneeAvatarGroup,
    TaskLabelChip
} from "./TaskBadges";

export default function TaskListView({
    tasks = [],
    selectedTaskIds = [],
    onToggleSelectTask,
    onSelectAll,
    onOpenDetail,
    onBulkAction,
    onOpenCreate = () => {}
}) {
    // "View By" state (renamed from group by, icon removed)
    const [viewBy, setViewBy] = useState("none"); // 'none' | 'status' | 'priority' | 'project'
    const [viewByOpen, setViewByOpen] = useState(false);
    const viewByRef = useRef(null);

    // Bulk state
    const [bulkStatus, setBulkStatus] = useState("");
    const [bulkPriority, setBulkPriority] = useState("");

    const allSelected = tasks.length > 0 && selectedTaskIds.length === tasks.length;

    // Close "View By" dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (viewByRef.current && !viewByRef.current.contains(event.target)) {
                setViewByOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Process tasks based on "View By" option
    const processedTasks = useMemo(() => {
        if (viewBy === "none") return tasks;
        const copy = [...tasks];
        if (viewBy === "status") {
            const statusOrder = { backlog: 0, todo: 1, in_progress: 2, in_review: 3, done: 4, blocked: 5, cancelled: 6 };
            copy.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));
        } else if (viewBy === "priority") {
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
            copy.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));
        } else if (viewBy === "project") {
            copy.sort((a, b) => (a.project_code || "").localeCompare(b.project_code || ""));
        }
        return copy;
    }, [tasks, viewBy]);

    // DataTable columns definition
    const columns = useMemo(() => [
        {
            key: "select",
            label: (
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onSelectAll}
                    className="rounded border-white/20 text-[#2878C7] focus:ring-0 cursor-pointer"
                    title="Select All"
                />
            ),
            sortable: false,
            minWidth: "45px",
            render: (row) => (
                <input
                    type="checkbox"
                    checked={selectedTaskIds.includes(row.id)}
                    onChange={(e) => {
                        e.stopPropagation();
                        onToggleSelectTask(row.id);
                    }}
                    className="rounded border-slate-300 text-[#2878C7] focus:ring-[#2878C7] cursor-pointer"
                />
            )
        },
        {
            key: "task_code",
            label: "ID",
            minWidth: "90px",
            render: (row) => (
                <span className="font-mono text-[#17365D] font-bold text-xs">
                    #{row.task_code}
                </span>
            )
        },
        {
            key: "title",
            label: "Title & Blockers",
            minWidth: "260px",
            render: (row) => (
                <div
                    className="flex flex-col gap-1 py-1 cursor-pointer group"
                    onClick={() => onOpenDetail(row.id)}
                >
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-[#17212F] group-hover:text-[#2878C7] transition-colors line-clamp-1">
                            {row.title}
                        </span>
                        {row.is_blocked && (
                            <BlockedWorkBadge blockers={row.active_blockers} />
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {row.checklist_total > 0 && (
                            <span className="inline-flex items-center gap-1">
                                <i className="fa-regular fa-square-check"></i>
                                {row.checklist_completed}/{row.checklist_total}
                            </span>
                        )}
                        {row.comment_count > 0 && (
                            <span className="inline-flex items-center gap-1">
                                <i className="fa-regular fa-comment"></i>
                                {row.comment_count}
                            </span>
                        )}
                        {row.labels?.map((l) => (
                            <TaskLabelChip key={l.id} name={l.name} color={l.color} />
                        ))}
                    </div>
                </div>
            )
        },
        {
            key: "project_code",
            label: "Project",
            minWidth: "110px",
            render: (row) => (
                <span className="text-slate-600 font-medium text-xs">
                    {row.project_code || "—"}
                </span>
            )
        },
        {
            key: "status",
            label: "Status",
            minWidth: "110px",
            render: (row) => <TaskStatusBadge status={row.status} />
        },
        {
            key: "priority",
            label: "Priority",
            minWidth: "100px",
            render: (row) => <TaskPriorityBadge priority={row.priority} />
        },
        {
            key: "assignees",
            label: "Assignees",
            sortable: false,
            minWidth: "100px",
            render: (row) => <AssigneeAvatarGroup assignees={row.assignees} max={3} />
        },
        {
            key: "due_date",
            label: "Due Date",
            minWidth: "105px",
            render: (row) => {
                const isOverdue = row.due_date && new Date(row.due_date) < new Date() && row.status !== "done";
                return (
                    <span className={`text-xs ${isOverdue ? "text-red-600 font-bold" : "text-slate-600"}`}>
                        {row.due_date ? new Date(row.due_date).toLocaleDateString() : "—"}
                    </span>
                );
            }
        },
        {
            key: "actual_hours",
            label: "Logged / Est",
            minWidth: "105px",
            render: (row) => (
                <span className="font-mono text-xs">
                    <strong className="text-[#10B981]">{row.actual_hours || 0}h</strong>
                    <span className="text-slate-400"> / {row.estimated_hours || 0}h</span>
                </span>
            )
        },
        {
            key: "actions",
            label: "Action",
            sortable: false,
            minWidth: "75px",
            render: (row) => (
                <button
                    onClick={() => onOpenDetail(row.id)}
                    className="px-2.5 py-1 text-xs font-semibold text-[#17365D] bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                >
                    View
                </button>
            )
        }
    ], [allSelected, selectedTaskIds, onSelectAll, onToggleSelectTask, onOpenDetail]);

    // Custom Title: Decreased icon size, Increased font size, Total active badge REMOVED
    const customTitle = (
        <span className="inline-flex items-center gap-2.5 select-none">
            <span className="w-8 h-8 rounded-md bg-[#17365D] text-white inline-flex items-center justify-center text-[16px] shadow-2xs shrink-0">
                <i className="fa-solid fa-list-check"></i>
            </span>
            <span className="text-2xl font-bold text-[#17365D] tracking-tight">
                Task Management
            </span>
        </span>
    );

    // Renamed "View By" button without icon, placed under toggleActions
    const viewByDropdown = (
        <div className="relative" ref={viewByRef}>
            <button
                type="button"
                onClick={() => setViewByOpen(!viewByOpen)}
                className={`h-10 px-3 border rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                    viewBy !== "none" || viewByOpen
                        ? "border-[#2878C7] bg-blue-50/80 text-[#2878C7]"
                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                }`}
            >
                <span>View By{viewBy !== "none" ? `: ${viewBy.charAt(0).toUpperCase() + viewBy.slice(1)}` : ""}</span>
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {/* View By Popover Menu */}
            {viewByOpen && (
                <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in duration-150">
                    <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        View By
                    </div>
                    {[
                        { key: "none", label: "None (Default)" },
                        { key: "status", label: "Status" },
                        { key: "priority", label: "Priority" },
                        { key: "project", label: "Project" }
                    ].map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => {
                                setViewBy(item.key);
                                setViewByOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left hover:bg-slate-50 cursor-pointer ${
                                viewBy === item.key ? "text-[#2878C7] font-bold bg-blue-50/50" : "text-slate-700"
                            }`}
                        >
                            <span>{item.label}</span>
                            {viewBy === item.key && (
                                <i className="fa-solid fa-check text-xs text-[#2878C7]"></i>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    // Far right '+' button only
    const createButton = (
        <button
            type="button"
            onClick={onOpenCreate}
            className="h-10 w-10 rounded-lg bg-[#17365D] hover:bg-[#102642] text-white flex items-center justify-center text-lg shadow-sm transition-all cursor-pointer shrink-0"
            title="Create New Task"
        >
            <i className="fa-solid fa-plus"></i>
        </button>
    );

    return (
        <div className="relative flex flex-col w-full" data-testid="TASK-02-list">
            <DataTable
                tableId="tasks_management_table"
                title={customTitle}
                data={processedTasks}
                columns={columns}
                searchPlaceholder="Search title or ID..."
                toggleActions={viewByDropdown}
                actionButton={createButton}
            />

            {/* Floating Bulk Edit Bar when tasks are checked */}
            {selectedTaskIds.length > 0 && (
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-[#17365D] text-white px-5 py-3 rounded-xl shadow-2xl border border-white/10 flex items-center gap-4 animate-in fade-in duration-200">
                    <span className="text-xs font-bold text-sky-300">
                        {selectedTaskIds.length} Task{selectedTaskIds.length > 1 ? "s" : ""} Selected
                    </span>

                    <div className="h-4 w-px bg-white/20"></div>

                    {/* Bulk Status */}
                    <div className="flex items-center gap-1.5">
                        <select
                            value={bulkStatus}
                            onChange={(e) => setBulkStatus(e.target.value)}
                            className="bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/20 focus:outline-hidden cursor-pointer"
                        >
                            <option value="" className="text-slate-900">Change Status...</option>
                            <option value="todo" className="text-slate-900">To Do</option>
                            <option value="in_progress" className="text-slate-900">In Progress</option>
                            <option value="in_review" className="text-slate-900">In Review</option>
                            <option value="done" className="text-slate-900">Done</option>
                        </select>
                        {bulkStatus && (
                            <button
                                onClick={() => {
                                    onBulkAction("status", bulkStatus);
                                    setBulkStatus("");
                                }}
                                className="px-2 py-1 bg-[#2878C7] hover:bg-blue-600 text-white rounded text-xs font-semibold cursor-pointer"
                            >
                                Apply
                            </button>
                        )}
                    </div>

                    {/* Bulk Priority */}
                    <div className="flex items-center gap-1.5">
                        <select
                            value={bulkPriority}
                            onChange={(e) => setBulkPriority(e.target.value)}
                            className="bg-white/10 text-white text-xs px-2 py-1 rounded border border-white/20 focus:outline-hidden cursor-pointer"
                        >
                            <option value="" className="text-slate-900">Change Priority...</option>
                            <option value="low" className="text-slate-900">Low</option>
                            <option value="medium" className="text-slate-900">Medium</option>
                            <option value="high" className="text-slate-900">High</option>
                            <option value="urgent" className="text-slate-900">Urgent</option>
                        </select>
                        {bulkPriority && (
                            <button
                                onClick={() => {
                                    onBulkAction("priority", bulkPriority);
                                    setBulkPriority("");
                                }}
                                className="px-2 py-1 bg-[#2878C7] hover:bg-blue-600 text-white rounded text-xs font-semibold cursor-pointer"
                            >
                                Apply
                            </button>
                        )}
                    </div>

                    {/* Bulk Delete */}
                    <button
                        onClick={() => {
                            if (window.confirm(`Delete ${selectedTaskIds.length} tasks?`)) {
                                onBulkAction("delete", true);
                            }
                        }}
                        className="px-2.5 py-1 bg-red-600/80 hover:bg-red-600 text-white rounded text-xs font-semibold cursor-pointer"
                    >
                        <i className="fa-solid fa-trash-can mr-1"></i>
                        Delete
                    </button>
                </div>
            )}
        </div>
    );
}
