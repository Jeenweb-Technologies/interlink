const db = require("../config/db.js");

/**
 * Universal Global Search across all records:
 * - Projects
 * - Tasks
 * - Users
 * - Documents
 * - User Types
 * - Audit Logs
 */
exports.searchAllRecords = async (req, res) => {
    try {
        const query = (req.query.q || req.query.query || "").trim();
        if (!query) {
            return res.status(200).json({
                success: true,
                query: "",
                total: 0,
                results: {
                    projects: [],
                    tasks: [],
                    notes: [],
                    users: [],
                    documents: [],
                    user_types: [],
                    audit_logs: []
                }
            });
        }

        const term = `%${query}%`;
        const userId = req.user?.id || 0;
        const userTypeId = req.user?.user_type_id || -1;
        const isPrivileged = req.user?.role === 'admin' || req.user?.role === 'super_admin' || req.user?.role === 'developer';

        // Run queries in parallel across all entity tables
        const [
            projectsRes,
            tasksRes,
            notesRes,
            usersRes,
            documentsRes,
            userTypesRes,
            auditLogsRes
        ] = await Promise.allSettled([
            // 1. Projects
            db.execute(
                `SELECT id, name AS title, code AS subtitle, description, status, priority, 'project' AS entity_type
                 FROM projects
                 WHERE name LIKE ? OR code LIKE ? OR description LIKE ? OR client_name LIKE ?
                 LIMIT 8`,
                [term, term, term, term]
            ),
            // 2. Tasks
            db.execute(
                `SELECT id, title, task_code AS subtitle, description, status, priority, project_id, 'task' AS entity_type
                 FROM tasks
                 WHERE title LIKE ? OR task_code LIKE ? OR description LIKE ?
                 LIMIT 8`,
                [term, term, term]
            ),
            // 3. Notes (Owned or Shared)
            db.execute(
                `SELECT 
                    n.id, 
                    n.title, 
                    CONCAT(COALESCE(n.priority, 'medium'), ' priority • v', n.version) AS subtitle, 
                    n.content AS description, 
                    n.priority, 
                    n.color, 
                    'note' AS entity_type
                 FROM notes n
                 LEFT JOIN note_shares ns ON n.id = ns.note_id AND (ns.user_id = ? OR (ns.user_type_id IS NOT NULL AND ns.user_type_id = ?))
                 WHERE n.deleted_at IS NULL
                   AND (n.owner_id = ? OR ns.id IS NOT NULL OR ? = 1)
                   AND (n.title LIKE ? OR n.content LIKE ?)
                 GROUP BY n.id
                 ORDER BY n.is_pinned DESC, n.updated_at DESC
                 LIMIT 8`,
                [userId, userTypeId, userId, isPrivileged ? 1 : 0, term, term]
            ),
            // 4. Users
            db.execute(
                `SELECT id, name AS title, CONCAT(COALESCE(role, 'Member'), ' • ', email) AS subtitle, email, role, 'user' AS entity_type
                 FROM users
                 WHERE name LIKE ? OR username LIKE ? OR email LIKE ? OR mob_no LIKE ?
                 LIMIT 8`,
                [term, term, term, term]
            ),
            // 5. Project Documents
            db.execute(
                `SELECT id, file_name AS title, CONCAT('Project #', project_id) AS subtitle, project_id, file_path, 'document' AS entity_type
                 FROM project_documents
                 WHERE file_name LIKE ?
                 LIMIT 8`,
                [term]
            ),
            // 6. User Types (Roles)
            db.execute(
                `SELECT id, type_name AS title, COALESCE(description, 'Role Permission Master') AS subtitle, 'user_type' AS entity_type
                 FROM user_types
                 WHERE type_name LIKE ? OR description LIKE ?
                 LIMIT 8`,
                [term, term]
            ),
            // 7. Audit Logs
            db.execute(
                `SELECT id, action AS title, CONCAT(master_name, ' • ', user_name) AS subtitle, master_name, user_name, created_at, 'audit_log' AS entity_type
                 FROM audit_logs
                 WHERE action LIKE ? OR master_name LIKE ? OR user_name LIKE ?
                 ORDER BY created_at DESC
                 LIMIT 8`,
                [term, term, term]
            )
        ]);

        const projects = projectsRes.status === "fulfilled" && projectsRes.value[0] ? projectsRes.value[0] : [];
        const tasks = tasksRes.status === "fulfilled" && tasksRes.value[0] ? tasksRes.value[0] : [];
        const notes = notesRes.status === "fulfilled" && notesRes.value[0] ? notesRes.value[0] : [];
        const users = usersRes.status === "fulfilled" && usersRes.value[0] ? usersRes.value[0] : [];
        const documents = documentsRes.status === "fulfilled" && documentsRes.value[0] ? documentsRes.value[0] : [];
        const userTypes = userTypesRes.status === "fulfilled" && userTypesRes.value[0] ? userTypesRes.value[0] : [];
        const auditLogs = auditLogsRes.status === "fulfilled" && auditLogsRes.value[0] ? auditLogsRes.value[0] : [];

        const total = projects.length + tasks.length + notes.length + users.length + documents.length + userTypes.length + auditLogs.length;

        return res.status(200).json({
            success: true,
            query,
            total,
            results: {
                projects,
                tasks,
                notes,
                users,
                documents,
                user_types: userTypes,
                audit_logs: auditLogs
            }
        });
    } catch (error) {
        console.error("Global search error:", error);
        return res.status(500).json({ success: false, message: "Search failed", error: error.message });
    }
};
