import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getNoteHistory, restoreNoteVersion } from "../../api/noteApi";
import { stripHtmlToText } from "./NoteCard";

export default function NoteHistoryDrawer({
    noteId,
    isOpen,
    onClose,
    onVersionRestored
}) {
    const [activeTab, setActiveTab] = useState("versions"); // 'versions' | 'activities'
    const [loading, setLoading] = useState(false);
    const [versions, setVersions] = useState([]);
    const [activities, setActivities] = useState([]);
    const [selectedVersion, setSelectedVersion] = useState(null);
    const [restoring, setRestoring] = useState(false);

    useEffect(() => {
        if (!isOpen || !noteId) return;

        setLoading(true);
        getNoteHistory(noteId)
            .then((res) => {
                setVersions(res.data.versions || []);
                setActivities(res.data.activities || []);
                if (res.data.versions?.length > 0) {
                    setSelectedVersion(res.data.versions[0]);
                }
            })
            .catch((err) => {
                console.error("Failed to load history:", err);
                toast.error("Failed to load note history");
            })
            .finally(() => setLoading(false));
    }, [isOpen, noteId]);

    const handleRestore = async (version) => {
        if (!window.confirm(`Restore note to Version ${version.version_number}? This will update the current note.`)) {
            return;
        }

        setRestoring(true);
        try {
            await restoreNoteVersion(noteId, version.id);
            toast.success(`Restored to Version ${version.version_number}`);
            if (onVersionRestored) onVersionRestored();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to restore version");
        } finally {
            setRestoring(false);
        }
    };

    if (!isOpen) return null;

    // Action format helper
    const renderActionBadge = (actionType) => {
        const badges = {
            created: { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Created" },
            updated: { bg: "bg-blue-50 text-blue-700 border-blue-200", label: "Updated" },
            shared: { bg: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "Shared" },
            permission_changed: { bg: "bg-amber-50 text-amber-700 border-amber-200", label: "Permission Changed" },
            access_revoked: { bg: "bg-red-50 text-red-700 border-red-200", label: "Access Revoked" },
            pinned: { bg: "bg-sky-50 text-sky-700 border-sky-200", label: "Pinned" },
            unpinned: { bg: "bg-slate-50 text-slate-700 border-slate-200", label: "Unpinned" },
            linked: { bg: "bg-purple-50 text-purple-700 border-purple-200", label: "Linked Entity" },
            restored: { bg: "bg-teal-50 text-teal-700 border-teal-200", label: "Restored" }
        };
        const b = badges[actionType] || { bg: "bg-slate-100 text-slate-600 border-slate-200", label: actionType };
        return <span className={`px-2 py-0.5 text-[11px] font-semibold rounded border ${b.bg}`}>{b.label}</span>;
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-150">
            <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div>
                        <h3 className="text-base font-bold text-[#17365D] flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#2878C7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Note History & Audit
                        </h3>
                        <p className="text-xs text-[#5B6573]">Version snapshots and collaborator activity</p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-white px-6">
                    <button
                        type="button"
                        onClick={() => setActiveTab("versions")}
                        className={`py-3 text-xs font-semibold border-b-2 mr-6 transition-colors flex items-center gap-1.5 ${
                            activeTab === "versions"
                                ? "border-[#2878C7] text-[#2878C7]"
                                : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        <span>Version Snapshots</span>
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full text-[10px]">
                            {versions.length}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("activities")}
                        className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                            activeTab === "activities"
                                ? "border-[#2878C7] text-[#2878C7]"
                                : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                    >
                        <span>Activity Trail</span>
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-full text-[10px]">
                            {activities.length}
                        </span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="space-y-4 animate-pulse">
                            <div className="h-12 bg-slate-100 rounded"></div>
                            <div className="h-12 bg-slate-100 rounded"></div>
                            <div className="h-12 bg-slate-100 rounded"></div>
                        </div>
                    ) : activeTab === "versions" ? (
                        <div className="space-y-4">
                            {versions.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-8">
                                    No version snapshots recorded yet.
                                </p>
                            ) : (
                                versions.map((v) => {
                                    const isSelected = selectedVersion?.id === v.id;
                                    return (
                                        <div
                                            key={v.id}
                                            onClick={() => setSelectedVersion(v)}
                                            className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                                isSelected
                                                    ? "border-[#2878C7] bg-blue-50/50 shadow-xs ring-1 ring-[#2878C7]/20"
                                                    : "border-slate-200 bg-white hover:border-slate-300"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-[#17365D] bg-slate-100 px-2 py-0.5 rounded">
                                                        v{v.version_number}
                                                    </span>
                                                    <span className="text-xs text-slate-600 font-medium truncate max-w-[200px]">
                                                        {v.title}
                                                    </span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRestore(v);
                                                    }}
                                                    disabled={restoring}
                                                    className="text-xs font-semibold text-[#2878C7] hover:text-[#1e63a8] hover:bg-blue-100/60 px-2.5 py-1 rounded transition-colors"
                                                >
                                                    Restore
                                                </button>
                                            </div>

                                            <p className="text-[11px] text-[#5B6573] line-clamp-2 mb-2">
                                                {v.content ? stripHtmlToText(v.content).slice(0, 120) : "Empty content"}
                                            </p>

                                            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                                                <span>Edited by {v.edited_by_name}</span>
                                                <span>{new Date(v.created_at).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        /* Activities Trail */
                        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                            {activities.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-8">
                                    No activity logs recorded yet.
                                </p>
                            ) : (
                                activities.map((act) => (
                                    <div key={act.id} className="relative group">
                                        {/* Dot */}
                                        <div className="absolute -left-[1.8rem] top-1 w-3 h-3 rounded-full bg-[#2878C7] ring-4 ring-white"></div>

                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-2">
                                                {renderActionBadge(act.action_type)}
                                                <span className="text-xs font-medium text-[#17212F]">
                                                    {act.user_name}
                                                </span>
                                            </div>
                                            <span className="text-[11px] text-slate-400">
                                                {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(act.created_at).toLocaleDateString()}
                                            </span>
                                        </div>

                                        {act.details && (
                                            <p className="text-xs text-[#5B6573] bg-slate-50 p-2 rounded border border-slate-100">
                                                {typeof act.details === 'object' ? JSON.stringify(act.details) : act.details}
                                            </p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#17365D] hover:bg-[#102642] text-white transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
