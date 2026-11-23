import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import DataTable from "../../components/DataTable";
import {
    getDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    toggleDepartmentStatus,
    getDepartmentMembers
} from "../../api/departmentApi";
import { getCompanies } from "../../api/companyApi";
import { usePermission } from "../../context/PermissionContext";
import { isUserAdmin } from "../../utils/roleUtils";

export default function DepartmentMaster() {
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const isAdmin = isUserAdmin(user);
    const { hasPermission } = usePermission();

    const canWrite = isAdmin || hasPermission("department_master", "write");
    const canUpdate = isAdmin || hasPermission("department_master", "update");
    const canDelete = isAdmin || hasPermission("department_master", "delete");

    const [departments, setDepartments] = useState([]);
    const [companiesList, setCompaniesList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("all");
    const [companyFilter, setCompanyFilter] = useState("all");
    const [refreshing, setRefreshing] = useState(false);

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [selectedDept, setSelectedDept] = useState(null);
    const [deptMembers, setDeptMembers] = useState([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        department_name: "",
        description: "",
        company_id: "",
        status: "ACTIVE"
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Load departments & companies
    const fetchDepartments = async () => {
        try {
            setIsLoading(true);
            const [deptRes, compRes] = await Promise.allSettled([
                getDepartments(true),
                getCompanies(false)
            ]);

            if (deptRes.status === "fulfilled") {
                const list = deptRes.value?.departments || deptRes.value?.data || (Array.isArray(deptRes.value) ? deptRes.value : []);
                setDepartments(Array.isArray(list) ? list : []);
            }

            if (compRes.status === "fulfilled") {
                const cList = compRes.value?.companies || compRes.value?.data || (Array.isArray(compRes.value) ? compRes.value : []);
                setCompaniesList(Array.isArray(cList) ? cList : []);
                if (Array.isArray(cList) && cList.length > 0 && !formData.company_id) {
                    const main = cList.find(c => c.is_main) || cList[0];
                    setFormData(prev => ({ ...prev, company_id: main.id }));
                }
            }
        } catch (error) {
            console.error("Failed to load departments:", error);
            const msg = error.response?.data?.message || "Failed to load departments";
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchDepartments();
        toast.success("Department list refreshed");
        setRefreshing(false);
    };

    useEffect(() => {
        fetchDepartments();
    }, []);

    // Filter departments for DataTable
    const displayedDepartments = useMemo(() => {
        return departments.filter(d => {
            return statusFilter === "all" || d.status === statusFilter;
        });
    }, [departments, statusFilter]);

    // Statistics for KPI Cards
    const stats = useMemo(() => {
        const total = departments.length;
        const active = departments.filter(d => d.status === "ACTIVE").length;
        const inactive = total - active;
        const totalMembers = departments.reduce((acc, curr) => acc + (Number(curr.member_count) || 0), 0);
        return { total, active, inactive, totalMembers };
    }, [departments]);

    // Create Department
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!formData.department_name.trim()) {
            toast.error("Department name is required");
            return;
        }

        try {
            setIsSubmitting(true);
            await createDepartment(formData);
            toast.success(`Department "${formData.department_name.trim()}" created successfully!`);
            setIsCreateModalOpen(false);
            setFormData({ department_name: "", description: "", status: "ACTIVE" });
            fetchDepartments();
        } catch (error) {
            console.error("Create department error:", error);
            toast.error(error.response?.data?.message || "Failed to create department");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Open Edit Modal
    const openEditModal = (dept) => {
        setSelectedDept(dept);
        setFormData({
            department_name: dept.department_name,
            description: dept.description || "",
            status: dept.status || "ACTIVE"
        });
        setIsEditModalOpen(true);
    };

    // Update Department
    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!formData.department_name.trim() || !selectedDept) {
            toast.error("Department name is required");
            return;
        }

        try {
            setIsSubmitting(true);
            await updateDepartment(selectedDept.id, formData);
            toast.success("Department updated successfully!");
            setIsEditModalOpen(false);
            setSelectedDept(null);
            fetchDepartments();
        } catch (error) {
            console.error("Update department error:", error);
            toast.error(error.response?.data?.message || "Failed to update department");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete Department
    const handleDelete = async (dept) => {
        if (!window.confirm(`Are you sure you want to delete the "${dept.department_name}" department?`)) {
            return;
        }

        try {
            await deleteDepartment(dept.id);
            toast.success(`Department "${dept.department_name}" deleted successfully`);
            fetchDepartments();
        } catch (error) {
            console.error("Delete department error:", error);
            toast.error(error.response?.data?.message || "Failed to delete department");
        }
    };

    // Toggle Status
    const handleToggleStatus = async (dept) => {
        const newStatus = dept.status === "ACTIVE" ? false : true;
        try {
            await toggleDepartmentStatus(dept.id, newStatus);
            toast.success(`Department is now ${newStatus ? 'ACTIVE' : 'INACTIVE'}`);
            fetchDepartments();
        } catch (error) {
            console.error("Toggle status error:", error);
            toast.error("Failed to update status");
        }
    };

    // View Members
    const openMembersModal = async (dept) => {
        setSelectedDept(dept);
        setIsMembersModalOpen(true);
        try {
            setIsLoadingMembers(true);
            const res = await getDepartmentMembers(dept.id);
            setDeptMembers(res?.members || res?.data || []);
        } catch (error) {
            console.error("Failed to fetch department members:", error);
            toast.error("Failed to fetch department members");
        } finally {
            setIsLoadingMembers(false);
        }
    };

    // Columns Definition for DataTable
    const departmentColumns = useMemo(() => [
        {
            key: 'department_name',
            label: 'Department Unit',
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#2D333B] text-white border border-slate-700/60 flex items-center justify-center font-medium text-xs shadow-xs shrink-0">
                        {row.department_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-900 text-sm truncate">{row.department_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">ID: #{row.id}</span>
                    </div>
                </div>
            )
        },
        {
            key: 'description',
            label: 'Description',
            render: (row) => (
                <span className="text-xs text-slate-600 font-medium max-w-xs truncate block" title={row.description}>
                    {row.description || <span className="text-slate-400 italic">No description</span>}
                </span>
            )
        },
        {
            key: 'member_count',
            label: 'Assigned Users',
            render: (row) => (
                <button
                    onClick={() => openMembersModal(row)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors cursor-pointer border border-blue-100 shadow-2xs"
                    title="Click to view assigned department members"
                >
                    <i className="fa-solid fa-users text-[10px]"></i>
                    <span>{row.member_count} Members</span>
                </button>
            )
        },
        {
            key: 'admin_count',
            label: 'Dept Admins',
            render: (row) => (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-extrabold text-xs border border-purple-100">
                    <i className="fa-solid fa-user-shield text-[10px]"></i>
                    <span>{row.admin_count}</span>
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => {
                const isActive = row.status === "ACTIVE";
                if (!canUpdate) {
                    return (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}>
                            {row.status}
                        </span>
                    );
                }
                return (
                    <button
                        onClick={() => handleToggleStatus(row)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold cursor-pointer transition-all border shadow-2xs ${
                            isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                        }`}
                        title="Click to toggle status"
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`}></span>
                        <span>{isActive ? "ACTIVE" : "INACTIVE"}</span>
                    </button>
                );
            }
        },
        {
            key: 'created_at',
            label: 'Created Date',
            render: (row) => (
                <span className="text-xs text-slate-500 font-medium">
                    {new Date(row.created_at).toLocaleDateString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    })}
                </span>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (row) => (
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={() => openMembersModal(row)}
                        title="View Members"
                        className="flex h-8 px-2.5 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-all shadow-sm cursor-pointer"
                    >
                        <i className="fa-solid fa-users text-[10px]"></i>
                        <span>Members</span>
                    </button>

                    {canUpdate && (
                        <button
                            onClick={() => openEditModal(row)}
                            title="Edit Department"
                            className="flex h-8 px-2.5 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-all shadow-sm cursor-pointer"
                        >
                            <i className="fa-solid fa-pen text-[10px]"></i>
                            <span>Edit</span>
                        </button>
                    )}

                    {canDelete && (
                        <button
                            onClick={() => handleDelete(row)}
                            title="Delete Department"
                            className="flex h-8 px-2.5 items-center gap-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition-all shadow-sm cursor-pointer"
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
        <div className="flex-1 flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900 select-text">
            <main className="flex-1 flex flex-col w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                {/* ── DataTable ── */}
                <DataTable
                    tableId="department_master_directory"
                    title="Department Master"
                    icon="fa-building-user"
                    badge={`${displayedDepartments.length} Units`}
                    columns={departmentColumns}
                    data={displayedDepartments}
                    searchPlaceholder="Search departments by name or description..."
                    isLoading={isLoading}
                    emptyMessage="No departments found matching your search."
                    actionButton={
                        canWrite && (
                            <button
                                onClick={() => {
                                    setFormData({ department_name: "", description: "", status: "ACTIVE" });
                                    setIsCreateModalOpen(true);
                                }}
                                title="Create Department"
                                aria-label="Create Department"
                                className="inline-flex items-center justify-center w-9.5 h-9.5 rounded-xl bg-[#ED1C28] hover:bg-[#C5131E] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
                            >
                                <i className="fa-solid fa-plus text-xs"></i>
                            </button>
                        )
                    }
                    toggleActions={
                        <div className="flex items-center gap-2">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="text-xs font-semibold h-9.5 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
                            >
                                <option value="all">All Statuses</option>
                                <option value="ACTIVE">Active Only</option>
                                <option value="INACTIVE">Inactive Only</option>
                            </select>
                        </div>
                    }
                />
            </main>

            {/* ── CREATE DEPARTMENT MODAL ── */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
                        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#2D333B] text-[#ED1C28] border border-slate-700/60 flex items-center justify-center font-medium text-xs shadow-xs shrink-0">
                                    <i className="fa-solid fa-building-plus"></i>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 text-sm">New Department</h3>
                                    <p className="text-[10px] text-slate-500 font-normal">Create an organization department unit</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="w-8 h-8 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-4 sm:p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                                    Department Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Sales, HR, Accounts, IT, Operations"
                                    value={formData.department_name}
                                    onChange={(e) => setFormData({ ...formData, department_name: e.target.value })}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                                    Description
                                </label>
                                <textarea
                                    rows="3"
                                    placeholder="Brief summary of department responsibilities and domain..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                                    Status
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                >
                                    <option value="ACTIVE">ACTIVE (Enabled)</option>
                                    <option value="INACTIVE">INACTIVE (Disabled)</option>
                                </select>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer text-center justify-center"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#ED1C28] hover:bg-[#C5131E] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-check"></i>
                                            <span>Save Department</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── EDIT DEPARTMENT MODAL ── */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
                        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#2D333B] text-[#ED1C28] border border-slate-700/60 flex items-center justify-center font-medium text-xs shadow-xs shrink-0">
                                    <i className="fa-solid fa-pen-to-square"></i>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 text-sm">Edit Department</h3>
                                    <p className="text-[10px] text-slate-500 font-normal">Update department details</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="w-8 h-8 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="p-4 sm:p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                                    Department Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.department_name}
                                    onChange={(e) => setFormData({ ...formData, department_name: e.target.value })}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                                    Description
                                </label>
                                <textarea
                                    rows="3"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-1.5">
                                    Status
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                >
                                    <option value="ACTIVE">ACTIVE (Enabled)</option>
                                    <option value="INACTIVE">INACTIVE (Disabled)</option>
                                </select>
                            </div>

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
                                    disabled={isSubmitting}
                                    className="w-full sm:w-auto px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                                            <span>Updating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-check"></i>
                                            <span>Update Department</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── VIEW DEPARTMENT MEMBERS MODAL ── */}
            {isMembersModalOpen && selectedDept && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 max-h-[85vh] flex flex-col animate-in zoom-in-95">
                        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#2D333B] text-[#ED1C28] border border-slate-700/60 flex items-center justify-center font-medium text-xs shadow-xs shrink-0">
                                    <i className="fa-solid fa-users"></i>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 text-sm">
                                        {selectedDept.department_name} Members
                                    </h3>
                                    <p className="text-[10px] text-slate-500 font-normal">
                                        Assigned personnel & department administrators
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsMembersModalOpen(false)}
                                className="w-8 h-8 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-chat-scrollbar">
                            {isLoadingMembers ? (
                                <div className="py-8 text-center text-slate-400">
                                    <i className="fa-solid fa-circle-notch fa-spin text-blue-600 text-lg mb-2 block"></i>
                                    <span>Loading department members...</span>
                                </div>
                            ) : deptMembers.length === 0 ? (
                                <div className="py-8 text-center text-slate-400">
                                    <i className="fa-solid fa-user-slash text-3xl mb-2 block text-slate-300"></i>
                                    <p className="font-bold text-slate-600">No members assigned yet</p>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Assign coworkers to this department in the User Master.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {deptMembers.map((m) => {
                                        const isDeptAdmin = m.department_role === "ADMIN";
                                        return (
                                            <div
                                                key={m.id}
                                                className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-[#2D333B] text-white border border-slate-700/60 flex items-center justify-center font-medium text-xs">
                                                        {(m.name || m.username || "U")[0].toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-slate-800 text-sm">{m.name || m.username}</p>
                                                            <span className={`px-2 py-0.2 rounded-md text-[9px] font-black uppercase ${
                                                                isDeptAdmin
                                                                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                                                                    : "bg-blue-50 text-blue-700 border border-blue-100"
                                                            }`}>
                                                                {isDeptAdmin ? "Dept Admin" : "User"}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-400">{m.email} {m.mob_no ? `• ${m.mob_no}` : ""}</p>
                                                    </div>
                                                </div>

                                                <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-1 rounded-lg border border-slate-200">
                                                    {m.user_type_name || m.role}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="px-4 sm:px-6 py-3 bg-slate-50/80 border-t border-slate-100 flex justify-end shrink-0">
                            <button
                                onClick={() => setIsMembersModalOpen(false)}
                                className="w-full sm:w-auto px-5 py-2 rounded-xl text-slate-600 hover:bg-slate-200/70 text-xs font-bold transition-colors cursor-pointer text-center justify-center"
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
