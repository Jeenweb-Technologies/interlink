import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { startDirectChat, searchCoworkers } from "../../api/chatApi";

const getInitials = (str) => {
    if (!str) return "U";
    const cleaned = str.replace(/^[#@\s]+/, "").trim();
    if (!cleaned) return "U";
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return cleaned.substring(0, 2).toUpperCase();
};

export default function NewChatModal({ onClose, onChatStarted }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchUsers = async () => {
            try {
                setIsLoading(true);
                const res = await searchCoworkers(searchTerm);
                if (isMounted) {
                    const list = res?.coworkers || res?.data || (Array.isArray(res) ? res : []);
                    setSearchResults(Array.isArray(list) ? list : []);
                }
            } catch (error) {
                console.error("Failed to search coworkers:", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        const timeout = setTimeout(fetchUsers, 250);
        return () => {
            isMounted = false;
            clearTimeout(timeout);
        };
    }, [searchTerm]);

    const handleSelectUser = async (targetUser) => {
        try {
            setIsSubmitting(true);
            const res = await startDirectChat(targetUser.id);
            toast.success(`Chat started with ${targetUser.name || targetUser.username}`);
            if (onChatStarted) {
                onChatStarted(res.data);
            }
            onClose();
        } catch (error) {
            console.error("Failed to start direct chat:", error);
            toast.error(error.response?.data?.message || "Failed to start direct chat");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#2D333B] text-[#ED1C28] border border-slate-700/60 flex items-center justify-center font-medium text-xs shadow-2xs">
                            <i className="fa-solid fa-user-plus"></i>
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800 text-sm">New Direct Chat</h3>
                            <p className="text-[10px] text-slate-400 font-normal">Start 1-on-1 discussion</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg hover:bg-slate-200/80 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                    >
                        <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>

                <div className="p-4 sm:p-5">
                    <label className="block text-[11px] font-medium text-slate-600 uppercase tracking-wide mb-1.5">
                        Find Coworker
                    </label>
                    <div className="relative mb-2.5">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input
                            type="text"
                            placeholder="Type name, email, or mobile number..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            autoFocus
                            className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-[13px] focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#ED1C28]/20 focus:border-[#ED1C28] transition-all font-normal placeholder:text-slate-400"
                        />
                    </div>
                    <p className="text-[10px] text-slate-400 mb-3 font-normal">
                        Search coworkers by their full name, guidance email handle, or phone number.
                    </p>

                    <div className="max-h-64 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100 custom-chat-scrollbar">
                        {isLoading ? (
                            <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                                <i className="fa-solid fa-circle-notch fa-spin text-[#ED1C28]"></i>
                                <span>Searching coworkers...</span>
                            </div>
                        ) : searchResults.length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-400 font-normal">No coworkers found</div>
                        ) : (
                            searchResults.map((u) => (
                                <div
                                    key={u.id}
                                    onClick={() => !isSubmitting && handleSelectUser(u)}
                                    className="p-2.5 flex items-center justify-between hover:bg-slate-50/80 cursor-pointer transition-all group"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-[#333842] text-slate-100 border border-slate-600/40 flex items-center justify-center font-medium text-xs shadow-2xs group-hover:scale-105 transition-transform">
                                            {getInitials(u.name || u.username || "U")}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-xs font-medium text-slate-800 group-hover:text-slate-900 transition-colors">
                                                    {u.name || u.username}
                                                </p>
                                                {u.company_name && (
                                                    <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[8px] font-medium flex items-center gap-1">
                                                        <i className="fa-solid fa-city text-[8px] text-purple-400"></i>
                                                        {u.company_name}
                                                    </span>
                                                )}
                                                {u.department_names && (
                                                    <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[8px] font-medium flex items-center gap-1">
                                                        <i className="fa-solid fa-building text-[8px] text-slate-400"></i>
                                                        {u.department_names}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-normal">
                                                {u.email} {u.mob_no ? <span className="text-slate-300 mx-0.5">&bull;</span> : ''}{u.mob_no || ''}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-medium text-[#ED1C28] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                        Chat <i className="fa-solid fa-arrow-right text-[9px]"></i>
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200/70 text-xs font-medium transition-colors cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
