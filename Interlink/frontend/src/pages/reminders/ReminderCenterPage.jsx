import React, { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import {
    getReminders,
    getReminderMetrics,
    createReminder,
    snoozeReminder,
    completeReminder,
    dismissReminder,
    escalateReminder,
    deleteReminder
} from "../../api/reminderApi";
import ReminderPreferencesModal from "../../components/reminders/ReminderPreferencesModal";

export default function ReminderCenterPage() {
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user") || "{}");
        } catch {
            return {};
        }
    }, []);

    // Filter states
    const [activeTab, setActiveTab] = useState("all"); // 'all', 'overdue', 'today', 'upcoming', 'snoozed', 'completed'
    const [sourceTypeFilter, setSourceTypeFilter] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Reminders data & metrics
    const [reminders, setReminders] = useState([]);
    const [metrics, setMetrics] = useState({ overdue_count: 0, today_count: 0, snoozed_count: 0, upcoming_count: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);

    // Create Reminder Form
    const [newTitle, setNewTitle] = useState("");
    const [newDescription, setNewDescription] = useState("");
    const [newSourceType, setNewSourceType] = useState("personal");
    const [newTriggerDate, setNewTriggerDate] = useState(new Date().toISOString().slice(0, 10));
    const [newTriggerTime, setNewTriggerTime] = useState("10:00");
    const [newEscalationEnabled, setNewEscalationEnabled] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Fetch metrics
    const fetchMetrics = useCallback(async () => {
        try {
            const res = await getReminderMetrics();
            if (res.data?.success) {
                setMetrics(res.data.data);
            }
        } catch (err) {
            console.error("Failed to load metrics:", err);
        }
    }, []);

    // Fetch reminders
    const fetchRemindersList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getReminders({
                status: activeTab,
                sourceType: sourceTypeFilter !== "all" ? sourceTypeFilter : undefined
            });
            if (res.data?.success) {
                setReminders(res.data.data || []);
            }
        } catch (err) {
            console.error("Failed to load reminders:", err);
            setError("Failed to load reminders from server.");
        } finally {
            setLoading(false);
        }
    }, [activeTab, sourceTypeFilter]);

    useEffect(() => {
        fetchMetrics();
    }, [fetchMetrics]);

    useEffect(() => {
        fetchRemindersList();
    }, [fetchRemindersList]);

    // Fast action handlers
    const handleComplete = async (id) => {
        try {
            await completeReminder(id);
            toast.success("Reminder completed!");
            fetchRemindersList();
            fetchMetrics();
        } catch (err) {
            toast.error("Failed to mark complete");
        }
    };

    const handleSnooze = async (id, minutes) => {
        try {
            const now = new Date();
            const snoozeUntil = new Date(now.getTime() + minutes * 60 * 1000).toISOString();
            await snoozeReminder(id, { snoozeUntil });
            toast.success(`Snoozed for ${minutes >= 60 ? `${minutes / 60} hour(s)` : `${minutes} mins`}`);
            fetchRemindersList();
            fetchMetrics();
        } catch (err) {
            toast.error("Failed to snooze reminder");
        }
    };

    const handleDismiss = async (id) => {
        try {
            await dismissReminder(id);
            toast.success("Reminder dismissed");
            fetchRemindersList();
            fetchMetrics();
        } catch (err) {
            toast.error("Failed to dismiss");
        }
    };

    const handleEscalate = async (id) => {
        try {
            await escalateReminder(id, {});
            toast.success("Reminder escalated to manager!");
            fetchRemindersList();
            fetchMetrics();
        } catch (err) {
            toast.error("Failed to escalate");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Remove this reminder?")) return;
        try {
            await deleteReminder(id);
            toast.success("Reminder deleted");
            fetchRemindersList();
            fetchMetrics();
        } catch (err) {
            toast.error("Failed to delete");
        }
    };

    const handleCreateReminder = async (e) => {
        e.preventDefault();
        if (!newTitle.trim()) {
            toast.error("Please enter a title");
            return;
        }

        const triggerAt = `${newTriggerDate} ${newTriggerTime}:00`;
        setSubmitting(true);
        try {
            await createReminder({
                title: newTitle.trim(),
                description: newDescription.trim() || null,
                source_type: newSourceType,
                trigger_at: triggerAt,
                escalation_enabled: newEscalationEnabled
            });
            toast.success("Reminder scheduled!");
            setIsCreateModalOpen(false);
            setNewTitle("");
            setNewDescription("");
            fetchRemindersList();
            fetchMetrics();
        } catch (err) {
            toast.error("Failed to create reminder");
        } finally {
            setSubmitting(false);
        }
    };

    // Client-side search filter
    const filteredReminders = useMemo(() => {
        if (!searchQuery.trim()) return reminders;
        const q = searchQuery.toLowerCase();
        return reminders.filter(r => 
            r.title.toLowerCase().includes(q) || 
            (r.description && r.description.toLowerCase().includes(q))
        );
    }, [reminders, searchQuery]);

    return (
        <div className="flex-1 flex flex-col bg-[#F6F8FB] min-h-[calc(100vh-4rem)] p-6 space-y-6 select-none" data-testid="CAL-03-reminder-center">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-[#17212F] tracking-tight flex items-center gap-2.5">
                        <i className="fa-solid fa-bell text-rose-500"></i>
                        <span>Reminder Center</span>
                    </h1>
                    <p className="text-xs text-[#5B6573] mt-0.5">
                        Centralized alerting, snooze workflows, and approval escalation across Interlink.
                    </p>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        onClick={() => setIsPreferencesOpen(true)}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
                    >
                        <i className="fa-solid fa-sliders text-slate-400"></i>
                        <span>Preferences</span>
                    </button>

                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-2 rounded-xl bg-[#17365D] hover:bg-[#102642] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                    >
                        <i className="fa-solid fa-plus text-xs"></i>
                        <span>New Reminder</span>
                    </button>
                </div>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div
                    onClick={() => setActiveTab("overdue")}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
                        activeTab === "overdue" ? "border-rose-400 bg-rose-50/50 ring-2 ring-rose-200" : "border-slate-200 bg-white hover:border-rose-200"
                    }`}
                >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Overdue</p>
                    <p className="text-2xl font-black text-rose-700 mt-1">{metrics.overdue_count}</p>
                </div>

                <div
                    onClick={() => setActiveTab("today")}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
                        activeTab === "today" ? "border-blue-400 bg-blue-50/50 ring-2 ring-blue-200" : "border-slate-200 bg-white hover:border-blue-200"
                    }`}
                >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Today</p>
                    <p className="text-2xl font-black text-blue-700 mt-1">{metrics.today_count}</p>
                </div>

                <div
                    onClick={() => setActiveTab("snoozed")}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
                        activeTab === "snoozed" ? "border-amber-400 bg-amber-50/50 ring-2 ring-amber-200" : "border-slate-200 bg-white hover:border-amber-200"
                    }`}
                >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600">Snoozed</p>
                    <p className="text-2xl font-black text-amber-700 mt-1">{metrics.snoozed_count}</p>
                </div>

                <div
                    onClick={() => setActiveTab("upcoming")}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer shadow-2xs ${
                        activeTab === "upcoming" ? "border-emerald-400 bg-emerald-50/50 ring-2 ring-emerald-200" : "border-slate-200 bg-white hover:border-emerald-200"
                    }`}
                >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Upcoming</p>
                    <p className="text-2xl font-black text-emerald-700 mt-1">{metrics.upcoming_count}</p>
                </div>
            </div>

            {/* Filter Bar & Tabs */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
                {/* Status Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
                    {["all", "overdue", "today", "upcoming", "snoozed", "completed"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                                activeTab === tab
                                    ? "bg-white text-[#17365D] shadow-xs font-black"
                                    : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Source Filter & Search Input */}
                <div className="flex items-center gap-3">
                    <select
                        value={sourceTypeFilter}
                        onChange={(e) => setSourceTypeFilter(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer focus:outline-hidden"
                    >
                        <option value="all">All Modules</option>
                        <option value="personal">Personal</option>
                        <option value="task">Tasks</option>
                        <option value="project">Projects</option>
                        <option value="approval">Approvals</option>
                        <option value="meeting">Meetings</option>
                    </select>

                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-xs text-slate-400"></i>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search reminders..."
                            className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 w-48 sm:w-64 focus:outline-hidden focus:bg-white focus:border-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Reminders List Canvas */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex-1 flex flex-col">
                {loading ? (
                    <div className="p-8 space-y-4 animate-pulse">
                        <div className="h-16 bg-slate-100 rounded-xl"></div>
                        <div className="h-16 bg-slate-100 rounded-xl"></div>
                        <div className="h-16 bg-slate-100 rounded-xl"></div>
                    </div>
                ) : error ? (
                    <div className="p-12 text-center space-y-3">
                        <p className="text-sm font-bold text-rose-600">{error}</p>
                        <button
                            onClick={fetchRemindersList}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                        >
                            Retry
                        </button>
                    </div>
                ) : filteredReminders.length === 0 ? (
                    <div className="py-20 text-center space-y-3">
                        <i className="fa-regular fa-bell-slash text-4xl text-slate-300"></i>
                        <p className="text-sm font-bold text-slate-700">No reminders found.</p>
                        <p className="text-xs text-slate-400">You are all caught up! Click below to create a new reminder.</p>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-4 py-2 bg-[#17365D] hover:bg-[#102642] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                        >
                            Set Reminder
                        </button>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 overflow-y-auto">
                        {filteredReminders.map((rem) => {
                            const isOverdue = rem.status === 'pending' && new Date(rem.trigger_at) < new Date();
                            const isSnoozed = rem.status === 'snoozed';
                            const isCompleted = rem.status === 'completed';

                            return (
                                <div
                                    key={rem.id}
                                    className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 transition-all hover:bg-slate-50/70 ${
                                        isCompleted ? "opacity-60 bg-slate-50/40" : ""
                                    }`}
                                >
                                    {/* Left: Checkmark & Info */}
                                    <div className="flex items-start gap-3.5 flex-1 min-w-[280px]">
                                        <button
                                            onClick={() => handleComplete(rem.id)}
                                            className={`w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all cursor-pointer ${
                                                isCompleted
                                                    ? "bg-emerald-500 border-emerald-500 text-white"
                                                    : "border-slate-300 hover:border-emerald-500 text-transparent hover:text-emerald-500"
                                            }`}
                                            title="Mark as complete"
                                        >
                                            <i className="fa-solid fa-check text-xs"></i>
                                        </button>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className={`text-sm font-bold text-[#17212F] ${isCompleted ? "line-through text-slate-400" : ""}`}>
                                                    {rem.title}
                                                </h3>
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                                                    {rem.source_type}
                                                </span>
                                                {isOverdue && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700">
                                                        Overdue
                                                    </span>
                                                )}
                                                {isSnoozed && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 flex items-center gap-1">
                                                        <i className="fa-solid fa-clock-rotate-left text-[9px]"></i>
                                                        Snoozed ({rem.snooze_count})
                                                    </span>
                                                )}
                                            </div>

                                            {rem.description && (
                                                <p className="text-xs text-slate-500">{rem.description}</p>
                                            )}

                                            <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                                                <span>
                                                    <i className="fa-regular fa-clock mr-1"></i>
                                                    {new Date(rem.trigger_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                                {rem.escalated_to_user_name && (
                                                    <span className="text-rose-600 font-bold">
                                                        Escalated to: {rem.escalated_to_user_name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Quick Action Controls */}
                                    <div className="flex items-center gap-2">
                                        {/* Snooze dropdown presets */}
                                        {!isCompleted && (
                                            <div className="relative group">
                                                <button
                                                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-amber-400 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                                                >
                                                    <i className="fa-regular fa-clock text-amber-500"></i>
                                                    <span>Snooze</span>
                                                    <i className="fa-solid fa-chevron-down text-[9px]"></i>
                                                </button>
                                                <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-slate-200 rounded-xl shadow-lg p-1 hidden group-hover:block z-30 space-y-0.5">
                                                    <button
                                                        onClick={() => handleSnooze(rem.id, 15)}
                                                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg font-medium cursor-pointer"
                                                    >
                                                        +15 minutes
                                                    </button>
                                                    <button
                                                        onClick={() => handleSnooze(rem.id, 60)}
                                                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg font-medium cursor-pointer"
                                                    >
                                                        +1 hour
                                                    </button>
                                                    <button
                                                        onClick={() => handleSnooze(rem.id, 24 * 60)}
                                                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg font-medium cursor-pointer"
                                                    >
                                                        Tomorrow
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Escalate button */}
                                        {!isCompleted && !rem.escalated_at && (
                                            <button
                                                onClick={() => handleEscalate(rem.id)}
                                                className="px-2.5 py-1.5 rounded-xl border border-slate-200 hover:border-rose-300 text-slate-600 hover:text-rose-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                                                title="Escalate to Department Manager"
                                            >
                                                <i className="fa-solid fa-arrow-up-right-dots mr-1 text-rose-500"></i>
                                                <span>Escalate</span>
                                            </button>
                                        )}

                                        {/* Dismiss / Delete */}
                                        <button
                                            onClick={() => handleDelete(rem.id)}
                                            className="w-8 h-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-all cursor-pointer"
                                            title="Delete"
                                        >
                                            <i className="fa-solid fa-trash-can text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Reminder Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <h2 className="text-base font-bold text-[#17212F] flex items-center gap-2">
                                <i className="fa-solid fa-bell text-rose-500"></i>
                                <span>Create Reminder</span>
                            </h2>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-sm"></i>
                            </button>
                        </div>

                        <form onSubmit={handleCreateReminder} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Reminder Title <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="e.g. Review Q4 budget submission"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-hidden focus:border-blue-500"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Module Category
                                    </label>
                                    <select
                                        value={newSourceType}
                                        onChange={(e) => setNewSourceType(e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                                    >
                                        <option value="personal">Personal</option>
                                        <option value="task">Task Deadline</option>
                                        <option value="project">Project Milestone</option>
                                        <option value="approval">Approval</option>
                                        <option value="meeting">Meeting</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Trigger Time
                                    </label>
                                    <input
                                        type="time"
                                        value={newTriggerTime}
                                        onChange={(e) => setNewTriggerTime(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Trigger Date
                                </label>
                                <input
                                    type="date"
                                    value={newTriggerDate}
                                    onChange={(e) => setNewTriggerDate(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Notes (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    placeholder="Contextual details..."
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium"
                                />
                            </div>

                            <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={newEscalationEnabled}
                                    onChange={(e) => setNewEscalationEnabled(e.target.checked)}
                                    className="rounded-sm text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                                <div>
                                    <span className="text-xs font-bold text-slate-800 block">
                                        Auto-escalate if unacknowledged
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                        Notifies department manager after 60 mins without response.
                                    </span>
                                </div>
                            </label>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 text-xs font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 bg-[#17365D] hover:bg-[#102642] text-white text-xs font-bold rounded-xl shadow-xs"
                                >
                                    {submitting ? "Scheduling..." : "Schedule Reminder"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Preferences Modal */}
            <ReminderPreferencesModal
                isOpen={isPreferencesOpen}
                onClose={() => setIsPreferencesOpen(false)}
            />
        </div>
    );
}
