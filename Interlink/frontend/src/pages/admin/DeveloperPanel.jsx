import React, { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import DataTable from "../../components/DataTable";
import {
    getDeveloperStats,
    getAllOrganizations,
    updateOrganizationStatus,
    createOrganization
} from "../../api/superadminApi";

export default function DeveloperPanel() {
    const location = useLocation();
    const navigate = useNavigate();
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

    // Create Organization Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [createdCredentials, setCreatedCredentials] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [copiedState, setCopiedState] = useState(false);

    const initialForm = {
        orgName: "",
        companyName: "",
        name: "",
        email: "",
        username: "",
        password: "",
        mob_no: "",
        status: "approved"
    };
    const [form, setForm] = useState(initialForm);

    // Auto-open modal if URL has ?createOrg=true
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get("createOrg") === "true") {
            setIsCreateModalOpen(true);
        }
    }, [location.search]);

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

    const handleOpenCreateModal = () => {
        setCreatedCredentials(null);
        setForm(initialForm);
        setIsCreateModalOpen(true);
    };

    const handleCloseCreateModal = () => {
        setIsCreateModalOpen(false);
        setCreatedCredentials(null);
        setCopiedState(false);
        if (location.search.includes("createOrg=true")) {
            navigate(location.pathname, { replace: true });
        }
    };

    const handleGeneratePassword = () => {
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const generated = `Client#${randomDigits}!`;
        setForm(prev => ({ ...prev, password: generated }));
        toast.success("Generated secure password!");
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        if (!form.orgName.trim() || !form.name.trim() || !form.email.trim() || !form.password) {
            toast.error("Please fill in organization name, admin name, email, and password.");
            return;
        }

        if (form.password.length < 6) {
            toast.error("Password must be at least 6 characters long.");
            return;
        }

        setCreateLoading(true);
        try {
            const payload = {
                orgName: form.orgName.trim(),
                companyName: form.companyName.trim() || `${form.orgName.trim()} Main`,
                name: form.name.trim(),
                email: form.email.trim(),
                username: form.username.trim() || undefined,
                password: form.password,
                mob_no: form.mob_no.trim() || undefined,
                status: form.status
            };

            const res = await createOrganization(payload);
            if (res.data?.success) {
                toast.success(res.data.message || "Organization created successfully!");
                setCreatedCredentials(res.data.credentials);
                await loadData();
            } else {
                toast.error(res.data?.message || "Failed to create organization");
            }
        } catch (error) {
            console.error("Create organization error:", error);
            toast.error(error.response?.data?.message || "Failed to create organization");
        } finally {
            setCreateLoading(false);
        }
    };

    const handleCopyCredentials = () => {
        if (!createdCredentials) return;
        const text = `Interlink Client Workspace Credentials:
Organization: ${createdCredentials.orgName}
Administrator: ${createdCredentials.adminName}
Email: ${createdCredentials.email}
Username: ${createdCredentials.username}
Password: ${createdCredentials.password}
Status: ${createdCredentials.status.toUpperCase()}`;

        navigator.clipboard.writeText(text);
        setCopiedState(true);
        toast.success("Credentials copied to clipboard!");
        setTimeout(() => setCopiedState(false), 3000);
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
                        onClick={handleOpenCreateModal}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all shadow-md shadow-indigo-500/25 flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                        title="Provision a new tenant organization workspace and admin account for a client"
                    >
                        <i className="fa-solid fa-building-circle-plus text-xs"></i>
                        <span>Create Client Org</span>
                    </button>
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

                    <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                        <button
                            onClick={handleOpenCreateModal}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                            title="Provision a new client organization"
                        >
                            <i className="fa-solid fa-plus text-xs"></i>
                            <span>New Org</span>
                        </button>
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
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
                                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Client Organization Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-xl p-6 sm:p-7 relative my-8 animate-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
                                    <i className="fa-solid fa-building-circle-plus text-base"></i>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                                        {createdCredentials ? "Client Workspace Provisioned!" : "Create Organization for Client"}
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        {createdCredentials 
                                            ? "The organization and administrator credentials are ready to share." 
                                            : "Provision a new tenant workspace and active administrator account directly from Developer Panel."}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseCreateModal}
                                className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                                title="Close dialog"
                            >
                                <i className="fa-solid fa-xmark text-sm"></i>
                            </button>
                        </div>

                        {createdCredentials ? (
                            /* Success Credentials State */
                            <div className="space-y-5 animate-in fade-in duration-150">
                                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 text-sm shadow-sm mt-0.5">
                                        <i className="fa-solid fa-check"></i>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-xs font-bold text-emerald-900">Organization Created &amp; Activated!</h4>
                                        <p className="text-[11px] text-emerald-700 mt-0.5">
                                            The organization <strong className="text-emerald-950 font-black">"{createdCredentials.orgName}"</strong> is immediately ready for login. Copy the administrator credentials below to share with your client.
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-3 font-mono text-xs">
                                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                                        <span className="text-slate-400 font-sans text-xs">Organization:</span>
                                        <span className="font-bold text-white">{createdCredentials.orgName}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                                        <span className="text-slate-400 font-sans text-xs">Administrator:</span>
                                        <span className="text-sky-300 font-bold">{createdCredentials.adminName}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                                        <span className="text-slate-400 font-sans text-xs">Login Email:</span>
                                        <span className="text-white">{createdCredentials.email}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                                        <span className="text-slate-400 font-sans text-xs">Username:</span>
                                        <span className="text-white font-bold">{createdCredentials.username}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1 border-b border-slate-800">
                                        <span className="text-slate-400 font-sans text-xs">Temporary Password:</span>
                                        <span className="text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">{createdCredentials.password}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-slate-400 font-sans text-xs">Status:</span>
                                        <span className="text-emerald-400 font-bold uppercase">{createdCredentials.status}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={handleCopyCredentials}
                                        className="w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <i className={`fa-solid ${copiedState ? 'fa-check text-emerald-400' : 'fa-copy'}`}></i>
                                        <span>{copiedState ? "Copied to Clipboard!" : "Copy All Credentials"}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCloseCreateModal}
                                        className="w-full sm:w-auto py-2.5 px-6 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                                    >
                                        Done
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Create Organization Form */
                            <form onSubmit={handleCreateSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Org Name */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Organization / Client Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={form.orgName}
                                            onChange={(e) => setForm({ ...form, orgName: e.target.value })}
                                            placeholder="e.g. Stark Industries"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                        />
                                    </div>

                                    {/* Primary Company Name */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Primary Company / Workspace Name <span className="text-slate-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={form.companyName}
                                            onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                                            placeholder={form.orgName ? `${form.orgName} Main` : "e.g. Stark Tech HQ"}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                        />
                                    </div>

                                    {/* Admin Full Name */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Administrator Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            placeholder="e.g. Tony Stark"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                        />
                                    </div>

                                    {/* Admin Email */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Administrator Email <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={form.email}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            placeholder="e.g. tony@stark.com"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                        />
                                    </div>

                                    {/* Admin Username */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Username <span className="text-slate-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={form.username}
                                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                                            placeholder={form.email ? form.email.split("@")[0] : "e.g. tonystark"}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                        />
                                    </div>

                                    {/* Admin Phone */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Phone Number <span className="text-slate-400 font-normal">(optional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={form.mob_no}
                                            onChange={(e) => setForm({ ...form, mob_no: e.target.value })}
                                            placeholder="e.g. +1 555-0199"
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                        />
                                    </div>

                                    {/* Password + Generator */}
                                    <div className="sm:col-span-2">
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-slate-700">
                                                Temporary Password <span className="text-red-500">*</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={handleGeneratePassword}
                                                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer hover:underline"
                                            >
                                                <i className="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
                                                <span>Generate Secure Password</span>
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                required
                                                value={form.password}
                                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                                placeholder="At least 6 characters"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 pr-10 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Status Selector */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold text-slate-700 mb-1">
                                            Initial Status
                                        </label>
                                        <select
                                            value={form.status}
                                            onChange={(e) => setForm({ ...form, status: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                                        >
                                            <option value="approved">Approved (Active immediately — client can log in right away)</option>
                                            <option value="pending">Pending Approval (Awaits manual activation)</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={handleCloseCreateModal}
                                        disabled={createLoading}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createLoading}
                                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all shadow-md shadow-indigo-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {createLoading ? (
                                            <>
                                                <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                                                <span>Provisioning Workspace...</span>
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-check text-xs"></i>
                                                <span>Create Organization</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
