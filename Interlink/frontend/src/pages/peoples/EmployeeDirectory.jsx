import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getAllUsers, toggleUserActive } from "../../api/authApi";
import { getCompanies } from "../../api/companyApi";
import { getDepartments } from "../../api/departmentApi";
import { startDirectChat } from "../../api/chatApi";
import { usePermission } from "../../context/PermissionContext";
import toast from "react-hot-toast";

export default function EmployeeDirectory() {
    const navigate = useNavigate();
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
    const { hasPermission } = usePermission();
    const isAdmin = currentUser.role === "admin" || currentUser.role === "super admin";
    const canCreateUser = isAdmin || hasPermission("user_master", "write");

    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);

    const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCompany, setSelectedCompany] = useState("ALL");
    const [selectedDepartment, setSelectedDepartment] = useState("ALL");
    const [statusFilter, setStatusFilter] = useState("ALL"); // "ALL" | "ACTIVE" | "INACTIVE" | "VENDOR"
    const [actionLoading, setActionLoading] = useState({});

    useEffect(() => {
        loadDirectoryData();
    }, []);

    const loadDirectoryData = async () => {
        setLoading(true);
        try {
            const [usersRes, compsRes, deptsRes] = await Promise.allSettled([
                getAllUsers(true),
                getCompanies({ includeInactive: false }),
                getDepartments(false)
            ]);

            if (usersRes.status === "fulfilled") {
                const uData = usersRes.value.data?.data || usersRes.value.data || usersRes.value || [];
                setUsers(Array.isArray(uData) ? uData : []);
            } else {
                toast.error("Failed to load employees list");
            }

            if (compsRes.status === "fulfilled") {
                const cData = compsRes.value.companies || compsRes.value.data || (Array.isArray(compsRes.value) ? compsRes.value : []);
                setCompanies(Array.isArray(cData) ? cData : []);
            }

            if (deptsRes.status === "fulfilled") {
                const dData = deptsRes.value.departments || deptsRes.value.data || (Array.isArray(deptsRes.value) ? deptsRes.value : []);
                setDepartments(Array.isArray(dData) ? dData : []);
            }
        } catch (err) {
            console.error("Error loading directory data:", err);
            toast.error("Unable to load directory records");
        } finally {
            setLoading(false);
        }
    };

    const handleStartChat = async (targetUser) => {
        if (!targetUser || targetUser.id === currentUser.id) return;
        const key = `chat_${targetUser.id}`;
        setActionLoading(prev => ({ ...prev, [key]: true }));
        try {
            const res = await startDirectChat(targetUser.id);
            if (res.success && res.conversation) {
                toast.success(`Starting chat with ${targetUser.name || targetUser.username}`);
                navigate("/chat", { state: { targetConversationId: res.conversation.id } });
            } else {
                toast.error(res.message || "Failed to start conversation");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Could not open chat session");
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleToggleActive = async (user) => {
        const nextActive = !user.active;
        const key = `toggle_${user.id}`;
        setActionLoading(prev => ({ ...prev, [key]: true }));
        try {
            const res = await toggleUserActive(user.id, nextActive);
            if (res.data?.success || res.success) {
                toast.success(`User ${nextActive ? "activated" : "deactivated"} successfully`);
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: nextActive ? 1 : 0 } : u));
            } else {
                toast.error(res.data?.message || "Status change failed");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Error updating user status");
        } finally {
            setActionLoading(prev => ({ ...prev, [key]: false }));
        }
    };

    // Filtered users list
    const filteredUsers = useMemo(() => {
        return users.filter(u => {
            // Text search
            if (searchTerm.trim()) {
                const q = searchTerm.toLowerCase();
                const matchName = (u.name || "").toLowerCase().includes(q);
                const matchUser = (u.username || "").toLowerCase().includes(q);
                const matchEmail = (u.email || "").toLowerCase().includes(q);
                const matchPhone = (u.mob_no || "").toLowerCase().includes(q);
                const matchDept = (u.departments || []).some(d => (d.name || d.department_name || "").toLowerCase().includes(q)) || (u.user_type_name || "").toLowerCase().includes(q);
                const matchComp = (u.company_name || "").toLowerCase().includes(q);
                if (!matchName && !matchUser && !matchEmail && !matchPhone && !matchDept && !matchComp) {
                    return false;
                }
            }

            // Company filter
            if (selectedCompany !== "ALL") {
                if (String(u.company_id) !== String(selectedCompany)) return false;
            }

            // Department filter
            if (selectedDepartment !== "ALL") {
                const inDept = (u.departments || []).some(d => String(d.id || d.department_id) === String(selectedDepartment));
                if (!inDept) return false;
            }

            // Status filter
            if (statusFilter === "ACTIVE" && !u.active) return false;
            if (statusFilter === "INACTIVE" && u.active) return false;
            if (statusFilter === "VENDOR" && !u.is_vendor) return false;

            return true;
        });
    }, [users, searchTerm, selectedCompany, selectedDepartment, statusFilter]);

    return (
        <div className="min-h-full bg-[#F6F8FB] text-[#17212F] p-4 sm:p-6 lg:p-8 font-sans">
            {/* Header / Title area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#17365D] text-white flex items-center justify-center shadow-md">
                            <i className="fa-solid fa-address-book text-lg"></i>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-[#17365D]">
                                People &amp; Employee Directory
                            </h1>
                            <p className="text-xs text-slate-500 font-medium">
                                Organization structure, coworkers, sister companies and external vendor partners
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    {canCreateUser && (
                        <button
                            onClick={() => navigate("/admin/users/create")}
                            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#2878C7] hover:bg-[#1e63a8] text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
                        >
                            <i className="fa-solid fa-user-plus text-xs"></i>
                            <span>Add New Employee</span>
                        </button>
                    )}
                    <button
                        onClick={loadDirectoryData}
                        className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm cursor-pointer"
                        title="Refresh Directory"
                    >
                        <i className={`fa-solid fa-arrow-rotate-right text-xs ${loading ? "animate-spin text-[#2878C7]" : ""}`}></i>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm mb-6 space-y-3">
                <div className="flex flex-col md:flex-row items-center gap-3">
                    {/* Search box */}
                    <div className="relative flex-1 w-full">
                        <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name, email, username, phone or department..."
                            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2878C7] focus:bg-white transition-all text-[#17212F]"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        )}
                    </div>

                    {/* Company Filter */}
                    <div className="w-full md:w-52">
                        <select
                            value={selectedCompany}
                            onChange={(e) => setSelectedCompany(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2878C7] text-slate-700 cursor-pointer"
                        >
                            <option value="ALL">All Companies ({companies.length})</option>
                            {companies.map(c => (
                                <option key={c.id} value={c.id}>
                                    {c.company_name} {c.is_main ? "(Main)" : ""}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Department Filter */}
                    <div className="w-full md:w-52">
                        <select
                            value={selectedDepartment}
                            onChange={(e) => setSelectedDepartment(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2878C7] text-slate-700 cursor-pointer"
                        >
                            <option value="ALL">All Departments ({departments.length})</option>
                            {departments.map(d => (
                                <option key={d.id} value={d.id}>
                                    {d.department_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="w-full md:w-40">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2878C7] text-slate-700 cursor-pointer"
                        >
                            <option value="ALL">All Status</option>
                            <option value="ACTIVE">Active Only</option>
                            <option value="INACTIVE">Inactive Only</option>
                            <option value="VENDOR">Vendors Only</option>
                        </select>
                    </div>

                    {/* Grid / Table View Switcher */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 self-end md:self-auto shrink-0">
                        <button
                            onClick={() => setViewMode("grid")}
                            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${viewMode === "grid" ? "bg-white text-[#17365D] font-bold shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                            title="Grid Card View"
                        >
                            <i className="fa-solid fa-grip text-xs"></i>
                        </button>
                        <button
                            onClick={() => setViewMode("table")}
                            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${viewMode === "table" ? "bg-white text-[#17365D] font-bold shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                            title="Table View"
                        >
                            <i className="fa-solid fa-list text-xs"></i>
                        </button>
                    </div>
                </div>

                {/* Counter & Active filter indicators */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>
                        Showing <strong className="text-slate-700">{filteredUsers.length}</strong> of {users.length} members
                    </span>
                    {(searchTerm || selectedCompany !== "ALL" || selectedDepartment !== "ALL" || statusFilter !== "ALL") && (
                        <button
                            onClick={() => {
                                setSearchTerm("");
                                setSelectedCompany("ALL");
                                setSelectedDepartment("ALL");
                                setStatusFilter("ALL");
                            }}
                            className="text-[#2878C7] hover:underline font-semibold cursor-pointer"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Content Body */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 animate-pulse space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-slate-200 rounded-md w-3/4"></div>
                                    <div className="h-3 bg-slate-100 rounded-md w-1/2"></div>
                                </div>
                            </div>
                            <div className="h-3 bg-slate-100 rounded-md w-full"></div>
                            <div className="h-8 bg-slate-100 rounded-xl w-full"></div>
                        </div>
                    ))}
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
                    <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center text-2xl mb-4">
                        <i className="fa-solid fa-user-slash"></i>
                    </div>
                    <h3 className="text-base font-bold text-slate-800 mb-1">No employees found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                        We couldn't find any team members matching your search or active filter selections.
                    </p>
                    <button
                        onClick={() => {
                            setSearchTerm("");
                            setSelectedCompany("ALL");
                            setSelectedDepartment("ALL");
                            setStatusFilter("ALL");
                        }}
                        className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                        Clear All Filters
                    </button>
                </div>
            ) : viewMode === "grid" ? (
                /* Grid View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredUsers.map(u => {
                        const isSelf = u.id === currentUser.id;
                        const isChatLoading = actionLoading[`chat_${u.id}`];
                        const isToggleLoading = actionLoading[`toggle_${u.id}`];

                        return (
                            <div
                                key={u.id}
                                className={`bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between relative group ${!u.active ? "opacity-75 bg-slate-50/70" : ""}`}
                            >
                                {/* Top row: Badges */}
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {u.is_vendor ? (
                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-md">
                                                    Vendor Partner
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-[#17365D] border border-blue-100 rounded-md">
                                                    {u.user_type_name || u.role || "Member"}
                                                </span>
                                            )}

                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${u.active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
                                                {u.active ? "Active" : "Inactive"}
                                            </span>
                                        </div>

                                        {isAdmin && !isSelf && (
                                            <button
                                                onClick={() => handleToggleActive(u)}
                                                disabled={isToggleLoading}
                                                className={`text-xs px-2 py-1 rounded-lg border transition-colors cursor-pointer ${u.active ? "border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200" : "border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold"}`}
                                                title={u.active ? "Deactivate User" : "Activate User"}
                                            >
                                                {isToggleLoading ? (
                                                    <i className="fa-solid fa-spinner animate-spin text-[10px]"></i>
                                                ) : (
                                                    <i className={`fa-solid ${u.active ? "fa-user-xmark" : "fa-user-check"}`}></i>
                                                )}
                                            </button>
                                        )}
                                    </div>

                                    {/* Avatar & User Details */}
                                    <div className="flex items-center gap-3.5 mb-4">
                                        <div className="relative shrink-0">
                                            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#17365D] to-[#2878C7] text-white flex items-center justify-center font-black text-lg shadow-sm">
                                                {(u.name || u.username || "U").charAt(0).toUpperCase()}
                                            </div>
                                            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${u.active ? "bg-emerald-500" : "bg-slate-400"}`}></div>
                                        </div>
                                        <div className="overflow-hidden">
                                            <h3 className="text-sm font-bold text-[#17365D] truncate leading-snug" title={u.name || u.username}>
                                                {u.name || u.username}
                                            </h3>
                                            <p className="text-[11px] text-slate-500 font-medium truncate">
                                                @{u.username}
                                            </p>
                                            {u.company_name && (
                                                <p className="text-[10px] text-slate-600 font-semibold truncate flex items-center gap-1 mt-0.5">
                                                    <i className="fa-regular fa-building text-[9px] text-[#2878C7]"></i>
                                                    <span>{u.company_name}</span>
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Department chips */}
                                    <div className="space-y-1.5 mb-4 text-[11px]">
                                        <div className="flex items-center gap-1 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                                            <i className="fa-solid fa-sitemap text-[9px]"></i>
                                            <span>Departments</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                                            {(u.departments && u.departments.length > 0) ? (
                                                u.departments.map(d => (
                                                    <span
                                                        key={d.id || d.department_id}
                                                        className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200"
                                                    >
                                                        {d.department_name || d.name}
                                                        {d.department_role === "ADMIN" && " (Admin)"}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-slate-400 text-[10px] italic">No department assigned</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contact lines */}
                                    <div className="space-y-1 text-xs text-slate-600 mb-4 border-t border-slate-100 pt-3">
                                        <div className="flex items-center gap-2 truncate text-[11px]" title={u.email}>
                                            <i className="fa-regular fa-envelope text-slate-400 text-[11px] w-3.5"></i>
                                            <span className="truncate">{u.email}</span>
                                        </div>
                                        {u.mob_no && (
                                            <div className="flex items-center gap-2 text-[11px]" title={u.mob_no}>
                                                <i className="fa-solid fa-phone text-slate-400 text-[10px] w-3.5"></i>
                                                <span>{u.mob_no}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom Action: Chat Now button */}
                                <div className="pt-2 border-t border-slate-100">
                                    {isSelf ? (
                                        <div className="py-2 text-center text-[11px] text-slate-400 font-semibold bg-slate-50 rounded-xl">
                                            (This is your profile)
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleStartChat(u)}
                                            disabled={isChatLoading || !u.active}
                                            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                                                u.active 
                                                    ? "bg-[#17365D] hover:bg-[#102642] text-white hover:shadow-md" 
                                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                            }`}
                                        >
                                            {isChatLoading ? (
                                                <>
                                                    <i className="fa-solid fa-spinner animate-spin text-xs"></i>
                                                    <span>Connecting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <i className="fa-solid fa-comment-dots text-xs text-[#2878C7]"></i>
                                                    <span>Chat Now</span>
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Table View */
                <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-[#17212F]">
                            <thead className="bg-[#17365D] text-white font-bold text-[11px] uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-3.5">Employee</th>
                                    <th className="px-4 py-3.5">Contact</th>
                                    <th className="px-4 py-3.5">Company</th>
                                    <th className="px-4 py-3.5">Department</th>
                                    <th className="px-4 py-3.5">Role / Type</th>
                                    <th className="px-4 py-3.5">Status</th>
                                    <th className="px-4 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {filteredUsers.map(u => {
                                    const isSelf = u.id === currentUser.id;
                                    const isChatLoading = actionLoading[`chat_${u.id}`];

                                    return (
                                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-[#17365D] text-white flex items-center justify-center font-bold text-sm shrink-0">
                                                        {(u.name || u.username || "U").charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <div className="font-bold text-slate-900 truncate">{u.name || u.username}</div>
                                                        <div className="text-[11px] text-slate-500 truncate">@{u.username}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                <div>{u.email}</div>
                                                {u.mob_no && <div className="text-[11px] text-slate-400">{u.mob_no}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="font-semibold text-slate-700">{u.company_name || "-"}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {(u.departments && u.departments.length > 0) ? (
                                                        u.departments.map(d => (
                                                            <span key={d.id || d.department_id} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                                                                {d.department_name || d.name}
                                                            </span>
                                                        ))
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[11px]">-</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.is_vendor ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                                                    {u.is_vendor ? "Vendor" : (u.user_type_name || u.role || "Member")}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}`}>
                                                    {u.active ? "Active" : "Inactive"}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {isSelf ? (
                                                    <span className="text-slate-400 text-[11px] italic">You</span>
                                                ) : (
                                                    <button
                                                        onClick={() => handleStartChat(u)}
                                                        disabled={isChatLoading || !u.active}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer ${
                                                            u.active ? "bg-[#17365D] hover:bg-[#102642] text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                                                        }`}
                                                    >
                                                        <i className="fa-solid fa-comment-dots text-xs text-[#2878C7]"></i>
                                                        <span>Chat</span>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
