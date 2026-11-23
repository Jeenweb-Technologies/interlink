import React, { useState, useMemo } from "react";

export default function ChatSidebar({
    conversations = [],
    activeConversationId,
    onSelectConversation,
    onOpenNewChat,
    onOpenNewGroup,
    onlineUserIds = [],
    currentUserId,
    canCreateGroup = true
}) {
    const [filterTab, setFilterTab] = useState("all"); // 'all' | 'groups' | 'direct'
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedDeptFilter, setSelectedDeptFilter] = useState("all");

    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    const userDepts = Array.isArray(currentUser.departments) ? currentUser.departments : [];
    const isGlobalAdmin = currentUser.role === "admin" || currentUser.role === "super admin";
    const hasMultipleDepts = userDepts.length > 1 || isGlobalAdmin;

    const formatTimestamp = (dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } else if (diffDays === 1) {
            return "Yesterday";
        } else if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: "short" });
        } else {
            return date.toLocaleDateString([], { month: "short", day: "numeric" });
        }
    };

    // Extract unique department options from user departments and conversations
    const availableDeptFilters = React.useMemo(() => {
        const map = new Map();
        userDepts.forEach(d => {
            if (d.department_id && d.department_name) {
                map.set(String(d.department_id), d.department_name);
            }
        });
        conversations.forEach(c => {
            if (c.department_id && c.department_name) {
                map.set(String(c.department_id), c.department_name);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [userDepts, conversations]);

    const [selectedBroadcastCompany, setSelectedBroadcastCompany] = useState("all");

    // Separate 4 channels: #activity, company broadcast channels, custom groups & direct messages
    const activityGroup = conversations.find(
        (c) => Boolean(c.is_activity) || c.title === "#activity" || c.title === "# activity"
    );

    const isCompanyBroadcastConv = (c) => Boolean(
        c.is_company_broadcast ||
        (c.is_announcement && c.company_id && !c.is_activity) ||
        (c.title && c.title.toLowerCase().includes("broadcast"))
    );

    const allGroupConvs = conversations.filter(
        (c) =>
            (c.type || "").toLowerCase() === "group" &&
            !(Boolean(c.is_activity) || c.title === "#activity" || c.title === "# activity")
    );

    // 2. Company-wise broadcast channels
    const companyBroadcasts = allGroupConvs.filter(isCompanyBroadcastConv);

    // 3. Custom Groups & Teams
    const customGroups = allGroupConvs.filter(c => !isCompanyBroadcastConv(c));

    // 4. Direct Messages
    const allDirect = conversations.filter((c) => (c.type || "").toLowerCase() === "direct");

    // Extract available companies for broadcast selector
    const broadcastCompanies = useMemo(() => {
        const map = new Map();
        companyBroadcasts.forEach(c => {
            if (c.company_id && c.company_name) {
                map.set(String(c.company_id), c.company_name);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [companyBroadcasts]);

    // Search and Department filter
    const filterList = (list) => {
        let res = list;
        if (selectedDeptFilter !== "all") {
            res = res.filter(c => {
                if (c.is_announcement || c.is_activity || c.is_company_broadcast) return true;
                if (c.department_id) {
                    return String(c.department_id) === String(selectedDeptFilter);
                }
                if (Array.isArray(c.department_ids) && c.department_ids.length > 0) {
                    return c.department_ids.some(id => String(id) === String(selectedDeptFilter));
                }
                return true;
            });
        }
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            res = res.filter((c) => {
                const titleMatch = (c.displayTitle || c.title || "").toLowerCase().includes(term);
                const msgMatch = (c.last_message || "").toLowerCase().includes(term);
                const deptMatch = (c.department_name || "").toLowerCase().includes(term);
                const compMatch = (c.company_name || "").toLowerCase().includes(term);
                return titleMatch || msgMatch || deptMatch || compMatch;
            });
        }
        return res;
    };

    const isActivityMatchingSearch =
        activityGroup &&
        (!searchTerm.trim() ||
            (activityGroup.displayTitle || activityGroup.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (activityGroup.last_message || "").toLowerCase().includes(searchTerm.toLowerCase()));

    const filteredCompanyBroadcasts = useMemo(() => {
        let list = companyBroadcasts;
        if (selectedBroadcastCompany !== "all") {
            list = list.filter(c => String(c.company_id) === String(selectedBroadcastCompany));
        }
        return filterList(list);
    }, [companyBroadcasts, selectedBroadcastCompany, searchTerm, selectedDeptFilter]);

    const filteredCustomGroups = filterList(customGroups);
    const filteredDirect = filterList(allDirect);

    const displayedGroups = filteredCustomGroups;
    const displayedDirect = filteredDirect;

    const renderConversationItem = (c, isPinnedActivity = false) => {
        const isSelected = c.id === activeConversationId;
        const isGroup = (c.type || "").toLowerCase() === "group";
        const isActivity = isPinnedActivity || Boolean(c.is_activity) || c.title === "#activity";
        const isBroadcast = isCompanyBroadcastConv(c);
        const isMaster = Boolean(c.is_master) && !isActivity && !isBroadcast;
        const isAnnouncement = Boolean(c.is_announcement);

        const partnerId = c.partnerId || c.other_user_id || c.partner_id;
        let isOnline = false;
        if (!isGroup && partnerId) {
            isOnline = (onlineUserIds || []).some((id) => String(id) === String(partnerId));
        }

        const getInitials = (str) => {
            if (!str) return isGroup ? "G" : "U";
            const cleaned = str.replace(/^[#@\s]+/, "").trim();
            if (!cleaned) return isGroup ? "G" : "U";
            const parts = cleaned.split(/\s+/).filter(Boolean);
            if (parts.length >= 2) {
                return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            }
            return cleaned.substring(0, 2).toUpperCase();
        };
        const initials = getInitials(c.displayTitle || c.title);

        return (
            <div
                key={c.id}
                onClick={() => onSelectConversation(c)}
                className={`group relative px-2.5 py-2 mx-1.5 rounded-xl flex items-center gap-2.5 cursor-pointer transition-all duration-150 ${
                    isSelected
                        ? "bg-red-50/70 border border-red-200/70 text-slate-800 shadow-2xs"
                        : "hover:bg-slate-100/70 border border-transparent text-slate-600"
                }`}
            >
                {/* Active Indicator Strip */}
                {isSelected && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#ED1C28]" />
                )}

                {/* Avatar with Presence / Channel Icon - Sleek Grayish / Graphite */}
                <div className="relative shrink-0">
                    <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-medium text-xs shadow-2xs transition-transform duration-150 group-hover:scale-105 ${
                            isActivity
                                ? "bg-[#2D333B] text-[#E53E3E] border border-slate-700/60"
                                : isBroadcast
                                ? "bg-[#2D2A3E] text-amber-400 border border-amber-500/30"
                                : isMaster || isAnnouncement
                                ? "bg-[#333842] text-slate-100 border border-slate-600/40"
                                : isGroup
                                ? "bg-[#374151] text-slate-100 border border-slate-600/40"
                                : "bg-[#333842] text-slate-100 border border-slate-600/40"
                        }`}
                    >
                        {isActivity ? (
                            <span className="text-sm font-semibold">#</span>
                        ) : isBroadcast ? (
                            <i className="fa-solid fa-bullhorn text-[11px] text-amber-400"></i>
                        ) : isMaster || isAnnouncement ? (
                            <i className="fa-solid fa-bullhorn text-[11px]"></i>
                        ) : isGroup ? (
                            <i className="fa-solid fa-users text-[11px]"></i>
                        ) : (
                            initials
                        )}
                    </div>

                    {!isGroup && (
                        <span
                            title={isOnline ? "Online" : "Offline"}
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white transition-all ${
                                isOnline
                                    ? "bg-emerald-500 ring-1 ring-emerald-200"
                                    : "bg-slate-300"
                            }`}
                        />
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                            {isActivity && (
                                <span className="text-[#ED1C28] font-semibold text-xs shrink-0">#</span>
                            )}
                            <h4
                                className={`text-xs truncate ${
                                    isSelected
                                        ? "font-semibold text-slate-900"
                                        : "font-medium text-slate-700 group-hover:text-slate-900"
                                }`}
                            >
                                {isActivity ? "activity" : c.displayTitle || c.title || (isGroup ? "Group Chat" : "Coworker")}
                            </h4>
                            {isActivity && (
                                <span className="shrink-0 px-1.5 py-0.2 rounded bg-red-100/80 text-[#ED1C28] text-[8px] font-medium tracking-normal">
                                    DEFAULT
                                </span>
                            )}
                            {isBroadcast && (
                                <span className="shrink-0 px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-semibold">
                                    BROADCAST
                                </span>
                            )}
                            {isBroadcast && (
                                <span className={`shrink-0 px-1.5 py-0.2 rounded text-[8px] font-medium ${
                                    c.who_can_post === 'ADMIN_ONLY'
                                        ? 'bg-amber-100/80 text-amber-800'
                                        : c.who_can_post === 'SELECTED_MEMBERS'
                                        ? 'bg-blue-100/80 text-blue-800'
                                        : 'bg-emerald-100/80 text-emerald-800'
                                }`}>
                                    {c.who_can_post === 'ADMIN_ONLY'
                                        ? 'Admin Only'
                                        : c.who_can_post === 'SELECTED_MEMBERS'
                                        ? 'Selected'
                                        : 'Open'}
                                </span>
                            )}
                            {c.company_name && !isActivity && (
                                <span className="shrink-0 px-1.5 py-0.2 rounded bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-[8px] font-semibold flex items-center gap-1">
                                    <i className="fa-solid fa-building text-[7px] text-emerald-600"></i>
                                    <span>{c.company_name}</span>
                                </span>
                            )}
                            {c.department_name && !isActivity && !isBroadcast && (
                                <span className="shrink-0 px-1.5 py-0.2 rounded bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-[8px] font-medium flex items-center gap-1">
                                    <i className="fa-solid fa-layer-group text-[7px] text-indigo-600"></i>
                                    <span>{c.department_name}</span>
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal shrink-0">
                            {formatTimestamp(c.last_message_at || c.created_at)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <p className={`text-[11px] font-normal truncate leading-tight ${
                            (c.last_message || c.last_message_text) === "This message was deleted"
                                ? "text-slate-400 italic flex items-center gap-1"
                                : "text-slate-500"
                        }`}>
                            {(() => {
                                let raw = (c.last_message || c.last_message_text || "").trim();
                                if (raw.startsWith('{"type":"call_log"')) {
                                    try {
                                        const parsed = JSON.parse(raw);
                                        raw = parsed.text || "Call";
                                    } catch {}
                                }
                                if (!raw) {
                                    return (
                                        <span className="text-slate-400 italic">
                                            {isActivity ? "Company activity & announcements" : "No messages yet"}
                                        </span>
                                    );
                                }
                                if (raw === "This message was deleted") {
                                    return (
                                        <>
                                            <i className="fa-solid fa-ban text-[9px] text-slate-400"></i>
                                            <span>This message was deleted</span>
                                        </>
                                    );
                                }
                                if (raw === "📷 Photo" || raw === "🎥 Video" || raw.startsWith("📎") || raw.toLowerCase().includes("attachment")) {
                                    return (
                                        <span className="inline-flex items-center gap-1 text-slate-500">
                                            <i className="fa-solid fa-paperclip text-[10px] text-slate-400"></i>
                                            <span>Attachment</span>
                                        </span>
                                    );
                                }
                                return raw;
                            })()}
                        </p>
                        {c.unread_count > 0 && (
                            <span
                                className={`shrink-0 px-1.5 py-0.2 rounded-full text-white text-[9px] font-medium shadow-2xs ${
                                    isActivity ? "bg-amber-600" : "bg-[#ED1C28]"
                                }`}
                            >
                                {c.unread_count}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <aside className="w-full bg-white border-r border-slate-200 flex flex-col h-full shrink-0 select-none shadow-2xs">
            {/* Top Workspace & Search Header */}
            <div className="p-3 border-b border-slate-200/80 bg-slate-50/60 shrink-0">

                {/* Department Multi-Scope Switcher Chips */}
                {hasMultipleDepts && availableDeptFilters.length > 1 && (
                    <div className="flex items-center gap-1 mb-2 overflow-x-auto no-scrollbar py-0.5">
                        <button
                            onClick={() => setSelectedDeptFilter("all")}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0 transition-all cursor-pointer border ${
                                selectedDeptFilter === "all"
                                    ? "bg-[#2D333B] text-white border-[#2D333B] shadow-2xs"
                                    : "bg-white text-slate-600 hover:bg-slate-100 border-slate-200"
                            }`}
                        >
                            All Units
                        </button>
                        {availableDeptFilters.map(dept => (
                            <button
                                key={dept.id}
                                onClick={() => setSelectedDeptFilter(dept.id)}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-medium shrink-0 transition-all cursor-pointer border flex items-center gap-1 ${
                                    selectedDeptFilter === dept.id
                                        ? "bg-[#ED1C28] text-white border-[#ED1C28] shadow-2xs"
                                        : "bg-white text-slate-600 hover:bg-slate-100 border-slate-200"
                                }`}
                            >
                                <i className="fa-solid fa-building text-[8px]"></i>
                                <span>{dept.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Search Input Bar */}
                <div className="relative mb-2">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                    <input
                        type="text"
                        placeholder="Search channels, people, or messages..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-[#ED1C28]/20 focus:border-[#ED1C28] transition-all font-normal placeholder:text-slate-400"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    )}
                </div>

                {/* Filter Navigation Chips: 4 distinct categories */}
                <div className="flex items-center gap-1 p-0.5 bg-slate-100/90 rounded-lg text-xs border border-slate-200/60">
                    <button
                        onClick={() => setFilterTab("all")}
                        className={`flex-1 py-1 rounded-md transition-all duration-150 cursor-pointer text-center text-[10px] sm:text-[11px] ${
                            filterTab === "all"
                                ? "bg-white text-slate-800 shadow-2xs font-semibold"
                                : "text-slate-500 hover:text-slate-800 font-normal"
                        }`}
                    >
                        All ({conversations.length})
                    </button>
                    <button
                        onClick={() => setFilterTab("broadcasts")}
                        className={`flex-1 py-1 rounded-md transition-all duration-150 cursor-pointer text-center text-[10px] sm:text-[11px] ${
                            filterTab === "broadcasts"
                                ? "bg-white text-slate-800 shadow-2xs font-semibold"
                                : "text-slate-500 hover:text-slate-800 font-normal"
                        }`}
                    >
                        Broadcast ({companyBroadcasts.length})
                    </button>
                    <button
                        onClick={() => setFilterTab("groups")}
                        className={`flex-1 py-1 rounded-md transition-all duration-150 cursor-pointer text-center text-[10px] sm:text-[11px] ${
                            filterTab === "groups"
                                ? "bg-white text-slate-800 shadow-2xs font-semibold"
                                : "text-slate-500 hover:text-slate-800 font-normal"
                        }`}
                    >
                        Teams ({customGroups.length})
                    </button>
                    <button
                        onClick={() => setFilterTab("direct")}
                        className={`flex-1 py-1 rounded-md transition-all duration-150 cursor-pointer text-center text-[10px] sm:text-[11px] ${
                            filterTab === "direct"
                                ? "bg-white text-slate-800 shadow-2xs font-semibold"
                                : "text-slate-500 hover:text-slate-800 font-normal"
                        }`}
                    >
                        Direct ({allDirect.length})
                    </button>
                </div>
            </div>

            {/* Scrollable Conversation List */}
            <div className="flex-1 overflow-y-auto py-1.5 custom-chat-scrollbar">
                {/* Empty Search State */}
                {!isActivityMatchingSearch && filteredCompanyBroadcasts.length === 0 && filteredCustomGroups.length === 0 && filteredDirect.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 text-base">
                            <i className="fa-solid fa-comment-slash"></i>
                        </div>
                        <p className="text-xs font-medium text-slate-700 mb-0.5">No conversations match your search</p>
                        <p className="text-[11px] text-slate-400 font-normal">Try typing a coworker name or channel title.</p>
                    </div>
                ) : (
                    <>
                        {/* ================= 1. PINNED DEFAULT #ACTIVITY CHANNEL ================= */}
                        {(filterTab === "all" || filterTab === "groups") && isActivityMatchingSearch && activityGroup && (
                            <div className="mb-2">
                                <div className="px-3 pt-1 pb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                                        <i className="fa-solid fa-thumbtack text-[9px] text-amber-600"></i>
                                        <span>Company Activity Channel</span>
                                    </div>
                                    <span className="text-[9px] font-semibold text-amber-700 bg-amber-100/70 px-1.5 py-0.2 rounded">
                                        Default For All
                                    </span>
                                </div>

                                {renderConversationItem(activityGroup, true)}
                            </div>
                        )}

                        {/* ================= 2. COMPANY-WISE BROADCAST CHANNELS ================= */}
                        {(filterTab === "all" || filterTab === "broadcasts") && (
                            <div className="mb-2">
                                <div className="px-3 pt-2 pb-1 flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                                        <i className="fa-solid fa-bullhorn text-[10px] text-amber-600"></i>
                                        <span>Company Broadcasts</span>
                                        <span className="px-1.5 py-0.2 rounded-full bg-amber-50 border border-amber-200/80 text-amber-700 text-[9px] font-semibold">
                                            {filteredCompanyBroadcasts.length}
                                        </span>
                                    </div>

                                    {/* Company Selector when multiple companies exist */}
                                    {broadcastCompanies.length > 1 && (
                                        <select
                                            value={selectedBroadcastCompany}
                                            onChange={(e) => setSelectedBroadcastCompany(e.target.value)}
                                            className="text-[10px] font-semibold bg-white border border-slate-200 rounded-md px-1.5 py-0.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer max-w-[130px] truncate"
                                            title="Filter broadcasts by company"
                                        >
                                            <option value="all">All Companies</option>
                                            {broadcastCompanies.map(comp => (
                                                <option key={comp.id} value={comp.id}>{comp.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div className="space-y-0.5">
                                    {filteredCompanyBroadcasts.length === 0 ? (
                                        <div className="px-4 py-1 text-[11px] text-slate-400 italic font-normal">
                                            No company broadcasts available
                                        </div>
                                    ) : (
                                        filteredCompanyBroadcasts.map((b) => renderConversationItem(b, false))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Divider */}
                        {(filterTab === "all") && (
                            <div className="mx-3 my-1 border-t border-slate-100"></div>
                        )}

                        {/* ================= 3. CUSTOM GROUPS & TEAMS ================= */}
                        {(filterTab === "all" || filterTab === "groups") && (
                            <div className="mb-1.5">
                                <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                        <i className="fa-solid fa-layer-group text-[10px] text-slate-500"></i>
                                        <span>Custom Groups & Teams</span>
                                        <span className="px-1.5 py-0.2 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-semibold">
                                            {filteredCustomGroups.length}
                                        </span>
                                    </div>
                                    {canCreateGroup && !currentUser?.is_vendor && (
                                        <button
                                            onClick={onOpenNewGroup}
                                            title="Create Custom Group"
                                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:text-[#ED1C28] hover:bg-red-50/70 cursor-pointer flex items-center gap-1 transition-colors"
                                        >
                                            <i className="fa-solid fa-plus text-[8px]"></i> New
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-0.5">
                                    {filteredCustomGroups.length === 0 ? (
                                        <div className="px-4 py-1.5 text-[11px] text-slate-400 italic font-normal">
                                            No custom group channels created yet
                                        </div>
                                    ) : (
                                        filteredCustomGroups.map((g) => renderConversationItem(g, false))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Divider */}
                        {filterTab === "all" && (
                            <div className="mx-3 my-1 border-t border-slate-100"></div>
                        )}

                        {/* ================= 4. DIRECT MESSAGES ================= */}
                        {(filterTab === "all" || filterTab === "direct") && (
                            <div>
                                <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                                        <i className="fa-regular fa-comment-dots text-[10px] text-slate-500"></i>
                                        <span>Direct Messages</span>
                                        <span className="px-1.5 py-0.2 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[9px] font-semibold">
                                            {filteredDirect.length}
                                        </span>
                                    </div>
                                    {!currentUser?.is_vendor ? (
                                        <button
                                            onClick={onOpenNewChat}
                                            title="Start Direct Chat"
                                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:text-[#ED1C28] hover:bg-red-50/70 cursor-pointer flex items-center gap-1 transition-colors"
                                        >
                                            <i className="fa-solid fa-plus text-[8px]"></i> New
                                        </button>
                                    ) : (
                                        <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title="External vendors cannot initiate new conversations">
                                            Vendor
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-0.5">
                                    {filteredDirect.length === 0 ? (
                                        <div className="px-4 py-1.5 text-[11px] text-slate-400 italic font-normal">
                                            No direct messages yet
                                        </div>
                                    ) : (
                                        displayedDirect.map((d) => renderConversationItem(d, false))
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </aside>
    );
}
