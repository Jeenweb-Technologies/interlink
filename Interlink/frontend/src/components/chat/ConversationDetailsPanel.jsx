import React, { useState, useMemo } from "react";

export default function ConversationDetailsPanel({
    conversation,
    messages = [],
    onClose,
    onViewFile,
    currentUserId,
    isAdmin = false,
    canDownload = true
}) {
    const [activeTab, setActiveTab] = useState("files"); // 'files' | 'media' | 'links' | 'members'

    const isGroup = (conversation?.type || "").toLowerCase() === "group";
    const isActivity = Boolean(conversation?.is_activity) || conversation?.title === "#activity";
    const isBroadcast = Boolean(conversation?.is_announcement || conversation?.is_company_broadcast);

    // Extract all attachments from the conversation messages
    const allAttachments = useMemo(() => {
        const list = [];
        messages.forEach(msg => {
            if (msg.is_deleted) return;
            const atts = Array.isArray(msg.attachments) ? msg.attachments : [];
            if (atts.length > 0) {
                atts.forEach(a => {
                    list.push({
                        ...a,
                        messageId: msg.id,
                        senderName: msg.sender_name || msg.sender_username || "User",
                        createdAt: msg.created_at
                    });
                });
            } else if (msg.attachmentId || msg.file_name || msg.file_url) {
                list.push({
                    id: msg.attachmentId || msg.id,
                    attachmentId: msg.attachmentId || msg.id,
                    original_name: msg.file_name || msg.original_name || "Attachment",
                    mime_type: msg.file_type || msg.mime_type || "",
                    file_size: msg.file_size || 0,
                    messageId: msg.id,
                    senderName: msg.sender_name || msg.sender_username || "User",
                    createdAt: msg.created_at
                });
            }
        });
        return list;
    }, [messages]);

    // Split into Documents vs Media
    const documents = useMemo(() => {
        return allAttachments.filter(a => {
            const mime = (a.mime_type || "").toLowerCase();
            const name = (a.original_name || "").toLowerCase();
            return !mime.startsWith("image/") && !mime.startsWith("video/") &&
                   !/\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov)$/i.test(name);
        });
    }, [allAttachments]);

    const mediaList = useMemo(() => {
        return allAttachments.filter(a => {
            const mime = (a.mime_type || "").toLowerCase();
            const name = (a.original_name || "").toLowerCase();
            return mime.startsWith("image/") || mime.startsWith("video/") ||
                   /\.(jpg|jpeg|png|gif|webp|svg|mp4|webm|mov)$/i.test(name);
        });
    }, [allAttachments]);

    // Extract links from message texts
    const sharedLinks = useMemo(() => {
        const links = [];
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        messages.forEach(msg => {
            if (msg.is_deleted) return;
            const text = msg.message_text || msg.content || "";
            const matches = text.match(urlRegex);
            if (matches) {
                matches.forEach(url => {
                    links.push({
                        url,
                        messageId: msg.id,
                        senderName: msg.sender_name || "User",
                        createdAt: msg.created_at
                    });
                });
            }
        });
        return links;
    }, [messages]);

    const formatFileSize = (bytes) => {
        if (!bytes || bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return d.toLocaleDateString([], { month: "short", day: "numeric" });
    };

    return (
        <aside className="w-80 bg-white border-l border-[#E2E8F0] flex flex-col h-full shrink-0 select-none shadow-sm animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="h-14 px-4 border-b border-[#E2E8F0] bg-[#F6F8FB] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <i className="fa-solid fa-circle-info text-[#2878C7] text-sm"></i>
                    <h3 className="font-bold text-xs uppercase tracking-wider text-[#17365D]">Channel Details</h3>
                </div>
                <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-md hover:bg-[#E2E8F0] text-[#5B6573] hover:text-[#17212F] flex items-center justify-center transition-colors cursor-pointer"
                    title="Close Details"
                >
                    <i className="fa-solid fa-xmark text-xs"></i>
                </button>
            </div>

            {/* Conversation Overview Card */}
            <div className="p-4 border-b border-[#E2E8F0] bg-white text-center">
                <div className="w-14 h-14 rounded-xl mx-auto mb-2.5 flex items-center justify-center text-lg font-bold shadow-xs bg-[#17365D] text-white">
                    {isActivity ? (
                        <span className="text-2xl font-black text-[#38BDF8]">#</span>
                    ) : isBroadcast ? (
                        <i className="fa-solid fa-bullhorn text-amber-300"></i>
                    ) : isGroup ? (
                        <i className="fa-solid fa-users text-[#38BDF8]"></i>
                    ) : (
                        <span>{(conversation?.displayTitle || conversation?.title || "U").substring(0, 2).toUpperCase()}</span>
                    )}
                </div>

                <h4 className="font-bold text-sm text-[#17212F] truncate">
                    {isActivity ? "activity" : conversation?.displayTitle || conversation?.title || "Chat"}
                </h4>

                <p className="text-xs text-[#5B6573] mt-1 line-clamp-2 px-2">
                    {conversation?.description || (isGroup ? "Team channel discussion" : "Direct coworker communication")}
                </p>

                {/* Scope & Governance Badges */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap mt-3">
                    {conversation?.company_name && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <i className="fa-solid fa-building text-[8px]"></i>
                            <span>{conversation.company_name}</span>
                        </span>
                    )}
                    {conversation?.department_name && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-[#2878C7] border border-blue-200 flex items-center gap-1">
                            <i className="fa-solid fa-layer-group text-[8px]"></i>
                            <span>{conversation.department_name}</span>
                        </span>
                    )}
                    {conversation?.who_can_post === "ADMIN_ONLY" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <i className="fa-solid fa-lock text-[8px]"></i>
                            <span>Admin-Only Post</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Tab Navigation (CHAT-07) */}
            <div className="flex border-b border-[#E2E8F0] bg-[#F6F8FB] text-xs">
                <button
                    onClick={() => setActiveTab("files")}
                    className={`flex-1 py-2 font-semibold text-center border-b-2 transition-all cursor-pointer ${
                        activeTab === "files"
                            ? "border-[#2878C7] text-[#2878C7] bg-white"
                            : "border-transparent text-[#5B6573] hover:text-[#17212F]"
                    }`}
                >
                    Files ({documents.length})
                </button>
                <button
                    onClick={() => setActiveTab("media")}
                    className={`flex-1 py-2 font-semibold text-center border-b-2 transition-all cursor-pointer ${
                        activeTab === "media"
                            ? "border-[#2878C7] text-[#2878C7] bg-white"
                            : "border-transparent text-[#5B6573] hover:text-[#17212F]"
                    }`}
                >
                    Media ({mediaList.length})
                </button>
                <button
                    onClick={() => setActiveTab("links")}
                    className={`flex-1 py-2 font-semibold text-center border-b-2 transition-all cursor-pointer ${
                        activeTab === "links"
                            ? "border-[#2878C7] text-[#2878C7] bg-white"
                            : "border-transparent text-[#5B6573] hover:text-[#17212F]"
                    }`}
                >
                    Links ({sharedLinks.length})
                </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-3 custom-chat-scrollbar">
                {/* 1. Documents Tab */}
                {activeTab === "files" && (
                    <div className="space-y-2">
                        {documents.length === 0 ? (
                            <div className="text-center py-8 text-[#94A3B8]">
                                <i className="fa-solid fa-file-circle-xmark text-2xl mb-2"></i>
                                <p className="text-xs font-medium">No documents shared yet</p>
                            </div>
                        ) : (
                            documents.map((doc, idx) => (
                                <div
                                    key={doc.id || idx}
                                    onClick={() => onViewFile && onViewFile(doc)}
                                    className="p-2.5 rounded-lg border border-[#E2E8F0] hover:border-[#BFDBFE] hover:bg-[#F8FAFC] flex items-center justify-between gap-2 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-md bg-[#EFF6FF] text-[#2878C7] border border-[#BFDBFE] flex items-center justify-center text-xs shrink-0">
                                            <i className="fa-solid fa-file-lines"></i>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-[#17212F] truncate group-hover:text-[#2878C7]">
                                                {doc.original_name || "Document"}
                                            </p>
                                            <p className="text-[10px] text-[#5B6573]">
                                                {formatFileSize(doc.file_size)} • {formatDate(doc.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <i className="fa-solid fa-arrow-up-right-from-square text-[10px] text-[#94A3B8] group-hover:text-[#2878C7] shrink-0"></i>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* 2. Media Tab */}
                {activeTab === "media" && (
                    <div className="grid grid-cols-2 gap-2">
                        {mediaList.length === 0 ? (
                            <div className="col-span-2 text-center py-8 text-[#94A3B8]">
                                <i className="fa-solid fa-images text-2xl mb-2"></i>
                                <p className="text-xs font-medium">No photos or videos shared</p>
                            </div>
                        ) : (
                            mediaList.map((media, idx) => (
                                <div
                                    key={media.id || idx}
                                    onClick={() => onViewFile && onViewFile(media)}
                                    className="aspect-square rounded-lg border border-[#E2E8F0] overflow-hidden bg-slate-100 relative group cursor-pointer hover:border-[#2878C7] transition-all"
                                >
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 group-hover:scale-105 transition-transform bg-[#EFF6FF]">
                                        <i className="fa-solid fa-image text-xl text-[#2878C7]"></i>
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-xs p-1 text-[9px] text-white truncate">
                                        {media.original_name || "Photo"}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {/* 3. Links Tab */}
                {activeTab === "links" && (
                    <div className="space-y-2">
                        {sharedLinks.length === 0 ? (
                            <div className="text-center py-8 text-[#94A3B8]">
                                <i className="fa-solid fa-link-slash text-2xl mb-2"></i>
                                <p className="text-xs font-medium">No links shared in this chat</p>
                            </div>
                        ) : (
                            sharedLinks.map((link, idx) => (
                                <div
                                    key={idx}
                                    className="p-2.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                                >
                                    <a
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-semibold text-[#2878C7] hover:underline break-all block"
                                    >
                                        {link.url}
                                    </a>
                                    <p className="text-[10px] text-[#5B6573] mt-1">
                                        Shared by {link.senderName} • {formatDate(link.createdAt)}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
}
