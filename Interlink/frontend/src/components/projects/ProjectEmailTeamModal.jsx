import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getProjectMembers, emailProjectMembers } from "../../api/projectApi";

export default function ProjectEmailTeamModal({ project, isOpen, onClose }) {
    const [subject, setSubject] = useState("");
    const [message, setMessage] = useState("");
    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(true);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        if (isOpen && project?.id) {
            setSubject(`Update on ${project.name} (${project.code || 'PRJ'})`);
            setMessage("");
            loadMembers();
        }
    }, [isOpen, project]);

    const loadMembers = async () => {
        try {
            setLoadingMembers(true);
            const res = await getProjectMembers(project.id);
            if (res.data?.success) {
                setMembers(res.data.data || []);
            }
        } catch (err) {
            console.error("Failed to load project members:", err);
            toast.error("Could not fetch enrolled project members.");
        } finally {
            setLoadingMembers(false);
        }
    };

    if (!isOpen || !project) return null;

    const validEmailMembers = members.filter(m => m.email && m.email.trim() !== "");

    const handleSend = async (e) => {
        e.preventDefault();
        if (!message.trim()) {
            toast.error("Please enter a message to send to the team.");
            return;
        }

        if (validEmailMembers.length === 0) {
            toast.error("No enrolled members have an email address configured.");
            return;
        }

        try {
            setSending(true);
            const res = await emailProjectMembers(project.id, {
                subject: subject.trim(),
                message: message.trim()
            });

            if (res.data?.success) {
                toast.success(res.data.message || `Dispatched to ${res.data.sentCount} members!`);
                onClose();
            } else {
                toast.error(res.data?.message || "Failed to dispatch email.");
            }
        } catch (err) {
            console.error("Error sending project email:", err);
            toast.error(err.response?.data?.message || "Failed to send email to enrolled members.");
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-sm">
                            <i className="fa-solid fa-paper-plane"></i>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-800">Email Enrolled Team Members</h3>
                            <p className="text-xs text-slate-500 font-mono">{project.code} • {project.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1"
                    >
                        <i className="fa-solid fa-xmark text-base"></i>
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSend} className="p-6 space-y-4 overflow-y-auto flex-1">
                    {/* Enrolled Recipients Pill Banner */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
                            <span>Enrolled Members ({validEmailMembers.length} with email):</span>
                            {loadingMembers && <span className="text-sky-600 animate-pulse text-[11px]">Loading...</span>}
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                            {validEmailMembers.length > 0 ? (
                                validEmailMembers.map((m) => (
                                    <span
                                        key={m.id || m.user_id}
                                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white text-slate-700 border border-slate-200 shadow-xs"
                                        title={m.email}
                                    >
                                        <i className="fa-solid fa-user text-[10px] text-sky-500"></i>
                                        <span>{m.name}</span>
                                        <span className="text-[10px] text-slate-400">({m.email})</span>
                                    </span>
                                ))
                            ) : (
                                !loadingMembers && (
                                    <p className="text-xs text-amber-600">
                                        ⚠️ No members are enrolled with email addresses in this project.
                                    </p>
                                )
                            )}
                        </div>
                    </div>

                    {/* Subject Field */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Email Subject
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            required
                            placeholder="e.g. Project Sprint Update"
                            className="w-full px-3.5 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                        />
                    </div>

                    {/* Message Body Field */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Message to Team
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            required
                            rows={5}
                            placeholder="Type the message or announcement to broadcast to all team members enrolled in this project..."
                            className="w-full px-3.5 py-2 text-xs text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 resize-none leading-relaxed"
                        />
                    </div>

                    <p className="text-[11px] text-slate-400">
                        Emails are sent from <strong className="text-slate-600 font-mono">interlinknoreply@gmail.com</strong> with direct links to this project.
                    </p>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={sending || validEmailMembers.length === 0}
                            className="px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-2"
                        >
                            {sending ? (
                                <>
                                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-paper-plane text-xs"></i>
                                    <span>Send Email ({validEmailMembers.length})</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
