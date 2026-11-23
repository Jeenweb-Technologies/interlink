import React from "react";

// Helper to strip HTML tags and unescape entities like &nbsp; to clean plain text
export const stripHtmlToText = (html) => {
    if (!html) return "";
    try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const text = doc.body.textContent || "";
        return text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    } catch {
        return html
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/gi, " ")
            .replace(/&amp;/gi, "&")
            .replace(/&lt;/gi, "<")
            .replace(/&gt;/gi, ">")
            .replace(/&quot;/gi, '"')
            .replace(/&#39;/gi, "'")
            .replace(/\s+/g, " ")
            .trim();
    }
};

export default function NoteCard({
    note,
    currentUserId,
    onOpen,
    onTogglePin,
    onShare,
    onHistory,
    onDelete
}) {
    const isOwner = note.my_permission === "owner" || note.owner_id === currentUserId;
    const canEdit = isOwner || note.my_permission === "edit";

    // Priority badge styles
    const priorityConfig = {
        urgent: { bg: "bg-red-50 text-red-700 border-red-200", label: "Urgent" },
        high: { bg: "bg-amber-50 text-amber-700 border-amber-200", label: "High" },
        medium: { bg: "bg-blue-50 text-blue-700 border-blue-200", label: "Medium" },
        low: { bg: "bg-slate-50 text-slate-600 border-slate-200", label: "Low" }
    };
    const pCfg = priorityConfig[note.priority] || priorityConfig.medium;

    // Background color styling
    const cardBgColor = note.color && note.color !== "#FFFFFF" ? note.color : "#FFFFFF";

    return (
        <div
            onClick={() => onOpen(note)}
            style={{ backgroundColor: cardBgColor }}
            className={`group relative flex flex-col justify-between rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden p-5 min-h-[220px] ${
                note.is_pinned ? "ring-2 ring-[#2878C7]/30 border-[#2878C7]/40" : ""
            }`}
        >
            {/* Top Bar: Badges & Pin */}
            <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {/* Priority Badge */}
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${pCfg.bg}`}>
                            {pCfg.label}
                        </span>

                        {/* Ownership / Sharing Badge */}
                        {isOwner ? (
                            note.shares_count > 0 ? (
                                <span className="px-2 py-0.5 text-xs font-medium rounded border bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    Shared ({note.shares_count})
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 text-xs font-medium rounded border bg-slate-100 text-slate-600 border-slate-200 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    Private
                                </span>
                            )
                        ) : (
                            <span className="px-2 py-0.5 text-xs font-medium rounded border bg-sky-50 text-sky-700 border-sky-200 flex items-center gap-1">
                                <span className="capitalize">{note.my_permission || "view"}</span>
                                <span className="text-slate-400">•</span>
                                <span className="truncate max-w-[90px]">{note.owner_name}</span>
                            </span>
                        )}
                    </div>

                    {/* Pin Button */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(note.id);
                        }}
                        title={note.is_pinned ? "Unpin note" : "Pin note to top"}
                        className={`p-1.5 rounded-lg transition-colors ${
                            note.is_pinned
                                ? "text-[#2878C7] bg-blue-50 hover:bg-blue-100"
                                : "text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-700 hover:bg-slate-100"
                        }`}
                    >
                        <svg className="w-4 h-4" fill={note.is_pinned ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                    </button>
                </div>

                {/* Title */}
                <h3 className="text-base font-semibold text-[#17212F] line-clamp-1 mb-1.5 group-hover:text-[#2878C7] transition-colors">
                    {note.title}
                </h3>

                {/* Content Snippet */}
                <p className="text-xs text-[#5B6573] line-clamp-3 leading-relaxed mb-3 whitespace-pre-wrap">
                    {note.content ? stripHtmlToText(note.content).slice(0, 160) : "No additional text content..."}
                </p>

                {/* Labels / Tags */}
                {Array.isArray(note.labels) && note.labels.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                        {note.labels.slice(0, 3).map((lbl, idx) => (
                            <span
                                key={idx}
                                className="px-1.5 py-0.5 text-[11px] font-medium bg-slate-200/70 text-slate-700 rounded"
                            >
                                #{lbl}
                            </span>
                        ))}
                        {note.labels.length > 3 && (
                            <span className="text-[11px] text-slate-400 self-center">
                                +{note.labels.length - 3}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Footer: Indicators & Actions */}
            <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-[#5B6573]">
                {/* Micro indicators */}
                <div className="flex items-center gap-3">
                    {note.total_checklists > 0 && (
                        <span className="flex items-center gap-1 text-[11px] font-medium" title={`${note.completed_checklists} of ${note.total_checklists} completed`}>
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            {note.completed_checklists}/{note.total_checklists}
                        </span>
                    )}

                    {note.attachments_count > 0 && (
                        <span className="flex items-center gap-1 text-[11px]" title={`${note.attachments_count} attachments`}>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            {note.attachments_count}
                        </span>
                    )}

                    {note.links_count > 0 && (
                        <span className="flex items-center gap-1 text-[11px]" title={`${note.links_count} linked entities`}>
                            <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            {note.links_count}
                        </span>
                    )}

                    <span className="text-[11px] text-slate-400">
                        v{note.version}
                    </span>
                </div>

                {/* Hover Quick Actions */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    {/* Share Modal Trigger (Owner or Admin) */}
                    {isOwner && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onShare(note);
                            }}
                            title="Share and Permissions"
                            className="p-1 hover:bg-slate-200/80 rounded text-slate-600 hover:text-[#17365D]"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                        </button>
                    )}

                    {/* History Drawer Trigger */}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            onHistory(note);
                        }}
                        title="Version and Activity History"
                        className="p-1 hover:bg-slate-200/80 rounded text-slate-600 hover:text-[#17365D]"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>

                    {/* Delete Trigger (Owner only) */}
                    {isOwner && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(note.id);
                            }}
                            title="Delete note"
                            className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
