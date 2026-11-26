import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getMeetings, createInstantMeeting } from "../../api/meetingApi";
import { getProjects } from "../../api/projectApi";
import MeetingSchedulerModal from "../../components/meetings/MeetingSchedulerModal";

export default function MeetingsPage() {
    const navigate = useNavigate();
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user") || "{}");
        } catch {
            return {};
        }
    }, []);

    const [meetings, setMeetings] = useState([]);
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterTab, setFilterTab] = useState("all"); // all, live, scheduled, ended
    const [scope, setScope] = useState("all"); // "my" or "all"
    const [selectedProject, setSelectedProject] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Display & Pagination
    const [viewMode, setViewMode] = useState(() => localStorage.getItem("meetings_view_mode") || "grid");
    const [pageSize, setPageSize] = useState(9);
    const [currentPage, setCurrentPage] = useState(1);

    // Modals & Instant meeting
    const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
    const [creatingInstant, setCreatingInstant] = useState(false);

    // Fetch projects for project filter dropdown
    useEffect(() => {
        getProjects()
            .then((res) => {
                if (res.data?.projects) {
                    setProjects(res.data.projects);
                } else if (Array.isArray(res.data)) {
                    setProjects(res.data);
                }
            })
            .catch(() => {});
    }, []);

    const fetchMeetings = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterTab === "live") params.status = "live";
            else if (filterTab === "scheduled") params.status = "scheduled";
            else if (filterTab === "ended") params.status = "ended";
            if (searchQuery.trim()) params.search = searchQuery.trim();
            if (selectedProject !== "all") params.project_id = selectedProject;

            const res = await getMeetings(params);
            if (res.data?.success) {
                setMeetings(res.data.meetings || []);
            }
        } catch (err) {
            console.error("Failed to fetch meetings:", err);
            toast.error("Failed to load meetings");
        } finally {
            setLoading(false);
        }
    }, [filterTab, searchQuery, selectedProject]);

    useEffect(() => {
        fetchMeetings();
    }, [fetchMeetings]);

    // Reset pagination to first page when any filter criteria changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filterTab, scope, selectedProject, searchQuery, pageSize]);

    const handleSetViewMode = (mode) => {
        setViewMode(mode);
        localStorage.setItem("meetings_view_mode", mode);
    };

    const handleStartInstant = async () => {
        setCreatingInstant(true);
        try {
            const res = await createInstantMeeting({
                title: `${user.name || "User"}'s Instant Meeting`,
                is_lobby_enabled: true
            });

            if (res.data?.success && res.data.meeting) {
                toast.success("Instant meeting created!");
                const roomCode = res.data.meeting.room_code;
                navigate(`/meetings/join/${roomCode}`);
            } else {
                toast.error(res.data?.message || "Failed to launch meeting");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || "Failed to launch instant meeting");
        } finally {
            setCreatingInstant(false);
        }
    };

    const handleCopyInvite = (roomCode, e) => {
        if (e) e.stopPropagation();
        const inviteUrl = `${window.location.origin}/meetings/join/${roomCode}`;
        navigator.clipboard.writeText(inviteUrl);
        toast.success("Meeting invitation link copied to clipboard!");
    };

    // Client-side filtering for scope & project backup
    const filteredMeetings = useMemo(() => {
        return meetings.filter((m) => {
            // Scope filter: "My Meetings" vs "All Company"
            if (scope === "my") {
                const isHost = (user.id && m.host_id === user.id) || (user.email && m.host_email === user.email);
                if (!isHost) return false;
            }

            // Project filter
            if (selectedProject !== "all" && String(m.project_id) !== String(selectedProject)) {
                return false;
            }

            return true;
        });
    }, [meetings, scope, selectedProject, user]);

    // Live meetings count indicator
    const liveCount = useMemo(() => meetings.filter((m) => m.status === "live").length, [meetings]);

    // Pagination calculations
    const totalItems = filteredMeetings.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, totalItems);
    const paginatedMeetings = useMemo(() => {
        return filteredMeetings.slice(startIndex, endIndex);
    }, [filteredMeetings, startIndex, endIndex]);

    // Dynamic pagination page numbers (max 5 visible buttons with ellipsis)
    const paginationNumbers = useMemo(() => {
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return {
            pages,
            hasPreviousEllipsis: start > 1,
            hasNextEllipsis: end < totalPages
        };
    }, [currentPage, totalPages]);

    return (
        <div className="flex-1 bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* ─── Top Header ────────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 text-2xl">
                            <i className="fa-solid fa-video"></i>
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                                    Meetings &amp; Whiteboard Studio
                                </h1>
                                {liveCount > 0 && (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-200 animate-pulse">
                                        <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                                        {liveCount} Live
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleStartInstant}
                            disabled={creatingInstant}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                            {creatingInstant ? (
                                <i className="fa-solid fa-circle-notch fa-spin"></i>
                            ) : (
                                <i className="fa-solid fa-bolt"></i>
                            )}
                            <span>Start Instant Meeting</span>
                        </button>

                        <button
                            onClick={() => setIsSchedulerOpen(true)}
                            className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <i className="fa-solid fa-calendar-plus"></i>
                            <span>Schedule Meeting</span>
                        </button>
                    </div>
                </div>

                {/* ─── Control Bar: Status Tabs, Scope, Project & View Toggle ── */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3.5">
                    {/* Top Row: Tabs + Scope Toggle */}
                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                        {/* Scope Toggle: My Meetings vs All Company */}
                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto">
                            <button
                                onClick={() => setScope("all")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    scope === "all"
                                        ? "bg-white text-blue-600 shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                <i className="fa-solid fa-building text-[11px]"></i>
                                <span>All Company</span>
                            </button>
                            <button
                                onClick={() => setScope("my")}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    scope === "my"
                                        ? "bg-white text-blue-600 shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                <i className="fa-solid fa-user-tie text-[11px]"></i>
                                <span>My Meetings</span>
                            </button>
                        </div>

                        {/* Status Filter Tabs */}
                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
                            {[
                                { key: "all", label: "All Status", icon: "fa-layer-group" },
                                { key: "live", label: "Live Now", icon: "fa-circle-dot text-rose-500" },
                                { key: "scheduled", label: "Scheduled", icon: "fa-calendar-clock" },
                                { key: "ended", label: "Completed", icon: "fa-clock-rotate-left" }
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    onClick={() => setFilterTab(tab.key)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                        filterTab === tab.key
                                            ? "bg-white text-blue-600 shadow-xs"
                                            : "text-slate-600 hover:text-slate-900"
                                    }`}
                                >
                                    <i className={`fa-solid ${tab.icon} text-xs`}></i>
                                    <span>{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Row: Search, Project Filter & View Switcher */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
                        {/* Search Input */}
                        <div className="relative w-full sm:w-80">
                            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input
                                type="text"
                                placeholder="Search by title, host, or room code..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                            {/* Project Filter Dropdown */}
                            {projects.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <select
                                        value={selectedProject}
                                        onChange={(e) => setSelectedProject(e.target.value)}
                                        className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 cursor-pointer"
                                    >
                                        <option value="all">All Projects</option>
                                        {projects.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                📁 {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* View Switcher: Card Grid vs Compact Table */}
                            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => handleSetViewMode("grid")}
                                    title="Grid View (Cards)"
                                    className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        viewMode === "grid"
                                            ? "bg-white text-blue-600 shadow-xs"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    <i className="fa-solid fa-table-cells-large"></i>
                                </button>
                                <button
                                    onClick={() => handleSetViewMode("table")}
                                    title="Table View (High-Density List)"
                                    className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        viewMode === "table"
                                            ? "bg-white text-blue-600 shadow-xs"
                                            : "text-slate-500 hover:text-slate-800"
                                    }`}
                                >
                                    <i className="fa-solid fa-table-list"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Content Body: Grid vs Table vs Empty/Loading ────────── */}
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-600"></i>
                        <span className="text-sm font-medium">Loading meetings...</span>
                    </div>
                ) : filteredMeetings.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
                        <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-2xl">
                            <i className="fa-solid fa-video-slash"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">No meetings found</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {searchQuery || selectedProject !== "all" || scope === "my"
                                    ? "No meetings match your current filters. Try resetting search or switching to All Company."
                                    : "Start an instant video conference or schedule one for your team."}
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                            {(searchQuery || selectedProject !== "all" || scope === "my" || filterTab !== "all") && (
                                <button
                                    onClick={() => {
                                        setSearchQuery("");
                                        setSelectedProject("all");
                                        setScope("all");
                                        setFilterTab("all");
                                    }}
                                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                                >
                                    Reset Filters
                                </button>
                            )}
                            <button
                                onClick={handleStartInstant}
                                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 transition-all inline-flex items-center gap-2 cursor-pointer"
                            >
                                <i className="fa-solid fa-bolt"></i>
                                Start Instant Meeting
                            </button>
                        </div>
                    </div>
                ) : viewMode === "grid" ? (
                    /* ─── Grid View (Cards) ─── */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {paginatedMeetings.map((m) => {
                            const isLive = m.status === "live";
                            const isScheduled = m.status === "scheduled";
                            const isEnded = m.status === "ended";

                            return (
                                <div
                                    key={m.id}
                                    className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between group"
                                >
                                    {/* Card Top */}
                                    <div className="p-5 space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            {/* Status Badge */}
                                            {isLive && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200/80 animate-pulse">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                                    LIVE NOW
                                                </span>
                                            )}
                                            {isScheduled && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-600 border border-blue-200/80">
                                                    <i className="fa-regular fa-clock text-[10px]"></i>
                                                    {m.meeting_type === "instant" ? "In Green Room" : "Scheduled"}
                                                </span>
                                            )}
                                            {isEnded && (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200/80">
                                                    <i className="fa-solid fa-check text-[10px]"></i>
                                                    Completed
                                                </span>
                                            )}

                                            {/* Room Code Badge */}
                                            <button
                                                onClick={(e) => handleCopyInvite(m.room_code, e)}
                                                title="Copy Room Invitation Link"
                                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-mono text-xs transition-colors cursor-pointer"
                                            >
                                                <span>{m.room_code}</span>
                                                <i className="fa-regular fa-copy text-[10px]"></i>
                                            </button>
                                        </div>

                                        {/* Title & Description */}
                                        <div>
                                            <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 text-base">
                                                {m.title}
                                            </h3>
                                            {m.description && (
                                                <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                                                    {m.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Project / Task Tag */}
                                        {(m.project_name || m.task_name) && (
                                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                {m.project_name && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-100">
                                                        <i className="fa-solid fa-diagram-project text-[9px]"></i>
                                                        <span className="truncate max-w-[140px]">{m.project_name}</span>
                                                    </span>
                                                )}
                                                {m.task_name && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-100">
                                                        <i className="fa-solid fa-list-check text-[9px]"></i>
                                                        <span className="truncate max-w-[140px]">{m.task_name}</span>
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Scheduled Date or Host */}
                                        <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                                                    {m.host_name ? m.host_name[0].toUpperCase() : "H"}
                                                </div>
                                                <span className="truncate max-w-[100px] font-medium text-slate-700">{m.host_name}</span>
                                            </div>
                                            {m.scheduled_start ? (
                                                <span>
                                                    {new Date(m.scheduled_start).toLocaleDateString([], { month: "short", day: "numeric" })} at {new Date(m.scheduled_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                            ) : (
                                                <span>Instant Meeting</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Footer Actions */}
                                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                                        <button
                                            onClick={(e) => handleCopyInvite(m.room_code, e)}
                                            className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                            title="Share invitation link"
                                        >
                                            <i className="fa-solid fa-share-nodes"></i>
                                            <span>Share</span>
                                        </button>

                                        {isEnded ? (
                                            <button
                                                onClick={() => navigate(`/meetings/history/${m.id}`)}
                                                className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                            >
                                                <i className="fa-solid fa-clipboard-check text-blue-600"></i>
                                                <span>View Summary</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => navigate(`/meetings/join/${m.room_code}`)}
                                                className={`px-4 py-1.5 rounded-xl text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                                                    isLive
                                                        ? "bg-gradient-to-r from-rose-600 to-rose-700 shadow-rose-600/30 hover:brightness-110 animate-pulse"
                                                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
                                                }`}
                                            >
                                                <i className="fa-solid fa-arrow-right-to-bracket"></i>
                                                <span>{isLive ? "Join Live" : "Enter Green Room"}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* ─── Compact Table View (High-Density Enterprise List) ─── */
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold">
                                        <th className="py-3.5 px-4">Status</th>
                                        <th className="py-3.5 px-4">Meeting Title</th>
                                        <th className="py-3.5 px-4">Host</th>
                                        <th className="py-3.5 px-4">Linked Project / Task</th>
                                        <th className="py-3.5 px-4">Time / Schedule</th>
                                        <th className="py-3.5 px-4">Room Code</th>
                                        <th className="py-3.5 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedMeetings.map((m) => {
                                        const isLive = m.status === "live";
                                        const isScheduled = m.status === "scheduled";
                                        const isEnded = m.status === "ended";

                                        return (
                                            <tr
                                                key={m.id}
                                                className="hover:bg-slate-50/80 transition-colors group"
                                            >
                                                {/* Status Column */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    {isLive && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200 animate-pulse">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                                            LIVE
                                                        </span>
                                                    )}
                                                    {isScheduled && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                                                            <i className="fa-regular fa-clock text-[9px]"></i>
                                                            {m.meeting_type === "instant" ? "Lobby" : "Scheduled"}
                                                        </span>
                                                    )}
                                                    {isEnded && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                            <i className="fa-solid fa-check text-[9px]"></i>
                                                            Ended
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Title Column */}
                                                <td className="py-3 px-4 max-w-[240px]">
                                                    <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                                        {m.title}
                                                    </div>
                                                    {m.description && (
                                                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                                            {m.description}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Host Column */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                                                            {m.host_name ? m.host_name[0].toUpperCase() : "H"}
                                                        </div>
                                                        <span className="font-medium text-slate-700">{m.host_name || "Host"}</span>
                                                    </div>
                                                </td>

                                                {/* Project / Task Column */}
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        {m.project_name && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-100 truncate max-w-[130px]">
                                                                <i className="fa-solid fa-diagram-project text-[8px]"></i>
                                                                <span className="truncate">{m.project_name}</span>
                                                            </span>
                                                        )}
                                                        {m.task_name && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-100 truncate max-w-[130px]">
                                                                <i className="fa-solid fa-list-check text-[8px]"></i>
                                                                <span className="truncate">{m.task_name}</span>
                                                            </span>
                                                        )}
                                                        {!m.project_name && !m.task_name && (
                                                            <span className="text-slate-400 text-[11px] italic">—</span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Time Column */}
                                                <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                                                    {m.scheduled_start ? (
                                                        <span>
                                                            {new Date(m.scheduled_start).toLocaleDateString([], { month: "short", day: "numeric" })} at {new Date(m.scheduled_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic">Instant</span>
                                                    )}
                                                </td>

                                                {/* Room Code Column */}
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                    <button
                                                        onClick={(e) => handleCopyInvite(m.room_code, e)}
                                                        title="Copy Room Link"
                                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono text-[11px] transition-colors cursor-pointer"
                                                    >
                                                        <span>{m.room_code}</span>
                                                        <i className="fa-regular fa-copy text-[10px]"></i>
                                                    </button>
                                                </td>

                                                {/* Actions Column */}
                                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={(e) => handleCopyInvite(m.room_code, e)}
                                                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                                            title="Share Invite"
                                                        >
                                                            <i className="fa-solid fa-share-nodes text-xs"></i>
                                                        </button>

                                                        {isEnded ? (
                                                            <button
                                                                onClick={() => navigate(`/meetings/history/${m.id}`)}
                                                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <i className="fa-solid fa-clipboard-check text-blue-600 text-[10px]"></i>
                                                                <span>Summary</span>
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => navigate(`/meetings/join/${m.room_code}`)}
                                                                className={`px-3 py-1 rounded-lg text-white font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer ${
                                                                    isLive
                                                                        ? "bg-rose-600 hover:bg-rose-700"
                                                                        : "bg-blue-600 hover:bg-blue-700"
                                                                }`}
                                                            >
                                                                <i className="fa-solid fa-arrow-right-to-bracket text-[10px]"></i>
                                                                <span>{isLive ? "Join Live" : "Join"}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ─── Pagination Footer ────────────────────────────────────── */}
                {!loading && filteredMeetings.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs text-xs text-slate-500">
                        {/* Summary Counter */}
                        <div className="flex items-center gap-3">
                            <span>
                                Showing <strong className="font-bold text-slate-800">{totalItems > 0 ? startIndex + 1 : 0}</strong> to{" "}
                                <strong className="font-bold text-slate-800">{endIndex}</strong> of{" "}
                                <strong className="font-bold text-slate-800">{totalItems}</strong> meetings
                            </span>

                            {/* Page Size Selector */}
                            <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
                                <span>Show:</span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer focus:outline-hidden"
                                >
                                    <option value={9}>9 / page</option>
                                    <option value={18}>18 / page</option>
                                    <option value={36}>36 / page</option>
                                </select>
                            </div>
                        </div>

                        {/* Page Navigation Buttons */}
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                    disabled={currentPage <= 1}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold cursor-pointer flex items-center gap-1"
                                >
                                    <i className="fa-solid fa-chevron-left text-[10px]"></i>
                                    <span>Prev</span>
                                </button>

                                {paginationNumbers.hasPreviousEllipsis && (
                                    <>
                                        <button
                                            onClick={() => setCurrentPage(1)}
                                            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                                        >
                                            1
                                        </button>
                                        <span className="px-1 text-slate-400">...</span>
                                    </>
                                )}

                                {paginationNumbers.pages.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setCurrentPage(p)}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            currentPage === p
                                                ? "bg-blue-600 text-white shadow-xs"
                                                : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}

                                {paginationNumbers.hasNextEllipsis && (
                                    <>
                                        <span className="px-1 text-slate-400">...</span>
                                        <button
                                            onClick={() => setCurrentPage(totalPages)}
                                            className="w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                                        >
                                            {totalPages}
                                        </button>
                                    </>
                                )}

                                <button
                                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                    disabled={currentPage >= totalPages}
                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold cursor-pointer flex items-center gap-1"
                                >
                                    <span>Next</span>
                                    <i className="fa-solid fa-chevron-right text-[10px]"></i>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Scheduler Modal */}
            <MeetingSchedulerModal
                isOpen={isSchedulerOpen}
                onClose={() => setIsSchedulerOpen(false)}
                onMeetingScheduled={() => {
                    fetchMeetings();
                }}
            />
        </div>
    );
}
