const db = require("../config/db.js");

// Helper to safely add column if it doesn't already exist
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
        console.error(`Error ensuring column ${columnName} in ${tableName}:`, err.message);
    }
};

const createMeetingTables = async () => {
    // 1. Meetings Master Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS meetings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            project_id INT NULL,
            task_id INT NULL,
            room_code VARCHAR(64) NOT NULL UNIQUE,
            title VARCHAR(255) NOT NULL,
            description TEXT NULL,
            meeting_type ENUM('instant', 'scheduled') DEFAULT 'instant',
            host_id INT NOT NULL,
            scheduled_start DATETIME NULL,
            scheduled_end DATETIME NULL,
            status ENUM('scheduled', 'live', 'ended', 'cancelled') DEFAULT 'scheduled',
            is_lobby_enabled BOOLEAN DEFAULT TRUE,
            is_recording_allowed BOOLEAN DEFAULT FALSE,
            is_guest_allowed BOOLEAN DEFAULT TRUE,
            passcode VARCHAR(32) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_room_code (room_code),
            INDEX idx_tenant_comp (organization_id, company_id),
            INDEX idx_project (project_id),
            INDEX idx_task (task_id),
            FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Participants & Attendance Log
    await db.execute(`
        CREATE TABLE IF NOT EXISTS meeting_participants (
            id INT AUTO_INCREMENT PRIMARY KEY,
            meeting_id INT NOT NULL,
            user_id INT NULL,
            guest_name VARCHAR(100) NULL,
            guest_email VARCHAR(150) NULL,
            role ENUM('host', 'co_host', 'participant', 'guest') DEFAULT 'participant',
            status ENUM('waiting_room', 'admitted', 'rejected', 'left') DEFAULT 'admitted',
            joined_at DATETIME NULL,
            left_at DATETIME NULL,
            duration_seconds INT DEFAULT 0,
            INDEX idx_meeting_user (meeting_id, user_id),
            INDEX idx_status (status),
            FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Collaborative Whiteboard State
    await db.execute(`
        CREATE TABLE IF NOT EXISTS meeting_whiteboards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            meeting_id INT NOT NULL,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            project_id INT NULL,
            title VARCHAR(255) DEFAULT 'Meeting Whiteboard',
            canvas_data LONGTEXT NULL,
            thumbnail_url VARCHAR(500) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_meeting_wb (meeting_id),
            INDEX idx_project_wb (project_id),
            FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. In-Meeting Notes & Summaries
    await db.execute(`
        CREATE TABLE IF NOT EXISTS meeting_notes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            meeting_id INT NOT NULL,
            author_id INT NOT NULL,
            notes_content LONGTEXT NULL,
            ai_summary TEXT NULL,
            action_items JSON NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_meeting_note (meeting_id),
            FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Meeting Recordings (Consent-audited)
    await db.execute(`
        CREATE TABLE IF NOT EXISTS meeting_recordings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            meeting_id INT NOT NULL,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            file_url VARCHAR(500) NOT NULL,
            file_size_bytes BIGINT DEFAULT 0,
            duration_seconds INT DEFAULT 0,
            recorded_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_meeting_rec (meeting_id),
            FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE,
            FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("Meeting tables initialized and ready.");
};

// ─── Query Operations ───────────────────────────────────────────────

const createMeeting = async (data) => {
    const {
        organization_id = 1,
        company_id = 1,
        project_id = null,
        task_id = null,
        room_code,
        title,
        description = null,
        meeting_type = 'instant',
        host_id,
        scheduled_start = null,
        scheduled_end = null,
        status = 'scheduled',
        is_lobby_enabled = true,
        is_recording_allowed = false,
        is_guest_allowed = true,
        passcode = null
    } = data;

    const query = `
        INSERT INTO meetings (
            organization_id, company_id, project_id, task_id,
            room_code, title, description, meeting_type, host_id,
            scheduled_start, scheduled_end, status,
            is_lobby_enabled, is_recording_allowed, is_guest_allowed, passcode
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(query, [
        organization_id,
        company_id,
        project_id,
        task_id,
        room_code,
        title,
        description,
        meeting_type,
        host_id,
        scheduled_start,
        scheduled_end,
        status,
        is_lobby_enabled,
        is_recording_allowed,
        is_guest_allowed,
        passcode
    ]);

    return result.insertId;
};

const getMeetingByRoomCode = async (roomCode, companyId = null) => {
    let query = `
        SELECT m.*, 
               u.name AS host_name, 
               u.email AS host_email,
               p.name AS project_name,
               t.title AS task_name
        FROM meetings m
        JOIN users u ON m.host_id = u.id
        LEFT JOIN projects p ON m.project_id = p.id
        LEFT JOIN tasks t ON m.task_id = t.id
        WHERE m.room_code = ?
    `;
    const params = [roomCode];

    if (companyId) {
        query += ` AND m.company_id = ?`;
        params.push(companyId);
    }

    const [rows] = await db.execute(query, params);
    return rows[0] || null;
};

const getMeetingById = async (id, companyId = null) => {
    let query = `
        SELECT m.*, 
               u.name AS host_name, 
               u.email AS host_email,
               p.name AS project_name,
               t.title AS task_name
        FROM meetings m
        JOIN users u ON m.host_id = u.id
        LEFT JOIN projects p ON m.project_id = p.id
        LEFT JOIN tasks t ON m.task_id = t.id
        WHERE m.id = ?
    `;
    const params = [id];

    if (companyId) {
        query += ` AND m.company_id = ?`;
        params.push(companyId);
    }

    const [rows] = await db.execute(query, params);
    return rows[0] || null;
};

const getMeetings = async (companyId, filters = {}) => {
    let query = `
        SELECT m.*, 
               u.name AS host_name, 
               u.email AS host_email,
               p.name AS project_name,
               t.title AS task_name,
               (SELECT COUNT(*) FROM meeting_participants mp WHERE mp.meeting_id = m.id AND mp.status = 'admitted') AS active_participants_count
        FROM meetings m
        JOIN users u ON m.host_id = u.id
        LEFT JOIN projects p ON m.project_id = p.id
        LEFT JOIN tasks t ON m.task_id = t.id
        WHERE m.company_id = ?
    `;
    const params = [companyId];

    if (filters.status) {
        query += ` AND m.status = ?`;
        params.push(filters.status);
    } else {
        query += ` AND m.status != 'cancelled'`;
    }

    if (filters.project_id) {
        query += ` AND m.project_id = ?`;
        params.push(filters.project_id);
    }

    if (filters.task_id) {
        query += ` AND m.task_id = ?`;
        params.push(filters.task_id);
    }

    if (filters.search) {
        query += ` AND (m.title LIKE ? OR m.room_code LIKE ?)`;
        params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ` ORDER BY m.created_at DESC`;

    const [rows] = await db.execute(query, params);
    return rows;
};

const updateMeeting = async (id, data) => {
    const allowed = [
        'title', 'description', 'scheduled_start', 'scheduled_end',
        'status', 'is_lobby_enabled', 'is_recording_allowed', 'is_guest_allowed',
        'passcode', 'project_id', 'task_id'
    ];

    const updates = [];
    const params = [];

    for (const key of allowed) {
        if (data[key] !== undefined) {
            updates.push(`\`${key}\` = ?`);
            params.push(data[key]);
        }
    }

    if (updates.length === 0) return false;

    params.push(id);
    const query = `UPDATE meetings SET ${updates.join(', ')} WHERE id = ?`;
    const [result] = await db.execute(query, params);
    return result.affectedRows > 0;
};

// ─── Participants & Lobby Operations ────────────────────────────────

const addOrUpdateParticipant = async ({
    meeting_id,
    user_id = null,
    guest_name = null,
    guest_email = null,
    role = 'participant',
    status = 'admitted'
}) => {
    // Check if participant already exists for this meeting
    let existingQuery = `SELECT * FROM meeting_participants WHERE meeting_id = ?`;
    let existingParams = [meeting_id];

    if (user_id) {
        existingQuery += ` AND user_id = ?`;
        existingParams.push(user_id);
    } else if (guest_email) {
        existingQuery += ` AND guest_email = ?`;
        existingParams.push(guest_email);
    } else if (guest_name) {
        existingQuery += ` AND guest_name = ?`;
        existingParams.push(guest_name);
    }

    const [existing] = await db.execute(existingQuery, existingParams);

    if (existing.length > 0) {
        const pId = existing[0].id;
        await db.execute(`
            UPDATE meeting_participants 
            SET role = ?, status = ?, joined_at = IF(status = 'waiting_room' AND ? = 'admitted', NOW(), joined_at)
            WHERE id = ?
        `, [role, status, status, pId]);
        return { id: pId, updated: true };
    }

    const [insert] = await db.execute(`
        INSERT INTO meeting_participants (
            meeting_id, user_id, guest_name, guest_email, role, status, joined_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [meeting_id, user_id, guest_name, guest_email, role, status]);

    return { id: insert.insertId, created: true };
};

const getMeetingParticipants = async (meetingId) => {
    const query = `
        SELECT mp.*, 
               u.name AS user_name, 
               u.email AS user_email, 
               NULL AS user_avatar,
               COALESCE(u.name, mp.guest_name, 'Guest') AS display_name,
               COALESCE(u.email, mp.guest_email) AS display_email
        FROM meeting_participants mp
        LEFT JOIN users u ON mp.user_id = u.id
        WHERE mp.meeting_id = ?
        ORDER BY mp.role = 'host' DESC, mp.role = 'co_host' DESC, mp.joined_at ASC
    `;
    const [rows] = await db.execute(query, [meetingId]);
    return rows;
};

const updateParticipantStatus = async (id, status) => {
    let query = `UPDATE meeting_participants SET status = ?`;
    const params = [status];

    if (status === 'admitted') {
        query += `, joined_at = COALESCE(joined_at, NOW())`;
    } else if (status === 'left') {
        query += `, left_at = NOW(), duration_seconds = TIMESTAMPDIFF(SECOND, COALESCE(joined_at, NOW()), NOW())`;
    }

    query += ` WHERE id = ?`;
    params.push(id);

    const [result] = await db.execute(query, params);
    return result.affectedRows > 0;
};

// ─── Whiteboard Operations ──────────────────────────────────────────

const getWhiteboardByMeeting = async (meetingId) => {
    const [rows] = await db.execute(`
        SELECT * FROM meeting_whiteboards WHERE meeting_id = ? ORDER BY id DESC LIMIT 1
    `, [meetingId]);
    return rows[0] || null;
};

const saveWhiteboard = async ({
    meeting_id,
    organization_id = 1,
    company_id = 1,
    project_id = null,
    title = 'Meeting Whiteboard',
    canvas_data = null,
    thumbnail_url = null
}) => {
    const existing = await getWhiteboardByMeeting(meeting_id);
    if (existing) {
        await db.execute(`
            UPDATE meeting_whiteboards 
            SET canvas_data = ?, thumbnail_url = COALESCE(?, thumbnail_url), title = ?, project_id = COALESCE(?, project_id)
            WHERE id = ?
        `, [canvas_data, thumbnail_url, title, project_id, existing.id]);
        return existing.id;
    } else {
        const [result] = await db.execute(`
            INSERT INTO meeting_whiteboards (
                meeting_id, organization_id, company_id, project_id, title, canvas_data, thumbnail_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [meeting_id, organization_id, company_id, project_id, title, canvas_data, thumbnail_url]);
        return result.insertId;
    }
};

// ─── Meeting Notes Operations ───────────────────────────────────────

const getMeetingNotes = async (meetingId) => {
    const [rows] = await db.execute(`
        SELECT mn.*, u.name AS author_name, u.email AS author_email
        FROM meeting_notes mn
        LEFT JOIN users u ON mn.author_id = u.id
        WHERE mn.meeting_id = ?
        ORDER BY mn.id DESC LIMIT 1
    `, [meetingId]);
    return rows[0] || null;
};

const saveMeetingNotes = async ({
    meeting_id,
    author_id,
    notes_content = null,
    ai_summary = null,
    action_items = null
}) => {
    const existing = await getMeetingNotes(meeting_id);
    const actionItemsJson = action_items ? JSON.stringify(action_items) : null;

    if (existing) {
        await db.execute(`
            UPDATE meeting_notes 
            SET notes_content = ?, ai_summary = ?, action_items = ?, author_id = ?
            WHERE id = ?
        `, [notes_content, ai_summary, actionItemsJson, author_id, existing.id]);
        return existing.id;
    } else {
        const [result] = await db.execute(`
            INSERT INTO meeting_notes (
                meeting_id, author_id, notes_content, ai_summary, action_items
            ) VALUES (?, ?, ?, ?, ?)
        `, [meeting_id, author_id, notes_content, ai_summary, actionItemsJson]);
        return result.insertId;
    }
};

// ─── Recordings Operations ──────────────────────────────────────────

const createRecording = async ({
    meeting_id,
    organization_id = 1,
    company_id = 1,
    file_url,
    file_size_bytes = 0,
    duration_seconds = 0,
    recorded_by
}) => {
    const [result] = await db.execute(`
        INSERT INTO meeting_recordings (
            meeting_id, organization_id, company_id, file_url, file_size_bytes, duration_seconds, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [meeting_id, organization_id, company_id, file_url, file_size_bytes, duration_seconds, recorded_by]);
    return result.insertId;
};

const getRecordings = async (meetingId) => {
    const [rows] = await db.execute(`
        SELECT mr.*, u.name AS recorded_by_name
        FROM meeting_recordings mr
        LEFT JOIN users u ON mr.recorded_by = u.id
        WHERE mr.meeting_id = ?
        ORDER BY mr.created_at DESC
    `, [meetingId]);
    return rows;
};

module.exports = {
    createMeetingTables,
    createMeeting,
    getMeetingByRoomCode,
    getMeetingById,
    getMeetings,
    updateMeeting,
    addOrUpdateParticipant,
    getMeetingParticipants,
    updateParticipantStatus,
    getWhiteboardByMeeting,
    saveWhiteboard,
    getMeetingNotes,
    saveMeetingNotes,
    createRecording,
    getRecordings
};
