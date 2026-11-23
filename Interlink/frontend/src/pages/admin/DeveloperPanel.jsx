import React, { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import DataTable from "../../components/DataTable";
import {
    getDeveloperStats,
    getAllOrganizations,
    updateOrganizationStatus
} from "../../api/superadminApi";

export default function DeveloperPanel() {
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const [stats, setStats] = useState({
        total_orgs: 0,
        pending_orgs: 0,
        approved_orgs: 0,
        rejected_orgs: 0,
        suspended_orgs: 0,
        total_users: 0,
        total_companies: 0,
        total_projects: 0
    });

    const [organizations, setOrganizations] = useState([]);
    const [statusFilter, setStatusFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    // Selected organization for details modal
    const [selectedOrg, setSelectedOrg] = useState(null);

    const loadData = async () => {
        try {
            setLoading(true);
            const [statsRes, orgsRes] = await Promise.all([
                getDeveloperStats(),
                getAllOrganizations(statusFilter)
            ]);

            if (statsRes.data?.success) {
                setStats(statsRes.data.stats);
            }
            if (orgsRes.data?.success) {
                setOrganizations(orgsRes.data.organizations);
            }
        } catch (error) {
            console.error("Developer panel load error:", error);
            toast.error(error.response?.data?.message || "Failed to load developer dashboard data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [statusFilter]);

    const handleStatusChange = async (orgId, newStatus, orgName) => {
        setActionLoadingId(orgId);
        try {
            const res = await updateOrganizationStatus(orgId, newStatus);
            if (res.data?.success) {
                toast.success(res.data.message || `Organization ${newStatus}!`);
                await loadData();
            } else {
                toast.error(res.data?.message || "Failed to update status");
            }
        } catch (error) {
            console.error("Status update error:", error);
            toast.error(error.response?.data?.message || "Failed to update status");
        } finally {
            setActionLoadingId(null);
        }
    };

    const pendingList = useMemo(() => {
        return organizations.filter(o => o.status === "pending");
    }, [organizations]);

    // DataTable columns
    const columns = [
        {
            key: "id",
            label: "Org ID",
            render: (row) => <span className="font-mono text-xs text-slate-500 font-bold">#{row.id}</span>
        },
        {
            key: "name",
            label: "Organization & Workspace",
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-700 text-blue-400 flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                        {row.name ? row.name[0].toUpperCase() : "O"}
                    </div>
                    <div>
                        <span className="font-bold text-slate-900 text-sm block leading-tight">{row.name}</span>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                            <i className="fa-solid fa-building text-[10px] text-slate-400"></i>
                            <span>Primary: {row.primary_company_name || `${row.name} Main`}</span>
                            {Number(row.companies_count) > 1 && (
                                <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.2 rounded font-semibold">
                                    +{Number(row.companies_count) - 1} more
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: "admin_email",
            label: "Administrator Contact",
            render: (row) => (
                <div>
                    <span className="text-xs font-semibold text-slate-800 block">{row.admin_name || "Admin"}</span>
                    <a href={`mailto:${row.admin_email || row.email}`} className="text-xs text-blue-600 hover:underline">
                        {row.admin_email || row.email}
                    </a>
                    {row.admin_phone && (
                        <span className="text-[11px] text-slate-400 block">{row.admin_phone}</span>
                    )}
                </div>
            )
        },
        {
            key: "created_at",
            label: "Registered On",
            render: (row) => (
                <span className="text-xs text-slate-500 font-medium">
                    {new Date(row.created_at).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    })}
                </span>
            )
        },
        {
            key: "status",
            label: "Status",
            render: (row) => {
                const s = row.status || "pending";
                if (s === "approved") {
                    return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Approved
                        </span>
                    );
                }
                if (s === "pending") {
                    return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            Pending Approval
                        </span>
                    );
                }
                if (s === "rejected") {
                    return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Rejected
                        </span>
                    );
                }
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        Suspended
                    </span>
                );
            }
        },
        {
            key: "actions",
            label: "Developer Decision",
            render: (row) => {
                const isLoading = actionLoadingId === row.id;
                if (row.status === "pending") {
                    return (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleStatusChange(row.id, "approved", row.name)}
                                disabled={isLoading}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                                title="Approve this organization and activate login"
                            >
                                <i className="fa-solid fa-check text-[11px]"></i>
                                <span>Approve</span>
                            </button>
                            <button
                                onClick={() => handleStatusChange(row.id, "rejected", row.name)}
                                disabled={isLoading}
                                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                                title="Reject registration"
                            >
                                <i className="fa-solid fa-xmark text-[11px]"></i>
                                <span>Reject</span>
                            </button>
                        </div>
                    );
                }

                if (row.status === "approved") {
                    return (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => handleStatusChange(row.id, "suspended", row.name)}
                                disabled={isLoading}
                                className="px-2.5 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                                title="Suspend this tenant account"
                            >
                                Suspend
                            </button>
                            <button
                                onClick={() => setSelectedOrg(row)}
                                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                                title="View details"
                            >
                                <i className="fa-solid fa-circle-info text-sm"></i>
                            </button>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleStatusChange(row.id, "approved", row.name)}
                            disabled={isLoading}
                            className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                            title="Re-activate this organization"
                        >
                            Re-activate
                        </button>
                        <button
                            onClick={() => setSelectedOrg(row)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                            title="View details"
                        >
                            <i className="fa-solid fa-circle-info text-sm"></i>
                        </button>
                    </div>
                );
            }
        }
    ];

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Top Developer Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                            DEVELOPER CONSOLE ACTIVE
                        </span>
                        <span className="text-xs text-slate-400">|</span>
                        <span className="text-xs text-slate-500 font-mono">Role: {user.role || 'super_admin'}</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2.5">
                        <i className="fa-solid fa-laptop-code text-blue-600"></i>
                        <span>Developer Panel</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Platform-level tenant approvals, multi-company access governance, and organization provisioning
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={loadData}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer flex items-center gap-2"
                    >
                        <i className={`fa-solid fa-rotate-right ${loading ? 'animate-spin' : ''}`}></i>
                        <span>Refresh Data</span>
                    </button>
                </div>
            </div>

            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div 
                    onClick={() => setStatusFilter("pending")}
                    className={`bg-white border rounded-2xl p-4 shadow-sm cursor-pointer transition-all ${
                        statusFilter === "pending" ? "border-amber-400 ring-2 ring-amber-100" : "border-slate-200/80 hover:border-amber-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Awaiting Approval</p>
                        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-sm">
                            <i className="fa-solid fa-hourglass-half"></i>
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-1">{stats.pending_orgs}</p>
                    <span className="text-[10px] text-amber-600 font-bold mt-1 inline-block">Requires decision</span>
                </div>

                <div 
                    onClick={() => setStatusFilter("approved")}
                    className={`bg-white border rounded-2xl p-4 shadow-sm cursor-pointer transition-all ${
                        statusFilter === "approved" ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200/80 hover:border-emerald-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Approved Orgs</p>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
                            <i className="fa-solid fa-circle-check"></i>
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-1">{stats.approved_orgs}</p>
                    <span className="text-[10px] text-emerald-600 font-bold mt-1 inline-block">Active in platform</span>
                </div>

                <div 
                    onClick={() => setStatusFilter("all")}
                    className={`bg-white border rounded-2xl p-4 shadow-sm cursor-pointer transition-all ${
                        statusFilter === "all" ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-200/80 hover:border-blue-300"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Total Companies</p>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                            <i className="fa-solid fa-building"></i>
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-1">{stats.total_companies}</p>
                    <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">Across all tenants</span>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Platform Users</p>
                        <div className="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center text-sm">
                            <i className="fa-solid fa-users"></i>
                        </div>
                    </div>
                    <p className="text-2xl font-black text-slate-900 mt-1">{stats.total_users}</p>
                    <span className="text-[10px] text-slate-400 font-medium mt-1 inline-block">Registered accounts</span>
                </div>
            </div>

            {/* HIGH-PRIORITY: Pending Approval Quick Decision Cards */}
            {pendingList.length > 0 && (
                <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 rounded-3xl p-5 sm:p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm shadow-md shadow-amber-500/30">
                                <i className="fa-solid fa-bell"></i>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">
                                    Pending Organization Requests ({pendingList.length})
                                </h2>
                                <p className="text-xs text-slate-500">
                                    These companies registered recently and cannot log in until you approve them below.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendingList.map((org) => (
                            <div key={org.id} className="bg-white border border-amber-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-sm">
                                                {org.name ? org.name[0].toUpperCase() : "O"}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 text-sm">{org.name}</h3>
                                                <p className="text-[11px] text-slate-400">Primary: {org.primary_company_name}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                            NEW
                                        </span>
                                    </div>

                                    <div className="mt-3.5 pt-3 border-t border-slate-100 text-xs space-y-1 text-slate-600">
                                        <div className="flex items-center gap-1.5">
                                            <i className="fa-regular fa-user text-slate-400 text-[10px]"></i>
                                            <span className="font-semibold text-slate-800">{org.admin_name || "Admin"}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <i className="fa-regular fa-envelope text-slate-400 text-[10px]"></i>
                                            <span className="font-mono text-[11px] truncate">{org.admin_email || org.email}</span>
                                        </div>
                                        {org.admin_phone && (
                                            <div className="flex items-center gap-1.5">
                                                <i className="fa-solid fa-phone text-slate-400 text-[10px]"></i>
                                                <span className="text-[11px]">{org.admin_phone}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                                            <i className="fa-regular fa-clock text-[9px]"></i>
                                            <span>Registered: {new Date(org.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                                    <button
                                        onClick={() => handleStatusChange(org.id, "approved", org.name)}
                                        disabled={actionLoadingId === org.id}
                                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                                    >
                                        <i className="fa-solid fa-check text-xs"></i>
                                        <span>Approve</span>
                                    </button>
                                    <button
                                        onClick={() => handleStatusChange(org.id, "rejected", org.name)}
                                        disabled={actionLoadingId === org.id}
                                        className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 font-bold text-xs border border-slate-200 transition-colors cursor-pointer"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter Tabs & Main Table */}
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                        <h2 className="text-base font-bold text-slate-900">Platform Organization Roster</h2>
                        <p className="text-xs text-slate-400">View and manage approval states across all registered organizations</p>
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl self-start sm:self-auto text-xs font-semibold">
                        {["all", "pending", "approved", "suspended"].map((st) => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                                    statusFilter === st
                                        ? "bg-white text-blue-600 shadow-sm font-bold"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                {st} {st === "pending" && stats.pending_orgs > 0 ? `(${stats.pending_orgs})` : ""}
                            </button>
                        ))}
                    </div>
                </div>

                <DataTable
                    tableId="superadmin_organizations_list"
                    title="All Registered Organizations"
                    data={organizations}
                    columns={columns}
                    loading={loading}
                    searchPlaceholder="Search organizations by name, admin email..."
                />
            </div>

            {/* Details Modal */}
            {selectedOrg && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <i className="fa-solid fa-sitemap"></i>
                                </div>
                                <h3 className="font-bold text-slate-900 text-sm">Tenant Overview</h3>
                            </div>
                            <button
                                onClick={() => setSelectedOrg(null)}
                                className="text-slate-400 hover:text-slate-600 p-1"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div className="flex justify-between py-1 border-b border-slate-50">
                                <span className="text-slate-400">Organization Name:</span>
                                <span className="font-bold text-slate-800">{selectedOrg.name}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-50">
                                <span className="text-slate-400">Primary Company:</span>
                                <span className="font-semibold text-slate-800">{selectedOrg.primary_company_name}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-50">
                                <span className="text-slate-400">Administrator Name:</span>
                                <span className="font-semibold text-slate-800">{selectedOrg.admin_name}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-50">
                                <span className="text-slate-400">Admin Email:</span>
                                <span className="font-mono text-slate-700">{selectedOrg.admin_email}</span>
                            </div>
                            <div className="flex justify-between py-1 border-b border-slate-50">
                                <span className="text-slate-400">Registration Date:</span>
                                <span className="text-slate-700">{new Date(selectedOrg.created_at).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-1">
                                <span className="text-slate-400">Current Status:</span>
                                <span className="font-bold uppercase text-slate-800">{selectedOrg.status}</span>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => setSelectedOrg(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
