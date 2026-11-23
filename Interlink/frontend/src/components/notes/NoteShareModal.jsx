import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
    getNoteById,
    shareNote,
    revokeNoteShare,
    getCollaboratorsMeta
} from "../../api/noteApi";

export default function NoteShareModal({ noteId, isOpen, onClose, onSharesUpdated }) {
    const [note, setNote] = useState(null);
    const [shares, setShares] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Meta users and groups
    const [availableUsers, setAvailableUsers] = useState([]);
    const [availableGroups, setAvailableGroups] = useState([]);

    // Share form fields
    const [shareTargetType, setShareTargetType] = useState("user"); // 'user' | 'group'
    const [selectedTargetId, setSelectedTargetId] = useState("");
    const [permission, setPermission] = useState("view"); // 'view' | 'comment' | 'edit'
    const [expiresAt, setExpiresAt] = useState("");

    // Load Note and Meta
    useEffect(() => {
        if (!isOpen || !noteId) return;

        setLoading(true);
        Promise.all([
            getNoteById(noteId),
            getCollaboratorsMeta()
        ])
            .then(([noteRes, metaRes]) => {
                setNote(noteRes.data.note);
                setShares(noteRes.data.note.shares || []);
                setAvailableUsers(metaRes.data.users || []);
                setAvailableGroups(metaRes.data.groups || []);

                if (metaRes.data.users?.length > 0) {
                    setSelectedTargetId(metaRes.data.users[0].id);
                }
            })
            .catch((err) => {
                console.error("Failed to load share data:", err);
                toast.error("Failed to load sharing options");
                onClose();
            })
            .finally(() => setLoading(false));
    }, [isOpen, noteId]);

    // Handle Share submission
    const handleAddShare = async (e) => {
        e.preventDefault();
        if (!selectedTargetId) {
            toast.error("Please select a user or group");
            return;
        }

        const payload = {
            permission,
            expiresAt: expiresAt || null
        };

        if (shareTargetType === "user") {
            payload.userId = selectedTargetId;
        } else {
            payload.userTypeId = selectedTargetId;
        }

        setSubmitting(true);
        try {
            await shareNote(noteId, payload);
            toast.success("Note shared successfully");

            // Refresh share list
            const refreshRes = await getNoteById(noteId);
            setShares(refreshRes.data.note.shares || []);
            setExpiresAt("");
            if (onSharesUpdated) onSharesUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to share note");
        } finally {
            setSubmitting(false);
        }
    };

    // Immediate Revocation
    const handleRevoke = async (shareId, targetName) => {
        if (!window.confirm(`Revoke access for ${targetName || "this collaborator"} immediately?`)) {
            return;
        }

        try {
            await revokeNoteShare(noteId, shareId);
            setShares(shares.filter((s) => s.id !== shareId));
            toast.success("Access revoked immediately");
            if (onSharesUpdated) onSharesUpdated();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to revoke access");
        }
    };

    // Update Permission for existing share
    const handleUpdatePermission = async (share, newPermission) => {
        try {
            await shareNote(noteId, {
                userId: share.user_id,
                userTypeId: share.user_type_id,
                permission: newPermission,
                expiresAt: share.expires_at
            });
            setShares(
                shares.map((s) => (s.id === share.id ? { ...s, permission: newPermission } : s))
            );
            toast.success(`Permission updated to ${newPermission}`);
            if (onSharesUpdated) onSharesUpdated();
        } catch (err) {
            toast.error("Failed to update permission");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                    <div>
                        <h3 className="text-base font-bold text-[#17365D] flex items-center gap-2">
                            <svg className="w-5 h-5 text-[#2878C7]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            Share & Permissions
                        </h3>
                        <p className="text-xs text-[#5B6573] truncate max-w-sm mt-0.5">
                            "{note?.title || "Note"}"
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto space-y-5">
                    {loading ? (
                        <div className="space-y-3 animate-pulse py-4">
                            <div className="h-10 bg-slate-100 rounded"></div>
                            <div className="h-16 bg-slate-100 rounded"></div>
                        </div>
                    ) : (
                        <>
                            {/* Share Add Form */}
                            <form onSubmit={handleAddShare} className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                                <h4 className="text-xs font-semibold uppercase text-slate-600 tracking-wider">
                                    Invite New Collaborator
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {/* Type Toggle */}
                                    <div className="flex rounded-md border border-slate-300 bg-white overflow-hidden p-0.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShareTargetType("user");
                                                if (availableUsers.length > 0) setSelectedTargetId(availableUsers[0].id);
                                            }}
                                            className={`flex-1 py-1 text-xs font-medium rounded ${
                                                shareTargetType === "user"
                                                    ? "bg-[#17365D] text-white"
                                                    : "text-slate-600 hover:bg-slate-50"
                                            }`}
                                        >
                                            User
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShareTargetType("group");
                                                if (availableGroups.length > 0) setSelectedTargetId(availableGroups[0].id);
                                            }}
                                            className={`flex-1 py-1 text-xs font-medium rounded ${
                                                shareTargetType === "group"
                                                    ? "bg-[#17365D] text-white"
                                                    : "text-slate-600 hover:bg-slate-50"
                                            }`}
                                        >
                                            Group
                                        </button>
                                    </div>

                                    {/* Select User or Group */}
                                    <select
                                        value={selectedTargetId}
                                        onChange={(e) => setSelectedTargetId(e.target.value)}
                                        className="sm:col-span-2 text-xs p-2 rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#2878C7]"
                                    >
                                        {shareTargetType === "user" ? (
                                            availableUsers.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.name} ({u.email})
                                                </option>
                                            ))
                                        ) : (
                                            availableGroups.map((g) => (
                                                <option key={g.id} value={g.id}>
                                                    Team / Group: {g.type_name}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {/* Permission dropdown */}
                                    <select
                                        value={permission}
                                        onChange={(e) => setPermission(e.target.value)}
                                        className="text-xs p-2 rounded-md border border-slate-300 bg-white font-medium text-slate-800"
                                    >
                                        <option value="view">Can View (Read-only)</option>
                                        <option value="comment">Can Comment</option>
                                        <option value="edit">Can Edit</option>
                                    </select>

                                    {/* Optional Expiry */}
                                    <input
                                        type="date"
                                        value={expiresAt}
                                        onChange={(e) => setExpiresAt(e.target.value)}
                                        title="Optional Expiry Date"
                                        placeholder="No Expiration"
                                        className="text-xs p-2 rounded-md border border-slate-300 bg-white text-slate-600"
                                    />

                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="text-xs font-semibold py-2 px-4 rounded-md bg-[#2878C7] hover:bg-[#1e63a8] text-white shadow-xs transition-colors disabled:opacity-50"
                                    >
                                        {submitting ? "Inviting..." : "Share Note"}
                                    </button>
                                </div>
                            </form>

                            {/* Collaborator List */}
                            <div>
                                <h4 className="text-xs font-semibold uppercase text-slate-500 tracking-wider mb-2">
                                    Who Has Access
                                </h4>

                                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                                    {/* Note Owner Row */}
                                    <div className="flex items-center justify-between p-3 bg-white">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-full bg-[#17365D] text-white flex items-center justify-center font-bold text-xs uppercase">
                                                {note?.owner_name?.[0] || "U"}
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-[#17212F] flex items-center gap-1.5">
                                                    {note?.owner_name}
                                                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-normal">
                                                        Owner
                                                    </span>
                                                </p>
                                                <p className="text-[11px] text-[#5B6573]">{note?.owner_email}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-medium text-slate-400">Full Access</span>
                                    </div>

                                    {/* Active Shares List */}
                                    {shares.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-slate-400 italic bg-white">
                                            This note is private. Only you can view or edit it.
                                        </div>
                                    ) : (
                                        shares.map((s) => {
                                            const displayName = s.user_name || `Group: ${s.group_name}`;
                                            const subText = s.user_email || "All members in group";

                                            return (
                                                <div key={s.id} className="flex items-center justify-between p-3 bg-white hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-center gap-2.5 truncate mr-2">
                                                        <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                                                            {displayName[0]}
                                                        </div>
                                                        <div className="truncate">
                                                            <p className="text-xs font-medium text-[#17212F] truncate">
                                                                {displayName}
                                                            </p>
                                                            <p className="text-[11px] text-[#5B6573] truncate">
                                                                {subText}
                                                                {s.expires_at && ` • Expires ${new Date(s.expires_at).toLocaleDateString()}`}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <select
                                                            value={s.permission}
                                                            onChange={(e) => handleUpdatePermission(s, e.target.value)}
                                                            className="text-xs py-1 px-2 rounded border border-slate-200 bg-white font-medium text-slate-700"
                                                        >
                                                            <option value="view">Can View</option>
                                                            <option value="comment">Can Comment</option>
                                                            <option value="edit">Can Edit</option>
                                                        </select>

                                                        {/* Revoke Immediately Button */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRevoke(s.id, displayName)}
                                                            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors font-medium"
                                                        >
                                                            Revoke
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#17365D] hover:bg-[#102642] text-white transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
