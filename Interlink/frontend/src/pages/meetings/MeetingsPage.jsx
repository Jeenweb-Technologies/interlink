import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getMeetings, createInstantMeeting } from "../../api/meetingApi";
import MeetingSchedulerModal from "../../components/meetings/MeetingSchedulerModal";

export default function MeetingsPage() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterTab, setFilterTab] = useState("all"); // all, live, scheduled, ended
    const [searchQuery, setSearchQuery] = useState("");
    const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
    const [creatingInstant, setCreatingInstant] = useState(false);

    const fetchMeetings = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (filterTab === "live") params.status = "live";
            else if (filterTab === "scheduled") params.status = "scheduled";
            else if (filterTab === "ended") params.status = "ended";
            if (searchQuery.trim()) params.search = searchQuery.trim();

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
    }, [filterTab, searchQuery]);

    useEffect(() => {
        fetchMeetings();
    }, [fetchMeetings]);

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
        e.stopPropagation();
        const inviteUrl = `${window.location.origin}/meetings/join/${roomCode}`;
        navigator.clipboard.writeText(inviteUrl);
        toast.success("Meeting invitation link copied to clipboard!");
    };

    return (
        <div className="flex-1 bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
            {/* Top Header */}
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 text-2xl">
                            <i className="fa-solid fa-video"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-slate-900">
                                Meetings &amp; Whiteboard Studio
                            </h1>
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

                {/* Filters & Search Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl w-full sm:w-auto">
                        {[
                            { key: "all", label: "All Meetings", icon: "fa-layer-group" },
                            { key: "live", label: "Live Now", icon: "fa-circle-dot text-rose-500" },
                            { key: "scheduled", label: "Scheduled", icon: "fa-calendar-clock" },
                            { key: "ended", label: "History", icon: "fa-clock-rotate-left" }
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setFilterTab(tab.key)}
                                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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

                    {/* Search */}
                    <div className="relative w-full sm:w-72">
                        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input
                            type="text"
                            placeholder="Search by title or room code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                        />
                    </div>
                </div>

                {/* Meetings Grid */}
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-600"></i>
                        <span className="text-sm font-medium">Loading meetings...</span>
                    </div>
                ) : meetings.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
                        <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto text-2xl">
                            <i className="fa-solid fa-video-slash"></i>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">No meetings found</h3>
                            <p className="text-xs text-slate-500 mt-1">
                                {searchQuery ? "Try refining your search keyword" : "Start an instant video conference or schedule one for your team."}
                            </p>
                        </div>
                        <button
                            onClick={handleStartInstant}
                            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 transition-all inline-flex items-center gap-2"
                        >
                            <i className="fa-solid fa-bolt"></i>
                            Start Instant Meeting
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {meetings.map((m) => {
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
