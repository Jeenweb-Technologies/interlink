import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Footer from "./Footer";

export default function DashboardLayout() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-800">
            {/* Sidebar Navigation */}
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                isCollapsed={isCollapsed}
                onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
            />

            {/* Main Area (TopBar + Content + Footer) */}
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
