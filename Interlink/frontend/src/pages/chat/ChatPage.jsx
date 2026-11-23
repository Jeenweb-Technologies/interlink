import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import {
    getConversations,
    getMessages,
    postChatMessage,
    startDirectChat,
    createChannel,
    markConversationRead,
    toggleReaction,
    getAvailableUsersForChat
} from "../../api/chatApi";
import { getDepartments } from "../../api/departmentApi";

export default function ChatPage() {
    const user = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), []);
    const activeCompanyId = localStorage.getItem("active_company_id") || user.company_id || "1";
    const isAdmin = user.role === "admin" || user.role === "super admin";

    // Conversations & Active Thread State
    const [conversations, setConversations] = useState([]);
    const [selectedConvId, setSelectedConvId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingConversations, setLoadingConversations] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterCategory, setFilterCategory] = useState("ALL"); // ALL | DIRECT | GROUP | BROADCAST | UNREAD

    // Composer State
    const [messageText, setMessageText] = useState("");
    const [sending, setSending] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [typingUser, setTypingUser] = useState(null);
    const [showDetailsPanel, setShowDetailsPanel] = useState(false);

    // Modals
    const [isDirectModalOpen, setIsDirectModalOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

    // Available Users for Direct/Group
    const [availableUsers, setAvailableUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [departments, setDepartments] = useState([]);

    // Forms
    const [groupForm, setGroupForm] = useState({
        title: "",
        description: "",
        isAdminOnly: false,
        memberIds: []
    });
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [broadcastForm, setBroadcastForm] = useState({
        title: "",
        description: "",
        broadcastPriority: "COMPANY_UPDATE",
        targetDepartmentId: ""
    });
    const [creatingChannel, setCreatingChannel] = useState(false);

    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const socketRef = useRef(null);

    // Connect Socket.IO
    useEffect(() => {
        const token = localStorage.getItem("token");
        const socketUrl = import.meta.env.VITE_API_URL
            ? import.meta.env.VITE_API_URL.replace("/api", "")
            : "http://localhost:5000";

        const socket = io(socketUrl, {
            auth: { token },
            withCredentials: true,
            transports: ["websocket", "polling"]
        });
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("[Socket.IO] Connected successfully");
        });

        socket.on("new_message", (newMsg) => {
            setMessages(prev => {
                // Prevent duplicate addition
                if (prev.some(m => m.id === newMsg.id)) return prev;
                if (newMsg.conversation_id === selectedConvId) {
                    return [...prev, newMsg];
                }
                return prev;
            });

            // Update conversations list preview & unread count
            setConversations(prev => prev.map(c => {
                if (c.id === newMsg.conversation_id) {
                    return {
                        ...c,
                        last_message_text: newMsg.message_text,
                        last_message_type: newMsg.message_type,
                        last_message_time: newMsg.created_at,
                        last_message_sender_name: newMsg.sender_name,
                        unread_count: c.id === selectedConvId ? 0 : c.unread_count + 1
                    };
                }
                return c;
            }));
        });

        socket.on("user_typing", ({ conversationId, userName }) => {
            if (conversationId === selectedConvId) {
                setTypingUser(userName);
            }
        });

        socket.on("user_stop_typing", ({ conversationId }) => {
            if (conversationId === selectedConvId) {
                setTypingUser(null);
            }
        });

        socket.on("reaction_updated", ({ messageId, reactions }) => {
            setMessages(prev => prev.map(m => {
                if (m.id === messageId) {
                    return { ...m, reactions };
                }
                return m;
            }));
        });

        return () => {
            socket.disconnect();
        };
    }, [selectedConvId]);

    // Load Conversations List
    const fetchConversationsList = useCallback(async () => {
        try {
            setLoadingConversations(true);
            const res = await getConversations();
            if (res.data?.success && Array.isArray(res.data.conversations)) {
                setConversations(res.data.conversations);
                // Select first conversation if none selected
                if (!selectedConvId && res.data.conversations.length > 0) {
                    setSelectedConvId(res.data.conversations[0].id);
                }
            }
        } catch (err) {
            console.error("Error loading conversations:", err);
            toast.error("Failed to load conversations");
        } finally {
            setLoadingConversations(false);
        }
    }, [selectedConvId]);

    useEffect(() => {
        fetchConversationsList();
        loadDirectoryUsers();
    }, [activeCompanyId]);

    // Load Messages when active conversation changes
    useEffect(() => {
        if (!selectedConvId) return;

        // Join socket room
        if (socketRef.current) {
            socketRef.current.emit("join_conversation", selectedConvId);
        }

        const fetchMsg = async () => {
            try {
                setLoadingMessages(true);
                const res = await getMessages(selectedConvId, 100);
                if (res.data?.success && Array.isArray(res.data.messages)) {
                    setMessages(res.data.messages);
                }
                // Mark conversation as read
                await markConversationRead(selectedConvId);
                setConversations(prev => prev.map(c => {
                    if (c.id === selectedConvId) return { ...c, unread_count: 0 };
                    return c;
                }));
            } catch (err) {
                console.error("Error loading messages:", err);
            } finally {
                setLoadingMessages(false);
            }
        };

        fetchMsg();

        return () => {
            if (socketRef.current) {
                socketRef.current.emit("leave_conversation", selectedConvId);
            }
        };
    }, [selectedConvId]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Load Available Users and Departments for modals
    const loadDirectoryUsers = async () => {
        try {
            setLoadingUsers(true);
            const [usersRes, deptRes] = await Promise.all([
                getAvailableUsersForChat(),
                getDepartments(false, activeCompanyId)
            ]);
            if (usersRes.data?.success) setAvailableUsers(usersRes.data.users || []);
            if (deptRes.data?.success) setDepartments(deptRes.data.departments || []);
        } catch (err) {
            console.error("Error loading chat directory:", err);
        } finally {
            setLoadingUsers(false);
        }
    };

    // Active conversation object
    const activeConv = useMemo(() => {
        return conversations.find(c => c.id === selectedConvId) || null;
    }, [conversations, selectedConvId]);

    // Display title & avatar for current conversation
    const getConvDisplay = (conv) => {
        if (!conv) return { name: "Chat", subtitle: "", initial: "C", isDirect: false };
        if (conv.type === "DIRECT") {
            return {
                name: conv.other_user_name || "Direct Message",
                subtitle: conv.other_user_department || conv.other_user_role || "Colleague",
                initial: (conv.other_user_name || "U").charAt(0).toUpperCase(),
                isDirect: true
            };
        }
        return {
            name: conv.title || "Group Channel",
            subtitle: conv.type === "BROADCAST" ? (conv.target_department_name ? `${conv.target_department_name} Broadcast` : "Company Announcement") : `${conv.member_count} members`,
            initial: (conv.title || "G").charAt(0).toUpperCase(),
            isDirect: false
        };
    };

    // Filter conversations
    const filteredConversations = useMemo(() => {
        return conversations.filter(c => {
            const display = getConvDisplay(c);
            const matchesSearch = display.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.last_message_text && c.last_message_text.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesSearch) return false;

            if (filterCategory === "DIRECT") return c.type === "DIRECT";
            if (filterCategory === "GROUP") return c.type === "GROUP";
            if (filterCategory === "BROADCAST") return c.type === "BROADCAST";
            if (filterCategory === "UNREAD") return c.unread_count > 0;
            return true;
        });
    }, [conversations, searchQuery, filterCategory]);

    // Handle Tab Filter Selection & Sync Active Conversation
    const handleSelectFilter = (category) => {
        setFilterCategory(category);
        const matches = conversations.filter(c => {
            if (category === "DIRECT") return c.type === "DIRECT";
            if (category === "GROUP") return c.type === "GROUP";
            if (category === "BROADCAST") return c.type === "BROADCAST";
            if (category === "UNREAD") return c.unread_count > 0;
            return true;
        });

        if (matches.length > 0) {
            if (!matches.some(c => c.id === selectedConvId)) {
                setSelectedConvId(matches[0].id);
            }
        } else {
            setSelectedConvId(null);
        }
    };

    // Send Message Handler
    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        const trimmed = messageText.trim();
        if (!trimmed && !selectedFile) return;

        setSending(true);
        try {
            const res = await postChatMessage(selectedConvId, {
                messageText: trimmed,
                isAnnouncement: activeConv?.type === "BROADCAST"
            }, selectedFile);

            if (res.data?.success && res.data.message) {
                setMessages(prev => [...prev, res.data.message]);
                setMessageText("");
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                // Stop typing emission
                socketRef.current?.emit("stop_typing", { conversationId: selectedConvId });
            }
        } catch (err) {
            console.error("Send message error:", err);
            toast.error(err.response?.data?.message || "Failed to send message");
        } finally {
            setSending(false);
        }
    };

    // Typing Event Trigger
    const handleTextChange = (e) => {
        setMessageText(e.target.value);
        if (socketRef.current && selectedConvId) {
            socketRef.current.emit("typing", {
                conversationId: selectedConvId,
                userName: user.name || "Colleague"
            });
        }
    };

    // Reaction Toggle
    const handleReaction = async (messageId, emoji) => {
        try {
            const res = await toggleReaction(messageId, emoji, selectedConvId);
            if (res.data?.success) {
                setMessages(prev => prev.map(m => {
                    if (m.id === messageId) return { ...m, reactions: res.data.reactions };
                    return m;
                }));
            }
        } catch (err) {
            console.error("Reaction error:", err);
        }
    };

    // Start Direct Chat with User
    const handleStartDirectChat = async (targetUser) => {
        try {
            const res = await startDirectChat(targetUser.id);
            if (res.data?.success) {
                setIsDirectModalOpen(false);
                await fetchConversationsList();
                setSelectedConvId(res.data.conversationId);
                toast.success(`Chat opened with ${targetUser.name}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Could not open chat");
        }
    };

    // Create Group Channel
    const handleCreateGroup = async (e) => {
        e.preventDefault();
        if (!groupForm.title.trim()) {
            toast.error("Group title is required");
            return;
        }

        setCreatingChannel(true);
        try {
            const res = await createChannel({
                type: "GROUP",
                title: groupForm.title.trim(),
                description: groupForm.description.trim() || null,
                isAdminOnly: groupForm.isAdminOnly,
                memberIds: groupForm.memberIds
            });
            if (res.data?.success) {
                toast.success("Group channel created!");
                setIsGroupModalOpen(false);
                setGroupForm({ title: "", description: "", isAdminOnly: false, memberIds: [] });
                await fetchConversationsList();
                setSelectedConvId(res.data.conversationId);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to create group");
        } finally {
            setCreatingChannel(false);
        }
    };

    // Create Broadcast Channel
    const handleCreateBroadcast = async (e) => {
        e.preventDefault();
        if (!broadcastForm.title.trim()) {
            toast.error("Broadcast channel name is required");
            return;
        }

        setCreatingChannel(true);
        try {
            const res = await createChannel({
                type: "BROADCAST",
                title: broadcastForm.title.trim(),
                description: broadcastForm.description.trim() || null,
                isAdminOnly: true, // Server-enforced rule
                broadcastPriority: broadcastForm.broadcastPriority,
                targetDepartmentId: broadcastForm.targetDepartmentId || null
            });
            if (res.data?.success) {
                toast.success("Broadcast announcement channel created!");
                setIsBroadcastModalOpen(false);
                setBroadcastForm({ title: "", description: "", broadcastPriority: "COMPANY_UPDATE", targetDepartmentId: "" });
                await fetchConversationsList();
                setSelectedConvId(res.data.conversationId);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to create broadcast channel");
        } finally {
            setCreatingChannel(false);
        }
    };

    // Check if user is locked from sending in this channel
    const isLockedFromPosting = useMemo(() => {
        if (!activeConv) return false;
        if (activeConv.is_admin_only && !isAdmin && activeConv.user_role !== "ADMIN") {
            return true;
        }
        return false;
    }, [activeConv, isAdmin]);

    // Active Display Info
    const activeDisplay = getConvDisplay(activeConv);

    return (
        <div className="h-[calc(100vh-64px)] flex bg-[#F6F8FB] overflow-hidden">
            {/* ── Left Column: Conversations List ─────────────────────── */}
            <div className="w-80 sm:w-88 md:w-96 flex flex-col bg-white border-r border-slate-200 shrink-0">
                {/* Header */}
                <div className="p-4 border-b border-slate-100 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-[#17365D] tracking-tight">Messages</h2>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-50 text-[#2878C7] border border-blue-200">
                                {conversations.length}
                            </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                            {filterCategory === "GROUP" ? (
                                <button
                                    onClick={() => { loadDirectoryUsers(); setIsGroupModalOpen(true); }}
                                    className="px-3 py-1.5 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Create Group Channel"
                                >
                                    <i className="fa-solid fa-users text-xs"></i>
                                    <span>Create Group</span>
                                </button>
                            ) : filterCategory === "BROADCAST" ? (
                                <button
                                    onClick={() => { loadDirectoryUsers(); setIsBroadcastModalOpen(true); }}
                                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Create Broadcast Announcement"
                                >
                                    <i className="fa-solid fa-bullhorn text-xs"></i>
                                    <span>New Broadcast</span>
                                </button>
                            ) : filterCategory === "DIRECT" ? (
                                <button
                                    onClick={() => { loadDirectoryUsers(); setIsDirectModalOpen(true); }}
                                    className="px-3 py-1.5 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                    title="Direct Message with User from User Master"
                                >
                                    <i className="fa-solid fa-user-plus text-xs"></i>
                                    <span>New Direct</span>
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => { loadDirectoryUsers(); setIsDirectModalOpen(true); }}
                                        className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#2878C7] border border-blue-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                                        title="Direct Message"
                                    >
                                        <i className="fa-solid fa-user-plus text-[10px]"></i>
                                        <span>Direct</span>
                                    </button>
                                    <button
                                        onClick={() => { loadDirectoryUsers(); setIsGroupModalOpen(true); }}
                                        className="px-2.5 py-1.5 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                                        title="Create Group"
                                    >
                                        <i className="fa-solid fa-users text-[10px]"></i>
                                        <span>Create Group</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search chats, colleagues, or messages..."
                            className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50/70 text-xs focus:outline-none focus:ring-2 focus:ring-[#2878C7] focus:bg-white transition-all placeholder:text-slate-400 font-medium"
                        />
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px] font-bold">
                        {[
                            { key: "ALL", label: "All" },
                            { key: "DIRECT", label: "Direct" },
                            { key: "GROUP", label: "Groups" },
                            { key: "BROADCAST", label: "Broadcasts" },
                            { key: "UNREAD", label: "Unread" }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => handleSelectFilter(tab.key)}
                                className={`px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer ${
                                    filterCategory === tab.key
                                        ? "bg-[#17365D] text-white shadow-xs"
                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Conversations Roster */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 flex flex-col">
                    {loadingConversations ? (
                        <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400 my-auto">
                            <i className="fa-solid fa-spinner fa-spin text-xl text-[#2878C7]"></i>
                            <span className="text-xs font-semibold">Loading conversations...</span>
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 flex flex-col items-center justify-center gap-3 my-auto">
                            {filterCategory === "GROUP" ? (
                                <>
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-xl shadow-xs">
                                        <i className="fa-solid fa-users"></i>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">No Group Channels Yet</p>
                                        <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                                            Create a group channel with colleagues from User Master to collaborate on projects.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { loadDirectoryUsers(); setIsGroupModalOpen(true); }}
                                        className="mt-1 px-4 py-2 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-plus text-xs"></i>
                                        <span>Create Group Channel</span>
                                    </button>
                                </>
                            ) : filterCategory === "BROADCAST" ? (
                                <>
                                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center text-xl shadow-xs">
                                        <i className="fa-solid fa-bullhorn"></i>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">No Broadcast Channels</p>
                                        <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                                            Launch official broadcast channels for company or department announcements.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { loadDirectoryUsers(); setIsBroadcastModalOpen(true); }}
                                        className="mt-1 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all cursor-pointer flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-bullhorn text-xs"></i>
                                        <span>Create Broadcast</span>
                                    </button>
                                </>
                            ) : filterCategory === "DIRECT" ? (
                                <>
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2878C7] border border-blue-100 flex items-center justify-center text-xl shadow-xs">
                                        <i className="fa-solid fa-user-plus"></i>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">No Direct Messages Yet</p>
                                        <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                                            Start a 1-to-1 conversation with any colleague created in User Master.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => { loadDirectoryUsers(); setIsDirectModalOpen(true); }}
                                        className="mt-1 px-4 py-2 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-user-plus text-xs"></i>
                                        <span>Start Direct Chat</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl shadow-xs">
                                        <i className="fa-regular fa-comments"></i>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">No Conversations Found</p>
                                        <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
                                            Start a 1-to-1 direct chat with a colleague or create a team group channel.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <button
                                            onClick={() => { loadDirectoryUsers(); setIsDirectModalOpen(true); }}
                                            className="px-3 py-1.5 rounded-xl bg-[#2878C7] text-white font-bold text-xs hover:bg-[#1e63a8] transition-all cursor-pointer"
                                        >
                                            <i className="fa-solid fa-user-plus mr-1"></i> Direct Chat
                                        </button>
                                        <button
                                            onClick={() => { loadDirectoryUsers(); setIsGroupModalOpen(true); }}
                                            className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-all cursor-pointer border border-slate-200"
                                        >
                                            <i className="fa-solid fa-users mr-1"></i> Create Group
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        filteredConversations.map(conv => {
                            const isSelected = conv.id === selectedConvId;
                            const display = getConvDisplay(conv);
                            const isBroadcast = conv.type === "BROADCAST";
                            const isGroup = conv.type === "GROUP";

                            return (
                                <div
                                    key={conv.id}
                                    onClick={() => setSelectedConvId(conv.id)}
                                    className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer select-none ${
                                        isSelected
                                            ? "bg-blue-50/80 border-r-4 border-r-[#2878C7]"
                                            : "hover:bg-slate-50/80"
                                    }`}
                                >
                                    {/* Avatar */}
                                    <div className="relative shrink-0">
                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs ${
                                            isBroadcast
                                                ? "bg-purple-100 text-purple-700 border border-purple-200"
                                                : isGroup
                                                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                                : "bg-blue-100 text-[#2878C7] border border-blue-200"
                                        }`}>
                                            {isBroadcast ? (
                                                <i className="fa-solid fa-bullhorn text-sm"></i>
                                            ) : isGroup ? (
                                                <i className="fa-solid fa-users text-sm"></i>
                                            ) : (
                                                display.initial
                                            )}
                                        </div>
                                        {/* Status Dot */}
                                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white"></span>
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className={`text-xs font-bold truncate ${isSelected ? "text-[#17365D]" : "text-slate-800"}`}>
                                                    {display.name}
                                                </span>
                                                {isBroadcast && (
                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-purple-100 text-purple-700">
                                                        Broadcast
                                                    </span>
                                                )}
                                            </div>
                                            {conv.last_message_time && (
                                                <span className="text-[10px] text-slate-400 shrink-0">
                                                    {new Date(conv.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </div>

                                        <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                                            {conv.last_message_sender_name && <strong className="text-slate-700">{conv.last_message_sender_name}: </strong>}
                                            {conv.last_message_text || (conv.last_message_type === 'FILE' ? "📎 Shared attachment" : display.subtitle)}
                                        </p>
                                    </div>

                                    {/* Unread Badge */}
                                    {conv.unread_count > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-[#2878C7] text-white text-[10px] font-extrabold min-w-4 text-center">
                                            {conv.unread_count}
                                        </span>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── Center Column: Active Chat Thread ────────────────────── */}
            <div className="flex-1 flex flex-col bg-[#F6F8FB] min-w-0">
                {activeConv ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-xs">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                    activeConv.type === "BROADCAST"
                                        ? "bg-purple-100 text-purple-700 border border-purple-200"
                                        : activeConv.type === "GROUP"
                                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                        : "bg-blue-100 text-[#2878C7] border border-blue-200"
                                }`}>
                                    {activeConv.type === "BROADCAST" ? (
                                        <i className="fa-solid fa-bullhorn text-sm"></i>
                                    ) : activeConv.type === "GROUP" ? (
                                        <i className="fa-solid fa-users text-sm"></i>
                                    ) : (
                                        activeDisplay.initial
                                    )}
                                </div>

                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-slate-900 truncate">
                                            {activeDisplay.name}
                                        </h3>
                                        {activeConv.is_admin_only && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                                                <i className="fa-solid fa-lock text-[9px]"></i> Admin-Only Posting
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[11px] text-slate-400 block truncate">
                                        {typingUser ? (
                                            <span className="text-[#2878C7] font-semibold flex items-center gap-1">
                                                <i className="fa-solid fa-ellipsis fa-fade"></i> {typingUser} is typing...
                                            </span>
                                        ) : (
                                            activeDisplay.subtitle
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Header Actions */}
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                                    className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                                        showDetailsPanel ? "bg-blue-50 text-[#2878C7] border-blue-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    }`}
                                    title="Channel Info & Shared Files"
                                >
                                    <i className="fa-solid fa-circle-info text-sm"></i>
                                </button>
                            </div>
                        </div>

                        {/* Broadcast Notice Banner (if admin-only) */}
                        {activeConv.is_admin_only && (
                            <div className="bg-amber-50/80 border-b border-amber-200/80 px-4 py-2 flex items-center justify-between text-xs text-amber-900">
                                <div className="flex items-center gap-2 font-medium">
                                    <i className="fa-solid fa-bullhorn text-amber-600"></i>
                                    <span>
                                        Official Broadcast Channel: Only administrators can post announcements.
                                    </span>
                                </div>
                                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                                    Broadcast Mode
                                </span>
                            </div>
                        )}

                        {/* Messages Timeline */}
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                            {loadingMessages ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                                    <i className="fa-solid fa-spinner fa-spin text-xl text-[#2878C7]"></i>
                                    <span className="text-xs font-semibold">Loading messages...</span>
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-[#2878C7] text-xl shadow-xs">
                                        <i className="fa-regular fa-paper-plane"></i>
                                    </div>
                                    <p className="text-sm font-bold text-slate-700">No messages in this conversation yet</p>
                                    <p className="text-xs text-slate-400 max-w-xs">
                                        Type a message below or share a file to start collaborating.
                                    </p>
                                </div>
                            ) : (
                                messages.map((msg) => {
                                    const isMine = msg.sender_id === user.id;
                                    const reactions = typeof msg.reactions === "string" ? JSON.parse(msg.reactions || "{}") : (msg.reactions || {});

                                    return (
                                        <div
                                            key={msg.id}
                                            className={`flex items-end gap-2.5 ${isMine ? "justify-end" : "justify-start"}`}
                                        >
                                            {/* Incoming Avatar */}
                                            {!isMine && (
                                                <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mb-1">
                                                    {msg.sender_name ? msg.sender_name.charAt(0).toUpperCase() : "U"}
                                                </div>
                                            )}

                                            {/* Message Bubble Container */}
                                            <div className={`max-w-[75%] sm:max-w-[65%] space-y-1 ${isMine ? "items-end" : "items-start"}`}>
                                                {/* Sender Header for Incoming in Groups */}
                                                {!isMine && activeConv.type !== "DIRECT" && (
                                                    <div className="flex items-center gap-1.5 px-1">
                                                        <span className="text-[11px] font-bold text-slate-700">{msg.sender_name}</span>
                                                        {msg.sender_department && (
                                                            <span className="text-[10px] text-slate-400">({msg.sender_department})</span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Bubble */}
                                                <div
                                                    className={`p-3.5 rounded-2xl shadow-xs relative text-xs sm:text-sm leading-relaxed ${
                                                        isMine
                                                            ? "bg-[#2878C7] text-white rounded-br-xs"
                                                            : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs"
                                                    }`}
                                                >
                                                    {/* File Attachment Card */}
                                                    {msg.file_url && (
                                                        <div className={`mb-2 p-2.5 rounded-xl border flex items-center gap-2.5 ${
                                                            isMine ? "bg-white/10 border-white/20 text-white" : "bg-slate-50 border-slate-200 text-slate-800"
                                                        }`}>
                                                            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-sm shrink-0">
                                                                <i className="fa-solid fa-file-arrow-down"></i>
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <a
                                                                    href={msg.file_url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="font-bold underline truncate block hover:opacity-80 text-xs"
                                                                >
                                                                    {msg.file_name || "Attachment"}
                                                                </a>
                                                                {msg.file_size && (
                                                                    <span className="text-[10px] opacity-75">
                                                                        {(msg.file_size / 1024).toFixed(1)} KB
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Message Text */}
                                                    {msg.message_text && (
                                                        <p className="whitespace-pre-wrap select-text">{msg.message_text}</p>
                                                    )}

                                                    {/* Timestamp & Status */}
                                                    <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                                                        isMine ? "text-white/80" : "text-slate-400"
                                                    }`}>
                                                        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                        {isMine && <i className="fa-solid fa-check-double text-[9px]"></i>}
                                                    </div>
                                                </div>

                                                {/* Reaction Pill List */}
                                                {Object.keys(reactions).length > 0 && (
                                                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                                                        {Object.entries(reactions).map(([emoji, userIds]) => (
                                                            <button
                                                                key={emoji}
                                                                onClick={() => handleReaction(msg.id, emoji)}
                                                                className={`px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 transition-all cursor-pointer ${
                                                                    userIds.includes(user.id)
                                                                        ? "bg-blue-50 border-blue-200 text-[#2878C7]"
                                                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                                }`}
                                                            >
                                                                <span>{emoji}</span>
                                                                <span className="text-[10px] font-bold">{userIds.length}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Quick Emoji Reaction Buttons on Hover */}
                                                <div className="flex items-center gap-1 opacity-0 hover:opacity-100 transition-opacity text-slate-400 text-xs px-1">
                                                    {["👍", "❤️", "👏", "🎉"].map(em => (
                                                        <button
                                                            key={em}
                                                            onClick={() => handleReaction(msg.id, em)}
                                                            className="hover:scale-125 transition-transform cursor-pointer"
                                                        >
                                                            {em}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Composer / Input Area */}
                        <div className="p-4 bg-white border-t border-slate-200 shrink-0">
                            {isLockedFromPosting ? (
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center text-xs text-slate-500 font-semibold flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-lock text-slate-400"></i>
                                    <span>Only administrators can send messages in this broadcast channel.</span>
                                </div>
                            ) : (
                                <form onSubmit={handleSendMessage} className="space-y-2">
                                    {/* Selected File Badge */}
                                    {selectedFile && (
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-[#2878C7] font-semibold">
                                            <i className="fa-solid fa-paperclip"></i>
                                            <span className="truncate max-w-xs">{selectedFile.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                                className="text-slate-400 hover:text-red-500"
                                            >
                                                <i className="fa-solid fa-xmark"></i>
                                            </button>
                                        </div>
                                    )}

                                    {/* Text Input Row */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                                            className="hidden"
                                        />

                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="p-2.5 rounded-xl text-slate-400 hover:text-[#2878C7] hover:bg-blue-50 transition-colors cursor-pointer"
                                            title="Attach File / Document"
                                        >
                                            <i className="fa-solid fa-paperclip text-sm"></i>
                                        </button>

                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                                className="p-2.5 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-amber-50 transition-colors cursor-pointer"
                                                title="Add Emoji"
                                            >
                                                <i className="fa-regular fa-face-smile text-sm"></i>
                                            </button>

                                            {showEmojiPicker && (
                                                <div className="absolute bottom-12 left-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 flex gap-2 text-lg animate-in fade-in zoom-in-95">
                                                    {["👍", "❤️", "🔥", "🎉", "👏", "🙌", "✅", "🚀", "💡"].map(em => (
                                                        <button
                                                            key={em}
                                                            type="button"
                                                            onClick={() => { setMessageText(prev => prev + em); setShowEmojiPicker(false); }}
                                                            className="hover:scale-125 transition-transform cursor-pointer"
                                                        >
                                                            {em}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <textarea
                                            rows={1}
                                            value={messageText}
                                            onChange={handleTextChange}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" && !e.shiftKey) {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }
                                            }}
                                            placeholder={`Message ${activeDisplay.name}... (Press Enter to send)`}
                                            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7] text-xs sm:text-sm resize-none placeholder:text-slate-400 font-medium"
                                        />

                                        <button
                                            type="submit"
                                            disabled={sending || (!messageText.trim() && !selectedFile)}
                                            className="p-2.5 w-10 h-10 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shadow-md shadow-blue-500/20"
                                            title="Send message"
                                        >
                                            {sending ? (
                                                <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                            ) : (
                                                <i className="fa-solid fa-paper-plane text-xs"></i>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-4">
                        <div className="w-16 h-16 rounded-3xl bg-white border border-slate-200 flex items-center justify-center text-2xl shadow-sm">
                            {filterCategory === "GROUP" ? (
                                <i className="fa-solid fa-users text-emerald-600"></i>
                            ) : filterCategory === "BROADCAST" ? (
                                <i className="fa-solid fa-bullhorn text-purple-600"></i>
                            ) : (
                                <i className="fa-solid fa-comments text-[#2878C7]"></i>
                            )}
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-800">
                                {filterCategory === "GROUP"
                                    ? "Team Group Channels"
                                    : filterCategory === "BROADCAST"
                                    ? "Official Broadcast Channels"
                                    : "Welcome to Interlink Chat"}
                            </h3>
                            <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
                                {filterCategory === "GROUP"
                                    ? "Select an existing group channel on the left or create a new group channel to collaborate with team members."
                                    : filterCategory === "BROADCAST"
                                    ? "Select an announcement channel to view executive notices and department broadcasts."
                                    : "Select a colleague or group channel from the left sidebar, or start a new direct conversation with staff from User Master."}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            {filterCategory === "GROUP" ? (
                                <button
                                    onClick={() => { loadDirectoryUsers(); setIsGroupModalOpen(true); }}
                                    className="px-4 py-2.5 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-plus text-xs"></i>
                                    <span>Create Group Channel</span>
                                </button>
                            ) : filterCategory === "BROADCAST" ? (
                                <button
                                    onClick={() => { loadDirectoryUsers(); setIsBroadcastModalOpen(true); }}
                                    className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-500/20 transition-all cursor-pointer flex items-center gap-2"
                                >
                                    <i className="fa-solid fa-bullhorn text-xs"></i>
                                    <span>New Broadcast</span>
                                </button>
                            ) : (
                                <>
                                    <button
                                        onClick={() => { loadDirectoryUsers(); setIsDirectModalOpen(true); }}
                                        className="px-4 py-2.5 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-user-plus text-xs"></i>
                                        <span>New Direct Chat</span>
                                    </button>
                                    <button
                                        onClick={() => { loadDirectoryUsers(); setIsGroupModalOpen(true); }}
                                        className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs border border-slate-200 transition-all cursor-pointer flex items-center gap-2"
                                    >
                                        <i className="fa-solid fa-users text-xs"></i>
                                        <span>Create Group</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Right Collapsible Column: Channel Details & Shared Media ──── */}
            {showDetailsPanel && activeConv && (
                <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 animate-in slide-in-from-right-4 duration-200">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="text-sm font-bold text-slate-800">Details & Shared Files</h4>
                        <button
                            onClick={() => setShowDetailsPanel(false)}
                            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                        >
                            <i className="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>

                    <div className="p-5 overflow-y-auto space-y-6 text-xs">
                        {/* Summary Card */}
                        <div className="text-center space-y-2">
                            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#2878C7] flex items-center justify-center font-bold text-xl mx-auto border border-blue-100">
                                {activeDisplay.initial}
                            </div>
                            <h5 className="font-bold text-sm text-slate-900">{activeDisplay.name}</h5>
                            <p className="text-slate-400">{activeConv.description || activeDisplay.subtitle}</p>
                        </div>

                        {/* Channel Attributes */}
                        <div className="space-y-2 pt-2 border-t border-slate-100">
                            <div className="flex justify-between text-slate-600">
                                <span>Channel Type:</span>
                                <strong className="capitalize text-slate-800">{activeConv.type.toLowerCase()}</strong>
                            </div>
                            {activeConv.is_admin_only && (
                                <div className="flex justify-between text-slate-600">
                                    <span>Permissions:</span>
                                    <strong className="text-amber-600">Admin-Only Posting</strong>
                                </div>
                            )}
                            <div className="flex justify-between text-slate-600">
                                <span>Created:</span>
                                <strong className="text-slate-800">{new Date(activeConv.created_at).toLocaleDateString()}</strong>
                            </div>
                        </div>

                        {/* Shared Files List */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                            <h6 className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                                Shared Media & Files
                            </h6>
                            {messages.filter(m => m.file_url).length === 0 ? (
                                <p className="text-slate-400 italic text-[11px]">No files shared in this channel yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {messages.filter(m => m.file_url).map(f => (
                                        <a
                                            key={f.id}
                                            href={f.file_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-2 rounded-xl border border-slate-200/80 hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                                        >
                                            <i className="fa-solid fa-file-lines text-[#2878C7]"></i>
                                            <span className="truncate flex-1 font-semibold text-slate-700">{f.file_name || "Document"}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: New Direct Message (User Master Directory) ─────────── */}
            {isDirectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <i className="fa-solid fa-user-plus text-[#2878C7]"></i>
                                <h3 className="text-sm font-bold text-slate-900">Direct Chat with Colleague</h3>
                            </div>
                            <button onClick={() => setIsDirectModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="p-4 max-h-96 overflow-y-auto space-y-2">
                            <p className="text-xs text-slate-500 mb-3">
                                Select any colleague created in <strong>User Master</strong> to start a real-time conversation:
                            </p>

                            {loadingUsers ? (
                                <div className="py-8 text-center text-slate-400 text-xs">
                                    <i className="fa-solid fa-spinner fa-spin mr-1"></i> Loading users...
                                </div>
                            ) : availableUsers.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-4">No other active users found.</p>
                            ) : (
                                availableUsers.map(u => (
                                    <div
                                        key={u.id}
                                        onClick={() => handleStartDirectChat(u)}
                                        className="p-3 rounded-xl border border-slate-200/70 hover:border-blue-300 hover:bg-blue-50/50 flex items-center justify-between cursor-pointer transition-all"
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-xl bg-blue-100 text-[#2878C7] flex items-center justify-center font-bold text-xs">
                                                {u.name ? u.name.charAt(0).toUpperCase() : "U"}
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-slate-800 block">{u.name}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    {u.department_name || "General"} • {u.role}
                                                </span>
                                            </div>
                                        </div>

                                        <button className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#2878C7] text-xs font-bold hover:bg-blue-100">
                                            Message
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal: New Group Channel ───────────────────────────────────── */}
            {isGroupModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold">
                                    <i className="fa-solid fa-users"></i>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">Create New Group Channel</h3>
                                    <p className="text-[11px] text-slate-400">Collaborate with multiple colleagues from User Master</p>
                                </div>
                            </div>
                            <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        <form onSubmit={handleCreateGroup} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Group Channel Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={groupForm.title}
                                    onChange={(e) => setGroupForm({ ...groupForm, title: e.target.value })}
                                    placeholder="e.g. Frontend Engineering, Product Strategy, Marketing"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-[#2878C7] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Description / Purpose
                                </label>
                                <textarea
                                    rows={2}
                                    value={groupForm.description}
                                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                                    placeholder="Brief outline of this group's goals or work..."
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-[#2878C7] focus:outline-none resize-none"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                                        Select Members from User Master
                                    </label>
                                    <span className="text-[11px] font-bold text-[#2878C7] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                                        {groupForm.memberIds.length} Selected
                                    </span>
                                </div>

                                <div className="relative mb-2">
                                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                    <input
                                        type="text"
                                        value={memberSearchQuery}
                                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                                        placeholder="Filter colleagues by name or department..."
                                        className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:ring-2 focus:ring-[#2878C7] focus:bg-white focus:outline-none placeholder:text-slate-400"
                                    />
                                </div>

                                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1 divide-y divide-slate-100">
                                    {availableUsers
                                        .filter(u => !memberSearchQuery || u.name.toLowerCase().includes(memberSearchQuery.toLowerCase()) || (u.department_name && u.department_name.toLowerCase().includes(memberSearchQuery.toLowerCase())))
                                        .map(u => (
                                            <label key={u.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-xs cursor-pointer select-none">
                                                <div className="flex items-center gap-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={groupForm.memberIds.includes(u.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setGroupForm({ ...groupForm, memberIds: [...groupForm.memberIds, u.id] });
                                                            } else {
                                                                setGroupForm({ ...groupForm, memberIds: groupForm.memberIds.filter(id => id !== u.id) });
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded text-[#2878C7] border-slate-300 focus:ring-[#2878C7]"
                                                    />
                                                    <div>
                                                        <span className="font-bold text-slate-800 block">{u.name}</span>
                                                        <span className="text-[10px] text-slate-400">@{u.username}</span>
                                                    </div>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                                    {u.department_name || "General"}
                                                </span>
                                            </label>
                                        ))
                                    }
                                </div>
                            </div>

                            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsGroupModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingChannel || !groupForm.title.trim()}
                                    className="px-5 py-2.5 rounded-xl bg-[#2878C7] hover:bg-[#1e63a8] text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                >
                                    {creatingChannel ? (
                                        <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                    ) : (
                                        <i className="fa-solid fa-check text-xs"></i>
                                    )}
                                    <span>Create Group Channel</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Modal: New Broadcast Channel ──────────────────────────────── */}
            {isBroadcastModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-purple-50/50">
                            <div className="flex items-center gap-2">
                                <i className="fa-solid fa-bullhorn text-purple-600"></i>
                                <h3 className="text-sm font-bold text-slate-900">New Broadcast Announcement Channel</h3>
                            </div>
                            <button onClick={() => setIsBroadcastModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <form onSubmit={handleCreateBroadcast} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Broadcast Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={broadcastForm.title}
                                    onChange={(e) => setBroadcastForm({ ...broadcastForm, title: e.target.value })}
                                    placeholder="e.g. IT Security Bulletins, All-Hands Announcements"
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-600 focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Target Audience Scope
                                </label>
                                <select
                                    value={broadcastForm.targetDepartmentId}
                                    onChange={(e) => setBroadcastForm({ ...broadcastForm, targetDepartmentId: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-purple-600 focus:outline-none"
                                >
                                    <option value="">Company-Wide (All Employees in Workspace)</option>
                                    {departments.map(d => (
                                        <option key={d.id} value={d.id}>
                                            {d.department_name} Department Only
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Priority Level
                                </label>
                                <select
                                    value={broadcastForm.broadcastPriority}
                                    onChange={(e) => setBroadcastForm({ ...broadcastForm, broadcastPriority: e.target.value })}
                                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:ring-2 focus:ring-purple-600 focus:outline-none"
                                >
                                    <option value="COMPANY_UPDATE">Company Update</option>
                                    <option value="POLICY_CHANGE">Policy Change</option>
                                    <option value="URGENT">Urgent Advisory</option>
                                    <option value="NORMAL">Standard Broadcast</option>
                                </select>
                            </div>

                            <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-900 space-y-1">
                                <div className="font-bold flex items-center gap-1.5">
                                    <i className="fa-solid fa-lock text-purple-600"></i>
                                    <span>Server-Enforced Broadcast Rule:</span>
                                </div>
                                <p className="text-[11px] text-purple-800 leading-relaxed">
                                    All targeted employees will receive messages, but only designated administrators can broadcast.
                                </p>
                            </div>

                            <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsBroadcastModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingChannel}
                                    className="px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-md hover:bg-purple-700"
                                >
                                    {creatingChannel ? "Launching..." : "Launch Broadcast Channel"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
