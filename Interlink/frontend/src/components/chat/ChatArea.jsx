import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import CameraCaptureModal, { formatFileSize } from "./CameraCaptureModal";
import { uploadChatAttachment, deleteGroupChat, updateGroupSettings, getGroupMembers, deleteMessage } from "../../api/chatApi";

const getInitials = (str) => {
    if (!str) return "U";
    const cleaned = str.replace(/^[#@\s]+/, "").trim();
    if (!cleaned) return "U";
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return cleaned.substring(0, 2).toUpperCase();
};

export default function ChatArea({
    conversation,
    messages = [],
    currentUserId,
    isAdmin = false,
    onSendMessage,
    onViewFile,
    onDeleteGroup,
    onlineUserIds = [],
    typingUsers = [],
    onTypingStart,
    onTypingStop,
    permissions = {},
    onDeleteMessage,
    onToggleDetails,
    isDetailsOpen = false
}) {
    const [messageText, setMessageText] = useState("");
    const [replyingTo, setReplyingTo] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [isDeletingGroup, setIsDeletingGroup] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [msgToDelete, setMsgToDelete] = useState(null);
    const [isDeletingMessage, setIsDeletingMessage] = useState(false);

    // Group Settings Form State
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editWhoCanPost, setEditWhoCanPost] = useState("ALL_MEMBERS");
    const [groupMembers, setGroupMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [memberSearch, setMemberSearch] = useState("");

    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const prevConvIdRef = useRef(conversation?.id);
    const prevMsgLengthRef = useRef(messages.length);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);
    const typingTimeoutRef = useRef(null);

    // Permission checks with defaults
    const canChat = permissions.canChat !== false;
    const canCamera = permissions.canCamera !== false;
    const canUpload = permissions.canUpload !== false;
    const canView = permissions.canView !== false;
    const canDownload = permissions.canDownload !== false;

    const isGroup = (conversation?.type || "").toLowerCase() === "group";
    const isActivity = Boolean(conversation?.is_activity) || conversation?.title === "#activity" || conversation?.title === "# activity";
    const isMaster = Boolean(conversation?.is_master) && !isActivity;
    const isAnnouncement = Boolean(conversation?.is_announcement);
    const partnerId = conversation?.partnerId || conversation?.other_user_id || conversation?.partner_id;
    const isPartnerOnline = !isGroup && Boolean(partnerId) && (onlineUserIds || []).some((id) => String(id) === String(partnerId));

    // Determine Group Admin / Creator privileges
    const isGroupAdminOrCreator =
        isAdmin ||
        Number(conversation?.created_by) === Number(currentUserId) ||
        conversation?.member_role === "ADMIN";

    // Write access rules
    const whoCanPostSetting = conversation?.who_can_post || (isAnnouncement ? "ADMIN_ONLY" : "ALL_MEMBERS");
    const isUserSelectedToPost = whoCanPostSetting === "SELECTED_MEMBERS"
        ? (Boolean(conversation?.can_post) || isGroupAdminOrCreator)
        : true;

    const hasGroupWriteAccess =
        !isGroup ||
        isActivity ||
        isGroupAdminOrCreator ||
        (whoCanPostSetting === "ALL_MEMBERS" && !isAnnouncement) ||
        (whoCanPostSetting === "SELECTED_MEMBERS" && isUserSelectedToPost);

    const hasWriteAccess = canChat && hasGroupWriteAccess;

    // Filter typing indicators for this conversation (excluding current user)
    const activeTypers = typingUsers.filter(
        (t) => t.conversationId === conversation?.id && String(t.userId) !== String(currentUserId)
    );

    const isAtBottomRef = useRef(true);
    const justSwitchedConvRef = useRef(true);

    const handleExecuteDelete = async (deleteType) => {
        if (!msgToDelete) return;
        try {
            setIsDeletingMessage(true);
            const res = await deleteMessage(msgToDelete.id, deleteType);
            if (onDeleteMessage) {
                onDeleteMessage(msgToDelete.id, deleteType, res?.data);
            }
            toast.success(deleteType === "FOR_EVERYONE" ? "Message deleted for everyone" : "Message deleted for you");
            setMsgToDelete(null);
        } catch (err) {
            console.error("Failed to delete message:", err);
            toast.error(err.response?.data?.message || "Failed to delete message");
        } finally {
            setIsDeletingMessage(false);
        }
    };

    const handleScroll = () => {
        const el = messagesContainerRef.current;
        if (!el) return;
        const threshold = 120;
        isAtBottomRef.current = (el.scrollHeight - el.scrollTop - el.clientHeight) <= threshold;
    };

    const scrollToBottomInstant = () => {
        const el = messagesContainerRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "auto", block: "end" });
        }
    };

    const scrollToBottomSmooth = () => {
        const el = messagesContainerRef.current;
        if (el) {
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        }
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        }
    };

    // Reset switch tracker whenever conversation ID changes
    useEffect(() => {
        justSwitchedConvRef.current = true;
        isAtBottomRef.current = true;
        scrollToBottomInstant();
    }, [conversation?.id]);

    // Instant snap on chat open/switch, smooth scroll ONLY on new incoming messages
    useEffect(() => {
        const el = messagesContainerRef.current;
        if (!el) return;

        const isConvChanged = prevConvIdRef.current !== conversation?.id;
        const prevLen = prevMsgLengthRef.current;
        const isNewMessage = messages.length > prevLen;

        prevConvIdRef.current = conversation?.id;
        prevMsgLengthRef.current = messages.length;

        // When switching conversation, on initial load, or when messages arrive for newly opened chat
        if (isConvChanged || justSwitchedConvRef.current || prevLen === 0) {
            justSwitchedConvRef.current = false;
            isAtBottomRef.current = true;
            scrollToBottomInstant();

            // Multi-pass scroll after layout, fonts, and DOM rendering settle
            const rafId = requestAnimationFrame(() => {
                scrollToBottomInstant();
            });
            const timer1 = setTimeout(() => {
                scrollToBottomInstant();
            }, 60);
            const timer2 = setTimeout(() => {
                scrollToBottomInstant();
            }, 180);

            return () => {
                cancelAnimationFrame(rafId);
                clearTimeout(timer1);
                clearTimeout(timer2);
            };
        }

        // When a new message arrives in the current conversation:
        if (isNewMessage) {
            isAtBottomRef.current = true;
            scrollToBottomSmooth();
            const t = setTimeout(() => {
                scrollToBottomSmooth();
            }, 80);
            return () => clearTimeout(t);
        }
    }, [conversation?.id, messages, currentUserId]);

    // Auto-scroll observer for dynamic height changes (e.g. image loads or font rendering)
    useEffect(() => {
        const el = messagesContainerRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;

        const resizeObserver = new ResizeObserver(() => {
            if (isAtBottomRef.current) {
                el.scrollTop = el.scrollHeight;
            }
        });

        resizeObserver.observe(el);
        return () => resizeObserver.disconnect();
    }, []);

    // Populate group settings modal when opened & fetch member list
    const handleOpenSettings = async () => {
        setEditTitle(conversation?.title || "");
        setEditDescription(conversation?.description || "");
        setEditWhoCanPost(conversation?.who_can_post || "ALL_MEMBERS");
        setMemberSearch("");
        setIsSettingsModalOpen(true);

        if (conversation?.id) {
            setLoadingMembers(true);
            try {
                const res = await getGroupMembers(conversation.id);
                const list = res.members || [];
                setGroupMembers(list);
                // Pre-check members who have can_post = true or are ADMIN
                const allowed = list.filter(m => m.can_post || m.conversation_role === 'ADMIN').map(m => Number(m.id));
                setSelectedMemberIds(allowed);
            } catch (err) {
                console.error("Failed to load group members:", err);
            } finally {
                setLoadingMembers(false);
            }
        }
    };

    const toggleMemberSelection = (memberId) => {
        const id = Number(memberId);
        setSelectedMemberIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleSelectAllMembers = () => {
        setSelectedMemberIds(groupMembers.map(m => Number(m.id)));
    };

    const handleDeselectAllMembers = () => {
        const adminIds = groupMembers.filter(m => m.conversation_role === 'ADMIN').map(m => Number(m.id));
        setSelectedMemberIds(adminIds);
    };

    const handleSaveGroupSettings = async (e) => {
        e.preventDefault();
        if (!editTitle.trim()) {
            toast.error("Group name cannot be empty");
            return;
        }

        try {
            setIsSavingSettings(true);
            const res = await updateGroupSettings(conversation.id, {
                title: editTitle.trim(),
                description: editDescription.trim(),
                who_can_post: editWhoCanPost,
                allowed_member_ids: editWhoCanPost === "SELECTED_MEMBERS" ? selectedMemberIds : undefined
            });
            toast.success("Group settings updated!");
            if (conversation) {
                conversation.title = editTitle.trim();
                conversation.displayTitle = editTitle.trim();
                conversation.description = editDescription.trim();
                conversation.who_can_post = editWhoCanPost;
                if (editWhoCanPost === "SELECTED_MEMBERS") {
                    conversation.can_post = selectedMemberIds.includes(Number(currentUserId)) || isGroupAdminOrCreator;
                } else if (editWhoCanPost === "ALL_MEMBERS") {
                    conversation.can_post = true;
                } else if (editWhoCanPost === "ADMIN_ONLY") {
                    conversation.can_post = isGroupAdminOrCreator;
                }
            }
            setIsSettingsModalOpen(false);
        } catch (err) {
            console.error("Failed to update group settings:", err);
            toast.error(err.response?.data?.message || "Failed to update group settings");
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleTextChange = (e) => {
        setMessageText(e.target.value);
        if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
        }
        if (onTypingStart) {
            onTypingStart();
        }
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            if (onTypingStop) onTypingStop();
        }, 1800);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!canUpload) {
            toast.error("You do not have permission to upload files.");
            e.target.value = "";
            return;
        }

        if (!hasWriteAccess) {
            toast.error("Only group administrators can upload files in this channel.");
            e.target.value = "";
            return;
        }

        if (file.size > 50 * 1024 * 1024) {
            toast.error("File size cannot exceed 50 MB");
            return;
        }
        setSelectedFile(file);
    };

    const handleRemoveFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // Camera Photo & Video instant send
    const handleCameraMedia = async ({ file, caption, mediaType = "photo" }) => {
        if (!file) return;
        if (!hasWriteAccess) {
            toast.error("Only group administrators can send media in this channel.");
            return;
        }

        try {
            setIsUploading(true);
            const isVid = mediaType === "video" || file.type.startsWith("video/");
            const toastId = toast.loading(isVid ? "Uploading video recording..." : "Uploading photo...");
            const uploadRes = await uploadChatAttachment(file);
            toast.dismiss(toastId);

            const attachmentId = uploadRes.data?.attachmentId || uploadRes.data?.id;

            await onSendMessage({
                conversationId: conversation.id,
                messageText: caption || "",
                parentMessageId: replyingTo?.id || null,
                attachmentId
            });

            toast.success(isVid ? "Video shared!" : "Photo shared!");
            setReplyingTo(null);
        } catch (error) {
            console.error("Failed to share camera media:", error);
            toast.error(error.response?.data?.message || "Failed to share media");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSend = async (e) => {
        e?.preventDefault();
        if (!messageText.trim() && !selectedFile) return;

        if (!hasWriteAccess) {
            toast.error("Only group administrators can send messages in this channel.");
            return;
        }

        if (onTypingStop) onTypingStop();

        let attachmentId = null;

        try {
            if (selectedFile) {
                setIsUploading(true);
                const toastId = toast.loading(`Uploading ${selectedFile.name}...`);
                const uploadRes = await uploadChatAttachment(selectedFile);
                toast.dismiss(toastId);
                toast.success("File attached!");
                attachmentId = uploadRes.data?.attachmentId || uploadRes.data?.id;
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }

            await onSendMessage({
                conversationId: conversation.id,
                messageText: messageText.trim(),
                parentMessageId: replyingTo?.id || null,
                attachmentId
            });

            setMessageText("");
            setReplyingTo(null);
            if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
            }
        } catch (error) {
            console.error("Failed to send message:", error);
            toast.error(error.response?.data?.message || "Failed to send message");
        } finally {
            setIsUploading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const formatMessageTime = (dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const formatMessageFullDate = (dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    const formatJoinDate = (dateStr) => {
        if (!dateStr) return "Recently";
        const date = new Date(dateStr);
        return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
    };

    const resolveApiUrl = (url) => {
        if (!url) return "";
        let clean = url;
        if (typeof clean === "string") {
            clean = clean.replace(/https?:\/\/crm\.jasminmobile\.com/g, "https://interchat.epoxyhouse.in")
                .replace(/https?:\/\/(www\.)?interchat\.jeenweb\.com/g, "https://interchat.epoxyhouse.in");
        }
        if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("blob:") || clean.startsWith("data:")) {
            return clean;
        }
        const base = import.meta.env.VITE_API_URL
            ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
            : (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:5005" : "");
        const cleanUrl = clean.startsWith("/") ? clean : `/${clean}`;
        return `${base}${cleanUrl}`;
    };

    const getAuthenticatedFileUrl = (url) => {
        const fullUrl = resolveApiUrl(url);
        const token = localStorage.getItem("token");
        if (!token || fullUrl.includes("token=")) return fullUrl;
        const sep = fullUrl.includes("?") ? "&" : "?";
        return `${fullUrl}${sep}token=${encodeURIComponent(token)}`;
    };

    const openInternalFile = (msgOrFile) => {
        if (!canView) {
            toast.error("Document viewing is restricted for your role.");
            return;
        }
        const att = (msgOrFile.attachments && msgOrFile.attachments[0]) || null;
        const fileId = msgOrFile.attachmentId || att?.id || msgOrFile.id;
        const originalName = msgOrFile.file_name || msgOrFile.original_name || msgOrFile.originalName || att?.original_name || "Document";
        const fileType = msgOrFile.file_type || msgOrFile.mime_type || msgOrFile.fileType || att?.mime_type || "";
        const fileSize = msgOrFile.file_size || msgOrFile.fileSize || att?.file_size || 0;

        if (onViewFile) {
            onViewFile({
                id: fileId,
                attachmentId: fileId,
                originalName,
                fileType,
                fileSize,
                downloadUrl: canDownload ? getAuthenticatedFileUrl(`/api/chat/files/${fileId}/download`) : null,
                viewUrl: getAuthenticatedFileUrl(`/api/chat/files/${fileId}/view`)
            });
        }
    };

    const canDeleteGroup = isGroup && !isActivity && (isAdmin || Number(conversation?.created_by) === Number(currentUserId));

    const handleDeleteGroup = async () => {
        if (!conversation?.id) return;
        try {
            setIsDeletingGroup(true);
            await deleteGroupChat(conversation.id);
            toast.success(`Group "${conversation.title || 'Group'}" deleted successfully`);
            setIsDeleteModalOpen(false);
            if (onDeleteGroup) {
                onDeleteGroup(conversation.id);
            }
        } catch (err) {
            console.error("Failed to delete group:", err);
            toast.error(err.response?.data?.message || "Failed to delete group");
        } finally {
            setIsDeletingGroup(false);
        }
    };

    if (!conversation) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-[#F6F8FB] p-6 text-center select-none">
                <div className="w-14 h-14 rounded-xl bg-[#17365D] text-white border border-[#102642] flex items-center justify-center mb-4 text-2xl shadow-xs">
                    <i className="fa-solid fa-comments text-[#38BDF8]"></i>
                </div>
                <h3 className="text-base font-bold text-[#17212F] mb-1 tracking-tight">Select a Channel or Conversation</h3>
                <p className="text-xs text-[#5B6573] max-w-sm leading-relaxed mb-5 font-normal">
                    Pick a channel from the sidebar or start a direct conversation with any colleague across the organization.
                </p>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#E2E8F0] text-xs font-semibold text-[#5B6573] shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
                    <span>Direct chats and `#activity` are encrypted & secure</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-[#F6F8FB] relative overflow-hidden">
            {/* Top Chat Header */}
            <div className="h-14 px-4 sm:px-6 bg-white border-b border-[#E2E8F0] flex items-center justify-between shrink-0 shadow-2xs z-10 select-none">
                <div className="flex items-center gap-2.5 truncate">
                    <div className="relative shrink-0">
                        <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs shadow-2xs text-white ${isActivity
                                    ? "bg-[#17365D] text-[#38BDF8] border border-[#102642]"
                                    : isMaster || isAnnouncement
                                        ? "bg-[#17365D] text-white border border-[#102642]"
                                        : isGroup
                                            ? "bg-[#EFF6FF] text-[#2878C7] border border-[#BFDBFE]"
                                            : "bg-[#17365D] text-white border border-[#102642]"
                                }`}
                        >
                            {isActivity ? (
                                <span className="font-extrabold text-sm text-[#38BDF8]">#</span>
                            ) : isMaster || isAnnouncement ? (
                                <i className="fa-solid fa-bullhorn text-xs"></i>
                            ) : (conversation.is_company_group || conversation.company_name) ? (
                                <i className="fa-solid fa-building text-xs text-emerald-400"></i>
                            ) : isGroup ? (
                                <i className="fa-solid fa-users text-xs text-[#2878C7]"></i>
                            ) : (
                                getInitials(conversation.displayTitle || conversation.title || "U")
                            )}
                        </div>
                        {!isGroup && (
                            <span
                                className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isPartnerOnline ? "bg-[#10B981] ring-1 ring-emerald-200" : "bg-slate-300"
                                    }`}
                            />
                        )}
                    </div>

                    <div className="truncate">
                        <div className="flex items-center gap-1.5 truncate">
                            {isActivity && (
                                <span className="text-[#2878C7] font-bold text-xs shrink-0">#</span>
                            )}
                            <h3 className="text-xs sm:text-[13px] font-bold text-[#17212F] truncate">
                                {isActivity ? "activity" : conversation.displayTitle || conversation.title || (isGroup ? "Group Chat" : "Direct Chat")}
                            </h3>
                            {isActivity && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#2878C7] text-[9px] font-bold tracking-wider flex items-center gap-1 shrink-0">
                                    DEFAULT
                                </span>
                            )}
                            {isMaster && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold flex items-center gap-1 shrink-0">
                                    BROADCAST
                                </span>
                            )}
                            {conversation.company_name && !isActivity && (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-semibold flex items-center gap-1 shrink-0">
                                    <i className="fa-solid fa-building text-[8px] text-emerald-600"></i>
                                    {conversation.company_name}
                                </span>
                            )}
                            {isGroup && whoCanPostSetting === "ADMIN_ONLY" && !isActivity && !isMaster && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold flex items-center gap-1 shrink-0">
                                    <i className="fa-solid fa-lock text-[8px]"></i> Admin-Only
                                </span>
                            )}
                            {isGroup && whoCanPostSetting === "SELECTED_MEMBERS" && !isActivity && !isMaster && (
                                <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#2878C7] text-[9px] font-semibold flex items-center gap-1 shrink-0">
                                    <i className="fa-solid fa-user-check text-[8px]"></i> Selected
                                </span>
                            )}
                            {conversation.department_name && !isActivity && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-[#E2E8F0] text-[#5B6573] text-[9px] font-medium flex items-center gap-1 shrink-0">
                                    <i className="fa-solid fa-layer-group text-[8px] text-slate-500"></i>
                                    {conversation.department_name}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[#5B6573] font-normal">
                            {isActivity ? (
                                <span className="text-[#2878C7] font-medium flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] inline-block animate-pulse"></span>
                                    Company-wide activity & announcements feed
                                </span>
                            ) : isGroup ? (
                                <span>{conversation.description || "Team channel discussion"}</span>
                            ) : isPartnerOnline ? (
                                <span className="text-[#10B981] font-semibold flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-pulse"></span>
                                    Active Now
                                </span>
                            ) : (
                                <span className="text-[#94A3B8] font-normal flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block"></span>
                                    Offline
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Top Actions */}
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {/* Toggle Channel Details & Shared Files (CHAT-01 & CHAT-07) */}
                    <button
                        onClick={() => onToggleDetails && onToggleDetails()}
                        title="Channel Details & Files"
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                            isDetailsOpen
                                ? "bg-[#17365D] text-white border-[#17365D]"
                                : "bg-[#F8FAFC] hover:bg-[#E2E8F0] text-[#17365D] border-[#E2E8F0]"
                        }`}
                    >
                        <i className="fa-solid fa-folder-open text-xs text-[#2878C7]"></i>
                        <span className="hidden sm:inline">Files & Info</span>
                    </button>

                    {/* Group Settings / Write Access Toggle for Admins */}
                    {isGroup && isGroupAdminOrCreator && !isActivity && (
                        <button
                            onClick={handleOpenSettings}
                            title="Group Settings & Permissions"
                            className="px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#E2E8F0] text-[#17212F] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-[#E2E8F0] shadow-2xs"
                        >
                            <i className="fa-solid fa-gear text-xs text-[#5B6573]"></i>
                            <span className="hidden sm:inline">Settings</span>
                        </button>
                    )}

                    {canDeleteGroup && (
                        <button
                            onClick={() => setIsDeleteModalOpen(true)}
                            title="Delete Group Channel"
                            className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-[#EF4444] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-red-200 shadow-2xs"
                        >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                            <span className="hidden sm:inline">Delete</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Group Settings Modal */}
            {isSettingsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-100">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                            <h3 className="font-bold text-slate-900 text-sm">Group Settings</h3>
                            <button
                                onClick={() => setIsSettingsModalOpen(false)}
                                className="w-7 h-7 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                            >
                                <i className="fa-solid fa-xmark text-sm"></i>
                            </button>
                        </div>

                        <form onSubmit={handleSaveGroupSettings} className="p-5 space-y-3.5 overflow-y-auto flex-1 no-scrollbar text-xs">
                            {/* Group Name */}
                            <div>
                                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
                                    Group Name *
                                </label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-xs font-semibold text-[#17212F] focus:outline-none focus:border-[#2878C7] focus:ring-1 focus:ring-[#2878C7]/20 bg-slate-50 focus:bg-white"
                                    required
                                />
                            </div>

                            {/* Who can post messages */}
                            <div>
                                <label className="block font-bold text-slate-700 uppercase tracking-wider text-[11px] mb-1.5">
                                    Who Can Message?
                                </label>
                                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setEditWhoCanPost("ALL_MEMBERS")}
                                        className={`py-1.5 rounded-md font-bold text-xs transition-all cursor-pointer ${editWhoCanPost === "ALL_MEMBERS"
                                                ? "bg-white text-slate-900 shadow-2xs"
                                                : "text-slate-500 hover:text-slate-900"
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditWhoCanPost("SELECTED_MEMBERS")}
                                        className={`py-1.5 rounded-md font-bold text-xs transition-all cursor-pointer ${editWhoCanPost === "SELECTED_MEMBERS"
                                                ? "bg-white text-slate-900 shadow-2xs"
                                                : "text-slate-500 hover:text-slate-900"
                                            }`}
                                    >
                                        Selected
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditWhoCanPost("ADMIN_ONLY")}
                                        className={`py-1.5 rounded-md font-bold text-xs transition-all cursor-pointer ${editWhoCanPost === "ADMIN_ONLY"
                                                ? "bg-white text-slate-900 shadow-2xs"
                                                : "text-slate-500 hover:text-slate-900"
                                            }`}
                                    >
                                        Admins Only
                                    </button>
                                </div>
                            </div>

                            {/* Member Selector Drawer when SELECTED_MEMBERS is active */}
                            {editWhoCanPost === "SELECTED_MEMBERS" && (
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                                            Members ({selectedMemberIds.length} can message)
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllMembers}
                                                className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                                            >
                                                Allow All
                                            </button>
                                            <span className="text-slate-300">|</span>
                                            <button
                                                type="button"
                                                onClick={handleDeselectAllMembers}
                                                className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                                            >
                                                Admins Only
                                            </button>
                                        </div>
                                    </div>

                                    <input
                                        type="text"
                                        placeholder="Search members..."
                                        value={memberSearch}
                                        onChange={(e) => setMemberSearch(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-[#E2E8F0] bg-slate-50 focus:bg-white text-xs mb-2 focus:outline-none focus:border-[#2878C7] focus:ring-1 focus:ring-[#2878C7]/20"
                                    />

                                    <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white no-scrollbar">
                                        {loadingMembers ? (
                                            <div className="py-4 text-center text-slate-400 text-xs">Loading...</div>
                                        ) : groupMembers.filter(m =>
                                            !memberSearch ||
                                            (m.name && m.name.toLowerCase().includes(memberSearch.toLowerCase())) ||
                                            (m.username && m.username.toLowerCase().includes(memberSearch.toLowerCase()))
                                        ).length === 0 ? (
                                            <p className="text-xs text-slate-400 text-center py-4">No members found</p>
                                        ) : (
                                            groupMembers
                                                .filter(m =>
                                                    !memberSearch ||
                                                    (m.name && m.name.toLowerCase().includes(memberSearch.toLowerCase())) ||
                                                    (m.username && m.username.toLowerCase().includes(memberSearch.toLowerCase()))
                                                )
                                                .map(member => {
                                                    const isMemberAdmin = member.conversation_role === 'ADMIN';
                                                    const canPost = isMemberAdmin || selectedMemberIds.includes(Number(member.id));
                                                    return (
                                                        <div
                                                            key={member.id}
                                                            className="flex items-center justify-between p-2.5 hover:bg-slate-50"
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                                                    {(member.name || member.username || "U")[0].toUpperCase()}
                                                                </div>
                                                                <span className="font-semibold text-slate-900 truncate">
                                                                    {member.name || member.username}
                                                                </span>
                                                            </div>

                                                            {isMemberAdmin ? (
                                                                <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                                    Admin
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleMemberSelection(member.id)}
                                                                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${canPost
                                                                            ? "bg-blue-50 text-[#2878C7] border-blue-200 hover:bg-blue-100"
                                                                            : "bg-slate-100 text-[#5B6573] border-[#E2E8F0] hover:bg-slate-200"
                                                                        }`}
                                                                >
                                                                    {canPost ? "Can Message" : "Read Only"}
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsSettingsModalOpen(false)}
                                    className="px-3.5 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingSettings}
                                    className="px-4 py-2 rounded-lg bg-[#17365D] hover:bg-[#102642] disabled:opacity-40 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
                                >
                                    {isSavingSettings && <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>}
                                    <span>Save Settings</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Group Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
                        <div className="p-5 text-center">
                            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3 text-lg shadow-2xs">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                            </div>
                            <h3 className="text-sm sm:text-base font-semibold text-slate-800 mb-1.5">Delete Group Channel?</h3>
                            <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
                                Are you sure you want to permanently delete <strong className="text-slate-800">"{conversation.title || 'this group'}"</strong>? All shared messages, documents, and photos will be permanently removed for all members.
                            </p>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    disabled={isDeletingGroup}
                                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteGroup}
                                    disabled={isDeletingGroup}
                                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                                >
                                    {isDeletingGroup ? (
                                        <>
                                            <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                                            Deleting...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-trash-can text-xs"></i>
                                            Confirm Delete
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Message Confirmation Modal */}
            {msgToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200 animate-in zoom-in-95">
                        <div className="p-5 text-center">
                            <div className="w-12 h-12 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-3 text-lg shadow-2xs">
                                <i className="fa-regular fa-trash-can"></i>
                            </div>
                            <h3 className="text-sm sm:text-base font-semibold text-slate-800 mb-1">Delete Message?</h3>
                            <p className="text-xs text-slate-500 mb-3.5 leading-relaxed">
                                Select an option below to delete this message.
                            </p>

                            {/* Message Preview Snippet */}
                            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 mb-4 text-left max-h-20 overflow-hidden text-ellipsis">
                                <p className="text-[10px] text-slate-400 font-semibold mb-0.5">
                                    {String(msgToDelete.sender_id) === String(currentUserId) ? "You" : msgToDelete.sender_name || "Sender"}:
                                </p>
                                <p className="text-xs text-slate-700 truncate">
                                    {msgToDelete.message_text || msgToDelete.content || (msgToDelete.file_name ? `📎 ${msgToDelete.file_name}` : "Message")}
                                </p>
                            </div>

                            <div className="flex flex-col gap-2">
                                {/* Delete for everyone option: available if message author or admin */}
                                {(String(msgToDelete.sender_id) === String(currentUserId) || isAdmin) && (
                                    <button
                                        type="button"
                                        disabled={isDeletingMessage}
                                        onClick={() => handleExecuteDelete("FOR_EVERYONE")}
                                        className="w-full py-2.5 px-4 rounded-lg bg-[#EF4444] hover:bg-red-600 text-white font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all disabled:opacity-50"
                                    >
                                        {isDeletingMessage ? (
                                            <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                                        ) : (
                                            <i className="fa-solid fa-users text-xs"></i>
                                        )}
                                        <span>Delete for Everyone</span>
                                    </button>
                                )}

                                {/* Delete for me option: available for any message */}
                                <button
                                    type="button"
                                    disabled={isDeletingMessage}
                                    onClick={() => handleExecuteDelete("FOR_ME")}
                                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 border border-slate-200"
                                >
                                    {isDeletingMessage ? (
                                        <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                                    ) : (
                                        <i className="fa-regular fa-user text-xs text-slate-500"></i>
                                    )}
                                    <span>Delete for Me</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={isDeletingMessage}
                                    onClick={() => setMsgToDelete(null)}
                                    className="w-full py-2 px-4 rounded-xl text-slate-500 hover:text-slate-700 font-medium text-xs cursor-pointer hover:bg-slate-50 transition-colors mt-1"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Messages Scroll Area */}
            <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto pl-2 sm:pl-3 pr-3 sm:pr-4 py-2.5 space-y-2.5 custom-chat-scrollbar">
                {/* Special Welcome & Joined Banner for #activity Channel */}
                {isActivity && (
                    <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-[#E2E8F0] shadow-xs mb-3 animate-in fade-in">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#17365D] text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-2xs">
                                <span className="text-[#38BDF8]">#</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                    <h4 className="text-xs sm:text-sm font-bold text-[#17212F] tracking-tight">
                                        Welcome to #activity
                                    </h4>
                                    <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#2878C7] text-[8px] font-bold tracking-wider">
                                        ALL EMPLOYEES
                                    </span>
                                </div>
                                <p className="text-[11px] text-[#5B6573] leading-relaxed mb-1.5 font-normal">
                                    This is the official company broadcast and activity feed. All employees are automatically enrolled here.
                                </p>
                                <div className="flex items-center gap-2 flex-wrap text-[10px] text-[#5B6573] font-normal">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#F6F8FB] border border-[#E2E8F0] text-[#17212F] font-medium">
                                        <i className="fa-solid fa-calendar-check text-[#2878C7] text-[10px]"></i>
                                        Enrolled: {formatJoinDate(conversation?.joined_at)}
                                    </span>
                                    <span className="text-[#94A3B8] text-[10px]">
                                        • Real-time updates enabled
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {messages.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-center p-6">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-2.5 text-lg shadow-2xs">
                            <i className="fa-regular fa-comment-dots"></i>
                        </div>
                        <p className="text-xs font-bold text-slate-700">No new messages yet</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            {isActivity
                                ? "New announcements and team activity will appear here as they are posted."
                                : "Send a message, take a photo, or share a file to start the conversation."}
                        </p>
                    </div>
                ) : (
                    messages.map((msg) => {
                        const isMe = String(msg.sender_id) === String(currentUserId);

                        // Render specialized Call Log message
                        if (msg.message_type === "CALL") {
                            let callData = msg.call_details;
                            if (!callData) {
                                try {
                                    callData = typeof msg.content === "string" && msg.content.startsWith("{")
                                        ? JSON.parse(msg.content)
                                        : (typeof msg.message_text === "string" && msg.message_text.startsWith("{")
                                            ? JSON.parse(msg.message_text)
                                            : null);
                                } catch { }
                            }

                            const callerId = callData?.callerId || msg.sender_id;
                            const isCaller = String(callerId) === String(currentUserId);
                            const status = callData?.status || "completed";
                            const isVideo = (callData?.callType || "").toLowerCase() === "video";
                            const duration = parseInt(callData?.duration, 10) || 0;

                            const formatCallDur = (s) => {
                                if (!s || s <= 0) return "";
                                const m = Math.floor(s / 60);
                                const sec = s % 60;
                                const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
                                return `${pad(m)}:${pad(sec)}`;
                            };

                            let callTitle = "";
                            let callSubtitle = "";
                            let iconClass = "";
                            let iconColor = "";
                            let badgeBg = "";
                            let isMissedCall = false;

                            if (status === "completed") {
                                if (isCaller) {
                                    callTitle = isVideo ? "Outgoing Video Call" : "Outgoing Voice Call";
                                    callSubtitle = formatCallDur(duration) ? `Duration: ${formatCallDur(duration)}` : "Answered";
                                    iconClass = isVideo ? "fa-solid fa-video" : "fa-solid fa-phone";
                                    iconColor = "text-emerald-600";
                                    badgeBg = "bg-emerald-50 border-emerald-200";
                                } else {
                                    callTitle = isVideo ? "Incoming Video Call" : "Incoming Voice Call";
                                    callSubtitle = formatCallDur(duration) ? `Duration: ${formatCallDur(duration)}` : "Answered";
                                    iconClass = isVideo ? "fa-solid fa-video" : "fa-solid fa-phone";
                                    iconColor = "text-emerald-600";
                                    badgeBg = "bg-emerald-50 border-emerald-200";
                                }
                            } else if (status === "declined") {
                                callTitle = isVideo ? "Declined Video Call" : "Declined Voice Call";
                                callSubtitle = isCaller ? "Call declined" : "Declined";
                                iconClass = isVideo ? "fa-solid fa-video" : "fa-solid fa-phone";
                                iconColor = "text-rose-600";
                                badgeBg = "bg-rose-50 border-rose-200";
                                isMissedCall = true;
                            } else {
                                if (!isCaller) {
                                    callTitle = isVideo ? "Missed Video Call" : "Missed Voice Call";
                                    callSubtitle = "Missed call";
                                    iconClass = isVideo ? "fa-solid fa-video" : "fa-solid fa-phone";
                                    iconColor = "text-rose-600";
                                    badgeBg = "bg-rose-50 border-rose-200";
                                    isMissedCall = true;
                                } else {
                                    callTitle = isVideo ? "Cancelled Video Call" : "Cancelled Voice Call";
                                    callSubtitle = "No answer";
                                    iconClass = isVideo ? "fa-solid fa-video" : "fa-solid fa-phone";
                                    iconColor = "text-slate-500";
                                    badgeBg = "bg-slate-100 border-slate-200";
                                }
                            }

                            const partnerTargetId = isCaller ? (callData?.receiverId || partnerId) : (callerId || partnerId);

                            return (
                                <div
                                    key={msg.id}
                                    className={`flex flex-col ${isMe ? "items-end" : "items-start"} group/msg mb-2.5 animate-message-pop`}
                                >
                                    <div className={`flex items-center gap-1.5 mb-1 text-[11px] px-0.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                                        <span className="font-medium text-slate-700">
                                            {isMe ? "You" : msg.sender_name || msg.sender_username || "Teammate"}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-normal ml-0.5">
                                            {formatMessageFullDate(msg.created_at)}
                                        </span>
                                    </div>

                                    <div className={`flex items-center gap-3 p-3 rounded-2xl border shadow-2xs max-w-sm sm:max-w-md ${isMe ? "bg-white border-slate-200/90 rounded-br-xs" : "bg-white border-slate-200/90 rounded-bl-xs"
                                        } hover:shadow-xs transition-all`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${badgeBg}`}>
                                            <i className={`${iconClass} text-sm ${iconColor}`}></i>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <h4 className={`text-xs font-bold truncate ${isMissedCall ? "text-rose-600" : "text-slate-800"}`}>
                                                    {callTitle}
                                                </h4>
                                            </div>

                                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px]">
                                                {callSubtitle && (
                                                    <span className={`font-semibold ${isMissedCall ? "text-rose-500" : "text-slate-600"}`}>
                                                        {callSubtitle}
                                                    </span>
                                                )}
                                                {callSubtitle && <span className="text-slate-300">•</span>}
                                                <span className="text-slate-400 text-[10px]">
                                                    {formatMessageTime(msg.created_at)}
                                                </span>
                                            </div>
                                        </div>


                                    </div>
                                </div>
                            );
                        }

                        const att = (msg.attachments && msg.attachments[0]) || null;
                        const attId = msg.attachmentId || att?.id || msg.id;
                        const attName = msg.file_name || att?.original_name || "";
                        const attType = (msg.file_type || att?.mime_type || "").toLowerCase();
                        const attSize = msg.file_size || att?.file_size || 0;

                        const hasAttachment = Boolean(attId && (attName || msg.message_type === 'FILE' || msg.message_type === 'IMAGE' || msg.message_type === 'VIDEO'));
                        const isImgAttachment = hasAttachment && (
                            attType.startsWith("image/") ||
                            /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif)$/i.test(attName) ||
                            msg.message_type === 'IMAGE'
                        );
                        const isVideoAttachment = hasAttachment && (
                            attType.startsWith("video/") ||
                            /\.(mp4|webm|ogg|mov|mkv|avi|m4v)$/i.test(attName) ||
                            msg.message_type === 'VIDEO'
                        );

                        return (
                            <div
                                key={msg.id}
                                className={`flex flex-col ${isMe ? "items-end" : "items-start"} group/msg mb-2 animate-message-pop`}
                            >
                                {/* Header: User Name, User ID pill badge, and Date */}
                                <div className={`flex items-center gap-1.5 mb-1 text-[11px] px-0.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                                    <span className="font-medium text-slate-700">
                                        {isMe ? "You" : msg.sender_name || msg.sender_username || "Teammate"}
                                    </span>

                                    <span className="text-[10px] text-slate-400 font-normal ml-0.5">
                                        {formatMessageFullDate(msg.created_at)}
                                    </span>
                                </div>

                                {/* Replied-to Quote Banner */}
                                {!msg.is_deleted && msg.reply_to_text && (
                                    <div
                                        className={`text-[11px] px-2.5 py-1 mb-1 rounded-lg max-w-md truncate border-l-2 ${isMe ? "border-[#2878C7] bg-[#102642]/60 text-slate-200 shadow-2xs" : "border-[#2878C7] bg-[#F8FAFC] text-[#5B6573]"
                                            }`}
                                    >
                                        <span className="font-semibold text-[#2878C7] mr-1">Replying:</span>
                                        {msg.reply_to_text}
                                    </div>
                                )}

                                <div className={`flex items-end gap-1.5 max-w-[92%] sm:max-w-xl ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                                    {/* Deleted Message Placeholder Bubble */}
                                    {msg.is_deleted ? (
                                        <div
                                            className={`rounded-xl px-3.5 py-2 border transition-all ${isMe
                                                    ? "bg-slate-100/80 text-slate-500 border-dashed border-slate-300 rounded-br-xs"
                                                    : "bg-slate-50 text-slate-500 border-dashed border-slate-200 rounded-bl-xs"
                                                }`}
                                        >
                                            <div className="italic text-slate-400 text-xs flex items-center gap-1.5 py-0.5 select-none">
                                                <i className="fa-solid fa-ban text-[11px] text-slate-400"></i>
                                                <span>This message was deleted</span>
                                            </div>
                                            <div className="text-[9px] mt-0.5 flex items-center justify-end text-slate-400">
                                                <span>{formatMessageTime(msg.created_at)}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Main Active Bubble */
                                        <div
                                            className={`rounded-xl p-2.5 sm:p-3 shadow-xs transition-all ${isMe
                                                    ? "bg-[#17365D] text-white border border-[#102642] rounded-br-xs"
                                                    : "bg-white text-[#17212F] border border-[#E2E8F0] rounded-bl-xs shadow-2xs"
                                                }`}
                                        >
                                            {/* Text content */}
                                            {(msg.message_text || msg.content) && (
                                                <p className="text-xs sm:text-[13px] whitespace-pre-wrap leading-relaxed break-words font-normal">
                                                    {msg.message_text || msg.content}
                                                </p>
                                            )}

                                            {/* File Attachment Card */}
                                            {hasAttachment && (
                                                <div
                                                    onClick={() => openInternalFile(msg)}
                                                    className={`mt-2 p-2.5 rounded-lg border transition-all cursor-pointer ${isMe
                                                            ? "bg-white/10 hover:bg-white/20 border-white/20 text-white shadow-2xs"
                                                            : "bg-[#F8FAFC] hover:bg-slate-100 border-[#E2E8F0] text-[#17212F]"
                                                        }`}
                                                >
                                                    {/* Image Thumbnail Preview if image */}
                                                    {isImgAttachment ? (
                                                        <div className="mb-2 overflow-hidden rounded-lg max-h-56 flex items-center justify-center bg-black/10">
                                                            <img
                                                                src={getAuthenticatedFileUrl(`/api/chat/files/${attId}/view`)}
                                                                alt={attName || "Photo"}
                                                                className="w-full h-auto object-cover max-h-56 rounded-lg pointer-events-none select-none hover:scale-102 transition-transform duration-200"
                                                                loading="lazy"
                                                                onLoad={() => {
                                                                    if (isAtBottomRef.current) scrollToBottomInstant();
                                                                }}
                                                                onError={(e) => {
                                                                    if (e.target.parentElement) {
                                                                        e.target.parentElement.style.display = "none";
                                                                    }
                                                                }}
                                                            />
                                                        </div>
                                                    ) : isVideoAttachment ? (
                                                        /* Video Preview / Player */
                                                        <div className="mb-2 overflow-hidden rounded-lg max-h-60 bg-black/80 relative flex items-center justify-center group/video">
                                                            <video
                                                                src={getAuthenticatedFileUrl(`/api/chat/files/${attId}/view`)}
                                                                controls
                                                                preload="metadata"
                                                                className="w-full max-h-60 rounded-lg"
                                                                onLoadedData={() => {
                                                                    if (isAtBottomRef.current) scrollToBottomInstant();
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                            {attSize > 0 && (
                                                                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-[10px] font-mono text-white flex items-center gap-1.5 pointer-events-none shadow-xs">
                                                                    <i className="fa-solid fa-film text-red-400 text-[9px]"></i>
                                                                    <span>{formatFileSize(attSize)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : null}

                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2.5 truncate">
                                                            <div
                                                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isMe
                                                                        ? "bg-white/20 text-[#38BDF8]"
                                                                        : isVideoAttachment
                                                                            ? "bg-red-50 text-red-600"
                                                                            : "bg-[#EFF6FF] text-[#2878C7]"
                                                                    }`}
                                                            >
                                                                <i
                                                                    className={
                                                                        isImgAttachment
                                                                            ? "fa-solid fa-image text-xs"
                                                                            : isVideoAttachment
                                                                                ? "fa-solid fa-film text-xs"
                                                                                : "fa-solid fa-file-shield text-xs"
                                                                    }
                                                                ></i>
                                                            </div>
                                                            <div className="truncate">
                                                                <p className="text-xs font-bold truncate">
                                                                    {attName || "Attachment"}
                                                                </p>
                                                                <p className={`text-[10px] ${isMe ? "text-slate-300" : "text-[#5B6573]"}`}>
                                                                    {attSize ? formatFileSize(attSize) : "Internal Media"} • {isVideoAttachment ? "Video Player" : isImgAttachment ? "Image Preview" : "Document"}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            <span
                                                                className={`px-2.5 py-1 rounded-md text-xs font-bold flex items-center gap-1 transition-colors ${isMe
                                                                        ? "bg-white/20 hover:bg-white/30 text-white border border-white/30 shadow-2xs"
                                                                        : "bg-[#EFF6FF] hover:bg-blue-100 text-[#2878C7] border border-blue-200"
                                                                    }`}
                                                            >
                                                                <i className="fa-solid fa-eye text-[10px]"></i> View
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Time and Status Footer */}
                                            <div
                                                className={`text-[9px] mt-1.5 flex items-center justify-end gap-1 ${isMe ? "text-slate-300" : "text-[#94A3B8]"
                                                    }`}
                                            >
                                                <span>{formatMessageTime(msg.created_at)}</span>
                                                {isMe && <i className="fa-solid fa-check-double text-[8px] text-[#38BDF8]"></i>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Quick Reply & Delete Action Buttons (visible on hover for active messages) */}
                                    {!msg.is_deleted && (
                                        <div className={`flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity shrink-0 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                                            {hasWriteAccess && (
                                                <button
                                                    onClick={() => setReplyingTo(msg)}
                                                    title="Reply to message"
                                                    className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
                                                >
                                                    <i className="fa-solid fa-reply"></i>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setMsgToDelete(msg)}
                                                title="Delete message"
                                                className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 cursor-pointer text-xs transition-colors"
                                            >
                                                <i className="fa-regular fa-trash-can"></i>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}

                {/* Typing Indicator */}
                {activeTypers.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 italic animate-pulse px-2 py-1">
                        <div className="flex gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.2s]"></span>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:0.4s]"></span>
                        </div>
                        <span>
                            {activeTypers.map((t) => t.userName).join(", ")} {activeTypers.length > 1 ? "are" : "is"} typing...
                        </span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Bottom Composer Area */}
            {!hasWriteAccess ? (
                /* Read-Only Banner when group or role restricts writing */
                <div className="p-3 sm:p-4 bg-slate-100/95 border-t border-slate-200 shrink-0 text-center flex items-center justify-center gap-2 text-xs font-bold text-slate-600">
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[10px]">
                        <i className="fa-solid fa-lock"></i>
                    </div>
                    <span>
                        {!canChat
                            ? "Messaging is restricted for your user role (Read-Only Mode)."
                            : "Only group administrators can send messages in this group."}
                    </span>
                </div>
            ) : (
                /* Active Bottom Composer */
                <div className="p-3 sm:p-4 bg-white border-t border-slate-200/90 shrink-0 shadow-2xs">
                    {/* Replying Banner */}
                    {replyingTo && (
                        <div className="mb-2 px-3.5 py-1.5 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-between text-xs text-[#17365D] animate-in fade-in">
                            <div className="flex items-center gap-2 truncate">
                                <i className="fa-solid fa-reply text-[#2878C7]"></i>
                                <span className="font-semibold text-[#2878C7]">{replyingTo.sender_name || "Coworker"}:</span>
                                <span className="truncate text-[#5B6573]">{replyingTo.message_text || "Attachment"}</span>
                            </div>
                            <button
                                onClick={() => setReplyingTo(null)}
                                className="text-slate-400 hover:text-slate-600 cursor-pointer ml-2"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    )}

                    {/* Selected File Banner */}
                    {selectedFile && (
                        <div className="mb-2 px-3.5 py-2 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900 animate-in fade-in">
                            <div className="flex items-center gap-2 truncate">
                                <i className="fa-solid fa-paperclip text-emerald-600"></i>
                                <span className="font-bold truncate">{selectedFile.name}</span>
                                <span className="text-emerald-700 text-[10px]">
                                    ({formatFileSize(selectedFile.size)})
                                </span>
                            </div>
                            <button
                                onClick={handleRemoveFile}
                                className="text-emerald-600 hover:text-emerald-800 cursor-pointer ml-2"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    )}

                    {/* Input Bar */}
                    <form onSubmit={handleSend} className="flex items-end gap-1.5 sm:gap-2">
                        {/* Attachment Button */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                if (!canUpload) {
                                    toast.error("Document upload permission is restricted for your role.");
                                    return;
                                }
                                fileInputRef.current?.click();
                            }}
                            title={canUpload ? "Attach Document" : "Upload Disabled"}
                            disabled={!canUpload}
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all duration-150 shrink-0 mb-0.5 ${canUpload
                                    ? "bg-slate-100 hover:bg-[#EFF6FF] text-[#5B6573] hover:text-[#2878C7] cursor-pointer"
                                    : "bg-slate-50 text-slate-300 cursor-not-allowed"
                                }`}
                        >
                            <i className="fa-solid fa-paperclip text-xs"></i>
                        </button>

                        {/* In-Built Camera Button */}
                        <button
                            type="button"
                            onClick={() => {
                                if (!canCamera) {
                                    toast.error("Camera access is restricted for your role.");
                                    return;
                                }
                                setIsCameraOpen(true);
                            }}
                            title={canCamera ? "Take Photo with Live Camera" : "Camera Access Restricted"}
                            disabled={!canCamera}
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all duration-150 shrink-0 mb-0.5 ${canCamera
                                    ? "bg-slate-100 hover:bg-emerald-50 text-[#5B6573] hover:text-emerald-600 cursor-pointer"
                                    : "bg-slate-50 text-slate-300 cursor-not-allowed"
                                }`}
                        >
                            <i className="fa-solid fa-camera text-xs"></i>
                        </button>

                        {/* Text Input Area */}
                        <textarea
                            ref={textareaRef}
                            rows={1}
                            value={messageText}
                            onChange={handleTextChange}
                            onKeyDown={handleKeyDown}
                            placeholder={
                                selectedFile
                                    ? "Add an optional note with your file..."
                                    : isActivity
                                        ? "Send message to #activity channel... (Shift+Enter for new line)"
                                        : "Type a message... (Shift+Enter for new line, Enter to send)"
                            }
                            className="flex-1 px-3.5 py-2 sm:py-2.5 rounded-lg bg-[#F6F8FB] focus:bg-white border border-[#E2E8F0] text-[#17212F] text-xs sm:text-[13px] focus:outline-none focus:ring-1 focus:ring-[#2878C7]/20 focus:border-[#2878C7] transition-all font-normal placeholder:text-[#94A3B8] resize-none max-h-36 overflow-y-auto leading-relaxed custom-chat-scrollbar"
                        />

                        {/* Send Button */}
                        <button
                            type="submit"
                            disabled={isUploading || (!messageText.trim() && !selectedFile)}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#2878C7] hover:bg-[#1e63a8] disabled:opacity-35 text-white flex items-center justify-center transition-all shadow-xs cursor-pointer shrink-0 mb-0.5"
                        >
                            {isUploading ? (
                                <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                            ) : (
                                <i className="fa-solid fa-paper-plane text-[11px]"></i>
                            )}
                        </button>
                    </form>
                </div>
            )}

            {/* In-Built Camera & Video Studio Modal */}
            {isCameraOpen && (
                <CameraCaptureModal
                    onClose={() => setIsCameraOpen(false)}
                    onSendMedia={handleCameraMedia}
                    onSendPhoto={handleCameraMedia}
                />
            )}
        </div>
    );
}
