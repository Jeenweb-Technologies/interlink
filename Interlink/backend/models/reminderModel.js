const db = require("../config/db.js");
const crypto = require("crypto");

const initReminderTables = async () => {
    // 1. Reminders Master Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS reminders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NULL,
            
            -- Polymorphic association
            source_type ENUM('personal', 'task', 'project', 'document', 'approval', 'meeting') DEFAULT 'personal',
            source_id INT NULL,
            deep_link_url VARCHAR(500) NULL,
            
            -- Trigger & Timing
            trigger_at DATETIME NOT NULL,
            timezone VARCHAR(64) DEFAULT 'UTC',
            is_recurring BOOLEAN DEFAULT FALSE,
            recurrence_rule JSON NULL,
            
            -- Lifecycle States
            status ENUM('pending', 'snoozed', 'completed', 'dismissed', 'escalated', 'expired') DEFAULT 'pending',
            snooze_until DATETIME NULL,
            snooze_count INT DEFAULT 0,
            completed_at DATETIME NULL,
            dismissed_at DATETIME NULL,
            
            -- Escalation
            escalation_enabled BOOLEAN DEFAULT FALSE,
            escalation_rule JSON NULL,
            escalated_at DATETIME NULL,
            escalated_to_user_id INT NULL,
            
            -- Deduplication & Expiry
            dedup_hash VARCHAR(64) NOT NULL,
            expires_at DATETIME NULL,
            
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_rem_trigger (status, trigger_at),
            INDEX idx_rem_snooze (status, snooze_until),
            INDEX idx_rem_dedup (dedup_hash),
            INDEX idx_rem_source (source_type, source_id),
            INDEX idx_rem_user (user_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. User Reminder Communication Preferences Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS reminder_preferences (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL UNIQUE,
            channel_in_app BOOLEAN DEFAULT TRUE,
            channel_push BOOLEAN DEFAULT TRUE,
            channel_email BOOLEAN DEFAULT TRUE,
            
            -- Category Specific Configurations
            notify_tasks JSON NULL,
            notify_projects JSON NULL,
            notify_approvals JSON NULL,
            notify_meetings JSON NULL,
            notify_personal JSON NULL,
            
            -- Quiet Hours (DND)
            quiet_hours_enabled BOOLEAN DEFAULT FALSE,
            quiet_hours_start TIME DEFAULT '22:00:00',
            quiet_hours_end TIME DEFAULT '08:00:00',
            timezone VARCHAR(64) DEFAULT 'UTC',
            
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Reminder Delivery Audit Logs
    await db.execute(`
        CREATE TABLE IF NOT EXISTS reminder_delivery_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            reminder_id INT NOT NULL,
            user_id INT NOT NULL,
            channel ENUM('in_app', 'push', 'email') NOT NULL,
            status ENUM('queued', 'sent', 'failed', 'suppressed_quiet_hours') DEFAULT 'sent',
            error_message TEXT NULL,
            delivered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE,
            INDEX idx_deliv_rem (reminder_id),
            INDEX idx_deliv_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("[Reminders] Tables verified and ready.");
};

// Generate dedup hash to avoid duplicate noisy triggers
const generateDedupHash = (sourceType, sourceId, userId, triggerAt) => {
    const triggerDateStr = new Date(triggerAt).toISOString().slice(0, 10);
    const raw = `${sourceType || 'personal'}_${sourceId || 0}_${userId}_${triggerDateStr}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
};

// Fetch reminders for user
const getReminders = async (userId, organizationId, options = {}) => {
    const {
        status = 'all', // all, pending, overdue, today, upcoming, snoozed, completed
        sourceType = null,
        limit = 50,
        offset = 0
    } = options;

    const whereClauses = ['r.user_id = ?', 'r.organization_id = ?'];
    const params = [userId, organizationId];

    if (sourceType) {
        whereClauses.push('r.source_type = ?');
        params.push(sourceType);
    }

    const now = new Date();

    if (status === 'overdue') {
        whereClauses.push(`(r.status = 'pending' AND r.trigger_at < NOW())`);
    } else if (status === 'today') {
        whereClauses.push(`(
            (r.status IN ('pending', 'snoozed') AND DATE(r.trigger_at) = CURDATE())
            OR (r.status = 'snoozed' AND DATE(r.snooze_until) = CURDATE())
        )`);
    } else if (status === 'upcoming') {
        whereClauses.push(`(r.status = 'pending' AND r.trigger_at > NOW())`);
    } else if (status === 'snoozed') {
        whereClauses.push(`r.status = 'snoozed'`);
    } else if (status === 'completed') {
        whereClauses.push(`r.status = 'completed'`);
    } else if (status === 'dismissed') {
        whereClauses.push(`r.status = 'dismissed'`);
    } else if (status === 'pending') {
        whereClauses.push(`r.status IN ('pending', 'snoozed')`);
    }

    const safeLimit = Math.max(1, parseInt(limit, 10) || 50);
    const safeOffset = Math.max(0, parseInt(offset, 10) || 0);

    const query = `
        SELECT 
            r.*,
            DATE_FORMAT(r.trigger_at, '%Y-%m-%d %H:%i:%s') as trigger_at,
            DATE_FORMAT(r.snooze_until, '%Y-%m-%d %H:%i:%s') as snooze_until,
            DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
            u.name as user_name,
            u.email as user_email,
            esc_u.name as escalated_to_user_name
        FROM reminders r
        JOIN users u ON r.user_id = u.id
        LEFT JOIN users esc_u ON r.escalated_to_user_id = esc_u.id
        WHERE ${whereClauses.join(' AND ')}
        ORDER BY 
            CASE 
                WHEN r.status = 'pending' AND r.trigger_at < NOW() THEN 1
                WHEN r.status = 'snoozed' THEN 2
                WHEN r.status = 'pending' THEN 3
                ELSE 4
            END ASC,
            r.trigger_at ASC
        LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;

    const [rows] = await db.execute(query, params);
    return rows;
};

// Get single reminder by ID
const getReminderById = async (reminderId) => {
    const [rows] = await db.execute(`
        SELECT 
            r.*,
            DATE_FORMAT(r.trigger_at, '%Y-%m-%d %H:%i:%s') as trigger_at,
            DATE_FORMAT(r.snooze_until, '%Y-%m-%d %H:%i:%s') as snooze_until,
            DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') as created_at,
            u.name as user_name,
            u.email as user_email
        FROM reminders r
        JOIN users u ON r.user_id = u.id
        WHERE r.id = ?
    `, [reminderId]);
    return rows.length > 0 ? rows[0] : null;
};

// Create a new reminder
const createReminder = async (reminderData) => {
    const {
        organization_id = 1,
        company_id = 1,
        user_id,
        title,
        description = null,
        source_type = 'personal',
        source_id = null,
        deep_link_url = null,
        trigger_at,
        timezone = 'UTC',
        is_recurring = false,
        recurrence_rule = null,
        escalation_enabled = false,
        escalation_rule = null,
        expires_at = null
    } = reminderData;

    const dedup_hash = generateDedupHash(source_type, source_id, user_id, trigger_at);

    // If an identical pending reminder exists for the same item and day, update its trigger time rather than spamming
    const [existing] = await db.execute(`
        SELECT id FROM reminders 
        WHERE dedup_hash = ? AND status IN ('pending', 'snoozed')
        LIMIT 1
    `, [dedup_hash]);

    if (existing.length > 0) {
        const existingId = existing[0].id;
        await db.execute(`
            UPDATE reminders 
            SET title = ?, description = ?, trigger_at = ?, deep_link_url = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [title, description, trigger_at, deep_link_url, existingId]);
        return existingId;
    }

    const [result] = await db.execute(`
        INSERT INTO reminders (
            organization_id, company_id, user_id, title, description,
            source_type, source_id, deep_link_url, trigger_at, timezone,
            is_recurring, recurrence_rule, escalation_enabled, escalation_rule,
            dedup_hash, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        organization_id, company_id, user_id, title, description,
        source_type, source_id, deep_link_url, trigger_at, timezone,
        is_recurring ? 1 : 0,
        recurrence_rule ? JSON.stringify(recurrence_rule) : null,
        escalation_enabled ? 1 : 0,
        escalation_rule ? JSON.stringify(escalation_rule) : null,
        dedup_hash, expires_at
    ]);

    return result.insertId;
};

// Snooze reminder
const snoozeReminder = async (reminderId, snoozeData) => {
    // If snoozeData is a string/date (backwards compatibility) or object
    const minutes = (snoozeData && typeof snoozeData === 'object') ? snoozeData.minutes : null;
    const snoozeUntil = (snoozeData && typeof snoozeData === 'object') ? snoozeData.snoozeUntil : snoozeData;

    if (minutes && Number(minutes) > 0) {
        await db.execute(`
            UPDATE reminders 
            SET status = 'snoozed',
                snooze_until = DATE_ADD(NOW(), INTERVAL ? MINUTE),
                snooze_count = snooze_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [Number(minutes), reminderId]);
    } else if (snoozeUntil) {
        let formattedSnooze = snoozeUntil;
        if (typeof snoozeUntil === 'string' && snoozeUntil.includes('T')) {
            const d = new Date(snoozeUntil);
            if (!isNaN(d.getTime())) {
                const pad = (n) => String(n).padStart(2, '0');
                formattedSnooze = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            }
        }
        await db.execute(`
            UPDATE reminders 
            SET status = 'snoozed',
                snooze_until = ?,
                snooze_count = snooze_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [formattedSnooze, reminderId]);
    }
    return true;
};

// Complete reminder
const completeReminder = async (reminderId) => {
    await db.execute(`
        UPDATE reminders 
        SET status = 'completed',
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [reminderId]);
    return true;
};

// Dismiss reminder
const dismissReminder = async (reminderId) => {
    await db.execute(`
        UPDATE reminders 
        SET status = 'dismissed',
            dismissed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [reminderId]);
    return true;
};

// Escalate reminder
const escalateReminder = async (reminderId, escalatedToUserId) => {
    await db.execute(`
        UPDATE reminders 
        SET status = 'escalated',
            escalated_at = CURRENT_TIMESTAMP,
            escalated_to_user_id = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [escalatedToUserId, reminderId]);
    return true;
};

// Delete reminder
const deleteReminder = async (reminderId) => {
    await db.execute(`DELETE FROM reminders WHERE id = ?`, [reminderId]);
    return true;
};

// User reminder preferences
const getReminderPreferences = async (userId) => {
    const [rows] = await db.execute(`
        SELECT * FROM reminder_preferences WHERE user_id = ?
    `, [userId]);

    if (rows.length > 0) {
        const p = rows[0];
        try { if (typeof p.notify_tasks === 'string') p.notify_tasks = JSON.parse(p.notify_tasks); } catch (_) {}
        try { if (typeof p.notify_projects === 'string') p.notify_projects = JSON.parse(p.notify_projects); } catch (_) {}
        try { if (typeof p.notify_approvals === 'string') p.notify_approvals = JSON.parse(p.notify_approvals); } catch (_) {}
        try { if (typeof p.notify_meetings === 'string') p.notify_meetings = JSON.parse(p.notify_meetings); } catch (_) {}
        try { if (typeof p.notify_personal === 'string') p.notify_personal = JSON.parse(p.notify_personal); } catch (_) {}
        return p;
    }

    // Default preferences
    return {
        user_id: userId,
        channel_in_app: 1,
        channel_push: 1,
        channel_email: 1,
        notify_tasks: { in_app: true, push: true, email: false },
        notify_projects: { in_app: true, push: false, email: true },
        notify_approvals: { in_app: true, push: true, email: true },
        notify_meetings: { in_app: true, push: true, email: false },
        notify_personal: { in_app: true, push: true, email: false },
        quiet_hours_enabled: 0,
        quiet_hours_start: '22:00:00',
        quiet_hours_end: '08:00:00',
        timezone: 'UTC'
    };
};

const updateReminderPreferences = async (userId, prefs) => {
    const {
        channel_in_app = true,
        channel_push = true,
        channel_email = true,
        notify_tasks = { in_app: true, push: true, email: false },
        notify_projects = { in_app: true, push: false, email: true },
        notify_approvals = { in_app: true, push: true, email: true },
        notify_meetings = { in_app: true, push: true, email: false },
        notify_personal = { in_app: true, push: true, email: false },
        quiet_hours_enabled = false,
        quiet_hours_start = '22:00:00',
        quiet_hours_end = '08:00:00',
        timezone = 'UTC'
    } = prefs;

    await db.execute(`
        INSERT INTO reminder_preferences (
            user_id, channel_in_app, channel_push, channel_email,
            notify_tasks, notify_projects, notify_approvals, notify_meetings, notify_personal,
            quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            channel_in_app = VALUES(channel_in_app),
            channel_push = VALUES(channel_push),
            channel_email = VALUES(channel_email),
            notify_tasks = VALUES(notify_tasks),
            notify_projects = VALUES(notify_projects),
            notify_approvals = VALUES(notify_approvals),
            notify_meetings = VALUES(notify_meetings),
            notify_personal = VALUES(notify_personal),
            quiet_hours_enabled = VALUES(quiet_hours_enabled),
            quiet_hours_start = VALUES(quiet_hours_start),
            quiet_hours_end = VALUES(quiet_hours_end),
            timezone = VALUES(timezone)
    `, [
        userId,
        channel_in_app ? 1 : 0,
        channel_push ? 1 : 0,
        channel_email ? 1 : 0,
        JSON.stringify(notify_tasks),
        JSON.stringify(notify_projects),
        JSON.stringify(notify_approvals),
        JSON.stringify(notify_meetings),
        JSON.stringify(notify_personal),
        quiet_hours_enabled ? 1 : 0,
        quiet_hours_start,
        quiet_hours_end,
        timezone
    ]);

    return true;
};

// Scheduler worker fetch
const getDueRemindersForWorker = async (limit = 100) => {
    const safeLimit = Math.max(1, parseInt(limit, 10) || 100);
    const [rows] = await db.execute(`
        SELECT 
            r.*,
            DATE_FORMAT(r.trigger_at, '%Y-%m-%d %H:%i:%s') as trigger_at,
            DATE_FORMAT(r.snooze_until, '%Y-%m-%d %H:%i:%s') as snooze_until,
            u.name as user_name,
            u.email as user_email
        FROM reminders r
        JOIN users u ON r.user_id = u.id
        WHERE (
            (r.status = 'pending' AND r.trigger_at <= NOW())
            OR (r.status = 'snoozed' AND r.snooze_until <= NOW())
        )
        AND NOT EXISTS (
            SELECT 1 FROM reminder_delivery_logs rdl 
            WHERE rdl.reminder_id = r.id 
              AND rdl.channel = 'in_app'
              AND rdl.status = 'sent'
              AND rdl.delivered_at >= COALESCE(r.snooze_until, r.trigger_at)
        )
        ORDER BY r.trigger_at ASC
        LIMIT ${safeLimit}
    `);
    return rows;
};

const logReminderDelivery = async (reminderId, userId, channel, status = 'sent', errorMessage = null) => {
    await db.execute(`
        INSERT INTO reminder_delivery_logs (reminder_id, user_id, channel, status, error_message)
        VALUES (?, ?, ?, ?, ?)
    `, [reminderId, userId, channel, status, errorMessage]);
};

// Get summary metrics for Reminder Center header badge
const getReminderMetrics = async (userId, organizationId) => {
    const [rows] = await db.execute(`
        SELECT 
            COUNT(CASE WHEN status = 'pending' AND trigger_at < NOW() THEN 1 END) as overdue_count,
            COUNT(CASE WHEN (status IN ('pending', 'snoozed') AND DATE(trigger_at) = CURDATE()) 
                         OR (status = 'snoozed' AND DATE(snooze_until) = CURDATE()) THEN 1 END) as today_count,
            COUNT(CASE WHEN status = 'snoozed' THEN 1 END) as snoozed_count,
            COUNT(CASE WHEN status = 'upcoming' OR (status = 'pending' AND trigger_at > NOW()) THEN 1 END) as upcoming_count
        FROM reminders
        WHERE user_id = ? AND organization_id = ?
    `, [userId, organizationId]);

    return rows.length > 0 ? rows[0] : { overdue_count: 0, today_count: 0, snoozed_count: 0, upcoming_count: 0 };
};

module.exports = {
    initReminderTables,
    generateDedupHash,
    getReminders,
    getReminderById,
    createReminder,
    snoozeReminder,
    completeReminder,
    dismissReminder,
    escalateReminder,
    deleteReminder,
    getReminderPreferences,
    updateReminderPreferences,
    getDueRemindersForWorker,
    logReminderDelivery,
    getReminderMetrics
};
