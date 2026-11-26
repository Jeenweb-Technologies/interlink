const db = require("../config/db.js");

// Helper: Check effective access scope
const verifyTaskAccess = async (taskId, user, requiredAction = 'read') => {
    if (!user) return false;
    const isSuper = user.role === 'super_admin' || user.role === 'super admin' || user.role === 'developer';
    if (isSuper) return true;

    const tenantId = user.organization_id || 1;
    const companyId = user.company_id || 1;
    const [taskRows] = await db.execute(
        "SELECT id, owner_id, project_id, tenant_id, company_id FROM tasks WHERE id = ? AND deleted_at IS NULL",
        [taskId]
    );
    if (taskRows.length === 0) return false;
    const task = taskRows[0];

    // Enforce organization and active company boundaries
    if (task.tenant_id !== tenantId || task.company_id !== companyId) {
        return false;
    }

    if (user.role === 'admin') {
        return true;
    }

    const [rows] = await db.execute(`
        SELECT t.id, t.owner_id, t.project_id
        FROM tasks t
        LEFT JOIN task_assignees ta ON t.id = ta.task_id AND ta.user_id = ?
        LEFT JOIN task_watchers tw ON t.id = tw.task_id AND tw.user_id = ?
        WHERE t.id = ? AND (t.owner_id = ? OR ta.user_id = ? OR tw.user_id = ?)
    `, [user.id, user.id, taskId, user.id, user.id, user.id]);

    if (rows.length > 0) return true;

    if (requiredAction === 'read') {
        return true;
    }

    return false;
};

// Helper: DFS cycle detection for task dependencies
const hasCircularDependency = async (predecessorId, successorId) => {
    if (predecessorId === successorId) return true;

    // Check if successorId can reach predecessorId via existing dependencies
    const visited = new Set();
    const queue = [successorId];

    while (queue.length > 0) {
        const current = queue.shift();
        if (current === predecessorId) {
            return true;
        }

        if (!visited.has(current)) {
            visited.add(current);
            const [nextDeps] = await db.execute(
                "SELECT successor_id FROM task_dependencies WHERE predecessor_id = ?",
                [current]
            );
            for (const dep of nextDeps) {
                if (!visited.has(dep.successor_id)) {
                    queue.push(dep.successor_id);
                }
            }
        }
    }

    return false;
};

// Helper: Recursive auto-cascade dates to downstream tasks
const cascadeSuccessorDates = async (predecessorId, shiftDays) => {
    if (!shiftDays || shiftDays === 0) return;

    const [successors] = await db.execute(`
        SELECT td.successor_id, td.dependency_type, td.lag_days, t.start_date, t.due_date
        FROM task_dependencies td
        JOIN tasks t ON td.successor_id = t.id
        WHERE td.predecessor_id = ?
    `, [predecessorId]);

    for (const succ of successors) {
        if (succ.start_date && succ.due_date) {
            await db.execute(`
                UPDATE tasks
                SET start_date = DATE_ADD(start_date, INTERVAL ? DAY),
                    due_date = DATE_ADD(due_date, INTERVAL ? DAY)
                WHERE id = ?
            `, [shiftDays, shiftDays, succ.successor_id]);

            // Log activity
            await db.execute(`
                INSERT INTO task_activities (task_id, action, description)
                VALUES (?, 'date_shifted', ?)
            `, [succ.successor_id, `Dates auto-cascaded (+${shiftDays} days) from predecessor #${predecessorId}`]);

            // Recursively cascade
            await cascadeSuccessorDates(succ.successor_id, shiftDays);
        }
    }
};

// Helper: Synchronize project total logged hours and record completion duration if all tasks done
const syncProjectDurationAndCompletion = async (projectId) => {
    if (!projectId) return;
    try {
        // 1. Recalculate total logged hours for this project from all tasks
        await db.execute(`
            UPDATE projects
            SET total_logged_hours = (
                SELECT COALESCE(SUM(t.actual_hours), 0)
                FROM tasks t
                WHERE t.project_id = ? AND t.deleted_at IS NULL
            )
            WHERE id = ?
        `, [projectId, projectId]);

        // 2. Check if all tasks for this project are completed
        const [taskStats] = await db.execute(`
            SELECT 
                COUNT(*) as total_tasks,
                SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done_tasks
            FROM tasks
            WHERE project_id = ? AND deleted_at IS NULL
        `, [projectId]);

        const { total_tasks = 0, done_tasks = 0 } = taskStats[0] || {};
        if (total_tasks > 0 && Number(total_tasks) === Number(done_tasks)) {
            // All tasks completed: automatically log completion timestamp and duration in days
            await db.execute(`
                UPDATE projects
                SET 
                    status = 'completed',
                    completed_at = COALESCE(completed_at, NOW()),
                    actual_completion_duration_days = COALESCE(
                        actual_completion_duration_days,
                        DATEDIFF(COALESCE(completed_at, NOW()), COALESCE(start_date, created_at))
                    )
                WHERE id = ? AND (status != 'completed' OR completed_at IS NULL)
            `, [projectId]);
        }
    } catch (err) {
        console.error("Error syncing project duration and completion:", err);
    }
};

// GET /api/tasks - List tasks with filtering, search, sorting & dependency blockers
exports.getTasks = async (req, res) => {
    try {
        const tenantId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;
        const {
            status,
            priority,
            project_id,
            assignee_id,
            search,
            label_id,
            due_filter, // 'today', 'overdue', 'this_week'
            sort_by = 'created_at',
            sort_dir = 'DESC'
        } = req.query;

        let query = `
            SELECT 
                t.*,
                p.name AS project_name,
                p.code AS project_code,
                u.name AS owner_name,
                u.email AS owner_email,
                (SELECT COUNT(*) FROM task_checklists WHERE task_id = t.id) AS checklist_total,
                (SELECT COUNT(*) FROM task_checklists WHERE task_id = t.id AND is_completed = 1) AS checklist_completed,
                (SELECT COUNT(*) FROM task_comments WHERE task_id = t.id) AS comment_count,
                (SELECT COUNT(*) FROM task_attachments WHERE task_id = t.id) AS attachment_count
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN users u ON t.owner_id = u.id
            WHERE t.deleted_at IS NULL AND t.tenant_id = ? AND t.company_id = ?
        `;

        const params = [tenantId, companyId];

        // Scope check for non-admins
        if (req.user && req.user.role !== 'admin' && req.user.role !== 'super admin') {
            query += ` AND (
                t.owner_id = ? 
                OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?)
                OR t.id IN (SELECT task_id FROM task_watchers WHERE user_id = ?)
            )`;
            params.push(req.user.id, req.user.id, req.user.id);
        }

        if (status) {
            query += ` AND t.status = ?`;
            params.push(status);
        }

        if (priority) {
            query += ` AND t.priority = ?`;
            params.push(priority);
        }

        if (project_id) {
            query += ` AND t.project_id = ?`;
            params.push(project_id);
        }

        if (assignee_id) {
            query += ` AND t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ?)`;
            params.push(assignee_id);
        }

        if (label_id) {
            query += ` AND t.id IN (SELECT task_id FROM task_labels_map WHERE label_id = ?)`;
            params.push(label_id);
        }

        if (search) {
            query += ` AND (t.title LIKE ? OR t.task_code LIKE ? OR t.description LIKE ?)`;
            const s = `%${search}%`;
            params.push(s, s, s);
        }

        if (due_filter === 'overdue') {
            query += ` AND t.due_date < NOW() AND t.status NOT IN ('done', 'cancelled')`;
        } else if (due_filter === 'today') {
            query += ` AND DATE(t.due_date) = CURDATE()`;
        } else if (due_filter === 'this_week') {
            query += ` AND YEARWEEK(t.due_date, 1) = YEARWEEK(CURDATE(), 1)`;
        }

        const allowedSort = ['created_at', 'due_date', 'priority', 'status', 'title', 'sort_order'];
        const safeSort = allowedSort.includes(sort_by) ? `t.${sort_by}` : 't.created_at';
        const safeDir = sort_dir.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        query += ` ORDER BY ${safeSort} ${safeDir}`;

        const [tasks] = await db.execute(query, params);

        if (tasks.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        const taskIds = tasks.map(t => t.id);

        // Fetch assignees
        const [assignees] = await db.query(`
            SELECT ta.task_id, u.id AS user_id, u.name, u.email, u.username
            FROM task_assignees ta
            JOIN users u ON ta.user_id = u.id
            WHERE ta.task_id IN (?)
        `, [taskIds]);

        // Fetch labels
        const [labels] = await db.query(`
            SELECT tlm.task_id, tl.id, tl.name, tl.color
            FROM task_labels_map tlm
            JOIN task_labels tl ON tlm.label_id = tl.id
            WHERE tlm.task_id IN (?)
        `, [taskIds]);

        // Fetch blocker dependencies (who is blocking each task)
        const [blockers] = await db.query(`
            SELECT td.successor_id AS task_id, td.predecessor_id, pred.task_code AS pred_code, pred.title AS pred_title, pred.status AS pred_status
            FROM task_dependencies td
            JOIN tasks pred ON td.predecessor_id = pred.id
            WHERE td.successor_id IN (?)
        `, [taskIds]);

        // Group metadata by task_id
        const assigneeMap = {};
        for (const a of assignees) {
            if (!assigneeMap[a.task_id]) assigneeMap[a.task_id] = [];
            assigneeMap[a.task_id].push(a);
        }

        const labelMap = {};
        for (const l of labels) {
            if (!labelMap[l.task_id]) labelMap[l.task_id] = [];
            labelMap[l.task_id].push(l);
        }

        const blockerMap = {};
        for (const b of blockers) {
            if (!blockerMap[b.task_id]) blockerMap[b.task_id] = [];
            blockerMap[b.task_id].push(b);
        }

        // Attach enriched data
        const enrichedTasks = tasks.map(t => {
            const myBlockers = blockerMap[t.id] || [];
            // A task is considered actively blocked if any predecessor is not 'done'
            const activeBlockers = myBlockers.filter(b => b.pred_status !== 'done');
            const isBlocked = activeBlockers.length > 0;

            return {
                ...t,
                assignees: assigneeMap[t.id] || [],
                labels: labelMap[t.id] || [],
                blockers: myBlockers,
                active_blockers: activeBlockers,
                is_blocked: isBlocked
            };
        });

        res.status(200).json({ success: true, data: enrichedTasks });
    } catch (error) {
        console.error("getTasks error:", error);
        res.status(500).json({ success: false, message: "Error loading tasks", error: error.message });
    }
};

// GET /api/tasks/:id - Task details with full relations
exports.getTaskById = async (req, res) => {
    try {
        const { id } = req.params;

        const hasAccess = await verifyTaskAccess(id, req.user, 'read');
        if (!hasAccess) {
            return res.status(403).json({ success: false, message: "Access Denied: You do not have permission to view this task." });
        }

        const [tasks] = await db.execute(`
            SELECT 
                t.*,
                p.name AS project_name,
                p.code AS project_code,
                p.status AS project_status,
                p.total_logged_hours AS project_total_logged_hours,
                u.name AS owner_name,
                u.email AS owner_email
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            LEFT JOIN users u ON t.owner_id = u.id
            WHERE t.id = ? AND t.deleted_at IS NULL
        `, [id]);

        if (tasks.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }

        const task = tasks[0];

        // Assignees
        const [assignees] = await db.execute(`
            SELECT u.id, u.name, u.email, u.username
            FROM task_assignees ta
            JOIN users u ON ta.user_id = u.id
            WHERE ta.task_id = ?
        `, [id]);

        // Watchers
        const [watchers] = await db.execute(`
            SELECT u.id, u.name, u.email, u.username
            FROM task_watchers tw
            JOIN users u ON tw.user_id = u.id
            WHERE tw.task_id = ?
        `, [id]);

        // Labels
        const [labels] = await db.execute(`
            SELECT tl.id, tl.name, tl.color
            FROM task_labels_map tlm
            JOIN task_labels tl ON tlm.label_id = tl.id
            WHERE tlm.task_id = ?
        `, [id]);

        // Checklists
        const [checklists] = await db.execute(`
            SELECT c.*, u.name AS completed_by_name
            FROM task_checklists c
            LEFT JOIN users u ON c.completed_by = u.id
            WHERE c.task_id = ?
            ORDER BY c.sort_order ASC, c.id ASC
        `, [id]);

        // Dependencies: Blocked by (predecessors)
        const [predecessors] = await db.execute(`
            SELECT td.id AS dep_id, td.dependency_type, td.lag_days,
                   p.id, p.task_code, p.title, p.status, p.priority, p.due_date
            FROM task_dependencies td
            JOIN tasks p ON td.predecessor_id = p.id
            WHERE td.successor_id = ?
        `, [id]);

        // Dependencies: Blocks (successors)
        const [successors] = await db.execute(`
            SELECT td.id AS dep_id, td.dependency_type, td.lag_days,
                   s.id, s.task_code, s.title, s.status, s.priority, s.due_date
            FROM task_dependencies td
            JOIN tasks s ON td.successor_id = s.id
            WHERE td.predecessor_id = ?
        `, [id]);

        // Comments
        const [comments] = await db.execute(`
            SELECT c.*, u.name AS user_name, u.email AS user_email
            FROM task_comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.task_id = ?
            ORDER BY c.created_at ASC
        `, [id]);

        // Attachments
        const [attachments] = await db.execute(`
            SELECT a.*, u.name AS uploaded_by_name
            FROM task_attachments a
            JOIN users u ON a.uploaded_by = u.id
            WHERE a.task_id = ?
            ORDER BY a.created_at DESC
        `, [id]);

        // Time entries
        const [timeEntries] = await db.execute(`
            SELECT te.*, u.name AS user_name
            FROM task_time_entries te
            JOIN users u ON te.user_id = u.id
            WHERE te.task_id = ?
            ORDER BY te.start_time DESC
        `, [id]);

        // Activities
        const [activities] = await db.execute(`
            SELECT act.*, u.name AS user_name
            FROM task_activities act
            LEFT JOIN users u ON act.user_id = u.id
            WHERE act.task_id = ?
            ORDER BY act.created_at DESC
            LIMIT 50
        `, [id]);

        const activeBlockers = predecessors.filter(p => p.status !== 'done');

        res.status(200).json({
            success: true,
            data: {
                ...task,
                assignees,
                watchers,
                labels,
                checklists,
                predecessors,
                successors,
                active_blockers: activeBlockers,
                is_blocked: activeBlockers.length > 0,
                comments,
                attachments,
                time_entries: timeEntries,
                activities
            }
        });
    } catch (error) {
        console.error("getTaskById error:", error);
        res.status(500).json({ success: false, message: "Error loading task details", error: error.message });
    }
};

// POST /api/tasks - Create task with full metadata & dependencies
exports.createTask = async (req, res) => {
    try {
        const {
            title,
            description = '',
            status = 'todo',
            priority = 'medium',
            project_id = null,
            ticket_id = null,
            meeting_id = null,
            document_id = null,
            start_date = null,
            due_date = null,
            estimated_hours = 0,
            recurrence_rule = null,
            assignees = [], // Array of user IDs
            watchers = [],
            labels = [],    // Array of label IDs
            checklists = [], // Array of strings or { title }
            blocked_by_ids = [] // Array of predecessor task IDs
        } = req.body;

        if (!title || title.trim() === '') {
            return res.status(400).json({ success: false, message: "Task title is required." });
        }

        // Generate task code
        const [countRow] = await db.execute("SELECT COUNT(*) AS total FROM tasks");
        const nextNum = 1000 + countRow[0].total + 1;
        const taskCode = `TSK-${nextNum}`;

        const ownerId = req.user ? req.user.id : 1;
        const tenantId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;

        const [result] = await db.execute(`
            INSERT INTO tasks (
                tenant_id, company_id, task_code, title, description, status, priority, owner_id,
                project_id, ticket_id, meeting_id, document_id,
                start_date, due_date, estimated_hours, is_recurring, recurrence_rule
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            tenantId,
            companyId,
            taskCode,
            title.trim(),
            description,
            status,
            priority,
            ownerId,
            project_id || null,
            ticket_id || null,
            meeting_id || null,
            document_id || null,
            start_date || null,
            due_date || null,
            estimated_hours || 0,
            recurrence_rule ? 1 : 0,
            recurrence_rule ? JSON.stringify(recurrence_rule) : null
        ]);

        const taskId = result.insertId;

        // Assignees
        if (Array.isArray(assignees) && assignees.length > 0) {
            for (const uid of assignees) {
                await db.execute("INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)", [taskId, uid]);
            }
        }

        // Watchers
        if (Array.isArray(watchers) && watchers.length > 0) {
            for (const uid of watchers) {
                await db.execute("INSERT IGNORE INTO task_watchers (task_id, user_id) VALUES (?, ?)", [taskId, uid]);
            }
        }

        // Labels
        if (Array.isArray(labels) && labels.length > 0) {
            for (const lid of labels) {
                await db.execute("INSERT IGNORE INTO task_labels_map (task_id, label_id) VALUES (?, ?)", [taskId, lid]);
            }
        }

        // Checklists
        if (Array.isArray(checklists) && checklists.length > 0) {
            for (let i = 0; i < checklists.length; i++) {
                const itemTitle = typeof checklists[i] === 'string' ? checklists[i] : checklists[i].title;
                if (itemTitle && itemTitle.trim()) {
                    await db.execute("INSERT INTO task_checklists (task_id, title, sort_order) VALUES (?, ?, ?)", [taskId, itemTitle.trim(), i + 1]);
                }
            }
        }

        // Dependencies (blocked_by_ids)
        if (Array.isArray(blocked_by_ids) && blocked_by_ids.length > 0) {
            for (const predId of blocked_by_ids) {
                const isCircular = await hasCircularDependency(predId, taskId);
                if (!isCircular) {
                    await db.execute("INSERT IGNORE INTO task_dependencies (tenant_id, predecessor_id, successor_id) VALUES (1, ?, ?)", [predId, taskId]);
                }
            }
        }

        // Log activity
        await db.execute(`
            INSERT INTO task_activities (task_id, user_id, action, description)
            VALUES (?, ?, 'created', ?)
        `, [taskId, ownerId, `Task ${taskCode} created.`]);

        res.status(201).json({
            success: true,
            message: "Task created successfully.",
            data: { id: taskId, task_code: taskCode }
        });
    } catch (error) {
        console.error("createTask error:", error);
        res.status(500).json({ success: false, message: "Error creating task", error: error.message });
    }
};

// PUT /api/tasks/:id - Update task
exports.updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const hasAccess = await verifyTaskAccess(id, req.user, 'write');
        if (!hasAccess) {
            return res.status(403).json({ success: false, message: "Access Denied: You do not have permission to edit this task." });
        }

        const [existingRows] = await db.execute("SELECT * FROM tasks WHERE id = ?", [id]);
        if (existingRows.length === 0) {
            return res.status(404).json({ success: false, message: "Task not found." });
        }
        const prev = existingRows[0];

        const {
            title,
            description,
            status,
            priority,
            project_id,
            ticket_id,
            meeting_id,
            document_id,
            start_date,
            due_date,
            estimated_hours,
            assignees,
            watchers,
            labels,
            auto_cascade = true
        } = req.body;

        // Blocker verification: if marking status to 'done', check if active blockers exist
        if (status === 'done' && prev.status !== 'done') {
            const [blockers] = await db.execute(`
                SELECT pred.task_code, pred.title 
                FROM task_dependencies td
                JOIN tasks pred ON td.predecessor_id = pred.id
                WHERE td.successor_id = ? AND pred.status != 'done'
            `, [id]);

            if (blockers.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: `Cannot complete task: Blocked by unfinished predecessor #${blockers[0].task_code} ("${blockers[0].title}").`
                });
            }
        }

        // Check if due_date shifted and auto_cascade is enabled
        let shiftDays = 0;
        if (due_date && prev.due_date && auto_cascade) {
            const oldDue = new Date(prev.due_date);
            const newDue = new Date(due_date);
            const diffTime = newDue.getTime() - oldDue.getTime();
            shiftDays = Math.round(diffTime / (1000 * 3600 * 24));
        }

        const isMarkingDone = status === 'done' && prev.status !== 'done';
        const isReopening = status && status !== 'done' && prev.status === 'done';

        await db.execute(`
            UPDATE tasks SET
                title = COALESCE(?, title),
                description = COALESCE(?, description),
                status = COALESCE(?, status),
                priority = COALESCE(?, priority),
                project_id = ?,
                ticket_id = ?,
                meeting_id = ?,
                document_id = ?,
                start_date = ?,
                due_date = ?,
                estimated_hours = COALESCE(?, estimated_hours),
                completed_at = CASE 
                    WHEN ? = 1 THEN NOW() 
                    WHEN ? = 1 THEN NULL 
                    ELSE completed_at 
                END
            WHERE id = ?
        `, [
            title !== undefined ? title : null,
            description !== undefined ? description : null,
            status !== undefined ? status : null,
            priority !== undefined ? priority : null,
            project_id !== undefined ? project_id : prev.project_id,
            ticket_id !== undefined ? ticket_id : prev.ticket_id,
            meeting_id !== undefined ? meeting_id : prev.meeting_id,
            document_id !== undefined ? document_id : prev.document_id,
            start_date !== undefined ? start_date : prev.start_date,
            due_date !== undefined ? due_date : prev.due_date,
            estimated_hours !== undefined ? estimated_hours : null,
            isMarkingDone ? 1 : 0,
            isReopening ? 1 : 0,
            id
        ]);

        // Update assignees if provided
        if (Array.isArray(assignees)) {
            await db.execute("DELETE FROM task_assignees WHERE task_id = ?", [id]);
            for (const uid of assignees) {
                await db.execute("INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)", [id, uid]);
            }
        }

        // Update watchers if provided
        if (Array.isArray(watchers)) {
            await db.execute("DELETE FROM task_watchers WHERE task_id = ?", [id]);
            for (const uid of watchers) {
                await db.execute("INSERT IGNORE INTO task_watchers (task_id, user_id) VALUES (?, ?)", [id, uid]);
            }
        }

        // Update labels if provided
        if (Array.isArray(labels)) {
            await db.execute("DELETE FROM task_labels_map WHERE task_id = ?", [id]);
            for (const lid of labels) {
                await db.execute("INSERT IGNORE INTO task_labels_map (task_id, label_id) VALUES (?, ?)", [id, lid]);
            }
        }

        // Auto-cascade downstream dates if shiftDays > 0
        if (shiftDays > 0 && auto_cascade) {
            await cascadeSuccessorDates(id, shiftDays);
        }

        // Log activity
        const userId = req.user ? req.user.id : null;
        let desc = "Task updated.";
        if (status && status !== prev.status) desc = `Status changed from ${prev.status} to ${status}.`;
        else if (priority && priority !== prev.priority) desc = `Priority changed to ${priority}.`;

        await db.execute(`
            INSERT INTO task_activities (task_id, user_id, action, description)
            VALUES (?, ?, 'updated', ?)
        `, [id, userId, desc]);

        // Automatically synchronize project duration and completion if all tasks completed
        const effectiveProjectId = project_id !== undefined ? project_id : prev.project_id;
        if (effectiveProjectId) {
            await syncProjectDurationAndCompletion(effectiveProjectId);
        }

        res.status(200).json({ success: true, message: "Task updated successfully." });
    } catch (error) {
        console.error("updateTask error:", error);
        res.status(500).json({ success: false, message: "Error updating task", error: error.message });
    }
};

// DELETE /api/tasks/:id - Delete task
exports.deleteTask = async (req, res) => {
    try {
        const { id } = req.params;
        const hasAccess = await verifyTaskAccess(id, req.user, 'write');
        if (!hasAccess) {
            return res.status(403).json({ success: false, message: "Access Denied: You do not have permission to delete this task." });
        }

        await db.execute("UPDATE tasks SET deleted_at = NOW() WHERE id = ?", [id]);
        res.status(200).json({ success: true, message: "Task deleted successfully." });
    } catch (error) {
        console.error("deleteTask error:", error);
        res.status(500).json({ success: false, message: "Error deleting task", error: error.message });
    }
};

// POST /api/tasks/bulk - Bulk edit tasks (assign, status, priority, due_date, delete)
exports.bulkUpdateTasks = async (req, res) => {
    try {
        const { task_ids, action, value } = req.body;

        if (!Array.isArray(task_ids) || task_ids.length === 0) {
            return res.status(400).json({ success: false, message: "No task IDs provided." });
        }

        if (action === 'status') {
            await db.query("UPDATE tasks SET status = ? WHERE id IN (?)", [value, task_ids]);
        } else if (action === 'priority') {
            await db.query("UPDATE tasks SET priority = ? WHERE id IN (?)", [value, task_ids]);
        } else if (action === 'due_date') {
            await db.query("UPDATE tasks SET due_date = ? WHERE id IN (?)", [value, task_ids]);
        } else if (action === 'delete') {
            await db.query("UPDATE tasks SET deleted_at = NOW() WHERE id IN (?)", [task_ids]);
        } else if (action === 'assign') {
            for (const tId of task_ids) {
                await db.execute("INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)", [tId, value]);
            }
        }

        res.status(200).json({ success: true, message: `Bulk updated ${task_ids.length} tasks.` });
    } catch (error) {
        console.error("bulkUpdateTasks error:", error);
        res.status(500).json({ success: false, message: "Error during bulk update", error: error.message });
    }
};

// GET /api/tasks/dashboard - Metrics for TASK-01
exports.getDashboardMetrics = async (req, res) => {
    try {
        const tenantId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;

        const [counts] = await db.execute(`
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN status NOT IN ('done', 'cancelled') AND due_date < NOW() THEN 1 ELSE 0 END) AS overdue_count,
                SUM(CASE WHEN DATE(due_date) = CURDATE() THEN 1 ELSE 0 END) AS due_today_count,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
                SUM(CASE WHEN status = 'done' AND YEARWEEK(updated_at, 1) = YEARWEEK(CURDATE(), 1) THEN 1 ELSE 0 END) AS completed_this_week
            FROM tasks
            WHERE deleted_at IS NULL AND tenant_id = ? AND company_id = ?
        `, [tenantId, companyId]);

        // Priority breakdown
        const [priorities] = await db.execute(`
            SELECT priority, COUNT(*) AS count
            FROM tasks
            WHERE deleted_at IS NULL AND tenant_id = ? AND company_id = ?
            GROUP BY priority
        `, [tenantId, companyId]);

        // Status breakdown
        const [statuses] = await db.execute(`
            SELECT status, COUNT(*) AS count
            FROM tasks
            WHERE deleted_at IS NULL AND tenant_id = ? AND company_id = ?
            GROUP BY status
        `, [tenantId, companyId]);

        // Workload distribution by user
        const [workload] = await db.execute(`
            SELECT 
                u.id AS user_id,
                u.name,
                u.email,
                COUNT(ta.task_id) AS active_tasks,
                COALESCE(SUM(t.estimated_hours), 0) AS total_estimated_hours,
                COALESCE(SUM(t.actual_hours), 0) AS total_logged_hours
            FROM users u
            LEFT JOIN task_assignees ta ON u.id = ta.user_id
            LEFT JOIN tasks t ON ta.task_id = t.id AND t.deleted_at IS NULL AND t.status NOT IN ('done', 'cancelled') AND t.tenant_id = ? AND t.company_id = ?
            WHERE u.active = 1 AND u.organization_id = ? AND u.company_id = ?
            GROUP BY u.id, u.name, u.email
            ORDER BY total_estimated_hours DESC
            LIMIT 10
        `, [tenantId, companyId, tenantId, companyId]);

        // Critical / Blocked tasks stream
        const [blockedStream] = await db.execute(`
            SELECT 
                t.id, t.task_code, t.title, t.priority, t.due_date,
                pred.id AS blocker_id, pred.task_code AS blocker_code, pred.title AS blocker_title, pred.status AS blocker_status
            FROM tasks t
            JOIN task_dependencies td ON t.id = td.successor_id
            JOIN tasks pred ON td.predecessor_id = pred.id
            WHERE t.deleted_at IS NULL AND t.status NOT IN ('done', 'cancelled') AND pred.status != 'done'
            LIMIT 5
        `);

        // Project Durations & Logged Hours (Tracking time durations in which projects completed)
        const [projectDurations] = await db.execute(`
            SELECT 
                p.id,
                p.code,
                p.name,
                p.status,
                p.start_date,
                p.end_date,
                p.completed_at,
                p.actual_completion_duration_days,
                COALESCE(p.total_logged_hours, 0) AS total_logged_hours,
                COUNT(t.id) AS total_tasks,
                SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS completed_tasks,
                COALESCE(SUM(t.estimated_hours), 0) AS total_estimated_hours,
                COALESCE(SUM(t.actual_hours), 0) AS total_actual_hours
            FROM projects p
            LEFT JOIN tasks t ON p.id = t.project_id AND t.deleted_at IS NULL
            WHERE p.deleted_at IS NULL
            GROUP BY p.id
            ORDER BY (p.status = 'completed') DESC, p.id ASC
        `);

        const completedProjects = projectDurations.filter(p => p.status === 'completed');
        const totalDurationDays = completedProjects.reduce((acc, p) => acc + (parseFloat(p.actual_completion_duration_days) || 0), 0);
        const avgCompletionDays = completedProjects.length > 0 ? (totalDurationDays / completedProjects.length).toFixed(1) : "0.0";
        const totalProjectHoursLogged = projectDurations.reduce((acc, p) => acc + (parseFloat(p.total_logged_hours) || parseFloat(p.total_actual_hours) || 0), 0).toFixed(1);

        res.status(200).json({
            success: true,
            data: {
                metrics: {
                    ...(counts[0] || {}),
                    completed_projects_count: completedProjects.length,
                    avg_project_duration_days: avgCompletionDays,
                    total_project_hours_logged: totalProjectHoursLogged
                },
                priorities,
                statuses,
                workload,
                blocked_stream: blockedStream,
                project_durations: projectDurations
            }
        });
    } catch (error) {
        console.error("getDashboardMetrics error:", error);
        res.status(500).json({ success: false, message: "Error loading dashboard metrics", error: error.message });
    }
};

// Dependency management: POST /api/tasks/dependencies
exports.addDependency = async (req, res) => {
    try {
        const { predecessor_id, successor_id, dependency_type = 'FS', lag_days = 0 } = req.body;

        if (!predecessor_id || !successor_id) {
            return res.status(400).json({ success: false, message: "Both predecessor and successor IDs are required." });
        }

        // Circular dependency check
        const isCircular = await hasCircularDependency(predecessor_id, successor_id);
        if (isCircular) {
            return res.status(400).json({
                success: false,
                message: "Circular dependency detected: Connecting these tasks creates an impossible infinite loop."
            });
        }

        await db.execute(`
            INSERT INTO task_dependencies (tenant_id, predecessor_id, successor_id, dependency_type, lag_days)
            VALUES (1, ?, ?, ?, ?)
        `, [predecessor_id, successor_id, dependency_type, lag_days]);

        // Auto-adjust successor start date if predecessor due date > successor start date under FS
        const [pred] = await db.execute("SELECT due_date FROM tasks WHERE id = ?", [predecessor_id]);
        const [succ] = await db.execute("SELECT start_date, due_date FROM tasks WHERE id = ?", [successor_id]);

        if (dependency_type === 'FS' && pred[0]?.due_date && succ[0]?.start_date) {
            const predDue = new Date(pred[0].due_date);
            const succStart = new Date(succ[0].start_date);

            if (predDue > succStart) {
                const shiftMs = predDue.getTime() - succStart.getTime();
                const shiftDays = Math.ceil(shiftMs / (1000 * 3600 * 24)) + lag_days;
                await cascadeSuccessorDates(predecessor_id, shiftDays);
            }
        }

        res.status(201).json({ success: true, message: "Dependency linked successfully." });
    } catch (error) {
        console.error("addDependency error:", error);
        res.status(500).json({ success: false, message: "Error adding dependency", error: error.message });
    }
};

// DELETE /api/tasks/dependencies/:id
exports.deleteDependency = async (req, res) => {
    try {
        const { id } = req.params;
        await db.execute("DELETE FROM task_dependencies WHERE id = ?", [id]);
        res.status(200).json({ success: true, message: "Dependency removed." });
    } catch (error) {
        console.error("deleteDependency error:", error);
        res.status(500).json({ success: false, message: "Error removing dependency", error: error.message });
    }
};

// Checklists: POST /api/tasks/:id/checklists
exports.addChecklistItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { title } = req.body;
        if (!title || !title.trim()) return res.status(400).json({ success: false, message: "Title is required" });

        const [result] = await db.execute(`
            INSERT INTO task_checklists (task_id, title)
            VALUES (?, ?)
        `, [id, title.trim()]);

        res.status(201).json({ success: true, data: { id: result.insertId, task_id: id, title, is_completed: false } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/tasks/checklists/:id/toggle
exports.toggleChecklistItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_completed } = req.body;
        const userId = req.user ? req.user.id : null;

        await db.execute(`
            UPDATE task_checklists
            SET is_completed = ?, completed_by = ?, completed_at = ?
            WHERE id = ?
        `, [is_completed ? 1 : 0, is_completed ? userId : null, is_completed ? new Date() : null, id]);

        res.status(200).json({ success: true, message: "Checklist updated." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Comments: POST /api/tasks/:id/comments
exports.addComment = async (req, res) => {
    try {
        const { id } = req.params;
        const { comment_text } = req.body;
        if (!comment_text || !comment_text.trim()) return res.status(400).json({ success: false, message: "Comment cannot be empty." });

        const userId = req.user ? req.user.id : 1;
        const [result] = await db.execute(`
            INSERT INTO task_comments (task_id, user_id, comment_text)
            VALUES (?, ?, ?)
        `, [id, userId, comment_text.trim()]);

        // Log activity
        await db.execute(`
            INSERT INTO task_activities (task_id, user_id, action, description)
            VALUES (?, ?, 'comment', 'Added a comment.')
        `, [id, userId]);

        res.status(201).json({ success: true, data: { id: result.insertId, comment_text } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Time Tracking: GET /api/tasks/time/active
exports.getActiveTimer = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1;
        const [running] = await db.execute(`
            SELECT te.id, te.task_id, te.start_time, t.task_code, t.title
            FROM task_time_entries te
            JOIN tasks t ON te.task_id = t.id
            WHERE te.user_id = ? AND te.end_time IS NULL
            ORDER BY te.start_time DESC LIMIT 1
        `, [userId]);

        if (running.length === 0) {
            return res.json({ success: true, data: null });
        }
        res.json({ success: true, data: running[0] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Time Tracking: DELETE /api/tasks/time/discard
exports.discardTimer = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1;
        await db.execute(`
            DELETE FROM task_time_entries
            WHERE user_id = ? AND end_time IS NULL
        `, [userId]);
        res.json({ success: true, message: "Timer discarded successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Time Tracking: POST /api/tasks/:id/time/start
exports.startTimer = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user ? req.user.id : 1;

        // Stop any currently running timer for this user
        await db.execute(`
            UPDATE task_time_entries
            SET end_time = NOW(), duration_minutes = TIMESTAMPDIFF(MINUTE, start_time, NOW())
            WHERE user_id = ? AND end_time IS NULL
        `, [userId]);

        const [result] = await db.execute(`
            INSERT INTO task_time_entries (tenant_id, task_id, user_id, start_time)
            VALUES (1, ?, ?, NOW())
        `, [id, userId]);

        res.status(201).json({ success: true, data: { entry_id: result.insertId, task_id: id, start_time: new Date() } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Time Tracking: POST /api/tasks/time/stop
exports.stopTimer = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1;
        const { notes = '', is_billable = true } = req.body;

        const [running] = await db.execute(`
            SELECT id, task_id, start_time FROM task_time_entries
            WHERE user_id = ? AND end_time IS NULL
            ORDER BY start_time DESC LIMIT 1
        `, [userId]);

        if (running.length === 0) {
            return res.status(400).json({ success: false, message: "No active timer running." });
        }

        const entry = running[0];
        const now = new Date();
        const start = new Date(entry.start_time);
        const diffMinutes = Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000));

        await db.execute(`
            UPDATE task_time_entries
            SET end_time = NOW(), duration_minutes = ?, notes = ?, is_billable = ?
            WHERE id = ?
        `, [diffMinutes, notes, is_billable ? 1 : 0, entry.id]);

        // Update actual_hours on task
        await db.execute(`
            UPDATE tasks
            SET actual_hours = (
                SELECT COALESCE(SUM(duration_minutes) / 60.0, 0)
                FROM task_time_entries
                WHERE task_id = ?
            )
            WHERE id = ?
        `, [entry.task_id, entry.task_id]);

        // Sync project logged duration
        const [taskRow] = await db.execute("SELECT project_id FROM tasks WHERE id = ?", [entry.task_id]);
        if (taskRow.length > 0 && taskRow[0].project_id) {
            await syncProjectDurationAndCompletion(taskRow[0].project_id);
        }

        res.status(200).json({ success: true, message: `Logged ${diffMinutes} minutes.`, duration_minutes: diffMinutes });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Time Tracking: POST /api/tasks/:id/time/manual
exports.logManualTime = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            start_time,
            end_time,
            duration_minutes,
            entry_date,
            notes = '',
            is_billable = true
        } = req.body;
        const userId = req.user ? req.user.id : 1;

        let finalStart = null;
        let finalEnd = null;
        let finalDurationMinutes = 0;

        if (start_time && end_time) {
            finalStart = new Date(start_time);
            finalEnd = new Date(end_time);
            if (isNaN(finalStart.getTime()) || isNaN(finalEnd.getTime())) {
                return res.status(400).json({ success: false, message: "Invalid start or end date/time." });
            }
            if (finalEnd <= finalStart) {
                return res.status(400).json({ success: false, message: "End time must be after start time." });
            }
            finalDurationMinutes = Math.max(1, Math.round((finalEnd.getTime() - finalStart.getTime()) / 60000));
        } else if (start_time && duration_minutes) {
            finalStart = new Date(start_time);
            finalDurationMinutes = parseInt(duration_minutes);
            finalEnd = new Date(finalStart.getTime() + finalDurationMinutes * 60000);
        } else if (duration_minutes) {
            finalDurationMinutes = parseInt(duration_minutes);
            const baseDate = entry_date ? new Date(entry_date) : new Date();
            finalEnd = baseDate;
            finalStart = new Date(baseDate.getTime() - finalDurationMinutes * 60000);
        } else {
            return res.status(400).json({ success: false, message: "Please specify start time, end time, or duration in minutes." });
        }

        if (finalDurationMinutes <= 0) {
            return res.status(400).json({ success: false, message: "Duration must be greater than 0 minutes." });
        }

        await db.execute(`
            INSERT INTO task_time_entries (tenant_id, task_id, user_id, start_time, end_time, duration_minutes, is_billable, notes)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        `, [id, userId, finalStart, finalEnd, finalDurationMinutes, is_billable ? 1 : 0, notes]);

        // Update actual_hours on task
        await db.execute(`
            UPDATE tasks
            SET actual_hours = (
                SELECT COALESCE(SUM(duration_minutes) / 60.0, 0)
                FROM task_time_entries
                WHERE task_id = ?
            )
            WHERE id = ?
        `, [id, id]);

        // Sync project logged duration
        const [manualTaskRow] = await db.execute("SELECT project_id FROM tasks WHERE id = ?", [id]);
        if (manualTaskRow.length > 0 && manualTaskRow[0].project_id) {
            await syncProjectDurationAndCompletion(manualTaskRow[0].project_id);
        }

        res.status(201).json({
            success: true,
            message: `Logged ${finalDurationMinutes} minutes (${finalStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → ${finalEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`,
            data: {
                start_time: finalStart,
                end_time: finalEnd,
                duration_minutes: finalDurationMinutes
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Time Tracking: DELETE /api/tasks/time-entries/:id
exports.deleteTimeEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const [entryRows] = await db.execute("SELECT task_id FROM task_time_entries WHERE id = ?", [id]);
        if (entryRows.length === 0) {
            return res.status(404).json({ success: false, message: "Time entry not found." });
        }

        const taskId = entryRows[0].task_id;
        await db.execute("DELETE FROM task_time_entries WHERE id = ?", [id]);

        // Recalculate task actual_hours
        await db.execute(`
            UPDATE tasks
            SET actual_hours = (
                SELECT COALESCE(SUM(duration_minutes) / 60.0, 0)
                FROM task_time_entries
                WHERE task_id = ?
            )
            WHERE id = ?
        `, [taskId, taskId]);

        // Recalculate project total_logged_hours
        const [taskRow] = await db.execute("SELECT project_id FROM tasks WHERE id = ?", [taskId]);
        if (taskRow.length > 0 && taskRow[0].project_id) {
            await syncProjectDurationAndCompletion(taskRow[0].project_id);
        }

        res.json({ success: true, message: "Time entry removed successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/tasks/metadata - Dropdown options for projects, users, labels (scoped to company)
exports.getTaskMetadata = async (req, res) => {
    try {
        const tenantId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;
        const userId = req.user?.id || 1;
        const userRole = (req.user?.role || "").toLowerCase();
        const isAdmin = userRole === "admin" || userRole === "super admin" || userRole === "super_admin" || userRole === "developer";

        let projectsQuery = "SELECT id, name, code, status FROM projects WHERE deleted_at IS NULL AND tenant_id = ? AND company_id = ?";
        const projectsParams = [tenantId, companyId];
        if (!isAdmin) {
            projectsQuery += " AND (owner_id = ? OR sponsor_id = ? OR id IN (SELECT project_id FROM project_members WHERE user_id = ?) OR parent_project_id IN (SELECT project_id FROM project_members WHERE user_id = ?))";
            projectsParams.push(userId, userId, userId, userId);
        }
        projectsQuery += " ORDER BY name ASC";
        const [projects] = await db.execute(projectsQuery, projectsParams);
        const [users] = await db.execute(`
            SELECT 
                u.id, u.name, u.username, u.email, u.role, u.company_id, u.department_id,
                COALESCE(c.name, 'Default Company') as company_name,
                COALESCE(dept.department_name, 'General') as department_name
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            LEFT JOIN departments dept ON u.department_id = dept.id
            WHERE u.active = 1
            ORDER BY u.name ASC
        `);
        const [labels] = await db.execute("SELECT id, name, color FROM task_labels ORDER BY name ASC");
        const [companies] = await db.execute("SELECT id, name FROM companies ORDER BY name ASC");
        const [departments] = await db.execute("SELECT id, department_name FROM departments ORDER BY department_name ASC");

        res.status(200).json({
            success: true,
            data: {
                projects,
                users,
                labels,
                companies,
                departments,
                statuses: ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled', 'blocked'],
                priorities: ['low', 'medium', 'high', 'urgent']
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Saved Views: GET /api/tasks/saved-views & POST /api/tasks/saved-views
exports.getSavedViews = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1;
        const [views] = await db.execute(`
            SELECT * FROM task_saved_views
            WHERE user_id = ? OR is_shared = 1
            ORDER BY is_default DESC, name ASC
        `, [userId]);
        res.status(200).json({ success: true, data: views });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createSavedView = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1;
        const { name, view_type, filter_criteria, sort_criteria, is_shared = false } = req.body;

        const [result] = await db.execute(`
            INSERT INTO task_saved_views (tenant_id, user_id, name, view_type, filter_criteria, sort_criteria, is_shared)
            VALUES (1, ?, ?, ?, ?, ?, ?)
        `, [userId, name, view_type, JSON.stringify(filter_criteria || {}), JSON.stringify(sort_criteria || {}), is_shared ? 1 : 0]);

        res.status(201).json({ success: true, data: { id: result.insertId, name } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Templates: GET & POST /api/tasks/templates
exports.getTemplates = async (req, res) => {
    try {
        const [templates] = await db.execute("SELECT * FROM task_templates ORDER BY created_at DESC");
        res.status(200).json({ success: true, data: templates });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.createTemplate = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : 1;
        const { title, description, default_priority, estimated_hours, checklist_template } = req.body;

        const [result] = await db.execute(`
            INSERT INTO task_templates (tenant_id, title, description, default_priority, estimated_hours, checklist_template, created_by)
            VALUES (1, ?, ?, ?, ?, ?, ?)
        `, [title, description, default_priority || 'medium', estimated_hours || 0, JSON.stringify(checklist_template || []), userId]);

        res.status(201).json({ success: true, data: { id: result.insertId, title } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
