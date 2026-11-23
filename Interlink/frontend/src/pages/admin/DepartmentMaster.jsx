import React, { useEffect, useState, useMemo, useCallback } from "react";
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

export default function DepartmentMaster() {
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const activeCompanyId = localStorage.getItem("active_company_id") || user.company_id || "1";
    const activeCompanyName = user.companies?.find(c => String(c.id) === String(activeCompanyId))?.name || "Active Workspace";

    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInactive, setShowInactive] = useState(false);

    // Modal state for Add / Edit
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
    const [selectedDepartment, setSelectedDepartment] = useState(null);
    const [formData, setFormData] = useState({
        department_name: "",
        head_of_department: "",
        description: "",
        status: "ACTIVE"
    });
    const [saving, setSaving] = useState(false);

    // Modal state for View Members
    const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
    const [membersDepartment, setMembersDepartment] = useState(null);
    const [departmentMembers, setDepartmentMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);

    // Delete confirmation state
    const [deleteModalDept, setDeleteModalDept] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Fetch department list
    const fetchDepartmentList = useCallback(async () => {
        try {
            setLoading(true);
            const res = await getDepartments(showInactive, activeCompanyId);
            if (res.data?.success && Array.isArray(res.data.departments)) {
                setDepartments(res.data.departments);
            } else {
                setDepartments([]);
            }
        } catch (error) {
            console.error("Failed to load departments:", error);
            toast.error(error.response?.data?.message || "Failed to load departments");
        } finally {
            setLoading(false);
        }
    }, [showInactive, activeCompanyId]);

    useEffect(() => {
        fetchDepartmentList();
    }, [fetchDepartmentList]);

    // Open Create Modal
    const openCreateModal = () => {
        setModalMode("create");
        setSelectedDepartment(null);
        setFormData({
            department_name: "",
            head_of_department: "",
            description: "",
            status: "ACTIVE"
        });
        setIsFormModalOpen(true);
    };

    // Open Edit Modal
    const openEditModal = (dept) => {
        setModalMode("edit");
        setSelectedDepartment(dept);
        setFormData({
            department_name: dept.department_name || "",
            head_of_department: dept.head_of_department || "",
            description: dept.description || "",
            status: dept.status || "ACTIVE"
        });
        setIsFormModalOpen(true);
    };

    // Open Members Modal
    const openMembersModal = async (dept) => {
        setMembersDepartment(dept);
        setIsMembersModalOpen(true);
        setLoadingMembers(true);
        try {
            const res = await getDepartmentMembers(dept.id);
            if (res.data?.success && Array.isArray(res.data.members)) {
                setDepartmentMembers(res.data.members);
            } else {
                setDepartmentMembers([]);
            }
        } catch (err) {
            console.error("Failed to load department members:", err);
            toast.error("Could not fetch assigned members");
            setDepartmentMembers([]);
        } finally {
            setLoadingMembers(false);
        }
    };

    // Form submit
    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const trimmedName = formData.department_name.trim();
        if (!trimmedName) {
            toast.error("Department name is required");
            return;
        }

        setSaving(true);
        try {
            if (modalMode === "create") {
                const res = await createDepartment({
                    departmentName: trimmedName,
                    headOfDepartment: formData.head_of_department.trim() || null,
                    description: formData.description.trim() || null,
                    status: formData.status,
                    companyId: parseInt(activeCompanyId, 10)
                });

                if (res.data?.success) {
                    toast.success("Department created successfully");
                    setIsFormModalOpen(false);
                    await fetchDepartmentList();
                } else {
                    toast.error(res.data?.message || "Failed to create department");
                }
            } else {
                const res = await updateDepartment(selectedDepartment.id, {
                    department_name: trimmedName,
                    head_of_department: formData.head_of_department.trim() || null,
                    description: formData.description.trim() || null,
                    status: formData.status
                });

                if (res.data?.success) {
                    toast.success("Department updated successfully");
                    setIsFormModalOpen(false);
                    await fetchDepartmentList();
                } else {
                    toast.error(res.data?.message || "Failed to update department");
                }
            }
        } catch (error) {
            console.error("Department submit error:", error);
            toast.error(error.response?.data?.message || "Operation failed");
        } finally {
            setSaving(false);
        }
    };

    // Status toggle
    const handleToggleStatus = async (dept) => {
        const nextStatus = dept.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        try {
            const res = await toggleDepartmentStatus(dept.id, dept.status);
            if (res.data?.success) {
                toast.success(`Department ${dept.department_name} is now ${nextStatus}`);
                await fetchDepartmentList();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to toggle status");
        }
    };

    // Delete department
    const handleDeleteDepartment = async () => {
        if (!deleteModalDept) return;
        setDeleting(true);
        try {
            const res = await deleteDepartment(deleteModalDept.id);
            if (res.data?.success) {
                toast.success(`Department "${deleteModalDept.department_name}" removed`);
                setDeleteModalDept(null);
                await fetchDepartmentList();
            } else {
                toast.error(res.data?.message || "Failed to delete department");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to delete department");
        } finally {
            setDeleting(false);
        }
    };

    // Stats calculations
    const stats = useMemo(() => {
        const total = departments.length;
        const active = departments.filter(d => d.status === "ACTIVE").length;
        const totalMembers = departments.reduce((acc, curr) => acc + (Number(curr.member_count) || 0), 0);
        const avgMembers = total > 0 ? (totalMembers / total).toFixed(1) : "0";
        return { total, active, totalMembers, avgMembers };
    }, [departments]);

    // Columns for DataTable
    const columns = useMemo(() => [
        {
            key: "department_name",
            label: "Department Name",
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2878C7] border border-blue-100 flex items-center justify-center font-bold text-sm shrink-0">
                        {row.department_name ? row.department_name.charAt(0).toUpperCase() : "D"}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 text-sm">{row.department_name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
                                #{row.id}
                            </span>
                        </div>
                        {row.company_name && (
                            <span className="text-xs text-slate-400 block">{row.company_name}</span>
                        )}
                    </div>
                </div>
            )
        },
        {
            key: "head_of_department",
            label: "Head of Department (HOD)",
            render: (row) => (
                <div className="flex items-center gap-1.5 text-xs text-slate-700">
                    <i className="fa-solid fa-user-tie text-slate-400"></i>
                    <span className="font-medium">{row.head_of_department || <span className="text-slate-400 italic">Not Assigned</span>}</span>
                </div>
            )
        },
        {
            key: "description",
            label: "Description / Purpose",
            render: (row) => (
                <span className="text-xs text-slate-600 line-clamp-1 max-w-xs" title={row.description || ""}>
                    {row.description || <span className="text-slate-400 italic">No description</span>}
                </span>
            )
        },
        {
            key: "member_count",
            label: "Assigned Staff",
            render: (row) => (
                <button
                    onClick={() => openMembersModal(row)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#2878C7] hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                    title="Click to view all assigned members"
                >
                    <i className="fa-solid fa-users text-[11px]"></i>
                    <span>{row.member_count || 0} {row.member_count === 1 ? 'member' : 'members'}</span>
                </button>
            )
        },
        {
            key: "status",
            label: "Status",
            render: (row) => {
                const isActive = row.status === "ACTIVE";
                return (
                    <button
                        onClick={() => handleToggleStatus(row)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                            isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                        }`}
                        title="Click to toggle status"
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-amber-500"}`} />
                        <span>{isActive ? "Active" : "Inactive"}</span>
                    </button>
                );
            }
        },
        {
            key: "actions",
            label: "Actions",
            sortable: false,
            render: (row) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => openEditModal(row)}
                        className="p-1.5 text-slate-500 hover:text-[#2878C7] hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Department"
                    >
                        <i className="fa-solid fa-pen-to-square text-sm"></i>
                    </button>

                    <button
                        onClick={() => openMembersModal(row)}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="View Department Staff"
                    >
                        <i className="fa-solid fa-users-viewfinder text-sm"></i>
                    </button>

                    <button
                        onClick={() => setDeleteModalDept(row)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Department"
                    >
                        <i className="fa-solid fa-trash-can text-sm"></i>
                    </button>
                </div>
            )
        }
    ], [departments]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-[#F6F8FB] min-h-screen">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl sm:text-2xl font-black text-[#17365D] tracking-tight flex items-center gap-2.5">
                            <i className="fa-solid fa-sitemap text-[#2878C7]"></i>
                            <span>Department Master</span>
                        </h1>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#2878C7] text-xs font-bold">
                            <i className="fa-solid fa-building text-[10px]"></i>
                            {activeCompanyName}
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Configure business units, assign leadership, and govern staff department allocations across {activeCompanyName}
                    </p>
                </div>

                <div className="flex items-center gap-2.5 self-start sm:self-auto">
                    <button
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all cursor-pointer"
                    >
                        <i className="fa-solid fa-plus"></i>
                        <span>Add New Department</span>
                    </button>
                </div>
            </div>

            {/* KPI Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#2878C7] flex items-center justify-center text-lg">
                        <i className="fa-solid fa-sitemap"></i>
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Total Departments</span>
                        <span className="text-xl font-black text-slate-900">{stats.total}</span>
                    </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-circle-check"></i>
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Active Departments</span>
                        <span className="text-xl font-black text-slate-900">{stats.active}</span>
                    </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-users"></i>
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Allocated Staff</span>
                        <span className="text-xl font-black text-slate-900">{stats.totalMembers}</span>
                    </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
                        <i className="fa-solid fa-chart-pie"></i>
                    </div>
                    <div>
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Avg Staff / Dept</span>
                        <span className="text-xl font-black text-slate-900">{stats.avgMembers}</span>
                    </div>
                </div>
            </div>

            {/* Department DataTable Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">Departments Directory</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
                            {departments.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                                className="w-4 h-4 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                            />
                            <span>Include Inactive Departments</span>
                        </label>
                    </div>
                </div>

                <DataTable
                    title="Departments"
                    data={departments}
                    columns={columns}
                    loading={loading}
                    searchPlaceholder="Search departments by name, lead, or description..."
                    tableId="department_master_table"
                />
            </div>

            {/* Create / Edit Department Modal */}
            {isFormModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2878C7] flex items-center justify-center font-bold">
                                    <i className="fa-solid fa-sitemap"></i>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        {modalMode === "create" ? "Add New Department" : "Edit Department"}
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        {modalMode === "create" ? "Define department details for staff assignment" : `Updating ${selectedDepartment?.department_name}`}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsFormModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                    Department Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.department_name}
                                    onChange={(e) => setFormData({ ...formData, department_name: e.target.value })}
                                    placeholder="e.g. Engineering, Sales, Human Resources"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7] focus:border-transparent text-sm text-slate-800 placeholder:text-slate-400 font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                    Head of Department (HOD) / Team Lead
                                </label>
                                <input
                                    type="text"
                                    value={formData.head_of_department}
                                    onChange={(e) => setFormData({ ...formData, head_of_department: e.target.value })}
                                    placeholder="e.g. Chief Technology Officer or John Doe"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7] focus:border-transparent text-sm text-slate-800 placeholder:text-slate-400 font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                    Scope & Description
                                </label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Brief outline of this department's function, goals, or core operational mandate..."
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7] focus:border-transparent text-sm text-slate-800 placeholder:text-slate-400 font-medium resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                    Operational Status
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7] focus:border-transparent text-sm text-slate-800 font-medium bg-white"
                                >
                                    <option value="ACTIVE">Active (Available for staff assignment)</option>
                                    <option value="INACTIVE">Inactive (Archived / Suspended)</option>
                                </select>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsFormModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                                >
                                    {saving && <i className="fa-solid fa-spinner fa-spin"></i>}
                                    <span>{modalMode === "create" ? "Create Department" : "Save Changes"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Department Members Modal */}
            {isMembersModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2878C7] flex items-center justify-center font-bold">
                                    <i className="fa-solid fa-users"></i>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">
                                        {membersDepartment?.department_name} — Assigned Staff
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Members currently allocated to this department ({departmentMembers.length})
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsMembersModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-3">
                            {loadingMembers ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                                    <i className="fa-solid fa-spinner fa-spin text-2xl text-[#2878C7]"></i>
                                    <span className="text-xs font-semibold">Loading department roster...</span>
                                </div>
                            ) : departmentMembers.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 text-xl">
                                        <i className="fa-solid fa-user-slash"></i>
                                    </div>
                                    <p className="text-sm font-bold text-slate-600">No staff members assigned yet</p>
                                    <p className="text-xs text-slate-400 max-w-sm">
                                        You can assign staff to this department from the <strong>User Master</strong> screen or when creating a new user account.
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden">
                                    {departmentMembers.map((m) => (
                                        <div key={m.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                                                    {m.name ? m.name.charAt(0).toUpperCase() : "U"}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-bold text-slate-800">{m.name}</span>
                                                        <span className="text-xs text-slate-400 font-mono">(@{m.username})</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                                                        <span>{m.email}</span>
                                                        {m.mob_no && <span>• {m.mob_no}</span>}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {m.type_name && (
                                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                        {m.type_name}
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold capitalize ${
                                                    m.role === 'admin' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                }`}>
                                                    {m.role || 'user'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setIsMembersModalOpen(false)}
                                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalDept && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-6 text-center space-y-4">
                            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center text-2xl mx-auto border border-red-100">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Delete Department?</h3>
                                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                    Are you sure you want to remove <strong className="text-slate-800">{deleteModalDept.department_name}</strong>?
                                    Assigned members will have their department cleared to <em>Unassigned</em>.
                                </p>
                            </div>

                            <div className="flex items-center justify-center gap-3 pt-2">
                                <button
                                    onClick={() => setDeleteModalDept(null)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeleteDepartment}
                                    disabled={deleting}
                                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                                >
                                    {deleting && <i className="fa-solid fa-spinner fa-spin"></i>}
                                    <span>Delete Department</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
