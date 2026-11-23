const db = require("../config/db.js");

/**
 * Initialize Chat Schema and Tables
 */
const createChatTables = async () => {
    // 1. Conversations Table
    const createConversationsQuery = `
        CREATE TABLE IF NOT EXISTS chat_conversations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT DEFAULT 1,
            type ENUM('DIRECT', 'GROUP', 'BROADCAST') NOT NULL DEFAULT 'DIRECT',
            title VARCHAR(150) NULL,
            description VARCHAR(255) NULL,
            avatar_url VARCHAR(255) NULL,
            is_admin_only BOOLEAN DEFAULT FALSE,
            broadcast_priority ENUM('NORMAL', 'URGENT', 'COMPANY_UPDATE', 'POLICY_CHANGE') DEFAULT 'NORMAL',
            target_department_id INT NULL,
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cc_company (company_id),
            INDEX idx_cc_type (type)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createConversationsQuery);

    // 2. Participants Table
    const createParticipantsQuery = `
        CREATE TABLE IF NOT EXISTS chat_participants (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT NOT NULL,
            user_id INT NOT NULL,
            role ENUM('ADMIN', 'MEMBER') DEFAULT 'MEMBER',
            last_read_message_id INT DEFAULT 0,
            last_read_at TIMESTAMP NULL,
            is_muted BOOLEAN DEFAULT FALSE,
            is_pinned BOOLEAN DEFAULT FALSE,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_conv_user (conversation_id, user_id),
            INDEX idx_cp_user (user_id),
            INDEX idx_cp_conv (conversation_id),
            FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createParticipantsQuery);

    // 3. Messages Table
    const createMessagesQuery = `
        CREATE TABLE IF NOT EXISTS chat_messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT NOT NULL,
            sender_id INT NOT NULL,
            message_text TEXT NULL,
            message_type ENUM('TEXT', 'IMAGE', 'FILE', 'SYSTEM') DEFAULT 'TEXT',
            file_url VARCHAR(255) NULL,
            file_name VARCHAR(255) NULL,
            file_size INT NULL,
            file_mime VARCHAR(100) NULL,
            parent_message_id INT NULL,
            is_pinned BOOLEAN DEFAULT FALSE,
            is_announcement BOOLEAN DEFAULT FALSE,
            reactions JSON DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cm_conv (conversation_id),
            INDEX idx_cm_sender (sender_id),
            INDEX idx_cm_created (created_at),
            FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createMessagesQuery);

    // 4. Chat Settings Table (Company Governance Master)
    const createSettingsQuery = `
        CREATE TABLE IF NOT EXISTS chat_settings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT DEFAULT 1,
            allow_direct_messaging BOOLEAN DEFAULT TRUE,
            allow_group_creation VARCHAR(50) DEFAULT 'ALL',
            allow_broadcast_creation VARCHAR(50) DEFAULT 'ADMIN_ONLY',
            allow_file_sharing BOOLEAN DEFAULT TRUE,
            max_file_size_mb INT DEFAULT 25,
            cross_department_chat BOOLEAN DEFAULT TRUE,
            read_receipts_enabled BOOLEAN DEFAULT TRUE,
            typing_indicators_enabled BOOLEAN DEFAULT TRUE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_cs_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createSettingsQuery);

    // 5. Chat User Type Permissions Table
    const createUserTypePermsQuery = `
        CREATE TABLE IF NOT EXISTS chat_user_type_permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT DEFAULT 1,
            user_type_id INT NOT NULL,
            can_direct_chat BOOLEAN DEFAULT TRUE,
            can_create_group BOOLEAN DEFAULT TRUE,
            can_create_broadcast BOOLEAN DEFAULT FALSE,
            can_send_files BOOLEAN DEFAULT TRUE,
            UNIQUE KEY uq_cutp (company_id, user_type_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createUserTypePermsQuery);

    // Ensure default settings exist for company 1
    try {
        const [settingsRows] = await db.execute("SELECT id FROM chat_settings WHERE company_id = 1");
        if (settingsRows.length === 0) {
            await db.execute(`
                INSERT INTO chat_settings (company_id, allow_direct_messaging, allow_group_creation, allow_broadcast_creation, allow_file_sharing, max_file_size_mb, cross_department_chat, read_receipts_enabled, typing_indicators_enabled)
                VALUES (1, TRUE, 'ALL', 'ADMIN_ONLY', TRUE, 25, TRUE, TRUE, TRUE)
            `);
        }
    } catch (e) {
        console.warn("Could not seed default chat settings:", e.message);
    }

    // Ensure default Company Announcements broadcast channel exists
    try {
        const [annRows] = await db.execute("SELECT id FROM chat_conversations WHERE company_id = 1 AND type = 'BROADCAST' LIMIT 1");
        if (annRows.length === 0) {
            const [res] = await db.execute(`
                INSERT INTO chat_conversations (company_id, type, title, description, is_admin_only, broadcast_priority)
                VALUES (1, 'BROADCAST', 'Company Announcements', 'Official corporate updates, executive notices, and bulletins', TRUE, 'COMPANY_UPDATE')
            `);
            const convId = res.insertId;

            // Add all users to this announcement channel
            const [users] = await db.execute("SELECT id, role FROM users WHERE active = TRUE");
            for (const u of users) {
                const pRole = (u.role === 'admin' || u.role === 'super admin') ? 'ADMIN' : 'MEMBER';
                await db.execute(
                    "INSERT IGNORE INTO chat_participants (conversation_id, user_id, role) VALUES (?, ?, ?)",
                    [convId, u.id, pRole]
                );
            }

            // Post welcome message
            const adminUser = users.find(u => u.role === 'admin' || u.role === 'super admin') || users[0];
            if (adminUser) {
                await db.execute(`
                    INSERT INTO chat_messages (conversation_id, sender_id, message_text, message_type, is_announcement)
                    VALUES (?, ?, 'Welcome to the official Interlink Company Announcements broadcast channel. High-visibility company updates and governance bulletins will be published here.', 'SYSTEM', TRUE)
                `, [convId, adminUser.id]);
            }
        }
    } catch (e) {
        console.warn("Could not seed announcement channel:", e.message);
    }

    console.log("Chat tables initialized and ready.");
};

/**
 * Get or create 1-to-1 direct conversation between two users
 */
const getOrCreateDirectConversation = async (currentUserId, targetUserId, companyId = 1) => {
    if (currentUserId === targetUserId) {
        throw new Error("Cannot create a direct conversation with yourself");
    }

    // Check if direct conversation already exists between these 2 users
    const query = `
        SELECT c.id 
        FROM chat_conversations c
        JOIN chat_participants p1 ON p1.conversation_id = c.id AND p1.user_id = ?
        JOIN chat_participants p2 ON p2.conversation_id = c.id AND p2.user_id = ?
        WHERE c.type = 'DIRECT' AND c.company_id = ?
        LIMIT 1
    `;
    const [existing] = await db.execute(query, [currentUserId, targetUserId, companyId]);
    if (existing.length > 0) {
        return existing[0].id;
    }

    // Create new direct conversation
    const [createRes] = await db.execute(
        "INSERT INTO chat_conversations (company_id, type, created_by) VALUES (?, 'DIRECT', ?)",
        [companyId, currentUserId]
    );
    const convId = createRes.insertId;

    // Insert both participants
    await db.execute(
        "INSERT INTO chat_participants (conversation_id, user_id, role) VALUES (?, ?, 'ADMIN'), (?, ?, 'MEMBER')",
        [convId, currentUserId, convId, targetUserId]
    );

    return convId;
};

/**
 * Create a new group or broadcast conversation
 */
const createGroupOrBroadcast = async ({
    companyId = 1,
    type = 'GROUP',
    title,
    description = null,
    isAdminOnly = false,
    broadcastPriority = 'NORMAL',
    targetDepartmentId = null,
    creatorId,
    memberIds = []
}) => {
    const isBroadcast = type === 'BROADCAST';
    const adminOnlyPosting = isBroadcast ? true : !!isAdminOnly;

    const [res] = await db.execute(`
        INSERT INTO chat_conversations 
        (company_id, type, title, description, is_admin_only, broadcast_priority, target_department_id, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [companyId, type, title, description, adminOnlyPosting, broadcastPriority, targetDepartmentId || null, creatorId]);

    const convId = res.insertId;

    // Add creator as ADMIN participant
    await db.execute(
        "INSERT INTO chat_participants (conversation_id, user_id, role) VALUES (?, ?, 'ADMIN')",
        [convId, creatorId]
    );

    // If targetDepartmentId is set for broadcast, add all department users
    if (isBroadcast && targetDepartmentId) {
        const [deptUsers] = await db.execute(
            "SELECT id, role FROM users WHERE (department_id = ? OR id IN (SELECT user_id FROM user_departments WHERE department_id = ?)) AND active = TRUE",
            [targetDepartmentId, targetDepartmentId]
        );
        for (const u of deptUsers) {
            if (u.id !== creatorId) {
                const pRole = (u.role === 'admin' || u.role === 'super admin') ? 'ADMIN' : 'MEMBER';
                await db.execute(
                    "INSERT IGNORE INTO chat_participants (conversation_id, user_id, role) VALUES (?, ?, ?)",
                    [convId, u.id, pRole]
                );
            }
        }
    } else if (isBroadcast && (!memberIds || memberIds.length === 0)) {
        // Company-wide broadcast: add all active company users
        const [compUsers] = await db.execute(
            "SELECT id, role FROM users WHERE (company_id = ? OR ? = 1) AND active = TRUE",
            [companyId, companyId]
        );
        for (const u of compUsers) {
            if (u.id !== creatorId) {
                const pRole = (u.role === 'admin' || u.role === 'super admin') ? 'ADMIN' : 'MEMBER';
                await db.execute(
                    "INSERT IGNORE INTO chat_participants (conversation_id, user_id, role) VALUES (?, ?, ?)",
                    [convId, u.id, pRole]
                );
            }
        }
    } else if (Array.isArray(memberIds)) {
        for (const uid of memberIds) {
            const numUid = parseInt(uid, 10);
            if (numUid && numUid !== creatorId) {
                await db.execute(
                    "INSERT IGNORE INTO chat_participants (conversation_id, user_id, role) VALUES (?, ?, 'MEMBER')",
                    [convId, numUid]
                );
            }
        }
    }

    return convId;
};

/**
 * Fetch all conversations for a specific user with unread counts and last message preview
 */
const getUserConversations = async (userId, companyId = 1) => {
    const query = `
        SELECT 
            c.id,
            c.company_id,
            c.type,
            c.title,
            c.description,
            c.avatar_url,
            c.is_admin_only,
            c.broadcast_priority,
            c.target_department_id,
            c.created_by,
            c.created_at,
            c.last_message_at,
            cp.role AS user_role,
            cp.is_pinned,
            cp.is_muted,
            cp.last_read_message_id,
            dept.department_name AS target_department_name,
            -- Direct message counterpart info
            other_u.id AS other_user_id,
            other_u.name AS other_user_name,
            other_u.username AS other_user_username,
            other_u.email AS other_user_email,
            other_u.role AS other_user_role,
            other_dept.department_name AS other_user_department,
            -- Last Message Details
            lm.id AS last_message_id,
            lm.message_text AS last_message_text,
            lm.message_type AS last_message_type,
            lm.created_at AS last_message_time,
            lm_sender.name AS last_message_sender_name,
            -- Unread Messages Count
            (
                SELECT COUNT(*) 
                FROM chat_messages m 
                WHERE m.conversation_id = c.id 
                  AND m.id > COALESCE(cp.last_read_message_id, 0)
                  AND m.sender_id != ?
            ) AS unread_count,
            -- Total Participants Count
            (SELECT COUNT(*) FROM chat_participants p WHERE p.conversation_id = c.id) AS member_count
        FROM chat_participants cp
        JOIN chat_conversations c ON c.id = cp.conversation_id
        LEFT JOIN departments dept ON dept.id = c.target_department_id
        -- For direct chat: join other participant
        LEFT JOIN chat_participants other_cp ON other_cp.conversation_id = c.id AND other_cp.user_id != ? AND c.type = 'DIRECT'
        LEFT JOIN users other_u ON other_u.id = other_cp.user_id
        LEFT JOIN departments other_dept ON other_dept.id = other_u.department_id
        -- Join latest message
        LEFT JOIN (
            SELECT m1.*
            FROM chat_messages m1
            INNER JOIN (
                SELECT conversation_id, MAX(id) AS max_id
                FROM chat_messages
                GROUP BY conversation_id
            ) m2 ON m1.id = m2.max_id
        ) lm ON lm.conversation_id = c.id
        LEFT JOIN users lm_sender ON lm_sender.id = lm.sender_id
        WHERE cp.user_id = ?
        ORDER BY cp.is_pinned DESC, c.last_message_at DESC
    `;

    const [rows] = await db.execute(query, [userId, userId, userId]);
    return rows.map(r => ({
        ...r,
        unread_count: Number(r.unread_count || 0),
        member_count: Number(r.member_count || 0),
        is_pinned: Boolean(r.is_pinned),
        is_muted: Boolean(r.is_muted),
        is_admin_only: Boolean(r.is_admin_only)
    }));
};

/**
 * Fetch messages for a conversation
 */
const getConversationMessages = async (conversationId, limit = 100, beforeMessageId = null) => {
    let whereClause = "WHERE m.conversation_id = ?";
    let params = [conversationId];

    if (beforeMessageId) {
        whereClause += " AND m.id < ?";
        params.push(beforeMessageId);
    }

    const query = `
        SELECT 
            m.id,
            m.conversation_id,
            m.sender_id,
            m.message_text,
            m.message_type,
            m.file_url,
            m.file_name,
            m.file_size,
            m.file_mime,
            m.parent_message_id,
            m.is_pinned,
            m.is_announcement,
            m.reactions,
            m.created_at,
            u.name AS sender_name,
            u.username AS sender_username,
            u.email AS sender_email,
            u.role AS sender_role,
            dept.department_name AS sender_department
        FROM chat_messages m
        JOIN users u ON u.id = m.sender_id
        LEFT JOIN departments dept ON dept.id = u.department_id
        ${whereClause}
        ORDER BY m.id ASC
        LIMIT ?
    `;
    params.push(parseInt(limit, 10) || 100);

    const [rows] = await db.execute(query, params);
    return rows;
};

/**
 * Post a new message
 */
const sendMessage = async ({
    conversationId,
    senderId,
    messageText,
    messageType = 'TEXT',
    fileUrl = null,
    fileName = null,
    fileSize = null,
    fileMime = null,
    parentMessageId = null,
    isAnnouncement = false
}) => {
    // 1. Verify participant and check "Only administrators can send messages" rule
    const [convRows] = await db.execute(
        "SELECT id, type, is_admin_only FROM chat_conversations WHERE id = ?",
        [conversationId]
    );
    if (convRows.length === 0) throw new Error("Conversation not found");

    const conv = convRows[0];
    const [partRows] = await db.execute(
        "SELECT role FROM chat_participants WHERE conversation_id = ? AND user_id = ?",
        [conversationId, senderId]
    );
    if (partRows.length === 0) throw new Error("User is not a participant in this conversation");

    const userPart = partRows[0];
    const [senderUser] = await db.execute("SELECT role FROM users WHERE id = ?", [senderId]);
    const isGlobalAdmin = senderUser[0]?.role === 'admin' || senderUser[0]?.role === 'super admin';

    if (conv.is_admin_only && userPart.role !== 'ADMIN' && !isGlobalAdmin) {
        throw new Error("Only administrators can send messages in this broadcast channel.");
    }

    // 2. Insert message
    const [msgRes] = await db.execute(`
        INSERT INTO chat_messages 
        (conversation_id, sender_id, message_text, message_type, file_url, file_name, file_size, file_mime, parent_message_id, is_announcement)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        conversationId,
        senderId,
        messageText || '',
        messageType || 'TEXT',
        fileUrl || null,
        fileName || null,
        fileSize || null,
        fileMime || null,
        parentMessageId || null,
        isAnnouncement ? 1 : 0
    ]);

    const messageId = msgRes.insertId;

    // 3. Update conversation last_message_at
    await db.execute(
        "UPDATE chat_conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = ?",
        [conversationId]
    );

    // 4. Mark sender's last_read_message_id to this message
    await db.execute(
        "UPDATE chat_participants SET last_read_message_id = ?, last_read_at = NOW() WHERE conversation_id = ? AND user_id = ?",
        [messageId, conversationId, senderId]
    );

    // 5. Fetch full inserted message
    const [fullMsg] = await db.execute(`
        SELECT 
            m.id,
            m.conversation_id,
            m.sender_id,
            m.message_text,
            m.message_type,
            m.file_url,
            m.file_name,
            m.file_size,
            m.file_mime,
            m.parent_message_id,
            m.is_pinned,
            m.is_announcement,
            m.reactions,
            m.created_at,
            u.name AS sender_name,
            u.username AS sender_username,
            u.email AS sender_email,
            u.role AS sender_role,
            dept.department_name AS sender_department
        FROM chat_messages m
        JOIN users u ON u.id = m.sender_id
        LEFT JOIN departments dept ON dept.id = u.department_id
        WHERE m.id = ?
    `, [messageId]);

    return fullMsg[0];
};

/**
 * Mark conversation messages as read
 */
const markConversationRead = async (conversationId, userId, messageId = null) => {
    let targetMessageId = messageId;
    if (!targetMessageId) {
        const [maxRow] = await db.execute(
            "SELECT MAX(id) AS max_id FROM chat_messages WHERE conversation_id = ?",
            [conversationId]
        );
        targetMessageId = maxRow[0]?.max_id || 0;
    }

    await db.execute(`
        UPDATE chat_participants 
        SET last_read_message_id = GREATEST(COALESCE(last_read_message_id, 0), ?), last_read_at = NOW()
        WHERE conversation_id = ? AND user_id = ?
    `, [targetMessageId, conversationId, userId]);

    return { conversationId, userId, lastReadMessageId: targetMessageId };
};

/**
 * Toggle message reaction emoji
 */
const toggleMessageReaction = async (messageId, userId, emoji) => {
    const [rows] = await db.execute("SELECT reactions FROM chat_messages WHERE id = ?", [messageId]);
    if (rows.length === 0) throw new Error("Message not found");

    let reactions = rows[0].reactions;
    if (typeof reactions === 'string') {
        try { reactions = JSON.parse(reactions); } catch (_) { reactions = {}; }
    }
    reactions = reactions || {};

    let userList = reactions[emoji] || [];
    if (userList.includes(userId)) {
        userList = userList.filter(id => id !== userId);
        if (userList.length === 0) {
            delete reactions[emoji];
        } else {
            reactions[emoji] = userList;
        }
    } else {
        userList.push(userId);
        reactions[emoji] = userList;
    }

    await db.execute(
        "UPDATE chat_messages SET reactions = ? WHERE id = ?",
        [JSON.stringify(reactions), messageId]
    );

    return { messageId, reactions };
};

/**
 * Get chat settings for company
 */
const getChatSettings = async (companyId = 1) => {
    const [rows] = await db.execute("SELECT * FROM chat_settings WHERE company_id = ?", [companyId]);
    if (rows.length === 0) {
        return {
            company_id: companyId,
            allow_direct_messaging: true,
            allow_group_creation: 'ALL',
            allow_broadcast_creation: 'ADMIN_ONLY',
            allow_file_sharing: true,
            max_file_size_mb: 25,
            cross_department_chat: true,
            read_receipts_enabled: true,
            typing_indicators_enabled: true
        };
    }
    return rows[0];
};

/**
 * Update chat settings for company
 */
const updateChatSettings = async (companyId = 1, data) => {
    const fields = [
        'allow_direct_messaging',
        'allow_group_creation',
        'allow_broadcast_creation',
        'allow_file_sharing',
        'max_file_size_mb',
        'cross_department_chat',
        'read_receipts_enabled',
        'typing_indicators_enabled'
    ];

    const updates = [];
    const values = [];

    fields.forEach(f => {
        if (data[f] !== undefined) {
            updates.push(`${f} = ?`);
            values.push(data[f]);
        }
    });

    if (updates.length > 0) {
        values.push(companyId);
        await db.execute(`
            INSERT INTO chat_settings (company_id, ${fields.join(', ')})
            VALUES (?, ${fields.map(() => '?').join(', ')})
            ON DUPLICATE KEY UPDATE ${updates.join(', ')}
        `, [
            companyId,
            data.allow_direct_messaging ?? true,
            data.allow_group_creation ?? 'ALL',
            data.allow_broadcast_creation ?? 'ADMIN_ONLY',
            data.allow_file_sharing ?? true,
            data.max_file_size_mb ?? 25,
            data.cross_department_chat ?? true,
            data.read_receipts_enabled ?? true,
            data.typing_indicators_enabled ?? true,
            ...values
        ]);
    }

    return await getChatSettings(companyId);
};

/**
 * Fetch permissions per user type
 */
const getChatUserTypePermissions = async (companyId = 1) => {
    const [rows] = await db.execute(`
        SELECT 
            ut.id AS user_type_id,
            ut.type_name,
            COALESCE(cutp.can_direct_chat, TRUE) AS can_direct_chat,
            COALESCE(cutp.can_create_group, TRUE) AS can_create_group,
            COALESCE(cutp.can_create_broadcast, FALSE) AS can_create_broadcast,
            COALESCE(cutp.can_send_files, TRUE) AS can_send_files
        FROM user_types ut
        LEFT JOIN chat_user_type_permissions cutp ON cutp.user_type_id = ut.id AND cutp.company_id = ?
        ORDER BY ut.type_name ASC
    `, [companyId]);

    return rows.map(r => ({
        ...r,
        can_direct_chat: Boolean(r.can_direct_chat),
        can_create_group: Boolean(r.can_create_group),
        can_create_broadcast: Boolean(r.can_create_broadcast),
        can_send_files: Boolean(r.can_send_files)
    }));
};

/**
 * Save user type chat permission
 */
const saveChatUserTypePermission = async (companyId = 1, userTypeId, perms) => {
    await db.execute(`
        INSERT INTO chat_user_type_permissions (company_id, user_type_id, can_direct_chat, can_create_group, can_create_broadcast, can_send_files)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            can_direct_chat = VALUES(can_direct_chat),
            can_create_group = VALUES(can_create_group),
            can_create_broadcast = VALUES(can_create_broadcast),
            can_send_files = VALUES(can_send_files)
    `, [
        companyId,
        userTypeId,
        perms.can_direct_chat ? 1 : 0,
        perms.can_create_group ? 1 : 0,
        perms.can_create_broadcast ? 1 : 0,
        perms.can_send_files ? 1 : 0
    ]);

    return { userTypeId, ...perms };
};

module.exports = {
    createChatTables,
    getOrCreateDirectConversation,
    createGroupOrBroadcast,
    getUserConversations,
    getConversationMessages,
    sendMessage,
    markConversationRead,
    toggleMessageReaction,
    getChatSettings,
    updateChatSettings,
    getChatUserTypePermissions,
    saveChatUserTypePermission
};
