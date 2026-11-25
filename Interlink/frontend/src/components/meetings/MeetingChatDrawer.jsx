import React, { useState, useEffect, useRef } from "react";

export default function MeetingChatDrawer({
    isOpen,
    onClose,
    messages = [],
    onSendMessage,
    canChat = true,
    currentUser
}) {
    const [text, setText] = useState("");
    const bottomRef = useRef(null);

    useEffect(() => {
        if (isOpen && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    if (!isOpen) return null;

    const handleSend = (e) => {
        e.preventDefault();
        if (!text.trim() || !canChat) return;

        onSendMessage(text.trim());
        setText("");
    };

    return (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col text-white animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950/80">
                <div className="flex items-center gap-2">
                    <i className="fa-solid fa-comments text-cyan-400"></i>
                    <h2 className="text-sm font-bold text-white">In-Meeting Chat</h2>
                </div>
                <button
                    onClick={onClose}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                    <i className="fa-solid fa-xmark text-sm"></i>
                </button>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 text-xs">
                        <i className="fa-regular fa-comment-dots text-3xl mb-2 text-slate-600"></i>
                        <span>No messages yet. Say hello to the room!</span>
                    </div>
                ) : (
                    messages.map((m, idx) => {
                        const isMe = m.senderId === (currentUser?.id || currentUser?.identity);
                        return (
                            <div
                                key={idx}
                                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                            >
                                <div className="flex items-center gap-1.5 mb-0.5 text-[10px] text-slate-400">
                                    <span className="font-semibold text-slate-300">
                                        {isMe ? "You" : m.senderName || "Participant"}
                                    </span>
                                    <span>
                                        {m.timestamp
                                            ? new Date(m.timestamp).toLocaleTimeString([], {
                                                  hour: "2-digit",
                                                  minute: "2-digit"
                                              })
                                            : ""}
                                    </span>
                                </div>
                                <div
                                    className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed ${
                                        isMe
                                            ? "bg-blue-600 text-white rounded-tr-xs"
                                            : "bg-slate-800 text-slate-200 rounded-tl-xs border border-white/5"
                                    }`}
                                >
                                    {m.text}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input Box */}
            <form onSubmit={handleSend} className="p-3 border-t border-white/10 bg-slate-950/80">
                {!canChat ? (
                    <div className="text-center text-xs text-rose-400 py-2">
                        Chat has been disabled by the meeting host.
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Type a message..."
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={!text.trim()}
                            className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <i className="fa-solid fa-paper-plane text-xs"></i>
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
