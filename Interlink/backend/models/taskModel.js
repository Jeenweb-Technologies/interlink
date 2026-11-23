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
        }
    } catch (err) {
        console.error(`Error ensuring column ${columnName} in ${tableName}:`, err.message);
    }
};

const createTaskTables = async () => {
    // 0. Projects table (if not exists) for project association
    await db.execute(`
        CREATE TABLE IF NOT EXISTS projects (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            name VARCHAR(150) NOT NULL,
            code VARCHAR(50) NOT NULL,
            description TEXT NULL,
            status ENUM('active', 'completed', 'on_hold') DEFAULT 'active',
            manager_id INT NULL,
            start_date DATE NULL,
            end_date DATE NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_tenant_status (tenant_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 1. Tasks Table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            task_code VARCHAR(32) NOT NULL,
            title VARCHAR(255) NOT NULL,
            description LONGTEXT NULL,
            status ENUM('backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled', 'blocked') DEFAULT 'todo',
            priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
            owner_id INT NOT NULL,
            assigned_team_id INT NULL,
            project_id INT NULL,
            ticket_id INT NULL,
            meeting_id INT NULL,
            document_id INT NULL,
            start_date DATETIME NULL,
            due_date DATETIME NULL,
            estimated_hours DECIMAL(6,2) DEFAULT 0.00,
            actual_hours DECIMAL(6,2) DEFAULT 0.00,
            completed_at DATETIME NULL,
            is_recurring BOOLEAN DEFAULT FALSE,
            recurrence_rule JSON NULL,
            parent_task_id INT NULL,
            sort_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP NULL,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
            FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            INDEX idx_tenant_status (tenant_id, status),
            INDEX idx_tenant_project (tenant_id, project_id),
            INDEX idx_tenant_due_date (tenant_id, due_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Task Assignees
    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_assignees (
            task_id INT NOT NULL,
            user_id INT NOT NULL,
            assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (task_id, user_id),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Task Watchers
    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_watchers (
            task_id INT NOT NULL,
            user_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (task_id, user_id),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Task Dependencies
    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_dependencies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            predecessor_id INT NOT NULL,
            successor_id INT NOT NULL,
            dependency_type ENUM('FS', 'SS', 'FF', 'SF') DEFAULT 'FS',
            lag_days INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_dep (predecessor_id, successor_id),
            FOREIGN KEY (predecessor_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (successor_id) REFERENCES tasks(id) ON DELETE CASCADE,
            INDEX idx_successor (successor_id),
            INDEX idx_predecessor (predecessor_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Universal Labels & Task Label Map
    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_labels (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            name VARCHAR(50) NOT NULL,
            color VARCHAR(20) DEFAULT '#2878C7',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_tenant_label (tenant_id, name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_labels_map (
            task_id INT NOT NULL,
            label_id INT NOT NULL,
            PRIMARY KEY (task_id, label_id),
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (label_id) REFERENCES task_labels(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Checklists / Subtasks
    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_checklists (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            is_completed BOOLEAN DEFAULT FALSE,
            sort_order INT DEFAULT 0,
            completed_by INT NULL,
            completed_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Attachments
    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_attachments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_size INT NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            uploaded_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Comments
    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            user_id INT NOT NULL,
            comment_text LONGTEXT NOT NULL,
            parent_comment_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
            FOREIGN KEY (parent_comment_id) REFERENCES task_comments(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Activity History / Audit Trail
    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_activities (
            id INT AUTO_INCREMENT PRIMARY KEY,
            task_id INT NOT NULL,
            user_id INT NULL,
            action VARCHAR(50) NOT NULL,
            old_value JSON NULL,
            new_value JSON NULL,
            description TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            INDEX idx_task_activity (task_id, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Time Entries (Stopwatch & Manual)
    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_time_entries (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            task_id INT NOT NULL,
            user_id INT NOT NULL,
            start_time DATETIME NOT NULL,
            end_time DATETIME NULL,
            duration_minutes INT NOT NULL DEFAULT 0,
            is_billable BOOLEAN DEFAULT TRUE,
            notes TEXT NULL,
            timesheet_id INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. Saved Views
    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_saved_views (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            user_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            view_type ENUM('list', 'kanban', 'calendar', 'timeline', 'gantt') NOT NULL,
            filter_criteria JSON NOT NULL,
            sort_criteria JSON NOT NULL,
            column_visibility JSON NULL,
            is_default BOOLEAN DEFAULT FALSE,
            is_shared BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. Task Templates & Automation Rules
    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_templates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            title VARCHAR(150) NOT NULL,
            description TEXT NULL,
            default_priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
            estimated_hours DECIMAL(6,2) DEFAULT 0.00,
            checklist_template JSON NULL,
            default_labels JSON NULL,
            created_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS task_automation_rules (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            name VARCHAR(150) NOT NULL,
            trigger_event ENUM('on_status_change', 'on_due_date_passed', 'on_task_created') NOT NULL,
            conditions JSON NOT NULL,
            actions JSON NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure project duration and task completion columns exist
    await ensureColumn("tasks", "company_id", "INT DEFAULT 1");
    await ensureColumn("tasks", "completed_at", "DATETIME NULL");
    await ensureColumn("projects", "completed_at", "DATETIME NULL");
    await ensureColumn("projects", "actual_completion_duration_days", "DECIMAL(6,1) NULL");
    await ensureColumn("projects", "total_logged_hours", "DECIMAL(8,2) DEFAULT 0.00");

    // Seed default labels and sample project if empty
    await seedInitialMetadata();

    console.log("Task Management database tables initialized successfully.");
};

const seedInitialMetadata = async () => {
    try {
        // Labels
        const [labels] = await db.execute("SELECT id FROM task_labels LIMIT 1");
        if (labels.length === 0) {
            const defaultLabels = [
                ['Frontend', '#2878C7'],
                ['Backend', '#17365D'],
                ['Bug', '#EF4444'],
                ['Urgent', '#DC2626'],
                ['Security', '#7C3AED'],
                ['Design', '#F59E0B'],
                ['DevOps', '#10B981']
            ];
            for (const [name, color] of defaultLabels) {
                await db.execute("INSERT IGNORE INTO task_labels (tenant_id, name, color) VALUES (1, ?, ?)", [name, color]);
            }
        }

        // Projects
        const [projects] = await db.execute("SELECT id FROM projects LIMIT 1");
        if (projects.length === 0) {
            await db.execute(`
                INSERT INTO projects (tenant_id, name, code, description, status, start_date, end_date)
                VALUES 
                (1, 'Interlink Core SaaS', 'PRJ-CORE', 'Enterprise collaboration platform build', 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 90 DAY)),
                (1, 'Mobile App Client v2', 'PRJ-MBL', 'Cross-platform native mobile applications', 'active', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 60 DAY))
            `);
        }

        // Check if sample tasks exist; if not, seed realistic sample tasks for rich initial experience
        const [tasks] = await db.execute("SELECT id FROM tasks LIMIT 1");
        if (tasks.length === 0) {
            const [users] = await db.execute("SELECT id FROM users LIMIT 1");
            const adminId = users.length > 0 ? users[0].id : 1;

            // Seed Task 1: Database Architecture
            const [t1] = await db.execute(`
                INSERT INTO tasks (tenant_id, task_code, title, description, status, priority, owner_id, project_id, start_date, due_date, estimated_hours)
                VALUES (1, 'TSK-1001', 'Database Architecture & Schema Design', 'Define normalized relational schema for enterprise task management, indexes and foreign keys.', 'done', 'high', ?, 1, DATE_SUB(NOW(), INTERVAL 4 DAY), DATE_SUB(NOW(), INTERVAL 1 DAY), 12.0)
            `, [adminId]);

            // Seed Task 2: Core Backend API (Depends on Task 1)
            const [t2] = await db.execute(`
                INSERT INTO tasks (tenant_id, task_code, title, description, status, priority, owner_id, project_id, start_date, due_date, estimated_hours)
                VALUES (1, 'TSK-1002', 'Build Task REST API & Controllers', 'Implement CRUD, bulk actions, and dependency auto-cascade scheduling algorithm.', 'in_progress', 'urgent', ?, 1, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 2 DAY), 16.0)
            `, [adminId]);

            // Seed Task 3: Interactive Gantt & Kanban Frontend (Blocked by Task 2)
            const [t3] = await db.execute(`
                INSERT INTO tasks (tenant_id, task_code, title, description, status, priority, owner_id, project_id, start_date, due_date, estimated_hours)
                VALUES (1, 'TSK-1003', 'Multi-View Task Workspace (Kanban & Gantt)', 'Implement dense table, drag-and-drop Kanban, timeline, and SVG Gantt chart with blocked work alert.', 'todo', 'high', ?, 1, DATE_ADD(NOW(), INTERVAL 2 DAY), DATE_ADD(NOW(), INTERVAL 6 DAY), 24.0)
            `, [adminId]);

            // Seed Task 4: Security Audit & RBAC verification
            const [t4] = await db.execute(`
                INSERT INTO tasks (tenant_id, task_code, title, description, status, priority, owner_id, project_id, start_date, due_date, estimated_hours)
                VALUES (1, 'TSK-1004', 'Security & RBAC Scope Verification', 'Verify access boundaries and guarantee users cannot view or edit tasks outside their scope.', 'todo', 'medium', ?, 1, DATE_ADD(NOW(), INTERVAL 6 DAY), DATE_ADD(NOW(), INTERVAL 8 DAY), 8.0)
            `, [adminId]);

            // Assign admin to tasks
            for (const tId of [t1.insertId, t2.insertId, t3.insertId, t4.insertId]) {
                await db.execute("INSERT IGNORE INTO task_assignees (task_id, user_id) VALUES (?, ?)", [tId, adminId]);
            }

            // Link dependency: TSK-1001 blocks TSK-1002, TSK-1002 blocks TSK-1003
            await db.execute(`
                INSERT INTO task_dependencies (tenant_id, predecessor_id, successor_id, dependency_type, lag_days)
                VALUES (1, ?, ?, 'FS', 0), (1, ?, ?, 'FS', 0)
            `, [t1.insertId, t2.insertId, t2.insertId, t3.insertId]);

            // Add sample checklists
            await db.execute(`
                INSERT INTO task_checklists (task_id, title, is_completed, sort_order)
                VALUES 
                (?, 'Design tables for tasks and dependencies', 1, 1),
                (?, 'Add indexes on tenant_id, status, and due_date', 1, 2),
                (?, 'Setup cascade rules on foreign keys', 1, 3)
            `, [t1.insertId, t1.insertId, t1.insertId]);

            await db.execute(`
                INSERT INTO task_checklists (task_id, title, is_completed, sort_order)
                VALUES 
                (?, 'Implement cycle detection in dependencies', 1, 1),
                (?, 'Auto-shift successor dates when predecessor shifts', 0, 2),
                (?, 'Add time tracking stopwatch endpoints', 0, 3)
            `, [t2.insertId, t2.insertId, t2.insertId]);

            // Add sample comments
            await db.execute(`
                INSERT INTO task_comments (task_id, user_id, comment_text)
                VALUES (?, ?, 'Schema design completed and validated against MySQL 8.x requirements.')
            `, [t1.insertId, adminId]);

            // Add sample activity
            await db.execute(`
                INSERT INTO task_activities (task_id, user_id, action, description)
                VALUES (?, ?, 'created', 'Task created via initial setup seeder.')
            `, [t1.insertId, adminId]);
        }
    } catch (e) {
        console.warn("Seeding initial task metadata notice:", e.message);
    }
};

module.exports = {
    createTaskTables,
    seedInitialMetadata
};
