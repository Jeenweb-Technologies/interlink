const db = require("../config/db.js");

const createConversationTables = async () => {
    // 1. Conversations
    const createConversationsQuery = `
        CREATE TABLE IF NOT EXISTS conversations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type ENUM('DIRECT', 'GROUP') DEFAULT 'DIRECT',
            title VARCHAR(150) NULL,
            description TEXT NULL,
            avatar_url VARCHAR(500) NULL,
            created_by INT NULL,
            is_archived BOOLEAN DEFAULT FALSE,
            is_announcement BOOLEAN DEFAULT FALSE,
            is_master BOOLEAN DEFAULT FALSE,
            is_activity BOOLEAN DEFAULT FALSE,
            who_can_post ENUM('ALL_MEMBERS', 'ADMIN_ONLY', 'SELECTED_MEMBERS') DEFAULT 'ALL_MEMBERS',
            last_message_text TEXT NULL,
            last_message_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_conv_type (type),
            INDEX idx_conv_last_msg (last_message_at DESC),
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createConversationsQuery);

    // Schema updates for existing tables (from dump imports)
    const convCols = [
        { name: 'is_announcement', sql: "ALTER TABLE conversations ADD COLUMN is_announcement BOOLEAN DEFAULT FALSE" },
        { name: 'is_master', sql: "ALTER TABLE conversations ADD COLUMN is_master BOOLEAN DEFAULT FALSE" },
        { name: 'is_activity', sql: "ALTER TABLE conversations ADD COLUMN is_activity BOOLEAN DEFAULT FALSE" },
        { name: 'is_company_broadcast', sql: "ALTER TABLE conversations ADD COLUMN is_company_broadcast BOOLEAN DEFAULT FALSE" },
        { name: 'is_company_group', sql: "ALTER TABLE conversations ADD COLUMN is_company_group BOOLEAN DEFAULT FALSE" },
        { name: 'company_id', sql: "ALTER TABLE conversations ADD COLUMN company_id INT NULL" },
        { name: 'company_ids', sql: "ALTER TABLE conversations ADD COLUMN company_ids JSON NULL" },
        { name: 'department_ids', sql: "ALTER TABLE conversations ADD COLUMN department_ids JSON NULL" },
        { name: 'who_can_post', sql: "ALTER TABLE conversations ADD COLUMN who_can_post ENUM('ALL_MEMBERS', 'ADMIN_ONLY', 'SELECTED_MEMBERS') DEFAULT 'ALL_MEMBERS'" },
        { name: 'last_message_text', sql: "ALTER TABLE conversations ADD COLUMN last_message_text TEXT NULL" },
        { name: 'last_message_at', sql: "ALTER TABLE conversations ADD COLUMN last_message_at TIMESTAMP NULL" }
    ];
    for (const c of convCols) {
        try {
            const [rows] = await db.execute(`SHOW COLUMNS FROM conversations LIKE '${c.name}'`);
            if (rows.length === 0) {
                await db.execute(c.sql);
            }
        } catch (e) { }
    }
    try {
        await db.execute("ALTER TABLE conversations MODIFY COLUMN who_can_post ENUM('ALL_MEMBERS', 'ADMIN_ONLY', 'SELECTED_MEMBERS') DEFAULT 'ALL_MEMBERS'");
    } catch (e) { }

    // 2. Conversation Members
    const createMembersQuery = `
        CREATE TABLE IF NOT EXISTS conversation_members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT NOT NULL,
            user_id INT NOT NULL,
            role ENUM('ADMIN', 'MEMBER') DEFAULT 'MEMBER',
            can_post BOOLEAN DEFAULT TRUE,
            unread_count INT DEFAULT 0,
            last_read_message_id INT NULL,
            is_muted BOOLEAN DEFAULT FALSE,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_conv_member (conversation_id, user_id),
            INDEX idx_cm_user (user_id),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createMembersQuery);

    const memCols = [
        { name: 'can_post', sql: "ALTER TABLE conversation_members ADD COLUMN can_post BOOLEAN DEFAULT TRUE" },
        { name: 'unread_count', sql: "ALTER TABLE conversation_members ADD COLUMN unread_count INT DEFAULT 0" },
        { name: 'last_read_message_id', sql: "ALTER TABLE conversation_members ADD COLUMN last_read_message_id INT NULL" },
        { name: 'is_muted', sql: "ALTER TABLE conversation_members ADD COLUMN is_muted BOOLEAN DEFAULT FALSE" }
    ];
    for (const c of memCols) {
        try {
            const [rows] = await db.execute(`SHOW COLUMNS FROM conversation_members LIKE '${c.name}'`);
            if (rows.length === 0) {
                await db.execute(c.sql);
            }
        } catch (e) { }
    }

    console.log("Conversation tables ready");
};

// Find existing 1-on-1 direct conversation between two users
const findDirectConversation = async (userId1, userId2) => {
    const query = `
        SELECT c.* 
        FROM conversations c
        JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
        JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
        WHERE c.type = 'DIRECT'
        LIMIT 1
    `;
    const [rows] = await db.execute(query, [userId1, userId2]);
    return rows.length > 0 ? rows[0] : null;
};

// Create a new direct conversation
const createDirectConversation = async (userId1, userId2) => {
    const existing = await findDirectConversation(userId1, userId2);
    if (existing) return existing;

    const [result] = await db.execute(
        "INSERT INTO conversations (type, created_by, last_message_at) VALUES ('DIRECT', ?, NOW())",
        [userId1]
    );
    const convId = result.insertId;

    await db.execute(
        "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, 'ADMIN'), (?, ?, 'MEMBER')",
        [convId, userId1, convId, userId2]
    );

    const [rows] = await db.execute("SELECT * FROM conversations WHERE id = ?", [convId]);
    return rows[0];
};

// Create a new group channel
const createGroupConversation = async (title, arg2, arg3, arg4 = []) => {
    let description = null;
    let createdBy = null;
    let memberIds = [];
    let isAnnouncement = false;
    let isMaster = false;
    let whoCanPost = 'ALL_MEMBERS';
    let departmentId = null;
    let departmentIds = null;
    let companyId = null;
    let companyIds = null;
    let isCompanyGroup = false;
    let allowedMemberIds = null;

    if (typeof arg2 === 'object' && arg2 !== null) {
        // Object format { description, createdBy, memberIds, isAnnouncement, isMaster, whoCanPost, departmentId, departmentIds, companyId, companyIds, isCompanyGroup, allowedMemberIds }
        createdBy = arg2.createdBy;
        description = arg2.description || null;
        memberIds = Array.isArray(arg2.memberIds) ? arg2.memberIds : [];
        isAnnouncement = Boolean(arg2.isAnnouncement);
        isMaster = Boolean(arg2.isMaster);
        whoCanPost = arg2.whoCanPost || (isAnnouncement ? 'ADMIN_ONLY' : 'ALL_MEMBERS');
        departmentId = arg2.departmentId || arg2.department_id || null;
        allowedMemberIds = arg2.allowedMemberIds || arg2.allowed_member_ids || null;
        companyId = arg2.companyId || arg2.company_id || null;

        if (Array.isArray(arg2.companyIds) && arg2.companyIds.length > 0) {
            companyIds = arg2.companyIds.map(Number);
            if (!companyId) companyId = companyIds[0];
        } else if (Array.isArray(arg2.company_ids) && arg2.company_ids.length > 0) {
            companyIds = arg2.company_ids.map(Number);
            if (!companyId) companyId = companyIds[0];
        }

        if (Array.isArray(arg2.departmentIds) && arg2.departmentIds.length > 0) {
            departmentIds = arg2.departmentIds.map(Number);
            if (!departmentId) departmentId = departmentIds[0];
        } else if (Array.isArray(arg2.department_ids) && arg2.department_ids.length > 0) {
            departmentIds = arg2.department_ids.map(Number);
            if (!departmentId) departmentId = departmentIds[0];
        }

        isCompanyGroup = Boolean(arg2.isCompanyGroup || arg2.is_company_group || companyId || (companyIds && companyIds.length > 0));
    } else if (typeof arg2 === 'number') {
        createdBy = arg2;
        memberIds = Array.isArray(arg3) ? arg3 : [];
        description = typeof arg4 === 'string' ? arg4 : null;
    } else {
        description = arg2 || null;
        createdBy = arg3;
        memberIds = Array.isArray(arg4) ? arg4 : [];
    }

    // If master or announcement group, automatically enroll all active enterprise users
    if (isMaster || isAnnouncement) {
        const [allUsers] = await db.execute("SELECT id FROM users WHERE active = 1");
        memberIds = Array.from(new Set([...memberIds, ...allUsers.map(u => u.id)]));
    }

    const [result] = await db.execute(
        `INSERT INTO conversations (type, title, description, created_by, department_id, department_ids, company_id, company_ids, is_announcement, is_master, is_activity, is_company_group, who_can_post, last_message_at) 
         VALUES ('GROUP', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NOW())`,
        [
            title,
            description || null,
            createdBy,
            departmentId ? Number(departmentId) : null,
            departmentIds ? JSON.stringify(departmentIds) : null,
            companyId ? Number(companyId) : null,
            companyIds ? JSON.stringify(companyIds) : null,
            isAnnouncement ? 1 : 0,
            isMaster ? 1 : 0,
            isCompanyGroup ? 1 : 0,
            whoCanPost
        ]
    );
    const convId = result.insertId;

    // Add creator as ADMIN and other members with appropriate can_post permissions
    const allMemberIds = Array.from(new Set([createdBy, ...memberIds.map(Number)]));
    const allowedSet = Array.isArray(allowedMemberIds) ? new Set(allowedMemberIds.map(Number)) : null;

    for (const uid of allMemberIds) {
        if (!uid) continue;
        const role = (uid === createdBy) ? 'ADMIN' : 'MEMBER';
        let canPost = 1;
        if (whoCanPost === 'ADMIN_ONLY') {
            canPost = (role === 'ADMIN') ? 1 : 0;
        } else if (whoCanPost === 'SELECTED_MEMBERS') {
            if (role === 'ADMIN') {
                canPost = 1;
            } else if (allowedSet) {
                canPost = allowedSet.has(uid) ? 1 : 0;
            } else {
                canPost = 1;
            }
        } else {
            canPost = 1;
        }

        await db.execute(
            "INSERT INTO conversation_members (conversation_id, user_id, role, can_post) VALUES (?, ?, ?, ?)",
            [convId, uid, role, canPost]
        );
    }

    const [rows] = await db.execute(
        `SELECT c.*, d.department_name, comp.company_name, comp.company_code 
         FROM conversations c 
         LEFT JOIN departments d ON c.department_id = d.id 
         LEFT JOIN companies comp ON c.company_id = comp.id
         WHERE c.id = ?`,
        [convId]
    );
    return rows[0];
};

// Add a newly created user to all default groups (#activity, master announcements & their department channels)
const addUserToDefaultGroups = async (userId) => {
    if (!userId) return;
    try {
        const [defaultConvs] = await db.execute(
            "SELECT id, is_activity, is_master, is_announcement FROM conversations WHERE is_activity = 1 OR is_master = 1 OR is_announcement = 1 OR title = '#activity' OR title LIKE '%Announcements%' OR title LIKE '%Project Alpha%'"
        );
        for (const conv of defaultConvs) {
            await db.execute(
                "INSERT IGNORE INTO conversation_members (conversation_id, user_id, role, can_post, joined_at) VALUES (?, ?, 'MEMBER', 1, NOW())",
                [conv.id, userId]
            );
        }

        // Also add user to group conversations of their assigned departments
        const [userDepts] = await db.execute(
            "SELECT department_id, department_role FROM user_departments WHERE user_id = ?",
            [userId]
        );
        for (const ud of userDepts) {
            const [deptConvs] = await db.execute(
                "SELECT id FROM conversations WHERE department_id = ? AND type = 'GROUP'",
                [ud.department_id]
            );
            for (const dc of deptConvs) {
                const role = ud.department_role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
                await db.execute(
                    "INSERT IGNORE INTO conversation_members (conversation_id, user_id, role, can_post, joined_at) VALUES (?, ?, ?, 1, NOW())",
                    [dc.id, userId, role]
                );
            }
        }

        // Enroll user into their company's broadcast channel
        const [uRows] = await db.execute("SELECT company_id, role FROM users WHERE id = ?", [userId]);
        if (uRows.length > 0 && uRows[0].company_id) {
            const cId = uRows[0].company_id;
            const isUserAdmin = uRows[0].role === 'admin' || uRows[0].role === 'master_admin';
            const [cBroadcasts] = await db.execute(
                "SELECT id FROM conversations WHERE company_id = ? AND (is_company_broadcast = 1 OR title LIKE '%Broadcast%')",
                [cId]
            );
            for (const cb of cBroadcasts) {
                await db.execute(
                    "INSERT IGNORE INTO conversation_members (conversation_id, user_id, role, can_post, joined_at) VALUES (?, ?, ?, ?, NOW())",
                    [cb.id, userId, isUserAdmin ? 'ADMIN' : 'MEMBER', isUserAdmin ? 1 : 0]
                );
            }
        }
    } catch (e) {
        console.error("addUserToDefaultGroups error:", e.message);
    }
};

// Fetch conversations for a specific user (#activity / Master / Announcements pinned at the top)
const getUserConversations = async (userId) => {
    try {
        await addUserToDefaultGroups(userId);
    } catch (e) {
        console.warn("Auto-enrollment error:", e.message);
    }

    const query = `
        SELECT 
            c.id, c.type, c.title, c.description, c.avatar_url, c.is_announcement, c.is_master, c.is_activity,
            c.is_company_broadcast, c.is_company_group, c.company_id, c.company_ids, c.department_id, c.department_ids,
            d.department_name, comp.company_name, comp.company_code,
            c.who_can_post, c.created_by,
            c.last_message_text, c.last_message_at, c.created_at,
            cm.unread_count, cm.role AS member_role, cm.can_post, cm.joined_at,
            -- For DIRECT chats, fetch the other participant's info
            other_u.id AS other_user_id,
            COALESCE(other_u.name, other_u.full_name) AS other_user_name,
            other_u.username AS other_user_username,
            other_u.email AS other_user_email,
            other_u.mob_no AS other_user_mobile
        FROM conversations c
        JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = ?
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN companies comp ON c.company_id = comp.id
        LEFT JOIN conversation_members other_cm ON c.id = other_cm.conversation_id AND other_cm.user_id != ? AND (UPPER(c.type) = 'DIRECT')
        LEFT JOIN users other_u ON other_cm.user_id = other_u.id
        ORDER BY c.is_activity DESC, c.is_company_broadcast DESC, c.is_company_group DESC, c.is_master DESC, c.is_announcement DESC, c.last_message_at DESC, c.updated_at DESC
    `;
    const [rows] = await db.execute(query, [userId, userId]);
    return rows.map((r) => {
        const type = (r.type || 'direct').toLowerCase();
        let displayTitle = r.title;
        let partnerId = null;

        if (type === 'direct') {
            displayTitle = r.other_user_name || r.other_user_username || 'Coworker';
            partnerId = r.other_user_id || r.partnerId || null;
        } else {
            displayTitle = r.title || 'Group Chat';
        }

        let parsedCompanyIds = [];
        if (r.company_ids) {
            try {
                parsedCompanyIds = typeof r.company_ids === 'string' ? JSON.parse(r.company_ids) : r.company_ids;
            } catch (_) {}
        }
        let parsedDepartmentIds = [];
        if (r.department_ids) {
            try {
                parsedDepartmentIds = typeof r.department_ids === 'string' ? JSON.parse(r.department_ids) : r.department_ids;
            } catch (_) {}
        }

        const isCompanyBroadcast = Boolean(
            r.is_company_broadcast ||
            (r.is_announcement && r.company_id && !r.is_activity) ||
            (r.title && r.title.includes("Broadcast"))
        );

        return {
            ...r,
            type,
            displayTitle,
            partnerId,
            company_ids: Array.isArray(parsedCompanyIds) ? parsedCompanyIds : [],
            department_ids: Array.isArray(parsedDepartmentIds) ? parsedDepartmentIds : [],
            is_company_broadcast: isCompanyBroadcast,
            is_company_group: Boolean(r.is_company_group || r.company_id || (parsedCompanyIds && parsedCompanyIds.length > 0)),
            company_name: r.company_name || null,
            company_code: r.company_code || null,
            can_post: (r.can_post === null || r.can_post === undefined) ? true : Boolean(r.can_post),
            who_can_post: r.who_can_post || (isCompanyBroadcast ? 'ADMIN_ONLY' : 'ALL_MEMBERS'),
            is_announcement: Boolean(r.is_announcement),
            is_master: Boolean(r.is_master),
            is_activity: Boolean(r.is_activity),
            joined_at: r.joined_at,
            last_message: r.last_message_text || ''
        };
    });
};

// Get members of a conversation
const getConversationMembers = async (conversationId) => {
    const query = `
        SELECT 
            u.id, COALESCE(u.name, u.full_name) AS name, u.username, u.email, u.mob_no, u.role,
            cm.role AS conversation_role, cm.can_post, cm.unread_count, cm.joined_at,
            COALESCE(ut.type_name, ut.name) AS user_type_name
        FROM conversation_members cm
        JOIN users u ON cm.user_id = u.id
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
        WHERE cm.conversation_id = ?
        ORDER BY cm.role ASC, u.name ASC
    `;
    const [rows] = await db.execute(query, [conversationId]);
    return rows.map(r => ({
        ...r,
        can_post: (r.can_post === null || r.can_post === undefined) ? true : Boolean(r.can_post)
    }));
};

// Get a single conversation by ID
const getConversationById = async (conversationId) => {
    const [rows] = await db.execute(
        `SELECT c.*, d.department_name 
         FROM conversations c 
         LEFT JOIN departments d ON c.department_id = d.id 
         WHERE c.id = ? LIMIT 1`,
        [conversationId]
    );
    return rows.length > 0 ? rows[0] : null;
};

// Check if user is a member of a conversation
const isUserInConversation = async (conversationId, userId) => {
    const [rows] = await db.execute(
        "SELECT id, role, can_post, joined_at FROM conversation_members WHERE conversation_id = ? AND user_id = ? LIMIT 1",
        [conversationId, userId]
    );
    return rows.length > 0 ? rows[0] : null;
};

// Reset unread count for user in a conversation
const resetUnreadCount = async (conversationId, userId) => {
    await db.execute(
        "UPDATE conversation_members SET unread_count = 0 WHERE conversation_id = ? AND user_id = ?",
        [conversationId, userId]
    );
};

// Delete a conversation / group (only non-protected ones)
const deleteConversation = async (conversationId) => {
    // Safety check: do not delete protected system channels
    const [rows] = await db.execute(
        "SELECT id, is_activity, is_master FROM conversations WHERE id = ? LIMIT 1",
        [conversationId]
    );
    if (rows.length === 0) {
        throw new Error("Conversation not found");
    }
    const conv = rows[0];
    if (conv.is_activity || conv.is_master) {
        throw new Error("Cannot delete system/master channels");
    }
    // Delete conversation row (cascade will automatically delete messages, members, etc.)
    await db.execute("DELETE FROM conversations WHERE id = ?", [conversationId]);
    return true;
};

// Ensure Default #activity Group exists and enroll all active users
const ensureActivityGroup = async (adminId = 1) => {
    try {
        const [existing] = await db.execute(
            "SELECT id, title FROM conversations WHERE is_activity = 1 OR title = '#activity' OR title = '# activity' LIMIT 1"
        );

        let activityGroupId;
        if (existing.length === 0) {
            const [res] = await db.execute(
                `INSERT INTO conversations (type, title, description, created_by, is_announcement, is_master, is_activity, who_can_post, last_message_at)
                 VALUES ('GROUP', '#activity', 'Company-wide default activity channel for all team members, announcements, and workplace updates', ?, 0, 1, 1, 'ALL_MEMBERS', NOW())`,
                [adminId]
            );
            activityGroupId = res.insertId;
        } else {
            activityGroupId = existing[0].id;
            await db.execute(
                "UPDATE conversations SET is_activity = 1, is_master = 1, title = '#activity' WHERE id = ?",
                [activityGroupId]
            );
        }

        // Add all active users to this default activity group if not already added
        const [users] = await db.execute("SELECT id FROM users WHERE active = 1 OR is_active = 1 OR active IS NULL");
        for (const u of users) {
            const role = (Number(u.id) === Number(adminId)) ? 'ADMIN' : 'MEMBER';
            await db.execute(
                "INSERT IGNORE INTO conversation_members (conversation_id, user_id, role, can_post, joined_at) VALUES (?, ?, ?, 1, NOW())",
                [activityGroupId, u.id, role]
            );
        }
        return activityGroupId;
    } catch (e) {
        console.error("ensureActivityGroup error:", e.message);
    }
};

// Ensure Master Announcements Group exists and enroll all active users
const ensureMasterAnnouncementGroup = async (adminId = 1) => {
    try {
        const [existing] = await db.execute(
            "SELECT id FROM conversations WHERE is_master = 1 OR title LIKE '%Master Announcements%' LIMIT 1"
        );

        let masterGroupId;
        if (existing.length === 0) {
            const [res] = await db.execute(
                `INSERT INTO conversations (type, title, description, created_by, is_announcement, is_master, last_message_at)
                 VALUES ('GROUP', '📢 WHMCS Master Announcements', 'Official all-hands announcements and enterprise broadcasts', ?, 1, 1, NOW())`,
                [adminId]
            );
            masterGroupId = res.insertId;
        } else {
            masterGroupId = existing[0].id;
            await db.execute("UPDATE conversations SET is_master = 1, is_announcement = 1 WHERE id = ?", [masterGroupId]);
        }

        // Add all active users to this master group
        const [users] = await db.execute("SELECT id FROM users WHERE active = 1 OR is_active = 1 OR active IS NULL");
        for (const u of users) {
            const role = (Number(u.id) === Number(adminId)) ? 'ADMIN' : 'MEMBER';
            await db.execute(
                "INSERT IGNORE INTO conversation_members (conversation_id, user_id, role, can_post, joined_at) VALUES (?, ?, ?, 1, NOW())",
                [masterGroupId, u.id, role]
            );
        }
        return masterGroupId;
    } catch (e) {
        console.error("ensureMasterAnnouncementGroup error:", e.message);
    }
};

// Ensure Company-wise Broadcast Channel exists for a specific company and enroll members
const ensureCompanyBroadcastForCompany = async (companyId, companyName, adminId = 1) => {
    try {
        if (!companyId) return null;
        let cName = companyName;
        if (!cName) {
            const [cRows] = await db.execute("SELECT company_name FROM companies WHERE id = ?", [companyId]);
            if (cRows.length > 0) cName = cRows[0].company_name;
        }
        if (!cName) return null;

        const broadcastTitle = `📢 ${cName} Broadcast`;
        const [existing] = await db.execute(
            "SELECT id, title, who_can_post FROM conversations WHERE company_id = ? AND (is_company_broadcast = 1 OR title = ? OR title LIKE ?) LIMIT 1",
            [companyId, broadcastTitle, `%${cName} Broadcast%`]
        );

        let broadcastId;
        let currentWhoCanPost = 'ADMIN_ONLY';
        if (existing.length === 0) {
            const [res] = await db.execute(
                `INSERT INTO conversations (type, title, description, created_by, company_id, is_company_broadcast, is_announcement, is_company_group, who_can_post, last_message_at)
                 VALUES ('GROUP', ?, ?, ?, ?, 1, 1, 1, 'ADMIN_ONLY', NOW())`,
                [
                    broadcastTitle,
                    `Official company-wide broadcast & announcements channel for all ${cName} members`,
                    adminId || 1,
                    companyId
                ]
            );
            broadcastId = res.insertId;
        } else {
            broadcastId = existing[0].id;
            currentWhoCanPost = existing[0].who_can_post || 'ADMIN_ONLY';
            await db.execute(
                "UPDATE conversations SET is_company_broadcast = 1, is_announcement = 1, is_company_group = 1, company_id = ? WHERE id = ?",
                [companyId, broadcastId]
            );
        }

        // Enroll admin as ADMIN with posting permission
        if (adminId) {
            await db.execute(
                "INSERT IGNORE INTO conversation_members (conversation_id, user_id, role, can_post, joined_at) VALUES (?, ?, 'ADMIN', 1, NOW())",
                [broadcastId, adminId]
            );
        }

        // Enroll all active members of this company into the broadcast channel
        const [companyUsers] = await db.execute(
            "SELECT id, role FROM users WHERE company_id = ? AND (active = 1 OR is_active = 1 OR active IS NULL)",
            [companyId]
        );

        for (const u of companyUsers) {
            const isAdmin = u.role === 'admin' || u.role === 'master_admin';
            const canPost = isAdmin ? 1 : (currentWhoCanPost === 'ALL_MEMBERS' ? 1 : 0);
            await db.execute(
                "INSERT IGNORE INTO conversation_members (conversation_id, user_id, role, can_post, joined_at) VALUES (?, ?, ?, ?, NOW())",
                [broadcastId, u.id, isAdmin ? 'ADMIN' : 'MEMBER', canPost]
            );
        }

        return broadcastId;
    } catch (e) {
        console.error("ensureCompanyBroadcastForCompany error:", e.message);
        return null;
    }
};

// Ensure Company-wise Broadcast Channels exist for all companies and enroll members
const ensureCompanyBroadcasts = async (adminId = 1) => {
    try {
        const [companies] = await db.execute("SELECT id, company_name, company_code FROM companies");
        for (const company of companies) {
            await ensureCompanyBroadcastForCompany(company.id, company.company_name, adminId);
        }
    } catch (e) {
        console.error("ensureCompanyBroadcasts error:", e.message);
    }
};

// Update group settings (title, description, write access / who_can_post, allowed_member_ids)
const updateGroupSettings = async (conversationId, { title, description, who_can_post, allowed_member_ids, allowedMemberIds }) => {
    const updates = [];
    const values = [];

    if (title !== undefined && title.trim()) {
        updates.push("title = ?");
        values.push(title.trim());
    }
    if (description !== undefined) {
        updates.push("description = ?");
        values.push(description);
    }
    if (who_can_post !== undefined && ['ALL_MEMBERS', 'ADMIN_ONLY', 'SELECTED_MEMBERS'].includes(who_can_post)) {
        updates.push("who_can_post = ?");
        values.push(who_can_post);
    }

    if (updates.length > 0) {
        values.push(conversationId);
        await db.execute(`UPDATE conversations SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, values);
    }

    // Handle selected members permissions
    const allowedIds = allowed_member_ids || allowedMemberIds;
    if (who_can_post === 'SELECTED_MEMBERS' && Array.isArray(allowedIds)) {
        const idList = allowedIds.map(Number).filter(Boolean);
        if (idList.length > 0) {
            const placeholders = idList.map(() => '?').join(',');
            await db.execute(
                `UPDATE conversation_members SET can_post = CASE WHEN role = 'ADMIN' OR user_id IN (${placeholders}) THEN 1 ELSE 0 END WHERE conversation_id = ?`,
                [...idList, conversationId]
            );
        } else {
            await db.execute(
                "UPDATE conversation_members SET can_post = CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END WHERE conversation_id = ?",
                [conversationId]
            );
        }
    } else if (who_can_post === 'ALL_MEMBERS') {
        await db.execute(
            "UPDATE conversation_members SET can_post = 1 WHERE conversation_id = ?",
            [conversationId]
        );
    } else if (who_can_post === 'ADMIN_ONLY') {
        await db.execute(
            "UPDATE conversation_members SET can_post = CASE WHEN role = 'ADMIN' THEN 1 ELSE 0 END WHERE conversation_id = ?",
            [conversationId]
        );
    }

    const [rows] = await db.execute("SELECT * FROM conversations WHERE id = ?", [conversationId]);
    return rows[0];
};

module.exports = {
    createConversationTables,
    findDirectConversation,
    createDirectConversation,
    createGroupConversation,
    getUserConversations,
    getConversationMembers,
    getConversationById,
    isUserInConversation,
    resetUnreadCount,
    deleteConversation,
    ensureActivityGroup,
    addUserToDefaultGroups,
    ensureMasterAnnouncementGroup,
    ensureCompanyBroadcasts,
    ensureCompanyBroadcastForCompany,
    updateGroupSettings
};
