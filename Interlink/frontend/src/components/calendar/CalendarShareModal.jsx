import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getCalendarShares, addCalendarShare, removeCalendarShare } from "../../api/calendarApi";

export default function CalendarShareModal({
    isOpen,
    onClose,
    calendar = null
}) {
    const [shares, setShares] = useState([]);
    const [loading, setLoading] = useState(true);
    const [targetUserId, setTargetUserId] = useState("");
    const [permissionLevel, setPermissionLevel] = useState("free_busy_only");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen || !calendar) return;

        setLoading(true);
        getCalendarShares(calendar.id)
            .then((res) => {
                if (res.data?.success) {
                    setShares(res.data.data || []);
                }
            })
            .catch((err) => {
                console.error("Failed to load shares:", err);
            })
            .finally(() => setLoading(false));
    }, [isOpen, calendar]);

    if (!isOpen || !calendar) return null;

    const handleAddShare = async (e) => {
        e.preventDefault();
        if (!targetUserId) {
            toast.error("Please enter a user ID");
            return;
        }

        setSubmitting(true);
        try {
            await addCalendarShare(calendar.id, {
                sharedWithUserId: parseInt(targetUserId, 10),
                permissionLevel
            });
            toast.success("Calendar share added!");
            setTargetUserId("");
            // Refresh list
            const res = await getCalendarShares(calendar.id);
            setShares(res.data?.data || []);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to share calendar");
        } finally {
            setSubmitting(false);
        }
    };

    const handleRevoke = async (shareId) => {
        try {
            await removeCalendarShare(calendar.id, shareId);
            toast.success("Share permission removed");
            setShares(shares.filter(s => s.id !== shareId));
        } catch (err) {
            toast.error("Failed to revoke share");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <i className="fa-solid fa-share-nodes text-blue-600"></i>
                        <h2 className="text-base font-bold text-[#17212F]">
                            Share Calendar: {calendar.name}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Permission explanations */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                        <p><strong>Free/Busy Only:</strong> Collaborators only see when you are occupied; event names and agendas stay private.</p>
                        <p><strong>View Details:</strong> Can see titles, agendas, and attendees.</p>
                        <p><strong>Edit:</strong> Can add, modify, and delete events.</p>
                    </div>

                    {/* Add Share Form */}
                    <form onSubmit={handleAddShare} className="space-y-3">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Invite Colleague (User ID)
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                                type="number"
                                value={targetUserId}
                                onChange={(e) => setTargetUserId(e.target.value)}
                                placeholder="User ID"
                                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold"
                                required
                            />
                            <select
                                value={permissionLevel}
                                onChange={(e) => setPermissionLevel(e.target.value)}
                                className="px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                            >
                                <option value="free_busy_only">Free/Busy Only</option>
                                <option value="view_details">View Details</option>
                                <option value="edit">Can Edit</option>
                                <option value="admin">Full Admin</option>
                            </select>
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
                            >
                                {submitting ? "Sharing..." : "Share"}
                            </button>
                        </div>
                    </form>

                    {/* Current Shares List */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Shared With ({shares.length})
                        </h3>

                        {loading ? (
                            <div className="space-y-2 animate-pulse">
                                <div className="h-10 bg-slate-100 rounded-xl"></div>
                                <div className="h-10 bg-slate-100 rounded-xl"></div>
                            </div>
                        ) : shares.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2">
                                Not shared with anyone yet. This calendar is private.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {shares.map((s) => (
                                    <div
                                        key={s.id}
                                        className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                                    >
                                        <div>
                                            <p className="font-bold text-slate-800">{s.user_name || `User #${s.shared_with_user_id}`}</p>
                                            <p className="text-[11px] text-slate-500">{s.permission_level.replace('_', ' ')}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRevoke(s.id)}
                                            className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                        >
                                            Revoke
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
