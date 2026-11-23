import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import ChatSidebar from "../../components/chat/ChatSidebar";
import ChatArea from "../../components/chat/ChatArea";
import ConversationDetailsPanel from "../../components/chat/ConversationDetailsPanel";
import CreateGroupModal from "../../components/chat/CreateGroupModal";
import NewChatModal from "../../components/chat/NewChatModal";
import FileViewerModal from "../../components/chat/FileViewerModal";
import { getSocket } from "../../utils/socket";
import { usePermission } from "../../context/PermissionContext";
import {
    getConversations,
    getConversationMessages,
    sendChatMessage,
    getOnlineUsers
} from "../../api/chatApi";
import { isUserAdmin } from "../../utils/roleUtils";

const getMessageSnippet = (msg) => {
    if (!msg) return "";
    if (msg.is_deleted) return "This message was deleted";
    if (msg.message_type === "CALL") {
        let cd = msg.call_details;
        if (!cd) {
            try {
                cd = JSON.parse(msg.content || msg.message_text || "{}");
            } catch {}
        }
        if (cd?.text) return cd.text;
        const isVid = cd?.callType === "video";
        if (cd?.status === "missed" || cd?.status === "declined") {
            return isVid ? "📹 Missed video call" : "📞 Missed voice call";
        }
        return isVid ? "📹 Video call" : "📞 Voice call";
    }
    if (msg.message_text && msg.message_text.trim() && !msg.message_text.startsWith('{"type":"call_log"')) return msg.message_text.trim();
    if (msg.content && msg.content.trim() && !msg.content.startsWith('{"type":"call_log"')) return msg.content.trim();

    // Check attachments - always show 📎 Attachment
    const attList = Array.isArray(msg.attachments) ? msg.attachments : [];
    if (
        attList.length > 0 ||
        msg.attachmentId ||
        msg.file_name ||
        msg.file_url ||
        msg.file_path ||
        msg.original_name ||
        msg.message_type === "FILE" ||
        msg.message_type === "IMAGE" ||
        msg.message_type === "VIDEO"
    ) {
        return "📎 Attachment";
    }

    if (msg.poll || msg.poll_id) {
        return "📊 Poll";
    }
    return "Message";
};

export default function ChatApp() {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const { hasPermission } = usePermission();

    const isAdmin = isUserAdmin(user);

    // Permission flags (admins have full access by default)
    const permissions = {
        canChat: isAdmin || hasPermission("chat", "write"),
        canCamera: isAdmin || hasPermission("camera_access", "write") || hasPermission("camera_access", "read"),
        canView: isAdmin || hasPermission("document_view", "read"),
        canUpload: isAdmin || hasPermission("document_upload", "write"),
        canDownload: (isAdmin || hasPermission("document_download", "read")) && user?.device_allow_download !== false,
        canGroup: isAdmin || hasPermission("group_create", "write")
    };

    // Ensure bright light theme globally
    useEffect(() => {
        document.documentElement.classList.remove("dark");
        document.body.classList.remove("dark");
        localStorage.removeItem("chat_theme");
        localStorage.removeItem("theme");
    }, []);

    const [conversations, setConversations] = useState([]);
    const [isLoadingConvs, setIsLoadingConvs] = useState(false);
    const [activeConversation, setActiveConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [onlineUserIds, setOnlineUserIds] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);

    // Modals
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);
    const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
    const [viewingFile, setViewingFile] = useState(null);

    // Mobile view toggle
    const [showMobileChat, setShowMobileChat] = useState(false);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const activeConvRef = useRef(activeConversation);
    const selectActiveConversation = (conv) => {
        activeConvRef.current = conv;
        setActiveConversation(conv);
    };

    useEffect(() => {
        activeConvRef.current = activeConversation;
    }, [activeConversation]);

    // Load user conversations (auto-select #activity by default)
    const loadConversations = useCallback(async (selectFirst = false) => {
        try {
            setIsLoadingConvs(true);
            const res = await getConversations();
            const convList = res?.conversations || res?.data || (Array.isArray(res) ? res : []);
            const validList = Array.isArray(convList) ? convList : [];
            setConversations(validList);

            if (selectFirst && validList.length > 0 && !activeConvRef.current) {
                // Find #activity default channel first, otherwise pick first item
                const activityConv = validList.find(c => Boolean(c.is_activity) || c.title === "#activity" || c.title === "# activity");
                selectActiveConversation(activityConv || validList[0]);
            }
        } catch (error) {
            console.error("Failed to load conversations:", error);
        } finally {
            setIsLoadingConvs(false);
        }
    }, []);

    // Initial load
    useEffect(() => {
        loadConversations(true);
    }, [loadConversations]);

    // Socket listeners setup
    useEffect(() => {
        const socket = getSocket();

        if (user?.id) {
            socket.emit("user:online", String(user.id));
        }
        // Request current online list immediately
        socket.emit("users:get_online");

        socket.on("users:online", (onlineList) => {
            setOnlineUserIds((onlineList || []).map((id) => String(id)));
        });

        socket.on("message:new", (msg) => {
            const msgConvId = Number(msg.conversation_id || msg.conversationId || msg.conversation?.id);
            const activeId = Number(activeConvRef.current?.id);

            if (activeConvRef.current && msgConvId && activeId && msgConvId === activeId) {
                const normalizedMsg = {
                    ...msg,
                    content: msg.content || msg.message_text || "",
                    message_text: msg.message_text || msg.content || ""
                };

                setMessages((prev) => {
                    // Skip if exact ID already exists (real message from self via socket de-dup)
                    if (prev.some((m) => !m.is_optimistic && Number(m.id) === Number(normalizedMsg.id))) return prev;
                    // Remove any optimistic message that matches this real message
                    const withoutOptimistic = prev.filter(
                        (m) => !(m.is_optimistic &&
                            String(m.sender_id) === String(normalizedMsg.sender_id) &&
                            (m.content || "") === (normalizedMsg.content || ""))
                    );
                    return [...withoutOptimistic, normalizedMsg];
                });
            }

            const snippet = getMessageSnippet(msg);

            // Update conversation snippet in list or load if missing
            setConversations((prev) => {
                const exists = prev.some((c) => Number(c.id) === msgConvId);
                if (!exists) {
                    loadConversations(false);
                    return prev;
                }

                const updated = prev.map((c) => {
                    if (Number(c.id) === msgConvId) {
                        return {
                            ...c,
                            last_message: snippet,
                            last_message_text: snippet,
                            last_message_at: msg.created_at || new Date().toISOString(),
                            unread_count:
                                activeId === msgConvId
                                    ? 0
                                    : (Number(c.unread_count) || 0) + 1
                        };
                    }
                    return c;
                });

                return updated.sort((a, b) => {
                    // Always keep #activity at top, followed by is_master
                    if (a.is_activity || a.title === "#activity") return -1;
                    if (b.is_activity || b.title === "#activity") return 1;
                    if (a.is_master) return -1;
                    if (b.is_master) return 1;
                    return new Date(b.last_message_at || b.created_at || 0) - new Date(a.last_message_at || a.created_at || 0);
                });
            });
        });

        socket.on("conversation:new", () => {
            loadConversations(false);
        });

        socket.on("typing:start", ({ conversationId, userName, userId }) => {
            setTypingUsers((prev) => {
                if (prev.some((t) => t.userId === userId && t.conversationId === conversationId)) return prev;
                return [...prev, { conversationId, userName, userId }];
            });
        });

        socket.on("typing:stop", ({ conversationId, userId }) => {
            setTypingUsers((prev) =>
                prev.filter((t) => !(t.userId === userId && t.conversationId === conversationId))
            );
        });

        socket.on("conversation:deleted", ({ conversationId }) => {
            setConversations((prev) => prev.filter((c) => Number(c.id) !== Number(conversationId)));
            if (activeConvRef.current && Number(activeConvRef.current.id) === Number(conversationId)) {
                setActiveConversation(null);
                toast("This conversation was deleted.", { icon: "ℹ️" });
            }
        });

        socket.on("message:deleted", ({ messageId, conversationId, deleteType, lastMessageText, lastMessageAt }) => {
            setMessages((prev) =>
                prev.map((m) =>
                    Number(m.id) === Number(messageId)
                        ? {
                              ...m,
                              is_deleted: true,
                              content: "This message was deleted",
                              message_text: "This message was deleted",
                              attachments: [],
                              attachmentId: null,
                              file_name: null,
                              file_type: null,
                              file_size: null,
                              reply_to_text: null
                          }
                        : m
                )
            );

            // Update conversation list snippet if provided
            if (conversationId) {
                const updatedSnippet = lastMessageText !== undefined ? lastMessageText : "This message was deleted";
                setConversations((prev) =>
                    prev.map((c) => {
                        if (Number(c.id) === Number(conversationId)) {
                            return {
                                ...c,
                                last_message: updatedSnippet,
                                last_message_text: updatedSnippet,
                                ...(lastMessageAt ? { last_message_at: lastMessageAt } : {})
                            };
                        }
                        return c;
                    })
                );
            }
        });

        // Reconnection handler: re-announce online status and re-join active conversation
        const handleSocketReconnect = () => {
            if (user?.id) {
                socket.emit("user:online", String(user.id));
            }
            socket.emit("users:get_online");
            if (activeConvRef.current?.id) {
                socket.emit("conversation:join", activeConvRef.current.id);
            }
            loadConversations(false);
        };
        window.addEventListener("socket:reconnected", handleSocketReconnect);

        return () => {
            socket.off("users:online");
            socket.off("message:new");
            socket.off("conversation:new");
            socket.off("conversation:deleted");
            socket.off("message:deleted");
            socket.off("typing:start");
            socket.off("typing:stop");
            window.removeEventListener("socket:reconnected", handleSocketReconnect);
        };
    }, [loadConversations, user?.id]);

    // Background sync on window focus and periodic interval
    useEffect(() => {
        const pingPresence = async () => {
            const socket = getSocket();
            if (user?.id) {
                socket.emit("user:online", String(user.id));
            }
            socket.emit("users:get_online");
            try {
                const res = await getOnlineUsers();
                if (res?.onlineUserIds && Array.isArray(res.onlineUserIds)) {
                    setOnlineUserIds(res.onlineUserIds.map(String));
                }
            } catch (_) {}
        };

        const handleFocus = () => {
            loadConversations(false);
            pingPresence();
        };

        window.addEventListener("focus", handleFocus);
        pingPresence();
        const timer = setInterval(() => {
            loadConversations(false);
            pingPresence();
        }, 5000);

        return () => {
            window.removeEventListener("focus", handleFocus);
            clearInterval(timer);
        };
    }, [loadConversations, user?.id]);

    // Active chat real-time fast sync (ensures new messages always appear instantly even if socket drops)
    useEffect(() => {
        const syncActiveChat = async () => {
            const activeId = activeConvRef.current?.id;
            if (!activeId) return;
            try {
                const res = await getConversationMessages(activeId);
                const msgList = res?.messages || res?.data || (Array.isArray(res) ? res : []);
                const fetchedList = Array.isArray(msgList) ? msgList : [];
                if (fetchedList.length === 0) return;

                setMessages((prev) => {
                    if (prev.length === 0) return fetchedList;
                    const prevIds = new Set(prev.map((m) => Number(m.id)));
                    const hasNew = fetchedList.some((m) => !prevIds.has(Number(m.id)));
                    if (!hasNew) return prev;

                    // Merge while keeping pending optimistic messages
                    const optimistic = prev.filter((m) => m.is_optimistic);
                    const fetchedIds = new Set(fetchedList.map((m) => Number(m.id)));
                    const remainingOpt = optimistic.filter(
                        (o) => !fetchedList.some(
                            (f) => String(f.sender_id) === String(o.sender_id) &&
                                   (f.content || f.message_text) === (o.content || o.message_text)
                        )
                    );
                    return [...fetchedList, ...remainingOpt];
                });
            } catch (e) {
                // Background sync silent catch
            }
        };

        const timer = setInterval(syncActiveChat, 2500);
        return () => clearInterval(timer);
    }, []);

    // Join room and load messages when active conversation changes
    useEffect(() => {
        if (!activeConversation) return;

        const socket = getSocket();
        socket.emit("conversation:join", activeConversation.id);

        setMessages([]); // Clear stale messages from prior conversation
        const fetchMessages = async () => {
            try {
                const res = await getConversationMessages(activeConversation.id);
                const msgList = res?.messages || res?.data || (Array.isArray(res) ? res : []);
                const fetchedList = Array.isArray(msgList) ? msgList : [];
                setMessages((prev) => {
                    if (prev.length === 0) return fetchedList;
                    const fetchedIds = new Set(fetchedList.map((m) => Number(m.id)));
                    const newSocketMsgs = prev.filter((m) => !fetchedIds.has(Number(m.id)));
                    return [...fetchedList, ...newSocketMsgs];
                });

                if (res?.joinedAt) {
                    setActiveConversation(prev => prev ? ({ ...prev, joined_at: res.joinedAt }) : prev);
                }

                // Reset unread count locally for this conversation
                setConversations((prev) =>
                    prev.map((c) => (c.id === activeConversation.id ? { ...c, unread_count: 0 } : c))
                );
            } catch (error) {
                console.error("Failed to load messages:", error);
            }
        };

        fetchMessages();

        return () => {
            socket.emit("conversation:leave", activeConversation.id);
        };
    }, [activeConversation?.id]);

    // Handle sending a message — optimistic update for text, direct add for files/images
    const handleSendMessage = async (payload) => {
        const hasFile = Boolean(payload.attachmentId);
        const hasText = Boolean(payload.messageText);

        // Build an optimistic message for text-only messages (instant feedback)
        const optimisticId = `optimistic_${Date.now()}`;
        const optimisticMsg = {
            id: optimisticId,
            conversation_id: payload.conversationId,
            sender_id: user.id,
            sender_name: user.name || user.username || "Me",
            sender_username: user.username,
            content: payload.messageText || "",
            message_text: payload.messageText || "",
            message_type: "TEXT",
            created_at: new Date().toISOString(),
            is_optimistic: true,
        };

        // Only show optimistic placeholder for text-only messages
        if (hasText && !hasFile) {
            setMessages((prev) => [...prev, optimisticMsg]);
        }

        try {
            const result = await sendChatMessage(payload);
            const realMsg = result?.data || result?.message;

            if (realMsg && realMsg.id) {
                const normalizedMsg = {
                    ...realMsg,
                    message_text: realMsg.content || realMsg.message_text || "",
                };

                setMessages((prev) => {
                    // Remove the optimistic placeholder if it exists
                    const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
                    // Don't add duplicate if socket already delivered it
                    if (withoutOptimistic.some((m) => !m.is_optimistic && Number(m.id) === Number(realMsg.id))) {
                        return withoutOptimistic;
                    }
                    // Add the real message (covers text after optimistic removal AND file/image uploads)
                    return [...withoutOptimistic, normalizedMsg];
                });

                const snippet = getMessageSnippet(normalizedMsg);

                // Update sidebar snippet instantly
                setConversations((prev) =>
                    prev.map((c) => {
                        if (Number(c.id) === Number(payload.conversationId)) {
                            return {
                                ...c,
                                last_message: snippet,
                                last_message_text: snippet,
                                last_message_at: normalizedMsg.created_at || new Date().toISOString(),
                            };
                        }
                        return c;
                    })
                );
            }
        } catch (err) {
            // Remove optimistic message on failure
            setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
            throw err;
        }
    };

    // Typing triggers
    const handleTypingStart = () => {
        if (!activeConversation) return;
        const socket = getSocket();
        socket.emit("typing:start", {
            conversationId: activeConversation.id,
            userName: user.name || user.username || "Teammate",
            userId: user.id
        });
    };

    const handleTypingStop = () => {
        if (!activeConversation) return;
        const socket = getSocket();
        socket.emit("typing:stop", {
            conversationId: activeConversation.id,
            userName: user.name || user.username,
            userId: user.id
        });
    };

    const handleSelectConversation = (conv) => {
        selectActiveConversation(conv);
        setShowMobileChat(true);
    };

    const handleChatStarted = (newConv) => {
        loadConversations(false);
        selectActiveConversation(newConv);
        setShowMobileChat(true);
    };

    const handleGroupCreated = (newGroup) => {
        loadConversations(false);
        selectActiveConversation(newGroup);
        setShowMobileChat(true);
    };

    const location = useLocation();

    useEffect(() => {
        if (location.state?.targetConversationId && conversations.length > 0) {
            const target = conversations.find(c => Number(c.id) === Number(location.state.targetConversationId));
            if (target) {
                selectActiveConversation(target);
                setShowMobileChat(true);
            }
        }
    }, [location.state, conversations]);

    return (
        <div className="flex flex-col h-[calc(100vh-4.2rem)] bg-[#F6F8FB] overflow-hidden select-text font-sans">
            {/* Chat App Workspace */}
            <div className="flex-1 flex overflow-hidden relative">
                {/* Left Sidebar */}
                <div
                    className={`${showMobileChat ? "hidden md:flex" : "flex"
                        } w-full md:w-72 lg:w-80 shrink-0 h-full`}
                >
                    <ChatSidebar
                        conversations={conversations}
                        activeConversationId={activeConversation?.id}
                        onSelectConversation={handleSelectConversation}
                        onOpenNewChat={() => setIsNewChatOpen(true)}
                        onOpenNewGroup={() => setIsNewGroupOpen(true)}
                        onlineUserIds={onlineUserIds}
                        currentUserId={user.id}
                        canCreateGroup={permissions.canGroup}
                    />
                </div>

                {/* Right / Main Chat Area */}
                <div
                    className={`${showMobileChat ? "flex" : "hidden md:flex"
                        } flex-1 h-full overflow-hidden bg-white relative flex-row`}
                >
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        {/* Mobile Back Button */}
                        {showMobileChat && (
                            <div className="md:hidden px-4 py-2 bg-white border-b border-[#E2E8F0] flex items-center justify-between shrink-0 shadow-2xs">
                                <button
                                    onClick={() => setShowMobileChat(false)}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 text-[#17212F] text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                >
                                    <i className="fa-solid fa-arrow-left text-[11px]"></i> Groups
                                </button>
                                <span className="text-xs font-semibold text-[#17212F] truncate max-w-[180px]">
                                    {activeConversation?.displayTitle || activeConversation?.title || "Chat"}
                                </span>
                            </div>
                        )}

                        <ChatArea
                            conversation={activeConversation}
                            messages={messages}
                            currentUserId={user.id}
                            isAdmin={isAdmin}
                            onSendMessage={handleSendMessage}
                            onViewFile={(file) => setViewingFile(file)}
                            onDeleteGroup={(convId) => {
                                setConversations((prev) => prev.filter((c) => Number(c.id) !== Number(convId)));
                                if (activeConversation?.id === convId) {
                                    setActiveConversation(null);
                                }
                            }}
                            onlineUserIds={onlineUserIds}
                            typingUsers={typingUsers}
                            onTypingStart={handleTypingStart}
                            onTypingStop={handleTypingStop}
                            permissions={permissions}
                            onToggleDetails={() => setIsDetailsOpen(!isDetailsOpen)}
                            isDetailsOpen={isDetailsOpen}
                            onDeleteMessage={(messageId, deleteType, respData) => {
                                if (deleteType === "FOR_ME") {
                                    setMessages((prev) => prev.filter((m) => Number(m.id) !== Number(messageId)));
                                } else {
                                    setMessages((prev) =>
                                        prev.map((m) =>
                                            Number(m.id) === Number(messageId)
                                                ? {
                                                      ...m,
                                                      is_deleted: true,
                                                      content: "This message was deleted",
                                                      message_text: "This message was deleted",
                                                      attachments: [],
                                                      attachmentId: null,
                                                      file_name: null,
                                                      file_type: null,
                                                      file_size: null,
                                                      reply_to_text: null
                                                  }
                                                : m
                                        )
                                    );
                                }

                                if (activeConversation?.id) {
                                    const newSnippet = respData?.lastMessageText !== undefined 
                                        ? respData.lastMessageText 
                                        : (deleteType === "FOR_EVERYONE" ? "This message was deleted" : undefined);

                                    setConversations((prev) =>
                                        prev.map((c) => {
                                            if (Number(c.id) === Number(activeConversation.id)) {
                                                return {
                                                    ...c,
                                                    ...(newSnippet !== undefined ? { last_message: newSnippet, last_message_text: newSnippet } : {}),
                                                    ...(respData?.lastMessageAt ? { last_message_at: respData.lastMessageAt } : {})
                                                };
                                            }
                                            return c;
                                        })
                                    );
                                }
                            }}
                        />
                    </div>

                    {/* Column 3: Conversation Details & Shared Files (CHAT-01 & CHAT-07) */}
                    {isDetailsOpen && activeConversation && (
                        <ConversationDetailsPanel
                            conversation={activeConversation}
                            messages={messages}
                            onClose={() => setIsDetailsOpen(false)}
                            onViewFile={(file) => setViewingFile(file)}
                            currentUserId={user.id}
                            isAdmin={isAdmin}
                            canDownload={permissions.canDownload}
                        />
                    )}
                </div>
            </div>

            {/* Modals */}
            {isNewChatOpen && (
                <NewChatModal
                    onClose={() => setIsNewChatOpen(false)}
                    onChatStarted={handleChatStarted}
                />
            )}

            {isNewGroupOpen && (
                <CreateGroupModal
                    onClose={() => setIsNewGroupOpen(false)}
                    onGroupCreated={handleGroupCreated}
                />
            )}

            {viewingFile && (
                <FileViewerModal
                    file={viewingFile}
                    onClose={() => setViewingFile(null)}
                    canDownload={permissions.canDownload}
                    currentUserName={user.name || user.username || "User"}
                    currentUserId={user.id}
                />
            )}
        </div>
    );
}
