import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { logoutUser } from "../api/authApi";
import { getCompanies, switchCompany } from "../api/companyApi";
import { usePermission } from "../context/PermissionContext";
import Footer from "./Footer";

// ─── Self-Contained Interlink Logo ───────────────────────────────────────────
export function InterlinkLogo({
    size = "md",
    showText = true,
    light = false,
    className = "",
    textClassName = "",
    subtitle = "ENTERPRISE"
}) {
    const sizes = {
        sm: { icon: "w-7 h-7", text: "text-lg", mark: "h-7 w-7" },
        md: { icon: "w-9 h-9", text: "text-xl", mark: "h-9 w-9" },
        lg: { icon: "w-11 h-11", text: "text-2xl", mark: "h-11 w-11" },
        xl: { icon: "w-14 h-14", text: "text-3xl", mark: "h-14 w-14" },
    };

    const s = sizes[size] || sizes.md;

    return (
        <div className={`flex items-center gap-2.5 select-none ${className}`}>
            <div className={`relative ${s.mark} shrink-0 transition-transform duration-300 hover:scale-105`}>
                <svg
                    viewBox="0 0 48 48"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full drop-shadow-[0_2px_10px_rgba(0,86,207,0.35)]"
                >
                    <defs>
                        <linearGradient id="sbIlG1" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#0056cf" />
                            <stop offset="50%" stopColor="#0284c7" />
                            <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                        <linearGradient id="sbIlG2" x1="100%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#38bdf8" />
                            <stop offset="50%" stopColor="#2563eb" />
                            <stop offset="100%" stopColor="#6366f1" />
                        </linearGradient>
                    </defs>

                    <rect width="48" height="48" rx="13" fill="#071328" />
                    <rect width="48" height="48" rx="13" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

                    <path
                        d="M19 14 H15 C10.58 14 7 17.58 7 22 C7 26.42 10.58 30 15 30 H19 C23.42 30 27 26.42 27 22"
                        stroke="url(#sbIlG1)"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                    <path
                        d="M29 34 H33 C37.42 34 41 30.42 41 26 C41 21.58 37.42 18 33 18 H29 C24.58 18 21 21.58 21 26"
                        stroke="url(#sbIlG2)"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                    <path
                        d="M19 14 H21 C24.5 14 27 16.5 27 20"
                        stroke="url(#sbIlG1)"
                        strokeWidth="4"
                        strokeLinecap="round"
                    />
                    <circle cx="24" cy="24" r="2.5" fill="#38bdf8" />
                </svg>
            </div>

            {showText && (
                <div className="flex flex-col">
                    <span className={`font-black tracking-tight leading-none ${s.text} ${textClassName || (light ? "text-white" : "text-slate-900")}`}>
                        Inter<span className="bg-gradient-to-r from-blue-500 via-sky-400 to-teal-400 bg-clip-text text-transparent">link</span>
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

// ─── Self-Contained TopBar ───────────────────────────────────────────────────
export function TopBar({ onMenuClick = () => {} }) {
    const location = useLocation();
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
    const [isProfileOpen, setIsProfileOpen] = useState(false);
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

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const getPageTitle = (path) => {
        if (path === "/user/home") return { title: "User Dashboard", category: "Overview" };
        if (path.startsWith("/projects")) return { title: "Projects & Portfolio", category: "Governance" };
        if (path.startsWith("/tasks")) return { title: "Task Management", category: "Productivity" };
        if (path === "/admin/dashboard") return { title: "User Master", category: "Masters" };
        if (path === "/admin/companies") return { title: "Company Master", category: "Masters" };
        if (path === "/admin/users/create") return { title: "Create User", category: "Masters" };
        if (path === "/admin/user-types") return { title: "User Types Master", category: "Masters" };
        if (path === "/admin/user-types/create") return { title: "Create User Type", category: "Masters" };
        if (path === "/admin/report") return { title: "Activity Report", category: "Analytics" };
        if (path === "/profile") return { title: "Account Profile", category: "Settings" };
        return { title: "Interlink Suite", category: "Portal" };
    };

    const pageInfo = getPageTitle(location.pathname);

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

    return (
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between z-20 shrink-0 sticky top-0 backdrop-blur-md bg-white/95">
            <div className="flex items-center gap-3">
                <button
                    onClick={onMenuClick}
                    className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Open menu"
                >
                    <i className="fa-solid fa-bars text-lg"></i>
                </button>

                <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                        <span>{pageInfo.category}</span>
                        <i className="fa-solid fa-chevron-right text-[9px] text-slate-300"></i>
                        <span className="text-blue-600 font-bold">{pageInfo.title}</span>
                    </div>
                    <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight leading-tight hidden sm:block">
                        {pageInfo.title}
                    </h1>
                </div>
            </div>

            <div className="flex items-center gap-4 sm:gap-6">
                <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Interlink Connected</span>
                </div>

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

                <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/70">
                    <i className="fa-regular fa-clock text-slate-400"></i>
                    <span>{currentTime}</span>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1 rounded-full hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all cursor-pointer focus:outline-none"
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0056cf] to-sky-400 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                            {user.name ? user.name[0].toUpperCase() : "U"}
                        </div>
                        <span className="hidden md:inline text-xs font-bold text-slate-700 max-w-[120px] truncate">
                            {user.name || "User"}
                        </span>
                        <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform hidden sm:inline ${
                            isProfileOpen ? "rotate-180" : ""
                        }`}></i>
                    </button>

                    {isProfileOpen && (
                        <div
                            onMouseLeave={() => setIsProfileOpen(false)}
                            className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-2 z-50 origin-top-right animate-in fade-in slide-in-from-top-2 duration-150"
                        >
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

// ─── Main Sidebar Navigation ────────────────────────────────────────────────
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
    const isAdmin = user.role === "admin" || user.role === "super admin";

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
            {isOpen && (
                <div
                    onClick={onClose}
                    className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                    aria-hidden="true"
                />
            )}

            <aside
                className={`fixed lg:static top-0 bottom-0 left-0 z-50 flex flex-col h-screen bg-[#071328] border-r border-slate-800/80 text-slate-300 transition-all duration-300 ease-in-out select-none shadow-2xl lg:shadow-none
                    ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
                    ${isCollapsed ? "lg:w-20 w-64" : "w-64"}
                `}
            >
                {/* Header / Logo */}
                <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/70 shrink-0">
                    <div
                        onClick={() => handleNav("/user/home")}
                        className="cursor-pointer overflow-hidden transition-opacity hover:opacity-90"
                        title="Interlink Enterprise"
                    >
                        <InterlinkLogo
                            size={isCollapsed ? "sm" : "md"}
                            showText={!isCollapsed}
                            light={true}
                        />
                    </div>

                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Close sidebar"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>

                    <button
                        onClick={onToggleCollapse}
                        className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <i className={`fa-solid ${isCollapsed ? "fa-chevron-right" : "fa-chevron-left"} text-xs`}></i>
                    </button>
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
                                title={isCollapsed ? "Projects & Initiatives" : ""}
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
                        </div>
                    </div>

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

                {/* Footer User Profile & Logout */}
                <div className="p-3 border-t border-slate-800/70 bg-[#061022] shrink-0">
                    <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} gap-2`}>
                        <div
                            onClick={() => handleNav("/profile")}
                            className="flex items-center gap-2.5 overflow-hidden cursor-pointer group p-1 rounded-xl hover:bg-slate-800/60 transition-colors flex-1"
                            title="View your profile"
                        >
                            <div className="relative shrink-0">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 text-white flex items-center justify-center font-bold text-sm shadow-md border border-white/10 group-hover:scale-105 transition-transform">
                                    {user.name ? user.name[0].toUpperCase() : "U"}
                                </div>
                                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#061022] rounded-full"></span>
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
                                <i className="fa-solid fa-arrow-right-from-bracket text-sm"></i>
                            </button>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}

// ─── Self-Contained Layout Wrapper ───────────────────────────────────────────
export function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
            />

            <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto">
                <TopBar onMenuClick={() => setSidebarOpen(true)} />
                <main className="flex-1 w-full">
                    <Outlet />
                </main>
                <Footer />
            </div>
        </div>
    );
}
