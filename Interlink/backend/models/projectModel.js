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

const createProjectTables = async () => {
    // 1. Projects Core Table (Extended)
    await db.execute(`
        CREATE TABLE IF NOT EXISTS projects (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            company_id INT NOT NULL DEFAULT 1,
            code VARCHAR(50) NOT NULL,
            name VARCHAR(150) NOT NULL,
            description LONGTEXT NULL,
            parent_project_id INT NULL,
            status ENUM('planning', 'active', 'on_hold', 'completed', 'archived', 'cancelled') DEFAULT 'planning',
            priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
            visibility ENUM('public', 'private', 'restricted') DEFAULT 'public',
            owner_id INT NOT NULL DEFAULT 1,
            sponsor_id INT NULL,
            start_date DATE NULL,
            end_date DATE NULL,
            baseline_start_date DATE NULL,
            baseline_end_date DATE NULL,
            currency VARCHAR(10) DEFAULT 'USD',
            estimated_budget DECIMAL(12,2) DEFAULT 0.00,
            approved_budget DECIMAL(12,2) DEFAULT 0.00,
            is_budget_approved BOOLEAN DEFAULT FALSE,
            actual_cost DECIMAL(12,2) DEFAULT 0.00,
            progress_percentage DECIMAL(5,2) DEFAULT 0.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP NULL,
            INDEX idx_tenant_status (tenant_id, status),
            INDEX idx_tenant_parent (tenant_id, parent_project_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure all modern columns exist on projects even if created previously
    await ensureColumn("projects", "company_id", "INT DEFAULT 1");
    await ensureColumn("projects", "parent_project_id", "INT NULL");
    await ensureColumn("projects", "priority", "ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium'");
    await ensureColumn("projects", "visibility", "ENUM('public', 'private', 'restricted') DEFAULT 'public'");
    await ensureColumn("projects", "owner_id", "INT NOT NULL DEFAULT 1");
    await ensureColumn("projects", "sponsor_id", "INT NULL");
    await ensureColumn("projects", "baseline_start_date", "DATE NULL");
    await ensureColumn("projects", "baseline_end_date", "DATE NULL");
    await ensureColumn("projects", "currency", "VARCHAR(10) DEFAULT 'USD'");
    await ensureColumn("projects", "estimated_budget", "DECIMAL(12,2) DEFAULT 0.00");
    await ensureColumn("projects", "approved_budget", "DECIMAL(12,2) DEFAULT 0.00");
    await ensureColumn("projects", "is_budget_approved", "BOOLEAN DEFAULT FALSE");
    await ensureColumn("projects", "actual_cost", "DECIMAL(12,2) DEFAULT 0.00");
    await ensureColumn("projects", "progress_percentage", "DECIMAL(5,2) DEFAULT 0.00");
    await ensureColumn("projects", "completed_at", "DATETIME NULL");
    await ensureColumn("projects", "actual_completion_duration_days", "DECIMAL(6,1) NULL");
    await ensureColumn("projects", "total_logged_hours", "DECIMAL(8,2) DEFAULT 0.00");
    await ensureColumn("projects", "deleted_at", "TIMESTAMP NULL");

    // 2. Project Members & Resource Allocation
    await db.execute(`
        CREATE TABLE IF NOT EXISTS project_members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_id INT NOT NULL,
            user_id INT NOT NULL,
            role ENUM('project_manager', 'tech_lead', 'contributor', 'reviewer', 'stakeholder') DEFAULT 'contributor',
            allocation_percentage INT DEFAULT 100,
            hourly_billing_rate DECIMAL(8,2) DEFAULT 0.00,
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_proj_user (project_id, user_id),
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Project Phases (Stage Gates)
    await db.execute(`
        CREATE TABLE IF NOT EXISTS project_phases (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            description TEXT NULL,
            sort_order INT DEFAULT 0,
            status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
            start_date DATE NULL,
            end_date DATE NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Project Milestones
    await db.execute(`
        CREATE TABLE IF NOT EXISTS project_milestones (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_id INT NOT NULL,
            phase_id INT NULL,
            title VARCHAR(150) NOT NULL,
            description TEXT NULL,
            due_date DATE NOT NULL,
            achieved_date DATE NULL,
            status ENUM('pending', 'achieved', 'delayed') DEFAULT 'pending',
            sort_order INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (phase_id) REFERENCES project_phases(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Project Deliverables
    await db.execute(`
        CREATE TABLE IF NOT EXISTS project_deliverables (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_id INT NOT NULL,
            milestone_id INT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT NULL,
            owner_id INT NOT NULL,
            due_date DATE NULL,
            status ENUM('draft', 'in_review', 'approved', 'rejected') DEFAULT 'draft',
            sign_off_by INT NULL,
            sign_off_at DATETIME NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (milestone_id) REFERENCES project_milestones(id) ON DELETE SET NULL,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
            FOREIGN KEY (sign_off_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Project Risks & Risk Register
    await db.execute(`
        CREATE TABLE IF NOT EXISTS project_risks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_id INT NOT NULL,
            title VARCHAR(200) NOT NULL,
            category ENUM('technical', 'financial', 'schedule', 'operational', 'resource', 'external') DEFAULT 'technical',
            probability INT NOT NULL DEFAULT 3,
            impact INT NOT NULL DEFAULT 3,
            severity_score INT DEFAULT 9,
            status ENUM('identified', 'monitoring', 'mitigating', 'closed') DEFAULT 'identified',
            owner_id INT NOT NULL,
            mitigation_plan TEXT NULL,
            contingency_plan TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Project Documents
    await db.execute(`
        CREATE TABLE IF NOT EXISTS project_documents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_id INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500) NOT NULL,
            file_size INT NOT NULL,
            mime_type VARCHAR(100) NOT NULL,
            category ENUM('brief', 'contract', 'architecture', 'report', 'meeting_notes', 'general') DEFAULT 'general',
            uploaded_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Project Baselines
    await db.execute(`
        CREATE TABLE IF NOT EXISTS project_baselines (
            id INT AUTO_INCREMENT PRIMARY KEY,
            project_id INT NOT NULL,
            name VARCHAR(100) NOT NULL,
            snapshot_data JSON NOT NULL,
            created_by INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Project Templates
    await db.execute(`
        CREATE TABLE IF NOT EXISTS project_templates (
            id INT AUTO_INCREMENT PRIMARY KEY,
            tenant_id INT NOT NULL DEFAULT 1,
            name VARCHAR(150) NOT NULL,
            description TEXT NULL,
            category VARCHAR(100) DEFAULT 'General',
            default_phases JSON NOT NULL,
            default_milestones JSON NOT NULL,
            default_tasks JSON NOT NULL,
            created_by INT NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Update tasks table for project phases and milestones
    await ensureColumn("tasks", "phase_id", "INT NULL");
    await ensureColumn("tasks", "milestone_id", "INT NULL");
    await ensureColumn("tasks", "baseline_start_date", "DATE NULL");
    await ensureColumn("tasks", "baseline_due_date", "DATE NULL");

    // Seed default blueprints & enterprise demo projects
    await seedProjectTemplatesAndDemos();

    console.log("Project Management database tables initialized successfully.");
};

const seedProjectTemplatesAndDemos = async () => {
    try {
        const [templates] = await db.execute("SELECT id FROM project_templates LIMIT 1");
        if (templates.length === 0) {
            const templatesData = [
                {
                    name: "Software Engineering & Agile Sprint",
                    description: "End-to-end SDLC template covering architecture, sprint execution, QA gate, and production launch.",
                    category: "Engineering",
                    phases: [
                        { name: "Requirements & Architecture", order: 1 },
                        { name: "Sprint Execution", order: 2 },
                        { name: "QA & Security Audit", order: 3 },
                        { name: "Production Deployment", order: 4 }
                    ],
                    milestones: [
                        { title: "Architecture RFC Sign-Off", phaseIndex: 0, daysFromStart: 10 },
                        { title: "Feature Freeze", phaseIndex: 1, daysFromStart: 35 },
                        { title: "Security Audit Pass", phaseIndex: 2, daysFromStart: 45 },
                        { title: "Production Go-Live", phaseIndex: 3, daysFromStart: 60 }
                    ],
                    tasks: [
                        { title: "Technical RFC & Database Schema Review", priority: "high", estHours: 16 },
                        { title: "Core REST API & Auth Verification", priority: "urgent", estHours: 32 },
                        { title: "Frontend Component Library Integration", priority: "medium", estHours: 24 },
                        { title: "Automated Integration Testing & E2E Suite", priority: "high", estHours: 20 },
                        { title: "Production Infrastructure & CDN Configuration", priority: "urgent", estHours: 12 }
                    ]
                },
                {
                    name: "Client Onboarding & Enterprise Deployment",
                    description: "Standardized customer deployment plan for multi-tenant enterprise provisioning and UAT.",
                    category: "Customer Success",
                    phases: [
                        { name: "Discovery & Scope", order: 1 },
                        { name: "Tenant Setup & SSO", order: 2 },
                        { name: "Data Migration & Customization", order: 3 },
                        { name: "User Training & Handover", order: 4 }
                    ],
                    milestones: [
                        { title: "Kickoff Meeting Completed", phaseIndex: 0, daysFromStart: 5 },
                        { title: "SSO & Security Approved", phaseIndex: 1, daysFromStart: 15 },
                        { title: "UAT Customer Acceptance", phaseIndex: 2, daysFromStart: 30 },
                        { title: "Executive Sign-Off & Launch", phaseIndex: 3, daysFromStart: 45 }
                    ],
                    tasks: [
                        { title: "Tenant Provisioning & SAML/OIDC SSO Setup", priority: "urgent", estHours: 8 },
                        { title: "Employee Directory Sync & Role Mapping", priority: "high", estHours: 12 },
                        { title: "Admin Portal Training & SLA Alignment", priority: "medium", estHours: 6 }
                    ]
                },
                {
                    name: "Marketing Campaign & Brand Launch",
                    description: "Cross-functional campaign roadmap for product release, content creation, and lead generation.",
                    category: "Marketing",
                    phases: [
                        { name: "Strategy & Positioning", order: 1 },
                        { name: "Asset Creation", order: 2 },
                        { name: "Multi-Channel Launch", order: 3 },
                        { name: "Post-Campaign Analytics", order: 4 }
                    ],
                    milestones: [
                        { title: "Brand Messaging Finalized", phaseIndex: 0, daysFromStart: 7 },
                        { title: "Collateral & Video Production Complete", phaseIndex: 1, daysFromStart: 21 },
                        { title: "Public Launch Day", phaseIndex: 2, daysFromStart: 30 },
                        { title: "Performance Review & ROI Report", phaseIndex: 3, daysFromStart: 45 }
                    ],
                    tasks: [
                        { title: "Landing Page Redesign & Copywriting", priority: "high", estHours: 16 },
                        { title: "Product Demo Video Production", priority: "medium", estHours: 24 },
                        { title: "PR Release & Social Campaign Scheduling", priority: "urgent", estHours: 10 }
                    ]
                }
            ];

            for (const tpl of templatesData) {
                await db.execute(`
                    INSERT INTO project_templates (tenant_id, name, description, category, default_phases, default_milestones, default_tasks, created_by)
                    VALUES (1, ?, ?, ?, ?, ?, ?, 1)
                `, [
                    tpl.name,
                    tpl.description,
                    tpl.category,
                    JSON.stringify(tpl.phases),
                    JSON.stringify(tpl.milestones),
                    JSON.stringify(tpl.tasks)
                ]);
            }
        }

        // Check if demo projects exist; if not, enrich or seed realistic projects
        const [users] = await db.execute("SELECT id FROM users LIMIT 2");
        const adminId = users.length > 0 ? users[0].id : 1;
        const sponsorId = users.length > 1 ? users[1].id : adminId;

        const [existingProjects] = await db.execute("SELECT id, code FROM projects WHERE parent_project_id IS NULL");
        if (existingProjects.length > 0) {
            // Update existing projects with rich attributes
            for (const p of existingProjects) {
                await db.execute(`
                    UPDATE projects SET 
                        owner_id = IFNULL(owner_id, ?),
                        sponsor_id = IFNULL(sponsor_id, ?),
                        priority = IFNULL(priority, 'high'),
                        visibility = IFNULL(visibility, 'public'),
                        currency = IFNULL(currency, 'USD'),
                        estimated_budget = IF(estimated_budget > 0, estimated_budget, 75000.00),
                        approved_budget = IF(approved_budget > 0, approved_budget, 75000.00),
                        is_budget_approved = TRUE,
                        actual_cost = IF(actual_cost > 0, actual_cost, 28450.00),
                        progress_percentage = IF(progress_percentage > 0, progress_percentage, 45.00),
                        baseline_start_date = IFNULL(baseline_start_date, start_date),
                        baseline_end_date = IFNULL(baseline_end_date, end_date)
                    WHERE id = ?
                `, [adminId, sponsorId, p.id]);

                // Ensure project member exists
                await db.execute(`
                    INSERT IGNORE INTO project_members (project_id, user_id, role, allocation_percentage, hourly_billing_rate)
                    VALUES (?, ?, 'project_manager', 100, 120.00)
                `, [p.id, adminId]);

                // Ensure demo phases exist
                const [phases] = await db.execute("SELECT id FROM project_phases WHERE project_id = ?", [p.id]);
                if (phases.length === 0) {
                    const [res1] = await db.execute(`
                        INSERT INTO project_phases (project_id, name, description, sort_order, status, start_date, end_date)
                        VALUES (?, 'Architecture & Specs', 'Foundational technical design', 1, 'completed', DATE_SUB(CURDATE(), INTERVAL 30 DAY), DATE_SUB(CURDATE(), INTERVAL 15 DAY))
                    `, [p.id]);
                    const [res2] = await db.execute(`
                        INSERT INTO project_phases (project_id, name, description, sort_order, status, start_date, end_date)
                        VALUES (?, 'Core Build & Execution', 'Active development of services and UI', 2, 'in_progress', DATE_SUB(CURDATE(), INTERVAL 14 DAY), DATE_ADD(CURDATE(), INTERVAL 20 DAY))
                    `, [p.id]);
                    const [res3] = await db.execute(`
                        INSERT INTO project_phases (project_id, name, description, sort_order, status, start_date, end_date)
                        VALUES (?, 'UAT & Deployment', 'User testing and production rollout', 3, 'pending', DATE_ADD(CURDATE(), INTERVAL 21 DAY), DATE_ADD(CURDATE(), INTERVAL 45 DAY))
                    `, [p.id]);

                    // Add Milestones
                    await db.execute(`
                        INSERT INTO project_milestones (project_id, phase_id, title, description, due_date, status, sort_order)
                        VALUES 
                        (?, ?, 'Architecture RFC Approval', 'Approved system design documents', DATE_SUB(CURDATE(), INTERVAL 15 DAY), 'achieved', 1),
                        (?, ?, 'Beta Feature Release', 'Core functionality working in staging', DATE_ADD(CURDATE(), INTERVAL 10 DAY), 'pending', 2),
                        (?, ?, 'Production Launch', 'Public rollout and stakeholder sign-off', DATE_ADD(CURDATE(), INTERVAL 45 DAY), 'pending', 3)
                    `, [p.id, res1.insertId, p.id, res2.insertId, p.id, res3.insertId]);

                    // Add Risks
                    await db.execute(`
                        INSERT INTO project_risks (project_id, title, category, probability, impact, severity_score, status, owner_id, mitigation_plan, contingency_plan)
                        VALUES 
                        (?, 'Third-party API rate limits during peak usage', 'technical', 3, 4, 12, 'monitoring', ?, 'Implement aggressive Redis caching and exponential backoff retry queues.', 'Failover to read-only replica.'),
                        (?, 'Scope creep on multi-level Gantt dependencies', 'schedule', 4, 3, 12, 'mitigating', ?, 'Strict sprint change request approval with PM sign-off.', 'Defer secondary filters to next milestone release.')
                    `, [p.id, adminId, p.id, adminId]);

                    // Add Sub-project demo
                    await db.execute(`
                        INSERT INTO projects (tenant_id, code, name, description, parent_project_id, status, priority, visibility, owner_id, sponsor_id, start_date, end_date, estimated_budget, approved_budget, is_budget_approved, actual_cost, progress_percentage)
                        VALUES (1, CONCAT(?, '-SUB1'), 'Mobile App SDK Workstream', 'Client SDK and mobile offline caching module', ?, 'active', 'high', 'public', ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 25000.00, 25000.00, TRUE, 8500.00, 35.00)
                    `, [p.code, p.id, adminId, sponsorId]);
                }
            }
        }
    } catch (err) {
        console.error("Error seeding project templates & demos:", err);
    }
};

module.exports = {
    createProjectTables
};
