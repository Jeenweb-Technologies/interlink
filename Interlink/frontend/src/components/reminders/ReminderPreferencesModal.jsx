import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getReminderPreferences, updateReminderPreferences } from "../../api/reminderApi";

export default function ReminderPreferencesModal({
    isOpen,
    onClose
}) {
    const [prefs, setPrefs] = useState({
        channel_in_app: true,
        channel_push: true,
        channel_email: true,
        notify_tasks: { in_app: true, push: true, email: false },
        notify_projects: { in_app: true, push: false, email: true },
        notify_approvals: { in_app: true, push: true, email: true },
        notify_meetings: { in_app: true, push: true, email: false },
        notify_personal: { in_app: true, push: true, email: false },
        quiet_hours_enabled: false,
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
        timezone: "UTC"
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        setLoading(true);
        getReminderPreferences()
            .then((res) => {
                if (res.data?.success && res.data.data) {
                    const data = res.data.data;
                    setPrefs({
                        channel_in_app: Boolean(data.channel_in_app),
                        channel_push: Boolean(data.channel_push),
                        channel_email: Boolean(data.channel_email),
                        notify_tasks: data.notify_tasks || { in_app: true, push: true, email: false },
                        notify_projects: data.notify_projects || { in_app: true, push: false, email: true },
                        notify_approvals: data.notify_approvals || { in_app: true, push: true, email: true },
                        notify_meetings: data.notify_meetings || { in_app: true, push: true, email: false },
                        notify_personal: data.notify_personal || { in_app: true, push: true, email: false },
                        quiet_hours_enabled: Boolean(data.quiet_hours_enabled),
                        quiet_hours_start: (data.quiet_hours_start || "22:00:00").slice(0, 5),
                        quiet_hours_end: (data.quiet_hours_end || "08:00:00").slice(0, 5),
                        timezone: data.timezone || "UTC"
                    });
                }
            })
            .catch((err) => {
                console.error("Failed to load preferences:", err);
            })
            .finally(() => setLoading(false));
    }, [isOpen]);

    if (!isOpen) return null;

    const handleCategoryToggle = (categoryKey, channelKey) => {
        setPrefs(prev => ({
            ...prev,
            [categoryKey]: {
                ...prev[categoryKey],
                [channelKey]: !prev[categoryKey]?.[channelKey]
            }
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await updateReminderPreferences(prefs);
            toast.success("Notification preferences saved!");
            onClose();
        } catch (err) {
            toast.error("Failed to save preferences");
        } finally {
            setSaving(false);
        }
    };

    const categories = [
        { key: "notify_tasks", label: "Tasks & Deadlines", icon: "fa-solid fa-list-check text-emerald-500" },
        { key: "notify_projects", label: "Projects & Milestones", icon: "fa-solid fa-diagram-project text-indigo-500" },
        { key: "notify_approvals", label: "Timesheet & Item Approvals", icon: "fa-solid fa-stamp text-amber-500" },
        { key: "notify_meetings", label: "Scheduled Meetings", icon: "fa-solid fa-video text-teal-500" },
        { key: "notify_personal", label: "Personal Reminders", icon: "fa-solid fa-bell text-pink-500" }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2.5">
                        <i className="fa-solid fa-sliders text-blue-600"></i>
                        <h2 className="text-base font-bold text-[#17212F]">
                            Notification &amp; Reminder Preferences
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Master Channel Toggles */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                            Global Delivery Channels
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                    <i className="fa-solid fa-bell text-blue-500"></i> In-App Alerts
                                </span>
                                <input
                                    type="checkbox"
                                    checked={prefs.channel_in_app}
                                    onChange={(e) => setPrefs({ ...prefs, channel_in_app: e.target.checked })}
                                    className="rounded-sm text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                    <i className="fa-solid fa-mobile-screen text-indigo-500"></i> Web Push
                                </span>
                                <input
                                    type="checkbox"
                                    checked={prefs.channel_push}
                                    onChange={(e) => setPrefs({ ...prefs, channel_push: e.target.checked })}
                                    className="rounded-sm text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                            </label>

                            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                    <i className="fa-regular fa-envelope text-purple-500"></i> Email Digest
                                </span>
                                <input
                                    type="checkbox"
                                    checked={prefs.channel_email}
                                    onChange={(e) => setPrefs({ ...prefs, channel_email: e.target.checked })}
                                    className="rounded-sm text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Category × Channel Matrix */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                            Category Delivery Matrix
                        </h3>
                        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="py-2.5 px-4">Event Category</th>
                                        <th className="py-2.5 px-4 text-center">In-App</th>
                                        <th className="py-2.5 px-4 text-center">Push</th>
                                        <th className="py-2.5 px-4 text-center">Email</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {categories.map((cat) => (
                                        <tr key={cat.key} className="hover:bg-slate-50/50">
                                            <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2.5">
                                                <i className={cat.icon}></i>
                                                <span>{cat.label}</span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={prefs[cat.key]?.in_app ?? true}
                                                    onChange={() => handleCategoryToggle(cat.key, "in_app")}
                                                    className="rounded-sm text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                />
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={prefs[cat.key]?.push ?? false}
                                                    onChange={() => handleCategoryToggle(cat.key, "push")}
                                                    className="rounded-sm text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                />
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={prefs[cat.key]?.email ?? false}
                                                    onChange={() => handleCategoryToggle(cat.key, "email")}
                                                    className="rounded-sm text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Quiet Hours (Do Not Disturb) */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                                    Quiet Hours (Do Not Disturb)
                                </span>
                                <span className="text-[11px] text-slate-500">
                                    Silence non-urgent notifications during off-work hours.
                                </span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={prefs.quiet_hours_enabled}
                                    onChange={(e) => setPrefs({ ...prefs, quiet_hours_enabled: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>

                        {prefs.quiet_hours_enabled && (
                            <div className="pt-2 grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Mute From</label>
                                    <input
                                        type="time"
                                        value={prefs.quiet_hours_start}
                                        onChange={(e) => setPrefs({ ...prefs, quiet_hours_start: e.target.value })}
                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Resume At</label>
                                    <input
                                        type="time"
                                        value={prefs.quiet_hours_end}
                                        onChange={(e) => setPrefs({ ...prefs, quiet_hours_end: e.target.value })}
                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2 bg-[#17365D] hover:bg-[#102642] text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                        {saving ? "Saving..." : "Save Preferences"}
                    </button>
                </div>
            </div>
        </div>
    );
}
