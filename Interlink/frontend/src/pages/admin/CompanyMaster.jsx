import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import DataTable from "../../components/DataTable";
import {
    getCompanies,
    updateCompany,
    deleteCompany,
    toggleCompanyStatus,
    getCompanyById
} from "../../api/companyApi";
import { usePermission } from "../../context/PermissionContext";
import { isUserAdmin } from "../../utils/roleUtils";

export default function CompanyMaster() {
    const navigate = useNavigate();
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user") || "{}");
        } catch (_) {
            return {};
        }
    }, []);

    const isAdmin = isUserAdmin(user);
    const { hasPermission } = usePermission();

    const canWrite = isAdmin || hasPermission("company_master", "write");
    const canUpdate = isAdmin || hasPermission("company_master", "update");
    const canDelete = isAdmin || hasPermission("company_master", "delete");

    const [companies, setCompanies] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Edit Modal State
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
        country: "",
        postal_code: "",
        industry: "",
        description: "",
        is_main: false,
        status: "ACTIVE"
    });
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

    // View Departments Modal
    const [viewingCompanyDepts, setViewingCompanyDepts] = useState(null);
    const [isLoadingDepts, setIsLoadingDepts] = useState(false);

    const fetchCompanies = async () => {
        try {
            setIsLoading(true);
            const res = await getCompanies(true);
            const list = res?.companies || res?.data || (Array.isArray(res) ? res : []);
            setCompanies(Array.isArray(list) ? list : []);
        } catch (error) {
            console.error("Failed to load companies:", error);
            toast.error(error.response?.data?.message || "Failed to load companies");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, []);

    // Open Edit Modal
    const handleOpenEdit = (comp) => {
        setSelectedCompany(comp);
        setEditFormData({
            company_name: comp.company_name || "",
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
            is_main: Boolean(comp.is_main),
            status: comp.status || "ACTIVE"
        });
        setIsEditModalOpen(true);
    };

    // Save Edit
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!selectedCompany) return;
        if (!editFormData.company_name.trim()) {
            toast.error("Company name is required");
            return;
        }

        try {
            setIsSubmittingEdit(true);
            await updateCompany(selectedCompany.id, {
                ...editFormData,
                company_name: editFormData.company_name.trim(),
                company_code: editFormData.company_code.trim().toUpperCase()
            });
            toast.success(`Company "${editFormData.company_name.trim()}" updated successfully!`);
            setIsEditModalOpen(false);
            setSelectedCompany(null);
            fetchCompanies();
        } catch (error) {
            console.error("Update company error:", error);
            toast.error(error.response?.data?.message || "Failed to update company");
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    // Toggle Status
    const handleToggleStatus = async (comp) => {
        const newStatus = comp.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        const action = newStatus === "ACTIVE" ? "activate" : "deactivate";
        if (!window.confirm(`Are you sure you want to ${action} company "${comp.company_name}"?`)) return;

        try {
            await toggleCompanyStatus(comp.id, newStatus);
            toast.success(`Company "${comp.company_name}" is now ${newStatus}`);
            fetchCompanies();
        } catch (error) {
            console.error("Toggle status error:", error);
            toast.error(error.response?.data?.message || "Failed to update status");
        }
    };

    // Delete Company
    const handleDelete = async (comp) => {
        if (!window.confirm(`Are you sure you want to delete company "${comp.company_name}"? This action cannot be undone.`)) return;

        try {
            await deleteCompany(comp.id);
            toast.success(`Company "${comp.company_name}" deleted successfully`);
            fetchCompanies();
        } catch (error) {
            console.error("Delete company error:", error);
            toast.error(error.response?.data?.message || "Failed to delete company");
        }
    };

    // View Company's Departments
    const handleViewDepartments = async (comp) => {
        try {
            setIsLoadingDepts(true);
            setViewingCompanyDepts(comp);
            const fullComp = await getCompanyById(comp.id);
            setViewingCompanyDepts(fullComp?.data || fullComp?.company || fullComp || comp);
        } catch (error) {
            console.error("Fetch company departments error:", error);
        } finally {
            setIsLoadingDepts(false);
        }
    };

    // DataTable Columns
    const columns = useMemo(() => [
        {
            key: "company_name",
            label: "Company Entity",
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-xs shrink-0 ${
                        row.is_main 
                            ? "bg-purple-600 text-white shadow-purple-500/20" 
                            : "bg-[#2D333B] text-white"
                    }`}>
                        {row.company_name ? row.company_name[0].toUpperCase() : "C"}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-sm text-slate-900">{row.company_name}</span>
                            {row.is_main && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    <i className="fa-solid fa-crown text-[8px]"></i> Main
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )
        },
        {
            key: "description",
            label: "Description",
            render: (row) => (
                <span className="text-xs text-slate-600 font-medium line-clamp-2 max-w-xs block" title={row.description}>
                    {row.description || <span className="text-slate-400 italic">No description</span>}
                </span>
            )
        },
        {
            key: "phone",
            label: "Mobile Number",
            render: (row) => (
                <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                    <i className="fa-solid fa-phone text-[10px] text-slate-400"></i>
                    <span>{row.phone || <span className="text-slate-400 italic">—</span>}</span>
                </div>
            )
        },
        {
            key: "address",
            label: "Address",
            render: (row) => (
                <div className="flex items-start gap-1.5 text-xs text-slate-600 max-w-xs">
                    <i className="fa-solid fa-location-dot text-[10px] text-slate-400 mt-0.5 shrink-0"></i>
                    <span className="line-clamp-2" title={row.address}>
                        {row.address || <span className="text-slate-400 italic">No address provided</span>}
                    </span>
                </div>
            )
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
                    {row.status}
                </span>
            )
        },
        {
            key: "actions",
            label: "Actions",
            sortable: false,
            render: (row) => (
                <div className="flex items-center gap-1.5">
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
            )
        }
    ], [canUpdate, canDelete]);

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-[#F6F8FB] font-sans text-slate-900 select-text">
            <main className="flex-1 flex flex-col w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                {/* Top Module Sub-Navigation Bar */}
                <div className="flex items-center gap-2 mb-6 border-b border-[#E2E8F0] pb-3 text-xs font-bold">
                    <button
                        onClick={() => navigate("/peoples")}
                        className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-[#5B6573] hover:text-[#17212F] border border-[#E2E8F0] cursor-pointer flex items-center gap-1.5 transition-colors"
                    >
                        <i className="fa-solid fa-users text-[#2878C7]"></i>
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
                        className="px-3.5 py-1.5 rounded-lg bg-[#17365D] text-white shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-building text-emerald-400"></i>
                        <span>Companies & Entities</span>
                    </button>
                </div>

                <DataTable
                    tableId="company_master_directory"
                    title="Company Master"
                    icon="fa-city"
                    badge={`${companies.length} Companies`}
                    columns={columns}
                    data={companies}
                    searchPlaceholder="Search companies by name, description, mobile, or address..."
                    isLoading={isLoading}
                    emptyMessage="No companies found."
                    actionButton={
                        canWrite && (
                            <button
                                onClick={() => navigate("/peoples/companies/create")}
                                title="Register Company"
                                aria-label="Register Company"
                                className="inline-flex items-center justify-center w-9.5 h-9.5 rounded-xl bg-[#17365D] hover:bg-[#102642] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
                            >
                                <i className="fa-solid fa-plus text-xs"></i>
                            </button>
                        )
                    }
                />
            </main>

            {/* ── EDIT COMPANY MODAL ───────────────────────────────────────── */}
            {isEditModalOpen && selectedCompany && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                                    <i className="fa-solid fa-pen-to-square"></i>
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Edit Company Details</h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Update entity profile and registration metadata</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditModalOpen(false)}
                                className="w-8 h-8 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {/* Body Form */}
                        <form onSubmit={handleSaveEdit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Company Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editFormData.company_name}
                                    onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })}
                                    className="w-full px-3.5 h-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Company Description
                                </label>
                                <textarea
                                    rows="3"
                                    value={editFormData.description}
                                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Mobile Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={editFormData.phone}
                                        onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                                        className="w-full px-3.5 h-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Status
                                    </label>
                                    <select
                                        value={editFormData.status}
                                        onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                                        className="w-full px-3.5 h-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="ACTIVE">ACTIVE</option>
                                        <option value="INACTIVE">INACTIVE</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Address
                                </label>
                                <textarea
                                    rows="2"
                                    value={editFormData.address}
                                    onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer text-center justify-center"
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
                                            <i className="fa-solid fa-circle-notch fa-spin"></i>
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

            {/* ── VIEW COMPANY DEPARTMENTS MODAL ───────────────────────────── */}
            {viewingCompanyDepts && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in zoom-in-95 flex flex-col max-h-[85vh]">
                        <div className="px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                                    <i className="fa-solid fa-building-user"></i>
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">{viewingCompanyDepts.company_name}</h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Departments hosted under this company entity</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewingCompanyDepts(null)}
                                className="w-8 h-8 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 space-y-3 overflow-y-auto">
                            {isLoadingDepts ? (
                                <div className="text-center py-8 text-xs text-slate-400">Loading departments...</div>
                            ) : (!viewingCompanyDepts.departments || viewingCompanyDepts.departments.length === 0) ? (
                                <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                                    No departments currently assigned to this company.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {viewingCompanyDepts.departments.map((d) => (
                                        <div key={d.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-900">{d.department_name}</h4>
                                                {d.description && <p className="text-[11px] text-slate-500">{d.description}</p>}
                                            </div>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                d.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600"
                                            }`}>
                                                {d.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                            <span className="text-xs text-slate-500 font-medium text-center sm:text-left">
                                Total: {viewingCompanyDepts.departments ? viewingCompanyDepts.departments.length : 0} Departments
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setViewingCompanyDepts(null);
                                    navigate("/admin/departments");
                                }}
                                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer text-center justify-center"
                            >
                                Manage in Dept Master
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
