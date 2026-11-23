const {
    getUserConversations,
    createDirectConversation,
    createGroupConversation,
    getConversationMembers,
    isUserInConversation,
    resetUnreadCount,
    deleteConversation,
    updateGroupSettings
} = require("../models/conversationModel.js");

const canUserPostInConversation = async (conversationId, userId, userRole) => {
    if (userRole === 'admin' || userRole === 'super admin') return true;
    const [convRows] = await db.execute("SELECT id, type, created_by, is_announcement, is_master, who_can_post FROM conversations WHERE id = ?", [conversationId]);
    if (convRows.length === 0) return false;
    const conv = convRows[0];
    if (conv.type !== 'GROUP') return true;
    if (Number(conv.created_by) === Number(userId)) return true;

    const [memberRows] = await db.execute("SELECT role, can_post FROM conversation_members WHERE conversation_id = ? AND user_id = ?", [conversationId, userId]);
    if (memberRows.length === 0) return false;
    const mem = memberRows[0];

    if (mem.role === 'ADMIN') return true;

    if (conv.is_announcement || conv.who_can_post === 'ADMIN_ONLY') {
        return false;
    }

    if (conv.who_can_post === 'SELECTED_MEMBERS') {
        return (mem.can_post === null || mem.can_post === undefined) ? true : Boolean(mem.can_post);
    }

    return true;
};


const {
    createMessage,
    addAttachment,
    getConversationMessages,
    getMessageById,
    deleteMessageForMe,
    deleteMessageForEveryone,
    getAttachmentById,
    incrementAttachmentDownload
} = require("../models/messageModel.js");

const {
    createPoll,
    castVote,
    getPollDetails
} = require("../models/pollModel.js");

const {
    getUserNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    createNotification
} = require("../models/notificationModel.js");

const { searchCoworkers, getUserById } = require("../models/userModel.js");
const storageService = require("../services/storageService.js");
const { createAuditLog } = require("../models/auditLogModel.js");
const db = require("../config/db.js");

const {
    getUserDepartmentScope,
    doUsersShareDepartment,
    getDepartmentMembers,
    getUserDepartments
} = require("../models/departmentModel.js");

// ─── Conversations ─────────────────────────────────────────────────────────

const fetchUserConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversations = await getUserConversations(userId);
        return res.status(200).json({ success: true, data: conversations, conversations });
    } catch (err) {
        console.error("fetchUserConversations error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch conversations" });
    }
};

const startDirectChatController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { targetUserId } = req.body;

        if (!targetUserId) {
            return res.status(400).json({ success: false, message: "Target user ID is required" });
        }

        if (Number(targetUserId) === Number(userId)) {
            return res.status(400).json({ success: false, message: "Cannot start a chat with yourself" });
        }

        const creatorUser = await getUserById(userId);
        if (creatorUser?.is_vendor || req.user.is_vendor) {
            return res.status(403).json({
                success: false,
                message: "Access Denied: External vendors cannot initiate new conversations. You can reply when an authorized team member contacts you."
            });
        }

        const targetUser = await getUserById(targetUserId);
        if (!targetUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (targetUser.is_vendor) {
            const isCreatorAdmin = req.user.role === 'admin' || req.user.role === 'super admin' || Number(req.user.user_type_id) === 1;
            const canChatVendors = Boolean(creatorUser?.can_chat_with_vendors || req.user.can_chat_with_vendors || isCreatorAdmin);
            if (!canChatVendors) {
                return res.status(403).json({
                    success: false,
                    message: "Access Denied: You do not have permission to chat with external vendors. Please contact your administrator."
                });
            }
        }

        // Enforce Department Boundary
        const canChat = await doUsersShareDepartment(userId, targetUserId);
        if (!canChat) {
            return res.status(403).json({
                success: false,
                message: "Access Denied: You can only initiate direct chats with coworkers who belong to your authorized department(s)."
            });
        }

        const conversation = await createDirectConversation(userId, targetUserId);
        const members = await getConversationMembers(conversation.id);

        const convObj = {
            ...conversation,
            type: 'direct',
            other_user_id: targetUser.id,
            other_user_name: targetUser.name,
            other_user_username: targetUser.username,
            other_user_email: targetUser.email,
            other_user_mobile: targetUser.mob_no,
            displayTitle: targetUser.name || targetUser.username,
            partnerId: targetUser.id,
            last_message: ''
        };

        const io = req.app.get("io");
        if (io) {
            io.to(`user_${targetUserId}`).emit("conversation:new", {
                ...conversation,
                type: 'direct',
                other_user_id: req.user.id,
                other_user_name: req.user.name,
                other_user_username: req.user.username,
                other_user_email: req.user.email,
                other_user_mobile: req.user.mob_no,
                displayTitle: req.user.name || req.user.username,
                partnerId: req.user.id,
                last_message: ''
            });
            io.to(`user_${userId}`).emit("conversation:new", convObj);
        }

        return res.status(200).json({
            success: true,
            data: convObj,
            conversation: convObj,
            members
        });
    } catch (err) {
        console.error("startDirectChat error:", err);
        return res.status(500).json({ success: false, message: "Failed to start direct chat" });
    }
};

const createGroupController = async (req, res) => {
    try {
        const creatorId = req.user.id;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super admin';
        const {
            title,
            description,
            memberIds = [],
            isAnnouncement = false,
            isMaster = false,
            whoCanPost,
            who_can_post,
            departmentId,
            department_id,
            departmentIds,
            department_ids,
            companyId,
            company_id,
            companyIds,
            company_ids,
            isCompanyGroup,
            is_company_group,
            enrollAllScopeMembers,
            allowedMemberIds,
            allowed_member_ids
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: "Group title is required" });
        }

        const creatorUser = await getUserById(creatorId);
        if (creatorUser?.is_vendor || req.user.is_vendor) {
            return res.status(403).json({
                success: false,
                message: "Access Denied: External vendors cannot create group conversations."
            });
        }

        // Parse selected companies
        const rawCompanyIds = companyIds || company_ids || (companyId || company_id ? [companyId || company_id] : []);
        const selectedCompanyIds = (Array.isArray(rawCompanyIds) ? rawCompanyIds : [rawCompanyIds])
            .map(Number)
            .filter(Boolean);

        // Parse selected departments
        const rawDeptIds = departmentIds || department_ids || (departmentId || department_id ? [departmentId || department_id] : []);
        const selectedDeptIds = (Array.isArray(rawDeptIds) ? rawDeptIds : [rawDeptIds])
            .map(Number)
            .filter(Boolean);

        const isCompanyGroupEffective = Boolean(
            isCompanyGroup || is_company_group || selectedCompanyIds.length > 0
        );

        const scope = await getUserDepartmentScope(creatorId, req.user.role);

        // Scope verification for non-global admins
        if (!scope.isGlobalAdmin && !isMaster && !isAnnouncement) {
            // 1. Company Permission Check
            if (selectedCompanyIds.length > 0) {
                const userOwnCompany = scope.companyId ? Number(scope.companyId) : null;
                const allowedChatComps = (scope.allowedChatCompanies?.companyIds || []).map(Number);
                const canAllCompanies = Boolean(scope.canChatAllCompanies);

                if (!canAllCompanies) {
                    for (const compId of selectedCompanyIds) {
                        const hasAccess = (userOwnCompany && compId === userOwnCompany) || allowedChatComps.includes(compId);
                        if (!hasAccess) {
                            return res.status(403).json({
                                success: false,
                                message: `Access Denied: You do not have permission to create a group for company ID ${compId}.`
                            });
                        }
                    }
                }
            }

            // 2. Department Permission Check
            if (selectedDeptIds.length > 0) {
                const assignedDeptIds = (scope.departmentIds || []).map(Number);
                const allowedChatDeptIds = (scope.allowedChatDepartmentIds || []).map(Number);
                const crossDeptIds = (scope.allowedChatCompanies?.departmentIds || []).map(Number);
                const canAllDepts = Boolean(scope.canChatAllDepartments);

                if (!canAllDepts) {
                    for (const deptId of selectedDeptIds) {
                        const hasDeptAccess = assignedDeptIds.includes(deptId) ||
                            allowedChatDeptIds.includes(deptId) ||
                            crossDeptIds.includes(deptId);
                        if (!hasDeptAccess) {
                            return res.status(403).json({
                                success: false,
                                message: `Access Denied: You do not have permission to create a group for department ID ${deptId}.`
                            });
                        }
                    }
                }
            }
        }

        let effectiveMemberIds = Array.isArray(memberIds) ? memberIds.map(Number) : [];

        // Auto-enroll all members within the selected scope if requested
        if (enrollAllScopeMembers && (selectedCompanyIds.length > 0 || selectedDeptIds.length > 0)) {
            let whereClause = "WHERE (u.active = 1 OR u.is_active = 1)";
            const params = [];

            if (selectedCompanyIds.length > 0) {
                const placeholders = selectedCompanyIds.map(() => '?').join(',');
                whereClause += ` AND u.company_id IN (${placeholders})`;
                params.push(...selectedCompanyIds);
            }

            if (selectedDeptIds.length > 0) {
                const placeholders = selectedDeptIds.map(() => '?').join(',');
                whereClause += ` AND u.id IN (SELECT DISTINCT user_id FROM user_departments WHERE department_id IN (${placeholders}))`;
                params.push(...selectedDeptIds);
            }

            const [scopeUsers] = await db.execute(`SELECT id FROM users u ${whereClause}`, params);
            const scopeUserIds = scopeUsers.map(u => u.id);
            effectiveMemberIds = Array.from(new Set([...effectiveMemberIds, ...scopeUserIds]));
        }

        const effectiveWhoCanPost = who_can_post || whoCanPost || (isAnnouncement ? 'ADMIN_ONLY' : 'ALL_MEMBERS');

        const group = await createGroupConversation(title.trim(), {
            createdBy: creatorId,
            description: description || null,
            memberIds: effectiveMemberIds,
            isAnnouncement: isAdmin ? Boolean(isAnnouncement) : false,
            isMaster: isAdmin ? Boolean(isMaster) : false,
            isCompanyGroup: isCompanyGroupEffective,
            companyId: selectedCompanyIds[0] || null,
            companyIds: selectedCompanyIds,
            departmentId: selectedDeptIds[0] || null,
            departmentIds: selectedDeptIds,
            whoCanPost: effectiveWhoCanPost,
            allowedMemberIds: allowedMemberIds || allowed_member_ids || []
        });
        const members = await getConversationMembers(group.id);

        // Send system notification to invited members
        for (const m of members) {
            if (Number(m.id) !== Number(creatorId)) {
                await createNotification({
                    userId: m.id,
                    senderId: creatorId,
                    type: 'GROUP_INVITE',
                    title: isCompanyGroupEffective ? '🏢 New Company Group' : (isAnnouncement ? '📢 New Announcement Channel' : 'Added to Group'),
                    body: `You were added to "${title.trim()}" by ${req.user.name || req.user.username}.`,
                    linkUrl: `/chat?conv=${group.id}`
                });
            }
        }

        const groupObj = {
            ...group,
            type: 'group',
            displayTitle: group.title,
            who_can_post: group.who_can_post || effectiveWhoCanPost,
            is_announcement: Boolean(group.is_announcement),
            is_master: Boolean(group.is_master),
            is_company_group: Boolean(group.is_company_group || isCompanyGroupEffective),
            company_id: group.company_id,
            company_ids: selectedCompanyIds,
            company_name: group.company_name,
            company_code: group.company_code,
            department_id: group.department_id,
            department_ids: selectedDeptIds,
            department_name: group.department_name,
            members,
            last_message: ''
        };

        const io = req.app.get("io");
        if (io) {
            members.forEach(m => {
                io.to(`user_${m.id}`).emit("conversation:new", groupObj);
            });
        }

        return res.status(201).json({
            success: true,
            message: "Group created successfully",
            data: groupObj,
            conversation: groupObj,
            members
        });
    } catch (err) {
        console.error("createGroup error:", err);
        return res.status(500).json({ success: false, message: "Failed to create group" });
    }
};

const getGroupMembersController = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const members = await getConversationMembers(conversationId);
        return res.status(200).json({ success: true, members });
    } catch (err) {
        console.error("getGroupMembers error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch members" });
    }
};

const updateGroupSettingsController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const { title, description, who_can_post, whoCanPost, allowed_member_ids, allowedMemberIds } = req.body;
        const effectiveWhoCanPost = who_can_post || whoCanPost;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super admin';

        const [convRows] = await db.execute("SELECT * FROM conversations WHERE id = ?", [conversationId]);
        if (convRows.length === 0) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }
        const conv = convRows[0];
        if (conv.type !== 'GROUP') {
            return res.status(400).json({ success: false, message: "Only group channels have configurable settings" });
        }

        const isCreator = Number(conv.created_by) === Number(userId);
        const member = await isUserInConversation(conversationId, userId);
        const isGroupAdmin = member && member.role === 'ADMIN';

        if (!isAdmin && !isCreator && !isGroupAdmin) {
            return res.status(403).json({
                success: false,
                message: "Access Denied: Only group administrators can edit group settings."
            });
        }

        const updated = await updateGroupSettings(conversationId, {
            title,
            description,
            who_can_post: effectiveWhoCanPost,
            allowed_member_ids: allowed_member_ids || allowedMemberIds
        });

        const members = await getConversationMembers(conversationId);

        const io = req.app.get("io");
        if (io) {
            io.to(`conv_${conversationId}`).emit("conversation:updated", updated);
            members.forEach(m => {
                io.to(`user_${m.id || m.user_id}`).emit("conversation:updated", {
                    ...updated,
                    can_post: m.can_post
                });
            });
        }

        return res.status(200).json({
            success: true,
            message: "Group settings updated successfully",
            data: updated,
            conversation: updated,
            members
        });
    } catch (err) {
        console.error("updateGroupSettings error:", err);
        return res.status(500).json({ success: false, message: "Failed to update group settings" });
    }
};

const deleteGroupController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super admin';

        const [convRows] = await db.execute("SELECT * FROM conversations WHERE id = ?", [conversationId]);
        if (convRows.length === 0) {
            return res.status(404).json({ success: false, message: "Group not found" });
        }

        const conv = convRows[0];
        if (conv.type !== 'GROUP') {
            return res.status(400).json({ success: false, message: "Only group channels can be deleted" });
        }

        // Block deletion of system channels
        if (conv.is_activity || conv.is_master) {
            return res.status(403).json({
                success: false,
                message: "System channels (#activity, master announcements) cannot be deleted."
            });
        }

        // Authorization: Admin or Group Creator
        if (!isAdmin && Number(conv.created_by) !== Number(userId)) {
            return res.status(403).json({
                success: false,
                message: "Access Denied: Only administrators or the group creator can delete this group."
            });
        }

        // Fetch members before deletion to broadcast removal via socket
        const members = await getConversationMembers(conversationId);

        // Delete conversation and cascade data
        await deleteConversation(conversationId);

        // Broadcast deletion event to all participants
        const io = req.app.get("io");
        if (io) {
            io.to(`conv_${conversationId}`).emit("conversation:deleted", { conversationId: Number(conversationId) });
            members.forEach((m) => {
                io.to(`user_${m.id || m.user_id}`).emit("conversation:deleted", { conversationId: Number(conversationId) });
            });
        }

        return res.status(200).json({
            success: true,
            message: `Group "${conv.title || 'Group'}" deleted successfully`,
            conversationId: Number(conversationId)
        });
    } catch (err) {
        console.error("deleteGroup error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to delete group" });
    }
};


// ─── Messages ───────────────────────────────────────────────────────────────

const fetchConversationMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversationId } = req.params;
        const { limit = 50, beforeId } = req.query;
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super admin';

        const isMember = await isUserInConversation(conversationId, userId);
        if (!isMember && !isAdmin) {
            return res.status(403).json({ success: false, message: "You are not a member of this conversation" });
        }

        const [convRows] = await db.execute("SELECT id, type, title, is_activity, is_master, created_by FROM conversations WHERE id = ?", [conversationId]);
        const conv = convRows[0] || null;

        let joinedAtFilter = null;

        let canViewDocuments = true;
        if (!isAdmin) {
            const [userRows] = await db.execute("SELECT user_type_id FROM users WHERE id = ?", [userId]);
            const userTypeId = userRows[0]?.user_type_id;
            if (userTypeId) {
                const [permRows] = await db.execute(
                    "SELECT can_read FROM user_type_permissions WHERE user_type_id = ? AND master_name = 'document_view'",
                    [userTypeId]
                );
                if (permRows.length > 0) {
                    canViewDocuments = Boolean(permRows[0].can_read);
                }
            }
        }

        const messages = await getConversationMessages(conversationId, limit, beforeId, joinedAtFilter, userId);

        // If user cannot view documents, redact attachment data
        if (!canViewDocuments) {
            for (const msg of messages) {
                if (msg.attachments && msg.attachments.length > 0) {
                    msg.attachments = [];
                    msg.attachmentId = null;
                    msg.file_name = null;
                    msg.file_type = null;
                    msg.file_size = null;
                    msg.is_attachment_restricted = true;
                }
            }
        }

        // Populate polls if messages have poll_id
        for (const msg of messages) {
            if (msg.poll_id) {
                msg.poll = await getPollDetails(msg.poll_id, userId);
            }
        }

        // Reset unread count
        await resetUnreadCount(conversationId, userId);

        return res.status(200).json({
            success: true,
            data: messages,
            messages,
            joinedAt: isMember?.joined_at || null,
            isActivity: Boolean(conv?.is_activity || conv?.title === '#activity')
        });
    } catch (err) {
        console.error("fetchConversationMessages error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch messages" });
    }
};

const sendMessageController = async (req, res) => {
    try {
        const userId = req.user.id;
        const conversationId = req.body.conversationId;
        const content = req.body.content || req.body.messageText || '';
        const replyToId = req.body.replyToId || req.body.parentMessageId || null;
        const attachmentId = req.body.attachmentId || null;
        const messageType = req.body.messageType || (attachmentId ? 'FILE' : 'TEXT');

        if (!conversationId || (!content && !attachmentId)) {
            return res.status(400).json({ success: false, message: "Conversation ID and content or attachment are required" });
        }

        const isMember = await isUserInConversation(conversationId, userId);
        if (!isMember && req.user.role !== 'admin' && req.user.role !== 'super admin') {
            return res.status(403).json({ success: false, message: "You are not a member of this conversation" });
        }

        const canPost = await canUserPostInConversation(conversationId, userId, req.user.role);
        if (!canPost) {
            return res.status(403).json({ success: false, message: "Only group administrators can send messages in this group." });
        }

        const message = await createMessage({
            conversationId,
            senderId: userId,
            content: content || '',
            messageType,
            replyToId
        });

        if (attachmentId) {
            await db.execute("UPDATE message_attachments SET message_id = ? WHERE id = ?", [message.id, attachmentId]);
            const [attRows] = await db.execute("SELECT original_name, mime_type FROM message_attachments WHERE id = ?", [attachmentId]);
            const att = attRows[0];
            const isImage = att?.mime_type?.startsWith("image/");
            const isVideo = att?.mime_type?.startsWith("video/");
            const previewText = (content && content.trim()) 
                ? content.trim() 
                : '📎 Attachment';

            await db.execute(
                `UPDATE conversations SET last_message_text = ?, last_message_at = NOW() WHERE id = ?`,
                [previewText.slice(0, 200), conversationId]
            );
        }

        const fullMsg = await getMessageById(message.id);

        // Broadcast via Socket.IO if available
        const io = req.app.get("io");
        if (io) {
            io.to(`conv_${conversationId}`).emit("message:new", fullMsg);
            const members = await getConversationMembers(conversationId);
            members.forEach((m) => {
                io.to(`user_${m.id || m.user_id}`).emit("message:new", fullMsg);
            });
        }

        return res.status(201).json({ success: true, data: fullMsg, message: fullMsg });
    } catch (err) {
        console.error("sendMessage error:", err);
        return res.status(500).json({ success: false, message: "Failed to send message" });
    }
};

const deleteMessageController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;
        const deleteType = req.body?.deleteType || 'FOR_ME'; // 'FOR_ME' or 'FOR_EVERYONE'
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super admin';

        const msg = await getMessageById(messageId);
        if (!msg) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        const isMember = await isUserInConversation(msg.conversation_id, userId);
        if (!isMember && !isAdmin) {
            return res.status(403).json({ success: false, message: "You are not a participant in this conversation" });
        }

        if (deleteType === 'FOR_EVERYONE') {
            const isSender = Number(msg.sender_id) === Number(userId);
            if (!isSender && !isAdmin) {
                return res.status(403).json({
                    success: false,
                    message: "You can only delete your own messages for everyone"
                });
            }

            await deleteMessageForEveryone(messageId);

            // Recompute latest message for this conversation
            const [lastRows] = await db.execute(`
                SELECT m.id, m.content, m.is_deleted, m.created_at,
                       ma.original_name, ma.mime_type
                FROM messages m
                LEFT JOIN message_attachments ma ON m.id = ma.message_id
                WHERE m.conversation_id = ?
                ORDER BY m.id DESC
                LIMIT 1
            `, [msg.conversation_id]);

            let newLastText = '';
            let newLastAt = null;
            if (lastRows.length > 0) {
                const lm = lastRows[0];
                newLastAt = lm.created_at;
                if (lm.is_deleted) {
                    newLastText = 'This message was deleted';
                } else if (lm.content && lm.content.trim()) {
                    newLastText = lm.content.trim();
                } else if (lm.original_name) {
                    newLastText = '📎 Attachment';
                } else {
                    newLastText = 'Message';
                }
            }

            await db.execute(
                `UPDATE conversations SET last_message_text = ?, last_message_at = ? WHERE id = ?`,
                [newLastText.slice(0, 200), newLastAt, msg.conversation_id]
            );

            // Broadcast deletion event to conversation room and user rooms
            const io = req.app.get("io");
            if (io) {
                const deletedPayload = {
                    messageId: Number(messageId),
                    conversationId: Number(msg.conversation_id),
                    deleteType: 'FOR_EVERYONE',
                    lastMessageText: newLastText,
                    lastMessageAt: newLastAt
                };
                io.to(`conv_${msg.conversation_id}`).emit("message:deleted", deletedPayload);
                const members = await getConversationMembers(msg.conversation_id);
                members.forEach((m) => {
                    io.to(`user_${m.id || m.user_id}`).emit("message:deleted", deletedPayload);
                });
            }

            return res.status(200).json({
                success: true,
                message: "Message deleted for everyone",
                messageId: Number(messageId),
                deleteType: 'FOR_EVERYONE',
                lastMessageText: newLastText,
                lastMessageAt: newLastAt
            });
        } else {
            // Delete for me only
            await deleteMessageForMe(messageId, userId);

            // Recompute latest message visible to this user
            const [lastRows] = await db.execute(`
                SELECT m.id, m.content, m.is_deleted, m.created_at,
                       ma.original_name, ma.mime_type
                FROM messages m
                LEFT JOIN message_attachments ma ON m.id = ma.message_id
                WHERE m.conversation_id = ?
                  AND m.id NOT IN (SELECT message_id FROM message_deletions WHERE user_id = ?)
                ORDER BY m.id DESC
                LIMIT 1
            `, [msg.conversation_id, userId]);

            let newLastText = '';
            let newLastAt = null;
            if (lastRows.length > 0) {
                const lm = lastRows[0];
                newLastAt = lm.created_at;
                if (lm.is_deleted) {
                    newLastText = 'This message was deleted';
                } else if (lm.content && lm.content.trim()) {
                    newLastText = lm.content.trim();
                } else if (lm.original_name) {
                    newLastText = '📎 Attachment';
                } else {
                    newLastText = 'Message';
                }
            }

            return res.status(200).json({
                success: true,
                message: "Message deleted for you",
                messageId: Number(messageId),
                deleteType: 'FOR_ME',
                lastMessageText: newLastText,
                lastMessageAt: newLastAt
            });
        }
    } catch (err) {
        console.error("deleteMessageController error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete message" });
    }
};

// ─── File Upload & Permissions ─────────────────────────────────────────────

const uploadFileController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversationId, content = '' } = req.body;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ success: false, message: "No file provided" });
        }

        if (conversationId) {
            const isMember = await isUserInConversation(conversationId, userId);
            if (!isMember && req.user.role !== 'admin' && req.user.role !== 'super admin') {
                return res.status(403).json({ success: false, message: "You are not a member of this conversation" });
            }

            const canPost = await canUserPostInConversation(conversationId, userId, req.user.role);
            if (!canPost) {
                return res.status(403).json({ success: false, message: "Only group administrators can send attachments in this group." });
            }
        }

        // Upload to Storage (Microsoft Azure, Google Drive, Google Cloud Storage or Local disk)
        const isImage = file.mimetype.startsWith("image/");
        const isVideo = file.mimetype.startsWith("video/");
        const storedName = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

        const storageResult = await storageService.uploadFile({
            buffer: file.buffer,
            originalName: file.originalname,
            storedName,
            mimeType: file.mimetype
        });

        if (conversationId) {
            // Create message record
            const msgType = isImage ? 'IMAGE' : (isVideo ? 'VIDEO' : 'FILE');
            const previewSnippet = (content && content.trim()) 
                ? content.trim() 
                : '📎 Attachment';

            const message = await createMessage({
                conversationId,
                senderId: userId,
                content: content || '',
                messageType: msgType
            });

            // Create attachment record
            const attachmentId = await addAttachment({
                messageId: message.id,
                originalName: file.originalname,
                storedName,
                mimeType: file.mimetype,
                fileSize: file.size,
                storageProvider: storageResult.storageProvider,
                cloudBucket: storageResult.cloudBucket,
                cloudKey: storageResult.cloudKey,
                publicUrl: storageResult.publicUrl,
                uploadedBy: userId
            });

            await db.execute(
                `UPDATE conversations SET last_message_text = ?, last_message_at = NOW() WHERE id = ?`,
                [previewSnippet.slice(0, 200), conversationId]
            );

            const fullMessage = await getMessageById(message.id);

            const io = req.app.get("io");
            if (io) {
                io.to(`conv_${conversationId}`).emit("message:new", fullMessage);
                const members = await getConversationMembers(conversationId);
                members.forEach((m) => {
                    io.to(`user_${m.id || m.user_id}`).emit("message:new", fullMessage);
                });
            }

            return res.status(201).json({
                success: true,
                data: {
                    attachmentId,
                    id: attachmentId,
                    originalName: file.originalname,
                    fileType: file.mimetype,
                    fileSize: file.size,
                    viewUrl: `/api/chat/files/${attachmentId}/view`,
                    downloadUrl: `/api/chat/files/${attachmentId}/download`,
                    message: fullMessage
                },
                message: fullMessage
            });
        } else {
            // Standalone attachment upload
            const attachmentId = await addAttachment({
                messageId: null,
                originalName: file.originalname,
                storedName,
                mimeType: file.mimetype,
                fileSize: file.size,
                storageProvider: storageResult.storageProvider,
                cloudBucket: storageResult.cloudBucket,
                cloudKey: storageResult.cloudKey,
                publicUrl: storageResult.publicUrl,
                uploadedBy: userId
            });

            return res.status(201).json({
                success: true,
                data: {
                    attachmentId,
                    id: attachmentId,
                    originalName: file.originalname,
                    fileType: file.mimetype,
                    fileSize: file.size,
                    viewUrl: `/api/chat/files/${attachmentId}/view`,
                    downloadUrl: `/api/chat/files/${attachmentId}/download`
                }
            });
        }
    } catch (err) {
        console.error("uploadFile error:", err);
        return res.status(500).json({ success: false, message: "Failed to upload file" });
    }
};

const viewFileController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { attachmentId } = req.params;
        const attachment = await getAttachmentById(attachmentId);

        if (!attachment) {
            return res.status(404).json({ success: false, message: "Attachment not found" });
        }

        // Check view permission if non-admin
        if (req.user.role !== 'admin' && req.user.role !== 'super admin') {
            const [userRows] = await db.execute("SELECT user_type_id FROM users WHERE id = ?", [userId]);
            const userTypeId = userRows[0]?.user_type_id;

            if (userTypeId) {
                const [permRows] = await db.execute(
                    "SELECT can_read FROM user_type_permissions WHERE user_type_id = ? AND master_name = 'document_view'",
                    [userTypeId]
                );
                const canView = permRows.length > 0 ? Boolean(permRows[0].can_read) : true;
                if (!canView) {
                    return res.status(403).json({
                        success: false,
                        message: "Access Denied: Your role does not have permission to view documents."
                    });
                }
            }
        }

        res.setHeader("Content-Type", attachment.mime_type || "application/octet-stream");
        res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(attachment.original_name)}"`);
        res.setHeader("X-Content-Type-Options", "nosniff");

        const stream = await storageService.getFileStream(attachment);
        stream.pipe(res);
    } catch (err) {
        console.error("viewFile error:", err);
        return res.status(500).json({ success: false, message: "Failed to view file" });
    }
};

const downloadFileController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { attachmentId } = req.params;
        const attachment = await getAttachmentById(attachmentId);

        if (!attachment) {
            return res.status(404).json({ success: false, message: "Attachment not found" });
        }

        // Granular permission check: document_download & device-level allow_download check
        if (req.user.role !== 'admin' && req.user.role !== 'super admin') {
            // Check device-level download policy
            const reqDeviceId = String(req.headers['x-device-id'] || req.headers['device-id'] || '').trim();
            let deviceRows = [];
            if (reqDeviceId && reqDeviceId !== 'BROWSER_DEVICE') {
                [deviceRows] = await db.execute(
                    "SELECT allow_download FROM user_devices WHERE user_id = ? AND (device_id = ? OR TRIM(device_id) = ?) AND status = 'approved' AND closed_at IS NULL LIMIT 1",
                    [userId, reqDeviceId, reqDeviceId]
                );
            }
            if (deviceRows.length === 0) {
                [deviceRows] = await db.execute(
                    "SELECT allow_download FROM user_devices WHERE user_id = ? AND status = 'approved' AND closed_at IS NULL ORDER BY approved_at DESC LIMIT 1",
                    [userId]
                );
            }
            if (deviceRows.length > 0 && (deviceRows[0].allow_download === 0 || deviceRows[0].allow_download === false)) {
                return res.status(403).json({
                    success: false,
                    message: "Access Denied: File downloads are disabled on this device by administrator policy. You can view documents securely in-app."
                });
            }

            const [userRows] = await db.execute("SELECT user_type_id FROM users WHERE id = ?", [userId]);
            const userTypeId = userRows[0]?.user_type_id;

            if (userTypeId) {
                const [permRows] = await db.execute(
                    "SELECT can_read FROM user_type_permissions WHERE user_type_id = ? AND master_name = 'document_download'",
                    [userTypeId]
                );
                const canDownload = permRows.length > 0 ? Boolean(permRows[0].can_read) : true;
                if (!canDownload) {
                    return res.status(403).json({
                        success: false,
                        message: "Access Denied: Your role is restricted from downloading files. You can only view documents inside the application."
                    });
                }
            }
        }

        await incrementAttachmentDownload(attachmentId);

        res.setHeader("Content-Type", "application/octet-stream");
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(attachment.original_name)}"`);
        res.setHeader("Content-Length", attachment.file_size);

        const stream = await storageService.getFileStream(attachment);
        stream.pipe(res);
    } catch (err) {
        console.error("downloadFile error:", err);
        return res.status(500).json({ success: false, message: "Failed to download file" });
    }
};

// ─── Polls ──────────────────────────────────────────────────────────────────

const createPollController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { conversationId, question, options, isMultipleChoice = false } = req.body;

        if (!conversationId || !question || !options || options.length < 2) {
            return res.status(400).json({
                success: false,
                message: "Conversation ID, question, and at least 2 options are required"
            });
        }

        const isMember = await isUserInConversation(conversationId, userId);
        if (!isMember && req.user.role !== 'admin' && req.user.role !== 'super admin') {
            return res.status(403).json({ success: false, message: "You are not a member of this conversation" });
        }

        const canPost = await canUserPostInConversation(conversationId, userId, req.user.role);
        if (!canPost) {
            return res.status(403).json({ success: false, message: "Posting is restricted in this conversation." });
        }

        const poll = await createPoll({
            conversationId,
            creatorId: userId,
            question,
            options,
            isMultipleChoice
        });

        // Create in-chat message for poll
        const message = await createMessage({
            conversationId,
            senderId: userId,
            content: `📊 Poll: ${question}`,
            messageType: 'POLL',
            pollId: poll.id
        });

        message.poll = poll;

        const io = req.app.get("io");
        if (io) {
            io.to(`conv_${conversationId}`).emit("message:new", message);
            io.to(`conv_${conversationId}`).emit("poll:new", poll);
            const members = await getConversationMembers(conversationId);
            members.forEach((m) => {
                io.to(`user_${m.id || m.user_id}`).emit("message:new", message);
            });
        }

        return res.status(201).json({ success: true, poll, message });
    } catch (err) {
        console.error("createPoll error:", err);
        return res.status(500).json({ success: false, message: "Failed to create poll" });
    }
};

const votePollController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { pollId } = req.params;
        const { optionId } = req.body;

        if (!optionId) {
            return res.status(400).json({ success: false, message: "Option ID is required" });
        }

        const updatedPoll = await castVote({
            pollId,
            optionId,
            userId
        });

        const io = req.app.get("io");
        if (io) {
            io.to(`conv_${updatedPoll.conversation_id}`).emit("poll:updated", updatedPoll);
            io.to(`conv_${updatedPoll.conversation_id}`).emit("poll:voted", {
                pollId: Number(pollId),
                poll: updatedPoll,
                options: updatedPoll.options,
                voterId: userId
            });
        }

        return res.status(200).json({ success: true, poll: updatedPoll });
    } catch (err) {
        console.error("votePoll error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to vote" });
    }
};

const searchCoworkersController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { q = '', departmentId, departmentIds, companyId, companyIds } = req.query;

        const scope = await getUserDepartmentScope(userId, req.user.role);
        let allowedDeptIds = null;

        let targetDeptIds = null;
        if (departmentIds) {
            targetDeptIds = String(departmentIds).split(',').map(s => Number(s.trim())).filter(Boolean);
        } else if (departmentId) {
            targetDeptIds = [Number(departmentId)];
        }

        let targetCompanyIds = null;
        if (companyIds) {
            targetCompanyIds = String(companyIds).split(',').map(s => Number(s.trim())).filter(Boolean);
        } else if (companyId) {
            targetCompanyIds = [Number(companyId)];
        }

        if (targetDeptIds && targetDeptIds.length > 0) {
            if (!scope.isGlobalAdmin && !scope.canChatAllDepartments) {
                const invalid = targetDeptIds.filter(id => !scope.chatDepartmentIds.includes(id));
                if (invalid.length > 0) {
                    return res.status(403).json({
                        success: false,
                        message: "Access Denied: You do not have chat access to one or more selected departments."
                    });
                }
            }
            allowedDeptIds = targetDeptIds;
        } else if (!scope.isGlobalAdmin && !scope.canChatAllDepartments) {
            allowedDeptIds = scope.chatDepartmentIds;
        }

        const coworkers = await searchCoworkers(q, userId, allowedDeptIds, scope, {
            companyIds: targetCompanyIds,
            departmentIds: targetDeptIds
        });
        return res.status(200).json({ success: true, data: coworkers, coworkers });
    } catch (err) {
        console.error("searchCoworkers error:", err);
        return res.status(500).json({ success: false, message: "Search failed" });
    }
};

// ─── Notifications ──────────────────────────────────────────────────────────

const getNotificationsController = async (req, res) => {
    try {
        const userId = req.user.id;
        const notifications = await getUserNotifications(userId);
        const unreadCount = await getUnreadNotificationCount(userId);
        return res.status(200).json({ success: true, data: notifications, notifications, unreadCount });
    } catch (err) {
        console.error("getNotifications error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch notifications" });
    }
};

const markNotificationReadController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        if (id === 'all') {
            await markAllNotificationsAsRead(userId);
        } else {
            await markNotificationAsRead(id, userId);
        }

        return res.status(200).json({ success: true, message: "Notification updated" });
    } catch (err) {
        console.error("markNotificationRead error:", err);
        return res.status(500).json({ success: false, message: "Failed to update notification" });
    }
};

const getOnlineUsersController = (req, res) => {
    try {
        if (req.user?.id) {
            const activeMap = req.app.get("userLastSeen") || new Map();
            activeMap.set(String(req.user.id), Date.now());
            req.app.set("userLastSeen", activeMap);
        }

        const onlineUsersMap = req.app.get("onlineUsers") || new Map();
        const socketOnline = Array.from(onlineUsersMap.keys()).map(String);

        const userLastSeen = req.app.get("userLastSeen") || new Map();
        const now = Date.now();
        const recentOnline = [];
        for (const [uid, time] of userLastSeen.entries()) {
            if (now - time < 60000) {
                recentOnline.push(String(uid));
            } else {
                userLastSeen.delete(uid);
            }
        }

        const combined = Array.from(new Set([...socketOnline, ...recentOnline]));
        return res.status(200).json({
            success: true,
            onlineUserIds: combined
        });
    } catch (err) {
        console.error("getOnlineUsersController error:", err);
        return res.status(200).json({ success: true, onlineUserIds: [] });
    }
};

module.exports = {
    fetchUserConversations,
    startDirectChatController,
    createGroupController,
    getGroupMembersController,
    updateGroupSettingsController,
    deleteGroupController,
    fetchConversationMessages,
    sendMessageController,
    uploadFileController,
    viewFileController,
    downloadFileController,
    createPollController,
    votePollController,
    searchCoworkersController,
    getNotificationsController,
    markNotificationReadController,
    getOnlineUsersController,
    deleteMessageController
};

