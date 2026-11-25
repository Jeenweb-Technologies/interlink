import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { scheduleMeeting } from "../../api/meetingApi";
import { getProjects } from "../../api/projectApi";
import { getTasks } from "../../api/taskApi";

export default function MeetingSchedulerModal({ isOpen, onClose, onMeetingScheduled }) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [date, setDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split("T")[0];
    });
    const [time, setTime] = useState("10:00");
    const [durationMinutes, setDurationMinutes] = useState(30);

    const [projectId, setProjectId] = useState("");
    const [taskId, setTaskId] = useState("");
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);

    const [isLobbyEnabled, setIsLobbyEnabled] = useState(true);
    const [isRecordingAllowed, setIsRecordingAllowed] = useState(false);
    const [isGuestAllowed, setIsGuestAllowed] = useState(true);
    const [requiresPasscode, setRequiresPasscode] = useState(false);
    const [passcode, setPasscode] = useState("");

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        // Fetch projects for linking
        getProjects()
            .then(res => {
                if (res.data?.success && res.data.projects) {
                    setProjects(res.data.projects);
                }
            })
            .catch(() => {});

        // Fetch tasks
        getTasks()
            .then(res => {
                if (res.data?.success && res.data.tasks) {
                    setTasks(res.data.tasks);
                }
            })
            .catch(() => {});
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("Please enter a meeting title");
            return;
        }

        const scheduledStart = new Date(`${date}T${time}:00`);
        const scheduledEnd = new Date(scheduledStart.getTime() + durationMinutes * 60000);

        setSubmitting(true);
        try {
            const payload = {
                title: title.trim(),
                description: description.trim() || null,
                project_id: projectId ? parseInt(projectId, 10) : null,
                task_id: taskId ? parseInt(taskId, 10) : null,
                scheduled_start: scheduledStart.toISOString(),
                scheduled_end: scheduledEnd.toISOString(),
                is_lobby_enabled: isLobbyEnabled,
                is_recording_allowed: isRecordingAllowed,
                is_guest_allowed: isGuestAllowed,
                passcode: requiresPasscode && passcode.trim() ? passcode.trim() : null
            };

            const res = await scheduleMeeting(payload);
            if (res.data?.success) {
                toast.success("Meeting scheduled successfully!");
                if (onMeetingScheduled) {
                    onMeetingScheduled(res.data.meeting);
                }
                onClose();
            } else {
                toast.error(res.data?.message || "Failed to schedule meeting");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || "Failed to schedule meeting");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-blue-950 text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400">
                            <i className="fa-solid fa-calendar-plus text-lg"></i>
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-white">Schedule Enterprise Meeting</h2>
                            <p className="text-xs text-blue-200/80">Configure room security, project linkage &amp; schedule</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <i className="fa-solid fa-xmark text-base"></i>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                            Meeting Title <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Q4 Sprint Planning & Architecture Review"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm font-medium"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                            Agenda &amp; Context
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Briefly state key topics and desired meeting outcomes..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm"
                        />
                    </div>

                    {/* Date, Time & Duration Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                Date <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="date"
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                Start Time <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="time"
                                required
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                Duration
                            </label>
                            <select
                                value={durationMinutes}
                                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm bg-white"
                            >
                                <option value={15}>15 minutes</option>
                                <option value={30}>30 minutes</option>
                                <option value={45}>45 minutes</option>
                                <option value={60}>1 hour</option>
                                <option value={90}>1.5 hours</option>
                                <option value={120}>2 hours</option>
                            </select>
                        </div>
                    </div>

                    {/* Link to Project & Task */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                Link to Project <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <select
                                value={projectId}
                                onChange={(e) => setProjectId(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm bg-white"
                            >
                                <option value="">-- No linked project --</option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.code ? `[${p.code}] ` : ""}{p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                Link to Task <span className="text-slate-400 font-normal">(Optional)</span>
                            </label>
                            <select
                                value={taskId}
                                onChange={(e) => setTaskId(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-sm bg-white"
                            >
                                <option value="">-- No linked task --</option>
                                {tasks.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.task_name || t.title}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Security & Access Controls */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <i className="fa-solid fa-shield-halved text-blue-600"></i>
                            Security &amp; Room Governance
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-700">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isLobbyEnabled}
                                    onChange={(e) => setIsLobbyEnabled(e.target.checked)}
                                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                />
                                <span>Enable Waiting Room (Lobby)</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isGuestAllowed}
                                    onChange={(e) => setIsGuestAllowed(e.target.checked)}
                                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                />
                                <span>Allow External Guests</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isRecordingAllowed}
                                    onChange={(e) => setIsRecordingAllowed(e.target.checked)}
                                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                />
                                <span>Allow In-Room Recording</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={requiresPasscode}
                                    onChange={(e) => setRequiresPasscode(e.target.checked)}
                                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                />
                                <span>Require Passcode</span>
                            </label>
                        </div>

                        {requiresPasscode && (
                            <div className="pt-2 animate-in fade-in duration-150">
                                <label className="block text-xs font-semibold text-slate-600 mb-1">
                                    Set 4–8 Digit Room Passcode
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. 7482"
                                    value={passcode}
                                    maxLength={8}
                                    onChange={(e) => setPasscode(e.target.value)}
                                    className="w-48 px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-mono tracking-widest"
                                />
                            </div>
                        )}
                    </div>

                    {/* Submit Actions */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                            {submitting ? (
                                <>
                                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                                    <span>Scheduling...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-check"></i>
                                    <span>Schedule Meeting</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
