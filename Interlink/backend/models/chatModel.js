const db = require("../config/db.js");

// Safe column addition helper
const ensureColumn = async (tableName, columnName, columnDef) => {
    try {
        const [rows] = await db.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = ? 
              AND COLUMN_NAME = ?
        `, [tableName, columnName]);

        if (rows.length === 0) {
            await db.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDef}`);
            console.log(`Added column ${columnName} to ${tableName}`);
        }
    } catch (err) {
        if (!err.message.includes("Duplicate column name")) {
            console.error(`Error ensuring column ${columnName} in ${tableName}:`, err.message);
        }
    }
};

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
            project_id INT NULL,
            historic_access_on_remove VARCHAR(50) DEFAULT 'VISIBLE',
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
            announcement_title VARCHAR(200) NULL,
            announcement_expiry TIMESTAMP NULL,
            mentions JSON DEFAULT NULL,
            is_edited BOOLEAN DEFAULT FALSE,
            edited_at TIMESTAMP NULL,
            is_deleted BOOLEAN DEFAULT FALSE,
            deleted_at TIMESTAMP NULL,
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

    // Ensure all modern columns exist on chat_messages
    await ensureColumn("chat_messages", "parent_message_id", "INT NULL");
    await ensureColumn("chat_messages", "is_pinned", "BOOLEAN DEFAULT FALSE");
    await ensureColumn("chat_messages", "is_announcement", "BOOLEAN DEFAULT FALSE");
    await ensureColumn("chat_messages", "announcement_title", "VARCHAR(200) NULL");
    await ensureColumn("chat_messages", "announcement_expiry", "TIMESTAMP NULL");
    await ensureColumn("chat_messages", "mentions", "JSON DEFAULT NULL");
    await ensureColumn("chat_messages", "is_edited", "BOOLEAN DEFAULT FALSE");
    await ensureColumn("chat_messages", "edited_at", "TIMESTAMP NULL");
    await ensureColumn("chat_messages", "is_deleted", "BOOLEAN DEFAULT FALSE");
    await ensureColumn("chat_messages", "deleted_at", "TIMESTAMP NULL");
    await ensureColumn("chat_messages", "reactions", "JSON DEFAULT NULL");
    await ensureColumn("chat_messages", "file_url", "VARCHAR(255) NULL");
    await ensureColumn("chat_messages", "file_name", "VARCHAR(255) NULL");
    await ensureColumn("chat_messages", "file_size", "INT NULL");
    await ensureColumn("chat_messages", "file_mime", "VARCHAR(100) NULL");

    // Ensure columns on chat_conversations
    await ensureColumn("chat_conversations", "company_id", "INT DEFAULT 1");
    await ensureColumn("chat_conversations", "type", "ENUM('DIRECT', 'GROUP', 'BROADCAST') NOT NULL DEFAULT 'DIRECT'");
    await ensureColumn("chat_conversations", "title", "VARCHAR(150) NULL");
    await ensureColumn("chat_conversations", "description", "VARCHAR(255) NULL");
    await ensureColumn("chat_conversations", "avatar_url", "VARCHAR(255) NULL");
    await ensureColumn("chat_conversations", "is_admin_only", "BOOLEAN DEFAULT FALSE");
    await ensureColumn("chat_conversations", "broadcast_priority", "ENUM('NORMAL', 'URGENT', 'COMPANY_UPDATE', 'POLICY_CHANGE') DEFAULT 'NORMAL'");
    await ensureColumn("chat_conversations", "target_department_id", "INT NULL");
    await ensureColumn("chat_conversations", "project_id", "INT NULL");
    await ensureColumn("chat_conversations", "historic_access_on_remove", "VARCHAR(50) DEFAULT 'VISIBLE'");
    await ensureColumn("chat_conversations", "created_by", "INT NULL");
    await ensureColumn("chat_conversations", "last_message_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

    // Ensure columns on chat_participants
    await ensureColumn("chat_participants", "role", "ENUM('ADMIN', 'MEMBER') DEFAULT 'MEMBER'");
    await ensureColumn("chat_participants", "last_read_message_id", "INT DEFAULT 0");
    await ensureColumn("chat_participants", "last_read_at", "TIMESTAMP NULL");
    await ensureColumn("chat_participants", "is_muted", "BOOLEAN DEFAULT FALSE");
    await ensureColumn("chat_participants", "is_pinned", "BOOLEAN DEFAULT FALSE");

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
            message_retention_days INT DEFAULT 0,
            legal_hold_enabled BOOLEAN DEFAULT FALSE,
            allow_message_editing BOOLEAN DEFAULT TRUE,
            allow_message_deletion BOOLEAN DEFAULT TRUE,
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

    // 6. User Specific Department Communication Permissions Table
    const createUserDeptPermsQuery = `
        CREATE TABLE IF NOT EXISTS chat_user_department_permissions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT DEFAULT 1,
            user_id INT NOT NULL,
            chat_scope ENUM('DEPARTMENT_ONLY', 'MULTI_DEPARTMENT', 'COMPANY_WIDE') NOT NULL DEFAULT 'DEPARTMENT_ONLY',
            allowed_department_ids JSON DEFAULT NULL,
            can_direct_chat BOOLEAN DEFAULT TRUE,
            can_create_group BOOLEAN DEFAULT TRUE,
            can_create_broadcast BOOLEAN DEFAULT FALSE,
            can_send_files BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_cudp_user (user_id),
            INDEX idx_cudp_company (company_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createUserDeptPermsQuery);

    // 7. Announcement Acknowledgements Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS chat_announcement_acknowledgements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            message_id INT NOT NULL,
            user_id INT NOT NULL,
            acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_ack_msg_user (message_id, user_id),
            FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Message Moderation & Abuse Reports Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS chat_message_reports (
            id INT AUTO_INCREMENT PRIMARY KEY,
            message_id INT NOT NULL,
            reporter_id INT NOT NULL,
            reason VARCHAR(255) NOT NULL,
            status ENUM('PENDING', 'REVIEWED', 'DISMISSED', 'DELETED') DEFAULT 'PENDING',
            moderator_id INT NULL,
            moderated_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_cmr_status (status),
            FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
            FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

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
 * Get or create 1-to-1 direct conversation between two users with department scope enforcement
 */
const getOrCreateDirectConversation = async (currentUserId, targetUserId, companyId = 1) => {
    if (currentUserId === targetUserId) {
        throw new Error("Cannot create a direct conversation with yourself");
    }

    // 1. Verify caller communication scope
    const [senderRows] = await db.execute(
        "SELECT id, role, department_id FROM users WHERE id = ?",
        [currentUserId]
    );
    const sender = senderRows[0];
    const isGlobalAdmin = sender?.role === "admin" || sender?.role === "super admin";

    if (!isGlobalAdmin) {
        const [permRows] = await db.execute(
            "SELECT chat_scope, allowed_department_ids, can_direct_chat FROM chat_user_department_permissions WHERE user_id = ?",
            [currentUserId]
        );
        const perm = permRows[0] || { chat_scope: "DEPARTMENT_ONLY", allowed_department_ids: null, can_direct_chat: true };

        if (!perm.can_direct_chat) {
            throw new Error("Direct 1-on-1 messaging is disabled for your account.");
        }

        const [targetRows] = await db.execute(
            "SELECT id, department_id FROM users WHERE id = ?",
            [targetUserId]
        );
        const target = targetRows[0];

        if (perm.chat_scope === "DEPARTMENT_ONLY") {
            const senderDept = sender?.department_id || null;
            const targetDept = target?.department_id || null;
            if (senderDept !== targetDept || senderDept === null) {
                throw new Error("Department Policy: You can only chat with members in your own department.");
            }
        } else if (perm.chat_scope === "MULTI_DEPARTMENT") {
            let allowed = [];
            if (perm.allowed_department_ids) {
                try {
                    allowed = typeof perm.allowed_department_ids === "string"
                        ? JSON.parse(perm.allowed_department_ids)
                        : perm.allowed_department_ids;
                } catch (_) { allowed = []; }
            }
            const senderDept = sender?.department_id;
            const targetDept = target?.department_id;
            const isMatch = targetDept === senderDept || (targetDept && allowed.includes(targetDept));
            if (!isMatch) {
                throw new Error("Department Policy: You are not authorized to message members outside your designated departments.");
            }
        }
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
    try {
        // Ensure user is enrolled in applicable company-wide and department broadcast announcement channels
        await db.execute(`
            INSERT IGNORE INTO chat_participants (conversation_id, user_id, role)
            SELECT c.id, ?, IF(u.role IN ('admin', 'super admin', 'super_admin'), 'ADMIN', 'MEMBER')
            FROM chat_conversations c
            JOIN users u ON u.id = ?
            WHERE c.type = 'BROADCAST' 
              AND (
                  (c.target_department_id IS NULL AND (c.company_id = u.company_id OR c.company_id = 1 OR ? = 1))
                  OR (c.target_department_id IS NOT NULL AND c.target_department_id = u.department_id)
              )
        `, [userId, userId, companyId]);
    } catch (enrollErr) {
        console.warn("Auto-enroll broadcast channels warning:", enrollErr.message);
    }

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
    const convId = parseInt(conversationId, 10);
    const safeLimit = Math.max(1, Math.min(parseInt(limit, 10) || 100, 500));

    let whereClause = "WHERE m.conversation_id = ?";
    let params = [convId];

    if (beforeMessageId) {
        whereClause += " AND m.id < ?";
        params.push(parseInt(beforeMessageId, 10));
    }

    const query = `
        SELECT 
            m.id,
            m.conversation_id,
            m.sender_id,
            CASE WHEN m.is_deleted = TRUE THEN 'This message was deleted' ELSE m.message_text END AS message_text,
            m.message_type,
            CASE WHEN m.is_deleted = TRUE THEN NULL ELSE m.file_url END AS file_url,
            CASE WHEN m.is_deleted = TRUE THEN NULL ELSE m.file_name END AS file_name,
            m.file_size,
            m.file_mime,
            m.parent_message_id,
            m.is_pinned,
            m.is_announcement,
            m.announcement_title,
            m.announcement_expiry,
            m.mentions,
            m.is_edited,
            m.edited_at,
            m.is_deleted,
            m.deleted_at,
            m.reactions,
            m.created_at,
            u.name AS sender_name,
            u.username AS sender_username,
            u.email AS sender_email,
            u.role AS sender_role,
            dept.department_name AS sender_department,
            (SELECT COUNT(*) FROM chat_announcement_acknowledgements caa WHERE caa.message_id = m.id) AS ack_count
        FROM chat_messages m
        JOIN users u ON u.id = m.sender_id
        LEFT JOIN departments dept ON dept.id = u.department_id
        ${whereClause}
        ORDER BY m.id ASC
        LIMIT ${safeLimit}
    `;

    const [rows] = await db.execute(query, params);
    return rows.map(r => ({
        ...r,
        is_pinned: Boolean(r.is_pinned),
        is_announcement: Boolean(r.is_announcement),
        is_edited: Boolean(r.is_edited),
        is_deleted: Boolean(r.is_deleted),
        ack_count: Number(r.ack_count || 0)
    }));
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
    isAnnouncement = false,
    announcementTitle = null,
    announcementExpiry = null,
    mentions = null
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

    // 2. Insert message with self-healing schema migration
    let msgRes;
    const insertParams = [
        conversationId,
        senderId,
        messageText || '',
        messageType || 'TEXT',
        fileUrl || null,
        fileName || null,
        fileSize || null,
        fileMime || null,
        parentMessageId || null,
        isAnnouncement ? 1 : 0,
        announcementTitle || null,
        announcementExpiry || null,
        mentions ? JSON.stringify(mentions) : null
    ];

    try {
        [msgRes] = await db.execute(`
            INSERT INTO chat_messages 
            (conversation_id, sender_id, message_text, message_type, file_url, file_name, file_size, file_mime, parent_message_id, is_announcement, announcement_title, announcement_expiry, mentions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, insertParams);
    } catch (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR') {
            console.warn("[chatModel] chat_messages table missing columns, applying schema migration...");
            await ensureColumn("chat_messages", "parent_message_id", "INT NULL");
            await ensureColumn("chat_messages", "is_pinned", "BOOLEAN DEFAULT FALSE");
            await ensureColumn("chat_messages", "is_announcement", "BOOLEAN DEFAULT FALSE");
            await ensureColumn("chat_messages", "announcement_title", "VARCHAR(200) NULL");
            await ensureColumn("chat_messages", "announcement_expiry", "TIMESTAMP NULL");
            await ensureColumn("chat_messages", "mentions", "JSON DEFAULT NULL");
            await ensureColumn("chat_messages", "is_edited", "BOOLEAN DEFAULT FALSE");
            await ensureColumn("chat_messages", "edited_at", "TIMESTAMP NULL");
            await ensureColumn("chat_messages", "is_deleted", "BOOLEAN DEFAULT FALSE");
            await ensureColumn("chat_messages", "deleted_at", "TIMESTAMP NULL");
            await ensureColumn("chat_messages", "reactions", "JSON DEFAULT NULL");

            [msgRes] = await db.execute(`
                INSERT INTO chat_messages 
                (conversation_id, sender_id, message_text, message_type, file_url, file_name, file_size, file_mime, parent_message_id, is_announcement, announcement_title, announcement_expiry, mentions)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, insertParams);
        } else {
            throw err;
        }
    }

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
            m.announcement_title,
            m.announcement_expiry,
            m.mentions,
            m.is_edited,
            m.edited_at,
            m.is_deleted,
            m.deleted_at,
            m.reactions,
            m.created_at,
            u.name AS sender_name,
            u.username AS sender_username,
            u.email AS sender_email,
            u.role AS sender_role,
            dept.department_name AS sender_department,
            0 AS ack_count
        FROM chat_messages m
        JOIN users u ON u.id = m.sender_id
        LEFT JOIN departments dept ON dept.id = u.department_id
        WHERE m.id = ?
    `, [messageId]);

    return {
        ...fullMsg[0],
        is_pinned: Boolean(fullMsg[0].is_pinned),
        is_announcement: Boolean(fullMsg[0].is_announcement),
        is_edited: Boolean(fullMsg[0].is_edited),
        is_deleted: Boolean(fullMsg[0].is_deleted),
        ack_count: 0
    };
};

/**
 * Edit an existing message
 */
const editMessage = async (messageId, senderId, newText) => {
    const [rows] = await db.execute("SELECT id, sender_id, conversation_id, is_deleted, created_at FROM chat_messages WHERE id = ?", [messageId]);
    if (rows.length === 0) throw new Error("Message not found");
    if (rows[0].sender_id !== senderId) throw new Error("You can only edit your own messages");
    if (rows[0].is_deleted) throw new Error("Cannot edit a deleted message");

    await db.execute(
        "UPDATE chat_messages SET message_text = ?, is_edited = TRUE, edited_at = NOW() WHERE id = ?",
        [newText.trim(), messageId]
    );

    return {
        messageId: Number(messageId),
        conversationId: rows[0].conversation_id,
        messageText: newText.trim(),
        isEdited: true
    };
};

/**
 * Delete a message (soft delete)
 */
const deleteMessage = async (messageId, userId, isGlobalAdmin = false) => {
    const [rows] = await db.execute(
        "SELECT m.id, m.sender_id, m.conversation_id, cp.role AS participant_role FROM chat_messages m LEFT JOIN chat_participants cp ON cp.conversation_id = m.conversation_id AND cp.user_id = ? WHERE m.id = ?",
        [userId, messageId]
    );
    if (rows.length === 0) throw new Error("Message not found");

    const msg = rows[0];
    const canDelete = isGlobalAdmin || msg.sender_id === userId || msg.participant_role === 'ADMIN';
    if (!canDelete) throw new Error("You do not have permission to delete this message");

    await db.execute(
        "UPDATE chat_messages SET is_deleted = TRUE, deleted_at = NOW() WHERE id = ?",
        [messageId]
    );

    return { messageId: Number(messageId), conversationId: msg.conversation_id, isDeleted: true };
};

/**
 * Pin or Unpin a message
 */
const togglePinMessage = async (messageId) => {
    const [rows] = await db.execute("SELECT id, conversation_id, is_pinned FROM chat_messages WHERE id = ?", [messageId]);
    if (rows.length === 0) throw new Error("Message not found");
    const nextPinned = !rows[0].is_pinned;
    await db.execute("UPDATE chat_messages SET is_pinned = ? WHERE id = ?", [nextPinned ? 1 : 0, messageId]);
    return { messageId: Number(messageId), conversationId: rows[0].conversation_id, isPinned: nextPinned };
};

/**
 * Acknowledge an announcement
 */
const acknowledgeAnnouncement = async (messageId, userId) => {
    await db.execute(`
        INSERT IGNORE INTO chat_announcement_acknowledgements (message_id, user_id)
        VALUES (?, ?)
    `, [messageId, userId]);

    const [countRows] = await db.execute(
        "SELECT COUNT(*) AS total_acks FROM chat_announcement_acknowledgements WHERE message_id = ?",
        [messageId]
    );

    return { messageId: Number(messageId), userId, ackCount: Number(countRows[0].total_acks) };
};

/**
 * Report a message for moderation
 */
const reportChatMessage = async (messageId, reporterId, reason) => {
    await db.execute(`
        INSERT INTO chat_message_reports (message_id, reporter_id, reason)
        VALUES (?, ?, ?)
    `, [messageId, reporterId, reason || 'Inappropriate content']);

    return { messageId, reporterId, success: true };
};

/**
 * Add participant to channel
 */
const addChannelParticipant = async (conversationId, userId, role = 'MEMBER') => {
    await db.execute(`
        INSERT INTO chat_participants (conversation_id, user_id, role)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE role = VALUES(role)
    `, [conversationId, userId, role]);

    return { conversationId, userId, role };
};

/**
 * Remove participant from channel with configurable historic access
 */
const removeChannelParticipant = async (conversationId, userId) => {
    await db.execute("DELETE FROM chat_participants WHERE conversation_id = ? AND user_id = ?", [conversationId, userId]);
    return { conversationId, userId, removed: true };
};

/**
 * Get channel participants list
 */
const getChannelParticipants = async (conversationId) => {
    const [rows] = await db.execute(`
        SELECT 
            cp.id, cp.conversation_id, cp.user_id, cp.role, cp.joined_at,
            u.name, u.username, u.email, u.role AS system_role,
            dept.department_name
        FROM chat_participants cp
        JOIN users u ON u.id = cp.user_id
        LEFT JOIN departments dept ON dept.id = u.department_id
        WHERE cp.conversation_id = ?
        ORDER BY cp.role ASC, u.name ASC
    `, [conversationId]);
    return rows;
};
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

    return { messageId: Number(messageId), reactions };
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
            allow_file_downloads: true,
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
        'allow_file_downloads',
        'max_file_size_mb',
        'cross_department_chat',
        'read_receipts_enabled',
        'typing_indicators_enabled',
        'message_retention_days',
        'legal_hold_enabled',
        'allow_message_editing',
        'allow_message_deletion'
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
            data.allow_file_downloads ?? true,
            data.max_file_size_mb ?? 25,
            data.cross_department_chat ?? true,
            data.read_receipts_enabled ?? true,
            data.typing_indicators_enabled ?? true,
            data.message_retention_days ?? 0,
            data.legal_hold_enabled ?? false,
            data.allow_message_editing ?? true,
            data.allow_message_deletion ?? true,
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
            COALESCE(cutp.can_send_files, TRUE) AS can_send_files,
            COALESCE(cutp.can_download_files, TRUE) AS can_download_files
        FROM user_types ut
        LEFT JOIN chat_user_type_permissions cutp ON cutp.user_type_id = ut.id AND cutp.company_id = ?
        ORDER BY ut.type_name ASC
    `, [companyId]);

    return rows.map(r => ({
        ...r,
        can_direct_chat: Boolean(r.can_direct_chat),
        can_create_group: Boolean(r.can_create_group),
        can_create_broadcast: Boolean(r.can_create_broadcast),
        can_send_files: Boolean(r.can_send_files),
        can_download_files: Boolean(r.can_download_files)
    }));
};

/**
 * Save user type chat permission
 */
const saveChatUserTypePermission = async (companyId = 1, userTypeId, perms) => {
    await db.execute(`
        INSERT INTO chat_user_type_permissions (company_id, user_type_id, can_direct_chat, can_create_group, can_create_broadcast, can_send_files, can_download_files)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            can_direct_chat = VALUES(can_direct_chat),
            can_create_group = VALUES(can_create_group),
            can_create_broadcast = VALUES(can_create_broadcast),
            can_send_files = VALUES(can_send_files),
            can_download_files = VALUES(can_download_files)
    `, [
        companyId,
        userTypeId,
        perms.can_direct_chat ? 1 : 0,
        perms.can_create_group ? 1 : 0,
        perms.can_create_broadcast ? 1 : 0,
        perms.can_send_files ? 1 : 0,
        perms.can_download_files !== false ? 1 : 0
    ]);

    return { userTypeId, ...perms };
};

/**
 * Fetch all users with their Chat & Department Scope permissions
 */
const getAllUserChatPermissions = async (companyId = 1) => {
    const query = `
        SELECT 
            u.id AS user_id, 
            u.name, 
            u.username, 
            u.email, 
            u.role, 
            u.active,
            u.department_id, 
            dept.department_name, 
            ut.type_name,
            COALESCE(cudp.chat_scope, 'DEPARTMENT_ONLY') AS chat_scope,
            cudp.allowed_department_ids,
            COALESCE(cudp.can_direct_chat, TRUE) AS can_direct_chat,
            COALESCE(cudp.can_create_group, TRUE) AS can_create_group,
            COALESCE(cudp.can_create_broadcast, FALSE) AS can_create_broadcast,
            COALESCE(cudp.can_send_files, TRUE) AS can_send_files,
            COALESCE(cudp.can_download_files, TRUE) AS can_download_files
        FROM users u
        LEFT JOIN departments dept ON dept.id = u.department_id
        LEFT JOIN user_types ut ON ut.id = u.user_type_id
        LEFT JOIN chat_user_department_permissions cudp ON cudp.user_id = u.id AND cudp.company_id = ?
        WHERE u.active = TRUE AND (u.company_id = ? OR ? = 1)
        ORDER BY u.name ASC
    `;
    const [rows] = await db.execute(query, [companyId, companyId, companyId]);
    return rows.map(r => ({
        ...r,
        allowed_department_ids: typeof r.allowed_department_ids === 'string'
            ? (() => { try { return JSON.parse(r.allowed_department_ids); } catch (_) { return []; } })()
            : (r.allowed_department_ids || []),
        can_direct_chat: Boolean(r.can_direct_chat),
        can_create_group: Boolean(r.can_create_group),
        can_create_broadcast: Boolean(r.can_create_broadcast),
        can_send_files: Boolean(r.can_send_files),
        can_download_files: Boolean(r.can_download_files)
    }));
};

/**
 * Save / Update User specific Chat & Department Scope permission
 */
const saveUserChatPermission = async (companyId = 1, userId, data) => {
    const {
        chat_scope = 'DEPARTMENT_ONLY',
        allowed_department_ids = [],
        can_direct_chat = true,
        can_create_group = true,
        can_create_broadcast = false,
        can_send_files = true,
        can_download_files = true
    } = data;

    const formattedAllowedDepts = Array.isArray(allowed_department_ids) && allowed_department_ids.length > 0
        ? JSON.stringify(allowed_department_ids)
        : null;

    await db.execute(`
        INSERT INTO chat_user_department_permissions 
        (company_id, user_id, chat_scope, allowed_department_ids, can_direct_chat, can_create_group, can_create_broadcast, can_send_files, can_download_files)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            chat_scope = VALUES(chat_scope),
            allowed_department_ids = VALUES(allowed_department_ids),
            can_direct_chat = VALUES(can_direct_chat),
            can_create_group = VALUES(can_create_group),
            can_create_broadcast = VALUES(can_create_broadcast),
            can_send_files = VALUES(can_send_files),
            can_download_files = VALUES(can_download_files),
            updated_at = NOW()
    `, [
        companyId,
        userId,
        chat_scope,
        formattedAllowedDepts,
        can_direct_chat ? 1 : 0,
        can_create_group ? 1 : 0,
        can_create_broadcast ? 1 : 0,
        can_send_files ? 1 : 0,
        can_download_files ? 1 : 0
    ]);

    return { userId, ...data };
};

/**
 * Get active user effective chat permissions
 */
const getMyUserChatPermissions = async (userId, companyId = 1) => {
    const [settings] = await db.execute("SELECT * FROM chat_settings WHERE company_id = ?", [companyId]);
    const globalSettings = settings[0] || {
        allow_file_sharing: true,
        allow_file_downloads: true,
        allow_direct_messaging: true
    };

    const [userRows] = await db.execute("SELECT id, role, user_type_id, department_id FROM users WHERE id = ?", [userId]);
    if (userRows.length === 0) return { can_download_files: true, allow_file_downloads: true };

    const u = userRows[0];
    const isGlobalAdmin = u.role === 'admin' || u.role === 'super admin';
    if (isGlobalAdmin) {
        return {
            is_admin: true,
            can_direct_chat: true,
            can_create_group: true,
            can_create_broadcast: true,
            can_send_files: true,
            can_download_files: true,
            allow_file_downloads: Boolean(globalSettings.allow_file_downloads !== 0)
        };
    }

    const [udpRows] = await db.execute("SELECT * FROM chat_user_department_permissions WHERE user_id = ? AND company_id = ?", [userId, companyId]);
    const [utpRows] = await db.execute("SELECT * FROM chat_user_type_permissions WHERE user_type_id = ? AND company_id = ?", [u.user_type_id, companyId]);

    const canDownload = udpRows[0]?.can_download_files !== undefined
        ? Boolean(udpRows[0].can_download_files)
        : (utpRows[0]?.can_download_files !== undefined ? Boolean(utpRows[0].can_download_files) : true);

    return {
        is_admin: false,
        can_direct_chat: udpRows[0]?.can_direct_chat !== undefined ? Boolean(udpRows[0].can_direct_chat) : true,
        can_create_group: udpRows[0]?.can_create_group !== undefined ? Boolean(udpRows[0].can_create_group) : true,
        can_create_broadcast: udpRows[0]?.can_create_broadcast !== undefined ? Boolean(udpRows[0].can_create_broadcast) : false,
        can_send_files: udpRows[0]?.can_send_files !== undefined ? Boolean(udpRows[0].can_send_files) : true,
        can_download_files: canDownload && Boolean(globalSettings.allow_file_downloads !== 0),
        allow_file_downloads: Boolean(globalSettings.allow_file_downloads !== 0)
    };
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
    saveChatUserTypePermission,
    getAllUserChatPermissions,
    saveUserChatPermission,
    editMessage,
    deleteMessage,
    togglePinMessage,
    acknowledgeAnnouncement,
    reportChatMessage,
    addChannelParticipant,
    removeChannelParticipant,
    getChannelParticipants,
    getMyUserChatPermissions
};
