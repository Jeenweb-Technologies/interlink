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
    const [filterTab, setFilterTab] = useState("all"); // 'all' | 'unread' | 'broadcasts' | 'groups' | 'direct'
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

    // Extract unique department options
    const availableDeptFilters = useMemo(() => {
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

    // Channels segregation
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

    // 2. Company broadcasts
    const companyBroadcasts = allGroupConvs.filter(isCompanyBroadcastConv);

    // 3. Custom Groups
    const customGroups = allGroupConvs.filter(c => !isCompanyBroadcastConv(c));

    // 4. Direct Messages
    const allDirect = conversations.filter((c) => (c.type || "").toLowerCase() === "direct");

    // Available companies for broadcast selector
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
        if (filterTab === "unread") {
            res = res.filter(c => Number(c.unread_count) > 0);
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
        (filterTab !== "unread" || Number(activityGroup.unread_count) > 0) &&
        (!searchTerm.trim() ||
            (activityGroup.displayTitle || activityGroup.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (activityGroup.last_message || "").toLowerCase().includes(searchTerm.toLowerCase()));

    const filteredCompanyBroadcasts = useMemo(() => {
        let list = companyBroadcasts;
        if (selectedBroadcastCompany !== "all") {
            list = list.filter(c => String(c.company_id) === String(selectedBroadcastCompany));
        }
        return filterList(list);
    }, [companyBroadcasts, selectedBroadcastCompany, searchTerm, selectedDeptFilter, filterTab]);

    const filteredCustomGroups = filterList(customGroups);
    const filteredDirect = filterList(allDirect);

    const totalUnreadCount = useMemo(() => {
        return conversations.reduce((acc, c) => acc + (Number(c.unread_count) || 0), 0);
    }, [conversations]);

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
                className={`group relative px-3 py-2.5 mx-2 rounded-lg flex items-center gap-3 cursor-pointer transition-all duration-150 ${
                    isSelected
                        ? "bg-[#EFF6FF] border border-[#BFDBFE] text-[#17212F] shadow-xs"
                        : "hover:bg-[#F8FAFC] border border-transparent text-[#5B6573]"
                }`}
            >
                {/* Active Indicator Bar */}
                {isSelected && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 rounded-r-md bg-[#2878C7]" />
                )}

                {/* Avatar with Status / Channel Icon */}
                <div className="relative shrink-0">
                    <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs shadow-2xs transition-transform duration-150 group-hover:scale-105 ${
                            isActivity
                                ? "bg-[#17365D] text-[#38BDF8] border border-[#102642]"
                                : isBroadcast
                                ? "bg-[#FEF3C7] text-[#D97706] border border-[#FDE68A]"
                                : isMaster || isAnnouncement
                                ? "bg-[#17365D] text-white border border-[#102642]"
                                : isGroup
                                ? "bg-[#EFF6FF] text-[#2878C7] border border-[#BFDBFE]"
                                : "bg-[#17365D] text-white border border-[#102642]"
                        }`}
                    >
                        {isActivity ? (
                            <span className="text-base font-extrabold text-[#38BDF8]">#</span>
                        ) : isBroadcast ? (
                            <i className="fa-solid fa-bullhorn text-xs text-[#D97706]"></i>
                        ) : isMaster || isAnnouncement ? (
                            <i className="fa-solid fa-bullhorn text-xs"></i>
                        ) : isGroup ? (
                            <i className="fa-solid fa-users text-xs text-[#2878C7]"></i>
                        ) : (
                            initials
                        )}
                    </div>

                    {!isGroup && (
                        <span
                            title={isOnline ? "Online" : "Offline"}
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white transition-all ${
                                isOnline
                                    ? "bg-[#10B981] ring-1 ring-emerald-200"
                                    : "bg-slate-300"
                            }`}
                        />
                    )}
                </div>

                {/* Info Container */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                            {isActivity && (
                                <span className="text-[#2878C7] font-bold text-xs shrink-0">#</span>
                            )}
                            <h4
                                className={`text-xs truncate ${
                                    isSelected
                                        ? "font-bold text-[#17212F]"
                                        : "font-semibold text-[#17212F] group-hover:text-[#2878C7]"
                                }`}
                            >
                                {isActivity ? "activity" : c.displayTitle || c.title || (isGroup ? "Group Chat" : "Coworker")}
                            </h4>
                            {isActivity && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded bg-blue-50 text-[#2878C7] border border-blue-200 text-[8px] font-bold tracking-wider">
                                    DEFAULT
                                </span>
                            )}
                            {isBroadcast && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-bold">
                                    BROADCAST
                                </span>
                            )}
                            {isBroadcast && (
                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[8px] font-semibold border ${
                                    c.who_can_post === 'ADMIN_ONLY'
                                        ? 'bg-amber-100/70 text-amber-800 border-amber-200'
                                        : c.who_can_post === 'SELECTED_MEMBERS'
                                        ? 'bg-blue-100/70 text-blue-800 border-blue-200'
                                        : 'bg-emerald-100/70 text-emerald-800 border-emerald-200'
                                }`}>
                                    {c.who_can_post === 'ADMIN_ONLY'
                                        ? 'Admin Only'
                                        : c.who_can_post === 'SELECTED_MEMBERS'
                                        ? 'Selected'
                                        : 'Open'}
                                </span>
                            )}
                            {c.company_name && !isActivity && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[8px] font-semibold flex items-center gap-1">
                                    <i className="fa-solid fa-building text-[7px] text-emerald-600"></i>
                                    <span>{c.company_name}</span>
                                </span>
                            )}
                            {c.department_name && !isActivity && !isBroadcast && (
                                <span className="shrink-0 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[#5B6573] text-[8px] font-medium flex items-center gap-1">
                                    <i className="fa-solid fa-layer-group text-[7px] text-slate-500"></i>
                                    <span>{c.department_name}</span>
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-[#94A3B8] font-medium shrink-0">
                            {formatTimestamp(c.last_message_at || c.created_at)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <p className={`text-[11px] font-normal truncate leading-tight ${
                            (c.last_message || c.last_message_text) === "This message was deleted"
                                ? "text-[#94A3B8] italic flex items-center gap-1"
                                : "text-[#5B6573]"
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
                                        <span className="text-[#94A3B8] italic">
                                            {isActivity ? "Company activity & announcements" : "No messages yet"}
                                        </span>
                                    );
                                }
                                if (raw === "This message was deleted") {
                                    return (
                                        <>
                                            <i className="fa-solid fa-ban text-[9px] text-[#94A3B8]"></i>
                                            <span>This message was deleted</span>
                                        </>
                                    );
                                }
                                if (raw === "📷 Photo" || raw === "🎥 Video" || raw.startsWith("📎") || raw.toLowerCase().includes("attachment")) {
                                    return (
                                        <span className="inline-flex items-center gap-1 text-[#5B6573]">
                                            <i className="fa-solid fa-paperclip text-[10px] text-[#2878C7]"></i>
                                            <span>Attachment</span>
                                        </span>
                                    );
                                }
                                return raw;
                            })()}
                        </p>
                        {c.unread_count > 0 && (
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-white text-[10px] font-bold bg-[#2878C7] shadow-xs">
                                {c.unread_count}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <aside className="w-full bg-[#FFFFFF] border-r border-[#E2E8F0] flex flex-col h-full shrink-0 select-none shadow-sm">
            {/* Top Workspace & Search Header */}
            <div className="p-3 border-b border-[#E2E8F0] bg-[#F6F8FB] shrink-0">
                {/* Department Multi-Scope Switcher */}
                {hasMultipleDepts && availableDeptFilters.length > 1 && (
                    <div className="flex items-center gap-1 mb-2.5 overflow-x-auto no-scrollbar py-0.5">
                        <button
                            onClick={() => setSelectedDeptFilter("all")}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold shrink-0 transition-all cursor-pointer border ${
                                selectedDeptFilter === "all"
                                    ? "bg-[#17365D] text-white border-[#17365D] shadow-xs"
                                    : "bg-white text-[#5B6573] hover:bg-slate-50 border-[#E2E8F0]"
                            }`}
                        >
                            All Units
                        </button>
                        {availableDeptFilters.map(dept => (
                            <button
                                key={dept.id}
                                onClick={() => setSelectedDeptFilter(dept.id)}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold shrink-0 transition-all cursor-pointer border flex items-center gap-1 ${
                                    selectedDeptFilter === dept.id
                                        ? "bg-[#17365D] text-white border-[#17365D] shadow-xs"
                                        : "bg-white text-[#5B6573] hover:bg-slate-50 border-[#E2E8F0]"
                                }`}
                            >
                                <i className="fa-solid fa-building text-[9px]"></i>
                                <span>{dept.name}</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Search Input Bar */}
                <div className="relative mb-2.5">
                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] text-xs"></i>
                    <input
                        type="text"
                        placeholder="Search channels, people, or messages..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-white border border-[#E2E8F0] text-[#17212F] text-xs focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] transition-all font-normal placeholder:text-[#94A3B8]"
                    />
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#17212F] text-xs cursor-pointer"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    )}
                </div>

                {/* Category Filter Chips (CHAT-01: Unread, Direct, Groups, Announcements) */}
                <div className="flex items-center gap-1 p-0.5 bg-[#E2E8F0]/60 rounded-lg text-xs border border-[#E2E8F0]">
                    <button
                        onClick={() => setFilterTab("all")}
                        className={`flex-1 py-1 rounded-md transition-all duration-150 cursor-pointer text-center text-[11px] ${
                            filterTab === "all"
                                ? "bg-[#17365D] text-white shadow-xs font-semibold"
                                : "text-[#5B6573] hover:text-[#17212F] font-medium"
                        }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilterTab("unread")}
                        className={`flex-1 py-1 rounded-md transition-all duration-150 cursor-pointer text-center text-[11px] flex items-center justify-center gap-1 ${
                            filterTab === "unread"
                                ? "bg-[#17365D] text-white shadow-xs font-semibold"
                                : "text-[#5B6573] hover:text-[#17212F] font-medium"
                        }`}
                    >
                        <span>Unread</span>
                        {totalUnreadCount > 0 && (
                            <span className={`px-1 py-0.2 rounded-full text-[9px] font-bold ${filterTab === "unread" ? "bg-[#2878C7] text-white" : "bg-[#2878C7] text-white"}`}>
                                {totalUnreadCount}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setFilterTab("broadcasts")}
                        className={`flex-1 py-1 rounded-md transition-all duration-150 cursor-pointer text-center text-[11px] ${
                            filterTab === "broadcasts"
                                ? "bg-[#17365D] text-white shadow-xs font-semibold"
                                : "text-[#5B6573] hover:text-[#17212F] font-medium"
                        }`}
                    >
                        Broadcast
                    </button>
                    <button
                        onClick={() => setFilterTab("groups")}
                        className={`flex-1 py-1 rounded-md transition-all duration-150 cursor-pointer text-center text-[11px] ${
                            filterTab === "groups"
                                ? "bg-[#17365D] text-white shadow-xs font-semibold"
                                : "text-[#5B6573] hover:text-[#17212F] font-medium"
                        }`}
                    >
                        Teams
                    </button>
                    <button
                        onClick={() => setFilterTab("direct")}
                        className={`flex-1 py-1 rounded-md transition-all duration-150 cursor-pointer text-center text-[11px] ${
                            filterTab === "direct"
                                ? "bg-[#17365D] text-white shadow-xs font-semibold"
                                : "text-[#5B6573] hover:text-[#17212F] font-medium"
                        }`}
                    >
                        Direct
                    </button>
                </div>
            </div>

            {/* Scrollable Conversation List */}
            <div className="flex-1 overflow-y-auto py-2 custom-chat-scrollbar">
                {/* Empty State */}
                {!isActivityMatchingSearch && filteredCompanyBroadcasts.length === 0 && filteredCustomGroups.length === 0 && filteredDirect.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="w-12 h-12 rounded-lg bg-[#F6F8FB] text-[#94A3B8] border border-[#E2E8F0] flex items-center justify-center mx-auto mb-3 text-lg">
                            <i className="fa-solid fa-comment-slash"></i>
                        </div>
                        <p className="text-xs font-bold text-[#17212F] mb-1">No conversations found</p>
                        <p className="text-[11px] text-[#5B6573] font-normal">Try searching for another coworker or channel name.</p>
                    </div>
                ) : (
                    <>
                        {/* ================= 1. PINNED #ACTIVITY CHANNEL ================= */}
                        {(filterTab === "all" || filterTab === "groups") && isActivityMatchingSearch && activityGroup && (
                            <div className="mb-2">
                                <div className="px-3 pt-1 pb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#17365D]">
                                        <i className="fa-solid fa-thumbtack text-[9px] text-[#2878C7]"></i>
                                        <span>Company Activity Stream</span>
                                    </div>
                                    <span className="text-[9px] font-bold text-[#2878C7] bg-[#EFF6FF] border border-[#BFDBFE] px-1.5 py-0.2 rounded">
                                        PINNED
                                    </span>
                                </div>

                                {renderConversationItem(activityGroup, true)}
                            </div>
                        )}

                        {/* ================= 2. COMPANY-WISE BROADCAST CHANNELS ================= */}
                        {(filterTab === "all" || filterTab === "broadcasts") && (
                            <div className="mb-2">
                                <div className="px-3 pt-2 pb-1 flex items-center justify-between gap-1">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#D97706]">
                                        <i className="fa-solid fa-bullhorn text-[10px] text-[#D97706]"></i>
                                        <span>Company Broadcasts</span>
                                        <span className="px-1.5 py-0.2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold">
                                            {filteredCompanyBroadcasts.length}
                                        </span>
                                    </div>

                                    {/* Company Selector */}
                                    {broadcastCompanies.length > 1 && (
                                        <select
                                            value={selectedBroadcastCompany}
                                            onChange={(e) => setSelectedBroadcastCompany(e.target.value)}
                                            className="text-[10px] font-semibold bg-white border border-[#E2E8F0] rounded-md px-1.5 py-0.5 text-[#17212F] focus:outline-none focus:ring-1 focus:ring-[#2878C7] cursor-pointer max-w-[130px] truncate"
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
                                        <div className="px-4 py-1.5 text-[11px] text-[#94A3B8] italic font-normal">
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
                            <div className="mx-3 my-1 border-t border-[#E2E8F0]"></div>
                        )}

                        {/* ================= 3. CUSTOM GROUPS & TEAMS ================= */}
                        {(filterTab === "all" || filterTab === "groups") && (
                            <div className="mb-2">
                                <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#17365D]">
                                        <i className="fa-solid fa-layer-group text-[10px] text-[#2878C7]"></i>
                                        <span>Custom Groups & Teams</span>
                                        <span className="px-1.5 py-0.2 rounded-full bg-slate-100 border border-[#E2E8F0] text-[#5B6573] text-[9px] font-bold">
                                            {filteredCustomGroups.length}
                                        </span>
                                    </div>
                                    {canCreateGroup && !currentUser?.is_vendor && (
                                        <button
                                            onClick={onOpenNewGroup}
                                            title="Create Custom Group"
                                            className="px-2 py-0.5 rounded text-[10px] font-bold text-[#2878C7] hover:bg-[#EFF6FF] border border-transparent hover:border-[#BFDBFE] cursor-pointer flex items-center gap-1 transition-all"
                                        >
                                            <i className="fa-solid fa-plus text-[8px]"></i> New
                                        </button>
                                    )}
                                </div>

                                <div className="space-y-0.5">
                                    {filteredCustomGroups.length === 0 ? (
                                        <div className="px-4 py-1.5 text-[11px] text-[#94A3B8] italic font-normal">
                                            No team channels created yet
                                        </div>
                                    ) : (
                                        filteredCustomGroups.map((g) => renderConversationItem(g, false))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Divider */}
                        {filterTab === "all" && (
                            <div className="mx-3 my-1 border-t border-[#E2E8F0]"></div>
                        )}

                        {/* ================= 4. DIRECT MESSAGES ================= */}
                        {(filterTab === "all" || filterTab === "direct") && (
                            <div>
                                <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#17365D]">
                                        <i className="fa-regular fa-comment-dots text-[10px] text-[#2878C7]"></i>
                                        <span>Direct Messages</span>
                                        <span className="px-1.5 py-0.2 rounded-full bg-slate-100 border border-[#E2E8F0] text-[#5B6573] text-[9px] font-bold">
                                            {filteredDirect.length}
                                        </span>
                                    </div>
                                    {!currentUser?.is_vendor ? (
                                        <button
                                            onClick={onOpenNewChat}
                                            title="Start Direct Chat"
                                            className="px-2 py-0.5 rounded text-[10px] font-bold text-[#2878C7] hover:bg-[#EFF6FF] border border-transparent hover:border-[#BFDBFE] cursor-pointer flex items-center gap-1 transition-all"
                                        >
                                            <i className="fa-solid fa-plus text-[8px]"></i> New
                                        </button>
                                    ) : (
                                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title="External vendors cannot initiate new conversations">
                                            Vendor
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-0.5">
                                    {filteredDirect.length === 0 ? (
                                        <div className="px-4 py-1.5 text-[11px] text-[#94A3B8] italic font-normal">
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
