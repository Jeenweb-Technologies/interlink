const db = require("../config/db.js");
const {
    getUserConversations,
    getConversationMessages,
    sendMessage,
    getOrCreateDirectConversation,
    createGroupOrBroadcast,
    markConversationRead,
    toggleMessageReaction,
    getChatSettings,
    updateChatSettings,
    getChatUserTypePermissions,
    saveChatUserTypePermission,
    getAllUserChatPermissions,
    saveUserChatPermission
} = require("../models/chatModel.js");
const { getIO } = require("../socket.js");

/**
 * Get all conversations for current user
 */
const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.user.company_id || 1;
        const conversations = await getUserConversations(userId, companyId);
        return res.status(200).json({ success: true, conversations });
    } catch (err) {
        console.error("Get Conversations Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch conversations" });
    }
};

/**
 * Get messages in a conversation
 */
const getMessages = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { limit, before } = req.query;
        const messages = await getConversationMessages(conversationId, limit, before);
        return res.status(200).json({ success: true, messages });
    } catch (err) {
        console.error("Get Messages Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch messages" });
    }
};

/**
 * Post a new message
 */
const postMessage = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const senderId = req.user.id;
        const {
            messageText,
            messageType = 'TEXT',
            fileUrl,
            fileName,
            fileSize,
            fileMime,
            parentMessageId,
            isAnnouncement
        } = req.body;

        const newMsg = await sendMessage({
            conversationId,
            senderId,
            messageText,
            messageType: req.file ? 'FILE' : messageType,
            fileUrl: req.file ? `/uploads/${req.file.filename}` : fileUrl,
            fileName: req.file ? req.file.originalname : fileName,
            fileSize: req.file ? req.file.size : fileSize,
            fileMime: req.file ? req.file.mimetype : fileMime,
            parentMessageId,
            isAnnouncement: !!isAnnouncement
        });

        // Emit through socket.io if initialized
        const io = getIO();
        if (io) {
            io.to(`conv_${conversationId}`).emit("new_message", newMsg);
        }

        return res.status(201).json({ success: true, message: newMsg });
    } catch (err) {
        console.error("Post Message Error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to send message" });
    }
};

/**
 * Start or get direct conversation with user from User Master
 */
const startDirectChat = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const { targetUserId } = req.body;
        const companyId = req.user.company_id || 1;

        if (!targetUserId) {
            return res.status(400).json({ success: false, message: "targetUserId is required" });
        }

        const convId = await getOrCreateDirectConversation(currentUserId, parseInt(targetUserId, 10), companyId);
        return res.status(200).json({ success: true, conversationId: convId });
    } catch (err) {
        console.error("Start Direct Chat Error:", err);
        return res.status(400).json({ success: false, message: err.message || "Could not start direct chat" });
    }
};

/**
 * Create group or broadcast channel
 */
const createChannel = async (req, res) => {
    try {
        const creatorId = req.user.id;
        const companyId = req.user.company_id || 1;
        const {
            type = 'GROUP',
            title,
            description,
            isAdminOnly,
            broadcastPriority,
            targetDepartmentId,
            memberIds = []
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: "Channel title is required" });
        }

        const convId = await createGroupOrBroadcast({
            companyId,
            type,
            title: title.trim(),
            description: description ? description.trim() : null,
            isAdminOnly,
            broadcastPriority,
            targetDepartmentId: targetDepartmentId ? parseInt(targetDepartmentId, 10) : null,
            creatorId,
            memberIds
        });

        return res.status(201).json({ success: true, conversationId: convId, message: `${type} created successfully` });
    } catch (err) {
        console.error("Create Channel Error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to create channel" });
    }
};

/**
 * Mark messages as read
 */
const markRead = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const userId = req.user.id;
        const { messageId } = req.body;

        const result = await markConversationRead(conversationId, userId, messageId);

        const io = getIO();
        if (io) {
            io.to(`conv_${conversationId}`).emit("conversation_read", result);
        }

        return res.status(200).json({ success: true, result });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to mark read" });
    }
};

/**
 * Toggle reaction emoji
 */
const reactMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.id;
        const { emoji, conversationId } = req.body;

        if (!emoji) return res.status(400).json({ success: false, message: "Emoji required" });

        const result = await toggleMessageReaction(messageId, userId, emoji);

        const io = getIO();
        if (io && conversationId) {
            io.to(`conv_${conversationId}`).emit("reaction_updated", result);
        }

        return res.status(200).json({ success: true, ...result });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to update reaction" });
    }
};

/**
 * Fetch available users from User Master to chat with
 * Filtered by user's Chat Scope & Department Permissions
 */
const getAvailableUsers = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const companyId = req.user.company_id || 1;
        const isSuper = req.user?.role === "super_admin" || req.user?.role === "super admin" || req.user?.role === "developer";
        const isAdmin = isSuper || req.user?.role === "admin";

        // Check user's communication scope
        let userScope = "DEPARTMENT_ONLY";
        let allowedDepts = [];
        let canDirectChat = true;
        let currentUserDept = null;

        const [currentUserRows] = await db.execute("SELECT department_id, role FROM users WHERE id = ?", [currentUserId]);
        if (currentUserRows.length > 0) {
            currentUserDept = currentUserRows[0].department_id;
        }

        if (!isAdmin) {
            const [scopeRows] = await db.execute(
                "SELECT chat_scope, allowed_department_ids, can_direct_chat FROM chat_user_department_permissions WHERE user_id = ?",
                [currentUserId]
            );
            if (scopeRows.length > 0) {
                userScope = scopeRows[0].chat_scope || "DEPARTMENT_ONLY";
                canDirectChat = Boolean(scopeRows[0].can_direct_chat);
                try {
                    allowedDepts = typeof scopeRows[0].allowed_department_ids === "string"
                        ? JSON.parse(scopeRows[0].allowed_department_ids)
                        : (scopeRows[0].allowed_department_ids || []);
                } catch (_) {
                    allowedDepts = [];
                }
            }
        } else {
            userScope = "COMPANY_WIDE";
        }

        if (!canDirectChat && !isAdmin) {
            return res.status(200).json({ success: true, users: [] });
        }

        let query = `
            SELECT 
                u.id, u.name, u.username, u.email, u.mob_no, u.role, u.active,
                u.department_id, dept.department_name,
                ut.type_name
            FROM users u
            LEFT JOIN departments dept ON u.department_id = dept.id
            LEFT JOIN user_types ut ON u.user_type_id = ut.id
            WHERE u.id != ? AND u.active = TRUE
        `;
        const params = [currentUserId];

        if (!isSuper) {
            query += " AND (u.company_id = ? OR ? = 1)";
            params.push(companyId, companyId);
        }

        // Apply Scope Filtering if not Company-Wide
        if (!isAdmin && userScope === "DEPARTMENT_ONLY") {
            if (currentUserDept) {
                query += " AND u.department_id = ?";
                params.push(currentUserDept);
            } else {
                // If user has no department, they can only chat with others who also have no department or none
                query += " AND u.department_id IS NULL";
            }
        } else if (!isAdmin && userScope === "MULTI_DEPARTMENT") {
            const validDepts = [currentUserDept, ...allowedDepts].filter(Boolean);
            if (validDepts.length > 0) {
                const placeholders = validDepts.map(() => "?").join(",");
                query += ` AND u.department_id IN (${placeholders})`;
                params.push(...validDepts);
            } else {
                query += " AND u.department_id IS NULL";
            }
        }

        query += " ORDER BY u.name ASC";

        const [users] = await db.execute(query, params);
        return res.status(200).json({ success: true, users });
    } catch (err) {
        console.error("Get Available Users Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch users" });
    }
};

/**
 * Get all users with their chat scope & department communication permissions
 */
const getAllUserPermissionsController = async (req, res) => {
    try {
        const companyId = req.user.company_id || 1;
        const users = await getAllUserChatPermissions(companyId);
        return res.status(200).json({ success: true, users });
    } catch (err) {
        console.error("Get All User Permissions Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch user permissions" });
    }
};

/**
 * Save user specific chat scope & department communication permission
 */
const saveUserPermissionController = async (req, res) => {
    try {
        const companyId = req.user.company_id || 1;
        const { userId } = req.params;
        const result = await saveUserChatPermission(companyId, parseInt(userId, 10), req.body);
        return res.status(200).json({ success: true, result, message: "User chat permission updated successfully" });
    } catch (err) {
        console.error("Save User Permission Error:", err);
        return res.status(500).json({ success: false, message: "Failed to save user permission" });
    }
};

/**
 * Get Company Chat Settings
 */
const getSettings = async (req, res) => {
    try {
        const companyId = req.user.company_id || 1;
        const settings = await getChatSettings(companyId);
        return res.status(200).json({ success: true, settings });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch chat settings" });
    }
};

/**
 * Update Company Chat Settings
 */
const updateSettings = async (req, res) => {
    try {
        const companyId = req.user.company_id || 1;
        const updated = await updateChatSettings(companyId, req.body);
        return res.status(200).json({ success: true, settings: updated, message: "Chat settings updated successfully" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to update chat settings" });
    }
};

/**
 * Get User Type Permissions for Chat
 */
const getUserTypePermissions = async (req, res) => {
    try {
        const companyId = req.user.company_id || 1;
        const permissions = await getChatUserTypePermissions(companyId);
        return res.status(200).json({ success: true, permissions });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch chat permissions" });
    }
};

/**
 * Save User Type Permissions for Chat
 */
const saveUserTypePermission = async (req, res) => {
    try {
        const companyId = req.user.company_id || 1;
        const { userTypeId } = req.params;
        const result = await saveChatUserTypePermission(companyId, parseInt(userTypeId, 10), req.body);
        return res.status(200).json({ success: true, result, message: "Permission saved" });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to save permission" });
    }
};

module.exports = {
    getConversations,
    getMessages,
    postMessage,
    startDirectChat,
    createChannel,
    markRead,
    reactMessage,
    getAvailableUsers,
    getSettings,
    updateSettings,
    getUserTypePermissions,
    saveUserTypePermission,
    getAllUserPermissionsController,
    saveUserPermissionController
};
