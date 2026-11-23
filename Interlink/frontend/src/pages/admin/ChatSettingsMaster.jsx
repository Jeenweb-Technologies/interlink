import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import DataTable from "../../components/DataTable";
import {
    getChatSettings,
    updateChatSettings,
    getChatUserTypePermissions,
    saveChatUserTypePermission
} from "../../api/chatApi";

export default function ChatSettingsMaster() {
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const activeCompanyId = localStorage.getItem("active_company_id") || user.company_id || "1";
    const activeCompanyName = user.companies?.find(c => String(c.id) === String(activeCompanyId))?.name || "Active Workspace";

    const [activeTab, setActiveTab] = useState("policies"); // "policies" | "permissions"
    const [loading, setLoading] = useState(true);
    const [savingSettings, setSavingSettings] = useState(false);

    // Global Governance Policies
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

    // User Type Permissions
    const [userTypePerms, setUserTypePerms] = useState([]);
    const [savingPermId, setSavingPermId] = useState(null);

    const loadData = async () => {
        try {
            setLoading(true);
            const [settingsRes, permsRes] = await Promise.all([
                getChatSettings().catch(err => { console.error("Error loading chat settings:", err); return null; }),
                getChatUserTypePermissions().catch(err => { console.error("Error loading chat perms:", err); return null; })
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
        } catch (error) {
            console.error("Failed to load chat governance data:", error);
            toast.error("Failed to load chat governance settings");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [activeCompanyId]);

    // Save Global Governance Settings
    const handleSaveSettings = async (e) => {
        if (e) e.preventDefault();
        setSavingSettings(true);
        try {
            const res = await updateChatSettings(settings);
            if (res.data?.success) {
                toast.success("Global chat governance rules saved successfully!");
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

    // Toggle Permission in Local State for a User Type
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

    // Columns for User Types Permissions Table
    const permColumns = useMemo(() => [
        {
            key: "type_name",
            label: "User Type / Role",
            render: (row) => (
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2878C7] flex items-center justify-center font-bold text-xs">
                        <i className="fa-solid fa-user-shield"></i>
                    </div>
                    <div>
                        <span className="font-bold text-slate-800 text-sm block">{row.type_name}</span>
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
                    <span className={`text-xs font-semibold ${row.can_direct_chat ? "text-emerald-700" : "text-slate-400"}`}>
                        {row.can_direct_chat ? "Allowed" : "Restricted"}
                    </span>
                </label>
            )
        },
        {
            key: "can_create_group",
            label: "Create Group Channels",
            render: (row) => (
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={row.can_create_group}
                        onChange={() => handleTogglePerm(row.user_type_id, "can_create_group")}
                        className="w-4 h-4 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                    />
                    <span className={`text-xs font-semibold ${row.can_create_group ? "text-emerald-700" : "text-slate-400"}`}>
                        {row.can_create_group ? "Allowed" : "Restricted"}
                    </span>
                </label>
            )
        },
        {
            key: "can_create_broadcast",
            label: "Send Broadcasts / Announcements",
            render: (row) => (
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={row.can_create_broadcast}
                        onChange={() => handleTogglePerm(row.user_type_id, "can_create_broadcast")}
                        className="w-4 h-4 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                    />
                    <span className={`text-xs font-semibold ${row.can_create_broadcast ? "text-purple-700" : "text-slate-400"}`}>
                        {row.can_create_broadcast ? "Authorized" : "Disabled"}
                    </span>
                </label>
            )
        },
        {
            key: "can_send_files",
            label: "Send Files & Media",
            render: (row) => (
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={row.can_send_files}
                        onChange={() => handleTogglePerm(row.user_type_id, "can_send_files")}
                        className="w-4 h-4 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                    />
                    <span className={`text-xs font-semibold ${row.can_send_files ? "text-emerald-700" : "text-slate-400"}`}>
                        {row.can_send_files ? "Enabled" : "Disabled"}
                    </span>
                </label>
            )
        },
        {
            key: "actions",
            label: "Action",
            sortable: false,
            render: (row) => (
                <button
                    onClick={() => handleSaveUserTypePerm(row)}
                    disabled={savingPermId === row.user_type_id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2878C7] border border-blue-200 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                    {savingPermId === row.user_type_id ? (
                        <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    ) : (
                        <i className="fa-solid fa-floppy-disk text-xs"></i>
                    )}
                    <span>Save</span>
                </button>
            )
        }
    ], [userTypePerms, savingPermId]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-6 bg-[#F6F8FB] min-h-screen">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl sm:text-2xl font-black text-[#17365D] tracking-tight flex items-center gap-2.5">
                            <i className="fa-solid fa-sliders text-[#2878C7]"></i>
                            <span>Chat Settings Master</span>
                        </h1>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-[#2878C7] text-xs font-bold">
                            <i className="fa-solid fa-building text-[10px]"></i>
                            {activeCompanyName}
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Govern corporate messaging rules, enforce admin-only broadcast controls, and restrict communication by user type
                    </p>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto">
                    <button
                        onClick={handleSaveSettings}
                        disabled={savingSettings}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 hover:shadow-lg transition-all disabled:opacity-50 cursor-pointer"
                    >
                        {savingSettings ? (
                            <i className="fa-solid fa-spinner fa-spin"></i>
                        ) : (
                            <i className="fa-solid fa-check-double"></i>
                        )}
                        <span>Save Governance Settings</span>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab("policies")}
                    className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                        activeTab === "policies"
                            ? "border-[#2878C7] text-[#2878C7]"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                    <i className="fa-solid fa-shield-halved"></i>
                    <span>Global Governance Policies</span>
                </button>

                <button
                    onClick={() => setActiveTab("permissions")}
                    className={`px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                        activeTab === "permissions"
                            ? "border-[#2878C7] text-[#2878C7]"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                >
                    <i className="fa-solid fa-user-lock"></i>
                    <span>User Type Chat Permissions</span>
                </button>
            </div>

            {/* TAB 1: Global Policies */}
            {activeTab === "policies" && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Settings Cards */}
                    <div className="lg:col-span-2 space-y-5">
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                <i className="fa-solid fa-comments text-[#2878C7]"></i>
                                <span>Messaging & Communication Access</span>
                            </h3>

                            {/* Direct Messaging */}
                            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800">1-to-1 Direct Messaging</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Allow colleagues to initiate private one-to-one direct conversations from the User Directory.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.allow_direct_messaging}
                                        onChange={(e) => setSettings({ ...settings, allow_direct_messaging: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2878C7]"></div>
                                </label>
                            </div>

                            {/* Cross-Department Chat */}
                            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800">Cross-Department Chat</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        When enabled, members can message users outside their own assigned department.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.cross_department_chat}
                                        onChange={(e) => setSettings({ ...settings, cross_department_chat: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2878C7]"></div>
                                </label>
                            </div>

                            {/* Group Channel Creation Policy */}
                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                                <h4 className="text-sm font-bold text-slate-800">Who Can Create Group Channels</h4>
                                <p className="text-xs text-slate-500">
                                    Define authorization level required to create collaborative team and project channels.
                                </p>
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                                        settings.allow_group_creation === "ALL" ? "border-[#2878C7] bg-blue-50/50 text-[#17365D]" : "border-slate-200 bg-white text-slate-600"
                                    }`}>
                                        <input
                                            type="radio"
                                            name="group_creation"
                                            value="ALL"
                                            checked={settings.allow_group_creation === "ALL"}
                                            onChange={(e) => setSettings({ ...settings, allow_group_creation: e.target.value })}
                                            className="text-[#2878C7] focus:ring-[#2878C7]"
                                        />
                                        <div>
                                            <span className="text-xs font-bold block">All Employees & Staff</span>
                                            <span className="text-[11px] text-slate-400">Any active user can start a group</span>
                                        </div>
                                    </label>

                                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                                        settings.allow_group_creation === "ADMIN_ONLY" ? "border-[#2878C7] bg-blue-50/50 text-[#17365D]" : "border-slate-200 bg-white text-slate-600"
                                    }`}>
                                        <input
                                            type="radio"
                                            name="group_creation"
                                            value="ADMIN_ONLY"
                                            checked={settings.allow_group_creation === "ADMIN_ONLY"}
                                            onChange={(e) => setSettings({ ...settings, allow_group_creation: e.target.value })}
                                            className="text-[#2878C7] focus:ring-[#2878C7]"
                                        />
                                        <div>
                                            <span className="text-xs font-bold block">Administrators Only</span>
                                            <span className="text-[11px] text-slate-400">Strict corporate control</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Broadcast Channel Policy */}
                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-800">Broadcast Channel Creation Policy</h4>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-50 text-purple-700 border border-purple-200">
                                        1-Way Announcements
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500">
                                    Specifies who can launch department and company-wide broadcast channels where only administrators can post.
                                </p>
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                                        settings.allow_broadcast_creation === "ADMIN_ONLY" ? "border-[#2878C7] bg-blue-50/50 text-[#17365D]" : "border-slate-200 bg-white text-slate-600"
                                    }`}>
                                        <input
                                            type="radio"
                                            name="broadcast_creation"
                                            value="ADMIN_ONLY"
                                            checked={settings.allow_broadcast_creation === "ADMIN_ONLY"}
                                            onChange={(e) => setSettings({ ...settings, allow_broadcast_creation: e.target.value })}
                                            className="text-[#2878C7] focus:ring-[#2878C7]"
                                        />
                                        <div>
                                            <span className="text-xs font-bold block">Administrators Only (Recommended)</span>
                                            <span className="text-[11px] text-slate-400">Prevents broadcast spam</span>
                                        </div>
                                    </label>

                                    <label className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                                        settings.allow_broadcast_creation === "ALL" ? "border-[#2878C7] bg-blue-50/50 text-[#17365D]" : "border-slate-200 bg-white text-slate-600"
                                    }`}>
                                        <input
                                            type="radio"
                                            name="broadcast_creation"
                                            value="ALL"
                                            checked={settings.allow_broadcast_creation === "ALL"}
                                            onChange={(e) => setSettings({ ...settings, allow_broadcast_creation: e.target.value })}
                                            className="text-[#2878C7] focus:ring-[#2878C7]"
                                        />
                                        <div>
                                            <span className="text-xs font-bold block">Open to All Staff</span>
                                            <span className="text-[11px] text-slate-400">Any user can broadcast</span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* File Sharing & Attachments */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                                <i className="fa-solid fa-paperclip text-[#2878C7]"></i>
                                <span>Media & Attachment Governance</span>
                            </h3>

                            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800">Allow File & Media Attachments</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Permits uploading images, documents, spreadsheets, and PDFs in messages.
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={settings.allow_file_sharing}
                                        onChange={(e) => setSettings({ ...settings, allow_file_sharing: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2878C7]"></div>
                                </label>
                            </div>

                            <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800">Maximum Upload Size Limit</h4>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Per-file attachment threshold for enterprise DLP and bandwidth optimization.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={settings.max_file_size_mb}
                                        onChange={(e) => setSettings({ ...settings, max_file_size_mb: parseInt(e.target.value, 10) || 25 })}
                                        className="w-20 px-3 py-1.5 border border-slate-300 rounded-lg text-sm text-center font-bold text-slate-800 focus:ring-2 focus:ring-[#2878C7] focus:outline-none"
                                    />
                                    <span className="text-xs font-bold text-slate-500">MB</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Architecture Directive & Summary */}
                    <div className="space-y-5">
                        <div className="bg-[#17365D] text-white rounded-2xl p-6 shadow-md space-y-4">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl text-sky-400">
                                <i className="fa-solid fa-bullhorn"></i>
                            </div>
                            <h3 className="text-base font-bold">Mandatory Broadcast Rule</h3>
                            <p className="text-xs text-slate-200 leading-relaxed">
                                In accordance with <strong>UI_SPECIFICATION.md § 3.4</strong>, all Announcement Channels and Broadcast Groups enforce:
                            </p>
                            <div className="p-3 rounded-xl bg-white/10 border border-white/15 text-xs font-semibold text-amber-300 flex items-center gap-2.5">
                                <i className="fa-solid fa-lock"></i>
                                <span>"Only administrators can send messages"</span>
                            </div>
                            <p className="text-[11px] text-slate-300">
                                This rule is strictly validated server-side in the backend controller and reflected client-side with a locked input banner.
                            </p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Governance Quick Summary</h4>
                            <ul className="text-xs text-slate-600 space-y-2.5">
                                <li className="flex items-center gap-2">
                                    <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
                                    <span>Direct user-to-user chatting: <strong>{settings.allow_direct_messaging ? "Active" : "Disabled"}</strong></span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
                                    <span>Cross-department messaging: <strong>{settings.cross_department_chat ? "Enabled" : "Restricted"}</strong></span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
                                    <span>File sharing capacity: <strong>{settings.max_file_size_mb} MB max</strong></span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <i className="fa-solid fa-circle-check text-emerald-500 text-xs"></i>
                                    <span>Group channel creation: <strong>{settings.allow_group_creation}</strong></span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: User Types Permissions DataTable */}
            {activeTab === "permissions" && (
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">User Types Communication Matrix</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Configure which user types (from User Types Master) are authorized to chat, create groups, or post broadcasts
                            </p>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-[#2878C7] font-bold border border-blue-200">
                            {userTypePerms.length} User Types Configured
                        </span>
                    </div>

                    <DataTable
                        title="Chat Permissions"
                        data={userTypePerms}
                        columns={permColumns}
                        loading={loading}
                        searchPlaceholder="Search user types..."
                        tableId="chat_user_type_permissions_table"
                    />
                </div>
            )}
        </div>
    );
}
