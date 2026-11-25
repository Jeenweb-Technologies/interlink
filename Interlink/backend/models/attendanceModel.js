const db = require("../config/db.js");

/**
 * Initialize Attendance Tables
 */
const initAttendanceTables = async () => {
    // 1. Work Schedules Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS work_schedules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            name VARCHAR(100) NOT NULL,
            schedule_type ENUM('FIXED', 'FLEXIBLE', 'ROTATIONAL') NOT NULL DEFAULT 'FIXED',
            start_time TIME NOT NULL DEFAULT '09:00:00',
            end_time TIME NOT NULL DEFAULT '18:00:00',
            break_duration_minutes INT NOT NULL DEFAULT 60,
            grace_period_minutes INT NOT NULL DEFAULT 15,
            half_day_threshold_minutes INT NOT NULL DEFAULT 240,
            full_day_threshold_minutes INT NOT NULL DEFAULT 480,
            work_days JSON NOT NULL,
            timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
            is_default BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_ws_tenant (organization_id, company_id, is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. User Schedule Assignments Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS user_schedule_assignments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            user_id INT NOT NULL,
            schedule_id INT NOT NULL,
            effective_from DATE NOT NULL,
            effective_to DATE NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_usa_user_eff (organization_id, user_id, effective_from),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Attendance Events Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS attendance_events (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            user_id INT NOT NULL,
            event_type ENUM('CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT') NOT NULL,
            event_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            location_type ENUM('OFFICE', 'REMOTE', 'CLIENT_SITE') NOT NULL DEFAULT 'OFFICE',
            ip_address VARCHAR(45) NULL,
            device_info VARCHAR(255) NULL,
            latitude DECIMAL(10, 8) NULL,
            longitude DECIMAL(11, 8) NULL,
            notes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ae_tenant_user_time (organization_id, company_id, user_id, event_time),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Daily Attendance Summaries Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS attendance_daily_summaries (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            user_id INT NOT NULL,
            work_date DATE NOT NULL,
            schedule_id INT NULL,
            first_clock_in TIMESTAMP NULL,
            last_clock_out TIMESTAMP NULL,
            total_work_minutes INT NOT NULL DEFAULT 0,
            total_break_minutes INT NOT NULL DEFAULT 0,
            expected_work_minutes INT NOT NULL DEFAULT 480,
            status ENUM('PRESENT', 'LATE', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND') NOT NULL DEFAULT 'ABSENT',
            late_minutes INT NOT NULL DEFAULT 0,
            early_exit_minutes INT NOT NULL DEFAULT 0,
            overtime_minutes INT NOT NULL DEFAULT 0,
            is_regularized BOOLEAN NOT NULL DEFAULT FALSE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_ads_user_date (organization_id, user_id, work_date),
            INDEX idx_ads_tenant_date (organization_id, company_id, work_date, status),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Attendance Adjustment Requests Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS attendance_adjustment_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            user_id INT NOT NULL,
            work_date DATE NOT NULL,
            requested_clock_in TIME NOT NULL,
            requested_clock_out TIME NOT NULL,
            reason TEXT NOT NULL,
            status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
            reviewer_id INT NULL,
            reviewed_at TIMESTAMP NULL,
            reviewer_comment TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_aar_tenant_status (organization_id, company_id, status),
            INDEX idx_aar_user_date (user_id, work_date),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Seed default schedule if none exists
    const [existing] = await db.execute("SELECT id FROM work_schedules WHERE is_default = TRUE LIMIT 1");
    if (existing.length === 0) {
        await db.execute(`
            INSERT INTO work_schedules (
                organization_id, company_id, name, schedule_type, 
                start_time, end_time, break_duration_minutes, grace_period_minutes, 
                half_day_threshold_minutes, full_day_threshold_minutes, work_days, is_default, is_active
            ) VALUES (
                1, 1, 'Standard General Shift (09:00 - 18:00)', 'FIXED',
                '09:00:00', '18:00:00', 60, 15, 240, 480, '[1, 2, 3, 4, 5]', TRUE, TRUE
            )
        `);
        console.log("[Attendance] Seeded default work schedule.");
    }
};

/**
 * Get active schedule for a user
 */
const getUserSchedule = async (userId, organizationId, companyId) => {
    const [assigned] = await db.execute(`
        SELECT ws.* 
        FROM user_schedule_assignments usa
        JOIN work_schedules ws ON ws.id = usa.schedule_id
        WHERE usa.user_id = ? 
          AND usa.effective_from <= CURDATE()
          AND (usa.effective_to IS NULL OR usa.effective_to >= CURDATE())
          AND ws.is_active = TRUE
        ORDER BY usa.effective_from DESC 
        LIMIT 1
    `, [userId]);

    if (assigned.length > 0) return assigned[0];

    // Fallback to company default or system default
    const [defaults] = await db.execute(`
        SELECT * FROM work_schedules 
        WHERE (company_id = ? OR organization_id = ? OR is_default = TRUE)
          AND is_active = TRUE
        ORDER BY is_default DESC, id ASC 
        LIMIT 1
    `, [companyId, organizationId]);

    return defaults[0] || null;
};

/**
 * Record real-time attendance clock event and recalculate daily summary
 */
const recordAttendanceEvent = async (userId, organizationId, companyId, eventData) => {
    const { event_type, location_type = 'OFFICE', latitude = null, longitude = null, notes = null, ip_address = null, device_info = null } = eventData;

    // Insert raw event
    const [res] = await db.execute(`
        INSERT INTO attendance_events (
            organization_id, company_id, user_id, event_type, 
            location_type, latitude, longitude, notes, ip_address, device_info
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [organizationId, companyId, userId, event_type, location_type, latitude, longitude, notes, ip_address, device_info]);

    const eventId = res.insertId;

    // Recalculate today's summary
    const schedule = await getUserSchedule(userId, organizationId, companyId);
    const scheduleId = schedule ? schedule.id : null;
    const graceMinutes = schedule ? schedule.grace_period_minutes : 15;
    const scheduleStartTime = schedule ? schedule.start_time : '09:00:00';

    // Fetch all events for today for this user
    const [events] = await db.execute(`
        SELECT event_type, event_time 
        FROM attendance_events 
        WHERE user_id = ? AND DATE(event_time) = CURDATE()
        ORDER BY event_time ASC
    `, [userId]);

    let firstClockIn = null;
    let lastClockOut = null;
    let totalWorkSeconds = 0;
    let totalBreakSeconds = 0;
    let currentClockInTime = null;
    let currentBreakStartTime = null;

    events.forEach(ev => {
        const time = new Date(ev.event_time).getTime();
        if (ev.event_type === 'CLOCK_IN') {
            if (!firstClockIn) firstClockIn = ev.event_time;
            currentClockInTime = time;
        } else if (ev.event_type === 'BREAK_START') {
            if (currentClockInTime) {
                totalWorkSeconds += (time - currentClockInTime) / 1000;
                currentClockInTime = null;
            }
            currentBreakStartTime = time;
        } else if (ev.event_type === 'BREAK_END') {
            if (currentBreakStartTime) {
                totalBreakSeconds += (time - currentBreakStartTime) / 1000;
                currentBreakStartTime = null;
            }
            currentClockInTime = time;
        } else if (ev.event_type === 'CLOCK_OUT') {
            if (currentClockInTime) {
                totalWorkSeconds += (time - currentClockInTime) / 1000;
                currentClockInTime = null;
            }
            lastClockOut = ev.event_time;
        }
    });

    // If currently still clocked in, count elapsed time up to now
    if (currentClockInTime) {
        totalWorkSeconds += (Date.now() - currentClockInTime) / 1000;
    }

    const totalWorkMinutes = Math.max(0, Math.round(totalWorkSeconds / 60));
    const totalBreakMinutes = Math.max(0, Math.round(totalBreakSeconds / 60));

    // Determine status (PRESENT, LATE, HALF_DAY)
    let status = 'PRESENT';
    let lateMinutes = 0;

    if (firstClockIn && scheduleStartTime) {
        const firstTime = new Date(firstClockIn);
        const [schH, schM] = scheduleStartTime.split(':').map(Number);
        const expectedClockIn = new Date(firstTime);
        expectedClockIn.setHours(schH, schM, 0, 0);

        const diffMinutes = Math.round((firstTime.getTime() - expectedClockIn.getTime()) / (60 * 1000));
        if (diffMinutes > graceMinutes) {
            status = 'LATE';
            lateMinutes = diffMinutes;
        }
    }

    if (totalWorkMinutes > 0 && totalWorkMinutes < (schedule ? schedule.half_day_threshold_minutes : 240)) {
        if (lastClockOut) {
            status = 'HALF_DAY';
        }
    }

    // Upsert summary
    await db.execute(`
        INSERT INTO attendance_daily_summaries (
            organization_id, company_id, user_id, work_date, schedule_id,
            first_clock_in, last_clock_out, total_work_minutes, total_break_minutes,
            expected_work_minutes, status, late_minutes
        ) VALUES (
            ?, ?, ?, CURDATE(), ?,
            ?, ?, ?, ?,
            ?, ?, ?
        )
        ON DUPLICATE KEY UPDATE
            first_clock_in = VALUES(first_clock_in),
            last_clock_out = VALUES(last_clock_out),
            total_work_minutes = VALUES(total_work_minutes),
            total_break_minutes = VALUES(total_break_minutes),
            status = VALUES(status),
            late_minutes = VALUES(late_minutes),
            updated_at = CURRENT_TIMESTAMP
    `, [
        organizationId, companyId, userId, scheduleId,
        firstClockIn, lastClockOut, totalWorkMinutes, totalBreakMinutes,
        schedule ? schedule.full_day_threshold_minutes : 480, status, lateMinutes
    ]);

    return { eventId, status, totalWorkMinutes, totalBreakMinutes };
};

/**
 * Get current user's today attendance status & timer
 */
const getTodayAttendance = async (userId, organizationId, companyId) => {
    const schedule = await getUserSchedule(userId, organizationId, companyId);

    const [events] = await db.execute(`
        SELECT id, event_type, event_time, location_type, notes
        FROM attendance_events
        WHERE user_id = ? AND DATE(event_time) = CURDATE()
        ORDER BY event_time ASC
    `, [userId]);

    const [summaryRows] = await db.execute(`
        SELECT * FROM attendance_daily_summaries
        WHERE user_id = ? AND work_date = CURDATE()
    `, [userId]);

    const summary = summaryRows[0] || null;

    // Compute active clock state
    let activeState = 'CLOCKED_OUT';
    let lastClockInTimestamp = null;
    let lastBreakStartTimestamp = null;

    if (events.length > 0) {
        const lastEv = events[events.length - 1];
        if (lastEv.event_type === 'CLOCK_IN' || lastEv.event_type === 'BREAK_END') {
            activeState = 'CLOCKED_IN';
            lastClockInTimestamp = lastEv.event_time;
        } else if (lastEv.event_type === 'BREAK_START') {
            activeState = 'ON_BREAK';
            lastBreakStartTimestamp = lastEv.event_time;
        } else if (lastEv.event_type === 'CLOCK_OUT') {
            activeState = 'CLOCKED_OUT';
        }
    }

    return {
        schedule,
        events,
        summary,
        activeState,
        lastClockInTimestamp,
        lastBreakStartTimestamp
    };
};

/**
 * Get monthly attendance history for user
 */
const getAttendanceHistory = async (userId, organizationId, companyId, monthStr) => {
    // monthStr e.g. "2026-11"
    const targetMonth = monthStr || new Date().toISOString().slice(0, 7);
    const startDate = `${targetMonth}-01`;
    const endDate = `${targetMonth}-31`;

    const [rows] = await db.execute(`
        SELECT 
            ads.*,
            ws.name AS schedule_name,
            ws.start_time AS scheduled_start,
            ws.end_time AS scheduled_end
        FROM attendance_daily_summaries ads
        LEFT JOIN work_schedules ws ON ws.id = ads.schedule_id
        WHERE ads.user_id = ? 
          AND ads.work_date BETWEEN ? AND ?
        ORDER BY ads.work_date DESC
    `, [userId, startDate, endDate]);

    // Aggregate statistics
    let presentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let totalWorkMinutes = 0;

    rows.forEach(r => {
        if (r.status === 'PRESENT') presentCount++;
        if (r.status === 'LATE') { presentCount++; lateCount++; }
        if (r.status === 'HALF_DAY') halfDayCount++;
        totalWorkMinutes += Number(r.total_work_minutes || 0);
    });

    const averageDailyMinutes = rows.length > 0 ? Math.round(totalWorkMinutes / rows.length) : 0;

    return {
        month: targetMonth,
        records: rows,
        stats: {
            totalDays: rows.length,
            presentCount,
            lateCount,
            halfDayCount,
            totalWorkHours: (totalWorkMinutes / 60).toFixed(1),
            averageDailyHours: (averageDailyMinutes / 60).toFixed(1)
        }
    };
};

/**
 * Submit Attendance Adjustment / Correction Request
 */
const requestAttendanceAdjustment = async (userId, organizationId, companyId, data) => {
    const { work_date, requested_clock_in, requested_clock_out, reason } = data;

    const [res] = await db.execute(`
        INSERT INTO attendance_adjustment_requests (
            organization_id, company_id, user_id, work_date, 
            requested_clock_in, requested_clock_out, reason, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `, [organizationId, companyId, userId, work_date, requested_clock_in, requested_clock_out, reason]);

    return res.insertId;
};

/**
 * Get Attendance Adjustment Requests
 */
const getAttendanceAdjustments = async (userId, organizationId, companyId, isManager = false, statusFilter = null) => {
    let query = `
        SELECT 
            aar.*,
            u.name AS user_name,
            u.email AS user_email,
            dept.department_name,
            rev.name AS reviewer_name
        FROM attendance_adjustment_requests aar
        JOIN users u ON u.id = aar.user_id
        LEFT JOIN departments dept ON dept.id = u.department_id
        LEFT JOIN users rev ON rev.id = aar.reviewer_id
        WHERE aar.organization_id = ?
    `;
    const params = [organizationId];

    if (!isManager) {
        query += ` AND aar.user_id = ?`;
        params.push(userId);
    } else {
        query += ` AND (aar.company_id = ? OR ? = 1)`;
        params.push(companyId, companyId);
    }

    if (statusFilter) {
        query += ` AND aar.status = ?`;
        params.push(statusFilter);
    }

    query += ` ORDER BY aar.created_at DESC`;

    const [rows] = await db.execute(query, params);
    return rows;
};

/**
 * Review Attendance Adjustment Request (Approve / Reject)
 */
const reviewAttendanceAdjustment = async (requestId, reviewerId, organizationId, companyId, { status, reviewer_comment }) => {
    const [reqRows] = await db.execute(
        `SELECT * FROM attendance_adjustment_requests WHERE id = ? AND organization_id = ?`,
        [requestId, organizationId]
    );

    if (reqRows.length === 0) throw new Error("Attendance adjustment request not found.");
    const adj = reqRows[0];

    await db.execute(`
        UPDATE attendance_adjustment_requests 
        SET status = ?, reviewer_id = ?, reviewed_at = CURRENT_TIMESTAMP, reviewer_comment = ?
        WHERE id = ?
    `, [status, reviewerId, reviewer_comment || null, requestId]);

    // If approved, update daily summary to regularized
    if (status === 'APPROVED') {
        const [inH, inM] = adj.requested_clock_in.split(':').map(Number);
        const [outH, outM] = adj.requested_clock_out.split(':').map(Number);
        const durationMinutes = Math.max(0, (outH * 60 + outM) - (inH * 60 + inM) - 60);

        await db.execute(`
            INSERT INTO attendance_daily_summaries (
                organization_id, company_id, user_id, work_date,
                first_clock_in, last_clock_out, total_work_minutes, status, is_regularized
            ) VALUES (
                ?, ?, ?, ?,
                CONCAT(?, ' ', ?), CONCAT(?, ' ', ?), ?, 'PRESENT', TRUE
            )
            ON DUPLICATE KEY UPDATE
                total_work_minutes = VALUES(total_work_minutes),
                status = 'PRESENT',
                is_regularized = TRUE,
                updated_at = CURRENT_TIMESTAMP
        `, [
            organizationId, adj.company_id, adj.user_id, adj.work_date,
            adj.work_date, adj.requested_clock_in, adj.work_date, adj.requested_clock_out, durationMinutes
        ]);
    }

    return true;
};

/**
 * Team Attendance Board (Manager View)
 */
const getTeamAttendanceBoard = async (organizationId, companyId, departmentId = null) => {
    let query = `
        SELECT 
            u.id AS user_id,
            u.name,
            u.email,
            u.role,
            dept.department_name,
            ads.status AS today_status,
            ads.first_clock_in,
            ads.last_clock_out,
            ads.total_work_minutes,
            ads.total_break_minutes,
            ads.late_minutes,
            -- Determine live state from latest event today
            (
                SELECT event_type 
                FROM attendance_events ae 
                WHERE ae.user_id = u.id AND DATE(ae.event_time) = CURDATE()
                ORDER BY ae.event_time DESC LIMIT 1
            ) AS live_event_type,
            (
                SELECT location_type 
                FROM attendance_events ae 
                WHERE ae.user_id = u.id AND DATE(ae.event_time) = CURDATE()
                ORDER BY ae.event_time DESC LIMIT 1
            ) AS location_type
        FROM users u
        LEFT JOIN departments dept ON dept.id = u.department_id
        LEFT JOIN attendance_daily_summaries ads ON ads.user_id = u.id AND ads.work_date = CURDATE()
        WHERE u.active = TRUE 
          AND (u.company_id = ? OR ? = 1)
    `;
    const params = [companyId, companyId];

    if (departmentId) {
        query += ` AND u.department_id = ?`;
        params.push(departmentId);
    }

    query += ` ORDER BY u.name ASC`;

    const [rows] = await db.execute(query, params);

    return rows.map(r => {
        let liveStatus = 'NOT_ARRIVED';
        if (r.live_event_type === 'CLOCK_IN' || r.live_event_type === 'BREAK_END') {
            liveStatus = 'CLOCKED_IN';
        } else if (r.live_event_type === 'BREAK_START') {
            liveStatus = 'ON_BREAK';
        } else if (r.live_event_type === 'CLOCK_OUT') {
            liveStatus = 'CLOCKED_OUT';
        }

        return {
            ...r,
            liveStatus,
            totalWorkHours: ((r.total_work_minutes || 0) / 60).toFixed(1)
        };
    });
};

/**
 * Get all work schedules
 */
const getWorkSchedules = async (organizationId, companyId) => {
    const [rows] = await db.execute(`
        SELECT * FROM work_schedules 
        WHERE (company_id = ? OR organization_id = ? OR is_default = TRUE)
        ORDER BY is_default DESC, name ASC
    `, [companyId, organizationId]);
    return rows;
};

module.exports = {
    initAttendanceTables,
    getUserSchedule,
    recordAttendanceEvent,
    getTodayAttendance,
    getAttendanceHistory,
    requestAttendanceAdjustment,
    getAttendanceAdjustments,
    reviewAttendanceAdjustment,
    getTeamAttendanceBoard,
    getWorkSchedules
};
