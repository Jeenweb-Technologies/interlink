import { useEffect, useState, useMemo } from "react";
import toast from "react-hot-toast";
import {
    getAllUsers,
    getPendingDevices,
    approveDevice,
    revokeDevice,
    fetchAuditLogs,
    toggleUserActive,
    updateUserByAdmin
} from "../../api/authApi";
import { getDepartments } from "../../api/departmentApi";
import { getUserTypes } from "../../api/userTypeMasterApi";
import DataTable from "../../components/DataTable";
import { useNavigate } from "react-router-dom";
import { usePermission } from "../../context/PermissionContext";

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { hasPermission, loading: permissionLoading } = usePermission();
    const canReadUsers = hasPermission("user_master", "read");
    const canReadDevices = hasPermission("device_approval", "read");
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const activeCompanyId = localStorage.getItem("active_company_id") || user.company_id || "1";
    const activeCompanyName = user.companies?.find(c => String(c.id) === String(activeCompanyId))?.name || "Active Company";

    const [activeTab, setActiveTab] = useState("users");
    const [users, setUsers] = useState([]);
    const [pendingDevices, setPendingDevices] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);

    // Filter/Search states
    const [auditUserFilter, setAuditUserFilter] = useState("all");

    const [showInactive, setShowInactive] = useState(false);
    const [saving, setSaving] = useState(false);

    // Department & User Type Options for Edit
    const [departments, setDepartments] = useState([]);
    const [userTypes, setUserTypes] = useState([]);

    // Edit User Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editForm, setEditForm] = useState({
        name: "",
        username: "",
        email: "",
        mobNo: "",
        departmentId: "",
        userTypeId: "",
        role: "user",
        active: true,
        deviceVerificationRequired: true,
        password: ""
    });
    const [updatingUser, setUpdatingUser] = useState(false);

    useEffect(() => {
        getDepartments(false, activeCompanyId).then(res => {
            if (res.data?.success && Array.isArray(res.data.departments)) {
                setDepartments(res.data.departments);
            }
        }).catch(err => console.error("Error loading departments for edit:", err));

        getUserTypes().then(res => {
            if (res.data?.data && Array.isArray(res.data.data)) {
                setUserTypes(res.data.data);
            }
        }).catch(err => console.error("Error loading user types for edit:", err));
    }, [activeCompanyId]);

    const fetchData = async () => {
        if (permissionLoading) return;
        try {
            const promises = [];
            if (canReadUsers) {
                promises.push(
                    getAllUsers(showInactive)
                        .then(res => ({ type: "users", data: res.data.users }))
                        .catch(err => { console.error("Error fetching users:", err); return null; })
                );
            }
            if (canReadDevices) {
                promises.push(
                    getPendingDevices()
                        .then(res => ({ type: "pending", data: res.data.devices }))
                        .catch(err => { console.error("Error fetching pending devices:", err); return null; })
                );
                promises.push(
                    fetchAuditLogs()
                        .then(res => ({ type: "audit", data: res.data.logs }))
                        .catch(err => { console.error("Error fetching audit logs:", err); return null; })
                );
            }

            const results = await Promise.all(promises);
            results.forEach(res => {
                if (!res) return;
                if (res.type === "users") setUsers(res.data);
                if (res.type === "pending") setPendingDevices(res.data);
                if (res.type === "audit") setAuditLogs(res.data);
            });
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load dashboard data");
        }
    };

    useEffect(() => {
        if (!permissionLoading) {
            if (canReadUsers) {
                setActiveTab("users");
            } else if (canReadDevices) {
                setActiveTab("pending");
            }
        }
    }, [permissionLoading, canReadUsers, canReadDevices]);

    useEffect(() => {
        fetchData();
    }, [showInactive, permissionLoading, canReadUsers, canReadDevices]);

    // Handlers
    const handleRevokeDevice = async (userId) => {
        if (!window.confirm("Are you sure you want to revoke this user's active device?")) return;
        try {
            await revokeDevice(userId);
            toast.success("Device revoked successfully");
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to revoke device");
        }
    };

    const handleToggleUserActive = async (id, currentActive) => {
        const newState = !currentActive;
        const label = newState ? "activate" : "deactivate";
        if (!window.confirm(`Are you sure you want to ${label} this user?`)) return;
        setSaving(true);
        try {
            await toggleUserActive(id, newState);
            toast.success(`User ${newState ? "activated" : "deactivated"}`);
            await fetchData();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || "Failed to update user status");
        } finally {
            setSaving(false);
        }
    };

    const handleApproveDevice = async (deviceRowId) => {
        try {
            await approveDevice(deviceRowId);
            toast.success("Device approved successfully");
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to approve device");
        }
    };

    const handleOpenEditModal = (u) => {
        setEditingUser(u);
        setEditForm({
            name: u.name || "",
            username: u.username || "",
            email: u.email || "",
            mobNo: u.mob_no || "",
            departmentId: u.department_id ? String(u.department_id) : "",
            userTypeId: u.user_type_id ? String(u.user_type_id) : "",
            role: u.role || "user",
            active: !!u.active,
            deviceVerificationRequired: typeof u.device_verification_required === "boolean" ? u.device_verification_required : true,
            password: ""
        });
        setIsEditModalOpen(true);
    };

    const handleSaveEditUser = async (e) => {
        e.preventDefault();
        if (!editingUser) return;
        setUpdatingUser(true);
        try {
            const payload = {
                name: editForm.name.trim(),
                username: editForm.username.trim(),
                email: editForm.email.trim(),
                mobNo: editForm.mobNo ? editForm.mobNo.trim() : null,
                departmentId: editForm.departmentId ? parseInt(editForm.departmentId, 10) : null,
                userTypeId: editForm.userTypeId ? parseInt(editForm.userTypeId, 10) : null,
                role: editForm.role,
                active: editForm.active,
                deviceVerificationRequired: editForm.deviceVerificationRequired
            };
            if (editForm.password && editForm.password.trim().length > 0) {
                payload.password = editForm.password.trim();
            }
            const res = await updateUserByAdmin(editingUser.id, payload);
            if (res.data?.success) {
                toast.success("User updated successfully");
                setIsEditModalOpen(false);
                setEditingUser(null);
                await fetchData();
            } else {
                toast.error(res.data?.message || "Failed to update user");
            }
        } catch (err) {
            console.error("Update user error:", err);
            toast.error(err.response?.data?.message || "Failed to update user");
        } finally {
            setUpdatingUser(false);
        }
    };




    const userColumns = useMemo(() => [
        // {
        //     key: 'user',
        //     label: 'User',
        //     render: (row) => (
        //         <div className="flex flex-col">
        //             <div className="flex items-center gap-1.5">
        //                 <span className="text-sm font-medium text-slate-900">{row.name}</span>
        //                 {row.username && <span className="text-xs text-slate-400 font-mono">({row.username})</span>}
        //             </div>
        //             <span className="text-sm text-slate-500">{row.email}</span>
        //         </div>
        //     )
        // },
        {
            key: 'name', label: 'Full Name', render: (row) => (
                <span className="text-sm text-slate-600">
                    {row.name || '—'}
                </span>
            )
        },
        {
            key: 'username', label: 'Username', render: (row) => (
                <span className="text-sm text-slate-600 font-mono">
                    {row.username || '—'}
                </span>
            )
        },
        {
            key: 'type_name', label: 'Type Name', render: (row) => (
                <span className="text-sm text-slate-600">
                    {row.type_name || '—'}
                </span>
            )
        },
        {
            key: 'role', label: 'User Group', render: (row) => (
                <span className="text-sm font-semibold text-slate-700 capitalize">
                    {row.role || '—'}
                </span>
            )
        },
        {
            key: 'department_name',
            label: 'Department',
            render: (row) => row.department_name ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-[#0056cf] border border-blue-200">
                    <i className="fa-solid fa-sitemap text-[10px]"></i>
                    {row.department_name}
                </span>
            ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400 italic">
                    Unassigned
                </span>
            )
        },
        {
            key: 'mob_no',
            label: 'Mobile',
            render: (row) => <span className="text-sm text-slate-600">{row.mob_no || '—'}</span>
        },
        {
            key: "active",
            label: "Status",
            render: (row) => row.active ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                </span>
            ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Deactivated
                </span>
            )
        },
        {
            key: 'device_status',
            label: 'Device Status',
            render: (row) => (
                <div className="flex flex-col items-start gap-1">
                    {row.device_status === 'approved' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Approved </span>
                    ) : row.device_status === 'pending' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Pending ⏳</span>
                    ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">No Device —</span>
                    )}
                    {row.device_id && <div className="text-xs text-slate-400 font-mono max-w-[120px] truncate" title={row.device_id}>{row.device_id}</div>}
                </div>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (row) => {
                const canRevoke = hasPermission("device_approval", "write") || user.role === "admin";
                const canToggle = hasPermission("user_master", "update") || user.role === "admin";
                const canEdit = hasPermission("user_master", "update") || user.role === "admin";
                return (
                    <div className="flex items-center gap-2">
                        {canEdit && (
                            <button
                                onClick={() => handleOpenEditModal(row)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#0056cf] hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                                title="Edit User & Assign Department"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                                </svg>
                            </button>
                        )}
                        {canToggle && (
                            <button
                                onClick={() => handleToggleUserActive(row.id, !!row.active)}
                                disabled={saving}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer ${row.active
                                    ? "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                    }`}
                                title={row.active ? "Deactivate" : "Activate"}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.8}
                                    stroke="currentColor"
                                    className="h-4 w-4"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5.636 5.636a9 9 0 1012.728 0M12 3v9"
                                    />
                                </svg>
                            </button>
                        )}
                        {canRevoke && (
                            <button
                                onClick={() => handleRevokeDevice(row.id)}
                                disabled={!row.device_status}
                                className="text-red-600 hover:text-red-900 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium ml-1"
                            >
                                Revoke Device
                            </button>
                        )}
                    </div>
                );
            }
        },
        {
            key: 'device_verification_required',
            label: 'Device Verification',
            render: (row) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${row.device_verification_required ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {row.device_verification_required ? 'Required' : 'Not Required'}
                </span>
            )
        }
    ], [users, saving, user, hasPermission]);

    const pendingColumns = useMemo(() => [
        {
            key: 'user',
            label: 'User',
            render: (row) => (
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-900">{row.user_name}</span>
                    <span className="text-sm text-slate-500">{row.user_email}</span>
                </div>
            )
        },
        {
            key: 'device_id',
            label: 'Device ID',
            render: (row) => <span className="font-mono text-sm text-slate-600">{row.device_id}</span>
        },
        {
            key: 'submitted_at',
            label: 'Submitted At',
            render: (row) => <span className="text-sm text-slate-500">{new Date(row.submitted_at).toLocaleString()}</span>
        },
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (row) => {
                const canApprove = hasPermission("device_approval", "write") || user.role === "admin";
                if (!canApprove) return <span className="text-xs text-slate-400">—</span>;
                return (
                    <div className="flex justify-end">
                        <button
                            onClick={() => handleApproveDevice(row.id)}
                            className="inline-flex justify-center rounded-md px-4 py-2 text-sm font-semibold text-white bg-[#0056cf] hover:bg-[#0040a1] shadow-sm"
                        >
                            Approve
                        </button>
                    </div>
                );
            }
        }
    ], [hasPermission, user]);

    const historyColumns = useMemo(() => [
        {
            key: 'user',
            label: 'User',
            render: (row) => <span className="text-sm font-medium text-slate-900">{row.user_name}</span>
        },
        {
            key: 'device_id',
            label: 'Device ID',
            render: (row) => (
                <span className="font-mono text-xs text-slate-600 max-w-[150px] truncate block" title={row.device_id}>
                    {row.device_id}
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.status === 'approved' ? 'bg-green-100 text-green-800' :
                    row.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                    }`}>
                    {row.status.toUpperCase()}
                </span>
            )
        },
        {
            key: 'submitted_at',
            label: 'Submitted',
            render: (row) => <span className="text-xs text-slate-500">{new Date(row.submitted_at).toLocaleString()}</span>
        },
        {
            key: 'approved_by',
            label: 'Approved By',
            render: (row) => <span className="text-xs text-slate-500">{row.approved_by_name ? `${row.approved_by_name} on ${new Date(row.approved_at).toLocaleString()}` : '—'}</span>
        },
        {
            key: 'closed_by',
            label: 'Closed By',
            render: (row) => <span className="text-xs text-slate-500">{row.closed_by_name ? `${row.closed_by_name} on ${new Date(row.closed_at).toLocaleString()}` : '—'}</span>
        }
    ], []);

    const filteredAuditLogs = auditUserFilter === "all"
        ? auditLogs
        : auditLogs.filter(log => log.user_id.toString() === auditUserFilter);

    return (
        <div className="w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">


                {/* Tabs */}
                <div className="border-b border-slate-200 mb-6">
                    <nav className="-mb-px flex space-x-8">
                        {(() => {
                            const tabs = [];
                            if (canReadUsers) tabs.push("users");
                            if (canReadDevices) {
                                tabs.push("pending");
                                tabs.push("history");
                            }
                            return tabs.map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors
                                        ${activeTab === tab
                                            ? 'border-[#0056cf] text-[#0056cf]'
                                            : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                                        }`}
                                >
                                    {tab === 'users' && 'Users'}
                                    {tab === 'pending' && (
                                        <span className="flex items-center gap-2">
                                            Pending Device Approvals
                                            {pendingDevices.length > 0 && (
                                                <span className="bg-orange-100 text-orange-600 py-0.5 px-2 rounded-full text-xs">
                                                    {pendingDevices.length}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                    {tab === 'history' && 'Device History'}
                                </button>
                            ));
                        })()}
                    </nav>
                </div>

                {/* Tab Content: Users */}
                {activeTab === 'users' && canReadUsers && (
                    <div className="flex-1 flex flex-col mb-8">
                        <DataTable
                            tableId="admin_user_master"
                            title={`User Master — ${activeCompanyName}`}
                            data={users}
                            columns={userColumns}
                            searchPlaceholder="Search users by name or email..."
                            toggleActions={
                                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-600 select-none">
                                    <div
                                        onClick={() => setShowInactive((v) => !v)}
                                        className={`relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer ${showInactive ? "bg-amber-400" : "bg-slate-200"
                                            }`}
                                    >
                                        <span
                                            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${showInactive ? "translate-x-4" : ""
                                                }`}
                                        />
                                    </div>
                                    Show Deactivated
                                </label>
                            }
                            actionButton={
                                (hasPermission("user_master", "write") || user.role === "admin") && (
                                    <button
                                        onClick={() => navigate('/admin/users/create')}
                                        className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0056cf] text-white hover:bg-[#0040a1] transition-colors cursor-pointer shadow-sm hover:shadow"
                                        title="Create User"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                        </svg>
                                    </button>
                                )
                            }
                        />
                    </div>
                )}

                {/* Tab Content: Pending Approvals */}
                {activeTab === 'pending' && canReadDevices && (
                    <div className="flex-1 flex flex-col mb-8">
                        <DataTable
                            tableId="admin_pending_approvals"
                            title="Pending Device Approvals"
                            data={pendingDevices}
                            columns={pendingColumns}
                            searchPlaceholder="Search pending devices..."
                        />
                    </div>
                )}

                {/* Tab Content: Device History */}
                {activeTab === 'history' && canReadDevices && (
                    <div className="flex-1 flex flex-col mb-8">
                        {/* <div className="mb-4 p-4 border border-slate-200 bg-white shadow-sm rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <span className="text-sm font-medium text-slate-700">Filter History by User:</span>
                            <select
                                value={auditUserFilter}
                                onChange={(e) => setAuditUserFilter(e.target.value)}
                                className="block w-full sm:w-64 pl-3 pr-10 py-2 text-base border border-slate-300 focus:outline-none focus:ring-[#0056cf] focus:border-[#0056cf] sm:text-sm rounded-lg"
                            >
                                <option value="all">All Users</option>
                                {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                ))}
                            </select>
                        </div> */}
                        <DataTable
                            tableId="admin_device_history"
                            title="Device History"
                            data={filteredAuditLogs}
                            columns={historyColumns}

                            searchPlaceholder="Search history logs..."
                        />
                    </div>
                )}

                {/* Edit User & Assign Department Modal */}
                {isEditModalOpen && editingUser && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0056cf] flex items-center justify-center font-bold">
                                        <i className="fa-solid fa-user-pen"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900">
                                            Edit User & Assign Department
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            Modify profile details, department allocation, and roles for <strong className="text-slate-700">{editingUser.name}</strong>
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { setIsEditModalOpen(false); setEditingUser(null); }}
                                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSaveEditUser} className="p-6 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                            Full Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0056cf] focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                            Username
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={editForm.username}
                                            onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0056cf] focus:outline-none font-mono"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                            Email Address <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={editForm.email}
                                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0056cf] focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                            Mobile Number
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.mobNo}
                                            onChange={(e) => setEditForm({ ...editForm, mobNo: e.target.value })}
                                            placeholder="Optional"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0056cf] focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                            Assigned Department
                                        </label>
                                        <select
                                            value={editForm.departmentId}
                                            onChange={(e) => setEditForm({ ...editForm, departmentId: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-[#0056cf] focus:outline-none"
                                        >
                                            <option value="">None / Unassigned</option>
                                            {departments.map((dept) => (
                                                <option key={dept.id} value={dept.id}>
                                                    {dept.department_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                            User Type
                                        </label>
                                        <select
                                            value={editForm.userTypeId}
                                            onChange={(e) => setEditForm({ ...editForm, userTypeId: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-[#0056cf] focus:outline-none"
                                        >
                                            <option value="">Select User Type</option>
                                            {userTypes.map((t) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.type_name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                            User Group (Role)
                                        </label>
                                        <select
                                            value={editForm.role}
                                            onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-[#0056cf] focus:outline-none"
                                        >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                            Reset Password <span className="text-slate-400 font-normal lowercase">(leave blank to keep current)</span>
                                        </label>
                                        <input
                                            type="password"
                                            value={editForm.password}
                                            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                                            placeholder="••••••••"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0056cf] focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                                        <input
                                            type="checkbox"
                                            checked={editForm.deviceVerificationRequired}
                                            onChange={(e) => setEditForm({ ...editForm, deviceVerificationRequired: e.target.checked })}
                                            className="w-4 h-4 rounded text-[#0056cf] border-slate-300 focus:ring-[#0056cf]"
                                        />
                                        <span>Require device verification for login</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                                        <input
                                            type="checkbox"
                                            checked={editForm.active}
                                            onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                                            className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500"
                                        />
                                        <span>User account is active</span>
                                    </label>
                                </div>

                                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => { setIsEditModalOpen(false); setEditingUser(null); }}
                                        className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={updatingUser}
                                        className="px-5 py-2 rounded-lg bg-[#0056cf] hover:bg-[#0040a1] text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-2"
                                    >
                                        {updatingUser && <i className="fa-solid fa-spinner fa-spin"></i>}
                                        <span>Save User Changes</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
        </div>
    );
}
