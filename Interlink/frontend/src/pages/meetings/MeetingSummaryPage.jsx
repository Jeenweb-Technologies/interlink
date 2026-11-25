import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getMeetingSummary } from "../../api/meetingApi";

export default function MeetingSummaryPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getMeetingSummary(id)
            .then((res) => {
                if (res.data?.success && res.data.summary) {
                    setSummary(res.data.summary);
                } else {
                    toast.error("Meeting summary not found");
                }
            })
            .catch((err) => {
                console.error("Failed to load summary:", err);
                toast.error("Failed to load meeting summary");
            })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex-1 min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
                <i className="fa-solid fa-circle-notch fa-spin text-3xl text-blue-600"></i>
                <span className="text-sm font-medium">Loading meeting artifacts &amp; summary...</span>
            </div>
        );
    }

    if (!summary || !summary.meeting) {
        return (
            <div className="flex-1 min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-2xl mb-3">
                    <i className="fa-solid fa-file-circle-xmark"></i>
                </div>
                <h2 className="text-lg font-bold text-slate-900">Meeting Summary Unavailable</h2>
                <p className="text-xs text-slate-500 mt-1 mb-4">The requested meeting record could not be found.</p>
                <button
                    onClick={() => navigate("/meetings")}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                >
                    Back to Meetings
                </button>
            </div>
        );
    }

    const { meeting, participants = [], whiteboard, notes, recordings = [] } = summary;

    let parsedActionItems = [];
    if (notes && notes.action_items) {
        try {
            parsedActionItems = typeof notes.action_items === "string"
                ? JSON.parse(notes.action_items)
                : notes.action_items;
        } catch (e) {
            parsedActionItems = [];
        }
    }

    return (
        <div className="flex-1 bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
                            <i className="fa-solid fa-clipboard-check"></i>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                                    {meeting.title}
                                </h1>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    {meeting.status?.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Room Code: <span className="font-mono text-blue-600 font-bold">{meeting.room_code}</span> • Hosted by {meeting.host_name}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate("/meetings")}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
                        >
                            All Meetings
                        </button>
                        {meeting.status !== "ended" && (
                            <button
                                onClick={() => navigate(`/meetings/join/${meeting.room_code}`)}
                                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md hover:bg-blue-700 transition-colors"
                            >
                                Rejoin Room
                            </button>
                        )}
                    </div>
                </div>

                {/* Grid: Overview, Notes & Attendance */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left (2 cols): Notes & Whiteboard Artifact */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Notes & Decisions */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-note-sticky text-amber-500"></i>
                                    <h2 className="text-sm font-bold text-slate-900">Meeting Minutes &amp; Notes</h2>
                                </div>
                                {notes?.author_name && (
                                    <span className="text-[11px] text-slate-400">
                                        Recorded by {notes.author_name}
                                    </span>
                                )}
                            </div>

                            {notes?.notes_content ? (
                                <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-sans bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    {notes.notes_content}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic">No textual minutes were recorded during this session.</p>
                            )}

                            {/* Action Items */}
                            {parsedActionItems.length > 0 && (
                                <div className="pt-2 space-y-2">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Assigned Action Items ({parsedActionItems.length})
                                    </h3>
                                    <div className="space-y-1.5">
                                        {parsedActionItems.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2 text-xs"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <i
                                                        className={`fa-solid ${
                                                            item.completed
                                                                ? "fa-circle-check text-emerald-500"
                                                                : "fa-circle-dot text-amber-500"
                                                        }`}
                                                    ></i>
                                                    <span className={item.completed ? "line-through text-slate-400" : "text-slate-800 font-medium"}>
                                                        {item.text}
                                                    </span>
                                                </div>
                                                {item.assignee && (
                                                    <span className="text-[10px] font-semibold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                                                        {item.assignee}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Whiteboard Artifact */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-chalkboard-user text-blue-600"></i>
                                    <h2 className="text-sm font-bold text-slate-900">Whiteboard Canvas Snapshot</h2>
                                </div>
                                {whiteboard?.title && (
                                    <span className="text-[11px] text-slate-400">{whiteboard.title}</span>
                                )}
                            </div>

                            {whiteboard?.thumbnail_url ? (
                                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-900 p-2 flex items-center justify-center">
                                    <img
                                        src={whiteboard.thumbnail_url}
                                        alt="Whiteboard Snapshot"
                                        className="max-h-96 w-full object-contain rounded-lg"
                                    />
                                </div>
                            ) : (
                                <div className="p-8 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-400">
                                    No whiteboard drawing was preserved during this session.
                                </div>
                            )}
                        </div>

                        {/* Recordings */}
                        {recordings.length > 0 && (
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <i className="fa-solid fa-record-vinyl text-rose-500"></i>
                                    <h2 className="text-sm font-bold text-slate-900">Archived Recordings</h2>
                                </div>

                                <div className="space-y-3">
                                    {recordings.map((rec) => (
                                        <div
                                            key={rec.id}
                                            className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
                                                    <i className="fa-solid fa-play"></i>
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800">
                                                        Session Recording ({rec.duration_seconds || 0}s)
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        Captured by {rec.recorded_by_name || "Host"} • {new Date(rec.created_at).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>

                                            <a
                                                href={rec.file_url}
                                                download="meeting-recording.webm"
                                                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-semibold transition-colors flex items-center gap-1.5"
                                            >
                                                <i className="fa-solid fa-download"></i>
                                                <span>Download</span>
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right (1 col): Attendance & Project Details */}
                    <div className="space-y-6">
                        {/* Attendance Log */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-users text-purple-600"></i>
                                    <h2 className="text-sm font-bold text-slate-900">Attendance Log</h2>
                                </div>
                                <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                                    {participants.length} attended
                                </span>
                            </div>

                            <div className="space-y-2">
                                {participants.map((p) => (
                                    <div
                                        key={p.id}
                                        className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                                {(p.display_name || "P")[0].toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-semibold text-slate-800 truncate">
                                                    {p.display_name}
                                                </div>
                                                <div className="text-[10px] text-slate-400 truncate">
                                                    {p.role?.toUpperCase()}
                                                </div>
                                            </div>
                                        </div>

                                        <span className="text-[10px] font-mono text-slate-500 shrink-0">
                                            {p.duration_seconds ? `${Math.round(p.duration_seconds / 60)} min` : "Present"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Project / Task Linkage */}
                        {(meeting.project_name || meeting.task_name) && (
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-3">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    Workspace Linkage
                                </h3>
                                {meeting.project_name && (
                                    <div
                                        onClick={() => navigate(`/projects/${meeting.project_id}`)}
                                        className="p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-900 cursor-pointer hover:bg-indigo-100/70 transition-colors"
                                    >
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                                            Linked Project
                                        </div>
                                        <div className="font-bold text-xs mt-0.5">{meeting.project_name}</div>
                                    </div>
                                )}
                                {meeting.task_name && (
                                    <div
                                        onClick={() => navigate("/tasks")}
                                        className="p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-900 cursor-pointer hover:bg-emerald-100/70 transition-colors"
                                    >
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                                            Linked Task
                                        </div>
                                        <div className="font-bold text-xs mt-0.5">{meeting.task_name}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
