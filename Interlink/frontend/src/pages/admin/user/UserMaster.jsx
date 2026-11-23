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
} from "../../../api/authApi";
import { getDepartments } from "../../../api/departmentApi";
import { getUserTypes } from "../../../api/userTypeMasterApi";
import { getCompanies } from "../../../api/companyApi";
import Navbar from "../../../components/Navbar";
import DataTable from "../../../components/DataTable";
import Filter, { FilterChips } from "../../../components/Filter";
import { useNavigate } from "react-router-dom";
import { usePermission } from "../../../context/PermissionContext";
import { isUserAdmin, isDepartmentAdmin, isAnyAdmin } from "../../../utils/roleUtils";

export default function UserMaster() {
    const navigate = useNavigate();
    const { hasPermission, loading: permissionLoading } = usePermission();
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const isAdmin = isUserAdmin(user);
    const isDeptAdmin = isDepartmentAdmin(user);
    const canReadUsers = isAdmin || isDeptAdmin || hasPermission("user_master", "read");
    const canReadDevices = isAdmin || isDeptAdmin || hasPermission("device_approval", "read");
    const canUpdateUser = isAdmin || isDeptAdmin || hasPermission("user_master", "update") || hasPermission("user_master", "write");

    const [activeTab, setActiveTab] = useState("users"); // 'users' | 'pending' | 'history'
    const [users, setUsers] = useState([]);
    const [pendingDevices, setPendingDevices] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [companiesList, setCompaniesList] = useState([]);
    const [departmentsList, setDepartmentsList] = useState([]);
    const [userTypesList, setUserTypesList] = useState([]);
    const [loadingData, setLoadingData] = useState(true);

    // Modern Multi-Select Filters
    const [filterValues, setFilterValues] = useState({
        companies: [],
        departments: [],
        roles: [],
        status: [],
        device_lock: []
    });
    const [showInactive, setShowInactive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Edit User Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [editFormData, setEditFormData] = useState({
        companyId: "",
        name: "",
        email: "",
        mobNo: "",
        userTypeId: "",
        role: "user",
        deviceVerificationRequired: true,
        deptRole: "USER",
        selectedSingleDept: "",
        selectedMultiDepts: [],
        chatScopeMode: "OWN", // 'OWN' | 'ALL' | 'CUSTOM'
        selectedChatDepts: []
    });
    const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

    // Device Approval Modal State
    const [approvingDevice, setApprovingDevice] = useState(null);
    const [allowDownloadChoice, setAllowDownloadChoice] = useState(true);
    const [isSubmittingApproval, setIsSubmittingApproval] = useState(false);

    // Fetch user master data
    const fetchData = async () => {
        if (permissionLoading) return;
        try {
            setLoadingData(true);
            const promises = [];

            if (canReadUsers || user.role === "admin") {
                promises.push(
                    getAllUsers(showInactive)
                        .then(res => ({ type: "users", data: res.data.users }))
                        .catch(err => { console.error("Error fetching users:", err); return null; })
                );
            }
            if (canReadDevices || user.role === "admin") {
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

            // Also load active companies, departments and user types for filtering & editing
            promises.push(
                getCompanies(false)
                    .then(res => {
                        const cList = res?.companies || res?.data || (Array.isArray(res) ? res : []);
                        return { type: "companies", data: Array.isArray(cList) ? cList : [] };
                    })
                    .catch(err => { console.error("Error fetching companies:", err); return null; })
            );
            promises.push(
                getDepartments(false)
                    .then(res => {
                        const dList = res?.departments || res?.data || (Array.isArray(res) ? res : []);
                        return { type: "depts", data: Array.isArray(dList) ? dList : [] };
                    })
                    .catch(err => { console.error("Error fetching departments:", err); return null; })
            );
            promises.push(
                getUserTypes()
                    .then(res => ({ type: "types", data: res.data?.data || res.data || [] }))
                    .catch(err => { console.error("Error fetching user types:", err); return null; })
            );

            const results = await Promise.all(promises);
            results.forEach(res => {
                if (!res) return;
                if (res.type === "users") setUsers(res.data || []);
                if (res.type === "pending") setPendingDevices(res.data || []);
                if (res.type === "audit") setAuditLogs(res.data || []);
                if (res.type === "companies") setCompaniesList(res.data || []);
                if (res.type === "depts") setDepartmentsList(res.data || []);
                if (res.type === "types") setUserTypesList(res.data || []);
            });
        } catch (error) {
            console.error("Error fetching User Master data:", error);
            toast.error("Failed to load user master records");
        } finally {
            setLoadingData(false);
        }
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchData();
        toast.success("User list refreshed");
        setRefreshing(false);
    };

    useEffect(() => {
        fetchData();
    }, [showInactive, permissionLoading, canReadUsers, canReadDevices]);

    // Handlers
    const handleRevokeDevice = async (userId) => {
        if (!window.confirm("Are you sure you want to revoke this user's authorized device?")) return;
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

    const handleOpenApproveModal = (deviceRow) => {
        setApprovingDevice(deviceRow);
        const hasRolePerm = Boolean(deviceRow.has_role_download_perm !== 0 && deviceRow.has_role_download_perm !== false);
        setAllowDownloadChoice(hasRolePerm);
    };

    const handleConfirmApproveDevice = async () => {
        if (!approvingDevice) return;
        setIsSubmittingApproval(true);
        try {
            const hasRolePerm = Boolean(approvingDevice.has_role_download_perm !== 0 && approvingDevice.has_role_download_perm !== false);
            const finalAllowDownload = hasRolePerm ? allowDownloadChoice : false;

            await approveDevice(approvingDevice.id, finalAllowDownload);
            toast.success(`Device approved! (${finalAllowDownload ? 'Downloads Allowed' : 'In-App View Only'})`);
            setApprovingDevice(null);
            await fetchData();
        } catch (error) {
            console.error("Approve device error:", error);
            toast.error(error.response?.data?.message || "Failed to approve device");
        } finally {
            setIsSubmittingApproval(false);
        }
    };

    // Open Edit User Modal
    const handleOpenEdit = (u) => {
        setEditingUser(u);
        const userDepts = Array.isArray(u.departments) ? u.departments : [];
        const isDeptAdmin = userDepts.some(d => d.department_role === "ADMIN");
        const deptIds = userDepts.map(d => d.department_id);

        const canChatAll = u.can_chat_all_departments === 1 || u.can_chat_all_departments === true || u.can_chat_all_departments === '1';
        let allowedChat = u.allowed_chat_departments || [];
        if (typeof allowedChat === 'string') {
            try { allowedChat = JSON.parse(allowedChat); } catch (_) { allowedChat = []; }
        }
        const initialChatMode = canChatAll ? "ALL" : (Array.isArray(allowedChat) && allowedChat.length > 0 ? "CUSTOM" : "OWN");

        const canChatAllComp = u.can_chat_all_companies === 1 || u.can_chat_all_companies === true || u.can_chat_all_companies === '1';
        let allowedComp = u.allowed_chat_companies || { companyIds: [], departmentIds: [] };
        if (typeof allowedComp === 'string') {
            try { allowedComp = JSON.parse(allowedComp); } catch (_) { allowedComp = { companyIds: [], departmentIds: [] }; }
        }
        let parsedCompIds = [];
        let parsedCompDeptIds = [];
        if (Array.isArray(allowedComp)) {
            parsedCompIds = allowedComp;
        } else if (allowedComp && typeof allowedComp === 'object') {
            parsedCompIds = Array.isArray(allowedComp.companyIds) ? allowedComp.companyIds : [];
            parsedCompDeptIds = Array.isArray(allowedComp.departmentIds) ? allowedComp.departmentIds : [];
        }
        const initialInterCompanyMode = canChatAllComp ? "ALL" : (parsedCompIds.length > 0 ? "CUSTOM" : "NONE");
        const initialInterCompanyDeptScope = parsedCompDeptIds.length > 0 ? "CUSTOM" : "ALL";

        setEditFormData({
            companyId: u.company_id || (companiesList[0]?.id || ""),
            name: u.name || "",
            email: u.email || "",
            mobNo: u.mob_no || "",
            userTypeId: u.user_type_id || "",
            role: u.role || "user",
            deviceVerificationRequired: u.device_verification_required === 1 || u.device_verification_required === true || u.device_verification_required === '1',
            deptRole: isDeptAdmin ? "ADMIN" : "USER",
            deptAssignmentMode: deptIds.length > 1 ? "MULTIPLE" : "SINGLE",
            selectedSingleDept: deptIds[0] || (departmentsList[0]?.id || ""),
            selectedMultiDepts: deptIds.length > 0 ? deptIds : (departmentsList[0] ? [departmentsList[0].id] : []),
            chatScopeMode: initialChatMode,
            selectedChatDepts: Array.isArray(allowedChat) ? allowedChat : [],
            interCompanyMode: initialInterCompanyMode,
            selectedInterCompanies: parsedCompIds,
            interCompanyDeptScope: initialInterCompanyDeptScope,
            selectedInterCompanyDepts: parsedCompDeptIds,
            isVendor: Boolean(u.is_vendor),
            canChatWithVendors: Boolean(u.can_chat_with_vendors),
            mustChangePassword: Boolean(u.must_change_password)
        });
        setIsEditModalOpen(true);
    };

    // Toggle multi-department in edit modal
    const toggleEditMultiDept = (id) => {
        setEditFormData(prev => ({
            ...prev,
            selectedMultiDepts: prev.selectedMultiDepts.includes(id)
                ? prev.selectedMultiDepts.filter(d => d !== id)
                : [...prev.selectedMultiDepts, id]
        }));
    };

    // Toggle custom chat department in edit modal
    const toggleEditChatDept = (id) => {
        setEditFormData(prev => ({
            ...prev,
            selectedChatDepts: prev.selectedChatDepts.includes(id)
                ? prev.selectedChatDepts.filter(d => d !== id)
                : [...prev.selectedChatDepts, id]
        }));
    };

    const selectAllEditChatDepts = () => {
        setEditFormData(prev => ({
            ...prev,
            selectedChatDepts: departmentsList.map(d => d.id)
        }));
    };

    const clearAllEditChatDepts = () => {
        setEditFormData(prev => ({
            ...prev,
            selectedChatDepts: []
        }));
    };

    const toggleEditInterCompany = (id) => {
        setEditFormData(prev => ({
            ...prev,
            selectedInterCompanies: prev.selectedInterCompanies.includes(id)
                ? prev.selectedInterCompanies.filter(c => c !== id)
                : [...prev.selectedInterCompanies, id]
        }));
    };

    const selectAllEditInterCompanies = () => {
        const others = companiesList.filter(c => String(c.id) !== String(editFormData.companyId)).map(c => c.id);
        setEditFormData(prev => ({
            ...prev,
            selectedInterCompanies: others.length > 0 ? others : companiesList.map(c => c.id)
        }));
    };

    const clearAllEditInterCompanies = () => {
        setEditFormData(prev => ({
            ...prev,
            selectedInterCompanies: []
        }));
    };

    const toggleEditInterCompanyDept = (id) => {
        setEditFormData(prev => ({
            ...prev,
            selectedInterCompanyDepts: prev.selectedInterCompanyDepts.includes(id)
                ? prev.selectedInterCompanyDepts.filter(d => d !== id)
                : [...prev.selectedInterCompanyDepts, id]
        }));
    };

    const selectAllEditInterCompanyDepts = () => {
        setEditFormData(prev => ({
            ...prev,
            selectedInterCompanyDepts: departmentsList.map(d => d.id)
        }));
    };

    const clearAllEditInterCompanyDepts = () => {
        setEditFormData(prev => ({
            ...prev,
            selectedInterCompanyDepts: []
        }));
    };

    // Save Edit User
    const handleSaveEdit = async (e) => {
        e.preventDefault();
        if (!editingUser) return;

        let departmentsPayload = [];
        if (editFormData.deptRole === "ADMIN" || editFormData.role === "admin") {
            if (editFormData.selectedMultiDepts.length === 0) {
                toast.error("Please select at least one department.");
                return;
            }
            departmentsPayload = editFormData.selectedMultiDepts.map(id => ({
                departmentId: Number(id),
                role: 'ADMIN'
            }));
        } else {
            if (editFormData.deptAssignmentMode === "MULTIPLE") {
                if (editFormData.selectedMultiDepts.length === 0) {
                    toast.error("Please select at least one department.");
                    return;
                }
                departmentsPayload = editFormData.selectedMultiDepts.map(id => ({
                    departmentId: Number(id),
                    role: 'USER'
                }));
            } else {
                if (!editFormData.selectedSingleDept) {
                    toast.error("Please select a department.");
                    return;
                }
                departmentsPayload = [{
                    departmentId: Number(editFormData.selectedSingleDept),
                    role: 'USER'
                }];
            }
        }

        try {
            setIsSubmittingEdit(true);
            const payload = {
                companyId: editFormData.companyId ? Number(editFormData.companyId) : null,
                name: editFormData.name,
                email: editFormData.email,
                mobNo: editFormData.mobNo,
                userTypeId: editFormData.userTypeId || null,
                role: editFormData.role,
                deviceVerificationRequired: editFormData.deviceVerificationRequired,
                isVendor: Boolean(editFormData.isVendor),
                canChatWithVendors: Boolean(editFormData.canChatWithVendors),
                mustChangePassword: Boolean(editFormData.mustChangePassword),
                departments: departmentsPayload,
                canChatAllDepartments: editFormData.chatScopeMode === "ALL",
                allowedChatDepartments: editFormData.chatScopeMode === "CUSTOM" ? editFormData.selectedChatDepts : [],
                canChatAllCompanies: editFormData.interCompanyMode === "ALL",
                allowedChatCompanies: editFormData.interCompanyMode === "CUSTOM" ? {
                    companyIds: editFormData.selectedInterCompanies,
                    departmentIds: editFormData.interCompanyDeptScope === "ALL" ? [] : editFormData.selectedInterCompanyDepts
                } : { companyIds: [], departmentIds: [] }
            };

            await updateUserByAdmin(editingUser.id, payload);
            toast.success("User profile & departments updated successfully!");
            setIsEditModalOpen(false);
            setEditingUser(null);
            await fetchData();
        } catch (error) {
            console.error("Update User error:", error);
            toast.error(error.response?.data?.message || "Failed to update user");
        } finally {
            setIsSubmittingEdit(false);
        }
    };

    // Filter Categories for the modern Filter popover component
    const filterCategories = useMemo(() => {
        // 0. Companies with user count
        const compCounts = {};
        let unassignedCompCount = 0;
        users.forEach((u) => {
            if (!u.company_id) {
                unassignedCompCount++;
            } else {
                const id = String(u.company_id);
                compCounts[id] = (compCounts[id] || 0) + 1;
            }
        });

        const companyOpts = companiesList.map((c) => ({
            value: String(c.id),
            label: c.company_name,
            count: compCounts[String(c.id)] || 0
        }));

        if (unassignedCompCount > 0) {
            companyOpts.push({
                value: "unassigned",
                label: "Unassigned",
                count: unassignedCompCount
            });
        }

        // 1. Departments with user count
        const deptCounts = {};
        let unassignedCount = 0;
        users.forEach((u) => {
            const uDepts = Array.isArray(u.departments) ? u.departments : [];
            if (uDepts.length === 0) unassignedCount++;
            else {
                uDepts.forEach((d) => {
                    const id = String(d.department_id);
                    deptCounts[id] = (deptCounts[id] || 0) + 1;
                });
            }
        });

        const deptOptions = departmentsList.map((d) => ({
            value: String(d.id),
            label: d.department_name,
            count: deptCounts[String(d.id)] || 0
        }));

        if (unassignedCount > 0) {
            deptOptions.push({
                value: "unassigned",
                label: "Unassigned",
                count: unassignedCount
            });
        }

        // 2. Roles & Types with user count
        const roleCounts = {};
        users.forEach((u) => {
            const key = u.type_name || u.role || "User";
            roleCounts[key] = (roleCounts[key] || 0) + 1;
        });

        const roleOpts = Object.keys(roleCounts).map((role) => ({
            value: role,
            label: role,
            count: roleCounts[role]
        }));

        // 3. Status with user count
        const activeCount = users.filter((u) => u.active).length;
        const inactiveCount = users.filter((u) => !u.active).length;
        const statusOptions = [
            { value: "active", label: "Active", count: activeCount },
            { value: "inactive", label: "Deactivated", count: inactiveCount }
        ];

        // 4. Device Lock Enforcement
        const enforcedCount = users.filter((u) => u.device_verification_required).length;
        const optionalCount = users.filter((u) => !u.device_verification_required).length;
        const lockOptions = [
            { value: "enforced", label: "Lock Enforced", count: enforcedCount },
            { value: "optional", label: "Lock Optional", count: optionalCount }
        ];

        return [
            {
                id: "companies",
                label: "COMPANIES",
                searchPlaceholder: "Search companies...",
                options: companyOpts
            },
            {
                id: "departments",
                label: "DEPARTMENTS",
                searchPlaceholder: "Search departments...",
                options: deptOptions
            },
            {
                id: "roles",
                label: "ROLES & TYPES",
                searchPlaceholder: "Search roles...",
                options: roleOpts
            },
            {
                id: "status",
                label: "STATUS",
                searchPlaceholder: "Search status...",
                options: statusOptions
            },
            {
                id: "device_lock",
                label: "DEVICE LOCK",
                searchPlaceholder: "Search lock...",
                options: lockOptions
            }
        ];
    }, [companiesList, departmentsList, users]);

    // Filtered Users for table
    const displayedUsers = useMemo(() => {
        let list = [...users];

        // 0. Companies Filter
        const compVals = filterValues.companies || [];
        if (compVals.length > 0) {
            list = list.filter((u) => {
                if (compVals.includes("unassigned") && !u.company_id) return true;
                return compVals.includes(String(u.company_id));
            });
        }

        // 1. Status Filter
        const statusVals = filterValues.status || [];
        if (statusVals.length === 1) {
            if (statusVals.includes("active")) {
                list = list.filter((u) => u.active);
            } else if (statusVals.includes("inactive")) {
                list = list.filter((u) => !u.active);
            }
        }

        // 2. Roles & Types Filter
        const roleVals = filterValues.roles || [];
        if (roleVals.length > 0) {
            list = list.filter((u) => {
                const roleOrType = u.type_name || u.role || "User";
                return roleVals.some((r) => String(r).toLowerCase() === String(roleOrType).toLowerCase());
            });
        }

        // 3. Departments Filter
        const deptVals = filterValues.departments || [];
        if (deptVals.length > 0) {
            list = list.filter((u) => {
                const userDepts = Array.isArray(u.departments) ? u.departments : [];
                if (deptVals.includes("unassigned") && userDepts.length === 0) {
                    return true;
                }
                return userDepts.some((d) => deptVals.includes(String(d.department_id)));
            });
        }

        // 4. Device Lock Filter
        const lockVals = filterValues.device_lock || [];
        if (lockVals.length === 1) {
            if (lockVals.includes("enforced")) {
                list = list.filter((u) => u.device_verification_required);
            } else if (lockVals.includes("optional")) {
                list = list.filter((u) => !u.device_verification_required);
            }
        }

        return list;
    }, [users, filterValues]);

    // Columns Definition for Users DataTable
    const userColumns = useMemo(() => [
        {
            key: 'name',
            label: 'User & Email',
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2D333B] text-white font-medium flex items-center justify-center text-xs shrink-0 shadow-xs border border-slate-700/60">
                        {row.name ? (row.name.trim().split(/\s+/).length > 1 ? (row.name.trim().split(/\s+/)[0][0] + row.name.trim().split(/\s+/)[1][0]).toUpperCase() : row.name[0].toUpperCase()) : 'U'}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-semibold text-slate-900 truncate">{row.name}</span>
                        <span className="text-xs text-slate-500 truncate">{row.email}</span>
                    </div>
                </div>
            )
        },
        {
            key: 'username',
            label: 'Username',
            render: (row) => (
                <span className="text-xs font-mono px-2 py-1 rounded bg-slate-100 text-slate-700 font-medium">
                    @{row.username || '-'}
                </span>
            )
        },
        {
            key: 'company',
            label: 'Company',
            render: (row) => (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                    <i className="fa-solid fa-building text-[10px] text-slate-500"></i>
                    {row.company_name || 'Epoxy House'}
                </span>
            )
        },
        {
            key: 'role',
            label: 'Role / Type',
            render: (row) => {
                const isAdm = row.role === 'admin' || row.role === 'super admin';
                return (
                    <div className="flex flex-col gap-0.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold w-fit ${isAdm
                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                : row.is_vendor
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                            <i className={`fa-solid ${isAdm ? 'fa-shield text-[10px]' : row.is_vendor ? 'fa-handshake text-[10px]' : 'fa-user text-[10px]'}`}></i>
                            {row.is_vendor ? 'Vendor' : (row.type_name || row.role || 'User')}
                        </span>
                        {row.can_chat_with_vendors && !row.is_vendor && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 w-fit" title="Allowed to chat with external vendors">
                                <i className="fa-solid fa-comments text-[8px]"></i> Vendor Chat
                            </span>
                        )}
                        {Boolean(row.must_change_password) && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 w-fit" title="User must change default password on first login">
                                <i className="fa-solid fa-key text-[8px]"></i> First Pwd Reset Pending
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            key: 'departments',
            label: 'Department(s)',
            render: (row) => {
                const userDepts = Array.isArray(row.departments) ? row.departments : [];
                const canChatAll = row.can_chat_all_departments === 1 || row.can_chat_all_departments === true || row.can_chat_all_departments === '1';
                let allowedChat = row.allowed_chat_departments || [];
                if (typeof allowedChat === 'string') {
                    try { allowedChat = JSON.parse(allowedChat); } catch (_) { allowedChat = []; }
                }

                return (
                    <div className="flex flex-col gap-1 max-w-[220px]">
                        {userDepts.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">Unassigned</span>
                        ) : (
                            <div className="flex flex-wrap gap-1">
                                {userDepts.map((d, i) => (
                                    <span
                                        key={d.department_id || i}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${d.department_role === "ADMIN"
                                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                                : "bg-blue-50 text-blue-700 border-blue-100"
                                            }`}
                                        title={`Department: ${d.department_name} (${d.department_role === "ADMIN" ? "Dept Admin" : "Member"})`}
                                    >
                                        <i className="fa-solid fa-building text-[9px] opacity-70"></i>
                                        <span>{d.department_name}</span>
                                        {d.department_role === "ADMIN" && (
                                            <i className="fa-solid fa-star text-[9px] text-purple-700 ml-0.5" title="Department Admin"></i>
                                        )}
                                    </span>
                                ))}
                            </div>
                        )}
                        {canChatAll ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit" title="Can chat with all departments across organization">
                                <i className="fa-solid fa-comments text-[8px]"></i>
                                All Depts Chat
                            </span>
                        ) : Array.isArray(allowedChat) && allowedChat.length > 0 ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 w-fit" title={`Can chat with ${allowedChat.length} specific departments`}>
                                <i className="fa-solid fa-comments text-[8px]"></i>
                                +{allowedChat.length} Chat Depts
                            </span>
                        ) : null}
                    </div>
                );
            }
        },
        {
            key: 'mob_no',
            label: 'Mobile',
            render: (row) => <span className="text-sm text-slate-600">{row.mob_no || <span className="text-slate-300">—</span>}</span>
        },
        {
            key: "active",
            label: "Account Status",
            render: (row) => row.active ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                </span>
            ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
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
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                            <i className="fa-solid fa-circle-check text-[10px]"></i> Approved
                        </span>
                    ) : row.device_status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                            <i className="fa-solid fa-clock text-[10px]"></i> Pending
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
                            No Device
                        </span>
                    )}
                    {row.device_id && (
                        <div className="text-[11px] text-slate-400 font-mono max-w-[130px] truncate" title={row.device_id}>
                            {row.device_id}
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'device_verification_required',
            label: 'Device Lock',
            render: (row) => (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${row.device_verification_required
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                    {row.device_verification_required ? 'Enforced' : 'Optional'}
                </span>
            )
        },
        {
            key: 'actions',
            label: 'Actions',
            sortable: false,
            render: (row) => {
                const canRevoke = hasPermission("device_approval", "write") || isAdmin;
                const canToggle = hasPermission("user_master", "update") || isAdmin;
                return (
                    <div className="flex items-center gap-1.5">
                        {canUpdateUser && (
                            <button
                                onClick={() => handleOpenEdit(row)}
                                className="flex h-8 px-2.5 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold transition-all shadow-sm cursor-pointer"
                                title="Edit User & Department Scope"
                            >
                                <i className="fa-solid fa-pen text-[10px]"></i>
                                <span>Edit</span>
                            </button>
                        )}
                        {canToggle && (
                            <button
                                onClick={() => handleToggleUserActive(row.id, !!row.active)}
                                disabled={saving}
                                className={`flex h-8 px-2.5 items-center gap-1.5 rounded-lg border text-xs font-semibold transition-all shadow-sm ${row.active
                                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-300 cursor-pointer"
                                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 cursor-pointer"
                                    }`}
                                title={row.active ? "Deactivate User" : "Activate User"}
                            >
                                <i className={`fa-solid ${row.active ? 'fa-user-slash text-[11px]' : 'fa-user-check text-[11px]'}`}></i>
                                <span>{row.active ? "Deactivate" : "Activate"}</span>
                            </button>
                        )}
                        {canRevoke && row.device_status === 'approved' && (
                            <button
                                onClick={() => handleRevokeDevice(row.id)}
                                className="flex h-8 px-2.5 items-center gap-1 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold transition-all shadow-sm cursor-pointer"
                                title="Revoke authorized device"
                            >
                                <i className="fa-solid fa-ban text-[11px]"></i>
                                <span>Revoke</span>
                            </button>
                        )}
                    </div>
                );
            }
        }
    ], [users, saving, user, hasPermission]);

    // Columns Definition for Pending Devices
    const pendingColumns = useMemo(() => [
        {
            key: 'user',
            label: 'User Information',
            render: (row) => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2D333B] text-white font-medium flex items-center justify-center text-xs shrink-0 border border-slate-700/60">
                        {row.user_name ? (row.user_name.trim().split(/\s+/).length > 1 ? (row.user_name.trim().split(/\s+/)[0][0] + row.user_name.trim().split(/\s+/)[1][0]).toUpperCase() : row.user_name[0].toUpperCase()) : 'U'}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-900">{row.user_name}</span>
                        <span className="text-xs text-slate-500">{row.user_email}</span>
                    </div>
                </div>
            )
        },
        {
            key: 'device_id',
            label: 'Device Fingerprint / ID',
            render: (row) => (
                <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 max-w-[240px] truncate block" title={row.device_id}>
                    {row.device_id}
                </span>
            )
        },
        {
            key: 'user_type',
            label: 'User Role & Download Perm',
            render: (row) => {
                const hasRolePerm = Boolean(row.has_role_download_perm !== 0 && row.has_role_download_perm !== false);
                return (
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-800">
                            {row.user_type_name || row.user_role || 'User'}
                        </span>
                        {hasRolePerm ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 w-fit">
                                <i className="fa-solid fa-check text-[8px]"></i> Role Permitted Download
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 w-fit">
                                <i className="fa-solid fa-ban text-[8px]"></i> No Download Permission
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            key: 'submitted_at',
            label: 'Submitted Timestamp',
            render: (row) => (
                <span className="text-xs text-slate-600 font-medium">
                    <i className="fa-regular fa-clock text-slate-400 mr-1.5"></i>
                    {new Date(row.submitted_at).toLocaleString()}
                </span>
            )
        },
        {
            key: 'actions',
            label: 'Approval Action',
            sortable: false,
            render: (row) => {
                const canApprove = hasPermission("device_approval", "write") || isAdmin;
                if (!canApprove) return <span className="text-xs text-slate-300">—</span>;
                return (
                    <div className="flex items-center">
                        <button
                            onClick={() => handleOpenApproveModal(row)}
                            className="inline-flex items-center gap-2 justify-center rounded-lg px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all hover:shadow cursor-pointer"
                        >
                            <i className="fa-solid fa-shield-check"></i>
                            Approve Device
                        </button>
                    </div>
                );
            }
        }
    ], [hasPermission, user, isAdmin]);

    // Columns Definition for Device History
    const historyColumns = useMemo(() => [
        {
            key: 'user',
            label: 'User',
            render: (row) => (
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900">{row.user_name}</span>
                    <span className="text-xs text-slate-400">{row.user_email}</span>
                </div>
            )
        },
        {
            key: 'device_id',
            label: 'Device ID',
            render: (row) => (
                <span className="font-mono text-xs text-slate-600 max-w-[180px] truncate block" title={row.device_id}>
                    {row.device_id}
                </span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (row) => (
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${row.status === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                        row.status === 'pending' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            'bg-red-100 text-red-800 border border-red-200'
                    }`}>
                    <i className={`fa-solid ${row.status === 'approved' ? 'fa-check text-[10px]' :
                            row.status === 'pending' ? 'fa-clock text-[10px]' : 'fa-xmark text-[10px]'
                        }`}></i>
                    {row.status.toUpperCase()}
                </span>
            )
        },
        {
            key: 'allow_download',
            label: 'Download Policy',
            render: (row) => {
                if (row.status !== 'approved') {
                    return <span className="text-xs text-slate-300">—</span>;
                }
                const isAllowed = row.allow_download === 1 || row.allow_download === true;
                return isAllowed ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                        <i className="fa-solid fa-cloud-arrow-down text-[10px]"></i> Allowed
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
                        <i className="fa-solid fa-eye text-[10px]"></i> View Only
                    </span>
                );
            }
        },
        {
            key: 'submitted_at',
            label: 'Submitted',
            render: (row) => <span className="text-xs text-slate-500">{new Date(row.submitted_at).toLocaleString()}</span>
        },
        {
            key: 'approved_by',
            label: 'Approved By',
            render: (row) => <span className="text-xs text-slate-600 font-medium">{row.approved_by_name ? `${row.approved_by_name} on ${new Date(row.approved_at).toLocaleDateString()}` : <span className="text-slate-300">—</span>}</span>
        },
        {
            key: 'closed_by',
            label: 'Closed / Revoked By',
            render: (row) => <span className="text-xs text-slate-600 font-medium">{row.closed_by_name ? `${row.closed_by_name} on ${new Date(row.closed_at).toLocaleDateString()}` : <span className="text-slate-300">—</span>}</span>
        }
    ], []);

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900">
            <Navbar title="CRM Admin" />

            <main className="flex-1 flex flex-col w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                {/* ── Tab Navigation ────────────────────────────────────────── */}
                <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-200 mb-4 sm:mb-6 overflow-x-auto no-scrollbar pb-px">
                    <button
                        onClick={() => setActiveTab("users")}
                        className={`flex items-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 text-xs font-semibold sm:font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "users"
                                ? "border-[#ED1C28] text-[#ED1C28] bg-red-50/50 rounded-t-xl"
                                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                            }`}
                    >
                        <i className="fa-solid fa-users text-xs"></i>
                        <span>Users Directory ({users.length})</span>
                    </button>

                    <button
                        onClick={() => setActiveTab("pending")}
                        className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "pending"
                                ? "border-orange-600 text-orange-600 bg-orange-50/50 rounded-t-xl"
                                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                            }`}
                    >
                        <i className="fa-solid fa-mobile-screen-button text-xs"></i>
                        <span>Pending Devices</span>
                        {pendingDevices.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-orange-500 text-white text-[10px] font-extrabold animate-pulse">
                                {pendingDevices.length}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab("history")}
                        className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${activeTab === "history"
                                ? "border-sky-600 text-sky-600 bg-sky-50/50 rounded-t-xl"
                                : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
                            }`}
                    >
                        <i className="fa-solid fa-clock-rotate-left text-xs"></i>
                        <span>Device Audit Logs ({auditLogs.length})</span>
                    </button>
                </div>

                {/* ── Tab Content ────────────────────────────────────────────── */}
                {activeTab === "users" && (
                    <DataTable
                        tableId="user_master_directory"
                        title="User Master"
                        icon="fa-users"
                        badge={`${displayedUsers.length} Users`}
                        columns={userColumns}
                        data={displayedUsers}
                        searchPlaceholder="Search users by name, email, username or mobile..."
                        isLoading={loadingData}
                        emptyMessage="No users found matching the selected criteria."
                        actionButton={
                            (hasPermission("user_master", "write") || isAdmin) && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => navigate('/admin/users/import')}
                                        title="Bulk Import Users from Excel"
                                        aria-label="Bulk Import Users from Excel"
                                        className="inline-flex items-center gap-1.5 px-3 h-9.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
                                    >
                                        <i className="fa-solid fa-file-excel text-xs"></i>
                                        <span className="hidden sm:inline">Import Excel</span>
                                    </button>
                                    <button
                                        onClick={() => navigate('/admin/users/create')}
                                        title="Create User"
                                        aria-label="Create User"
                                        className="inline-flex items-center justify-center w-9.5 h-9.5 rounded-xl bg-[#ED1C28] hover:bg-[#C5131E] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer shrink-0"
                                    >
                                        <i className="fa-solid fa-plus text-xs"></i>
                                    </button>
                                </div>
                            )
                        }
                        toggleActions={
                            <div className="flex flex-wrap items-center gap-2">
                                <Filter
                                    categories={filterCategories}
                                    values={filterValues}
                                    onApply={(newVals) => {
                                        setFilterValues(newVals);
                                        if (newVals.status?.includes("inactive") && !showInactive) {
                                            setShowInactive(true);
                                        }
                                    }}
                                    onReset={() => {
                                        setFilterValues({
                                            companies: [],
                                            departments: [],
                                            roles: [],
                                            status: [],
                                            device_lock: []
                                        });
                                    }}
                                    title="Filter Options"
                                    buttonLabel="Filters"
                                    accentColor="red"
                                />

                                {/* Show Inactive Toggle */}
                                <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none bg-slate-50 px-2.5 h-9.5 rounded-xl border border-slate-200 shadow-2xs hover:bg-slate-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={showInactive}
                                        onChange={(e) => setShowInactive(e.target.checked)}
                                        className="rounded text-[#ED1C28] focus:ring-[#ED1C28] h-3.5 w-3.5 border-slate-300"
                                    />
                                    <span className="hidden sm:inline">Include Inactive</span>
                                </label>
                            </div>
                        }
                        filterChips={
                            <FilterChips
                                categories={filterCategories}
                                values={filterValues}
                                onRemove={(catId, val) => {
                                    setFilterValues((prev) => ({
                                        ...prev,
                                        [catId]: (prev[catId] || []).filter((v) => String(v) !== String(val))
                                    }));
                                }}
                                onClearAll={() => {
                                    setFilterValues({
                                        companies: [],
                                        departments: [],
                                        roles: [],
                                        status: [],
                                        device_lock: []
                                    });
                                }}
                                accentColor="red"
                            />
                        }
                    />
                )}

                {activeTab === "pending" && (
                    <DataTable
                        tableId="user_master_pending_devices"
                        title="Device Verification Authorization Queue"
                        icon="fa-shield-halved"
                        badge={`${pendingDevices.length} Pending`}
                        columns={pendingColumns}
                        data={pendingDevices}
                        searchPlaceholder="Search pending devices by user or device ID..."
                        isLoading={loadingData}
                        emptyMessage="No pending device authorization requests at this time."
                    />
                )}

                {activeTab === "history" && (
                    <DataTable
                        tableId="user_master_device_audit"
                        title="Device Authentication & Security Audit Log"
                        icon="fa-clock-rotate-left"
                        badge={`${auditLogs.length} Events`}
                        columns={historyColumns}
                        data={auditLogs}
                        searchPlaceholder="Search audit log records by user, email, or device ID..."
                        isLoading={loadingData}
                        emptyMessage="No device audit events recorded yet."
                    />
                )}
            </main>

            {/* ΓöÇΓöÇ EDIT USER MODAL ΓöÇΓöÇ */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 max-h-[92vh] flex flex-col animate-in zoom-in-95">
                        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-[#2D333B] text-[#ED1C28] border border-slate-700/60 flex items-center justify-center font-medium text-xs shadow-xs">
                                    <i className="fa-solid fa-user-pen"></i>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 text-sm">Edit User Profile</h3>
                                    <p className="text-[10px] text-slate-500 font-normal">Update roles, permissions, and department scope</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="w-8 h-8 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 custom-chat-scrollbar">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Assign to Company <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={editFormData.companyId}
                                        onChange={(e) => setEditFormData({ ...editFormData, companyId: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">-- Select Company --</option>
                                        {companiesList.map((c) => (
                                            <option key={c.id} value={c.id}>{c.company_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Full Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={editFormData.name}
                                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Email Address <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={editFormData.email}
                                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        Mobile Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={editFormData.mobNo}
                                        onChange={(e) => setEditFormData({ ...editFormData, mobNo: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                        User Role / Type Profile <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={editFormData.userTypeId}
                                        onChange={(e) => {
                                            const typeId = e.target.value;
                                            const typeObj = userTypesList.find(t => String(t.id) === String(typeId));
                                            const name = (typeObj?.type_name || "").toLowerCase();
                                            const isSuper = name.includes("super admin") || Number(typeId) === 1;
                                            const isDeptAdm = name.includes("department admin") || name.includes("dept admin") || Number(typeId) === 2;

                                            setEditFormData(prev => ({
                                                ...prev,
                                                userTypeId: typeId,
                                                role: isSuper ? "admin" : "user",
                                                deptRole: (isSuper || isDeptAdm) ? "ADMIN" : "USER"
                                            }));
                                        }}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">-- Select Role --</option>
                                        {userTypesList.map((t) => (
                                            <option key={t.id} value={t.id}>{t.type_name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Department Assignment Section */}
                            <div className="pt-3 border-t border-slate-100 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                                        Assigned Department(s) <span className="text-rose-500">*</span>
                                    </label>
                                    {editFormData.deptRole !== "ADMIN" && (
                                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => setEditFormData(prev => ({ ...prev, deptAssignmentMode: "SINGLE" }))}
                                                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                                    editFormData.deptAssignmentMode === "SINGLE"
                                                        ? "bg-white text-slate-900 shadow-2xs"
                                                        : "text-slate-500 hover:text-slate-800"
                                                }`}
                                            >
                                                Single
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setEditFormData(prev => ({ ...prev, deptAssignmentMode: "MULTIPLE" }))}
                                                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                                                    editFormData.deptAssignmentMode === "MULTIPLE"
                                                        ? "bg-white text-indigo-700 shadow-2xs"
                                                        : "text-slate-500 hover:text-slate-800"
                                                }`}
                                            >
                                                Multiple
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {editFormData.deptRole !== "ADMIN" && editFormData.deptAssignmentMode === "SINGLE" ? (
                                    <select
                                        value={editFormData.selectedSingleDept}
                                        onChange={(e) => setEditFormData({
                                            ...editFormData,
                                            selectedSingleDept: e.target.value,
                                            selectedMultiDepts: [Number(e.target.value)]
                                        })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">-- Select Department --</option>
                                        {departmentsList.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.department_name}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                                            <span>Select all applicable departments:</span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditFormData(prev => ({
                                                        ...prev,
                                                        selectedMultiDepts: departmentsList.map(d => d.id)
                                                    }))}
                                                    className="font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                                                >
                                                    Select All
                                                </button>
                                                <span className="text-slate-300">|</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditFormData(prev => ({
                                                        ...prev,
                                                        selectedMultiDepts: departmentsList[0] ? [departmentsList[0].id] : []
                                                    }))}
                                                    className="font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
                                            {departmentsList.map((d) => {
                                                const isChecked = editFormData.selectedMultiDepts.includes(d.id);
                                                return (
                                                    <div
                                                        key={d.id}
                                                        onClick={() => toggleEditMultiDept(d.id)}
                                                        className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 cursor-pointer transition-all select-none ${isChecked
                                                                ? "bg-indigo-50 border-indigo-300 text-indigo-800 font-bold"
                                                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                                            }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => { }}
                                                            className="h-3.5 w-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                                        />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs truncate">{d.department_name}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Inter-Department Chat Permissions */}
                            <div className="pt-3 border-t border-slate-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                                        <i className="fa-solid fa-comments text-blue-600 mr-1.5"></i>
                                        Inter-Department Chat Permissions
                                    </label>
                                    <span className="text-[11px] text-slate-400">Can message other departments</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {/* Option 1: Own Dept Only */}
                                    <div
                                        onClick={() => setEditFormData(prev => ({ ...prev, chatScopeMode: "OWN" }))}
                                        className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                                            editFormData.chatScopeMode === "OWN"
                                                ? "bg-blue-50/70 border-blue-400 text-blue-900 font-bold shadow-2xs"
                                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs">Own Dept Only</span>
                                            <input
                                                type="radio"
                                                name="editChatScope"
                                                checked={editFormData.chatScopeMode === "OWN"}
                                                onChange={() => {}}
                                                className="h-3 w-3 text-blue-600"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">Assigned dept only</p>
                                    </div>

                                    {/* Option 2: All Departments */}
                                    <div
                                        onClick={() => setEditFormData(prev => ({ ...prev, chatScopeMode: "ALL" }))}
                                        className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                                            editFormData.chatScopeMode === "ALL"
                                                ? "bg-emerald-50/70 border-emerald-400 text-emerald-900 font-bold shadow-2xs"
                                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs">All Departments</span>
                                            <input
                                                type="radio"
                                                name="editChatScope"
                                                checked={editFormData.chatScopeMode === "ALL"}
                                                onChange={() => {}}
                                                className="h-3 w-3 text-emerald-600"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">Unrestricted org chat</p>
                                    </div>

                                    {/* Option 3: Custom Selected */}
                                    <div
                                        onClick={() => setEditFormData(prev => ({ ...prev, chatScopeMode: "CUSTOM" }))}
                                        className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                                            editFormData.chatScopeMode === "CUSTOM"
                                                ? "bg-purple-50/70 border-purple-400 text-purple-900 font-bold shadow-2xs"
                                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs">Specific Depts</span>
                                            <input
                                                type="radio"
                                                name="editChatScope"
                                                checked={editFormData.chatScopeMode === "CUSTOM"}
                                                onChange={() => {}}
                                                className="h-3 w-3 text-purple-600"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">Custom partner depts</p>
                                    </div>
                                </div>

                                {editFormData.chatScopeMode === "CUSTOM" && (
                                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-700">Permitted Chat Departments</span>
                                            <div className="flex items-center gap-2 text-[11px]">
                                                <button
                                                    type="button"
                                                    onClick={selectAllEditChatDepts}
                                                    className="font-bold text-purple-600 hover:text-purple-700 cursor-pointer"
                                                >
                                                    Select All
                                                </button>
                                                <span className="text-slate-300">|</span>
                                                <button
                                                    type="button"
                                                    onClick={clearAllEditChatDepts}
                                                    className="font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                            {departmentsList.map((d) => {
                                                const isChecked = editFormData.selectedChatDepts.includes(d.id);
                                                return (
                                                    <div
                                                        key={d.id}
                                                        onClick={() => toggleEditChatDept(d.id)}
                                                        className={`px-2 py-1.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all select-none ${
                                                            isChecked
                                                                ? "bg-purple-100/70 border-purple-300 text-purple-900 font-bold"
                                                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={() => {}}
                                                            className="h-3 w-3 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                                                        />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-[11px] truncate">{d.department_name}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Inter-Company Chat Permissions */}
                            <div className="pt-3 border-t border-slate-100 space-y-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                                        Inter-Company Chat Permissions
                                    </label>
                                    <p className="text-[11px] text-slate-500">
                                        Allow user to direct message staff belonging to external partner companies.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div
                                        onClick={() => setEditFormData(prev => ({ ...prev, interCompanyMode: "NONE" }))}
                                        className={`p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                                            editFormData.interCompanyMode === "NONE"
                                                ? "bg-blue-50/70 border-blue-400 text-blue-900 font-bold shadow-2xs"
                                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs">Own Company Only</span>
                                            <input
                                                type="radio"
                                                name="editInterCompanyMode"
                                                checked={editFormData.interCompanyMode === "NONE"}
                                                onChange={() => {}}
                                                className="h-3 w-3 text-blue-600"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">Isolated to own entity</p>
                                    </div>

                                    <div
                                        onClick={() => setEditFormData(prev => ({ ...prev, interCompanyMode: "ALL" }))}
                                        className={`p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                                            editFormData.interCompanyMode === "ALL"
                                                ? "bg-emerald-50/70 border-emerald-400 text-emerald-900 font-bold shadow-2xs"
                                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs">All Companies</span>
                                            <input
                                                type="radio"
                                                name="editInterCompanyMode"
                                                checked={editFormData.interCompanyMode === "ALL"}
                                                onChange={() => {}}
                                                className="h-3 w-3 text-emerald-600"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">Global access</p>
                                    </div>

                                    <div
                                        onClick={() => setEditFormData(prev => ({ ...prev, interCompanyMode: "CUSTOM" }))}
                                        className={`p-2.5 rounded-xl border cursor-pointer transition-all select-none ${
                                            editFormData.interCompanyMode === "CUSTOM"
                                                ? "bg-purple-50/70 border-purple-400 text-purple-900 font-bold shadow-2xs"
                                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs">Specific Companies</span>
                                            <input
                                                type="radio"
                                                name="editInterCompanyMode"
                                                checked={editFormData.interCompanyMode === "CUSTOM"}
                                                onChange={() => {}}
                                                className="h-3 w-3 text-purple-600"
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-normal mt-0.5">Custom partner scope</p>
                                    </div>
                                </div>

                                {editFormData.interCompanyMode === "CUSTOM" && (
                                    <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                                        {/* Company checkboxes */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs font-bold text-slate-700">Permitted Partner Companies</span>
                                                <div className="flex items-center gap-2 text-[11px]">
                                                    <button
                                                        type="button"
                                                        onClick={selectAllEditInterCompanies}
                                                        className="font-bold text-purple-600 hover:text-purple-700 cursor-pointer"
                                                    >
                                                        Select All
                                                    </button>
                                                    <span className="text-slate-300">|</span>
                                                    <button
                                                        type="button"
                                                        onClick={clearAllEditInterCompanies}
                                                        className="font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                                                    >
                                                        Clear
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                {companiesList.map((c) => {
                                                    const isChecked = editFormData.selectedInterCompanies.includes(c.id);
                                                    return (
                                                        <div
                                                            key={c.id}
                                                            onClick={() => toggleEditInterCompany(c.id)}
                                                            className={`px-2 py-1.5 rounded-lg border flex items-center justify-between gap-1.5 cursor-pointer transition-all select-none ${
                                                                isChecked
                                                                    ? "bg-purple-100/70 border-purple-300 text-purple-900 font-bold"
                                                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => {}}
                                                                    className="h-3 w-3 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                                                                />
                                                                <span className="text-[11px] truncate">{c.company_name}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Department Scope in Partner Companies */}
                                        <div className="pt-2 border-t border-slate-200/60">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs font-bold text-slate-700">Department Scope in Partner Companies</span>
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[11px] text-slate-600 flex items-center gap-1 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="editInterCompanyDeptScope"
                                                            checked={editFormData.interCompanyDeptScope === "ALL"}
                                                            onChange={() => setEditFormData(prev => ({ ...prev, interCompanyDeptScope: "ALL" }))}
                                                            className="text-purple-600"
                                                        />
                                                        <span>All Depts</span>
                                                    </label>
                                                    <label className="text-[11px] text-slate-600 flex items-center gap-1 cursor-pointer">
                                                        <input
                                                            type="radio"
                                                            name="editInterCompanyDeptScope"
                                                            checked={editFormData.interCompanyDeptScope === "CUSTOM"}
                                                            onChange={() => setEditFormData(prev => ({ ...prev, interCompanyDeptScope: "CUSTOM" }))}
                                                            className="text-purple-600"
                                                        />
                                                        <span>Specific</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {editFormData.interCompanyDeptScope === "CUSTOM" && (
                                                <div className="space-y-1.5 pt-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[10px] text-slate-500 font-medium">Permitted Departments:</span>
                                                        <div className="flex items-center gap-2 text-[10px]">
                                                            <button
                                                                type="button"
                                                                onClick={selectAllEditInterCompanyDepts}
                                                                className="font-bold text-purple-600 hover:text-purple-700 cursor-pointer"
                                                            >
                                                                Select All
                                                            </button>
                                                            <span className="text-slate-300">|</span>
                                                            <button
                                                                type="button"
                                                                onClick={clearAllEditInterCompanyDepts}
                                                                className="font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                                                            >
                                                                Clear
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                                        {departmentsList.map((d) => {
                                                            const isChecked = editFormData.selectedInterCompanyDepts.includes(d.id);
                                                            return (
                                                                <div
                                                                    key={d.id}
                                                                    onClick={() => toggleEditInterCompanyDept(d.id)}
                                                                    className={`px-2 py-1.5 rounded-lg border flex items-center gap-2 cursor-pointer transition-all select-none ${
                                                                        isChecked
                                                                            ? "bg-purple-100/70 border-purple-300 text-purple-900 font-bold"
                                                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                                    }`}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => {}}
                                                                        className="h-3 w-3 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                                                                    />
                                                                    <span className="text-[11px] truncate">{d.department_name}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Security & Access Flags */}
                            <div className="pt-3 border-t border-slate-100 space-y-2.5">
                                <div className="flex items-center gap-2.5">
                                    <input
                                        id="editDeviceVerification"
                                        type="checkbox"
                                        checked={editFormData.deviceVerificationRequired}
                                        onChange={(e) => setEditFormData({ ...editFormData, deviceVerificationRequired: e.target.checked })}
                                        className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                                    />
                                    <label htmlFor="editDeviceVerification" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                        Enforce Hardware Fingerprint Device Verification Lock
                                    </label>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <input
                                        id="editIsVendor"
                                        type="checkbox"
                                        checked={editFormData.isVendor}
                                        onChange={(e) => setEditFormData({ ...editFormData, isVendor: e.target.checked })}
                                        className="h-4 w-4 text-amber-600 border-slate-300 rounded focus:ring-amber-500 cursor-pointer"
                                    />
                                    <label htmlFor="editIsVendor" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                        Mark as External Vendor Account <span className="text-[10px] text-amber-700 font-normal">(Restricted to receiving chats only)</span>
                                    </label>
                                </div>

                                {!editFormData.isVendor && (
                                    <div className="flex items-center gap-2.5">
                                        <input
                                            id="editCanChatWithVendors"
                                            type="checkbox"
                                            checked={editFormData.canChatWithVendors}
                                            onChange={(e) => setEditFormData({ ...editFormData, canChatWithVendors: e.target.checked })}
                                            className="h-4 w-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500 cursor-pointer"
                                        />
                                        <label htmlFor="editCanChatWithVendors" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                            Allow Direct Chat with External Vendors
                                        </label>
                                    </div>
                                )}

                                <div className="flex items-center gap-2.5">
                                    <input
                                        id="editMustChangePassword"
                                        type="checkbox"
                                        checked={editFormData.mustChangePassword}
                                        onChange={(e) => setEditFormData({ ...editFormData, mustChangePassword: e.target.checked })}
                                        className="h-4 w-4 text-rose-600 border-slate-300 rounded focus:ring-rose-500 cursor-pointer"
                                    />
                                    <label htmlFor="editMustChangePassword" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                        Require Password Change on Next Login <span className="text-[10px] text-rose-600 font-normal">(Enforces mandatory first-time password screen)</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="w-full sm:w-auto px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer text-center"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingEdit}
                                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {isSubmittingEdit ? (
                                        <>
                                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-check"></i>
                                            <span>Update Profile</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* ΓöÇΓöÇ APPROVE DEVICE MODAL WITH DOWNLOAD PERMISSION POPUP ΓöÇΓöÇ */}
            {approvingDevice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col animate-in zoom-in-95">
                        {/* Modal Header */}
                        <div className="px-4 sm:px-6 py-3.5 sm:py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/90 shrink-0">
                            <div className="flex items-center gap-2.5 sm:gap-3">
                                <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-sm sm:text-base shadow-xs shrink-0">
                                    <i className="fa-solid fa-shield-check"></i>
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Approve Hardware Device</h3>
                                    <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Verify employee device & configure file download permissions</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setApprovingDevice(null)}
                                disabled={isSubmittingApproval}
                                className="w-8 h-8 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto max-h-[75vh]">
                            {/* User & Device Info Box */}
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                                            {approvingDevice.user_name ? approvingDevice.user_name[0].toUpperCase() : 'U'}
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-900">{approvingDevice.user_name}</h4>
                                            <p className="text-[11px] text-slate-500">{approvingDevice.user_email}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 shadow-2xs">
                                        @{approvingDevice.user_username || 'user'}
                                    </span>
                                </div>

                                <div className="pt-2.5 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[11px]">
                                    <div>
                                        <span className="text-slate-400 font-medium block">User Type / Role</span>
                                        <span className="font-bold text-slate-700">{approvingDevice.user_type_name || approvingDevice.user_role || 'User'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 font-medium block">Requested At</span>
                                        <span className="font-bold text-slate-700">{new Date(approvingDevice.submitted_at).toLocaleString()}</span>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-slate-400 font-medium block mb-0.5">Device Fingerprint ID</span>
                                        <span className="font-mono text-[10px] text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 block truncate" title={approvingDevice.device_id}>
                                            {approvingDevice.device_id}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Download Permission Decision Section */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <i className="fa-solid fa-file-arrow-down text-indigo-600"></i>
                                        <span>Device File Download Permission</span>
                                    </label>
                                </div>

                                {Boolean(approvingDevice.has_role_download_perm !== 0 && approvingDevice.has_role_download_perm !== false) ? (
                                    <div className="space-y-2.5">
                                        <p className="text-xs text-slate-600">
                                            This user's role has permission to download documents. <strong>Do you want to allow file downloads on this specific hardware device?</strong>
                                        </p>

                                        <div className="grid grid-cols-1 gap-2.5 pt-1">
                                            {/* Option YES */}
                                            <div
                                                onClick={() => setAllowDownloadChoice(true)}
                                                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none ${allowDownloadChoice === true
                                                        ? "border-emerald-500 bg-emerald-50/70 shadow-sm ring-2 ring-emerald-500/20"
                                                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${allowDownloadChoice === true
                                                        ? "bg-emerald-600 border-emerald-600 text-white"
                                                        : "border-slate-300 bg-white"
                                                    }`}>
                                                    {allowDownloadChoice === true && <i className="fa-solid fa-check text-[10px]"></i>}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-emerald-950">YES &mdash; Allow File Downloads</span>
                                                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-200/60 text-emerald-800">Recommended</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                                                        User can download and save files, media attachments, and documents locally on this device.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Option NO */}
                                            <div
                                                onClick={() => setAllowDownloadChoice(false)}
                                                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-3 select-none ${allowDownloadChoice === false
                                                        ? "border-amber-500 bg-amber-50/70 shadow-sm ring-2 ring-amber-500/20"
                                                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                                                    }`}
                                            >
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border ${allowDownloadChoice === false
                                                        ? "bg-amber-600 border-amber-600 text-white"
                                                        : "border-slate-300 bg-white"
                                                    }`}>
                                                    {allowDownloadChoice === false && <i className="fa-solid fa-check text-[10px]"></i>}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-amber-950">NO &mdash; Restrict to In-App View Only</span>
                                                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-200/60 text-amber-800">Protected</span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                                                        User can preview documents securely in-app with watermark protection, but cannot download or export files.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-slate-700">
                                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-sm shrink-0">
                                            <i className="fa-solid fa-circle-info"></i>
                                        </div>
                                        <div className="text-xs">
                                            <span className="font-bold text-slate-900 block mb-0.5">No Download Permission in Role</span>
                                            <p className="text-slate-500 leading-relaxed">
                                                The user's role profile does not have document download permissions. Upon approval, this device will operate in secure in-app preview mode.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-2.5 shrink-0">
                            <button
                                type="button"
                                onClick={() => setApprovingDevice(null)}
                                disabled={isSubmittingApproval}
                                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-slate-600 hover:bg-slate-200/60 text-xs font-bold transition-colors cursor-pointer text-center"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmApproveDevice}
                                disabled={isSubmittingApproval}
                                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmittingApproval ? (
                                    <>
                                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                                        <span>Approving Device...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-check"></i>
                                        <span>Confirm & Approve Device</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
