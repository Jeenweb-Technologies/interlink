import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { logoutUser } from "../api/authApi";
import { usePermission } from "../context/PermissionContext";
import InterlinkLogo from "./InterlinkLogo";

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

    // Masters submenu open state
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

    // Permission checks for masters
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
            {/* Mobile Backdrop Overlay */}
            {isOpen && (
                <div
                    onClick={onClose}
                    className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-40 lg:hidden transition-opacity"
                    aria-hidden="true"
                />
            )}

            {/* Sidebar Container */}
            <aside
                className={`fixed lg:static top-0 bottom-0 left-0 z-50 flex flex-col h-screen bg-[#071328] border-r border-slate-800/80 text-slate-300 transition-all duration-300 ease-in-out select-none shadow-2xl lg:shadow-none
                    ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
                    ${isCollapsed ? "lg:w-20 w-64" : "w-64"}
                `}
            >
                {/* 1. Header / Logo */}
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

                    {/* Mobile close button */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                        title="Close sidebar"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>

                    {/* Desktop collapse toggle */}
                    <button
                        onClick={onToggleCollapse}
                        className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
                        title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        <i className={`fa-solid ${isCollapsed ? "fa-chevron-right" : "fa-chevron-left"} text-xs`}></i>
                    </button>
                </div>

                {/* 2. Navigation Items (Scrollable) */}
                <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
                    {/* Main Section */}
                    <div>
                        {!isCollapsed && (
                            <p className="px-3 mb-2 text-[10px] font-bold tracking-wider uppercase text-slate-500">
                                Main Navigation
                            </p>
                        )}
                        <div className="space-y-1">
                            {/* Dashboard */}
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
                        </div>
                    </div>

                    {/* Management Section (Masters) */}
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
                                        {/* Masters Accordion Header */}
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

                                        {/* Masters Sub-menu */}
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
                                    /* Collapsed Masters items */
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

                    {/* Monitoring / Reports Section */}
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

                {/* 3. Footer / User Profile & Logout */}
                <div className="p-3 border-t border-slate-800/70 bg-[#061022] shrink-0">
                    <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} gap-2`}>
                        <div
                            onClick={() => handleNav("/profile")}
                            className="flex items-center gap-2.5 overflow-hidden cursor-pointer group p-1 rounded-xl hover:bg-slate-800/60 transition-colors flex-1"
                            title="View your profile"
                        >
                            {/* Avatar */}
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

                        {/* Sign Out Button */}
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
