import React, { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import {
    recordClockEvent,
    getTodayAttendance,
    getAttendanceHistory,
    requestAttendanceAdjustment,
    getAttendanceAdjustments,
    reviewAttendanceAdjustment,
    getTeamAttendanceBoard,
    getWorkSchedules
} from "../../api/attendanceApi";
import { getDepartments } from "../../api/departmentApi";

export default function AttendancePage() {
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const isAdmin = user.role === "admin" || user.role === "super admin";

    // Primary Tab: "today" | "calendar" | "admin"
    const [activeTab, setActiveTab] = useState("today");

    // Today's State
    const [todayData, setTodayData] = useState(null);
    const [loadingToday, setLoadingToday] = useState(true);
    const [clocking, setClocking] = useState(false);
    const [locationType, setLocationType] = useState("OFFICE");
    const [clockNotes, setClockNotes] = useState("");
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // Monthly History State
    const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
    const [historyData, setHistoryData] = useState(null);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Regularization / Correction Modal State
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const [adjustmentForm, setAdjustmentForm] = useState({
        work_date: new Date().toISOString().slice(0, 10),
        requested_clock_in: "09:00",
        requested_clock_out: "18:00",
        reason: ""
    });
    const [submittingAdjustment, setSubmittingAdjustment] = useState(false);

    // Admin & Management State
    const [adminSubTab, setAdminSubTab] = useState("board"); // "board" | "queue" | "schedules"
    const [teamBoard, setTeamBoard] = useState([]);
    const [loadingTeamBoard, setLoadingTeamBoard] = useState(false);
    const [teamSearch, setTeamSearch] = useState("");
    const [selectedDept, setSelectedDept] = useState("");
    const [departments, setDepartments] = useState([]);

    const [approvalQueue, setApprovalQueue] = useState([]);
    const [loadingQueue, setLoadingQueue] = useState(false);
    const [queueStatusFilter, setQueueStatusFilter] = useState("PENDING");

    const [schedules, setSchedules] = useState([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);

    // Review Modal State
    const [reviewModalRequest, setReviewModalRequest] = useState(null);
    const [reviewerComment, setReviewerComment] = useState("");
    const [reviewingAction, setReviewingAction] = useState(false);

    // ── 1. Fetch Today's Attendance & Active State ─────────────────────────────
    const fetchToday = useCallback(async () => {
        try {
            setLoadingToday(true);
            const res = await getTodayAttendance();
            if (res.data?.success) {
                setTodayData(res.data.data);
            }
        } catch (err) {
            console.error("Error loading today's attendance:", err);
            toast.error("Failed to load today's attendance status.");
        } finally {
            setLoadingToday(false);
        }
    }, []);

    // ── 2. Fetch Monthly History ───────────────────────────────────────────────
    const fetchHistory = useCallback(async (month) => {
        try {
            setLoadingHistory(true);
            const res = await getAttendanceHistory({ month });
            if (res.data?.success) {
                setHistoryData(res.data.data);
            }
        } catch (err) {
            console.error("Error loading attendance history:", err);
            toast.error("Failed to load monthly attendance history.");
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    // ── 3. Fetch Admin Data ───────────────────────────────────────────────────
    const fetchTeamBoard = useCallback(async () => {
        try {
            setLoadingTeamBoard(true);
            const res = await getTeamAttendanceBoard({ department_id: selectedDept || undefined });
            if (res.data?.success) {
                setTeamBoard(res.data.board || []);
            }
        } catch (err) {
            console.error("Error loading team board:", err);
        } finally {
            setLoadingTeamBoard(false);
        }
    }, [selectedDept]);

    const fetchQueue = useCallback(async () => {
        try {
            setLoadingQueue(true);
            const res = await getAttendanceAdjustments({
                queue: "manager",
                status: queueStatusFilter === "ALL" ? undefined : queueStatusFilter
            });
            if (res.data?.success) {
                setApprovalQueue(res.data.adjustments || []);
            }
        } catch (err) {
            console.error("Error loading approval queue:", err);
        } finally {
            setLoadingQueue(false);
        }
    }, [queueStatusFilter]);

    const fetchSchedules = useCallback(async () => {
        try {
            setLoadingSchedules(true);
            const res = await getWorkSchedules();
            if (res.data?.success) {
                setSchedules(res.data.schedules || []);
            }
        } catch (err) {
            console.error("Error loading schedules:", err);
        } finally {
            setLoadingSchedules(false);
        }
    }, []);

    // Initial Load
    useEffect(() => {
        fetchToday();
        getDepartments(false).then(r => {
            if (r.data?.success) setDepartments(r.data.departments || []);
        }).catch(() => {});
    }, [fetchToday]);

    // Tab Switch Actions
    useEffect(() => {
        if (activeTab === "calendar") {
            fetchHistory(selectedMonth);
        } else if (activeTab === "admin") {
            if (adminSubTab === "board") fetchTeamBoard();
            if (adminSubTab === "queue") fetchQueue();
            if (adminSubTab === "schedules") fetchSchedules();
        }
    }, [activeTab, adminSubTab, selectedMonth, fetchHistory, fetchTeamBoard, fetchQueue, fetchSchedules]);

    // Live Ticking Work Timer
    useEffect(() => {
        if (!todayData || todayData.activeState !== "CLOCKED_IN" || !todayData.lastClockInTimestamp) {
            return;
        }

        const initialWorkSec = (todayData.summary?.total_work_minutes || 0) * 60;
        const lastInMs = new Date(todayData.lastClockInTimestamp).getTime();

        const timer = setInterval(() => {
            const currentSessionSec = Math.max(0, Math.floor((Date.now() - lastInMs) / 1000));
            setElapsedSeconds(initialWorkSec + currentSessionSec);
        }, 1000);

        return () => clearInterval(timer);
    }, [todayData]);

    // Format seconds into HH:MM:SS
    const formatDuration = (totalSec) => {
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;
        return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    // ── Handle Real-Time Clock Event ───────────────────────────────────────────
    const handleClockEvent = async (eventType) => {
        setClocking(true);
        try {
            const res = await recordClockEvent({
                event_type: eventType,
                location_type: locationType,
                notes: clockNotes.trim() || null
            });
            if (res.data?.success) {
                toast.success(res.data.message || `Recorded ${eventType}`);
                setClockNotes("");
                fetchToday();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || `Failed to record ${eventType}`);
        } finally {
            setClocking(false);
        }
    };

    // ── Handle Submit Attendance Adjustment ────────────────────────────────────
    const handleSubmitAdjustment = async (e) => {
        e.preventDefault();
        if (!adjustmentForm.reason.trim()) {
            toast.error("Please provide a reason for the adjustment.");
            return;
        }
        setSubmittingAdjustment(true);
        try {
            const res = await requestAttendanceAdjustment(adjustmentForm);
            if (res.data?.success) {
                toast.success("Attendance correction request submitted!");
                setIsAdjustmentModalOpen(false);
                setAdjustmentForm({
                    work_date: new Date().toISOString().slice(0, 10),
                    requested_clock_in: "09:00",
                    requested_clock_out: "18:00",
                    reason: ""
                });
                if (activeTab === "calendar") fetchHistory(selectedMonth);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to submit request.");
        } finally {
            setSubmittingAdjustment(false);
        }
    };

    // ── Handle Review Adjustment (Approve / Reject) ────────────────────────────
    const handleReviewAdjustment = async (status) => {
        if (!reviewModalRequest) return;
        setReviewingAction(true);
        try {
            const res = await reviewAttendanceAdjustment(reviewModalRequest.id, {
                status,
                reviewer_comment: reviewerComment.trim() || undefined
            });
            if (res.data?.success) {
                toast.success(`Request ${status.toLowerCase()}!`);
                setReviewModalRequest(null);
                setReviewerComment("");
                fetchQueue();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to review request.");
        } finally {
            setReviewingAction(false);
        }
    };

    // Filtered Team Board
    const filteredTeam = useMemo(() => {
        return teamBoard.filter(m => {
            const q = teamSearch.toLowerCase();
            return (m.name && m.name.toLowerCase().includes(q)) ||
                   (m.email && m.email.toLowerCase().includes(q)) ||
                   (m.department_name && m.department_name.toLowerCase().includes(q));
        });
    }, [teamBoard, teamSearch]);

    return (
        <div className="flex flex-col flex-1 bg-[#F6F8FB] min-h-screen">
            {/* Top Header Bar */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0 shadow-2xs">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2878C7] flex items-center justify-center font-bold text-base border border-blue-100 shadow-2xs">
                            <i className="fa-solid fa-user-clock"></i>
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                Attendance & Time Tracking
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-[#0056cf]">
                                    Live
                                </span>
                            </h1>
                            <p className="text-xs text-slate-400">
                                Real-time check-in, breaks, shifts, and monthly attendance calendar.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Primary Tabs */}
                <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl self-start sm:self-auto text-xs font-bold">
                    <button
                        onClick={() => setActiveTab("today")}
                        className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === "today"
                                ? "bg-[#17365D] text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                        }`}
                    >
                        <i className="fa-solid fa-clock text-[11px]"></i>
                        <span>Today's Clock</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("calendar")}
                        className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                            activeTab === "calendar"
                                ? "bg-[#17365D] text-white shadow-xs"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                        }`}
                    >
                        <i className="fa-solid fa-calendar-days text-[11px]"></i>
                        <span>My Attendance History</span>
                    </button>
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab("admin")}
                            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-2 ${
                                activeTab === "admin"
                                    ? "bg-[#17365D] text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                            }`}
                        >
                            <i className="fa-solid fa-shield-halved text-[11px]"></i>
                            <span>Admin & Team Board</span>
                        </button>
                    )}
                </div>
            </div>

            {/* ── Main Tab Content ────────────────────────────────────────────── */}
            <div className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">

                {/* ════════════ TAB 1: ATT-01 TODAY'S CLOCK ══════════════════════ */}
                {activeTab === "today" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left 2 Cols: Punch Clock Card */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                                    <div>
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                            Current Status
                                        </span>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black shadow-xs ${
                                                todayData?.activeState === "CLOCKED_IN"
                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                    : todayData?.activeState === "ON_BREAK"
                                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                                    : "bg-slate-100 text-slate-700 border border-slate-200"
                                            }`}>
                                                <span className={`w-2 h-2 rounded-full ${
                                                    todayData?.activeState === "CLOCKED_IN"
                                                        ? "bg-emerald-500 animate-pulse"
                                                        : todayData?.activeState === "ON_BREAK"
                                                        ? "bg-amber-500"
                                                        : "bg-slate-400"
                                                }`}></span>
                                                {todayData?.activeState === "CLOCKED_IN"
                                                    ? "Clocked In & Active"
                                                    : todayData?.activeState === "ON_BREAK"
                                                    ? "On Break"
                                                    : "Clocked Out"}
                                            </span>
                                            {todayData?.summary?.status && (
                                                <span className="text-xs font-semibold text-slate-500">
                                                    Status: <strong className="text-slate-800">{todayData.summary.status}</strong>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Timer Display */}
                                    <div className="text-right sm:text-right">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                            Today's Work Timer
                                        </span>
                                        <div className="text-3xl sm:text-4xl font-mono font-black text-slate-900 tracking-tight mt-0.5">
                                            {formatDuration(elapsedSeconds || ((todayData?.summary?.total_work_minutes || 0) * 60))}
                                        </div>
                                    </div>
                                </div>

                                {/* Punch Action Controls */}
                                <div className="py-6 flex flex-col sm:flex-row items-center gap-4">
                                    {todayData?.activeState === "CLOCKED_OUT" ? (
                                        <button
                                            type="button"
                                            disabled={clocking}
                                            onClick={() => handleClockEvent("CLOCK_IN")}
                                            className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-base shadow-lg shadow-emerald-600/25 transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
                                        >
                                            <i className="fa-solid fa-play text-lg"></i>
                                            <span>{clocking ? "Recording..." : "Clock In for Today"}</span>
                                        </button>
                                    ) : todayData?.activeState === "ON_BREAK" ? (
                                        <>
                                            <button
                                                type="button"
                                                disabled={clocking}
                                                onClick={() => handleClockEvent("BREAK_END")}
                                                className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-base shadow-lg shadow-emerald-600/25 transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
                                            >
                                                <i className="fa-solid fa-play text-lg"></i>
                                                <span>{clocking ? "Recording..." : "End Break & Resume Work"}</span>
                                            </button>
                                            <button
                                                type="button"
                                                disabled={clocking}
                                                onClick={() => handleClockEvent("CLOCK_OUT")}
                                                className="w-full sm:w-auto py-4 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                                            >
                                                <i className="fa-solid fa-power-off text-rose-500"></i>
                                                <span>Clock Out</span>
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                disabled={clocking}
                                                onClick={() => handleClockEvent("BREAK_START")}
                                                className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-base shadow-lg shadow-amber-500/25 transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
                                            >
                                                <i className="fa-solid fa-mug-saucer text-lg"></i>
                                                <span>{clocking ? "Recording..." : "Start Break"}</span>
                                            </button>
                                            <button
                                                type="button"
                                                disabled={clocking}
                                                onClick={() => handleClockEvent("CLOCK_OUT")}
                                                className="w-full sm:flex-1 py-4 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white font-extrabold text-base shadow-lg shadow-rose-600/25 transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
                                            >
                                                <i className="fa-solid fa-stop text-lg"></i>
                                                <span>{clocking ? "Recording..." : "Clock Out"}</span>
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Location & Note Options */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100 text-xs">
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                            Work Location
                                        </label>
                                        <select
                                            value={locationType}
                                            onChange={(e) => setLocationType(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                                        >
                                            <option value="OFFICE">🏢 Primary Office</option>
                                            <option value="REMOTE">🏠 Remote / WFH</option>
                                            <option value="CLIENT_SITE">📍 Client Site</option>
                                        </select>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                                            Punch Note (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={clockNotes}
                                            onChange={(e) => setClockNotes(e.target.value)}
                                            placeholder="e.g. Arrived via morning shuttle, starting sprint review"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Today's Punch Events Timeline */}
                            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                                    <i className="fa-solid fa-timeline text-[#2878C7]"></i>
                                    Today's Activity Log
                                </h3>

                                {!todayData?.events || todayData.events.length === 0 ? (
                                    <div className="py-8 text-center text-slate-400 text-xs">
                                        No clock events recorded for today yet. Use the punch button above to begin your shift.
                                    </div>
                                ) : (
                                    <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-200">
                                        {todayData.events.map((ev, i) => (
                                            <div key={ev.id || i} className="relative flex items-center gap-3.5 pl-8 text-xs">
                                                <span className={`absolute left-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${
                                                    ev.event_type === "CLOCK_IN" ? "bg-emerald-500" :
                                                    ev.event_type === "CLOCK_OUT" ? "bg-rose-500" : "bg-amber-500"
                                                }`}></span>
                                                <div className="flex-1 flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                                    <div>
                                                        <span className="font-bold text-slate-900 mr-2">
                                                            {ev.event_type.replace("_", " ")}
                                                        </span>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-200 text-slate-600 font-semibold">
                                                            {ev.location_type}
                                                        </span>
                                                        {ev.notes && (
                                                            <p className="text-[11px] text-slate-500 mt-0.5 italic">"{ev.notes}"</p>
                                                        )}
                                                    </div>
                                                    <span className="font-mono text-xs font-bold text-slate-600">
                                                        {new Date(ev.event_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Col: Shift & Metrics Card */}
                        <div className="space-y-6">
                            {/* Assigned Shift Card */}
                            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <i className="fa-solid fa-business-time text-[#2878C7]"></i>
                                    Assigned Shift Details
                                </h3>

                                <div className="space-y-3 text-xs">
                                    <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100">
                                        <span className="text-[10px] font-bold text-[#0056cf] uppercase block">Shift Name</span>
                                        <span className="font-bold text-slate-900 text-sm">
                                            {todayData?.schedule?.name || "Standard General Shift"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                        <span className="text-slate-500">Working Hours:</span>
                                        <span className="font-bold text-slate-800">
                                            {todayData?.schedule?.start_time?.slice(0, 5) || "09:00"} — {todayData?.schedule?.end_time?.slice(0, 5) || "18:00"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                        <span className="text-slate-500">Arrival Grace Period:</span>
                                        <span className="font-bold text-emerald-700">
                                            {todayData?.schedule?.grace_period_minutes || 15} mins
                                        </span>
                                    </div>
                                    <div className="flex justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                                        <span className="text-slate-500">Allocated Break:</span>
                                        <span className="font-bold text-slate-800">
                                            {todayData?.schedule?.break_duration_minutes || 60} mins
                                        </span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setIsAdjustmentModalOpen(true)}
                                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    <i className="fa-solid fa-file-pen text-xs text-[#2878C7]"></i>
                                    <span>Request Attendance Regularization</span>
                                </button>
                            </div>

                            {/* Today Summary Metrics */}
                            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
                                <h3 className="text-sm font-bold text-slate-800 mb-2">Today's Summary</h3>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                                        <span className="text-[10px] text-slate-400 block font-bold uppercase">First Clock In</span>
                                        <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                                            {todayData?.summary?.first_clock_in
                                                ? new Date(todayData.summary.first_clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                : "—"}
                                        </span>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Last Clock Out</span>
                                        <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                                            {todayData?.summary?.last_clock_out
                                                ? new Date(todayData.summary.last_clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                : "—"}
                                        </span>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Break</span>
                                        <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                                            {todayData?.summary?.total_break_minutes || 0} mins
                                        </span>
                                    </div>
                                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center">
                                        <span className="text-[10px] text-slate-400 block font-bold uppercase">Late Arrival</span>
                                        <span className={`font-bold text-sm mt-0.5 block ${
                                            (todayData?.summary?.late_minutes || 0) > 0 ? "text-amber-600" : "text-emerald-600"
                                        }`}>
                                            {todayData?.summary?.late_minutes ? `${todayData.summary.late_minutes}m` : "On Time"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════ TAB 2: ATT-02 MY ATTENDANCE HISTORY ══════════════ */}
                {activeTab === "calendar" && (
                    <div className="space-y-6">
                        {/* Month Selector & Key Metrics Bar */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-500 uppercase">Select Month:</label>
                                <input
                                    type="month"
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="px-3 py-1.5 rounded-xl border border-slate-300 font-bold text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                                />
                            </div>

                            {/* Monthly Quick Stats */}
                            <div className="flex items-center gap-4 flex-wrap justify-center text-xs">
                                <div className="text-center px-3 py-1 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Present Days</span>
                                    <span className="text-emerald-700 font-black text-sm">
                                        {historyData?.stats?.presentCount || 0}
                                    </span>
                                </div>
                                <div className="text-center px-3 py-1 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Late Days</span>
                                    <span className="text-amber-600 font-black text-sm">
                                        {historyData?.stats?.lateCount || 0}
                                    </span>
                                </div>
                                <div className="text-center px-3 py-1 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Total Hours</span>
                                    <span className="text-slate-900 font-black text-sm">
                                        {historyData?.stats?.totalWorkHours || "0.0"} hrs
                                    </span>
                                </div>
                                <div className="text-center px-3 py-1 bg-slate-50 rounded-xl border border-slate-100">
                                    <span className="text-[10px] text-slate-400 block font-bold uppercase">Avg Daily</span>
                                    <span className="text-blue-700 font-black text-sm">
                                        {historyData?.stats?.averageDailyHours || "0.0"} hrs
                                    </span>
                                </div>
                                <button
                                    onClick={() => setIsAdjustmentModalOpen(true)}
                                    className="px-4 py-2 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                                >
                                    <i className="fa-solid fa-plus text-xs"></i>
                                    <span>Request Correction</span>
                                </button>
                            </div>
                        </div>

                        {/* Attendance History Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-sm text-slate-900">
                                    Daily Attendance Breakdown for {selectedMonth}
                                </h3>
                                <span className="text-xs text-slate-400">
                                    {historyData?.records?.length || 0} records logged
                                </span>
                            </div>

                            {loadingHistory ? (
                                <div className="p-12 text-center text-slate-400">
                                    <i className="fa-solid fa-spinner fa-spin text-xl text-[#2878C7]"></i>
                                    <p className="text-xs mt-2 font-semibold">Loading history...</p>
                                </div>
                            ) : !historyData?.records || historyData.records.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 text-xs">
                                    No attendance records found for {selectedMonth}.
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                            <tr>
                                                <th className="px-5 py-3">Date</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3">Clock In</th>
                                                <th className="px-4 py-3">Clock Out</th>
                                                <th className="px-4 py-3">Work Duration</th>
                                                <th className="px-4 py-3">Break Time</th>
                                                <th className="px-4 py-3">Late / Anomaly</th>
                                                <th className="px-4 py-3 text-right">Regularized</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-800">
                                            {historyData.records.map((r, i) => (
                                                <tr key={r.id || i} className="hover:bg-blue-50/40 transition-colors">
                                                    <td className="px-5 py-3.5 font-bold text-slate-900 whitespace-nowrap">
                                                        {new Date(r.work_date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                                            r.status === "PRESENT" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                                            r.status === "LATE" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                                            r.status === "HALF_DAY" ? "bg-blue-50 text-blue-700 border border-blue-200" :
                                                            "bg-rose-50 text-rose-700 border border-rose-200"
                                                        }`}>
                                                            {r.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3.5 font-mono text-slate-600">
                                                        {r.first_clock_in ? new Date(r.first_clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3.5 font-mono text-slate-600">
                                                        {r.last_clock_out ? new Date(r.last_clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3.5 font-bold text-slate-900">
                                                        {(Number(r.total_work_minutes || 0) / 60).toFixed(1)} hrs
                                                    </td>
                                                    <td className="px-4 py-3.5 text-slate-500">
                                                        {r.total_break_minutes || 0} mins
                                                    </td>
                                                    <td className="px-4 py-3.5">
                                                        {r.late_minutes > 0 ? (
                                                            <span className="text-amber-600 font-semibold text-[11px]">
                                                                +{r.late_minutes}m Late
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-[11px]">None</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3.5 text-right">
                                                        {r.is_regularized ? (
                                                            <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                                                                ✓ Regularized
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-[10px]">—</span>
                                                        )}
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

                {/* ════════════ TAB 3: ATT-03 ADMIN & TEAM PRESENCE BOARD ═══════ */}
                {activeTab === "admin" && isAdmin && (
                    <div className="space-y-6">
                        {/* Sub-Tabs Selector */}
                        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 text-xs font-bold">
                            <button
                                onClick={() => setAdminSubTab("board")}
                                className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                                    adminSubTab === "board"
                                        ? "bg-[#17365D] text-white shadow-xs"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                }`}
                            >
                                <i className="fa-solid fa-users mr-1.5"></i>
                                Live Team Presence Board
                            </button>
                            <button
                                onClick={() => setAdminSubTab("queue")}
                                className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                                    adminSubTab === "queue"
                                        ? "bg-[#17365D] text-white shadow-xs"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                }`}
                            >
                                <i className="fa-solid fa-clipboard-check mr-1.5"></i>
                                Correction Approval Queue
                            </button>
                            <button
                                onClick={() => setAdminSubTab("schedules")}
                                className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                                    adminSubTab === "schedules"
                                        ? "bg-[#17365D] text-white shadow-xs"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                                }`}
                            >
                                <i className="fa-solid fa-business-time mr-1.5"></i>
                                Work Schedules & Shifts
                            </button>
                        </div>

                        {/* Sub-Tab 1: Live Team Board */}
                        {adminSubTab === "board" && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="relative w-full sm:w-72">
                                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                        <input
                                            type="text"
                                            value={teamSearch}
                                            onChange={(e) => setTeamSearch(e.target.value)}
                                            placeholder="Search team member..."
                                            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <select
                                            value={selectedDept}
                                            onChange={(e) => setSelectedDept(e.target.value)}
                                            className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-semibold text-slate-700 focus:outline-none"
                                        >
                                            <option value="">All Departments</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.department_name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {loadingTeamBoard ? (
                                    <div className="py-12 text-center text-slate-400">
                                        <i className="fa-solid fa-spinner fa-spin text-xl text-[#2878C7]"></i>
                                        <p className="text-xs mt-2 font-semibold">Loading presence roster...</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                                        {filteredTeam.map(emp => (
                                            <div
                                                key={emp.user_id}
                                                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:shadow-xs transition-all flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2878C7] flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100">
                                                        {(emp.name || "U").charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="font-bold text-slate-900 text-xs truncate">{emp.name}</h4>
                                                        <p className="text-[11px] text-slate-400 truncate">
                                                            {emp.department_name || "General Staff"} • {emp.totalWorkHours} hrs today
                                                        </p>
                                                    </div>
                                                </div>

                                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${
                                                    emp.liveStatus === "CLOCKED_IN" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                                    emp.liveStatus === "ON_BREAK" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                                    emp.liveStatus === "CLOCKED_OUT" ? "bg-slate-100 text-slate-600" :
                                                    "bg-rose-50 text-rose-700 border border-rose-200"
                                                }`}>
                                                    {emp.liveStatus.replace("_", " ")}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Sub-Tab 2: Approval Queue */}
                        {adminSubTab === "queue" && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-sm text-slate-900">Attendance Adjustment Requests</h3>
                                    <select
                                        value={queueStatusFilter}
                                        onChange={(e) => setQueueStatusFilter(e.target.value)}
                                        className="px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-700"
                                    >
                                        <option value="PENDING">Pending Only</option>
                                        <option value="APPROVED">Approved Only</option>
                                        <option value="REJECTED">Rejected Only</option>
                                        <option value="ALL">All Requests</option>
                                    </select>
                                </div>

                                {loadingQueue ? (
                                    <div className="py-12 text-center text-slate-400">
                                        <i className="fa-solid fa-spinner fa-spin text-xl text-[#2878C7]"></i>
                                    </div>
                                ) : approvalQueue.length === 0 ? (
                                    <div className="py-12 text-center text-slate-400 text-xs">
                                        No adjustment requests matching status "{queueStatusFilter}".
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs border-collapse">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                                                <tr>
                                                    <th className="px-4 py-2.5">Employee</th>
                                                    <th className="px-4 py-2.5">Date</th>
                                                    <th className="px-4 py-2.5">Requested Hours</th>
                                                    <th className="px-4 py-2.5">Reason</th>
                                                    <th className="px-4 py-2.5">Status</th>
                                                    <th className="px-4 py-2.5 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {approvalQueue.map((req) => (
                                                    <tr key={req.id} className="hover:bg-slate-50/70">
                                                        <td className="px-4 py-3 font-bold text-slate-900">
                                                            {req.user_name}
                                                            <span className="block text-[10px] text-slate-400 font-normal">{req.department_name || "General"}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                                                            {new Date(req.work_date).toLocaleDateString()}
                                                        </td>
                                                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                                                            {req.requested_clock_in?.slice(0, 5)} — {req.requested_clock_out?.slice(0, 5)}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={req.reason}>
                                                            "{req.reason}"
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                req.status === "PENDING" ? "bg-amber-100 text-amber-800" :
                                                                req.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                                                            }`}>
                                                                {req.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {req.status === "PENDING" ? (
                                                                <button
                                                                    onClick={() => { setReviewModalRequest(req); setReviewerComment(""); }}
                                                                    className="px-3 py-1 rounded-lg bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold text-xs transition-colors cursor-pointer"
                                                                >
                                                                    Review
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400">
                                                                    Reviewed by {req.reviewer_name || "Admin"}
                                                                </span>
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

                        {/* Sub-Tab 3: Work Schedules */}
                        {adminSubTab === "schedules" && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                                <h3 className="font-bold text-sm text-slate-900">Work Schedules & Shifts</h3>
                                {loadingSchedules ? (
                                    <div className="py-12 text-center text-slate-400">
                                        <i className="fa-solid fa-spinner fa-spin text-xl text-[#2878C7]"></i>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {schedules.map(sch => (
                                            <div key={sch.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-bold text-slate-900 text-sm">{sch.name}</h4>
                                                    {sch.is_default && (
                                                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-[#0056cf] text-[10px] font-bold">
                                                            Default Shift
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                                                    <div className="text-slate-500">Hours: <strong className="text-slate-800">{sch.start_time?.slice(0, 5)} - {sch.end_time?.slice(0, 5)}</strong></div>
                                                    <div className="text-slate-500">Grace: <strong className="text-slate-800">{sch.grace_period_minutes} mins</strong></div>
                                                    <div className="text-slate-500">Break: <strong className="text-slate-800">{sch.break_duration_minutes} mins</strong></div>
                                                    <div className="text-slate-500">Type: <strong className="text-slate-800">{sch.schedule_type}</strong></div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Modal: Request Attendance Regularization ──────────────────────── */}
            {isAdjustmentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                                <i className="fa-solid fa-file-pen text-[#2878C7]"></i>
                                Request Attendance Regularization
                            </h3>
                            <button
                                onClick={() => setIsAdjustmentModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSubmitAdjustment} className="space-y-3.5 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Work Date *</label>
                                <input
                                    type="date"
                                    required
                                    value={adjustmentForm.work_date}
                                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, work_date: e.target.value })}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Requested In *</label>
                                    <input
                                        type="time"
                                        required
                                        value={adjustmentForm.requested_clock_in}
                                        onChange={(e) => setAdjustmentForm({ ...adjustmentForm, requested_clock_in: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                                    />
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Requested Out *</label>
                                    <input
                                        type="time"
                                        required
                                        value={adjustmentForm.requested_clock_out}
                                        onChange={(e) => setAdjustmentForm({ ...adjustmentForm, requested_clock_out: e.target.value })}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Reason / Justification *</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={adjustmentForm.reason}
                                    onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                                    placeholder="e.g. Biometric scanner issue, client site visit, electricity downtime..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAdjustmentModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAdjustment}
                                    className="px-4 py-2 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    {submittingAdjustment ? "Submitting..." : "Submit Correction Request"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal: Review Adjustment Request (Manager Action) ─────────────── */}
            {reviewModalRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="font-bold text-sm text-slate-900">
                                Review Attendance Correction
                            </h3>
                            <button
                                onClick={() => setReviewModalRequest(null)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500">Employee:</span>
                                <strong className="text-slate-800">{reviewModalRequest.user_name}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Date:</span>
                                <strong className="text-slate-800">{new Date(reviewModalRequest.work_date).toLocaleDateString()}</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500">Requested Timing:</span>
                                <strong className="text-slate-800">
                                    {reviewModalRequest.requested_clock_in?.slice(0, 5)} to {reviewModalRequest.requested_clock_out?.slice(0, 5)}
                                </strong>
                            </div>
                            <div>
                                <span className="text-slate-500 block mb-0.5">Reason:</span>
                                <p className="italic text-slate-700 font-semibold bg-white p-2 rounded-lg border border-slate-200">
                                    "{reviewModalRequest.reason}"
                                </p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Reviewer Comment (Optional)</label>
                            <input
                                type="text"
                                value={reviewerComment}
                                onChange={(e) => setReviewerComment(e.target.value)}
                                placeholder="e.g. Verified with manager log"
                                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2878C7]"
                            />
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2 text-xs">
                            <button
                                type="button"
                                disabled={reviewingAction}
                                onClick={() => handleReviewAdjustment("REJECTED")}
                                className="px-4 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Reject Request
                            </button>
                            <button
                                type="button"
                                disabled={reviewingAction}
                                onClick={() => handleReviewAdjustment("APPROVED")}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                                Approve & Regularize
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
