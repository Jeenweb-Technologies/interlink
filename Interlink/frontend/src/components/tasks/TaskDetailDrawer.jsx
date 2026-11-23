import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useTaskTimer } from "../../context/TaskTimerContext";
import {
    getTaskById,
    updateTask,
    deleteTask,
    addComment,
    addChecklistItem,
    toggleChecklistItem,
    logManualTime,
    deleteTimeEntry,
    addDependency,
    deleteDependency
} from "../../api/taskApi";
import { TaskStatusBadge, TaskPriorityBadge, BlockedWorkBadge, TaskLabelChip, AssigneeAvatarGroup } from "./TaskBadges";

export default function TaskDetailDrawer({
    taskId,
    isOpen,
    onClose,
    onUpdated,
    allTasks = []
}) {
    const [task, setTask] = useState(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("comments"); // 'comments' | 'activity' | 'time'

    // Form inputs
    const [commentText, setCommentText] = useState("");
    const [newChecklistText, setNewChecklistText] = useState("");

    // Manual time log inputs (exact work date and time interval)
    const [showManualLogger, setShowManualLogger] = useState(false);
    const [manualDate, setManualDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [manualStartTime, setManualStartTime] = useState("09:00");
    const [manualEndTime, setManualEndTime] = useState("10:00");

    // Live calculated duration for the manual interval
    const manualCalculatedMinutes = useMemo(() => {
        if (!manualDate || !manualStartTime || !manualEndTime) return 0;
        const start = new Date(`${manualDate}T${manualStartTime}`);
        const end = new Date(`${manualDate}T${manualEndTime}`);
        const diff = Math.round((end - start) / 60000);
        return diff > 0 ? diff : 0;
    }, [manualDate, manualStartTime, manualEndTime]);

    // Global Task Timer Context
    const {
        activeTimer,
        formattedTime,
        isPaused,
        start: startGlobalTimer,
        pause: pauseGlobalTimer,
        resume: resumeGlobalTimer,
        stopAndSave: stopGlobalTimer,
        setActiveDrawerTaskId
    } = useTaskTimer();

    // Dependency adder
    const [showDepPicker, setShowDepPicker] = useState(false);
    const [selectedPredId, setSelectedPredId] = useState("");

    const fetchDetail = async (id) => {
        try {
            setLoading(true);
            const res = await getTaskById(id);
            if (res.data?.success) {
                setTask(res.data.data);
            } else {
                toast.error(res.data?.message || "Task not found");
            }
        } catch (err) {
            console.error("Fetch task detail error:", err);
            toast.error(err.response?.data?.message || "Error loading task");
        } finally {
            setLoading(false);
        }
    };

    // Track active drawer task so floating pill can hide when drawer is open
    useEffect(() => {
        if (isOpen && taskId) {
            setActiveDrawerTaskId(taskId);
            fetchDetail(taskId);
        } else {
            setActiveDrawerTaskId(null);
            setTask(null);
        }
        return () => {
            setActiveDrawerTaskId(null);
        };
    }, [isOpen, taskId, setActiveDrawerTaskId]);

    if (!isOpen) return null;

    const handleStatusChange = async (newStatus) => {
        if (!task) return;

        // Blocker verification check
        if (newStatus === "done" && task.active_blockers && task.active_blockers.length > 0) {
            toast.error(`Cannot complete task: Blocked by ${task.active_blockers.length} incomplete predecessor task(s)!`, {
                duration: 5000,
                icon: "⛔"
            });
            return;
        }

        try {
            const res = await updateTask(task.id, { status: newStatus });
            if (res.data?.success) {
                toast.success(`Status updated to ${newStatus}`);
                fetchDetail(task.id);
                if (onUpdated) onUpdated();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to update status");
        }
    };

    const handleToggleChecklist = async (itemId, currentVal) => {
        try {
            await toggleChecklistItem(itemId, !currentVal);
            fetchDetail(task.id);
            if (onUpdated) onUpdated();
        } catch (err) {
            toast.error("Failed to update checklist item");
        }
    };

    const handleAddChecklist = async (e) => {
        e.preventDefault();
        if (!newChecklistText.trim()) return;
        try {
            await addChecklistItem(task.id, newChecklistText.trim());
            setNewChecklistText("");
            fetchDetail(task.id);
            if (onUpdated) onUpdated();
        } catch (err) {
            toast.error("Failed to add checklist item");
        }
    };

    const handleAddComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        try {
            await addComment(task.id, commentText.trim());
            setCommentText("");
            fetchDetail(task.id);
        } catch (err) {
            toast.error("Failed to post comment");
        }
    };

    const handleStartTimer = async () => {
        if (!task) return;
        await startGlobalTimer(task);
    };

    const handleStopTimer = async () => {
        if (!task) return;
        await stopGlobalTimer();
        fetchDetail(task.id);
        if (onUpdated) onUpdated();
    };

    const handleLogManualTime = async (e) => {
        e.preventDefault();
        if (!manualDate || !manualStartTime || !manualEndTime) {
            return toast.error("Please provide date, start time, and end time");
        }
        const startIso = `${manualDate}T${manualStartTime}:00`;
        const endIso = `${manualDate}T${manualEndTime}:00`;
        if (new Date(endIso) <= new Date(startIso)) {
            return toast.error("End time must be after start time");
        }

        try {
            const res = await logManualTime(task.id, {
                start_time: startIso,
                end_time: endIso
            });
            toast.success(res.data?.message || "Time entry logged successfully");
            setShowManualLogger(false);
            fetchDetail(task.id);
            if (onUpdated) onUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to log manual time");
        }
    };

    const handleDeleteTimeEntry = async (entryId) => {
        if (!window.confirm("Remove this logged time interval?")) return;
        try {
            await deleteTimeEntry(entryId);
            toast.success("Time entry deleted");
            fetchDetail(task.id);
            if (onUpdated) onUpdated();
        } catch (err) {
            toast.error("Failed to delete time entry");
        }
    };

    const handleAddDepLink = async () => {
        if (!selectedPredId) return;
        try {
            await addDependency({
                predecessor_id: Number(selectedPredId),
                successor_id: task.id,
                dependency_type: "FS",
                lag_days: 0
            });
            toast.success("Dependency linked successfully");
            setSelectedPredId("");
            setShowDepPicker(false);
            fetchDetail(task.id);
            if (onUpdated) onUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to link dependency");
        }
    };

    const handleDeleteDep = async (depId) => {
        if (!window.confirm("Remove this dependency link?")) return;
        try {
            await deleteDependency(depId);
            toast.success("Dependency removed");
            fetchDetail(task.id);
            if (onUpdated) onUpdated();
        } catch (err) {
            toast.error("Failed to delete dependency");
        }
    };

    const handleDeleteTask = async () => {
        if (!window.confirm(`Are you sure you want to delete ${task.task_code}?`)) return;
        try {
            await deleteTask(task.id);
            toast.success("Task deleted");
            onClose();
            if (onUpdated) onUpdated();
        } catch (err) {
            toast.error("Failed to delete task");
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity" data-testid="TASK-04-drawer">
            <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 border-l border-slate-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#17365D] text-white">
                    <div className="flex items-center gap-3">
                        <span className="px-2.5 py-1 rounded bg-white/10 text-sky-300 font-mono text-xs font-bold border border-white/10">
                            {task?.task_code || "TASK"}
                        </span>
                        <div>
                            <span className="text-xs text-slate-300">Screen ID: TASK-04 • Details & Execution</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleDeleteTask}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
                            title="Delete task"
                        >
                            <i className="fa-solid fa-trash-can text-sm"></i>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Close drawer"
                        >
                            <i className="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                </div>

                {loading || !task ? (
                    <div className="flex-1 p-6 space-y-4 animate-pulse">
                        <div className="h-8 w-2/3 bg-slate-200 rounded"></div>
                        <div className="h-24 bg-slate-100 rounded-xl"></div>
                        <div className="h-48 bg-slate-100 rounded-xl"></div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F6F8FB]">
                        {/* ⛔ BLOCKED WORK BANNER (CRITICAL ACCEPTANCE CRITERIA) */}
                        {task.is_blocked && (
                            <div className="p-4 rounded-xl bg-red-50 border-2 border-[#EF4444] text-[#17212F] shadow-xs">
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-red-100 text-[#EF4444] flex items-center justify-center text-lg shrink-0">
                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-bold text-[#EF4444] uppercase tracking-wide">
                                                Blocked Work Warning
                                            </h4>
                                            <span className="px-2 py-0.5 bg-red-200 text-red-900 rounded text-[10px] font-bold">
                                                Action Required
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-700 mt-1">
                                            This task cannot be marked completed because the following prerequisite predecessor task(s) are still incomplete:
                                        </p>
                                        <div className="mt-2.5 space-y-1.5">
                                            {task.active_blockers?.map((b) => (
                                                <div
                                                    key={b.id || b.dep_id}
                                                    className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-red-200 text-xs shadow-xs"
                                                >
                                                    <div className="flex items-center gap-2 truncate">
                                                        <span className="font-bold text-[#17365D]">#{b.task_code}:</span>
                                                        <span className="truncate">{b.title}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <TaskStatusBadge status={b.status} />
                                                        <button
                                                            onClick={() => fetchDetail(b.id)}
                                                            className="text-xs text-[#2878C7] hover:underline font-semibold cursor-pointer"
                                                        >
                                                            Open Blocker
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Title & Status Controls */}
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-[#5B6573] uppercase">Status:</span>
                                    <select
                                        value={task.status}
                                        onChange={(e) => handleStatusChange(e.target.value)}
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 text-[#17212F] focus:outline-hidden focus:border-[#2878C7] cursor-pointer"
                                    >
                                        <option value="todo">To Do</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="in_review">In Review</option>
                                        <option value="done">Completed</option>
                                        <option value="blocked">Blocked</option>
                                        <option value="backlog">Backlog</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <TaskPriorityBadge priority={task.priority} />
                                    {task.project_code && (
                                        <span
                                            className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 flex items-center gap-1.5"
                                            title={`${task.project_name || 'Project'} • Total Project Logged: ${task.project_total_logged_hours || 0} hrs`}
                                        >
                                            <i className="fa-solid fa-folder-tree text-slate-400"></i>
                                            <span>{task.project_code}</span>
                                            {task.project_total_logged_hours > 0 && (
                                                <span className="text-[10px] text-emerald-600 font-mono font-bold">
                                                    ({task.project_total_logged_hours}h)
                                                </span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <h1 className="text-xl font-bold text-[#17212F] leading-snug">
                                {task.title}
                            </h1>

                            {task.description && (
                                <div className="text-sm text-[#5B6573] leading-relaxed whitespace-pre-line bg-slate-50/70 p-3.5 rounded-lg border border-slate-200/80">
                                    {task.description}
                                </div>
                            )}

                            {/* Meta Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
                                <div>
                                    <span className="text-slate-400 block mb-0.5">Start Date</span>
                                    <span className="font-semibold text-slate-800">
                                        {task.start_date ? new Date(task.start_date).toLocaleDateString() : "—"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block mb-0.5">Due Date</span>
                                    <span className={`font-semibold ${new Date(task.due_date) < new Date() && task.status !== "done" ? "text-red-600 font-bold" : "text-slate-800"}`}>
                                        {task.due_date ? new Date(task.due_date).toLocaleDateString() : "—"}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block mb-0.5">Estimated</span>
                                    <span className="font-semibold text-slate-800">{task.estimated_hours || 0} hrs</span>
                                </div>
                                <div>
                                    <span className="text-slate-400 block mb-0.5">Logged Time</span>
                                    <span className="font-semibold text-[#10B981]">{task.actual_hours || 0} hrs</span>
                                </div>
                            </div>

                            {/* Assignees & Labels */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400">Assignees:</span>
                                    <AssigneeAvatarGroup assignees={task.assignees} max={5} />
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {task.labels?.map((l) => (
                                        <TaskLabelChip key={l.id} name={l.name} color={l.color} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Integrated Time Tracker Widget (TIME-01/02 Linkage) */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs">
                                        <i className="fa-solid fa-stopwatch"></i>
                                    </span>
                                    <h3 className="text-xs font-bold text-[#17212F] uppercase tracking-wider">
                                        Time Tracking & Timesheet
                                    </h3>
                                </div>
                                <span className="text-xs font-mono font-bold text-slate-700">
                                    {task.actual_hours || 0}h / {task.estimated_hours || 0}h
                                </span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[#10B981] transition-all duration-300"
                                    style={{
                                        width: `${Math.min(100, ((task.actual_hours || 0) / (task.estimated_hours || 1)) * 100)}%`
                                    }}
                                ></div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                {/* Live Stopwatch connected to Global Task Timer */}
                                <div className="flex items-center gap-2.5">
                                    {activeTimer?.taskId === task.id ? (
                                        <>
                                            <span className={`font-mono text-base font-bold ${isPaused ? "text-amber-500" : "text-emerald-600 animate-pulse"}`}>
                                                {formattedTime}
                                            </span>
                                            {isPaused ? (
                                                <button
                                                    type="button"
                                                    onClick={resumeGlobalTimer}
                                                    className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                                    title="Resume Timer"
                                                >
                                                    <i className="fa-solid fa-play text-[10px]"></i>
                                                    <span>Resume</span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={pauseGlobalTimer}
                                                    className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg shadow-2xs cursor-pointer inline-flex items-center gap-1"
                                                    title="Pause Timer"
                                                >
                                                    <i className="fa-solid fa-pause text-[10px]"></i>
                                                    <span>Pause</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={handleStopTimer}
                                                className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                                            >
                                                <i className="fa-solid fa-stop"></i>
                                                <span>Stop & Log</span>
                                            </button>
                                        </>
                                    ) : activeTimer ? (
                                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg text-xs text-amber-800">
                                            <span className="font-mono font-bold text-amber-600">{formattedTime}</span>
                                            <span>Running on <strong>#{activeTimer.taskCode}</strong></span>
                                            <button
                                                type="button"
                                                onClick={handleStartTimer}
                                                className="underline font-bold text-[#17365D] hover:text-[#2878C7] cursor-pointer ml-1"
                                                title="Stop other timer and start timing this task"
                                            >
                                                Switch to this task
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="font-mono text-base font-bold text-slate-500">
                                                00:00:00
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleStartTimer}
                                                className="px-3 py-1.5 text-xs font-semibold text-white bg-[#10B981] hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                                            >
                                                <i className="fa-solid fa-play"></i>
                                                <span>Start Timer</span>
                                            </button>
                                        </>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setShowManualLogger(!showManualLogger)}
                                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                                        showManualLogger 
                                            ? "border-[#2878C7] bg-blue-50 text-[#2878C7]" 
                                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                                >
                                    <i className="fa-regular fa-clock"></i>
                                    <span>{showManualLogger ? "Close Form" : "+ Log Exact Time"}</span>
                                </button>
                            </div>

                            {/* Manual time entry with exact Date, Start Time & End Time */}
                            {showManualLogger && (
                                <form onSubmit={handleLogManualTime} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3 animate-in fade-in duration-150">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-[#17365D] uppercase tracking-wide">
                                            Log Exact Work Date & Time
                                        </span>
                                        {manualCalculatedMinutes > 0 && (
                                            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                                Duration: {Math.floor(manualCalculatedMinutes / 60)}h {manualCalculatedMinutes % 60}m ({manualCalculatedMinutes} mins)
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                Work Date
                                            </label>
                                            <input
                                                type="date"
                                                value={manualDate}
                                                onChange={(e) => setManualDate(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-hidden focus:border-[#2878C7]"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                Start Time (From)
                                            </label>
                                            <input
                                                type="time"
                                                value={manualStartTime}
                                                onChange={(e) => setManualStartTime(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-hidden focus:border-[#2878C7]"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                                                End Time (To)
                                            </label>
                                            <input
                                                type="time"
                                                value={manualEndTime}
                                                onChange={(e) => setManualEndTime(e.target.value)}
                                                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-hidden focus:border-[#2878C7]"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowManualLogger(false)}
                                            className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-medium cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={manualCalculatedMinutes <= 0}
                                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg shadow-sm cursor-pointer disabled:opacity-50"
                                        >
                                            Save Time Interval
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Logged Work Intervals Audit Table */}
                            <div className="pt-2 border-t border-slate-100 space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-slate-600 uppercase tracking-wider">
                                    <span>Logged Work Intervals ({task.time_entries?.length || 0})</span>
                                    <span className="text-[11px] font-normal normal-case text-slate-400">Exact date & time history</span>
                                </div>

                                {task.time_entries?.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-2">
                                        No time intervals logged yet. Use the stopwatch or manual log above.
                                    </p>
                                ) : (
                                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                        {task.time_entries?.map((entry) => {
                                            const startDt = entry.start_time ? new Date(entry.start_time) : null;
                                            const endDt = entry.end_time ? new Date(entry.end_time) : null;
                                            const dateStr = startDt ? startDt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
                                            const timeRange = (startDt && endDt) 
                                                ? `${startDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → ${endDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                : (startDt ? `Started at ${startDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '—');
                                            const hrs = (Number(entry.duration_minutes) / 60).toFixed(2);

                                            return (
                                                <div
                                                    key={entry.id}
                                                    className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs hover:bg-slate-100/70 transition-colors"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-6 h-6 rounded-full bg-[#17365D] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                                            {(entry.user_name || 'U')[0].toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-[#17212F]">{dateStr}</span>
                                                                <span className="text-slate-500 font-mono text-[11px]">{timeRange}</span>
                                                            </div>
                                                            <span className="text-[10px] text-slate-400">
                                                                Logged by {entry.user_name || 'User'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2.5">
                                                        <span className="font-mono font-bold text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                                                            {hrs}h ({entry.duration_minutes}m)
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteTimeEntry(entry.id)}
                                                            className="text-slate-400 hover:text-red-500 p-1 cursor-pointer transition-colors"
                                                            title="Delete time entry"
                                                        >
                                                            <i className="fa-solid fa-xmark text-xs"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Subtasks / Checklists */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-md bg-blue-50 text-[#2878C7] flex items-center justify-center text-xs">
                                        <i className="fa-solid fa-list-check"></i>
                                    </span>
                                    <h3 className="text-xs font-bold text-[#17212F] uppercase tracking-wider">
                                        Checklists & Subtasks
                                    </h3>
                                </div>
                                <span className="text-xs text-slate-500 font-semibold">
                                    {task.checklists?.filter((c) => c.is_completed).length} / {task.checklists?.length || 0} Done
                                </span>
                            </div>

                            <div className="space-y-1.5">
                                {task.checklists?.map((item) => (
                                    <label
                                        key={item.id}
                                        className={`flex items-center gap-2.5 p-2 rounded-lg text-xs cursor-pointer border transition-colors ${
                                            item.is_completed ? "bg-slate-50/70 border-slate-200 text-slate-400 line-through" : "bg-white border-slate-200 hover:bg-slate-50 text-[#17212F]"
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={!!item.is_completed}
                                            onChange={() => handleToggleChecklist(item.id, item.is_completed)}
                                            className="rounded border-slate-300 text-[#2878C7] focus:ring-[#2878C7]"
                                        />
                                        <span className="flex-1 select-none">{item.title}</span>
                                    </label>
                                ))}
                            </div>

                            <form onSubmit={handleAddChecklist} className="flex items-center gap-2 pt-1">
                                <input
                                    type="text"
                                    placeholder="+ Add checklist item..."
                                    value={newChecklistText}
                                    onChange={(e) => setNewChecklistText(e.target.value)}
                                    className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:border-[#2878C7]"
                                />
                                <button
                                    type="submit"
                                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#17365D] hover:bg-[#102642] rounded-md cursor-pointer"
                                >
                                    Add
                                </button>
                            </form>
                        </div>

                        {/* Dependencies Management Section */}
                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center text-xs">
                                        <i className="fa-solid fa-link"></i>
                                    </span>
                                    <h3 className="text-xs font-bold text-[#17212F] uppercase tracking-wider">
                                        Dependencies (Finish-to-Start)
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setShowDepPicker(!showDepPicker)}
                                    className="text-xs text-[#2878C7] hover:underline font-semibold cursor-pointer"
                                >
                                    {showDepPicker ? "Cancel" : "+ Link Blocker"}
                                </button>
                            </div>

                            {/* Dep Picker Dropdown */}
                            {showDepPicker && (
                                <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 space-y-2">
                                    <label className="block text-[11px] font-bold text-slate-700">
                                        Select prerequisite task that must finish before this task:
                                    </label>
                                    <div className="flex gap-2">
                                        <select
                                            value={selectedPredId}
                                            onChange={(e) => setSelectedPredId(e.target.value)}
                                            className="flex-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white cursor-pointer"
                                        >
                                            <option value="">Choose task...</option>
                                            {allTasks
                                                .filter((t) => t.id !== task.id)
                                                .map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        #{t.task_code}: {t.title} ({t.status})
                                                    </option>
                                                ))}
                                        </select>
                                        <button
                                            onClick={handleAddDepLink}
                                            disabled={!selectedPredId}
                                            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#17365D] hover:bg-[#102642] disabled:opacity-50 rounded-md cursor-pointer"
                                        >
                                            Link
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Predecessors (Blocked By) */}
                            <div>
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Blocked By (Predecessors):
                                </span>
                                {task.predecessors?.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No prerequisite dependencies.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {task.predecessors?.map((p) => (
                                            <div
                                                key={p.dep_id}
                                                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    <span className="font-bold text-[#17365D]">#{p.task_code}</span>
                                                    <span className="truncate">{p.title}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <TaskStatusBadge status={p.status} />
                                                    <button
                                                        onClick={() => handleDeleteDep(p.dep_id)}
                                                        className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                                                        title="Remove dependency"
                                                    >
                                                        <i className="fa-solid fa-xmark text-xs"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Successors (Blocks) */}
                            <div className="pt-2 border-t border-slate-100">
                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                                    Blocks Downstream (Successors):
                                </span>
                                {task.successors?.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No downstream tasks blocked by this task.</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {task.successors?.map((s) => (
                                            <div
                                                key={s.dep_id}
                                                className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    <span className="font-bold text-[#17365D]">#{s.task_code}</span>
                                                    <span className="truncate">{s.title}</span>
                                                </div>
                                                <TaskStatusBadge status={s.status} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Tabs: Comments & Activity History */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                            <div className="flex border-b border-slate-200 bg-slate-50/70">
                                <button
                                    onClick={() => setActiveTab("comments")}
                                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                                        activeTab === "comments"
                                            ? "border-[#2878C7] text-[#2878C7] bg-white"
                                            : "border-transparent text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Comments ({task.comments?.length || 0})
                                </button>
                                <button
                                    onClick={() => setActiveTab("activity")}
                                    className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                                        activeTab === "activity"
                                            ? "border-[#2878C7] text-[#2878C7] bg-white"
                                            : "border-transparent text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    Activity History ({task.activities?.length || 0})
                                </button>
                            </div>

                            <div className="p-4">
                                {activeTab === "comments" ? (
                                    <div className="space-y-4">
                                        {/* Feed */}
                                        <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                            {task.comments?.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic text-center py-4">No comments yet. Start the conversation!</p>
                                            ) : (
                                                task.comments?.map((c) => (
                                                    <div key={c.id} className="flex gap-2.5 text-xs">
                                                        <div className="w-7 h-7 rounded-full bg-[#17365D] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                                            {(c.user_name || "U")[0].toUpperCase()}
                                                        </div>
                                                        <div className="flex-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-bold text-[#17212F]">{c.user_name || "User"}</span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </span>
                                                            </div>
                                                            <p className="text-slate-700 whitespace-pre-wrap">{c.comment_text}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* New Comment Box */}
                                        <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-slate-100">
                                            <input
                                                type="text"
                                                placeholder="Write a comment with @mention..."
                                                value={commentText}
                                                onChange={(e) => setCommentText(e.target.value)}
                                                className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#2878C7]"
                                            />
                                            <button
                                                type="submit"
                                                className="px-4 py-1.5 text-xs font-semibold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg shadow-xs cursor-pointer"
                                            >
                                                Send
                                            </button>
                                        </form>
                                    </div>
                                ) : (
                                    /* Activity Audit Trail */
                                    <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                        {task.activities?.length === 0 ? (
                                            <p className="text-xs text-slate-400 italic text-center py-4">No recorded activities.</p>
                                        ) : (
                                            task.activities?.map((act) => (
                                                <div key={act.id} className="flex items-start gap-2.5 text-xs">
                                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                                                        <i className="fa-solid fa-clock-rotate-left"></i>
                                                    </span>
                                                    <div className="flex-1">
                                                        <p className="text-slate-700">
                                                            <span className="font-bold text-[#17212F]">{act.user_name || "System"}: </span>
                                                            {act.description}
                                                        </p>
                                                        <span className="text-[10px] text-slate-400">
                                                            {new Date(act.created_at).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
