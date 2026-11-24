import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getMeetingNotes, saveMeetingNotes } from "../../api/meetingApi";

export default function MeetingNotesDrawer({ isOpen, onClose, meetingId, currentUser }) {
    const [notesContent, setNotesContent] = useState("");
    const [actionItems, setActionItems] = useState([]);
    const [newActionItem, setNewActionItem] = useState("");
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !meetingId) return;

        setLoading(true);
        getMeetingNotes(meetingId)
            .then((res) => {
                if (res.data?.success && res.data.notes) {
                    setNotesContent(res.data.notes.notes_content || "");
                    try {
                        const items = typeof res.data.notes.action_items === "string"
                            ? JSON.parse(res.data.notes.action_items)
                            : res.data.notes.action_items || [];
                        setActionItems(items);
                    } catch (e) {
                        setActionItems([]);
                    }
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [isOpen, meetingId]);

    if (!isOpen) return null;

    const handleAddActionItem = (e) => {
        e.preventDefault();
        if (!newActionItem.trim()) return;

        setActionItems([
            ...actionItems,
            { id: Date.now(), text: newActionItem.trim(), completed: false, assignee: currentUser?.name || "Team" }
        ]);
        setNewActionItem("");
    };

    const handleToggleActionItem = (id) => {
        setActionItems(
            actionItems.map((item) =>
                item.id === id ? { ...item, completed: !item.completed } : item
            )
        );
    };

    const handleDeleteActionItem = (id) => {
        setActionItems(actionItems.filter((item) => item.id !== id));
    };

    const handleSave = async () => {
        if (!meetingId) return;
        setSaving(true);
        try {
            const res = await saveMeetingNotes(meetingId, {
                notes_content: notesContent,
                action_items: actionItems
            });
            if (res.data?.success) {
                toast.success("Meeting notes saved!");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save notes");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col text-white animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950/80">
                <div className="flex items-center gap-2">
                    <i className="fa-solid fa-note-sticky text-amber-400"></i>
                    <div>
                        <h2 className="text-sm font-bold text-white">Collaborative Notes</h2>
                        <p className="text-[10px] text-slate-400">Agendas &amp; Action Item Tracking</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-1 cursor-pointer"
                    >
                        {saving ? (
                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                        ) : (
                            <i className="fa-solid fa-floppy-disk"></i>
                        )}
                        <span>Save</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Notes Textarea */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                        Meeting Notes &amp; Minutes
                    </label>
                    <textarea
                        rows={8}
                        placeholder="Document decisions, key talking points, and discussion notes..."
                        value={notesContent}
                        onChange={(e) => setNotesContent(e.target.value)}
                        className="w-full p-3 rounded-xl bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500 leading-relaxed font-sans"
                    />
                </div>

                {/* Action Items Section */}
                <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                            Action Items ({actionItems.filter((i) => !i.completed).length} open)
                        </span>
                    </div>

                    <form onSubmit={handleAddActionItem} className="flex items-center gap-1.5">
                        <input
                            type="text"
                            placeholder="Add action item..."
                            value={newActionItem}
                            onChange={(e) => setNewActionItem(e.target.value)}
                            className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-blue-500"
                        />
                        <button
                            type="submit"
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-xs transition-colors cursor-pointer"
                        >
                            <i className="fa-solid fa-plus"></i>
                        </button>
                    </form>

                    <div className="space-y-1.5">
                        {actionItems.map((item) => (
                            <div
                                key={item.id}
                                className="p-2 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-2 text-xs group"
                            >
                                <label className="flex items-center gap-2 min-w-0 cursor-pointer flex-1">
                                    <input
                                        type="checkbox"
                                        checked={item.completed}
                                        onChange={() => handleToggleActionItem(item.id)}
                                        className="rounded text-amber-500 focus:ring-amber-400"
                                    />
                                    <span
                                        className={`truncate ${
                                            item.completed
                                                ? "line-through text-slate-500"
                                                : "text-slate-200"
                                        }`}
                                    >
                                        {item.text}
                                    </span>
                                </label>
                                <button
                                    onClick={() => handleDeleteActionItem(item.id)}
                                    className="text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <i className="fa-solid fa-trash text-[10px]"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
