const db = require("../config/db.js");

/**
 * Initialize Timesheet Tables
 */
const initTimesheetTables = async () => {
    // 1. Timesheets (Period Containers) Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS timesheets (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            user_id INT NOT NULL,
            period_start_date DATE NOT NULL,
            period_end_date DATE NOT NULL,
            total_hours DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
            billable_hours DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
            non_billable_hours DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
            status ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
            is_locked BOOLEAN NOT NULL DEFAULT FALSE,
            submitted_at TIMESTAMP NULL,
            approved_at TIMESTAMP NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_ts_user_period (organization_id, user_id, period_start_date),
            INDEX idx_ts_tenant_status (organization_id, company_id, status),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Time Entries Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS time_entries (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            timesheet_id INT NOT NULL,
            user_id INT NOT NULL,
            project_id INT NOT NULL,
            task_id INT NULL,
            work_date DATE NOT NULL,
            duration_minutes INT NOT NULL,
            duration_hours DECIMAL(5, 2) GENERATED ALWAYS AS (duration_minutes / 60.0) STORED,
            description TEXT NOT NULL,
            is_billable BOOLEAN NOT NULL DEFAULT TRUE,
            category ENUM('DEVELOPMENT', 'DESIGN', 'MEETING', 'QA', 'SUPPORT', 'DOCUMENTATION', 'OTHER') NOT NULL DEFAULT 'DEVELOPMENT',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_te_timesheet (timesheet_id),
            INDEX idx_te_tenant_proj (organization_id, project_id, work_date),
            INDEX idx_te_user_date (user_id, work_date),
            FOREIGN KEY (timesheet_id) REFERENCES timesheets(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Timesheet Approvals & Audit Log Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS timesheet_approvals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL DEFAULT 1,
            timesheet_id INT NOT NULL,
            actor_id INT NOT NULL,
            action ENUM('SUBMIT', 'APPROVE', 'REJECT', 'REQUEST_REVISION', 'UNLOCK') NOT NULL,
            comment TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_ta_timesheet (timesheet_id),
            FOREIGN KEY (timesheet_id) REFERENCES timesheets(id) ON DELETE CASCADE,
            FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("[Timesheet] Initialized timesheet tables.");
};

/**
 * Helper to compute Monday of the week for a given date
 */
const getWeekRange = (dateInput) => {
    let d;
    if (dateInput && typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput.slice(0, 10))) {
        const [y, m, dayNum] = dateInput.slice(0, 10).split('-').map(Number);
        d = new Date(y, m - 1, dayNum);
    } else if (dateInput) {
        d = new Date(dateInput);
    } else {
        d = new Date();
    }
    const day = d.getDay(); // 0 is Sunday, 1 is Monday
    const diffToMonday = d.getDate() - day + (day === 0 ? -6 : 1);
    
    const monday = new Date(d.getFullYear(), d.getMonth(), diffToMonday);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);

    const pad = (n) => String(n).padStart(2, '0');
    const formatYMD = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

    return {
        startDate: formatYMD(monday),
        endDate: formatYMD(sunday)
    };
};

/**
 * Get or create weekly timesheet container for user
 */
const getOrCreateWeeklyTimesheet = async (userId, organizationId, companyId, dateStr) => {
    const { startDate, endDate } = getWeekRange(dateStr);

    let [rows] = await db.execute(`
        SELECT 
            id, organization_id, company_id, user_id,
            DATE_FORMAT(period_start_date, '%Y-%m-%d') AS period_start_date,
            DATE_FORMAT(period_end_date, '%Y-%m-%d') AS period_end_date,
            total_hours, billable_hours, non_billable_hours,
            status, is_locked, submitted_at, approved_at, created_at, updated_at
        FROM timesheets 
        WHERE user_id = ? AND period_start_date = ?
    `, [userId, startDate]);

    let timesheetId;
    if (rows.length === 0) {
        const [createRes] = await db.execute(`
            INSERT INTO timesheets (
                organization_id, company_id, user_id, 
                period_start_date, period_end_date, status, is_locked
            ) VALUES (?, ?, ?, ?, ?, 'DRAFT', FALSE)
        `, [organizationId, companyId, userId, startDate, endDate]);
        timesheetId = createRes.insertId;
        const [fresh] = await db.execute(`
            SELECT 
                id, organization_id, company_id, user_id,
                DATE_FORMAT(period_start_date, '%Y-%m-%d') AS period_start_date,
                DATE_FORMAT(period_end_date, '%Y-%m-%d') AS period_end_date,
                total_hours, billable_hours, non_billable_hours,
                status, is_locked, submitted_at, approved_at, created_at, updated_at
            FROM timesheets WHERE id = ?
        `, [timesheetId]);
        rows = fresh;
    } else {
        timesheetId = rows[0].id;
    }

    // Fetch entries
    const [entries] = await db.execute(`
        SELECT 
            te.id, te.organization_id, te.company_id, te.timesheet_id, te.user_id,
            te.project_id, te.task_id,
            DATE_FORMAT(te.work_date, '%Y-%m-%d') AS work_date,
            te.duration_minutes, te.duration_hours, te.description, te.is_billable, te.category,
            te.created_at, te.updated_at,
            p.name AS project_title,
            p.code AS project_code,
            t.title AS task_title
        FROM time_entries te
        LEFT JOIN projects p ON p.id = te.project_id
        LEFT JOIN tasks t ON t.id = te.task_id
        WHERE te.timesheet_id = ?
        ORDER BY te.work_date ASC, te.created_at ASC
    `, [timesheetId]);

    // Fetch approval history
    const [approvals] = await db.execute(`
        SELECT ta.*, u.name AS actor_name
        FROM timesheet_approvals ta
        JOIN users u ON u.id = ta.actor_id
        WHERE ta.timesheet_id = ?
        ORDER BY ta.created_at DESC
    `, [timesheetId]);

    return {
        timesheet: rows[0],
        entries,
        approvals
    };
};

/**
 * Recalculate and update timesheet totals
 */
const recalculateTimesheetTotals = async (timesheetId) => {
    const [entries] = await db.execute(`
        SELECT duration_minutes, is_billable FROM time_entries WHERE timesheet_id = ?
    `, [timesheetId]);

    let totalMinutes = 0;
    let billableMinutes = 0;
    let nonBillableMinutes = 0;

    entries.forEach(e => {
        const m = Number(e.duration_minutes || 0);
        totalMinutes += m;
        if (Boolean(e.is_billable)) {
            billableMinutes += m;
        } else {
            nonBillableMinutes += m;
        }
    });

    const totalHours = (totalMinutes / 60.0).toFixed(2);
    const billableHours = (billableMinutes / 60.0).toFixed(2);
    const nonBillableHours = (nonBillableMinutes / 60.0).toFixed(2);

    await db.execute(`
        UPDATE timesheets 
        SET total_hours = ?, billable_hours = ?, non_billable_hours = ?
        WHERE id = ?
    `, [totalHours, billableHours, nonBillableHours, timesheetId]);
};

/**
 * Add or Update a Time Entry
 */
const addOrUpdateTimeEntry = async (userId, organizationId, companyId, entryData) => {
    const { id, timesheet_id, project_id, task_id = null, work_date, duration_minutes, description, is_billable = true, category = 'DEVELOPMENT' } = entryData;

    // Check timesheet lock
    const [tsRows] = await db.execute(`SELECT * FROM timesheets WHERE id = ? AND user_id = ?`, [timesheet_id, userId]);
    if (tsRows.length === 0) throw new Error("Timesheet not found or access denied.");
    if (tsRows[0].is_locked || tsRows[0].status === 'SUBMITTED' || tsRows[0].status === 'APPROVED') {
        throw new Error("This timesheet is locked and cannot be edited.");
    }

    const cleanWorkDate = String(work_date).slice(0, 10);

    let entryId = id;
    if (id) {
        await db.execute(`
            UPDATE time_entries 
            SET project_id = ?, task_id = ?, work_date = ?, duration_minutes = ?, description = ?, is_billable = ?, category = ?
            WHERE id = ? AND timesheet_id = ? AND user_id = ?
        `, [project_id, task_id || null, cleanWorkDate, duration_minutes, description, is_billable, category, id, timesheet_id, userId]);
    } else {
        const [res] = await db.execute(`
            INSERT INTO time_entries (
                organization_id, company_id, timesheet_id, user_id,
                project_id, task_id, work_date, duration_minutes, description, is_billable, category
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [organizationId, companyId, timesheet_id, userId, project_id, task_id || null, cleanWorkDate, duration_minutes, description, is_billable, category]);
        entryId = res.insertId;
    }

    await recalculateTimesheetTotals(timesheet_id);
    return entryId;
};

/**
 * Delete a Time Entry
 */
const deleteTimeEntry = async (userId, entryId) => {
    const [entryRows] = await db.execute(`SELECT * FROM time_entries WHERE id = ? AND user_id = ?`, [entryId, userId]);
    if (entryRows.length === 0) throw new Error("Time entry not found.");
    const timesheetId = entryRows[0].timesheet_id;

    // Check timesheet lock
    const [tsRows] = await db.execute(`SELECT * FROM timesheets WHERE id = ?`, [timesheetId]);
    if (tsRows[0].is_locked || tsRows[0].status === 'SUBMITTED' || tsRows[0].status === 'APPROVED') {
        throw new Error("This timesheet is locked and entries cannot be deleted.");
    }

    await db.execute(`DELETE FROM time_entries WHERE id = ?`, [entryId]);
    await recalculateTimesheetTotals(timesheetId);
    return true;
};

/**
 * Submit Timesheet for Manager Review
 */
const submitTimesheet = async (timesheetId, userId, organizationId, companyId) => {
    const [tsRows] = await db.execute(`SELECT * FROM timesheets WHERE id = ? AND user_id = ?`, [timesheetId, userId]);
    if (tsRows.length === 0) throw new Error("Timesheet not found.");
    if (Number(tsRows[0].total_hours) <= 0) throw new Error("Cannot submit an empty timesheet with 0 hours logged.");

    await db.execute(`
        UPDATE timesheets 
        SET status = 'SUBMITTED', submitted_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [timesheetId]);

    await db.execute(`
        INSERT INTO timesheet_approvals (organization_id, timesheet_id, actor_id, action, comment)
        VALUES (?, ?, ?, 'SUBMIT', 'Submitted for review')
    `, [organizationId, timesheetId, userId]);

    return true;
};

/**
 * Get Timesheet Approvals Queue for Managers / Admins
 */
const getTimesheetApprovalsQueue = async (organizationId, companyId, statusFilter = 'SUBMITTED') => {
    let query = `
        SELECT 
            ts.id, ts.organization_id, ts.company_id, ts.user_id,
            DATE_FORMAT(ts.period_start_date, '%Y-%m-%d') AS period_start_date,
            DATE_FORMAT(ts.period_end_date, '%Y-%m-%d') AS period_end_date,
            ts.total_hours, ts.billable_hours, ts.non_billable_hours,
            ts.status, ts.is_locked, ts.submitted_at, ts.approved_at,
            ts.created_at, ts.updated_at,
            u.name AS user_name,
            u.email AS user_email,
            u.role AS user_role,
            dept.department_name,
            (SELECT COUNT(*) FROM time_entries te WHERE te.timesheet_id = ts.id) AS entry_count
        FROM timesheets ts
        JOIN users u ON u.id = ts.user_id
        LEFT JOIN departments dept ON dept.id = u.department_id
        WHERE ts.organization_id = ?
          AND (ts.company_id = ? OR ? = 1)
    `;
    const params = [organizationId, companyId, companyId];

    if (statusFilter && statusFilter !== 'ALL') {
        query += ` AND ts.status = ?`;
        params.push(statusFilter);
    }

    query += ` ORDER BY ts.period_start_date DESC, ts.submitted_at DESC`;

    const [rows] = await db.execute(query, params);
    return rows;
};

/**
 * Approve Timesheet
 */
const approveTimesheet = async (timesheetId, approverId, organizationId, companyId, comment = null) => {
    const [tsRows] = await db.execute(`SELECT * FROM timesheets WHERE id = ? AND organization_id = ?`, [timesheetId, organizationId]);
    if (tsRows.length === 0) throw new Error("Timesheet not found.");

    await db.execute(`
        UPDATE timesheets 
        SET status = 'APPROVED', is_locked = TRUE, approved_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [timesheetId]);

    await db.execute(`
        INSERT INTO timesheet_approvals (organization_id, timesheet_id, actor_id, action, comment)
        VALUES (?, ?, ?, 'APPROVE', ?)
    `, [organizationId, timesheetId, approverId, comment || 'Approved']);

    return true;
};

/**
 * Reject Timesheet
 */
const rejectTimesheet = async (timesheetId, approverId, organizationId, companyId, comment) => {
    if (!comment || !comment.trim()) throw new Error("A rejection reason/comment is required.");

    const [tsRows] = await db.execute(`SELECT * FROM timesheets WHERE id = ? AND organization_id = ?`, [timesheetId, organizationId]);
    if (tsRows.length === 0) throw new Error("Timesheet not found.");

    await db.execute(`
        UPDATE timesheets 
        SET status = 'REJECTED', is_locked = FALSE
        WHERE id = ?
    `, [timesheetId]);

    await db.execute(`
        INSERT INTO timesheet_approvals (organization_id, timesheet_id, actor_id, action, comment)
        VALUES (?, ?, ?, 'REJECT', ?)
    `, [organizationId, timesheetId, approverId, comment.trim()]);

    return true;
};

/**
 * Timesheet Reports Aggregation
 */
const getTimesheetReports = async (organizationId, companyId, filters = {}) => {
    const { startDate, endDate, projectId, userId } = filters;

    let query = `
        SELECT 
            te.id,
            DATE_FORMAT(te.work_date, '%Y-%m-%d') AS work_date,
            te.duration_minutes,
            te.duration_hours,
            te.description,
            te.is_billable,
            te.category,
            p.name AS project_title,
            p.code AS project_code,
            t.title AS task_title,
            u.name AS user_name,
            u.email AS user_email,
            dept.department_name
        FROM time_entries te
        LEFT JOIN projects p ON p.id = te.project_id
        LEFT JOIN tasks t ON t.id = te.task_id
        JOIN users u ON u.id = te.user_id
        LEFT JOIN departments dept ON dept.id = u.department_id
        WHERE te.organization_id = ?
          AND (te.company_id = ? OR ? = 1)
    `;
    const params = [organizationId, companyId, companyId];

    if (startDate) {
        query += ` AND te.work_date >= ?`;
        params.push(startDate);
    }
    if (endDate) {
        query += ` AND te.work_date <= ?`;
        params.push(endDate);
    }
    if (projectId) {
        query += ` AND te.project_id = ?`;
        params.push(projectId);
    }
    if (userId) {
        query += ` AND te.user_id = ?`;
        params.push(userId);
    }

    query += ` ORDER BY te.work_date DESC, te.created_at DESC`;

    const [rows] = await db.execute(query, params);

    // Summary calculations
    let totalMinutes = 0;
    let billableMinutes = 0;
    let projectHoursMap = {};

    rows.forEach(r => {
        const m = Number(r.duration_minutes || 0);
        totalMinutes += m;
        if (Boolean(r.is_billable)) billableMinutes += m;

        const proj = r.project_title || 'Unassigned';
        projectHoursMap[proj] = (projectHoursMap[proj] || 0) + (m / 60.0);
    });

    return {
        entries: rows,
        summary: {
            totalHours: (totalMinutes / 60.0).toFixed(1),
            billableHours: (billableMinutes / 60.0).toFixed(1),
            nonBillableHours: ((totalMinutes - billableMinutes) / 60.0).toFixed(1),
            billablePercentage: totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0,
            projectBreakdown: projectHoursMap
        }
    };
};

module.exports = {
    initTimesheetTables,
    getOrCreateWeeklyTimesheet,
    addOrUpdateTimeEntry,
    deleteTimeEntry,
    submitTimesheet,
    getTimesheetApprovalsQueue,
    approveTimesheet,
    rejectTimesheet,
    getTimesheetReports
};
