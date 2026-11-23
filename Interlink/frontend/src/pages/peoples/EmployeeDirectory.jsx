import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/DataTable";
import { getAllUsers, toggleUserActive } from "../../api/authApi";
import { getCompanies } from "../../api/companyApi";
import { getDepartments } from "../../api/departmentApi";
import { startDirectChat } from "../../api/chatApi";
import { usePermission } from "../../context/PermissionContext";
import toast from "react-hot-toast";

export default function EmployeeDirectory() {
    const navigate = useNavigate();
    const currentUser = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user") || "{}");
        } catch (_) {
            return {};
        }
    }, []);

    const { hasPermission } = usePermission();
    const isAdmin = currentUser.role === "admin" || currentUser.role === "super admin";
    const canCreateUser = isAdmin || hasPermission("user_master", "write");
    const canUpdateUser = isAdmin || hasPermission("user_master", "update");

    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);

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

    // Filtered users list based on dropdown filters (DataTable handles text search internally)
    const displayedUsers = useMemo(() => {
        return users.filter(u => {
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
    }, [users, selectedCompany, selectedDepartment, statusFilter]);

    // DataTable Columns Definition
    const columns = useMemo(() => [
        {
            key: "name",
            label: "Employee",
            render: (row) => {
                const initials = (row.name || row.username || "U").substring(0, 2).toUpperCase();
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#17365D] text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                            {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-sm text-slate-900 truncate">
                                    {row.name || row.username}
                                </span>
                                {row.id === currentUser.id && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                        You
                                    </span>
                                )}
                                {row.is_vendor ? (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        Vendor Partner
                                    </span>
                                ) : null}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">@{row.username}</span>
                        </div>
                    </div>
                );
            }
        },
        {
            key: "email",
            label: "Contact",
            render: (row) => (
                <div className="flex flex-col text-xs space-y-0.5">
                    <span className="text-slate-700 font-medium truncate" title={row.email}>
                        <i className="fa-solid fa-envelope text-[10px] text-slate-400 mr-1.5"></i>
                        {row.email}
                    </span>
                    {row.mob_no && (
                        <span className="text-slate-500 font-mono text-[11px]">
                            <i className="fa-solid fa-phone text-[9px] text-slate-400 mr-1.5"></i>
                            {row.mob_no}
                        </span>
                    )}
                </div>
            )
        },
        {
            key: "company_name",
            label: "Company Entity",
            render: (row) => (
                <div className="flex items-center gap-1.5">
                    <i className="fa-solid fa-building text-[11px] text-slate-400"></i>
                    <span className="text-xs font-semibold text-slate-800">
                        {row.company_name || <span className="text-slate-400 italic">Not Assigned</span>}
                    </span>
                </div>
            )
        },
        {
            key: "departments",
            label: "Departments",
            render: (row) => {
                const depts = row.departments || [];
                if (depts.length === 0) {
                    return <span className="text-xs text-slate-400 italic">No department</span>;
                }
                return (
                    <div className="flex flex-wrap gap-1 max-w-xs">
                        {depts.map((d, idx) => (
                            <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-50 text-[#17365D] border border-blue-100"
                            >
                                <span>{d.name || d.department_name}</span>
                                {d.role === "ADMIN" && (
                                    <span className="text-[8px] bg-purple-100 text-purple-700 px-1 rounded font-black">
                                        ADMIN
                                    </span>
                                )}
                            </span>
                        ))}
                    </div>
                );
            }
        },
        {
            key: "user_type_name",
            label: "Role Profile",
            render: (row) => (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    <i className="fa-solid fa-user-shield text-[10px] text-slate-500"></i>
                    <span>{row.user_type_name || row.role || "Standard"}</span>
                </span>
            )
        },
        {
            key: "chat_scoping",
            label: "Chat Governance",
            render: (row) => {
                const canAllDept = Boolean(row.can_chat_all_departments);
                const canAllComp = Boolean(row.can_chat_all_companies);
                const canVendor = Boolean(row.can_chat_with_vendors);

                return (
                    <div className="flex flex-wrap items-center gap-1 text-[10px]">
                        <span
                            className={`px-1.5 py-0.5 rounded font-bold border ${
                                canAllDept
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                            title={canAllDept ? "Can chat with all departments" : "Chat scoped to assigned department(s)"}
                        >
                            Dept: {canAllDept ? "All" : "Own"}
                        </span>
                        <span
                            className={`px-1.5 py-0.5 rounded font-bold border ${
                                canAllComp
                                    ? "bg-purple-50 text-purple-700 border-purple-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                            title={canAllComp ? "Can chat across sister companies" : "Restricted to own company"}
                        >
                            Sister Co: {canAllComp ? "Yes" : "No"}
                        </span>
                        {canVendor && (
                            <span
                                className="px-1.5 py-0.5 rounded font-bold border bg-amber-50 text-amber-700 border-amber-200"
                                title="Allowed to chat with external vendors"
                            >
                                Vendors
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            key: "active",
            label: "Status",
            render: (row) => {
                const isActive = Boolean(row.active);
                const isToggleLoading = actionLoading[`toggle_${row.id}`];

                if (!isAdmin || row.id === currentUser.id) {
                    return (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                            <span>{isActive ? "Active" : "Inactive"}</span>
                        </span>
                    );
                }

                return (
                    <button
                        onClick={() => handleToggleActive(row)}
                        disabled={isToggleLoading}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                            isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                        }`}
                        title={isActive ? "Click to deactivate employee" : "Click to activate employee"}
                    >
                        {isToggleLoading ? (
                            <i className="fa-solid fa-spinner fa-spin text-[10px]"></i>
                        ) : (
                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                        )}
                        <span>{isActive ? "Active" : "Inactive"}</span>
                    </button>
                );
            }
        },
        {
            key: "actions",
            label: "Actions",
            sortable: false,
            render: (row) => {
                const isSelf = row.id === currentUser.id;
                const isChatLoading = actionLoading[`chat_${row.id}`];

                return (
                    <div className="flex items-center gap-1.5">
                        {!isSelf && (
                            <button
                                onClick={() => handleStartChat(row)}
                                disabled={isChatLoading}
                                className="flex h-8 px-2.5 items-center gap-1.5 rounded-lg bg-[#2878C7] hover:bg-[#1e63a8] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                                title="Open Direct Chat"
                            >
                                {isChatLoading ? (
                                    <i className="fa-solid fa-circle-notch fa-spin text-[10px]"></i>
                                ) : (
                                    <i className="fa-solid fa-comment text-[10px]"></i>
                                )}
                                <span>Chat</span>
                            </button>
                        )}

                        {canUpdateUser && (
                            <button
                                onClick={() => navigate(`/admin/users/edit/${row.id}`)}
                                className="flex h-8 px-2.5 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                                title="Edit User Profile"
                            >
                                <i className="fa-solid fa-pen text-[10px]"></i>
                                <span>Edit</span>
                            </button>
                        )}
                    </div>
                );
            }
        }
    ], [isAdmin, currentUser, actionLoading, canUpdateUser]);

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-[#F6F8FB] font-sans text-slate-900 select-text">
            <main className="flex-1 flex flex-col w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                {/* Top Module Sub-Navigation Bar */}
                <div className="flex items-center gap-2 mb-6 border-b border-[#E2E8F0] pb-3 text-xs font-bold">
                    <button
                        onClick={() => navigate("/peoples")}
                        className="px-3.5 py-1.5 rounded-lg bg-[#17365D] text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-users"></i>
                        <span>Employee Directory</span>
                    </button>
                    <button
                        onClick={() => navigate("/peoples/departments")}
                        className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-[#5B6573] hover:text-[#17212F] border border-[#E2E8F0] cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                        <i className="fa-solid fa-sitemap text-[#2878C7]"></i>
                        <span>Departments & Teams</span>
                    </button>
                    <button
                        onClick={() => navigate("/peoples/companies")}
                        className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-[#5B6573] hover:text-[#17212F] border border-[#E2E8F0] cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                        <i className="fa-solid fa-building text-emerald-600"></i>
                        <span>Companies & Entities</span>
                    </button>
                </div>

                {/* ── DataTable ── */}
                <DataTable
                    tableId="peoples_employee_directory"
                    title="Employee Directory"
                    icon="fa-address-book"
                    badge={`${displayedUsers.length} Employees`}
                    columns={columns}
                    data={displayedUsers}
                    searchPlaceholder="Search employees by name, username, email, phone..."
                    isLoading={loading}
                    emptyMessage="No employees found matching criteria."
                    actionButton={
                        canCreateUser && (
                            <button
                                onClick={() => navigate("/peoples/create")}
                                title="Add New Employee"
                                aria-label="Add New Employee"
                                className="inline-flex items-center justify-center w-9.5 h-9.5 rounded-xl bg-[#17365D] hover:bg-[#102642] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
                            >
                                <i className="fa-solid fa-plus text-xs"></i>
                            </button>
                        )
                    }
                    toggleActions={
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Company Filter Dropdown */}
                            <select
                                value={selectedCompany}
                                onChange={(e) => setSelectedCompany(e.target.value)}
                                className="text-xs font-semibold h-9.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
                            >
                                <option value="ALL">All Companies ({companies.length})</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.company_name} {c.is_main ? "(Main)" : ""}
                                    </option>
                                ))}
                            </select>

                            {/* Department Filter Dropdown */}
                            <select
                                value={selectedDepartment}
                                onChange={(e) => setSelectedDepartment(e.target.value)}
                                className="text-xs font-semibold h-9.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
                            >
                                <option value="ALL">All Departments ({departments.length})</option>
                                {departments.map(d => (
                                    <option key={d.id} value={d.id}>
                                        {d.department_name}
                                    </option>
                                ))}
                            </select>

                            {/* Status Filter Dropdown */}
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="text-xs font-semibold h-9.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="ACTIVE">Active Only</option>
                                <option value="INACTIVE">Inactive Only</option>
                                <option value="VENDOR">Vendor Partners</option>
                            </select>
                        </div>
                    }
                />
            </main>
        </div>
    );
}
