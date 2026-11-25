import React, { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import {
    getCurrentTimesheet,
    saveTimeEntry,
    deleteTimeEntry,
    submitTimesheet,
    getTimesheetApprovalsQueue,
    approveTimesheet,
    rejectTimesheet,
    getTimesheetReports
} from "../../api/timesheetApi";
import { getProjects } from "../../api/projectApi";
import { getTasks } from "../../api/taskApi";

export default function TimesheetsPage() {
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const isAdmin = user.role === "admin" || user.role === "super admin";

    // Primary Tab: "weekly" | "approvals" | "reports"
    const [activeTab, setActiveTab] = useState("weekly");

    // Week selector state (date string in that week)
    const [currentWeekDate, setCurrentWeekDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [timesheetData, setTimesheetData] = useState(null);
    const [loadingTimesheet, setLoadingTimesheet] = useState(true);

    // Projects & Tasks for dropdowns
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);

    // Add / Edit Entry Modal State
    const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
    const [editingEntryId, setEditingEntryId] = useState(null);
    const [entryForm, setEntryForm] = useState({
        project_id: "",
        task_id: "",
        work_date: new Date().toISOString().slice(0, 10),
        duration_hours: 1,
        duration_minutes: 0,
        description: "",
        is_billable: true,
        category: "DEVELOPMENT"
    });
    const [savingEntry, setSavingEntry] = useState(false);

    // Approval Queue State
    const [approvalsQueue, setApprovalsQueue] = useState([]);
    const [loadingQueue, setLoadingQueue] = useState(false);
    const [queueFilter, setQueueFilter] = useState("SUBMITTED");
    const [rejectModalTimesheet, setRejectModalTimesheet] = useState(null);
    const [rejectionComment, setRejectionComment] = useState("");
    const [submittingAction, setSubmittingAction] = useState(false);

    // Reports State
    const [reportFilters, setReportFilters] = useState({
        startDate: "",
        endDate: "",
        projectId: ""
    });
    const [reportData, setReportData] = useState(null);
    const [loadingReport, setLoadingReport] = useState(false);

    // ── Load Current Weekly Timesheet ─────────────────────────────────────────
    const fetchTimesheet = useCallback(async (dateStr) => {
        try {
            setLoadingTimesheet(true);
            const res = await getCurrentTimesheet({ date: dateStr });
            if (res.data?.success) {
                setTimesheetData(res.data.data);
            }
        } catch (err) {
            console.error("Error loading timesheet:", err);
            toast.error("Failed to load weekly timesheet.");
        } finally {
            setLoadingTimesheet(false);
        }
    }, []);

    // ── Load Projects & Tasks ─────────────────────────────────────────────────
    const loadProjectsAndTasks = useCallback(async () => {
        try {
            const [projRes, taskRes] = await Promise.all([
                getProjects().catch(() => null),
                getTasks().catch(() => null)
            ]);
            if (projRes?.data?.success) setProjects(projRes.data.projects || []);
            if (taskRes?.data?.success) setTasks(taskRes.data.tasks || []);
        } catch (_) {}
    }, []);

    // ── Load Approvals Queue ──────────────────────────────────────────────────
    const fetchQueue = useCallback(async () => {
        try {
            setLoadingQueue(true);
            const res = await getTimesheetApprovalsQueue({ status: queueFilter });
            if (res.data?.success) {
                setApprovalsQueue(res.data.queue || []);
            }
        } catch (err) {
            console.error("Error loading approvals:", err);
        } finally {
            setLoadingQueue(false);
        }
    }, [queueFilter]);

    // ── Load Timesheet Reports ────────────────────────────────────────────────
    const fetchReports = useCallback(async () => {
        try {
            setLoadingReport(true);
            const res = await getTimesheetReports(reportFilters);
            if (res.data?.success) {
                setReportData(res.data.report);
            }
        } catch (err) {
            console.error("Error loading reports:", err);
        } finally {
            setLoadingReport(false);
        }
    }, [reportFilters]);

    useEffect(() => {
        fetchTimesheet(currentWeekDate);
        loadProjectsAndTasks();
    }, [currentWeekDate, fetchTimesheet, loadProjectsAndTasks]);

    useEffect(() => {
        if (activeTab === "approvals" && isAdmin) fetchQueue();
        if (activeTab === "reports") fetchReports();
    }, [activeTab, isAdmin, fetchQueue, fetchReports]);

    // ── Week Shift Navigation Helper ──────────────────────────────────────────
    const shiftWeek = (direction) => {
        const d = new Date(currentWeekDate);
        d.setDate(d.getDate() + (direction * 7));
        setCurrentWeekDate(d.toISOString().slice(0, 10));
    };

    // ── Week Days Array ───────────────────────────────────────────────────────
    const weekDays = useMemo(() => {
        if (!timesheetData?.timesheet?.period_start_date) return [];
        const start = new Date(timesheetData.timesheet.period_start_date);
        return Array.from({ length: 7 }, (_, i) => {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            const ymd = day.toISOString().slice(0, 10);
            return {
                date: ymd,
                dayName: day.toLocaleDateString([], { weekday: 'short' }),
                dayNumber: day.getDate(),
                isToday: ymd === new Date().toISOString().slice(0, 10)
            };
        });
    }, [timesheetData]);

    // Filter tasks based on selected project in form
    const availableTasksForProject = useMemo(() => {
        if (!entryForm.project_id) return tasks;
        return tasks.filter(t => String(t.project_id) === String(entryForm.project_id));
    }, [tasks, entryForm.project_id]);

    // ── Open Add / Edit Entry Modal ───────────────────────────────────────────
    const handleOpenEntryModal = (entry = null, defaultDate = null) => {
        if (entry) {
            setEditingEntryId(entry.id);
            const totalMins = Number(entry.duration_minutes || 60);
            setEntryForm({
                project_id: entry.project_id || "",
                task_id: entry.task_id || "",
                work_date: entry.work_date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
                duration_hours: Math.floor(totalMins / 60),
                duration_minutes: totalMins % 60,
                description: entry.description || "",
                is_billable: Boolean(entry.is_billable),
                category: entry.category || "DEVELOPMENT"
            });
        } else {
            setEditingEntryId(null);
            setEntryForm({
                project_id: projects[0]?.id || "",
                task_id: "",
                work_date: defaultDate || new Date().toISOString().slice(0, 10),
                duration_hours: 1,
                duration_minutes: 0,
                description: "",
                is_billable: true,
                category: "DEVELOPMENT"
            });
        }
        setIsEntryModalOpen(true);
    };

    // ── Save Time Entry ───────────────────────────────────────────────────────
    const handleSaveEntry = async (e) => {
        e.preventDefault();
        if (!entryForm.project_id) {
            toast.error("Please select a project.");
            return;
        }
        const totalMinutes = (Number(entryForm.duration_hours) * 60) + Number(entryForm.duration_minutes);
        if (totalMinutes <= 0) {
            toast.error("Please enter a duration greater than 0 minutes.");
            return;
        }

        setSavingEntry(true);
        try {
            await saveTimeEntry({
                id: editingEntryId || undefined,
                timesheet_id: timesheetData.timesheet.id,
                project_id: entryForm.project_id,
                task_id: entryForm.task_id || null,
                work_date: entryForm.work_date,
                duration_minutes: totalMinutes,
                description: entryForm.description.trim(),
                is_billable: entryForm.is_billable,
                category: entryForm.category
            });

            toast.success(editingEntryId ? "Time entry updated!" : "Time entry added!");
            setIsEntryModalOpen(false);
            fetchTimesheet(currentWeekDate);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save time entry.");
        } finally {
            setSavingEntry(false);
        }
    };

    // ── Delete Time Entry ─────────────────────────────────────────────────────
    const handleDeleteEntry = async (id) => {
        if (!window.confirm("Are you sure you want to delete this time entry?")) return;
        try {
            await deleteTimeEntry(id);
            toast.success("Time entry deleted.");
            fetchTimesheet(currentWeekDate);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to delete time entry.");
        }
    };

    // ── Submit Weekly Timesheet ───────────────────────────────────────────────
    const handleSubmitTimesheet = async () => {
        if (!timesheetData?.timesheet?.id) return;
        if (Number(timesheetData.timesheet.total_hours) <= 0) {
            toast.error("You cannot submit a timesheet with 0 hours logged.");
            return;
        }
        if (!window.confirm("Submit this weekly timesheet for manager approval? You will not be able to edit entries while under review.")) return;

        try {
            await submitTimesheet(timesheetData.timesheet.id);
            toast.success("Timesheet submitted for review!");
            fetchTimesheet(currentWeekDate);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to submit timesheet.");
        }
    };

    // ── Manager Approve / Reject Actions ──────────────────────────────────────
    const handleApproveTimesheet = async (id) => {
        try {
            await approveTimesheet(id, { comment: "Approved by manager" });
            toast.success("Timesheet approved and locked.");
            fetchQueue();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to approve timesheet.");
        }
    };

    const handleRejectTimesheet = async (e) => {
        e.preventDefault();
        if (!rejectionComment.trim()) {
            toast.error("Please provide a reason for rejection.");
            return;
        }
        setSubmittingAction(true);
        try {
            await rejectTimesheet(rejectModalTimesheet.id, { comment: rejectionComment });
            toast.success("Timesheet rejected and returned for revision.");
            setRejectModalTimesheet(null);
            setRejectionComment("");
            fetchQueue();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to reject timesheet.");
        } finally {
            setSubmittingAction(false);
        }
    };

    const isTimesheetLocked = timesheetData?.timesheet?.is_locked ||
        timesheetData?.timesheet?.status === "SUBMITTED" ||
        timesheetData?.timesheet?.status === "APPROVED";

    return (
        <div className="flex flex-col flex-1 bg-[#F6F8FB] min-h-screen">
            {/* Top Header Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0 shadow-2xs">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-base border border-indigo-100 shadow-2xs">
                            <i className="fa-solid fa-business-time"></i>
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                Timesheets & Billable Hours
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                    Weekly
                                </span>
                            </h1>
                            <p className="text-xs text-slate-400">
                                Log hourly work mapped against projects and tasks with manager approval workflows.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Primary Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
                    <button
                        onClick={() => setActiveTab("weekly")}
                        className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === "weekly"
                                ? "bg-[#17365D] text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                        }`}
                    >
                        <i className="fa-solid fa-calendar-week text-[11px]"></i>
                        <span>My Weekly Timesheet</span>
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab("approvals")}
                            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                                activeTab === "approvals"
                                    ? "bg-[#17365D] text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                            }`}
                        >
                            <i className="fa-solid fa-stamp text-[11px]"></i>
                            <span>Approval Queue</span>
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab("reports")}
                        className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === "reports"
                                ? "bg-[#17365D] text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                        }`}
                    >
                        <i className="fa-solid fa-chart-pie text-[11px]"></i>
                        <span>Timesheet Reports</span>
                    </button>
                </div>
            </div>

            {/* ── Main Tab Content ────────────────────────────────────────────── */}
            <div className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">

                {/* ════════════ TAB 1: TIME-01 MY WEEKLY TIMESHEET ══════════════ */}
                {activeTab === "weekly" && (
                    <div className="space-y-6">
                        {/* Week Navigator & Summary Banner */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => shiftWeek(-1)}
                                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Previous Week"
                                >
                                    <i className="fa-solid fa-chevron-left text-xs"></i>
                                </button>
                                <div className="text-center sm:text-left">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                        Timesheet Period
                                    </span>
                                    <h3 className="font-bold text-sm text-slate-900">
                                        {timesheetData?.timesheet?.period_start_date
                                            ? `${new Date(timesheetData.timesheet.period_start_date).toLocaleDateString([], { month: 'short', day: 'numeric' })} — ${new Date(timesheetData.timesheet.period_end_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`
                                            : "Loading..."}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => shiftWeek(1)}
                                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                                    title="Next Week"
                                >
                                    <i className="fa-solid fa-chevron-right text-xs"></i>
                                </button>
                                <button
                                    onClick={() => setCurrentWeekDate(new Date().toISOString().slice(0, 10))}
                                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-[#0056cf] hover:bg-blue-100 cursor-pointer"
                                >
                                    This Week
                                </button>
                            </div>

                            {/* Summary Metrics & Actions */}
                            <div className="flex items-center gap-3 flex-wrap justify-center text-xs">
                                <div className="text-center px-3 py-1 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Logged</span>
                                    <span className="text-slate-900 font-black text-sm">
                                        {timesheetData?.timesheet?.total_hours || "0.00"} hrs
                                    </span>
                                </div>
                                <div className="text-center px-3 py-1 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Billable</span>
                                    <span className="text-emerald-700 font-black text-sm">
                                        {timesheetData?.timesheet?.billable_hours || "0.00"} hrs
                                    </span>
                                </div>
                                <div className="text-center px-3 py-1 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Status</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                        timesheetData?.timesheet?.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                                        timesheetData?.timesheet?.status === "SUBMITTED" ? "bg-blue-100 text-[#0056cf]" :
                                        timesheetData?.timesheet?.status === "REJECTED" ? "bg-rose-100 text-rose-800" :
                                        "bg-slate-100 text-slate-700"
                                    }`}>
                                        {timesheetData?.timesheet?.status || "DRAFT"}
                                    </span>
                                </div>

                                {!isTimesheetLocked ? (
                                    <>
                                        <button
                                            onClick={() => handleOpenEntryModal()}
                                            className="px-3.5 py-2 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                                        >
                                            <i className="fa-solid fa-plus text-xs"></i>
                                            <span>Log Time</span>
                                        </button>
                                        <button
                                            onClick={handleSubmitTimesheet}
                                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                                        >
                                            <i className="fa-solid fa-paper-plane text-xs"></i>
                                            <span>Submit Timesheet</span>
                                        </button>
                                    </>
                                ) : (
                                    <span className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 font-bold border border-slate-200 flex items-center gap-1.5">
                                        <i className="fa-solid fa-lock text-slate-400"></i>
                                        <span>Locked Period</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 7-Day Matrix Calendar Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                            {weekDays.map(day => {
                                const dayEntries = (timesheetData?.entries || []).filter(e => e.work_date?.slice(0, 10) === day.date);
                                const dayMins = dayEntries.reduce((acc, e) => acc + Number(e.duration_minutes || 0), 0);
                                const dayHours = (dayMins / 60.0).toFixed(1);

                                return (
                                    <div
                                        key={day.date}
                                        className={`rounded-2xl p-4 border transition-all flex flex-col ${
                                            day.isToday
                                                ? "bg-blue-50/50 border-[#2878C7]/40 ring-1 ring-[#2878C7]/20 shadow-xs"
                                                : "bg-white border-slate-200 shadow-2xs"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                                            <div>
                                                <span className="font-bold text-slate-900 block">{day.dayName}</span>
                                                <span className="text-[10px] text-slate-400">{day.date.slice(5)}</span>
                                            </div>
                                            <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                                                Number(dayHours) > 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-400"
                                            }`}>
                                                {dayHours}h
                                            </span>
                                        </div>

                                        <div className="flex-1 py-2 space-y-1.5 min-h-[90px]">
                                            {dayEntries.length === 0 ? (
                                                <div className="h-full flex items-center justify-center text-[11px] text-slate-300">
                                                    No entries
                                                </div>
                                            ) : (
                                                dayEntries.map(e => (
                                                    <div
                                                        key={e.id}
                                                        onClick={() => !isTimesheetLocked && handleOpenEntryModal(e)}
                                                        className={`p-2 rounded-xl text-[11px] border border-slate-200/80 bg-slate-50 hover:bg-blue-50/80 transition-colors cursor-pointer ${
                                                            isTimesheetLocked ? "cursor-default" : ""
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between font-bold text-slate-800 truncate">
                                                            <span className="truncate">{e.project_title}</span>
                                                            <span className="text-[10px] text-indigo-700 font-mono shrink-0 ml-1">
                                                                {e.duration_hours}h
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                                            {e.task_title ? `[${e.task_title}] ` : ""}{e.description}
                                                        </p>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {!isTimesheetLocked && (
                                            <button
                                                onClick={() => handleOpenEntryModal(null, day.date)}
                                                className="w-full mt-auto py-1 text-center text-[10px] font-bold text-[#2878C7] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                            >
                                                + Add Time
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Detailed Entries Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-sm text-slate-900">
                                    Entries for This Timesheet ({timesheetData?.entries?.length || 0})
                                </h3>
                                {timesheetData?.timesheet?.status === "REJECTED" && (
                                    <span className="text-xs font-bold text-rose-600 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200">
                                        Revision requested by manager. Please adjust and resubmit.
                                    </span>
                                )}
                            </div>

                            {loadingTimesheet ? (
                                <div className="p-12 text-center text-slate-400">
                                    <i className="fa-solid fa-spinner fa-spin text-xl text-[#2878C7]"></i>
                                    <p className="text-xs mt-2 font-semibold">Loading timesheet entries...</p>
                                </div>
                            ) : !timesheetData?.entries || timesheetData.entries.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 text-xs">
                                    No time entries logged for this period yet. Click "Log Time" to add hours worked.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                            <tr>
                                                <th className="px-5 py-3">Date</th>
                                                <th className="px-4 py-3">Project & Task</th>
                                                <th className="px-4 py-3">Category</th>
                                                <th className="px-4 py-3">Description</th>
                                                <th className="px-4 py-3">Duration</th>
                                                <th className="px-4 py-3">Billable</th>
                                                {!isTimesheetLocked && <th className="px-4 py-3 text-right">Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-800">
                                            {timesheetData.entries.map((entry) => (
                                                <tr key={entry.id} className="hover:bg-slate-50/60">
                                                    <td className="px-5 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                                                        {new Date(entry.work_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <span className="font-bold text-slate-900 block">{entry.project_title}</span>
                                                        {entry.task_title && (
                                                            <span className="text-[10px] text-slate-400 block">{entry.task_title}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[10px]">
                                                            {entry.category}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 max-w-sm truncate text-slate-600" title={entry.description}>
                                                        {entry.description}
                                                    </td>
                                                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                                                        {entry.duration_hours} hrs
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        {entry.is_billable ? (
                                                            <span className="text-emerald-700 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                                Billable
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 font-semibold text-[10px]">
                                                                Non-billable
                                                            </span>
                                                        )}
                                                    </td>
                                                    {!isTimesheetLocked && (
                                                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                            <button
                                                                onClick={() => handleOpenEntryModal(entry)}
                                                                className="text-slate-400 hover:text-blue-600 p-1 mr-1"
                                                                title="Edit entry"
                                                            >
                                                                <i className="fa-solid fa-pencil"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteEntry(entry.id)}
                                                                className="text-slate-400 hover:text-red-600 p-1"
                                                                title="Delete entry"
                                                            >
                                                                <i className="fa-solid fa-trash-can"></i>
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ════════════ TAB 2: TIME-03 APPROVAL QUEUE ════════════════════ */}
                {activeTab === "approvals" && isAdmin && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900">Timesheet Approval Queue</h3>
                                <p className="text-xs text-slate-400">Review, approve, and lock submitted employee timesheets.</p>
                            </div>
                            <select
                                value={queueFilter}
                                onChange={(e) => setQueueFilter(e.target.value)}
                                className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700"
                            >
                                <option value="SUBMITTED">Pending Approval</option>
                                <option value="APPROVED">Approved & Locked</option>
                                <option value="REJECTED">Rejected</option>
                                <option value="ALL">All Records</option>
                            </select>
                        </div>

                        {loadingQueue ? (
                            <div className="py-12 text-center text-slate-400">
                                <i className="fa-solid fa-spinner fa-spin text-xl text-[#2878C7]"></i>
                            </div>
                        ) : approvalsQueue.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs">
                                No timesheets in the queue matching status "{queueFilter}".
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                        <tr>
                                            <th className="px-4 py-3">Employee</th>
                                            <th className="px-4 py-3">Period</th>
                                            <th className="px-4 py-3">Total Hours</th>
                                            <th className="px-4 py-3">Billable</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {approvalsQueue.map(ts => (
                                            <tr key={ts.id} className="hover:bg-slate-50/70">
                                                <td className="px-4 py-3.5 font-bold text-slate-900">
                                                    {ts.user_name}
                                                    <span className="block text-[10px] text-slate-400 font-normal">{ts.department_name || "General"}</span>
                                                </td>
                                                <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                                                    {new Date(ts.period_start_date).toLocaleDateString([], { month: 'short', day: 'numeric' })} — {new Date(ts.period_end_date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </td>
                                                <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                                                    {ts.total_hours} hrs
                                                </td>
                                                <td className="px-4 py-3.5 font-mono text-emerald-700 font-bold">
                                                    {ts.billable_hours} hrs
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        ts.status === "SUBMITTED" ? "bg-blue-100 text-[#0056cf]" :
                                                        ts.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                                    }`}>
                                                        {ts.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                                                    {ts.status === "SUBMITTED" ? (
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                onClick={() => { setRejectModalTimesheet(ts); setRejectionComment(""); }}
                                                                className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs transition-colors cursor-pointer"
                                                            >
                                                                Reject
                                                            </button>
                                                            <button
                                                                onClick={() => handleApproveTimesheet(ts.id)}
                                                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                                                            >
                                                                Approve
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400">Locked</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ════════════ TAB 3: TIMESHEET REPORTS ════════════════════════ */}
                {activeTab === "reports" && (
                    <div className="space-y-6">
                        {/* Filter Bar */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-wrap">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Start Date</label>
                                    <input
                                        type="date"
                                        value={reportFilters.startDate}
                                        onChange={(e) => setReportFilters({ ...reportFilters, startDate: e.target.value })}
                                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">End Date</label>
                                    <input
                                        type="date"
                                        value={reportFilters.endDate}
                                        onChange={(e) => setReportFilters({ ...reportFilters, endDate: e.target.value })}
                                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Project</label>
                                    <select
                                        value={reportFilters.projectId}
                                        onChange={(e) => setReportFilters({ ...reportFilters, projectId: e.target.value })}
                                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                                    >
                                        <option value="">All Projects</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={fetchReports}
                                className="px-4 py-2 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold text-xs transition-colors cursor-pointer"
                            >
                                Apply Filters
                            </button>
                        </div>

                        {/* Summary Metrics */}
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Hours Logged</span>
                                <span className="text-2xl font-black text-slate-900 mt-1 block">
                                    {reportData?.summary?.totalHours || "0.0"} hrs
                                </span>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Billable Hours</span>
                                <span className="text-2xl font-black text-emerald-700 mt-1 block">
                                    {reportData?.summary?.billableHours || "0.0"} hrs
                                </span>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Non-Billable Hours</span>
                                <span className="text-2xl font-black text-slate-500 mt-1 block">
                                    {reportData?.summary?.nonBillableHours || "0.0"} hrs
                                </span>
                            </div>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block">Billable Ratio</span>
                                <span className="text-2xl font-black text-indigo-700 mt-1 block">
                                    {reportData?.summary?.billablePercentage || 0}%
                                </span>
                            </div>
                        </div>

                        {/* Report Entries Grid */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                            <h3 className="font-bold text-sm text-slate-900">Detailed Time Entries</h3>
                            {loadingReport ? (
                                <div className="py-12 text-center text-slate-400">
                                    <i className="fa-solid fa-spinner fa-spin text-xl text-[#2878C7]"></i>
                                </div>
                            ) : !reportData?.entries || reportData.entries.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 text-xs">
                                    No entries found for the selected criteria.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                            <tr>
                                                <th className="px-4 py-2.5">Date</th>
                                                <th className="px-4 py-2.5">Employee</th>
                                                <th className="px-4 py-2.5">Project</th>
                                                <th className="px-4 py-2.5">Category</th>
                                                <th className="px-4 py-2.5">Duration</th>
                                                <th className="px-4 py-2.5">Billable</th>
                                                <th className="px-4 py-2.5">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {reportData.entries.map((r) => (
                                                <tr key={r.id} className="hover:bg-slate-50/70">
                                                    <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                                                        {new Date(r.work_date).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-slate-900">
                                                        {r.user_name}
                                                    </td>
                                                    <td className="px-4 py-3 font-semibold text-slate-800">
                                                        {r.project_title}
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-500">
                                                        {r.category}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono font-bold text-slate-900">
                                                        {r.duration_hours}h
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                            r.is_billable ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"
                                                        }`}>
                                                            {r.is_billable ? "Yes" : "No"}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 max-w-sm truncate" title={r.description}>
                                                        {r.description}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal: TIME-02 Add / Edit Time Entry ──────────────────────────── */}
            {isEntryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                <i className="fa-solid fa-clock text-[#2878C7]"></i>
                                {editingEntryId ? "Edit Time Entry" : "Log New Time Entry"}
                            </h3>
                            <button
                                onClick={() => setIsEntryModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSaveEntry} className="space-y-3.5 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Project *</label>
                                    <select
                                        required
                                        value={entryForm.project_id}
                                        onChange={(e) => setEntryForm({ ...entryForm, project_id: e.target.value, task_id: "" })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2878C7] font-semibold"
                                    >
                                        <option value="">Select Project</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.title}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Linked Task</label>
                                    <select
                                        value={entryForm.task_id}
                                        onChange={(e) => setEntryForm({ ...entryForm, task_id: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                                    >
                                        <option value="">General / No specific task</option>
                                        {availableTasksForProject.map(t => (
                                            <option key={t.id} value={t.id}>{t.title}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Work Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={entryForm.work_date}
                                        onChange={(e) => setEntryForm({ ...entryForm, work_date: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Category</label>
                                    <select
                                        value={entryForm.category}
                                        onChange={(e) => setEntryForm({ ...entryForm, category: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                                    >
                                        <option value="DEVELOPMENT">Development</option>
                                        <option value="DESIGN">Design / UI</option>
                                        <option value="MEETING">Client / Team Meeting</option>
                                        <option value="QA">QA & Testing</option>
                                        <option value="SUPPORT">Support & Bug Fixing</option>
                                        <option value="DOCUMENTATION">Documentation</option>
                                        <option value="OTHER">Other</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 items-end">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Duration *</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                min="0"
                                                max="24"
                                                value={entryForm.duration_hours}
                                                onChange={(e) => setEntryForm({ ...entryForm, duration_hours: e.target.value })}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-center font-bold"
                                            />
                                            <span className="text-[10px] text-slate-400 text-center block mt-0.5">Hours</span>
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="number"
                                                min="0"
                                                max="59"
                                                step="5"
                                                value={entryForm.duration_minutes}
                                                onChange={(e) => setEntryForm({ ...entryForm, duration_minutes: e.target.value })}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-center font-bold"
                                            />
                                            <span className="text-[10px] text-slate-400 text-center block mt-0.5">Mins</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                                    <span className="font-bold text-slate-700">Billable to Client</span>
                                    <input
                                        type="checkbox"
                                        checked={entryForm.is_billable}
                                        onChange={(e) => setEntryForm({ ...entryForm, is_billable: e.target.checked })}
                                        className="w-4 h-4 text-[#2878C7] rounded-sm focus:ring-[#2878C7] cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Description of Work *</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={entryForm.description}
                                    onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
                                    placeholder="Describe specific features delivered, bug fixes, or deliverables completed..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsEntryModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingEntry}
                                    className="px-4 py-2 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {savingEntry ? "Saving..." : editingEntryId ? "Update Entry" : "Save Time Entry"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal: Reject Timesheet Reason ───────────────────────────────── */}
            {rejectModalTimesheet && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-sm text-slate-900">
                                Reject Timesheet
                            </h3>
                            <button
                                onClick={() => setRejectModalTimesheet(null)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-xs">
                            <div>Employee: <strong className="text-slate-800">{rejectModalTimesheet.user_name}</strong></div>
                            <div>Total Hours: <strong className="text-slate-800">{rejectModalTimesheet.total_hours} hrs</strong></div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Rejection Reason *</label>
                            <textarea
                                required
                                rows={3}
                                value={rejectionComment}
                                onChange={(e) => setRejectionComment(e.target.value)}
                                placeholder="Explain why this timesheet requires revision (e.g. Missing task details on Tuesday, Overbooked meeting hours)..."
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                            />
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => setRejectModalTimesheet(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={submittingAction}
                                onClick={handleRejectTimesheet}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer disabled:opacity-50"
                            >
                                {submittingAction ? "Rejecting..." : "Reject & Return to Employee"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
