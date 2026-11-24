import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { logoutUser } from "../api/authApi";
import { getCompanies, switchCompany } from "../api/companyApi";
import { usePermission } from "../context/PermissionContext";
import { searchAllRecords } from "../api/searchApi";
import { getProjects } from "../api/projectApi";
import { getTasks } from "../api/taskApi";
import Footer from "./Footer";

// ─── Self-Contained Interlink Logo (Light Mode & Dark Mode Support) ────────────
export function InterlinkLogo({
    size = "md",
    showText = true,
    light = false,
    className = "",
    textClassName = "",
    subtitle = null
}) {
    const sizes = {
        sm: { mark: "w-6 h-6", text: "text-base" },
        md: { mark: "w-8 h-8", text: "text-xl" },
        lg: { mark: "w-10 h-10", text: "text-2xl" },
        xl: { mark: "w-14 h-14", text: "text-3xl" },
    };

    const s = sizes[size] || sizes.md;

    return (
        <div className={`flex items-center gap-2.5 select-none ${className}`}>
            <div className={`relative ${s.mark} shrink-0 transition-transform duration-300 hover:scale-105 flex items-center justify-center`}>
                <svg
                    viewBox="0 0 36 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full drop-shadow-[0_2px_8px_rgba(0,102,255,0.3)]"
                >
                    <defs>
                        <linearGradient id="sbIlG1" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#0056cf" />
                            <stop offset="50%" stopColor="#0284c7" />
                            <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                    </defs>

                    <path
                        d="M18 12 C14 6 6 6 6 12 C6 18 14 18 18 12 C22 6 30 6 30 12 C30 18 22 18 18 12 Z"
                        stroke="url(#sbIlG1)"
                        strokeWidth="3.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <circle cx="18" cy="12" r="1.5" fill="#38bdf8" />
                </svg>
            </div>

            {showText && (
                <div className="flex flex-col">
                    <span className={`font-black tracking-tight leading-none ${s.text} ${textClassName || (light ? "text-white" : "text-slate-900")}`}>
                        Inter<span className="text-blue-600">link</span>
                    </span>
                    {subtitle && (
                        <span className="text-[9px] font-bold tracking-[0.2em] text-slate-400 uppercase mt-0.5">
                            {subtitle}
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Header with Light-Mode Logo, Universal Record Search Dropdown & Notification ───
export function TopBar({ onMenuClick = () => {} }) {
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const { hasPermission } = usePermission();
    const isAdmin = user.role === "admin" || user.role === "super admin";

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [searchResults, setSearchResults] = useState({
        projects: [],
        tasks: [],
        notes: [],
        users: [],
        documents: [],
        user_types: [],
        audit_logs: []
    });
    const [searchTotal, setSearchTotal] = useState(0);
    const [recentSearches, setRecentSearches] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem("interlink_recent_searches") || "[]");
        } catch {
            return [];
        }
    });

    // Company Switcher state
    const [companies, setCompanies] = useState(user.companies || []);
    const [activeCompanyId, setActiveCompanyId] = useState(
        localStorage.getItem("active_company_id") || user.company_id || "1"
    );

    useEffect(() => {
        // Always fetch fresh companies list on mount
        getCompanies()
            .then((res) => {
                if (res.data?.success && res.data.companies) {
                    setCompanies(res.data.companies);
                    const currentActive = localStorage.getItem("active_company_id") || user.company_id;
                    if (!currentActive && res.data.companies.length > 0) {
                        const firstId = String(res.data.companies[0].id);
                        setActiveCompanyId(firstId);
                        localStorage.setItem("active_company_id", firstId);
                    }
                }
            })
            .catch((err) => {
                console.error("TopBar getCompanies error:", err);
            });
    }, []);

    const handleCompanyChange = async (e) => {
        const newId = e.target.value;
        setActiveCompanyId(newId);
        localStorage.setItem("active_company_id", newId);
        const updatedUser = { ...user, company_id: parseInt(newId, 10) };
        localStorage.setItem("user", JSON.stringify(updatedUser));
        try {
            await switchCompany(newId);
        } catch (err) {
            console.warn("Backend switch notice:", err.message);
        }
        window.location.reload();
    };

    const notificationRef = useRef(null);
    const profileRef = useRef(null);
    const searchContainerRef = useRef(null);
    const searchInputRef = useRef(null);

    // Static Navigation Pages
    const pages = [
        { id: "p-dash", title: "User Dashboard", category: "Navigation", path: "/user/home", icon: "fa-solid fa-gauge-high text-blue-500", visible: true },
        { id: "p-proj", title: "Projects & Portfolio", category: "Navigation", path: "/projects", icon: "fa-solid fa-diagram-project text-indigo-500", visible: true },
        { id: "p-task", title: "Task Management", category: "Navigation", path: "/tasks", icon: "fa-solid fa-list-check text-emerald-500", visible: true },
        { id: "p-notes", title: "Notes & Scratchpad", category: "Navigation", path: "/notes", icon: "fa-solid fa-note-sticky text-amber-500", visible: true },
        { id: "p-chat", title: "Chat & Communication", category: "Navigation", path: "/chat", icon: "fa-solid fa-comments text-cyan-500", visible: true },
        { id: "p-meetings", title: "Meetings & Whiteboard", category: "Navigation", path: "/meetings", icon: "fa-solid fa-video text-teal-400", visible: true },
        { id: "p-comp", title: "Company Master", category: "Masters", path: "/admin/companies", icon: "fa-solid fa-building text-blue-500", visible: isAdmin },
        { id: "p-users", title: "User Master Directory", category: "Masters", path: "/admin/dashboard", icon: "fa-solid fa-users-gear text-purple-500", visible: isAdmin || hasPermission("user_master", "read") },
        { id: "p-ucreate", title: "Create New User", category: "Masters", path: "/admin/users/create", icon: "fa-solid fa-user-plus text-sky-500", visible: isAdmin || hasPermission("user_master", "write") },
        { id: "p-utypes", title: "User Types Master", category: "Masters", path: "/admin/user-types", icon: "fa-solid fa-user-shield text-amber-500", visible: isAdmin || hasPermission("user_type", "read") },
        { id: "p-report", title: "Activity Report", category: "Analytics", path: "/admin/report", icon: "fa-solid fa-clock-rotate-left text-rose-500", visible: isAdmin || hasPermission("activity_report", "read") },
        { id: "p-prof", title: "Account Profile", category: "Settings", path: "/profile", icon: "fa-regular fa-user text-slate-500", visible: true }
    ].filter(p => p.visible);

    // Quick Actions
    const quickActions = [
        { id: "qa-task", title: "Create New Task", subtitle: "Open task drawer", path: "/tasks?openCreate=true", icon: "fa-solid fa-plus-circle text-blue-500" },
        { id: "qa-proj", title: "Create New Project", subtitle: "Open project creation modal", path: "/projects?openCreate=true", icon: "fa-solid fa-folder-plus text-sky-500" },
        { id: "qa-note", title: "Create New Note", subtitle: "Open note editor", path: "/notes", icon: "fa-solid fa-file-circle-plus text-amber-500" }
    ];

    const filteredPages = searchQuery.trim()
        ? pages.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))
        : pages.slice(0, 4);

    // Dismiss popovers when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (notificationRef.current && !notificationRef.current.contains(e.target)) {
                setIsNotificationOpen(false);
            }
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setIsProfileOpen(false);
            }
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setIsSearchOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getPageTitle = (path) => {
        if (path === "/user/home") return { title: "User Dashboard", category: "Overview" };
        if (path.startsWith("/chat")) return { title: "Chat & Communication", category: "Collaboration" };
        if (path.startsWith("/projects")) return { title: "Projects & Portfolio", category: "Governance" };
        if (path.startsWith("/tasks")) return { title: "Task Management", category: "Productivity" };
        if (path.startsWith("/notes")) return { title: "Notes & Scratchpad", category: "Productivity" };
        if (path === "/admin/dashboard") return { title: "User Master", category: "Masters" };
        if (path === "/admin/companies") return { title: "Company Master", category: "Masters" };
        if (path === "/admin/departments") return { title: "Department Master", category: "Masters" };
        if (path === "/admin/chat-settings") return { title: "Chat Settings Master", category: "Masters" };
        if (path === "/admin/users/create") return { title: "Create User", category: "Masters" };
        if (path === "/admin/user-types") return { title: "User Types Master", category: "Masters" };
        if (path === "/admin/user-types/create") return { title: "Create User Type", category: "Masters" };
        if (path === "/admin/report") return { title: "Activity Report", category: "Analytics" };
        if (path === "/profile") return { title: "Account Profile", category: "Settings" };
        if (path === "/developer" || path === "/admin/developer") return { title: "Developer Console", category: "Platform" };
        return { title: "Interlink Suite", category: "Portal" };
    };

    const pageInfo = getPageTitle(location.pathname);
    // Global shortcut Ctrl+K / Cmd+K listener
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                searchInputRef.current?.focus();
                setIsSearchOpen(true);
            }
            if (e.key === "Escape" && isSearchOpen) {
                setIsSearchOpen(false);
                searchInputRef.current?.blur();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isSearchOpen]);

    // Live Universal Search across ALL records
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.trim().length < 2) {
            setSearchResults({
                projects: [],
                tasks: [],
                notes: [],
                users: [],
                documents: [],
                user_types: [],
                audit_logs: []
            });
            setSearchTotal(0);
            return;
        }

        const timer = setTimeout(async () => {
            setLoadingSearch(true);
            try {
                // Try backend universal search endpoint first
                const res = await searchAllRecords(searchQuery.trim());
                if (res?.data?.success && res.data.results) {
                    setSearchResults(res.data.results);
                    setSearchTotal(res.data.total || 0);
                } else {
                    // Fallback to parallel project & task search
                    const [projRes, taskRes] = await Promise.allSettled([
                        getProjects({ search: searchQuery.trim() }),
                        getTasks({ search: searchQuery.trim() })
                    ]);
                    const projs = projRes.status === "fulfilled" && projRes.value?.data ? (projRes.value.data.projects || (Array.isArray(projRes.value.data) ? projRes.value.data : [])) : [];
                    const tsks = taskRes.status === "fulfilled" && taskRes.value?.data ? (taskRes.value.data.tasks || (Array.isArray(taskRes.value.data) ? taskRes.value.data : [])) : [];
                    setSearchResults({
                        projects: projs.slice(0, 6).map(p => ({ id: p.id, title: p.name, subtitle: p.code, status: p.status })),
                        tasks: tsks.slice(0, 6).map(t => ({ id: t.id, title: t.title, subtitle: t.task_code, priority: t.priority })),
                        notes: [],
                        users: [],
                        documents: [],
                        user_types: [],
                        audit_logs: []
                    });
                    setSearchTotal(projs.length + tsks.length);
                }
            } catch (err) {
                console.error("Search error:", err);
            } finally {
                setLoadingSearch(false);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const handleSelectSearchItem = (path) => {
        if (searchQuery.trim()) {
            setRecentSearches(prev => {
                const updated = [searchQuery.trim(), ...prev.filter(q => q.toLowerCase() !== searchQuery.trim().toLowerCase())].slice(0, 5);
                localStorage.setItem("interlink_recent_searches", JSON.stringify(updated));
                return updated;
            });
        }
        setIsSearchOpen(false);
        navigate(path);
    };

    const handleLogout = async () => {
        try {
            await logoutUser();
        } catch (error) {
            console.error("Logout failed", error);
        }
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        sessionStorage.removeItem("loginTime");
        window.dispatchEvent(new Event("auth-change"));
        navigate("/");
    };

    const getDisplayRole = (role) => {
        if (!role) return "Administrator";
        if (role === "admin" || role === "super admin") return "Administrator";
        return role.charAt(0).toUpperCase() + role.slice(1);
    };

    return (
        <header className="h-16 w-full bg-white border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between z-30 shrink-0 sticky top-0 shadow-xs select-none">
            {/* Left Area: Mobile Menu Toggle + Light Mode Logo */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Toggle menu"
                >
                    <i className="fa-solid fa-bars text-lg"></i>
                </button>

                {/* Light Mode Logo directly on header background */}
                <div
                    onClick={() => navigate("/user/home")}
                    className="cursor-pointer transition-opacity hover:opacity-90 flex items-center gap-2"
                    title="Interlink Workspace"
                >
                    <InterlinkLogo size="md" light={false} />
                </div>
            </div>

            {/* Middle Area: Search Bar with Anchored Normal Dropdown */}
            <div className="relative flex-1 max-w-sm sm:max-w-md lg:max-w-lg mx-2 sm:mx-6" ref={searchContainerRef}>
                <div
                    className={`flex items-center w-full px-3.5 py-1.5 sm:py-2 bg-slate-100 hover:bg-slate-200/60 border rounded-full transition-all duration-150 ${
                        isSearchOpen
                            ? "bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                            : "border-slate-200/80 shadow-2xs"
                    }`}
                >
                    <i className={`fa-solid fa-magnifying-glass text-xs sm:text-sm mr-2.5 shrink-0 transition-colors ${
                        isSearchOpen ? "text-blue-600" : "text-slate-400"
                    }`}></i>
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setIsSearchOpen(true);
                        }}
                        onFocus={() => setIsSearchOpen(true)}
                        placeholder="Search anything..."
                        className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                    />

                    {loadingSearch && (
                        <i className="fa-solid fa-circle-notch fa-spin text-blue-500 text-xs shrink-0 mx-1.5"></i>
                    )}

                    {searchQuery && (
                        <button
                            onClick={() => {
                                setSearchQuery("");
                                searchInputRef.current?.focus();
                            }}
                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors shrink-0 mx-1 cursor-pointer text-xs"
                            title="Clear query"
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    )}

                    <kbd className="hidden sm:inline-flex items-center shrink-0 whitespace-nowrap px-2 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded-md shadow-2xs select-none ml-2">
                        Ctrl + K
                    </kbd>
                </div>

                {/* Normal Dropdown anchored below the search input */}
                {isSearchOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[75vh] overflow-hidden z-50 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
                        {/* Recent Searches Pills (if query is empty) */}
                        {!searchQuery.trim() && recentSearches.length > 0 && (
                            <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Recent:</span>
                                {recentSearches.map((term, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSearchQuery(term)}
                                        className="px-2 py-0.5 rounded-full bg-white border border-slate-200 text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600 transition-colors cursor-pointer"
                                    >
                                        {term}
                                    </button>
                                ))}
                                <button
                                    onClick={() => {
                                        setRecentSearches([]);
                                        localStorage.removeItem("interlink_recent_searches");
                                    }}
                                    className="text-[10px] text-slate-400 hover:text-red-500 ml-auto cursor-pointer"
                                >
                                    Clear
                                </button>
                            </div>
                        )}

                        {/* Dropdown Content Area */}
                        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 scrollbar-thin scrollbar-thumb-slate-200">
                            {/* When searching and results exist */}
                            {searchQuery.trim() ? (
                                <>
                                    {searchTotal === 0 && !loadingSearch ? (
                                        <div className="py-8 text-center text-slate-400">
                                            <i className="fa-solid fa-folder-open text-2xl text-slate-300 mb-2"></i>
                                            <p className="text-xs font-semibold text-slate-600">No records found for "{searchQuery}"</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Try searching for project names, task titles, users, or codes.</p>
                                        </div>
                                    ) : null}

                                    {/* 1. Projects Category */}
                                    {searchResults.projects?.length > 0 && (
                                        <div className="py-1.5">
                                            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                <i className="fa-solid fa-diagram-project text-blue-500 text-[11px]"></i>
                                                Projects ({searchResults.projects.length})
                                            </div>
                                            {searchResults.projects.map(p => (
                                                <div
                                                    key={`proj-${p.id}`}
                                                    onClick={() => handleSelectSearchItem(`/projects/${p.id}`)}
                                                    className="px-3 py-2 rounded-xl hover:bg-blue-50/70 transition-colors cursor-pointer flex items-center justify-between group"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <span className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-blue-600 block truncate">
                                                            {p.title}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 block truncate">
                                                            {p.subtitle ? `Code: ${p.subtitle}` : ""} {p.status ? `• ${p.status}` : ""}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 shrink-0 capitalize">
                                                        {p.status || "Project"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 2. Tasks Category */}
                                    {searchResults.tasks?.length > 0 && (
                                        <div className="py-1.5">
                                            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                <i className="fa-solid fa-list-check text-emerald-500 text-[11px]"></i>
                                                Tasks ({searchResults.tasks.length})
                                            </div>
                                            {searchResults.tasks.map(t => (
                                                <div
                                                    key={`task-${t.id}`}
                                                    onClick={() => handleSelectSearchItem(`/tasks`)}
                                                    className="px-3 py-2 rounded-xl hover:bg-emerald-50/70 transition-colors cursor-pointer flex items-center justify-between group"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <span className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-emerald-600 block truncate">
                                                            {t.title}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 block truncate">
                                                            {t.subtitle ? `${t.subtitle} • ` : ""}Priority: {t.priority || "Normal"}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 shrink-0 capitalize">
                                                        {t.status || "Task"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 3. Notes Category */}
                                    {searchResults.notes?.length > 0 && (
                                        <div className="py-1.5">
                                            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                <i className="fa-solid fa-note-sticky text-amber-500 text-[11px]"></i>
                                                Notes ({searchResults.notes.length})
                                            </div>
                                            {searchResults.notes.map(n => (
                                                <div
                                                    key={`note-${n.id}`}
                                                    onClick={() => handleSelectSearchItem(`/notes`)}
                                                    className="px-3 py-2 rounded-xl hover:bg-amber-50/70 transition-colors cursor-pointer flex items-center justify-between group"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <span className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-amber-600 block truncate">
                                                            {n.title}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 block truncate">
                                                            {n.subtitle ? `${n.subtitle}` : ""}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 shrink-0 capitalize">
                                                        {n.priority || "Note"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 4. Users Category */}
                                    {searchResults.users?.length > 0 && (
                                        <div className="py-1.5">
                                            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                <i className="fa-solid fa-users text-purple-500 text-[11px]"></i>
                                                Users ({searchResults.users.length})
                                            </div>
                                            {searchResults.users.map(u => (
                                                <div
                                                    key={`usr-${u.id}`}
                                                    onClick={() => handleSelectSearchItem(`/admin/dashboard`)}
                                                    className="px-3 py-2 rounded-xl hover:bg-purple-50/70 transition-colors cursor-pointer flex items-center justify-between group"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <span className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-purple-600 block truncate">
                                                            {u.title}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 block truncate">
                                                            {u.subtitle}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 shrink-0 capitalize">
                                                        {u.role || "Member"}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 4. Documents Category */}
                                    {searchResults.documents?.length > 0 && (
                                        <div className="py-1.5">
                                            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                <i className="fa-solid fa-file-lines text-amber-500 text-[11px]"></i>
                                                Documents ({searchResults.documents.length})
                                            </div>
                                            {searchResults.documents.map(d => (
                                                <div
                                                    key={`doc-${d.id}`}
                                                    onClick={() => handleSelectSearchItem(`/projects/${d.project_id}`)}
                                                    className="px-3 py-2 rounded-xl hover:bg-amber-50/70 transition-colors cursor-pointer flex items-center justify-between group"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <span className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-amber-600 block truncate">
                                                            {d.title}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 block truncate">
                                                            {d.subtitle}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700 shrink-0">
                                                        Document
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 5. User Types (Roles) */}
                                    {searchResults.user_types?.length > 0 && (
                                        <div className="py-1.5">
                                            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                <i className="fa-solid fa-user-shield text-sky-500 text-[11px]"></i>
                                                Roles &amp; User Types ({searchResults.user_types.length})
                                            </div>
                                            {searchResults.user_types.map(ut => (
                                                <div
                                                    key={`ut-${ut.id}`}
                                                    onClick={() => handleSelectSearchItem(`/admin/user-types`)}
                                                    className="px-3 py-2 rounded-xl hover:bg-sky-50/70 transition-colors cursor-pointer flex items-center justify-between group"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <span className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-sky-600 block truncate">
                                                            {ut.title}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 block truncate">
                                                            {ut.subtitle}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 shrink-0">
                                                        Role Master
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 6. Audit Logs */}
                                    {searchResults.audit_logs?.length > 0 && (
                                        <div className="py-1.5">
                                            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                                <i className="fa-solid fa-clock-rotate-left text-rose-500 text-[11px]"></i>
                                                Activity Logs ({searchResults.audit_logs.length})
                                            </div>
                                            {searchResults.audit_logs.map(log => (
                                                <div
                                                    key={`log-${log.id}`}
                                                    onClick={() => handleSelectSearchItem(`/admin/report`)}
                                                    className="px-3 py-2 rounded-xl hover:bg-rose-50/70 transition-colors cursor-pointer flex items-center justify-between group"
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <span className="text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-rose-600 block truncate">
                                                            {log.title}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 block truncate">
                                                            {log.subtitle}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 shrink-0">
                                                        Audit
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : null}

                            {/* Navigation Pages */}
                            {filteredPages.length > 0 && (
                                <div className="py-1.5">
                                    <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Navigation Pages
                                    </div>
                                    {filteredPages.map(page => (
                                        <div
                                            key={page.id}
                                            onClick={() => handleSelectSearchItem(page.path)}
                                            className="px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <i className={`${page.icon} text-sm w-4 text-center`}></i>
                                                <span className="text-xs sm:text-sm font-medium text-slate-700 group-hover:text-slate-900">
                                                    {page.title}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 rounded bg-slate-100">
                                                {page.category}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Quick Actions (when query is empty) */}
                            {!searchQuery.trim() && (
                                <div className="py-1.5">
                                    <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                        Quick Actions
                                    </div>
                                    {quickActions.map(action => (
                                        <div
                                            key={action.id}
                                            onClick={() => handleSelectSearchItem(action.path)}
                                            className="px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <i className={`${action.icon} text-sm`}></i>
                                                <div>
                                                    <span className="text-xs sm:text-sm font-semibold text-slate-800 block">
                                                        {action.title}
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 block">
                                                        {action.subtitle}
                                                    </span>
                                                </div>
                                            </div>
                                            <i className="fa-solid fa-arrow-right text-xs text-slate-300 group-hover:text-slate-500 transition-colors"></i>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer hint */}
                        <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                            <span>Universal Search • All records everywhere</span>
                            <span>Press ESC to close</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Right Area: Company Switcher + Notification Bell + User Profile */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                {/* Company Switcher */}
                {companies.length > 0 && (
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1.5 text-xs">
                        <i className="fa-regular fa-building text-blue-600 text-[11px]"></i>
                        <span className="text-[10px] font-bold text-slate-400 uppercase hidden md:inline">Company:</span>
                        <select
                            value={activeCompanyId}
                            onChange={handleCompanyChange}
                            className="bg-transparent text-slate-700 font-bold text-xs focus:outline-none cursor-pointer pr-1"
                        >
                            {companies.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Notification Bell with Badge */}
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                        className="p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none flex items-center justify-center"
                        title="Notifications"
                    >
                        {/* Relative wrapper for bell icon and top-right notification counter */}
                        <div className="relative inline-flex items-center justify-center">
                            {/* Outline Bell Icon in Dark Slate */}
                            <i className="fa-regular fa-bell text-xl text-slate-700"></i>

                            {/* Solid Vibrant Red Circle Badge at Top-Right of Bell */}
                            <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-[#ef4444] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center leading-none pointer-events-none shadow-xs">
                                3
                            </span>
                        </div>
                    </button>

                    {/* Notification Dropdown (Temporary Preview) */}
                    {isNotificationOpen && (
                        <div className="absolute right-0 top-full mt-2 w-80 sm:w-88 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2.5 z-50 origin-top-right animate-in fade-in slide-in-from-top-2 duration-150">
                            <div className="px-4 pb-2.5 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-800 text-sm">Notifications</span>
                                    <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 text-[10px] font-bold">
                                        3 New
                                    </span>
                                </div>
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500">
                                    Preview
                                </span>
                            </div>

                            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                                <div className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-xs mt-0.5">
                                        <i className="fa-solid fa-list-check"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-800 truncate">New task assigned</p>
                                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">Prepare Q4 audit report for review</p>
                                        <span className="text-[10px] text-slate-400 mt-1 block">10 mins ago</span>
                                    </div>
                                </div>

                                <div className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-xs mt-0.5">
                                        <i className="fa-solid fa-diagram-project"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-800 truncate">Milestone achieved</p>
                                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">Interlink v2.0 foundation deployed</p>
                                        <span className="text-[10px] text-slate-400 mt-1 block">1 hour ago</span>
                                    </div>
                                </div>

                                <div className="p-3 hover:bg-slate-50 transition-colors flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 text-xs mt-0.5">
                                        <i className="fa-solid fa-shield-halved"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-800 truncate">Device verification</p>
                                        <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">Current device approved &amp; active</p>
                                        <span className="text-[10px] text-slate-400 mt-1 block">Today</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 px-4 border-t border-slate-100 text-center">
                                <span className="text-[11px] text-slate-400">
                                    Notification actions will be enabled in next update
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* User Profile Block */}
                <div className="relative" ref={profileRef}>
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-2 sm:gap-2.5 p-1 sm:px-2 py-1 rounded-full sm:rounded-xl hover:bg-slate-100 transition-all cursor-pointer focus:outline-none"
                    >
                        {/* Circular Avatar */}
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full ring-2 ring-slate-200 overflow-hidden bg-gradient-to-tr from-[#0056cf] to-sky-400 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                <span>{user.name ? user.name[0].toUpperCase() : "U"}</span>
                            )}
                        </div>

                        {/* Name & Role */}
                        <div className="hidden sm:flex flex-col text-left leading-tight">
                            <span className="text-xs sm:text-sm font-bold text-slate-800 truncate max-w-[130px]">
                                {user.name || "User"}
                            </span>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                <span>{getDisplayRole(user.role)}</span>
                                <i className={`fa-solid fa-chevron-down text-[9px] text-slate-400 transition-transform ${isProfileOpen ? "rotate-180" : ""}`}></i>
                            </div>
                        </div>

                        {/* Far-right options icon (matches screenshot) */}
                        <div className="hidden md:flex items-center justify-center text-slate-400 pl-1">
                            <i className="fa-solid fa-ellipsis-vertical text-xs"></i>
                        </div>
                    </button>

                    {/* Profile Dropdown Menu */}
                    {isProfileOpen && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 origin-top-right animate-in fade-in slide-in-from-top-2 duration-150">
                            <div className="px-4 py-2.5 border-b border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Signed in as</p>
                                <p className="text-sm font-bold text-slate-800 truncate mt-0.5">{user.name || "User"}</p>
                                {user.email && (
                                    <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                                )}
                            </div>

                            <div className="p-1">
                                <button
                                    onClick={() => {
                                        navigate("/profile");
                                        setIsProfileOpen(false);
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-all cursor-pointer text-left"
                                >
                                    <i className="fa-regular fa-user text-slate-400 text-sm w-4"></i>
                                    <span>Account Profile</span>
                                </button>

                                <button
                                    onClick={() => {
                                        setIsProfileOpen(false);
                                        handleLogout();
                                    }}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-red-600 hover:bg-red-50 text-xs font-semibold transition-all cursor-pointer text-left mt-0.5"
                                >
                                    <i className="fa-solid fa-arrow-right-from-bracket text-red-500 text-sm w-4"></i>
                                    <span>Sign Out</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

// ─── Main Sidebar Navigation (Positioned UNDER Header) ──────────────────────
export default function Sidebar({
    isOpen = false,
    onClose = () => {},
    isCollapsed = false,
    onToggleCollapse = () => {}
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const { hasPermission } = usePermission();
    const isAdmin = user.role === "admin" || user.role === "super admin" || user.role === "super_admin";
    const isDeveloper = user.role === "super_admin" || user.role === "super admin" || user.role === "developer";

    const [companies, setCompanies] = useState(user.companies || []);
    const [activeCompanyId, setActiveCompanyId] = useState(
        localStorage.getItem("active_company_id") || user.company_id || "1"
    );

    useEffect(() => {
        getCompanies()
            .then((res) => {
                if (res.data?.success && res.data.companies) {
                    setCompanies(res.data.companies);
                    const currentActive = localStorage.getItem("active_company_id") || user.company_id;
                    if (!currentActive && res.data.companies.length > 0) {
                        const firstId = String(res.data.companies[0].id);
                        setActiveCompanyId(firstId);
                        localStorage.setItem("active_company_id", firstId);
                    }
                }
            })
            .catch((err) => {
                console.error("Sidebar getCompanies error:", err);
            });
    }, []);

    const handleCompanyChange = async (e) => {
        const newId = e.target.value;
        setActiveCompanyId(newId);
        localStorage.setItem("active_company_id", newId);
        const updatedUser = { ...user, company_id: parseInt(newId, 10) };
        localStorage.setItem("user", JSON.stringify(updatedUser));

        try {
            await switchCompany(newId);
        } catch (err) {
            console.warn("Backend switch notice:", err.message);
        }

        window.location.reload();
    };

    const isMasterRoute = location.pathname.startsWith("/admin/") && location.pathname !== "/admin/report";
    const [mastersOpen, setMastersOpen] = useState(isMasterRoute);

    useEffect(() => {
        if (isMasterRoute) {
            setMastersOpen(true);
        }
    }, [location.pathname, isMasterRoute]);

    const handleLogout = async () => {
        try {
            await logoutUser();
        } catch (error) {
            console.error("Logout failed", error);
        }
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        sessionStorage.removeItem("loginTime");
        window.dispatchEvent(new Event("auth-change"));
        navigate("/");
    };

    const handleNav = (path) => {
        navigate(path);
        if (onClose) onClose();
    };

    const canReadUsers = isAdmin || hasPermission("user_master", "read") || hasPermission("device_approval", "read");
    const canReadRoles = isAdmin || hasPermission("user_type", "read");
    const canViewReport = isAdmin || hasPermission("activity_report", "read");

    const masterItems = [
        {
            name: "User Master",
            path: "/admin/dashboard",
            matchPaths: ["/admin/dashboard", "/admin/users/create"],
            icon: "fa-solid fa-users-gear",
            visible: canReadUsers
        },
        {
            name: "Company Master",
            path: "/admin/companies",
            matchPaths: ["/admin/companies"],
            icon: "fa-solid fa-building",
            visible: isAdmin
        },
        {
            name: "Department Master",
            path: "/admin/departments",
            matchPaths: ["/admin/departments"],
            icon: "fa-solid fa-sitemap",
            visible: canReadUsers
        },
        {
            name: "Chat Settings Master",
            path: "/admin/chat-settings",
            matchPaths: ["/admin/chat-settings"],
            icon: "fa-solid fa-sliders",
            visible: isAdmin
        },
        {
            name: "User Types Master",
            path: "/admin/user-types",
            matchPaths: ["/admin/user-types", "/admin/user-types/create"],
            icon: "fa-solid fa-user-shield",
            visible: canReadRoles
        }
    ].filter(m => m.visible);

    const hasAnyMaster = masterItems.length > 0;

    return (
        <>
            {/* Backdrop on mobile: Sits cleanly UNDER the header (top-16) */}
            {isOpen && (
                <div
                    onClick={onClose}
                    className="fixed top-16 bottom-0 inset-x-0 bg-slate-950/60 backdrop-blur-xs z-30 lg:hidden transition-opacity"
                    aria-hidden="true"
                />
            )}

            {/* Sidebar Container: Starts under header (top-16 on mobile, static on desktop) */}
            <aside
                className={`fixed lg:static top-16 lg:top-0 bottom-0 left-0 z-40 flex flex-col h-[calc(100vh-4rem)] lg:h-full bg-[#071328] border-r border-slate-800/80 text-slate-300 transition-all duration-300 ease-in-out select-none shadow-2xl lg:shadow-none
                    ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
                    ${isCollapsed ? "lg:w-20 w-64" : "w-64"}
                `}
            >
                {/* Clean Top Bar in Sidebar: Section label + Collapse/Close controls */}
                <div className={`h-12 px-3 flex items-center ${isCollapsed ? "justify-center" : "justify-between"} border-b border-slate-800/70 shrink-0 text-slate-400`}>
                    {!isCollapsed && (
                        <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 px-2 flex items-center gap-2">
                            <i className="fa-solid fa-compass text-blue-400 text-xs"></i>
                            Navigation
                        </span>
                    )}

                    <div className="flex items-center gap-1">
                        <button
                            onClick={onToggleCollapse}
                            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
                            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                        >
                            <i className={`fa-solid ${isCollapsed ? "fa-angles-right" : "fa-angles-left"} text-xs`}></i>
                        </button>

                        <button
                            onClick={onClose}
                            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Close sidebar"
                        >
                            <i className="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>
                </div>

                {/* Company Switcher in Sidebar */}
                <div className="px-3 py-3 border-b border-slate-800/80 bg-slate-950/40">
                    {!isCollapsed ? (
                        <div>
                            <div className="flex items-center justify-between px-1 mb-1.5">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <i className="fa-solid fa-building text-blue-400 text-[10px]"></i>
                                    Company
                                </span>
                                {isAdmin && (
                                    <button
                                        onClick={() => handleNav("/admin/companies")}
                                        className="text-[10px] text-blue-400 hover:text-blue-300 font-bold hover:underline cursor-pointer"
                                        title="Open Company Master"
                                    >
                                        Manage
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <select
                                    value={String(activeCompanyId)}
                                    onChange={handleCompanyChange}
                                    className="w-full bg-slate-900 border border-slate-700/80 hover:border-slate-600 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-blue-500 appearance-none pr-8 cursor-pointer shadow-sm transition-all"
                                >
                                    {companies.length === 0 ? (
                                        <option value="1">Default Company</option>
                                    ) : (
                                        companies.map((c) => (
                                            <option key={c.id} value={String(c.id)} className="bg-slate-900 text-white py-1">
                                                {c.name}
                                            </option>
                                        ))
                                    )}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                                    <i className="fa-solid fa-chevron-down text-[10px]"></i>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-center py-0.5">
                            <button
                                onClick={() => handleNav("/admin/companies")}
                                title={companies.find(c => String(c.id) === String(activeCompanyId))?.name || "Company Workspace"}
                                className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-blue-400 hover:text-white hover:border-blue-500 flex items-center justify-center transition-all cursor-pointer"
                            >
                                <i className="fa-solid fa-building text-sm"></i>
                            </button>
                        </div>
                    )}
                </div>

                {/* Nav Items */}
                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
                    <div>
                        {!isCollapsed && (
                            <p className="px-3 mb-2 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                                Main Navigation
                            </p>
                        )}
                        <div className="space-y-1">
                            <button
                                onClick={() => handleNav("/user/home")}
                                title={isCollapsed ? "User Dashboard" : ""}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-left group relative ${
                                    location.pathname === "/user/home"
                                        ? "bg-gradient-to-r from-blue-600 to-[#0056cf] text-white shadow-lg shadow-blue-600/30 font-semibold"
                                        : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                                } ${isCollapsed ? "justify-center" : ""}`}
                            >
                                <span className={`flex items-center justify-center w-5 text-center shrink-0 text-base ${
                                    location.pathname === "/user/home" ? "text-white" : "text-slate-400 group-hover:text-blue-400"
                                }`}>
                                    <i className="fa-solid fa-gauge-high"></i>
                                </span>
                                {!isCollapsed && (
                                    <span className="truncate">User Dashboard</span>
                                )}
                            </button>

                            <button
                                onClick={() => handleNav("/projects")}
                                title={isCollapsed ? "Projects & Portfolio" : ""}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-left group relative ${
                                    location.pathname.startsWith("/projects")
                                        ? "bg-gradient-to-r from-blue-600 to-[#0056cf] text-white shadow-lg shadow-blue-600/30 font-semibold"
                                        : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                                } ${isCollapsed ? "justify-center" : ""}`}
                            >
                                <span className={`flex items-center justify-center w-5 text-center shrink-0 text-base ${
                                    location.pathname.startsWith("/projects") ? "text-white" : "text-slate-400 group-hover:text-blue-400"
                                }`}>
                                    <i className="fa-solid fa-diagram-project"></i>
                                </span>
                                {!isCollapsed && (
                                    <span className="truncate">Projects &amp; Portfolio</span>
                                )}
                            </button>

                            <button
                                onClick={() => handleNav("/tasks")}
                                title={isCollapsed ? "Task Management" : ""}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-left group relative ${
                                    location.pathname.startsWith("/tasks")
                                        ? "bg-gradient-to-r from-blue-600 to-[#0056cf] text-white shadow-lg shadow-blue-600/30 font-semibold"
                                        : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                                } ${isCollapsed ? "justify-center" : ""}`}
                            >
                                <span className={`flex items-center justify-center w-5 text-center shrink-0 text-base ${
                                    location.pathname.startsWith("/tasks") ? "text-white" : "text-slate-400 group-hover:text-blue-400"
                                }`}>
                                    <i className="fa-solid fa-list-check"></i>
                                </span>
                                {!isCollapsed && (
                                    <span className="truncate">Task Management</span>
                                )}
                            </button>

                            <button
                                onClick={() => handleNav("/notes")}
                                title={isCollapsed ? "Notes & Scratchpad" : ""}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-left group relative ${
                                    location.pathname.startsWith("/notes")
                                        ? "bg-gradient-to-r from-blue-600 to-[#0056cf] text-white shadow-lg shadow-blue-600/30 font-semibold"
                                        : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                                } ${isCollapsed ? "justify-center" : ""}`}
                            >
                                <span className={`flex items-center justify-center w-5 text-center shrink-0 text-base ${
                                    location.pathname.startsWith("/notes") ? "text-white" : "text-slate-400 group-hover:text-blue-400"
                                }`}>
                                    <i className="fa-solid fa-note-sticky"></i>
                                </span>
                                {!isCollapsed && (
                                    <span className="truncate">Notes &amp; Scratchpad</span>
                                )}
                            </button>

                            <button
                                onClick={() => handleNav("/chat")}
                                title={isCollapsed ? "Chat & Communication" : ""}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-left group relative ${
                                    location.pathname.startsWith("/chat")
                                        ? "bg-gradient-to-r from-blue-600 to-[#0056cf] text-white shadow-lg shadow-blue-600/30 font-semibold"
                                        : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                                } ${isCollapsed ? "justify-center" : ""}`}
                            >
                                <span className={`flex items-center justify-center w-5 text-center shrink-0 text-base ${
                                    location.pathname.startsWith("/chat") ? "text-white" : "text-slate-400 group-hover:text-blue-400"
                                }`}>
                                    <i className="fa-solid fa-comments"></i>
                                </span>
                                {!isCollapsed && (
                                    <span className="truncate">Chat &amp; Communication</span>
                                )}
                            </button>

                            <button
                                onClick={() => handleNav("/meetings")}
                                title={isCollapsed ? "Meetings & Whiteboard" : ""}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-left group relative ${
                                    location.pathname.startsWith("/meetings")
                                        ? "bg-gradient-to-r from-blue-600 to-[#0056cf] text-white shadow-lg shadow-blue-600/30 font-semibold"
                                        : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                                } ${isCollapsed ? "justify-center" : ""}`}
                            >
                                <span className={`flex items-center justify-center w-5 text-center shrink-0 text-base ${
                                    location.pathname.startsWith("/meetings") ? "text-white" : "text-slate-400 group-hover:text-teal-400"
                                }`}>
                                    <i className="fa-solid fa-video"></i>
                                </span>
                                {!isCollapsed && (
                                    <span className="truncate">Meetings &amp; Whiteboard</span>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Developer Console (Super Admin / Developer only) */}
                    {isDeveloper && (
                        <div>
                            {!isCollapsed && (
                                <p className="px-3 mb-2 text-[10px] font-bold tracking-wider uppercase text-purple-400 flex items-center gap-1.5">
                                    <i className="fa-solid fa-code text-[10px]"></i>
                                    Platform Control
                                </p>
                            )}
                            <div className="space-y-1">
                                <button
                                    onClick={() => handleNav("/developer")}
                                    title={isCollapsed ? "Developer Console" : ""}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-left group relative ${
                                        location.pathname === "/developer" || location.pathname === "/admin/developer"
                                            ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/30 font-semibold"
                                            : "text-purple-300 hover:text-white hover:bg-purple-950/40 border border-purple-900/30"
                                    } ${isCollapsed ? "justify-center" : ""}`}
                                >
                                    <span className={`flex items-center justify-center w-5 text-center shrink-0 text-base ${
                                        location.pathname === "/developer" || location.pathname === "/admin/developer" ? "text-white" : "text-purple-400 group-hover:text-purple-300"
                                    }`}>
                                        <i className="fa-solid fa-laptop-code"></i>
                                    </span>
                                    {!isCollapsed && (
                                        <div className="flex items-center justify-between flex-1 min-w-0">
                                            <span className="truncate">Developer Console</span>
                                            <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full font-bold uppercase">
                                                Super
                                            </span>
                                        </div>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {hasAnyMaster && (
                        <div>
                            {!isCollapsed && (
                                <p className="px-3 mb-2 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                                    Administration
                                </p>
                            )}

                            <div className="space-y-1">
                                {!isCollapsed ? (
                                    <>
                                        <button
                                            onClick={() => setMastersOpen(!mastersOpen)}
                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-left group ${
                                                isMasterRoute
                                                    ? "text-blue-400 bg-blue-950/40 border border-blue-900/50"
                                                    : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 truncate">
                                                <span className={`flex items-center justify-center w-5 text-center shrink-0 text-base ${
                                                    isMasterRoute ? "text-blue-400" : "text-slate-400 group-hover:text-blue-400"
                                                }`}>
                                                    <i className="fa-solid fa-layer-group"></i>
                                                </span>
                                                <span className="truncate font-semibold">Masters</span>
                                            </div>
                                            <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-200 text-slate-500 ${
                                                mastersOpen ? "rotate-180 text-blue-400" : ""
                                            }`}></i>
                                        </button>

                                        {mastersOpen && (
                                            <div className="ml-4 pl-3 border-l border-slate-800 space-y-1 mt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                                                {masterItems.map((item, idx) => {
                                                    const isActive = item.matchPaths.some(p => location.pathname === p);
                                                    return (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleNav(item.path)}
                                                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer text-left ${
                                                                isActive
                                                                    ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20"
                                                                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                                                            }`}
                                                        >
                                                            <i className={`${item.icon} text-xs w-4 text-center ${isActive ? "text-white" : "text-slate-400"}`}></i>
                                                            <span className="truncate">{item.name}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    masterItems.map((item, idx) => {
                                        const isActive = item.matchPaths.some(p => location.pathname === p);
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => handleNav(item.path)}
                                                title={item.name}
                                                className={`w-full flex items-center justify-center px-3 py-2.5 rounded-xl text-sm transition-all duration-150 cursor-pointer ${
                                                    isActive
                                                        ? "bg-blue-600 text-white font-semibold shadow-lg shadow-blue-600/30"
                                                        : "text-slate-400 hover:text-white hover:bg-slate-800/70"
                                                }`}
                                            >
                                                <i className={`${item.icon} text-base`}></i>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {canViewReport && (
                        <div>
                            {!isCollapsed && (
                                <p className="px-3 mb-2 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                                    Analytics
                                </p>
                            )}
                            <div className="space-y-1">
                                <button
                                    onClick={() => handleNav("/admin/report")}
                                    title={isCollapsed ? "Activity Report" : ""}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-left group relative ${
                                        location.pathname === "/admin/report"
                                            ? "bg-gradient-to-r from-blue-600 to-[#0056cf] text-white shadow-lg shadow-blue-600/30 font-semibold"
                                            : "text-slate-300 hover:text-white hover:bg-slate-800/70"
                                    } ${isCollapsed ? "justify-center" : ""}`}
                                >
                                    <span className={`flex items-center justify-center w-5 text-center shrink-0 text-base ${
                                        location.pathname === "/admin/report" ? "text-white" : "text-slate-400 group-hover:text-blue-400"
                                    }`}>
                                        <i className="fa-solid fa-clock-rotate-left"></i>
                                    </span>
                                    {!isCollapsed && (
                                        <span className="truncate">Activity Report</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Compact Bottom Bar */}
                <div className="p-3 border-t border-slate-800/70 bg-[#061022] shrink-0">
                    <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} gap-2`}>
                        <div
                            onClick={() => handleNav("/profile")}
                            className="flex items-center gap-2.5 overflow-hidden cursor-pointer group p-1 rounded-xl hover:bg-slate-800/60 transition-colors flex-1"
                            title="View your profile"
                        >
                            <div className="relative shrink-0">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 text-white flex items-center justify-center font-bold text-xs shadow-md border border-white/10 group-hover:scale-105 transition-transform">
                                    {user.name ? user.name[0].toUpperCase() : "U"}
                                </div>
                                <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-[#061022] rounded-full"></span>
                            </div>

                            {!isCollapsed && (
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs font-bold text-white truncate group-hover:text-sky-300 transition-colors">
                                        {user.name || "User"}
                                    </span>
                                    <span className="text-[10px] text-slate-400 capitalize truncate">
                                        {user.role || "Member"}
                                    </span>
                                </div>
                            )}
                        </div>

                        {!isCollapsed && (
                            <button
                                onClick={handleLogout}
                                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer shrink-0"
                                title="Sign out"
                            >
                                <i className="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                            </button>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}

// ─── Self-Contained Layout Wrapper (Header spans entire width, Sidebar sits under it) ──
export function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
            {/* 1. Header sits across the very top (full width) */}
            <TopBar onMenuClick={() => setSidebarOpen(prev => !prev)} />

            {/* 2. Main Row: Sidebar opens UNDER header, Main Content on right */}
            <div className="flex flex-1 min-h-0 overflow-hidden relative">
                {/* Sidebar under header */}
                <Sidebar
                    isOpen={sidebarOpen}
                    onClose={() => setSidebarOpen(false)}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => setIsCollapsed(prev => !prev)}
                />

                {/* Content View */}
                <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
                    <main className="flex-1 w-full">
                        <Outlet />
                    </main>
                    <Footer />
                </div>
            </div>
        </div>
    );
}


