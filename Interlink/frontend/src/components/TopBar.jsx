import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { logoutUser } from "../api/authApi";

export default function TopBar({ onMenuClick = () => {} }) {
    const location = useLocation();
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Get friendly page title based on path
    const getPageTitle = (path) => {
        if (path === "/user/home") return { title: "User Dashboard", category: "Overview" };
        if (path === "/admin/dashboard") return { title: "User Master", category: "Masters" };
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
            {/* Left: Mobile hamburger + Page Breadcrumb */}
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

            {/* Right: Status badge, Live Time, Profile Menu */}
            <div className="flex items-center gap-4 sm:gap-6">
                {/* System status pill */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Interlink Connected</span>
                </div>

                {/* Live clock */}
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/70">
                    <i className="fa-regular fa-clock text-slate-400"></i>
                    <span>{currentTime}</span>
                </div>

                {/* Profile quick dropdown */}
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
