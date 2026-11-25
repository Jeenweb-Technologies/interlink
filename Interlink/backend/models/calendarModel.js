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
            console.log(`[Calendar] Added column ${columnName} to ${tableName}`);
        }
    } catch (err) {
        console.error(`[Calendar] Error ensuring column ${columnName} in ${tableName}:`, err.message);
    }
};

const initCalendarTables = async () => {
    // 1. Calendars Master Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS calendars (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            owner_id INT NOT NULL,
            name VARCHAR(150) NOT NULL,
            description TEXT NULL,
            color VARCHAR(32) NOT NULL DEFAULT '#2878C7',
            type ENUM('personal', 'shared', 'project', 'department', 'resource') DEFAULT 'personal',
            department_id INT NULL,
            project_id INT NULL,
            is_default BOOLEAN DEFAULT FALSE,
            is_public BOOLEAN DEFAULT FALSE,
            timezone VARCHAR(64) DEFAULT 'UTC',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_cal_tenant (organization_id, company_id),
            INDEX idx_cal_owner (owner_id),
            INDEX idx_cal_dept (department_id),
            INDEX idx_cal_proj (project_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Calendar Granular Sharing Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS calendar_shares (
            id INT AUTO_INCREMENT PRIMARY KEY,
            calendar_id INT NOT NULL,
            shared_with_user_id INT NULL,
            shared_with_department_id INT NULL,
            permission_level ENUM('free_busy_only', 'view_details', 'edit', 'admin') DEFAULT 'free_busy_only',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
            FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_share_cal (calendar_id),
            INDEX idx_share_user (shared_with_user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Calendar Events Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS calendar_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            calendar_id INT NOT NULL,
            creator_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            description LONGTEXT NULL,
            location VARCHAR(255) NULL,
            meeting_url VARCHAR(500) NULL,
            is_all_day BOOLEAN DEFAULT FALSE,
            start_time DATETIME NOT NULL,
            end_time DATETIME NOT NULL,
            timezone VARCHAR(64) DEFAULT 'UTC',
            category ENUM('general', 'meeting', 'task', 'reminder', 'holiday', 'out_of_office') DEFAULT 'general',
            color_override VARCHAR(32) NULL,
            
            -- Recurrence (RFC 5545 JSON or rule string)
            is_recurring BOOLEAN DEFAULT FALSE,
            recurrence_rule JSON NULL,
            recurrence_parent_id INT NULL,
            recurrence_exception_date DATE NULL,
            
            -- Linked module context
            linked_meeting_id INT NULL,
            linked_task_id INT NULL,
            linked_project_id INT NULL,

            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP NULL,
            FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
            FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (recurrence_parent_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
            INDEX idx_evt_time (start_time, end_time),
            INDEX idx_evt_cal (calendar_id),
            INDEX idx_evt_creator (creator_id),
            INDEX idx_evt_parent (recurrence_parent_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Attendees and RSVP Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS calendar_event_attendees (
            id INT AUTO_INCREMENT PRIMARY KEY,
            event_id INT NOT NULL,
            user_id INT NULL,
            guest_email VARCHAR(150) NULL,
            guest_name VARCHAR(100) NULL,
            is_organizer BOOLEAN DEFAULT FALSE,
            rsvp_status ENUM('needs_action', 'accepted', 'tentative', 'declined') DEFAULT 'needs_action',
            response_notes TEXT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX idx_att_event (event_id),
            INDEX idx_att_user (user_id, rsvp_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. External Calendar Sync Credentials & Webhook Subscriptions Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS calendar_external_sync (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            calendar_id INT NOT NULL,
            provider ENUM('google', 'microsoft') NOT NULL,
            external_calendar_id VARCHAR(255) NOT NULL,
            sync_direction ENUM('import_only', 'export_only', 'bidirectional') DEFAULT 'bidirectional',
            access_token TEXT NOT NULL,
            refresh_token TEXT NOT NULL,
            token_expires_at DATETIME NOT NULL,
            sync_token TEXT NULL,
            webhook_channel_id VARCHAR(128) NULL,
            webhook_expires_at DATETIME NULL,
            last_synced_at DATETIME NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (calendar_id) REFERENCES calendars(id) ON DELETE CASCADE,
            INDEX idx_sync_user_provider (user_id, provider)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("[Calendar] Tables verified and ready.");
};

// Ensure a default personal calendar exists for user
const ensureDefaultCalendar = async (organizationId, companyId, userId, userName = "My Calendar") => {
    const [existing] = await db.execute(`
        SELECT * FROM calendars 
        WHERE owner_id = ? AND organization_id = ? AND is_default = TRUE 
        LIMIT 1
    `, [userId, organizationId]);

    if (existing.length > 0) {
        return existing[0];
    }

    const [result] = await db.execute(`
        INSERT INTO calendars (
            organization_id, company_id, owner_id, name, description, color, type, is_default, is_public
        ) VALUES (?, ?, ?, ?, 'Primary personal calendar', '#2878C7', 'personal', TRUE, FALSE)
    `, [organizationId, companyId, userId, userName]);

    return {
        id: result.insertId,
        organization_id: organizationId,
        company_id: companyId,
        owner_id: userId,
        name: userName,
        color: '#2878C7',
        type: 'personal',
        is_default: 1
    };
};

// Fetch all calendars accessible to the user (owned + shared + public org)
const getUserAccessibleCalendars = async (organizationId, companyId, userId, userDepartmentId = null) => {
    await ensureDefaultCalendar(organizationId, companyId, userId);

    const [rows] = await db.execute(`
        SELECT 
            c.*,
            u.name as owner_name,
            u.email as owner_email,
            cs.permission_level,
            CASE 
                WHEN c.owner_id = ? THEN 'admin'
                WHEN cs.permission_level IS NOT NULL THEN cs.permission_level
                WHEN c.is_public = 1 THEN 'view_details'
                ELSE 'none'
            END as effective_permission
        FROM calendars c
        JOIN users u ON c.owner_id = u.id
        LEFT JOIN calendar_shares cs ON c.id = cs.calendar_id AND (
            cs.shared_with_user_id = ? 
            OR (cs.shared_with_department_id IS NOT NULL AND cs.shared_with_department_id = ?)
        )
        WHERE c.organization_id = ?
          AND (
              c.owner_id = ? 
              OR cs.id IS NOT NULL 
              OR c.is_public = 1
              OR (c.department_id IS NOT NULL AND c.department_id = ?)
          )
        ORDER BY c.is_default DESC, c.name ASC
    `, [userId, userId, userDepartmentId || -1, organizationId, userId, userDepartmentId || -1]);

    return rows;
};

// Create a new calendar
const createCalendar = async (calData) => {
    const {
        organization_id = 1,
        company_id = 1,
        owner_id,
        name,
        description = null,
        color = '#2878C7',
        type = 'personal',
        department_id = null,
        project_id = null,
        is_default = false,
        is_public = false,
        timezone = 'UTC'
    } = calData;

    const [result] = await db.execute(`
        INSERT INTO calendars (
            organization_id, company_id, owner_id, name, description, color, type, 
            department_id, project_id, is_default, is_public, timezone
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        organization_id, company_id, owner_id, name, description, color, type,
        department_id, project_id, is_default ? 1 : 0, is_public ? 1 : 0, timezone
    ]);

    return { id: result.insertId, ...calData };
};

// Update calendar
const updateCalendar = async (calendarId, updates) => {
    const allowed = ['name', 'description', 'color', 'type', 'department_id', 'project_id', 'is_public', 'timezone'];
    const setClauses = [];
    const values = [];

    for (const key of allowed) {
        if (updates[key] !== undefined) {
            setClauses.push(`\`${key}\` = ?`);
            values.push(updates[key]);
        }
    }

    if (setClauses.length === 0) return false;
    values.push(calendarId);

    await db.execute(`UPDATE calendars SET ${setClauses.join(', ')} WHERE id = ?`, values);
    return true;
};

// Delete calendar
const deleteCalendar = async (calendarId) => {
    await db.execute(`DELETE FROM calendars WHERE id = ? AND is_default = FALSE`, [calendarId]);
    return true;
};

// Sharing helpers
const getCalendarShares = async (calendarId) => {
    const [rows] = await db.execute(`
        SELECT 
            cs.*,
            u.name as user_name,
            u.email as user_email,
            u.role as user_role,
            d.name as department_name
        FROM calendar_shares cs
        LEFT JOIN users u ON cs.shared_with_user_id = u.id
        LEFT JOIN departments d ON cs.shared_with_department_id = d.id
        WHERE cs.calendar_id = ?
    `, [calendarId]);
    return rows;
};

const addCalendarShare = async (calendarId, { sharedWithUserId = null, sharedWithDepartmentId = null, permissionLevel = 'free_busy_only' }) => {
    const [result] = await db.execute(`
        INSERT INTO calendar_shares (calendar_id, shared_with_user_id, shared_with_department_id, permission_level)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE permission_level = VALUES(permission_level)
    `, [calendarId, sharedWithUserId, sharedWithDepartmentId, permissionLevel]);
    return result.insertId;
};

const removeCalendarShare = async (shareId) => {
    await db.execute(`DELETE FROM calendar_shares WHERE id = ?`, [shareId]);
    return true;
};

// Events CRUD
const createCalendarEvent = async (eventData) => {
    const {
        organization_id = 1,
        company_id = 1,
        calendar_id,
        creator_id,
        title,
        description = null,
        location = null,
        meeting_url = null,
        is_all_day = false,
        start_time,
        end_time,
        timezone = 'UTC',
        category = 'general',
        color_override = null,
        is_recurring = false,
        recurrence_rule = null,
        recurrence_parent_id = null,
        recurrence_exception_date = null,
        linked_meeting_id = null,
        linked_task_id = null,
        linked_project_id = null
    } = eventData;

    const [result] = await db.execute(`
        INSERT INTO calendar_events (
            organization_id, company_id, calendar_id, creator_id, title, description,
            location, meeting_url, is_all_day, start_time, end_time, timezone,
            category, color_override, is_recurring, recurrence_rule,
            recurrence_parent_id, recurrence_exception_date,
            linked_meeting_id, linked_task_id, linked_project_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        organization_id, company_id, calendar_id, creator_id, title, description,
        location, meeting_url, is_all_day ? 1 : 0, start_time, end_time, timezone,
        category, color_override, is_recurring ? 1 : 0,
        recurrence_rule ? JSON.stringify(recurrence_rule) : null,
        recurrence_parent_id, recurrence_exception_date,
        linked_meeting_id, linked_task_id, linked_project_id
    ]);

    return result.insertId;
};

const updateCalendarEvent = async (eventId, updates) => {
    const allowed = [
        'title', 'description', 'location', 'meeting_url', 'is_all_day',
        'start_time', 'end_time', 'timezone', 'category', 'color_override',
        'is_recurring', 'recurrence_rule', 'calendar_id', 'linked_meeting_id',
        'linked_task_id', 'linked_project_id'
    ];
    const setClauses = [];
    const values = [];

    for (const key of allowed) {
        if (updates[key] !== undefined) {
            setClauses.push(`\`${key}\` = ?`);
            if (key === 'recurrence_rule' && typeof updates[key] === 'object' && updates[key] !== null) {
                values.push(JSON.stringify(updates[key]));
            } else if (key === 'is_all_day' || key === 'is_recurring') {
                values.push(updates[key] ? 1 : 0);
            } else {
                values.push(updates[key]);
            }
        }
    }

    if (setClauses.length === 0) return false;
    values.push(eventId);

    await db.execute(`UPDATE calendar_events SET ${setClauses.join(', ')} WHERE id = ?`, values);
    return true;
};

const deleteCalendarEvent = async (eventId, softDelete = true) => {
    if (softDelete) {
        await db.execute(`UPDATE calendar_events SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [eventId]);
    } else {
        await db.execute(`DELETE FROM calendar_events WHERE id = ?`, [eventId]);
    }
    return true;
};

const getCalendarEventById = async (eventId) => {
    const [rows] = await db.execute(`
        SELECT 
            ce.*,
            c.name as calendar_name,
            c.color as calendar_color,
            u.name as creator_name,
            u.email as creator_email
        FROM calendar_events ce
        JOIN calendars c ON ce.calendar_id = c.id
        JOIN users u ON ce.creator_id = u.id
        WHERE ce.id = ? AND ce.deleted_at IS NULL
    `, [eventId]);

    if (rows.length === 0) return null;
    const evt = rows[0];

    const [attendees] = await db.execute(`
        SELECT 
            cea.*,
            u.name as user_name,
            u.email as user_email
        FROM calendar_event_attendees cea
        LEFT JOIN users u ON cea.user_id = u.id
        WHERE cea.event_id = ?
    `, [eventId]);

    evt.attendees = attendees;
    return evt;
};

// Attendees helpers
const upsertEventAttendees = async (eventId, attendees = []) => {
    if (!attendees || attendees.length === 0) return;

    for (const att of attendees) {
        await db.execute(`
            INSERT INTO calendar_event_attendees (
                event_id, user_id, guest_email, guest_name, is_organizer, rsvp_status
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                rsvp_status = VALUES(rsvp_status),
                is_organizer = VALUES(is_organizer)
        `, [
            eventId,
            att.user_id || null,
            att.guest_email || null,
            att.guest_name || null,
            att.is_organizer ? 1 : 0,
            att.rsvp_status || 'needs_action'
        ]);
    }
};

const updateRSVPStatus = async (eventId, userId, rsvpStatus, responseNotes = null) => {
    await db.execute(`
        UPDATE calendar_event_attendees 
        SET rsvp_status = ?, response_notes = ?
        WHERE event_id = ? AND user_id = ?
    `, [rsvpStatus, responseNotes, eventId, userId]);
    return true;
};

module.exports = {
    initCalendarTables,
    ensureDefaultCalendar,
    getUserAccessibleCalendars,
    createCalendar,
    updateCalendar,
    deleteCalendar,
    getCalendarShares,
    addCalendarShare,
    removeCalendarShare,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    getCalendarEventById,
    upsertEventAttendees,
    updateRSVPStatus
};
