import React, { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import DataTable from "../../components/DataTable";
import {
    getCompanies,
    createCompany,
    updateCompany,
    deleteCompany,
    switchCompany
} from "../../api/companyApi";

export default function CompanyMaster() {
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCompanyId, setActiveCompanyId] = useState(
        localStorage.getItem("active_company_id") || user.company_id || ""
    );

    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [formData, setFormData] = useState({ name: "", email: "", phone: "" });
    const [saving, setSaving] = useState(false);

    // Delete confirmation state
    const [deleteModalCompany, setDeleteModalCompany] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const fetchCompaniesList = async () => {
        try {
            setLoading(true);
            const res = await getCompanies();
            if (res.data?.success && res.data.companies) {
                setCompanies(res.data.companies);
                // If active company is not set, set it to the first one
                if (!activeCompanyId && res.data.companies.length > 0) {
                    const firstId = String(res.data.companies[0].id);
                    setActiveCompanyId(firstId);
                    localStorage.setItem("active_company_id", firstId);
                }
            }
        } catch (error) {
            console.error("Failed to load companies:", error);
            toast.error("Failed to load companies");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompaniesList();
    }, []);

    const openCreateModal = () => {
        setModalMode("create");
        setSelectedCompany(null);
        setFormData({ name: "", email: "", phone: "" });
        setIsModalOpen(true);
    };

    const openEditModal = (comp) => {
        setModalMode("edit");
        setSelectedCompany(comp);
        setFormData({
            name: comp.name || "",
            email: comp.email || "",
            phone: comp.phone || ""
        });
        setIsModalOpen(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.error("Company name is required");
            return;
        }

        setSaving(true);
        try {
            if (modalMode === "create") {
                const res = await createCompany({
                    name: formData.name.trim(),
                    email: formData.email.trim() || null,
                    phone: formData.phone.trim() || null
                });

                if (res.data?.success) {
                    toast.success("New company added successfully!");
                    setIsModalOpen(false);
                    await fetchCompaniesList();

                    // Update local storage companies list
                    const updatedUser = { ...user, companies: [...companies, res.data.company] };
                    localStorage.setItem("user", JSON.stringify(updatedUser));
                } else {
                    toast.error(res.data?.message || "Failed to create company");
                }
            } else {
                const res = await updateCompany(selectedCompany.id, {
                    name: formData.name.trim(),
                    email: formData.email.trim() || null,
                    phone: formData.phone.trim() || null
                });

                if (res.data?.success) {
                    toast.success("Company updated successfully!");
                    setIsModalOpen(false);
                    await fetchCompaniesList();

                    // Update user companies array in localStorage
                    const updatedList = companies.map(c => c.id === selectedCompany.id ? { ...c, ...formData } : c);
                    const updatedUser = { ...user, companies: updatedList };
                    localStorage.setItem("user", JSON.stringify(updatedUser));
                } else {
                    toast.error(res.data?.message || "Failed to update company");
                }
            }
        } catch (error) {
            console.error("Save company error:", error);
            toast.error(error.response?.data?.message || "Failed to save company");
        } finally {
            setSaving(false);
        }
    };

    const handleSwitchCompany = async (comp) => {
        try {
            const compIdStr = String(comp.id);
            setActiveCompanyId(compIdStr);
            localStorage.setItem("active_company_id", compIdStr);

            // Persist to backend
            try {
                await switchCompany(comp.id);
            } catch (switchErr) {
                console.warn("Backend active company switch notice:", switchErr.message);
            }

            const updatedUser = { ...user, company_id: comp.id };
            localStorage.setItem("user", JSON.stringify(updatedUser));
            toast.success(`Switched active workspace to "${comp.name}"`);

            // Trigger window auth-change or reload so other pages reflect the new company immediately
            window.location.reload();
        } catch (error) {
            console.error("Switch company error:", error);
            toast.error("Failed to switch company");
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteModalCompany) return;
        setDeleting(true);
        try {
            const res = await deleteCompany(deleteModalCompany.id);
            if (res.data?.success) {
                toast.success("Company deleted successfully");
                setDeleteModalCompany(null);

                // If deleting currently active company, reset to another one
                if (String(deleteModalCompany.id) === String(activeCompanyId)) {
                    const remaining = companies.filter(c => c.id !== deleteModalCompany.id);
                    if (remaining.length > 0) {
                        const newActiveId = String(remaining[0].id);
                        setActiveCompanyId(newActiveId);
                        localStorage.setItem("active_company_id", newActiveId);
                    }
                }

                await fetchCompaniesList();
            } else {
                toast.error(res.data?.message || "Failed to delete company");
            }
        } catch (error) {
            console.error("Delete company error:", error);
            toast.error(error.response?.data?.message || "Failed to delete company");
        } finally {
            setDeleting(false);
        }
    };

    // Columns for DataTable
    const columns = [
        {
            key: "id",
            label: "ID",
            render: (row) => <span className="font-mono text-xs text-slate-500 font-bold">#{row.id}</span>
        },
        {
            key: "name",
            label: "Company Name",
            render: (row) => {
                const isActive = String(row.id) === String(activeCompanyId);
                return (
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            isActive ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30" : "bg-slate-100 text-slate-600"
                        }`}>
                            <i className="fa-solid fa-building text-sm"></i>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800 text-sm">{row.name}</span>
                                {isActive && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200">
                                        CURRENT ACTIVE
                                    </span>
                                )}
                            </div>
                            <span className="text-xs text-slate-400">Created: {new Date(row.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                );
            }
        },
        {
            key: "email",
            label: "Contact Email",
            render: (row) => (
                <span className="text-xs text-slate-600 font-medium">
                    {row.email ? (
                        <a href={`mailto:${row.email}`} className="hover:text-blue-600 transition-colors">
                            {row.email}
                        </a>
                    ) : (
                        <span className="text-slate-400 italic">Not provided</span>
                    )}
                </span>
            )
        },
        {
            key: "phone",
            label: "Phone / Helpline",
            render: (row) => (
                <span className="text-xs text-slate-600 font-medium">
                    {row.phone || <span className="text-slate-400 italic">—</span>}
                </span>
            )
        },
        {
            key: "actions",
            label: "Actions",
            render: (row) => {
                const isActive = String(row.id) === String(activeCompanyId);
                return (
                    <div className="flex items-center gap-2">
                        {!isActive ? (
                            <button
                                onClick={() => handleSwitchCompany(row)}
                                className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 cursor-pointer flex items-center gap-1.5"
                                title="Switch active workspace to this company"
                            >
                                <i className="fa-solid fa-arrow-right-arrow-left text-[11px]"></i>
                                <span>Set Active</span>
                            </button>
                        ) : (
                            <span className="px-2.5 py-1 text-xs font-semibold text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                                <i className="fa-solid fa-circle-check text-[11px]"></i>
                                <span>Active</span>
                            </span>
                        )}

                        <button
                            onClick={() => openEditModal(row)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Company Details"
                        >
                            <i className="fa-solid fa-pen-to-square text-sm"></i>
                        </button>

                        {companies.length > 1 && (
                            <button
                                onClick={() => setDeleteModalCompany(row)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Company"
                            >
                                <i className="fa-solid fa-trash-can text-sm"></i>
                            </button>
                        )}
                    </div>
                );
            }
        }
    ];

    const activeCompanyObj = companies.find(c => String(c.id) === String(activeCompanyId)) || companies[0];

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Header & Stats */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                        <i className="fa-solid fa-building text-blue-600"></i>
                        <span>Company Master</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Manage multiple companies, subsidiaries, and branches under your organization
                    </p>
                </div>

                <button
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all cursor-pointer self-start sm:self-auto"
                >
                    <i className="fa-solid fa-plus"></i>
                    <span>Add New Company</span>
                </button>
            </div>

            {/* Quick KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-sitemap"></i>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Companies</p>
                        <p className="text-xl font-black text-slate-900 mt-0.5">{companies.length}</p>
                    </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-building-circle-check"></i>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Current Active Workspace</p>
                        <p className="text-base font-extrabold text-slate-900 mt-0.5 truncate max-w-[180px]">
                            {activeCompanyObj?.name || "None"}
                        </p>
                    </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-shield-halved"></i>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Organization ID</p>
                        <p className="text-base font-extrabold text-slate-900 mt-0.5 font-mono">
                            #{user.organization_id || 1}
                        </p>
                    </div>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <DataTable
                    tableId="company_master_list"
                    title="All Registered Companies"
                    data={companies}
                    columns={columns}
                    loading={loading}
                    searchPlaceholder="Search companies by name, email, or phone..."
                    actionButton={
                        <button
                            onClick={openCreateModal}
                            className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-sm"
                            title="Add Company"
                        >
                            <i className="fa-solid fa-plus text-xs"></i>
                        </button>
                    }
                />
            </div>

            {/* Add / Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm">
                                    <i className="fa-solid fa-building"></i>
                                </div>
                                <h2 className="text-base font-bold text-slate-900">
                                    {modalMode === "create" ? "Add New Company" : "Edit Company Details"}
                                </h2>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                            >
                                <i className="fa-solid fa-xmark text-base"></i>
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Company Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="e.g. Acme Logistics Pvt Ltd"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Contact / Billing Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="e.g. info@acmelogistics.com"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Phone / Helpline Number
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="e.g. +91 9876543210"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                                />
                            </div>

                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-75 cursor-pointer flex items-center gap-1.5"
                                >
                                    {saving ? (
                                        <>
                                            <i className="fa-solid fa-spinner animate-spin text-xs"></i>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <span>{modalMode === "create" ? "Create Company" : "Save Changes"}</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalCompany && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3 text-lg">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <h3 className="text-base font-bold text-slate-900">Delete Company?</h3>
                        <p className="text-xs text-slate-500 mt-1 mb-5">
                            Are you sure you want to delete <span className="font-bold text-slate-800">{deleteModalCompany.name}</span>? This action cannot be undone.
                        </p>
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => setDeleteModalCompany(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={deleting}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-sm cursor-pointer disabled:opacity-75"
                            >
                                {deleting ? "Deleting..." : "Yes, Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
