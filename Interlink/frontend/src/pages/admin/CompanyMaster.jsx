import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/DataTable";
import {
    getCompanies,
    updateCompany,
    deleteCompany,
    toggleCompanyStatus,
    getCompanyById,
    switchCompany
} from "../../api/companyApi";
import { startDirectChat } from "../../api/chatApi";
import { usePermission } from "../../context/PermissionContext";
import { isUserAdmin } from "../../utils/roleUtils";

export default function CompanyMaster() {
    const navigate = useNavigate();
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const isAdmin = isUserAdmin(user);
    const { hasPermission } = usePermission();

    // Permission checks
    const canWrite = isAdmin || hasPermission("company_master", "write");
    const canUpdate = isAdmin || hasPermission("company_master", "update");
    const canDelete = isAdmin || hasPermission("company_master", "delete");

    const [companies, setCompanies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Active workspace tracker
    const [activeCompanyId, setActiveCompanyId] = useState(
        localStorage.getItem("active_company_id") || user.company_id || "1"
    );

    // Edit modal state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [editFormData, setEditFormData] = useState({
        company_name: "",
        company_code: "",
        legal_name: "",
        tax_id: "",
        email: "",
        phone: "",
        website: "",
        address: "",
        city: "",
        state: "",
        country: "India",
        postal_code: "",
        industry: "",
        description: "",
        status: "ACTIVE"
    });
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

    // View departments modal state
    const [viewingCompanyDepts, setViewingCompanyDepts] = useState(null);
    const [isLoadingDepts, setIsLoadingDepts] = useState(false);
    const [companyModalTab, setCompanyModalTab] = useState("departments"); // "departments" | "employees"

    // Delete confirmation modal state
    const [deleteModalCompany, setDeleteModalCompany] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Direct chat launcher
    const handleStartChatWithEmployee = async (targetUser) => {
        if (!targetUser?.id) return;
        try {
            const chatRes = await startDirectChat(targetUser.id);
            if (chatRes?.conversation?.id) {
                navigate("/chat", { state: { conversationId: chatRes.conversation.id } });
            } else {
                navigate("/chat");
            }
        } catch (err) {
            console.error("Direct chat initiation error:", err);
            toast.error("Could not initiate chat with this employee");
        }
    };

    // Load Companies
    const fetchCompanies = async () => {
        try {
            setIsLoading(true);
            const res = await getCompanies(true, "");
            const list = res.companies || res.data?.companies || res.data || (Array.isArray(res) ? res : []);
            setCompanies(Array.isArray(list) ? list : []);

            if (!activeCompanyId && Array.isArray(list) && list.length > 0) {
                const firstId = String(list[0].id);
                setActiveCompanyId(firstId);
                localStorage.setItem("active_company_id", firstId);
            }
        } catch (error) {
            console.error("Failed to load companies:", error);
            toast.error(error.response?.data?.message || "Failed to load company entities");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, []);

    // Switch active company workspace
    const handleSwitchCompany = async (companyId) => {
        try {
            await switchCompany(companyId);
            const strId = String(companyId);
            setActiveCompanyId(strId);
            localStorage.setItem("active_company_id", strId);
            const updatedUser = { ...user, company_id: parseInt(companyId, 10) };
            localStorage.setItem("user", JSON.stringify(updatedUser));
            toast.success("Switched active company workspace");
            window.location.reload();
        } catch (err) {
            console.error("Failed to switch company:", err);
            toast.error(err.response?.data?.message || "Failed to switch company");
        }
    };

    // Open Edit Modal
    const handleOpenEdit = (comp) => {
        setSelectedCompany(comp);
        setEditFormData({
            company_name: comp.company_name || comp.name || "",
            company_code: comp.company_code || "",
            legal_name: comp.legal_name || "",
            tax_id: comp.tax_id || "",
            email: comp.email || "",
            phone: comp.phone || "",
            website: comp.website || "",
            address: comp.address || "",
            city: comp.city || "",
            state: comp.state || "",
            country: comp.country || "India",
            postal_code: comp.postal_code || "",
            industry: comp.industry || "",
            description: comp.description || "",
            status: comp.status || "ACTIVE"
        });
        setIsEditModalOpen(true);
    };

    // Save Edit Form
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!selectedCompany?.id) return;

        if (!editFormData.company_name.trim()) {
            toast.error("Company name is required");
            return;
        }

        try {
            setIsSubmittingEdit(true);
            await updateCompany(selectedCompany.id, {
                ...editFormData,
                company_name: editFormData.company_name.trim(),
                name: editFormData.company_name.trim(),
                company_code: editFormData.company_code.trim().toUpperCase()
            });
            toast.success("Company updated successfully");
            setIsEditModalOpen(false);
            fetchCompanies();
        } catch (error) {
            console.error("Failed to update company:", error);
            toast.error(error.response?.data?.message || "Failed to save company changes");
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    // Toggle Status
    const handleToggleStatus = async (comp) => {
        try {
            const nextStatus = comp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
            await toggleCompanyStatus(comp.id, comp.status);
            toast.success(`Company status updated to ${nextStatus}`);
            fetchCompanies();
        } catch (error) {
            console.error("Failed to toggle company status:", error);
            toast.error(error.response?.data?.message || "Failed to change company status");
        }
    };

    // Trigger Delete Confirmation Modal
    const handleDelete = (comp) => {
        if (comp.is_main) {
            toast.error("Primary corporate entity cannot be deleted.");
            return;
        }
        setDeleteModalCompany(comp);
    };

    // Execute Delete
    const handleConfirmDelete = async () => {
        if (!deleteModalCompany?.id) return;
        try {
            setIsDeleting(true);
            await deleteCompany(deleteModalCompany.id);
            toast.success("Company deleted successfully");
            setDeleteModalCompany(null);
            fetchCompanies();
        } catch (error) {
            console.error("Failed to delete company:", error);
            toast.error(error.response?.data?.message || "Failed to delete company");
        } finally {
            setIsDeleting(false);
        }
    };

    // View Departments & Employees Modal
    const handleViewDepartments = async (comp) => {
        try {
            setIsLoadingDepts(true);
            setViewingCompanyDepts(comp);
            setCompanyModalTab("departments");
            const res = await getCompanyById(comp.id);
            const fullComp = res.company || res.data?.company || res.data || res;
            setViewingCompanyDepts(fullComp || comp);
        } catch (error) {
            console.error("Failed to fetch company details:", error);
            toast.error("Failed to load departments & personnel for this company");
        } finally {
            setIsLoadingDepts(false);
        }
    };

    // Quick Stats Calculation
    const stats = useMemo(() => {
        const total = companies.length;
        const active = companies.filter(c => c.status === "ACTIVE").length;
        const totalDepts = companies.reduce((acc, c) => acc + (Number(c.department_count) || 0), 0);
        const totalUsers = companies.reduce((acc, c) => acc + (Number(c.user_count) || 0), 0);
        return { total, active, totalDepts, totalUsers };
    }, [companies]);

    // DataTable Columns Definition
    const columns = [
        {
            key: "company_code",
            label: "Code & Identity",
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shadow-2xs shrink-0">
                        {row.logo_url ? (
                            <img src={row.logo_url} alt={row.company_name || row.name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                            <i className="fa-solid fa-building text-slate-600"></i>
                        )}
                    </div>
                    <div>
                        <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <span>{row.company_code || "CO"}</span>
                            {row.is_main && (
                                <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-sm font-semibold tracking-wide">
                                    PRIMARY
                                </span>
                            )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">ID: #{row.id}</span>
                    </div>
                </div>
            )
        },
        {
            key: "company_name",
            label: "Company / Workspace Name",
            render: (row) => (
                <div>
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        {row.company_name || row.name}
                    </div>
                    {row.industry && (
                        <div className="text-[11px] text-slate-500 font-medium">
                            <i className="fa-solid fa-briefcase text-[10px] text-slate-400 mr-1"></i>
                            {row.industry}
                        </div>
                    )}
                </div>
            )
        },
        {
            key: "legal_tax",
            label: "Legal & Tax Details",
            render: (row) => (
                <div className="text-xs">
                    <div className="text-slate-800 font-medium">{row.legal_name || "—"}</div>
                    {row.tax_id && (
                        <div className="text-[11px] text-slate-400 font-mono">GST / Tax: {row.tax_id}</div>
                    )}
                </div>
            )
        },
        {
            key: "assigned_units",
            label: "Assigned Units",
            render: (row) => (
                <button
                    type="button"
                    onClick={() => handleViewDepartments(row)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50/80 hover:bg-blue-100/90 text-blue-700 text-xs font-semibold border border-blue-200/60 transition-all cursor-pointer shadow-2xs group"
                    title="Click to view hosted departments & employees"
                >
                    <i className="fa-solid fa-sitemap text-blue-500 group-hover:scale-110 transition-transform"></i>
                    <span>{row.department_count || 0} Depts</span>
                    <span className="text-blue-300">|</span>
                    <span className="text-blue-600 font-normal">{row.user_count || 0} Staff</span>
                </button>
            )
        },
        {
            key: "contact_details",
            label: "Helpline & Contact",
            render: (row) => (
                <div className="text-xs text-slate-600 space-y-0.5">
                    {row.email ? (
                        <div className="flex items-center gap-1.5 text-slate-700">
                            <i className="fa-regular fa-envelope text-[11px] text-slate-400"></i>
                            <a href={`mailto:${row.email}`} className="hover:underline">{row.email}</a>
                        </div>
                    ) : (
                        <div className="text-slate-400 italic text-[11px]">—</div>
                    )}
                    {row.phone && (
                        <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <i className="fa-solid fa-phone text-[10px] text-slate-400"></i>
                            <span>{row.phone}</span>
                        </div>
                    )}
                </div>
            )
        },
        {
            key: "location",
            label: "Location",
            render: (row) => {
                const locParts = [row.city, row.state, row.country].filter(Boolean);
                return (
                    <div className="text-xs text-slate-600">
                        {locParts.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                                <i className="fa-solid fa-location-dot text-[11px] text-slate-400"></i>
                                <span>{locParts.join(", ")}</span>
                            </div>
                        ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                    </div>
                );
            }
        },
        {
            key: "status",
            label: "Status",
            render: (row) => (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border shadow-xs ${
                    row.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${row.status === "ACTIVE" ? "bg-emerald-500" : "bg-slate-400"}`}></span>
                    {row.status || "ACTIVE"}
                </span>
            )
        },
        {
            key: "actions",
            label: "Actions",
            sortable: false,
            render: (row) => {
                const isActiveWorkspace = String(row.id) === String(activeCompanyId);
                return (
                    <div className="flex items-center gap-1.5">
                        {/* Switch Workspace Button */}
                        {isActiveWorkspace ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                                <i className="fa-solid fa-circle-check text-emerald-500 text-[10px]"></i>
                                <span>Active</span>
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={() => handleSwitchCompany(row.id)}
                                className="flex h-8 px-2.5 items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                                title="Switch to this company's workspace"
                            >
                                <i className="fa-solid fa-arrow-right-arrow-left text-[10px] text-blue-600"></i>
                                <span>Switch</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => handleViewDepartments(row)}
                            className="flex h-8 px-2.5 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                            title="View Departments & Employees"
                        >
                            <i className="fa-solid fa-users text-[10px]"></i>
                            <span>Units</span>
                        </button>

                        {canUpdate && (
                            <button
                                type="button"
                                onClick={() => handleOpenEdit(row)}
                                className="flex h-8 px-2.5 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                                title="Edit Company Details"
                            >
                                <i className="fa-solid fa-pen text-[10px]"></i>
                                <span>Edit</span>
                            </button>
                        )}

                        {canUpdate && (
                            <button
                                type="button"
                                onClick={() => handleToggleStatus(row)}
                                className={`flex h-8 px-2.5 items-center gap-1 rounded-lg border text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
                                    row.status === "ACTIVE"
                                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                                title={row.status === "ACTIVE" ? "Deactivate Company" : "Activate Company"}
                            >
                                <i className={`fa-solid ${row.status === "ACTIVE" ? "fa-ban text-[10px]" : "fa-check text-[10px]"}`}></i>
                                <span>{row.status === "ACTIVE" ? "Disable" : "Enable"}</span>
                            </button>
                        )}

                        {canDelete && !row.is_main && (
                            <button
                                type="button"
                                onClick={() => handleDelete(row)}
                                className="flex h-8 px-2.5 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                                title="Delete Company"
                            >
                                <i className="fa-solid fa-trash text-[10px]"></i>
                                <span>Delete</span>
                            </button>
                        )}
                    </div>
                );
            }
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            {/* ── TOP HEADER & STATS ───────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <i className="fa-solid fa-building text-blue-600"></i>
                        <span>Company & Entity Master</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                        Manage corporate entities, subsidiaries, and divisional business workspaces
                    </p>
                </div>
                {canWrite && (
                    <button
                        type="button"
                        onClick={() => navigate("/peoples/companies/create")}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer shrink-0"
                    >
                        <i className="fa-solid fa-plus text-xs"></i>
                        <span>Add Company</span>
                    </button>
                )}
            </div>

            {/* ── METRIC STAT CARDS ───────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold shrink-0">
                        <i className="fa-solid fa-building"></i>
                    </div>
                    <div>
                        <div className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Total Entities</div>
                        <div className="text-lg sm:text-xl font-black text-slate-900">{stats.total}</div>
                    </div>
                </div>

                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm font-bold shrink-0">
                        <i className="fa-solid fa-circle-check"></i>
                    </div>
                    <div>
                        <div className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Active Entities</div>
                        <div className="text-lg sm:text-xl font-black text-emerald-600">{stats.active}</div>
                    </div>
                </div>

                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm font-bold shrink-0">
                        <i className="fa-solid fa-sitemap"></i>
                    </div>
                    <div>
                        <div className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Total Departments</div>
                        <div className="text-lg sm:text-xl font-black text-indigo-600">{stats.totalDepts}</div>
                    </div>
                </div>

                <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center text-sm font-bold shrink-0">
                        <i className="fa-solid fa-users"></i>
                    </div>
                    <div>
                        <div className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Total Personnel</div>
                        <div className="text-lg sm:text-xl font-black text-violet-600">{stats.totalUsers}</div>
                    </div>
                </div>
            </div>

            {/* ── DATATABLE ────────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <DataTable
                    columns={columns}
                    data={companies}
                    isLoading={isLoading}
                    searchPlaceholder="Search company by name, code, legal entity, city..."
                    filterKey="status"
                    filterOptions={[
                        { label: "All Entities", value: "ALL" },
                        { label: "Active Only", value: "ACTIVE" },
                        { label: "Inactive Only", value: "INACTIVE" }
                    ]}
                />
            </div>

            {/* ── EDIT COMPANY MODAL ───────────────────────────────────────── */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                    <i className="fa-solid fa-building"></i>
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Edit Company Details</h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500">Update corporate record, compliance info, and address</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditModalOpen(false)}
                                className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-sm"></i>
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSaveEdit} className="p-4 sm:p-6 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Company Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={editFormData.company_name}
                                        onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        placeholder="e.g. Epoxy House Private Limited"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Company Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={editFormData.company_code}
                                        onChange={(e) => setEditFormData({ ...editFormData, company_code: e.target.value.toUpperCase() })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 uppercase font-mono transition-all"
                                        placeholder="e.g. EPOXY"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Legal Entity Name
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.legal_name}
                                        onChange={(e) => setEditFormData({ ...editFormData, legal_name: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        placeholder="Full registered statutory name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Tax ID / GST Number
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.tax_id}
                                        onChange={(e) => setEditFormData({ ...editFormData, tax_id: e.target.value.toUpperCase() })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 uppercase font-mono transition-all"
                                        placeholder="e.g. 24AAACE1234F1Z5"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Official Email
                                    </label>
                                    <input
                                        type="email"
                                        value={editFormData.email}
                                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        placeholder="contact@company.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Phone / Helpline
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.phone}
                                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        placeholder="+91 98765 43210"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Website
                                    </label>
                                    <input
                                        type="url"
                                        value={editFormData.website}
                                        onChange={(e) => setEditFormData({ ...editFormData, website: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        placeholder="https://company.com"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.city}
                                        onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        placeholder="e.g. Vadodara"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        State
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.state}
                                        onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        placeholder="e.g. Gujarat"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Industry / Sector
                                    </label>
                                    <input
                                        type="text"
                                        value={editFormData.industry}
                                        onChange={(e) => setEditFormData({ ...editFormData, industry: e.target.value })}
                                        className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                        placeholder="Manufacturing, IT, etc."
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Company Description
                                </label>
                                <textarea
                                    rows="2"
                                    value={editFormData.description}
                                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                                    placeholder="Brief summary or operational scope"
                                />
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingEdit}
                                    className="w-full sm:w-auto px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {isSubmittingEdit ? (
                                        <>
                                            <i className="fa-solid fa-spinner animate-spin"></i>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-check"></i>
                                            <span>Update Company</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── VIEW COMPANY DEPARTMENTS & EMPLOYEES MODAL ───────────────── */}
            {viewingCompanyDepts && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 animate-in zoom-in-95 flex flex-col max-h-[85vh]">
                        {/* Modal Header */}
                        <div className="px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-[#17365D] text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                                    <i className="fa-solid fa-building-user"></i>
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">{viewingCompanyDepts.company_name || viewingCompanyDepts.name}</h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Departments & personnel hosted under this entity</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewingCompanyDepts(null)}
                                className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-sm"></i>
                            </button>
                        </div>

                        {/* Modal Tabs */}
                        <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 border-b border-slate-100 bg-white shrink-0">
                            <button
                                type="button"
                                onClick={() => setCompanyModalTab("departments")}
                                className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
                                    companyModalTab === "departments"
                                        ? "text-[#17365D] border-b-2 border-[#17365D]"
                                        : "text-slate-400 hover:text-slate-600"
                                }`}
                            >
                                <i className="fa-solid fa-sitemap"></i>
                                <span>Departments ({viewingCompanyDepts.departments?.length || 0})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCompanyModalTab("employees")}
                                className={`pb-2.5 text-xs font-bold transition-all relative cursor-pointer flex items-center gap-1.5 ${
                                    companyModalTab === "employees"
                                        ? "text-[#17365D] border-b-2 border-[#17365D]"
                                        : "text-slate-400 hover:text-slate-600"
                                }`}
                            >
                                <i className="fa-solid fa-users"></i>
                                <span>Personnel ({viewingCompanyDepts.employees?.length || 0})</span>
                            </button>
                        </div>

                        {/* Tab Content */}
                        <div className="p-4 sm:p-6 overflow-y-auto divide-y divide-slate-100">
                            {isLoadingDepts ? (
                                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                                    <i className="fa-solid fa-spinner animate-spin text-xl text-blue-600"></i>
                                    <span className="text-xs font-medium">Fetching organizational hierarchy...</span>
                                </div>
                            ) : companyModalTab === "departments" ? (
                                viewingCompanyDepts.departments?.length > 0 ? (
                                    <div className="space-y-2">
                                        {viewingCompanyDepts.departments.map((dept) => (
                                            <div
                                                key={dept.id}
                                                className="p-3 rounded-xl bg-slate-50/80 hover:bg-blue-50/50 border border-slate-200/70 flex items-center justify-between transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
                                                        <i className="fa-solid fa-network-wired"></i>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-900">{dept.department_name}</div>
                                                        <div className="text-[11px] text-slate-500 line-clamp-1">{dept.description || "Active department unit"}</div>
                                                    </div>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                    dept.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                                                }`}>
                                                    {dept.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-10 text-center text-slate-400">
                                        <i className="fa-solid fa-diagram-project text-3xl mb-2 text-slate-300"></i>
                                        <p className="text-xs font-medium">No departments currently allocated to this company.</p>
                                    </div>
                                )
                            ) : (
                                viewingCompanyDepts.employees?.length > 0 ? (
                                    <div className="space-y-2">
                                        {viewingCompanyDepts.employees.map((emp) => (
                                            <div
                                                key={emp.id}
                                                className="p-3 rounded-xl bg-slate-50/80 hover:bg-indigo-50/40 border border-slate-200/70 flex items-center justify-between transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-[#17365D] text-white flex items-center justify-center text-xs font-bold shrink-0">
                                                        {(emp.name || emp.username || "U").charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-bold text-slate-900">{emp.name || emp.username}</div>
                                                        <div className="text-[11px] text-slate-500">
                                                            {emp.user_type_name || emp.role || "Employee"} • <span className="text-slate-400">{emp.email || emp.mob_no || ""}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartChatWithEmployee(emp)}
                                                        className="h-7 px-2.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-bold border border-blue-200 transition-colors flex items-center gap-1 cursor-pointer"
                                                        title="Launch Direct Chat"
                                                    >
                                                        <i className="fa-regular fa-comment-dots"></i>
                                                        <span>Chat</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-10 text-center text-slate-400">
                                        <i className="fa-solid fa-users-slash text-3xl mb-2 text-slate-300"></i>
                                        <p className="text-xs font-medium">No direct personnel enrolled under this entity.</p>
                                    </div>
                                )
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 flex items-center justify-end bg-slate-50/80 shrink-0">
                            <button
                                type="button"
                                onClick={() => setViewingCompanyDepts(null)}
                                className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DELETE CONFIRMATION MODAL ─────────────────────────────────── */}
            {deleteModalCompany && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                    <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center animate-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3 text-lg">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">Delete Company?</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-5">
                            Are you sure you want to delete <span className="font-bold text-slate-800">{deleteModalCompany.company_name || deleteModalCompany.name}</span>? This action cannot be undone.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteModalCompany(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer disabled:opacity-75"
                            >
                                {isDeleting ? "Deleting..." : "Yes, Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
