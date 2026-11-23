const db = require("../config/db.js");

const createNotificationTables = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            sender_id INT NULL,
            type ENUM('CHAT_MESSAGE', 'GROUP_INVITE', 'MENTION', 'SYSTEM') DEFAULT 'CHAT_MESSAGE',
            title VARCHAR(150) NOT NULL,
            message TEXT NULL,
            body TEXT NULL,
            link_url VARCHAR(255) NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_notif_user (user_id, is_read)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(query);

    // Ensure columns exist if table was previously created with older schema
    const columnsToEnsure = [
        { name: 'sender_id', sql: 'ALTER TABLE notifications ADD COLUMN sender_id INT NULL AFTER user_id' },
        { name: 'type', sql: "ALTER TABLE notifications ADD COLUMN type ENUM('CHAT_MESSAGE', 'GROUP_INVITE', 'MENTION', 'SYSTEM') DEFAULT 'CHAT_MESSAGE' AFTER sender_id" },
        { name: 'body', sql: 'ALTER TABLE notifications ADD COLUMN body TEXT NULL AFTER title' },
        { name: 'message', sql: 'ALTER TABLE notifications ADD COLUMN message TEXT NULL AFTER body' },
        { name: 'link_url', sql: 'ALTER TABLE notifications ADD COLUMN link_url VARCHAR(255) NULL AFTER message' }
    ];

    for (const col of columnsToEnsure) {
        try {
            const [rows] = await db.execute(`SHOW COLUMNS FROM notifications LIKE '${col.name}'`);
            if (rows.length === 0) {
                await db.execute(col.sql);
            }
        } catch (e) {
            // Ignore if column exists
        }
    }

    console.log("Notification tables ready");
};

const createNotification = async ({ userId, senderId, type = 'CHAT_MESSAGE', title, body, linkUrl = null }) => {
    const query = `
        INSERT INTO notifications (user_id, sender_id, type, title, body, message, link_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
        userId,
        senderId || null,
        type,
        title,
        body,
        body, // for backward compatibility with message column
        linkUrl
    ]);
    return result.insertId;
};

const getUserNotifications = async (userId, limit = 20) => {
    const safeLimit = Math.max(1, parseInt(limit, 10) || 20);
    const query = `
        SELECT 
            n.id, n.user_id, n.sender_id, n.type, n.title, 
            COALESCE(n.body, n.message) AS body, 
            n.link_url, n.is_read, n.created_at,
            u.name AS sender_name, u.username AS sender_username
        FROM notifications n
        LEFT JOIN users u ON n.sender_id = u.id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT ${safeLimit}
    `;
    const [rows] = await db.execute(query, [userId]);
    return rows;
};

const getUnreadNotificationCount = async (userId) => {
    const [rows] = await db.execute(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE",
        [userId]
    );
    return rows[0].count;
};

const markNotificationAsRead = async (notificationId, userId) => {
    await db.execute(
        "UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?",
        [notificationId, userId]
    );
};

const markAllNotificationsAsRead = async (userId) => {
    await db.execute(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = ?",
        [userId]
    );
};

module.exports = {
    createNotificationTables,
    createNotification,
    getUserNotifications,
    getUnreadNotificationCount,
    markNotificationAsRead,
    markAllNotificationsAsRead
};
