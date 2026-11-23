const db = require("../config/db.js");

const createMessageTables = async () => {
    // 1. Messages Table
    const createMessagesQuery = `
        CREATE TABLE IF NOT EXISTS messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            conversation_id INT NOT NULL,
            sender_id INT NOT NULL,
            reply_to_id INT NULL,
            message_type ENUM('TEXT', 'FILE', 'IMAGE', 'POLL', 'SYSTEM') DEFAULT 'TEXT',
            content TEXT NOT NULL,
            poll_id INT NULL,
            is_edited BOOLEAN DEFAULT FALSE,
            edited_at TIMESTAMP NULL,
            is_deleted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_msg_conv (conversation_id, created_at DESC),
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createMessagesQuery);

    // 2. Message Attachments Table
    const createAttachmentsQuery = `
        CREATE TABLE IF NOT EXISTS message_attachments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            message_id INT NULL,
            original_name VARCHAR(255) NOT NULL,
            stored_name VARCHAR(255) NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            file_size BIGINT NOT NULL,
            storage_provider ENUM('LOCAL', 'GCS') DEFAULT 'LOCAL',
            cloud_bucket VARCHAR(150) NULL,
            cloud_key VARCHAR(500) NULL,
            public_url VARCHAR(1000) NULL,
            uploaded_by INT NOT NULL,
            download_count INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_att_msg (message_id),
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createAttachmentsQuery);

    // 3. Message Deletions Table (for Delete For Me)
    const createDeletionsQuery = `
        CREATE TABLE IF NOT EXISTS message_deletions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            message_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_msg (message_id, user_id),
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createDeletionsQuery);

    // Dynamic schema migrations for future-proof storage providers and message types
    try {
        await db.execute("ALTER TABLE messages MODIFY COLUMN message_type VARCHAR(30) DEFAULT 'TEXT'");
    } catch (e) {}
    try {
        await db.execute("ALTER TABLE message_attachments MODIFY COLUMN storage_provider VARCHAR(50) DEFAULT 'LOCAL'");
    } catch (e) {}

    console.log("Message tables ready");
};

// Create a message
const createMessage = async ({ conversationId, senderId, content, messageType = 'TEXT', replyToId = null, pollId = null }) => {
    const query = `
        INSERT INTO messages (conversation_id, sender_id, reply_to_id, message_type, content, poll_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
        conversationId,
        senderId,
        replyToId || null,
        messageType,
        content,
        pollId || null
    ]);
    const messageId = result.insertId;

    // Update conversation last_message_text, last_message_at, and increment unread counts
    await db.execute(
        `UPDATE conversations 
         SET last_message_text = ?, last_message_at = NOW() 
         WHERE id = ?`,
        [content.slice(0, 200), conversationId]
    );

    // Increment unread_count for all other conversation members
    await db.execute(
        `UPDATE conversation_members 
         SET unread_count = unread_count + 1 
         WHERE conversation_id = ? AND user_id != ?`,
        [conversationId, senderId]
    );

    return await getMessageById(messageId);
};

// Add attachment to message
const addAttachment = async ({
    messageId,
    originalName,
    storedName,
    mimeType,
    fileSize,
    storageProvider = 'LOCAL',
    cloudBucket = null,
    cloudKey = null,
    publicUrl = null,
    uploadedBy
}) => {
    const query = `
        INSERT INTO message_attachments 
        (message_id, original_name, stored_name, mime_type, file_size, storage_provider, cloud_bucket, cloud_key, public_url, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.execute(query, [
        messageId || null,
        originalName,
        storedName,
        mimeType,
        fileSize,
        storageProvider,
        cloudBucket,
        cloudKey,
        publicUrl,
        uploadedBy
    ]);
    return result.insertId;
};

// Get single message by ID
const getMessageById = async (messageId) => {
    const query = `
        SELECT 
            m.id, m.conversation_id, m.sender_id, m.reply_to_id, m.message_type, m.content, m.poll_id,
            m.is_edited, m.edited_at, m.is_deleted, m.created_at,
            COALESCE(u.name, u.full_name) AS sender_name, u.username AS sender_username, u.email AS sender_email,
            -- Reply preview
            rm.content AS reply_content, COALESCE(ru.name, ru.full_name) AS reply_sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN messages rm ON m.reply_to_id = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        WHERE m.id = ?
    `;
    const [rows] = await db.execute(query, [messageId]);
    if (rows.length === 0) return null;

    const msg = rows[0];
    msg.message_text = msg.content;
    msg.reply_to_text = msg.reply_content;

    // Fetch attachments if any
    const [attachments] = await db.execute(
        "SELECT * FROM message_attachments WHERE message_id = ?",
        [messageId]
    );
    msg.attachments = attachments;
    if (attachments.length > 0) {
        msg.attachmentId = attachments[0].id;
        msg.file_name = attachments[0].original_name;
        msg.file_type = attachments[0].mime_type;
        msg.file_size = attachments[0].file_size;
    }

    return msg;
};

// Fetch messages for a conversation (supports post-join timestamp filtering and delete for me filtering)
const getConversationMessages = async (conversationId, limit = 50, beforeId = null, joinedAt = null, userId = null) => {
    const safeLimit = Math.max(1, parseInt(limit, 10) || 50);
    let where = "WHERE m.conversation_id = ?";
    const params = [conversationId];

    if (userId) {
        where += " AND m.id NOT IN (SELECT message_id FROM message_deletions WHERE user_id = ?)";
        params.push(userId);
    }

    if (joinedAt) {
        where += " AND m.created_at >= ?";
        params.push(joinedAt);
    }

    if (beforeId) {
        where += " AND m.id < ?";
        params.push(beforeId);
    }

    const query = `
        SELECT 
            m.id, m.conversation_id, m.sender_id, m.reply_to_id, m.message_type, m.content, m.poll_id,
            m.is_edited, m.edited_at, m.is_deleted, m.created_at,
            COALESCE(u.name, u.full_name) AS sender_name, u.username AS sender_username, u.email AS sender_email,
            rm.content AS reply_content, COALESCE(ru.name, ru.full_name) AS reply_sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        LEFT JOIN messages rm ON m.reply_to_id = rm.id
        LEFT JOIN users ru ON rm.sender_id = ru.id
        ${where}
        ORDER BY m.id DESC
        LIMIT ${safeLimit}
    `;
    const [rows] = await db.execute(query, params);

    // Fetch attachments for these messages
    if (rows.length > 0) {
        const messageIds = rows.map(r => r.id);
        const placeholders = messageIds.map(() => '?').join(',');
        const [attachments] = await db.execute(
            `SELECT * FROM message_attachments WHERE message_id IN (${placeholders})`,
            messageIds
        );

        const attachmentMap = {};
        attachments.forEach(att => {
            if (!attachmentMap[att.message_id]) attachmentMap[att.message_id] = [];
            attachmentMap[att.message_id].push(att);
        });

        rows.forEach(r => {
            if (r.is_deleted) {
                r.content = "This message was deleted";
                r.message_text = "This message was deleted";
                r.reply_to_text = null;
                r.attachments = [];
                r.attachmentId = null;
                r.file_name = null;
                r.file_type = null;
                r.file_size = 0;
            } else {
                r.attachments = attachmentMap[r.id] || [];
                r.message_text = r.content;
                r.reply_to_text = r.reply_content;
                if (r.attachments.length > 0) {
                    r.attachmentId = r.attachments[0].id;
                    r.file_name = r.attachments[0].original_name;
                    r.file_type = r.attachments[0].mime_type;
                    r.file_size = r.attachments[0].file_size;
                }
            }
        });
    } else {
        rows.forEach(r => {
            if (r.is_deleted) {
                r.content = "This message was deleted";
                r.message_text = "This message was deleted";
                r.reply_to_text = null;
            } else {
                r.message_text = r.content;
                r.reply_to_text = r.reply_content;
            }
            r.attachments = [];
        });
    }

    return rows.reverse(); // Return in chronological order
};

// Delete message for me
const deleteMessageForMe = async (messageId, userId) => {
    await db.execute(
        "INSERT IGNORE INTO message_deletions (message_id, user_id) VALUES (?, ?)",
        [messageId, userId]
    );
    return true;
};

// Delete message for everyone
const deleteMessageForEveryone = async (messageId) => {
    await db.execute(
        "UPDATE messages SET is_deleted = 1, content = 'This message was deleted' WHERE id = ?",
        [messageId]
    );
    // Delete any attachments associated with this message
    await db.execute("DELETE FROM message_attachments WHERE message_id = ?", [messageId]);
    return true;
};

// Get attachment by ID (supports direct attachment ID or message ID fallback)
const getAttachmentById = async (attachmentId) => {
    if (!attachmentId) return null;
    const [rows] = await db.execute("SELECT * FROM message_attachments WHERE id = ?", [attachmentId]);
    if (rows.length > 0) return rows[0];
    // Fallback: check if the id provided is a message_id
    const [fallbackRows] = await db.execute("SELECT * FROM message_attachments WHERE message_id = ? ORDER BY id DESC LIMIT 1", [attachmentId]);
    return fallbackRows.length > 0 ? fallbackRows[0] : null;
};

// Increment download count
const incrementAttachmentDownload = async (attachmentId) => {
    await db.execute("UPDATE message_attachments SET download_count = download_count + 1 WHERE id = ?", [attachmentId]);
};

module.exports = {
    createMessageTables,
    createMessage,
    addAttachment,
    getMessageById,
    getConversationMessages,
    deleteMessageForMe,
    deleteMessageForEveryone,
    getAttachmentById,
    incrementAttachmentDownload
};
