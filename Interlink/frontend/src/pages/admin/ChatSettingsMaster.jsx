import React, { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import DataTable from "../../components/DataTable";
import {
    getChatSettings,
    updateChatSettings,
    getChatUserTypePermissions,
    saveChatUserTypePermission,
    getAllUserChatPermissions,
    saveUserChatPermission
} from "../../api/chatApi";
import { getDepartments } from "../../api/departmentApi";

export default function ChatSettingsMaster() {
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const activeCompanyId = localStorage.getItem("active_company_id") || user.company_id || "1";
    const activeCompanyName = user.companies?.find(c => String(c.id) === String(activeCompanyId))?.name || "Active Workspace";

    // Tab state: "policies" | "user_types" | "user_scopes"
    const [activeTab, setActiveTab] = useState("policies");
    const [loading, setLoading] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);

    // Tab 1: Global Governance Policies
    const [settings, setSettings] = useState({
        allow_direct_messaging: true,
        allow_group_creation: "ALL",
        allow_broadcast_creation: "ADMIN_ONLY",
        allow_file_sharing: true,
        max_file_size_mb: 25,
        cross_department_chat: true,
        read_receipts_enabled: true,
        typing_indicators_enabled: true
    });

    // Tab 2: User Type Permissions
    const [userTypePerms, setUserTypePerms] = useState([]);
    const [savingPermId, setSavingPermId] = useState(null);

    // Tab 3: User Department Communication Scope
    const [userScopes, setUserScopes] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [editModalUser, setEditModalUser] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [savingScope, setSavingScope] = useState(false);

    // Edit Modal Scope Form State
    const [scopeFormData, setScopeFormData] = useState({
        chat_scope: "DEPARTMENT_ONLY",
        allowed_department_ids: [],
        can_direct_chat: true,
        can_create_group: true,
        can_create_broadcast: false,
        can_send_files: true
    });

    // Load initial master data
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [settingsRes, permsRes, userScopesRes, deptRes] = await Promise.all([
                getChatSettings().catch(err => { console.error("Error loading chat settings:", err); return null; }),
                getChatUserTypePermissions().catch(err => { console.error("Error loading chat perms:", err); return null; }),
                getAllUserChatPermissions().catch(err => { console.error("Error loading user scopes:", err); return null; }),
                getDepartments(false, activeCompanyId).catch(err => { console.error("Error loading depts:", err); return null; })
            ]);

            if (settingsRes?.data?.success && settingsRes.data.settings) {
                setSettings({
                    ...settingsRes.data.settings,
                    allow_direct_messaging: Boolean(settingsRes.data.settings.allow_direct_messaging),
                    allow_file_sharing: Boolean(settingsRes.data.settings.allow_file_sharing),
                    cross_department_chat: Boolean(settingsRes.data.settings.cross_department_chat),
                    read_receipts_enabled: Boolean(settingsRes.data.settings.read_receipts_enabled),
                    typing_indicators_enabled: Boolean(settingsRes.data.settings.typing_indicators_enabled)
                });
            }

            if (permsRes?.data?.success && Array.isArray(permsRes.data.permissions)) {
                setUserTypePerms(permsRes.data.permissions);
            }

            if (userScopesRes?.data?.success && Array.isArray(userScopesRes.data.users)) {
                setUserScopes(userScopesRes.data.users);
            }

            if (deptRes?.data?.success && Array.isArray(deptRes.data.departments)) {
                setDepartments(deptRes.data.departments);
            }
        } catch (error) {
            console.error("Failed to load chat governance data:", error);
            toast.error("Failed to load chat settings");
        } finally {
            setLoading(false);
        }
    }, [activeCompanyId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Save Global Governance Settings
    const handleSaveSettings = async (e) => {
        if (e) e.preventDefault();
        setSavingSettings(true);
        try {
            const res = await updateChatSettings(settings);
            if (res.data?.success) {
                toast.success("Chat policies updated successfully");
            } else {
                toast.error(res.data?.message || "Failed to update chat settings");
            }
        } catch (err) {
            console.error("Save chat settings error:", err);
            toast.error(err.response?.data?.message || "Failed to save chat settings");
        } finally {
            setSavingSettings(false);
        }
    };

    // Toggle Permission in Local State for User Types
    const handleTogglePerm = (userTypeId, field) => {
        setUserTypePerms(prev => prev.map(p => {
            if (p.user_type_id === userTypeId) {
                return { ...p, [field]: !p[field] };
            }
            return p;
        }));
    };

    // Save Single User Type Permission
    const handleSaveUserTypePerm = async (perm) => {
        setSavingPermId(perm.user_type_id);
        try {
            const res = await saveChatUserTypePermission(perm.user_type_id, {
                can_direct_chat: perm.can_direct_chat,
                can_create_group: perm.can_create_group,
                can_create_broadcast: perm.can_create_broadcast,
                can_send_files: perm.can_send_files
            });
            if (res.data?.success) {
                toast.success(`Permissions updated for ${perm.type_name}`);
            }
        } catch (err) {
            toast.error("Failed to save role permission");
        } finally {
            setSavingPermId(null);
        }
    };

    // Open User Scope Edit Modal
    const handleOpenEditUserScope = (u) => {
        setEditModalUser(u);
        setScopeFormData({
            chat_scope: u.chat_scope || "DEPARTMENT_ONLY",
            allowed_department_ids: Array.isArray(u.allowed_department_ids) ? [...u.allowed_department_ids] : [],
            can_direct_chat: u.can_direct_chat !== false,
            can_create_group: u.can_create_group !== false,
            can_create_broadcast: Boolean(u.can_create_broadcast),
            can_send_files: u.can_send_files !== false
        });
        setIsEditModalOpen(true);
    };

    // Toggle Multi-Department Allowed Dept Selection
    const handleToggleAllowedDepartment = (deptId) => {
        setScopeFormData(prev => {
            const current = prev.allowed_department_ids || [];
            const exists = current.includes(deptId);
            return {
                ...prev,
                allowed_department_ids: exists
                    ? current.filter(id => id !== deptId)
                    : [...current, deptId]
            };
        });
    };

    // Save User Scope Form
    const handleSaveUserScopeSubmit = async (e) => {
        e.preventDefault();
        if (!editModalUser) return;
        setSavingScope(true);
        try {
            const payload = {
                chat_scope: scopeFormData.chat_scope,
                allowed_department_ids: scopeFormData.chat_scope === "MULTI_DEPARTMENT"
                    ? scopeFormData.allowed_department_ids
                    : null,
                can_direct_chat: scopeFormData.can_direct_chat,
                can_create_group: scopeFormData.can_create_group,
                can_create_broadcast: scopeFormData.can_create_broadcast,
                can_send_files: scopeFormData.can_send_files
            };

            const res = await saveUserChatPermission(editModalUser.user_id, payload);
            if (res.data?.success) {
                toast.success(`Chat scope updated for ${editModalUser.name}`);
                setIsEditModalOpen(false);
                // Refresh user list
                const refreshed = await getAllUserChatPermissions();
                if (refreshed.data?.success && Array.isArray(refreshed.data.users)) {
                    setUserScopes(refreshed.data.users);
                }
            } else {
                toast.error(res.data?.message || "Failed to update user scope");
            }
        } catch (err) {
            console.error("Save user scope error:", err);
            toast.error(err.response?.data?.message || "Failed to save user chat permission");
        } finally {
            setSavingScope(false);
        }
    };

    // Department map lookup for labels
    const departmentMap = useMemo(() => {
        const map = {};
        departments.forEach(d => {
            map[d.id] = d.department_name;
        });
        return map;
    }, [departments]);

    // Columns for User Type Permissions Table
    const permColumns = useMemo(() => [
        {
            key: "type_name",
            label: "User Role",
            render: (row) => (
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2878C7] flex items-center justify-center font-bold text-xs shrink-0">
                        <i className="fa-solid fa-user-shield"></i>
                    </div>
                    <div>
                        <span className="font-semibold text-slate-800 text-sm block">{row.type_name}</span>
                        <span className="text-[11px] text-slate-400">ID #{row.user_type_id}</span>
                    </div>
                </div>
            )
        },
        {
            key: "can_direct_chat",
            label: "1-on-1 Direct Chat",
            render: (row) => (
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={row.can_direct_chat}
                        onChange={() => handleTogglePerm(row.user_type_id, "can_direct_chat")}
                        className="w-4 h-4 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                    />
                    <span className={`text-xs font-medium ${row.can_direct_chat ? "text-emerald-700" : "text-slate-400"}`}>
                        {row.can_direct_chat ? "Allowed" : "Disabled"}
                    </span>
                </label>
            )
        },
        {
            key: "can_create_group",
            label: "Create Groups",
            render: (row) => (
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={row.can_create_group}
                        onChange={() => handleTogglePerm(row.user_type_id, "can_create_group")}
                        className="w-4 h-4 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                    />
                    <span className={`text-xs font-medium ${row.can_create_group ? "text-emerald-700" : "text-slate-400"}`}>
                        {row.can_create_group ? "Allowed" : "Disabled"}
                    </span>
                </label>
            )
        },
        {
            key: "can_create_broadcast",
            label: "Create Broadcasts",
            render: (row) => (
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={row.can_create_broadcast}
                        onChange={() => handleTogglePerm(row.user_type_id, "can_create_broadcast")}
                        className="w-4 h-4 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                    />
                    <span className={`text-xs font-medium ${row.can_create_broadcast ? "text-emerald-700" : "text-slate-400"}`}>
                        {row.can_create_broadcast ? "Allowed" : "Disabled"}
                    </span>
                </label>
            )
        },
        {
            key: "can_send_files",
            label: "Attach Files",
            render: (row) => (
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={row.can_send_files}
                        onChange={() => handleTogglePerm(row.user_type_id, "can_send_files")}
                        className="w-4 h-4 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                    />
                    <span className={`text-xs font-medium ${row.can_send_files ? "text-emerald-700" : "text-slate-400"}`}>
                        {row.can_send_files ? "Allowed" : "Disabled"}
                    </span>
                </label>
            )
        },
        {
            key: "actions",
            label: "Actions",
            render: (row) => (
                <button
                    onClick={() => handleSaveUserTypePerm(row)}
                    disabled={savingPermId === row.user_type_id}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#17365D] text-white hover:bg-[#1f477a] transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                    {savingPermId === row.user_type_id ? (
                        <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                        <i className="fa-solid fa-check"></i>
                    )}
                    <span>Save</span>
                </button>
            )
        }
    ], [userTypePerms, savingPermId]);

    // Columns for User Chat Scope & Department Cross-Communication Table
    const userScopeColumns = useMemo(() => [
        {
            key: "name",
            label: "User / Employee",
            render: (row) => (
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 text-[#17365D] border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                        {row.name ? row.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div>
                        <span className="font-semibold text-slate-800 text-sm block leading-snug">{row.name}</span>
                        <span className="text-[11px] text-slate-400">@{row.username || "user"}</span>
                    </div>
                </div>
            )
        },
        {
            key: "department_name",
            label: "Assigned Department",
            render: (row) => (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                    <i className="fa-solid fa-building text-slate-400 text-[10px]"></i>
                    {row.department_name || <span className="text-slate-400 italic">None (Unassigned)</span>}
                </span>
            )
        },
        {
            key: "chat_scope",
            label: "Communication Scope",
            render: (row) => {
                const scope = row.chat_scope || "DEPARTMENT_ONLY";
                if (scope === "COMPANY_WIDE") {
                    return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <i className="fa-solid fa-globe text-[10px]"></i>
                            Company-Wide
                        </span>
                    );
                }
                if (scope === "MULTI_DEPARTMENT") {
                    const count = Array.isArray(row.allowed_department_ids) ? row.allowed_department_ids.length : 0;
                    return (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-[#2878C7] border border-blue-200">
                            <i className="fa-solid fa-network-wired text-[10px]"></i>
                            Multi-Department ({count + (row.department_id ? 1 : 0)})
                        </span>
                    );
                }
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        <i className="fa-solid fa-lock text-[10px] text-slate-400"></i>
                        Department Only
                    </span>
                );
            }
        },
        {
            key: "allowed_departments",
            label: "Accessible Cross-Departments",
            render: (row) => {
                const scope = row.chat_scope || "DEPARTMENT_ONLY";
                if (scope === "COMPANY_WIDE") {
                    return <span className="text-xs text-emerald-600 font-medium">All Departments (Entire Company)</span>;
                }
                if (scope === "DEPARTMENT_ONLY") {
                    return <span className="text-xs text-slate-400">Restricted to {row.department_name || "own department"}</span>;
                }
                const ids = Array.isArray(row.allowed_department_ids) ? row.allowed_department_ids : [];
                if (ids.length === 0) {
                    return <span className="text-xs text-slate-400 italic">None selected</span>;
                }
                const names = ids.map(id => departmentMap[id] || `Dept #${id}`).join(", ");
                return (
                    <span className="text-xs text-slate-700 line-clamp-1 max-w-xs font-medium" title={names}>
                        + {names}
                    </span>
                );
            }
        },
        {
            key: "actions",
            label: "Actions",
            render: (row) => (
                <button
                    onClick={() => handleOpenEditUserScope(row)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                    <i className="fa-solid fa-sliders text-slate-500"></i>
                    <span>Configure</span>
                </button>
            )
        }
    ], [departmentMap]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Standard Master Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                        <i className="fa-solid fa-comments text-blue-600"></i>
                        <span>Chat Settings & Governance</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Configure corporate chat policies, role permissions, and cross-department communication scopes for {activeCompanyName}.
                    </p>
                </div>
            </div>

            {/* Standard Nav Tabs matching AdminDashboard & masters */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex space-x-6 sm:space-x-8">
                    <button
                        type="button"
                        onClick={() => setActiveTab("policies")}
                        className={`whitespace-nowrap pb-3 px-1 border-b-2 font-semibold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2 ${
                            activeTab === "policies"
                                ? "border-[#0056cf] text-[#0056cf]"
                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                        }`}
                    >
                        <i className="fa-solid fa-sliders text-xs"></i>
                        <span>Global Policies</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("user_types")}
                        className={`whitespace-nowrap pb-3 px-1 border-b-2 font-semibold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2 ${
                            activeTab === "user_types"
                                ? "border-[#0056cf] text-[#0056cf]"
                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                        }`}
                    >
                        <i className="fa-solid fa-user-shield text-xs"></i>
                        <span>User Type Permissions</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab("user_scopes")}
                        className={`whitespace-nowrap pb-3 px-1 border-b-2 font-semibold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-2 ${
                            activeTab === "user_scopes"
                                ? "border-[#0056cf] text-[#0056cf]"
                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                        }`}
                    >
                        <i className="fa-solid fa-building-user text-xs"></i>
                        <span>User Department Permissions</span>
                    </button>
                </nav>
            </div>

            {/* Tab 1: Global Governance Policies */}
            {activeTab === "policies" && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-5">
                    <div>
                        <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Company-Wide Chat Governance</h2>
                        <p className="text-xs text-slate-500 mt-1">Control global communication rules and sharing parameters for all workspace users.</p>
                    </div>

                    <form onSubmit={handleSaveSettings} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Allow Direct Messaging */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <h3 className="text-xs font-bold text-slate-800">1-on-1 Direct Messaging</h3>
                                    <p className="text-xs text-slate-500">Allow employees to initiate private direct conversations.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={settings.allow_direct_messaging}
                                        onChange={(e) => setSettings({ ...settings, allow_direct_messaging: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0056cf]"></div>
                                </label>
                            </div>

                            {/* Allow File Sharing */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <h3 className="text-xs font-bold text-slate-800">File & Document Attachments</h3>
                                    <p className="text-xs text-slate-500">Permit sharing documents, images, and audio files in chat.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={settings.allow_file_sharing}
                                        onChange={(e) => setSettings({ ...settings, allow_file_sharing: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0056cf]"></div>
                                </label>
                            </div>

                            {/* Group Creation Policy */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5">
                                <label className="block text-xs font-bold text-slate-800">Group Creation Policy</label>
                                <p className="text-xs text-slate-500">Who is authorized to create project and team group channels.</p>
                                <div className="pt-1">
                                    <select
                                        value={settings.allow_group_creation}
                                        onChange={(e) => setSettings({ ...settings, allow_group_creation: e.target.value })}
                                        className="w-full text-xs rounded-lg border border-slate-300 bg-white py-2 px-3 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0056cf] focus:border-[#0056cf]"
                                    >
                                        <option value="ALL">All Active Employees</option>
                                        <option value="ADMIN_ONLY">Administrators Only</option>
                                        <option value="DISABLED">Completely Disabled</option>
                                    </select>
                                </div>
                            </div>

                            {/* Broadcast Creation Policy */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5">
                                <label className="block text-xs font-bold text-slate-800">Broadcast Channel Creation</label>
                                <p className="text-xs text-slate-500">Who is authorized to post corporate-wide announcements.</p>
                                <div className="pt-1">
                                    <select
                                        value={settings.allow_broadcast_creation}
                                        onChange={(e) => setSettings({ ...settings, allow_broadcast_creation: e.target.value })}
                                        className="w-full text-xs rounded-lg border border-slate-300 bg-white py-2 px-3 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0056cf] focus:border-[#0056cf]"
                                    >
                                        <option value="ADMIN_ONLY">Administrators Only (Recommended)</option>
                                        <option value="ALL">All Active Employees</option>
                                        <option value="DISABLED">Completely Disabled</option>
                                    </select>
                                </div>
                            </div>

                            {/* Max File Size */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-1.5">
                                <label className="block text-xs font-bold text-slate-800">Maximum Attachment Size (MB)</label>
                                <p className="text-xs text-slate-500">Limit individual file upload size per message.</p>
                                <div className="pt-1">
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={settings.max_file_size_mb}
                                        onChange={(e) => setSettings({ ...settings, max_file_size_mb: parseInt(e.target.value, 10) || 10 })}
                                        className="w-full text-xs rounded-lg border border-slate-300 bg-white py-2 px-3 text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0056cf] focus:border-[#0056cf]"
                                    />
                                </div>
                            </div>

                            {/* Read Receipts */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex items-center justify-between gap-4">
                                <div className="space-y-0.5">
                                    <h3 className="text-xs font-bold text-slate-800">Read Receipts & Double Checks</h3>
                                    <p className="text-xs text-slate-500">Show read status checkmarks for sent messages.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={settings.read_receipts_enabled}
                                        onChange={(e) => setSettings({ ...settings, read_receipts_enabled: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0056cf]"></div>
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={savingSettings}
                                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#17365D] hover:bg-[#102642] text-white transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                            >
                                {savingSettings ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin"></i>
                                        <span>Saving Policies...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-check"></i>
                                        <span>Save Global Policies</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tab 2: User Type Permissions Matrix */}
            {activeTab === "user_types" && (
                <div className="space-y-4">
                    <DataTable
                        tableId="chat_user_types_matrix"
                        title="Role & User Type Permissions"
                        data={userTypePerms}
                        columns={permColumns}
                        loading={loading}
                        searchPlaceholder="Filter user roles..."
                    />
                </div>
            )}

            {/* Tab 3: User Chat & Department Communication Scope */}
            {activeTab === "user_scopes" && (
                <div className="space-y-4">
                    <DataTable
                        tableId="chat_user_department_scopes"
                        title="User Chat & Department Permissions"
                        data={userScopes}
                        columns={userScopeColumns}
                        loading={loading}
                        searchPlaceholder="Search employee by name, username or department..."
                    />
                </div>
            )}

            {/* Edit User Scope Modal */}
            {isEditModalOpen && editModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="font-bold text-slate-900 text-sm">Configure User Chat Permissions</h3>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {editModalUser.name} (@{editModalUser.username}) &bull; Dept: {editModalUser.department_name || "Unassigned"}
                                </p>
                            </div>
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                            >
                                <i className="fa-solid fa-xmark text-base"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveUserScopeSubmit} className="p-6 space-y-5">
                            {/* Chat Scope Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-800 mb-2">Department Communication Scope</label>
                                <div className="space-y-2">
                                    {/* Option 1: Department Only (Default) */}
                                    <label
                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                            scopeFormData.chat_scope === "DEPARTMENT_ONLY"
                                                ? "border-[#2878C7] bg-blue-50/30"
                                                : "border-slate-200 hover:bg-slate-50"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="chat_scope"
                                            value="DEPARTMENT_ONLY"
                                            checked={scopeFormData.chat_scope === "DEPARTMENT_ONLY"}
                                            onChange={() => setScopeFormData({ ...scopeFormData, chat_scope: "DEPARTMENT_ONLY" })}
                                            className="mt-0.5 text-[#2878C7] focus:ring-[#2878C7]"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">Department Only (Default)</span>
                                            <span className="text-[11px] text-slate-500">
                                                Can only chat with members in their own assigned department ({editModalUser.department_name || "Unassigned"}).
                                            </span>
                                        </div>
                                    </label>

                                    {/* Option 2: Multi-Department (Custom Cross Chat) */}
                                    <label
                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                            scopeFormData.chat_scope === "MULTI_DEPARTMENT"
                                                ? "border-[#2878C7] bg-blue-50/30"
                                                : "border-slate-200 hover:bg-slate-50"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="chat_scope"
                                            value="MULTI_DEPARTMENT"
                                            checked={scopeFormData.chat_scope === "MULTI_DEPARTMENT"}
                                            onChange={() => setScopeFormData({ ...scopeFormData, chat_scope: "MULTI_DEPARTMENT" })}
                                            className="mt-0.5 text-[#2878C7] focus:ring-[#2878C7]"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">Multi-Department (Designated Cross-Chat)</span>
                                            <span className="text-[11px] text-slate-500">
                                                Can chat with their own department plus specific authorized departments.
                                            </span>
                                        </div>
                                    </label>

                                    {/* Option 3: Company-Wide */}
                                    <label
                                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                                            scopeFormData.chat_scope === "COMPANY_WIDE"
                                                ? "border-[#2878C7] bg-blue-50/30"
                                                : "border-slate-200 hover:bg-slate-50"
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="chat_scope"
                                            value="COMPANY_WIDE"
                                            checked={scopeFormData.chat_scope === "COMPANY_WIDE"}
                                            onChange={() => setScopeFormData({ ...scopeFormData, chat_scope: "COMPANY_WIDE" })}
                                            className="mt-0.5 text-[#2878C7] focus:ring-[#2878C7]"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-800 block">Company-Wide (All Departments)</span>
                                            <span className="text-[11px] text-slate-500">
                                                Full communication clearance with every member and department in the company.
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Department Multi-Select (Only visible when MULTI_DEPARTMENT is selected) */}
                            {scopeFormData.chat_scope === "MULTI_DEPARTMENT" && (
                                <div className="p-3.5 rounded-lg border border-blue-200 bg-blue-50/20 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold text-slate-800">
                                            Authorized Cross-Departments ({scopeFormData.allowed_department_ids.length} selected)
                                        </label>
                                        <span className="text-[11px] text-slate-500">Own department is always accessible</span>
                                    </div>

                                    {departments.length === 0 ? (
                                        <p className="text-xs text-slate-400 italic">No departments available in this company.</p>
                                    ) : (
                                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                                            {departments.map(dept => {
                                                const isOwnDept = dept.id === editModalUser.department_id;
                                                const isChecked = isOwnDept || scopeFormData.allowed_department_ids.includes(dept.id);

                                                return (
                                                    <label
                                                        key={dept.id}
                                                        className={`flex items-center justify-between py-1.5 px-2 rounded cursor-pointer text-xs select-none ${
                                                            isOwnDept ? "bg-slate-100/70 opacity-70" : "hover:bg-white"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                disabled={isOwnDept}
                                                                onChange={() => handleToggleAllowedDepartment(dept.id)}
                                                                className="w-3.5 h-3.5 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                                                            />
                                                            <span className="font-medium text-slate-800">{dept.department_name}</span>
                                                        </div>
                                                        {isOwnDept ? (
                                                            <span className="text-[10px] text-slate-400 font-mono">(User's Dept)</span>
                                                        ) : (
                                                            <span className="text-[10px] text-slate-400 font-mono">#{dept.id}</span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Additional Chat Capabilities */}
                            <div className="space-y-2 border-t border-slate-100 pt-3">
                                <label className="block text-xs font-bold text-slate-800">Feature Access for this User</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={scopeFormData.can_direct_chat}
                                            onChange={(e) => setScopeFormData({ ...scopeFormData, can_direct_chat: e.target.checked })}
                                            className="w-3.5 h-3.5 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                                        />
                                        <span className="text-xs font-medium text-slate-700">1-on-1 Direct Chat</span>
                                    </label>

                                    <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={scopeFormData.can_create_group}
                                            onChange={(e) => setScopeFormData({ ...scopeFormData, can_create_group: e.target.checked })}
                                            className="w-3.5 h-3.5 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                                        />
                                        <span className="text-xs font-medium text-slate-700">Create Groups</span>
                                    </label>

                                    <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={scopeFormData.can_create_broadcast}
                                            onChange={(e) => setScopeFormData({ ...scopeFormData, can_create_broadcast: e.target.checked })}
                                            className="w-3.5 h-3.5 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                                        />
                                        <span className="text-xs font-medium text-slate-700">Create Broadcasts</span>
                                    </label>

                                    <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50/50 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={scopeFormData.can_send_files}
                                            onChange={(e) => setScopeFormData({ ...scopeFormData, can_send_files: e.target.checked })}
                                            className="w-3.5 h-3.5 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                                        />
                                        <span className="text-xs font-medium text-slate-700">Send Attachments</span>
                                    </label>
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingScope}
                                    className="px-4 py-2 rounded-lg text-xs font-medium bg-[#17365D] text-white hover:bg-[#1f477a] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                                >
                                    {savingScope ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin"></i>
                                            <span>Saving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-check"></i>
                                            <span>Save Permissions</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
