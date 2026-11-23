const db = require("../config/db.js");
const path = require("path");
const fs = require("fs");
const uploadConfig = require("../config/uploadConfig.js");

// ─── 1. Portfolio Metrics (PROJ-01) ──────────────────────────────────────────
exports.getPortfolioMetrics = async (req, res) => {
    try {
        const tenantId = req.user?.organization_id || req.user?.tenant_id || 1;
        const companyId = req.user?.company_id || 1;

        // Base project counts
        const [counts] = await db.execute(`
            SELECT 
                COUNT(*) as total_projects,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_projects,
                SUM(CASE WHEN status = 'planning' THEN 1 ELSE 0 END) as planning_projects,
                SUM(CASE WHEN status = 'on_hold' THEN 1 ELSE 0 END) as on_hold_projects,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects,
                SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) as archived_projects,
                SUM(estimated_budget) as total_estimated_budget,
                SUM(approved_budget) as total_approved_budget,
                SUM(actual_cost) as total_actual_cost
            FROM projects 
            WHERE tenant_id = ? AND (company_id = ? OR company_id IS NULL) AND parent_project_id IS NULL AND deleted_at IS NULL
        `, [tenantId, companyId]);

        // Health distribution (On Track, At Risk, Delayed)
        const [projects] = await db.execute(`
            SELECT p.id, p.end_date, p.progress_percentage, p.approved_budget, p.actual_cost,
                   (SELECT COUNT(*) FROM project_risks r WHERE r.project_id = p.id AND r.severity_score >= 12 AND r.status != 'closed') as high_risks_count
            FROM projects p
            WHERE p.tenant_id = ? AND (p.company_id = ? OR p.company_id IS NULL) AND p.parent_project_id IS NULL AND p.deleted_at IS NULL AND p.status = 'active'
        `, [tenantId, companyId]);

        let onTrack = 0;
        let atRisk = 0;
        let delayed = 0;
        const today = new Date();

        projects.forEach(p => {
            const endDate = p.end_date ? new Date(p.end_date) : null;
            const isPastDue = endDate && endDate < today && Number(p.progress_percentage) < 100;
            const isBudgetOverrun = Number(p.approved_budget) > 0 && Number(p.actual_cost) > Number(p.approved_budget);
            const hasSevereRisks = Number(p.high_risks_count) > 0;

            if (isPastDue || isBudgetOverrun) {
                delayed++;
            } else if (hasSevereRisks || (endDate && (endDate - today) / (1000 * 3600 * 24) < 7 && Number(p.progress_percentage) < 75)) {
                atRisk++;
            } else {
                onTrack++;
            }
        });

        // Upcoming milestones in next 30 days
        const [upcomingMilestones] = await db.execute(`
            SELECT m.id, m.title, m.due_date, m.status, p.id as project_id, p.name as project_name, p.code as project_code
            FROM project_milestones m
            JOIN projects p ON m.project_id = p.id
            WHERE p.tenant_id = ? AND m.status != 'achieved' AND m.due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            ORDER BY m.due_date ASC
            LIMIT 5
        `, [tenantId]);

        res.json({
            success: true,
            data: {
                summary: counts[0] || {},
                health: {
                    onTrack,
                    atRisk,
                    delayed,
                    totalActive: projects.length
                },
                upcomingMilestones
            }
        });
    } catch (err) {
        console.error("Error fetching portfolio metrics:", err);
        res.status(500).json({ success: false, message: "Failed to load portfolio metrics" });
    }
};

// ─── 2. List Projects with Filters (PROJ-02) ─────────────────────────────────
exports.getProjects = async (req, res) => {
    try {
        const tenantId = req.user?.organization_id || req.user?.tenant_id || 1;
        const companyId = req.user?.company_id || 1;
        const { search, status, priority, owner_id, sponsor_id, visibility, include_subprojects } = req.query;

        let query = `
            SELECT p.*,
                   u_owner.name as owner_name, u_owner.email as owner_email,
                   u_sponsor.name as sponsor_name, u_sponsor.email as sponsor_email,
                   (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) as tasks_count,
                   (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done' AND t.deleted_at IS NULL) as completed_tasks_count,
                   (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as members_count,
                   (SELECT COUNT(*) FROM project_risks pr WHERE pr.project_id = p.id AND pr.status != 'closed') as open_risks_count,
                   (SELECT COUNT(*) FROM projects sub WHERE sub.parent_project_id = p.id AND sub.deleted_at IS NULL) as subprojects_count
            FROM projects p
            LEFT JOIN users u_owner ON p.owner_id = u_owner.id
            LEFT JOIN users u_sponsor ON p.sponsor_id = u_sponsor.id
            WHERE p.tenant_id = ? AND (p.company_id = ? OR p.company_id IS NULL) AND p.deleted_at IS NULL
        `;

        const params = [tenantId, companyId];

        // By default show top-level projects unless user requests subprojects explicitly
        if (include_subprojects !== 'true') {
            query += " AND p.parent_project_id IS NULL";
        }

        if (status) {
            query += " AND p.status = ?";
            params.push(status);
        }

        if (priority) {
            query += " AND p.priority = ?";
            params.push(priority);
        }

        if (owner_id) {
            query += " AND p.owner_id = ?";
            params.push(owner_id);
        }

        if (sponsor_id) {
            query += " AND p.sponsor_id = ?";
            params.push(sponsor_id);
        }

        if (visibility) {
            query += " AND p.visibility = ?";
            params.push(visibility);
        }

        if (search && search.trim()) {
            query += " AND (p.name LIKE ? OR p.code LIKE ? OR p.description LIKE ?)";
            const term = `%${search.trim()}%`;
            params.push(term, term, term);
        }

        query += " ORDER BY p.created_at DESC";

        const [rows] = await db.execute(query, params);

        res.json({
            success: true,
            data: rows
        });
    } catch (err) {
        console.error("Error fetching projects:", err);
        res.status(500).json({ success: false, message: "Failed to load projects" });
    }
};

// ─── 3. Get Project Workspace Detail (PROJ-04) ───────────────────────────────
exports.getProjectById = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id || 1;

        const [rows] = await db.execute(`
            SELECT p.*,
                   u_owner.name as owner_name, u_owner.email as owner_email,
                   u_sponsor.name as sponsor_name, u_sponsor.email as sponsor_email,
                   parent.name as parent_project_name, parent.code as parent_project_code
            FROM projects p
            LEFT JOIN users u_owner ON p.owner_id = u_owner.id
            LEFT JOIN users u_sponsor ON p.sponsor_id = u_sponsor.id
            LEFT JOIN projects parent ON p.parent_project_id = parent.id
            WHERE p.id = ? AND p.tenant_id = ? AND p.deleted_at IS NULL
        `, [id, tenantId]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }

        const project = rows[0];

        // Fetch Members
        const [members] = await db.execute(`
            SELECT pm.id as membership_id, pm.role, pm.allocation_percentage, pm.hourly_billing_rate, pm.joined_at,
                   u.id, u.name, u.email, u.role as system_role
            FROM project_members pm
            JOIN users u ON pm.user_id = u.id
            WHERE pm.project_id = ?
            ORDER BY pm.role ASC, u.name ASC
        `, [id]);

        // Fetch Phases & Milestones
        const [phases] = await db.execute(`
            SELECT * FROM project_phases WHERE project_id = ? ORDER BY sort_order ASC, id ASC
        `, [id]);

        const [milestones] = await db.execute(`
            SELECT m.*, p.name as phase_name 
            FROM project_milestones m
            LEFT JOIN project_phases p ON m.phase_id = p.id
            WHERE m.project_id = ?
            ORDER BY m.due_date ASC, m.sort_order ASC
        `, [id]);

        // Fetch Counts
        const [counts] = await db.execute(`
            SELECT 
                (SELECT COUNT(*) FROM tasks WHERE project_id = ? AND deleted_at IS NULL) as total_tasks,
                (SELECT COUNT(*) FROM tasks WHERE project_id = ? AND status = 'done' AND deleted_at IS NULL) as completed_tasks,
                (SELECT COUNT(*) FROM project_risks WHERE project_id = ? AND status != 'closed') as open_risks,
                (SELECT COUNT(*) FROM project_documents WHERE project_id = ?) as total_documents,
                (SELECT COUNT(*) FROM projects WHERE parent_project_id = ? AND deleted_at IS NULL) as subprojects_count
        `, [id, id, id, id, id]);

        // Calculate dynamic task completion %
        const taskCounts = counts[0] || {};
        let calculatedProgress = Number(project.progress_percentage) || 0;
        if (taskCounts.total_tasks > 0) {
            calculatedProgress = Math.round((taskCounts.completed_tasks / taskCounts.total_tasks) * 100);
        }

        res.json({
            success: true,
            data: {
                ...project,
                calculatedProgress,
                members,
                phases,
                milestones,
                metrics: taskCounts
            }
        });
    } catch (err) {
        console.error("Error fetching project by ID:", err);
        res.status(500).json({ success: false, message: "Failed to load project details" });
    }
};

// ─── 4. Create Project (PROJ-03) ─────────────────────────────────────────────
exports.createProject = async (req, res) => {
    try {
        const tenantId = req.user?.organization_id || req.user?.tenant_id || 1;
        const companyId = req.user?.company_id || 1;
        const userId = req.user?.id || 1;
        const {
            name,
            code,
            description,
            parent_project_id,
            status = 'planning',
            priority = 'medium',
            visibility = 'public',
            owner_id,
            sponsor_id,
            start_date,
            end_date,
            currency = 'USD',
            estimated_budget = 0,
            approved_budget = 0,
            is_budget_approved = false,
            members = [],
            phases = []
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Project name is required" });
        }

        // Auto-generate project code if not provided
        let projectCode = code ? code.trim().toUpperCase() : null;
        if (!projectCode) {
            const cleanName = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
            const randomSuffix = Math.floor(100 + Math.random() * 900);
            projectCode = `PRJ-${cleanName}-${randomSuffix}`;
        }

        const projectOwnerId = owner_id || userId;

        const [result] = await db.execute(`
            INSERT INTO projects (
                tenant_id, company_id, code, name, description, parent_project_id, status, priority, visibility,
                owner_id, sponsor_id, start_date, end_date, baseline_start_date, baseline_end_date,
                currency, estimated_budget, approved_budget, is_budget_approved, actual_cost, progress_percentage
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0.00, 0.00)
        `, [
            tenantId,
            companyId,
            projectCode,
            name.trim(),
            description || null,
            parent_project_id || null,
            status,
            priority,
            visibility,
            projectOwnerId,
            sponsor_id || null,
            start_date || null,
            end_date || null,
            start_date || null,
            end_date || null,
            currency,
            estimated_budget || 0,
            approved_budget || 0,
            is_budget_approved ? 1 : 0
        ]);

        const newProjectId = result.insertId;

        // Automatically assign owner as project manager member
        await db.execute(`
            INSERT IGNORE INTO project_members (project_id, user_id, role, allocation_percentage)
            VALUES (?, ?, 'project_manager', 100)
        `, [newProjectId, projectOwnerId]);

        // Add additional team members
        if (Array.isArray(members) && members.length > 0) {
            for (const m of members) {
                const uId = typeof m === 'object' ? m.user_id : m;
                const role = (typeof m === 'object' && m.role) ? m.role : 'contributor';
                const alloc = (typeof m === 'object' && m.allocation_percentage) ? m.allocation_percentage : 100;
                if (uId && uId !== projectOwnerId) {
                    await db.execute(`
                        INSERT IGNORE INTO project_members (project_id, user_id, role, allocation_percentage)
                        VALUES (?, ?, ?, ?)
                    `, [newProjectId, uId, role, alloc]);
                }
            }
        }

        // Add initial phases if specified
        if (Array.isArray(phases) && phases.length > 0) {
            for (let i = 0; i < phases.length; i++) {
                const p = phases[i];
                await db.execute(`
                    INSERT INTO project_phases (project_id, name, description, sort_order, status, start_date, end_date)
                    VALUES (?, ?, ?, ?, 'pending', ?, ?)
                `, [newProjectId, p.name, p.description || null, i + 1, p.start_date || null, p.end_date || null]);
            }
        }

        res.status(201).json({
            success: true,
            message: "Project created successfully",
            data: { id: newProjectId, code: projectCode, name }
        });
    } catch (err) {
        console.error("Error creating project:", err);
        res.status(500).json({ success: false, message: err.message || "Failed to create project" });
    }
};

// ─── 5. Update Project ───────────────────────────────────────────────────────
exports.updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id || 1;

        const {
            name,
            code,
            description,
            status,
            priority,
            visibility,
            owner_id,
            sponsor_id,
            start_date,
            end_date,
            currency,
            estimated_budget,
            approved_budget,
            is_budget_approved,
            actual_cost,
            progress_percentage
        } = req.body;

        const updates = [];
        const params = [];

        if (name !== undefined) { updates.push("name = ?"); params.push(name.trim()); }
        if (code !== undefined) { updates.push("code = ?"); params.push(code.trim().toUpperCase()); }
        if (description !== undefined) { updates.push("description = ?"); params.push(description); }
        if (status !== undefined) { updates.push("status = ?"); params.push(status); }
        if (priority !== undefined) { updates.push("priority = ?"); params.push(priority); }
        if (visibility !== undefined) { updates.push("visibility = ?"); params.push(visibility); }
        if (owner_id !== undefined) { updates.push("owner_id = ?"); params.push(owner_id); }
        if (sponsor_id !== undefined) { updates.push("sponsor_id = ?"); params.push(sponsor_id || null); }
        if (start_date !== undefined) { updates.push("start_date = ?"); params.push(start_date || null); }
        if (end_date !== undefined) { updates.push("end_date = ?"); params.push(end_date || null); }
        if (currency !== undefined) { updates.push("currency = ?"); params.push(currency); }
        if (estimated_budget !== undefined) { updates.push("estimated_budget = ?"); params.push(estimated_budget); }
        if (approved_budget !== undefined) { updates.push("approved_budget = ?"); params.push(approved_budget); }
        if (is_budget_approved !== undefined) { updates.push("is_budget_approved = ?"); params.push(is_budget_approved ? 1 : 0); }
        if (actual_cost !== undefined) { updates.push("actual_cost = ?"); params.push(actual_cost); }
        if (progress_percentage !== undefined) { updates.push("progress_percentage = ?"); params.push(progress_percentage); }
        if (status === 'completed') {
            updates.push("completed_at = COALESCE(completed_at, NOW())");
            updates.push("actual_completion_duration_days = COALESCE(actual_completion_duration_days, DATEDIFF(COALESCE(completed_at, NOW()), COALESCE(start_date, created_at)))");
            updates.push("total_logged_hours = (SELECT COALESCE(SUM(actual_hours), 0) FROM tasks WHERE project_id = ? AND deleted_at IS NULL)");
            params.push(id);
        }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: "No valid fields to update" });
        }

        params.push(id, tenantId);

        await db.execute(`
            UPDATE projects SET ${updates.join(", ")} WHERE id = ? AND tenant_id = ?
        `, params);

        res.json({
            success: true,
            message: "Project updated successfully"
        });
    } catch (err) {
        console.error("Error updating project:", err);
        res.status(500).json({ success: false, message: "Failed to update project" });
    }
};

// ─── 6. Delete or Archive Project ───────────────────────────────────────────
exports.deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id || 1;
        const { archive } = req.query;

        if (archive === 'true') {
            await db.execute(`UPDATE projects SET status = 'archived' WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
            return res.json({ success: true, message: "Project archived successfully" });
        }

        // Soft delete project
        await db.execute(`UPDATE projects SET deleted_at = NOW() WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
        res.json({ success: true, message: "Project deleted successfully" });
    } catch (err) {
        console.error("Error deleting project:", err);
        res.status(500).json({ success: false, message: "Failed to delete project" });
    }
};

// ─── 7. Project Templates & Cloning ─────────────────────────────────────────
exports.getTemplates = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || 1;
        const [templates] = await db.execute(`
            SELECT * FROM project_templates WHERE tenant_id = ? ORDER BY id ASC
        `, [tenantId]);

        res.json({ success: true, data: templates });
    } catch (err) {
        console.error("Error fetching templates:", err);
        res.status(500).json({ success: false, message: "Failed to load project templates" });
    }
};

exports.createProjectFromTemplate = async (req, res) => {
    try {
        const tenantId = req.user?.tenant_id || 1;
        const userId = req.user?.id || 1;
        const { template_id, name, code, start_date, end_date, owner_id, sponsor_id, estimated_budget } = req.body;

        const [templates] = await db.execute("SELECT * FROM project_templates WHERE id = ? AND tenant_id = ?", [template_id, tenantId]);
        if (templates.length === 0) {
            return res.status(404).json({ success: false, message: "Template not found" });
        }

        const tpl = templates[0];
        const phases = typeof tpl.default_phases === 'string' ? JSON.parse(tpl.default_phases) : tpl.default_phases;
        const milestones = typeof tpl.default_milestones === 'string' ? JSON.parse(tpl.default_milestones) : tpl.default_milestones;
        const tasks = typeof tpl.default_tasks === 'string' ? JSON.parse(tpl.default_tasks) : tpl.default_tasks;

        // Auto code
        const projectCode = code ? code.trim().toUpperCase() : `PRJ-${Math.floor(1000 + Math.random() * 9000)}`;

        const [resProj] = await db.execute(`
            INSERT INTO projects (
                tenant_id, code, name, description, status, priority, visibility, owner_id, sponsor_id,
                start_date, end_date, estimated_budget, approved_budget, is_budget_approved
            ) VALUES (?, ?, ?, ?, 'planning', 'high', 'public', ?, ?, ?, ?, ?, ?, TRUE)
        `, [
            tenantId, projectCode, name, tpl.description, owner_id || userId, sponsor_id || null,
            start_date || new Date().toISOString().slice(0, 10),
            end_date || null,
            estimated_budget || 50000,
            estimated_budget || 50000
        ]);

        const newProjectId = resProj.insertId;

        // Add owner as member
        await db.execute(`
            INSERT IGNORE INTO project_members (project_id, user_id, role, allocation_percentage)
            VALUES (?, ?, 'project_manager', 100)
        `, [newProjectId, owner_id || userId]);

        // Insert Phases & track IDs
        const phaseIdMap = {};
        if (Array.isArray(phases)) {
            for (let i = 0; i < phases.length; i++) {
                const p = phases[i];
                const [rPhase] = await db.execute(`
                    INSERT INTO project_phases (project_id, name, sort_order, status)
                    VALUES (?, ?, ?, 'pending')
                `, [newProjectId, p.name, p.order || i + 1]);
                phaseIdMap[i] = rPhase.insertId;
            }
        }

        // Insert Milestones
        if (Array.isArray(milestones)) {
            for (let i = 0; i < milestones.length; i++) {
                const m = milestones[i];
                const targetPhaseId = phaseIdMap[m.phaseIndex] || null;
                const d = new Date(start_date || new Date());
                d.setDate(d.getDate() + (m.daysFromStart || 14));
                await db.execute(`
                    INSERT INTO project_milestones (project_id, phase_id, title, due_date, status, sort_order)
                    VALUES (?, ?, ?, ?, 'pending', ?)
                `, [newProjectId, targetPhaseId, m.title, d.toISOString().slice(0, 10), i + 1]);
            }
        }

        // Insert Starter Tasks
        if (Array.isArray(tasks)) {
            for (let i = 0; i < tasks.length; i++) {
                const t = tasks[i];
                const tCode = `TSK-${Math.floor(1000 + Math.random() * 9000)}`;
                await db.execute(`
                    INSERT INTO tasks (
                        tenant_id, task_code, title, priority, status, owner_id, project_id, estimated_hours
                    ) VALUES (1, ?, ?, ?, 'todo', ?, ?, ?)
                `, [tCode, t.title, t.priority || 'medium', owner_id || userId, newProjectId, t.estHours || 8.0]);
            }
        }

        res.status(201).json({
            success: true,
            message: `Project created from template "${tpl.name}"`,
            data: { id: newProjectId, code: projectCode }
        });
    } catch (err) {
        console.error("Error creating project from template:", err);
        res.status(500).json({ success: false, message: "Failed to instantiate project from template" });
    }
};

// ─── 8. Sub-projects Hierarchy (PROJ-05) ────────────────────────────────────
exports.getSubprojects = async (req, res) => {
    try {
        const { id } = req.params;
        const tenantId = req.user?.tenant_id || 1;

        const [rows] = await db.execute(`
            SELECT p.*,
                   u.name as owner_name, u.email as owner_email,
                   (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.deleted_at IS NULL) as tasks_count,
                   (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'done' AND t.deleted_at IS NULL) as completed_tasks_count
            FROM projects p
            LEFT JOIN users u ON p.owner_id = u.id
            WHERE p.parent_project_id = ? AND p.tenant_id = ? AND p.deleted_at IS NULL
            ORDER BY p.created_at ASC
        `, [id, tenantId]);

        res.json({ success: true, data: rows });
    } catch (err) {
        console.error("Error fetching subprojects:", err);
        res.status(500).json({ success: false, message: "Failed to load sub-projects" });
    }
};

// ─── 9. Project Members & Roles ──────────────────────────────────────────────
exports.getMembers = async (req, res) => {
    try {
        const { id } = req.params;
        const [members] = await db.execute(`
            SELECT pm.id, pm.role, pm.allocation_percentage, pm.hourly_billing_rate, pm.joined_at,
                   u.id as user_id, u.name, u.email
            FROM project_members pm
            JOIN users u ON pm.user_id = u.id
            WHERE pm.project_id = ?
            ORDER BY pm.role ASC, u.name ASC
        `, [id]);

        res.json({ success: true, data: members });
    } catch (err) {
        console.error("Error fetching project members:", err);
        res.status(500).json({ success: false, message: "Failed to load members" });
    }
};

exports.addMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { user_id, role = 'contributor', allocation_percentage = 100, hourly_billing_rate = 0 } = req.body;

        if (!user_id) {
            return res.status(400).json({ success: false, message: "User ID is required" });
        }

        await db.execute(`
            INSERT INTO project_members (project_id, user_id, role, allocation_percentage, hourly_billing_rate)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                role = VALUES(role),
                allocation_percentage = VALUES(allocation_percentage),
                hourly_billing_rate = VALUES(hourly_billing_rate)
        `, [id, user_id, role, allocation_percentage, hourly_billing_rate]);

        res.json({ success: true, message: "Team member updated successfully" });
    } catch (err) {
        console.error("Error adding project member:", err);
        res.status(500).json({ success: false, message: "Failed to add member" });
    }
};

exports.removeMember = async (req, res) => {
    try {
        const { id, userId } = req.params;
        await db.execute("DELETE FROM project_members WHERE project_id = ? AND user_id = ?", [id, userId]);
        res.json({ success: true, message: "Member removed from project" });
    } catch (err) {
        console.error("Error removing member:", err);
        res.status(500).json({ success: false, message: "Failed to remove member" });
    }
};

// ─── 10. Phases & Milestones ────────────────────────────────────────────────
exports.getPhases = async (req, res) => {
    try {
        const { id } = req.params;
        const [phases] = await db.execute(`
            SELECT p.*,
                   (SELECT COUNT(*) FROM project_milestones m WHERE m.phase_id = p.id) as milestones_count,
                   (SELECT COUNT(*) FROM tasks t WHERE t.phase_id = p.id AND t.deleted_at IS NULL) as tasks_count
            FROM project_phases p
            WHERE p.project_id = ?
            ORDER BY p.sort_order ASC, p.id ASC
        `, [id]);

        res.json({ success: true, data: phases });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to load phases" });
    }
};

exports.createPhase = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, start_date, end_date, sort_order } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: "Phase name is required" });
        }

        const [result] = await db.execute(`
            INSERT INTO project_phases (project_id, name, description, start_date, end_date, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, name.trim(), description || null, start_date || null, end_date || null, sort_order || 0]);

        res.status(201).json({ success: true, message: "Phase created", data: { id: result.insertId } });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to create phase" });
    }
};

exports.updatePhase = async (req, res) => {
    try {
        const { phaseId } = req.params;
        const { name, description, status, start_date, end_date, sort_order } = req.body;

        await db.execute(`
            UPDATE project_phases SET
                name = IFNULL(?, name),
                description = IFNULL(?, description),
                status = IFNULL(?, status),
                start_date = IFNULL(?, start_date),
                end_date = IFNULL(?, end_date),
                sort_order = IFNULL(?, sort_order)
            WHERE id = ?
        `, [name, description, status, start_date, end_date, sort_order, phaseId]);

        res.json({ success: true, message: "Phase updated" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update phase" });
    }
};

exports.deletePhase = async (req, res) => {
    try {
        const { phaseId } = req.params;
        await db.execute("DELETE FROM project_phases WHERE id = ?", [phaseId]);
        res.json({ success: true, message: "Phase deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to delete phase" });
    }
};

// ─── 11. Milestones & Deliverables ──────────────────────────────────────────
exports.getMilestones = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.execute(`
            SELECT m.*, p.name as phase_name,
                   (SELECT COUNT(*) FROM project_deliverables d WHERE d.milestone_id = m.id) as deliverables_count,
                   (SELECT COUNT(*) FROM project_deliverables d WHERE d.milestone_id = m.id AND d.status = 'approved') as approved_deliverables_count
            FROM project_milestones m
            LEFT JOIN project_phases p ON m.phase_id = p.id
            WHERE m.project_id = ?
            ORDER BY m.due_date ASC, m.sort_order ASC
        `, [id]);

        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to load milestones" });
    }
};

exports.createMilestone = async (req, res) => {
    try {
        const { id } = req.params;
        const { phase_id, title, description, due_date, sort_order } = req.body;

        if (!title || !due_date) {
            return res.status(400).json({ success: false, message: "Title and target due date are required" });
        }

        const [result] = await db.execute(`
            INSERT INTO project_milestones (project_id, phase_id, title, description, due_date, sort_order)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, phase_id || null, title.trim(), description || null, due_date, sort_order || 0]);

        res.status(201).json({ success: true, message: "Milestone created", data: { id: result.insertId } });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to create milestone" });
    }
};

exports.updateMilestone = async (req, res) => {
    try {
        const { milestoneId } = req.params;
        const { title, description, due_date, achieved_date, status, phase_id } = req.body;

        await db.execute(`
            UPDATE project_milestones SET
                title = IFNULL(?, title),
                description = IFNULL(?, description),
                due_date = IFNULL(?, due_date),
                achieved_date = IFNULL(?, achieved_date),
                status = IFNULL(?, status),
                phase_id = IFNULL(?, phase_id)
            WHERE id = ?
        `, [title, description, due_date, achieved_date, status, phase_id, milestoneId]);

        res.json({ success: true, message: "Milestone updated" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update milestone" });
    }
};

exports.deleteMilestone = async (req, res) => {
    try {
        const { milestoneId } = req.params;
        await db.execute("DELETE FROM project_milestones WHERE id = ?", [milestoneId]);
        res.json({ success: true, message: "Milestone deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to delete milestone" });
    }
};

// ─── 12. Project Risks (5x5 Matrix) ─────────────────────────────────────────
exports.getRisks = async (req, res) => {
    try {
        const { id } = req.params;
        const [risks] = await db.execute(`
            SELECT r.*, u.name as owner_name, u.email as owner_email
            FROM project_risks r
            LEFT JOIN users u ON r.owner_id = u.id
            WHERE r.project_id = ?
            ORDER BY r.severity_score DESC, r.created_at DESC
        `, [id]);

        // Calculate 5x5 heatmap distribution
        const matrix = {};
        for (let p = 1; p <= 5; p++) {
            matrix[p] = {};
            for (let i = 1; i <= 5; i++) {
                matrix[p][i] = [];
            }
        }

        risks.forEach(r => {
            const prob = Math.min(Math.max(r.probability, 1), 5);
            const imp = Math.min(Math.max(r.impact, 1), 5);
            matrix[prob][imp].push(r);
        });

        res.json({
            success: true,
            data: {
                risks,
                matrix
            }
        });
    } catch (err) {
        console.error("Error fetching risks:", err);
        res.status(500).json({ success: false, message: "Failed to load risks" });
    }
};

exports.createRisk = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 1;
        const { title, category = 'technical', probability = 3, impact = 3, status = 'identified', owner_id, mitigation_plan, contingency_plan } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: "Risk title is required" });
        }

        const prob = Math.min(Math.max(Number(probability), 1), 5);
        const imp = Math.min(Math.max(Number(impact), 1), 5);
        const score = prob * imp;

        const [resRisk] = await db.execute(`
            INSERT INTO project_risks (
                project_id, title, category, probability, impact, severity_score, status, owner_id, mitigation_plan, contingency_plan
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id, title.trim(), category, prob, imp, score, status, owner_id || userId, mitigation_plan || null, contingency_plan || null
        ]);

        res.status(201).json({ success: true, message: "Risk logged", data: { id: resRisk.insertId } });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to create risk" });
    }
};

exports.updateRisk = async (req, res) => {
    try {
        const { riskId } = req.params;
        const { title, category, probability, impact, status, owner_id, mitigation_plan, contingency_plan } = req.body;

        let score = null;
        if (probability && impact) {
            score = Number(probability) * Number(impact);
        }

        await db.execute(`
            UPDATE project_risks SET
                title = IFNULL(?, title),
                category = IFNULL(?, category),
                probability = IFNULL(?, probability),
                impact = IFNULL(?, impact),
                severity_score = IFNULL(?, severity_score),
                status = IFNULL(?, status),
                owner_id = IFNULL(?, owner_id),
                mitigation_plan = IFNULL(?, mitigation_plan),
                contingency_plan = IFNULL(?, contingency_plan)
            WHERE id = ?
        `, [title, category, probability, impact, score, status, owner_id, mitigation_plan, contingency_plan, riskId]);

        res.json({ success: true, message: "Risk updated" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to update risk" });
    }
};

exports.deleteRisk = async (req, res) => {
    try {
        const { riskId } = req.params;
        await db.execute("DELETE FROM project_risks WHERE id = ?", [riskId]);
        res.json({ success: true, message: "Risk deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to delete risk" });
    }
};

// ─── 13. Project Gantt with Baselines (PROJ-06) ──────────────────────────────
exports.getGanttData = async (req, res) => {
    try {
        const { id } = req.params;

        const [projectRows] = await db.execute("SELECT * FROM projects WHERE id = ?", [id]);
        if (projectRows.length === 0) {
            return res.status(404).json({ success: false, message: "Project not found" });
        }
        const project = projectRows[0];

        const [phases] = await db.execute("SELECT * FROM project_phases WHERE project_id = ? ORDER BY sort_order ASC", [id]);
        const [milestones] = await db.execute("SELECT * FROM project_milestones WHERE project_id = ? ORDER BY due_date ASC", [id]);
        
        // Fetch tasks with dependencies
        const [tasks] = await db.execute(`
            SELECT t.*, u.name as owner_name,
                   GROUP_CONCAT(td.predecessor_id) as predecessor_ids
            FROM tasks t
            LEFT JOIN users u ON t.owner_id = u.id
            LEFT JOIN task_dependencies td ON t.id = td.successor_id
            WHERE t.project_id = ? AND t.deleted_at IS NULL
            GROUP BY t.id
            ORDER BY t.start_date ASC, t.id ASC
        `, [id]);

        res.json({
            success: true,
            data: {
                project,
                phases,
                milestones,
                tasks
            }
        });
    } catch (err) {
        console.error("Error fetching project Gantt data:", err);
        res.status(500).json({ success: false, message: "Failed to load Gantt data" });
    }
};

exports.createBaselineSnapshot = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 1;
        const { name = 'Approved Baseline Plan' } = req.body;

        const [phases] = await db.execute("SELECT id, start_date, end_date FROM project_phases WHERE project_id = ?", [id]);
        const [milestones] = await db.execute("SELECT id, due_date FROM project_milestones WHERE project_id = ?", [id]);
        const [tasks] = await db.execute("SELECT id, start_date, due_date FROM tasks WHERE project_id = ? AND deleted_at IS NULL", [id]);

        const snapshot = {
            timestamp: new Date().toISOString(),
            phases,
            milestones,
            tasks
        };

        await db.execute(`
            INSERT INTO project_baselines (project_id, name, snapshot_data, created_by)
            VALUES (?, ?, ?, ?)
        `, [id, name, JSON.stringify(snapshot), userId]);

        // Copy dates to baseline fields
        const [proj] = await db.execute("SELECT start_date, end_date FROM projects WHERE id = ?", [id]);
        if (proj.length > 0) {
            await db.execute(`
                UPDATE projects SET baseline_start_date = ?, baseline_end_date = ? WHERE id = ?
            `, [proj[0].start_date, proj[0].end_date, id]);
        }

        res.json({ success: true, message: "Schedule baseline snapshot frozen successfully." });
    } catch (err) {
        console.error("Error creating baseline:", err);
        res.status(500).json({ success: false, message: "Failed to snapshot baseline" });
    }
};

// ─── 14. Project Workload & Capacity Planning ────────────────────────────────
exports.getWorkload = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch team members
        const [members] = await db.execute(`
            SELECT pm.user_id, pm.role, pm.allocation_percentage,
                   u.name, u.email
            FROM project_members pm
            JOIN users u ON pm.user_id = u.id
            WHERE pm.project_id = ?
        `, [id]);

        // Fetch assigned task hours per user
        const [taskHours] = await db.execute(`
            SELECT ta.user_id,
                   COUNT(t.id) as assigned_tasks,
                   SUM(t.estimated_hours) as total_estimated_hours,
                   SUM(t.actual_hours) as total_actual_hours
            FROM task_assignees ta
            JOIN tasks t ON ta.task_id = t.id
            WHERE t.project_id = ? AND t.deleted_at IS NULL AND t.status != 'done'
            GROUP BY ta.user_id
        `, [id]);

        const hoursMap = {};
        taskHours.forEach(h => {
            hoursMap[h.user_id] = h;
        });

        const workload = members.map(m => {
            const h = hoursMap[m.user_id] || { assigned_tasks: 0, total_estimated_hours: 0, total_actual_hours: 0 };
            const weeklyCapacityHours = 40 * (m.allocation_percentage / 100);
            const estHours = Number(h.total_estimated_hours) || 0;
            const utilizationPercentage = weeklyCapacityHours > 0 ? Math.round((estHours / weeklyCapacityHours) * 100) : 0;
            const isOverAllocated = utilizationPercentage > 100;

            return {
                user_id: m.user_id,
                name: m.name,
                email: m.email,
                role: m.role,
                allocation_percentage: m.allocation_percentage,
                weeklyCapacityHours,
                assigned_tasks: Number(h.assigned_tasks) || 0,
                total_estimated_hours: estHours,
                total_actual_hours: Number(h.total_actual_hours) || 0,
                utilizationPercentage,
                isOverAllocated
            };
        });

        res.json({ success: true, data: workload });
    } catch (err) {
        console.error("Error fetching workload:", err);
        res.status(500).json({ success: false, message: "Failed to load team workload" });
    }
};

// ─── 15. Documents & Files ──────────────────────────────────────────────────
exports.getDocuments = async (req, res) => {
    try {
        const { id } = req.params;
        const [docs] = await db.execute(`
            SELECT d.*, u.name as uploader_name, u.email as uploader_email
            FROM project_documents d
            LEFT JOIN users u ON d.uploaded_by = u.id
            WHERE d.project_id = ?
            ORDER BY d.created_at DESC
        `, [id]);

        res.json({ success: true, data: docs });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to load documents" });
    }
};

exports.uploadDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.id || 1;
        const { category = 'general' } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "File upload is required" });
        }

        const relativePath = path.relative(uploadConfig.uploadDir, req.file.path).replace(/\\/g, "/");

        const [result] = await db.execute(`
            INSERT INTO project_documents (project_id, file_name, file_path, file_size, mime_type, category, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            id,
            req.file.originalname,
            relativePath,
            req.file.size,
            req.file.mimetype,
            category,
            userId
        ]);

        res.status(201).json({
            success: true,
            message: "Document uploaded successfully",
            data: { id: result.insertId, fileName: req.file.originalname }
        });
    } catch (err) {
        console.error("Error uploading project document:", err);
        res.status(500).json({ success: false, message: "Failed to upload document" });
    }
};

exports.deleteDocument = async (req, res) => {
    try {
        const { docId } = req.params;
        await db.execute("DELETE FROM project_documents WHERE id = ?", [docId]);
        res.json({ success: true, message: "Document deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to delete document" });
    }
};

// ─── 16. Project Executive Report ───────────────────────────────────────────
exports.getProjectReport = async (req, res) => {
    try {
        const { id } = req.params;

        const [projRows] = await db.execute(`
            SELECT p.*,
                   u_owner.name as owner_name, u_sponsor.name as sponsor_name
            FROM projects p
            LEFT JOIN users u_owner ON p.owner_id = u_owner.id
            LEFT JOIN users u_sponsor ON p.sponsor_id = u_sponsor.id
            WHERE p.id = ?
        `, [id]);

        if (projRows.length === 0) return res.status(404).json({ success: false, message: "Project not found" });
        const p = projRows[0];

        const [tasks] = await db.execute(`
            SELECT status, COUNT(*) as count, SUM(estimated_hours) as total_est, SUM(actual_hours) as total_act
            FROM tasks WHERE project_id = ? AND deleted_at IS NULL GROUP BY status
        `, [id]);

        const [milestones] = await db.execute(`
            SELECT status, COUNT(*) as count FROM project_milestones WHERE project_id = ? GROUP BY status
        `, [id]);

        const [topRisks] = await db.execute(`
            SELECT title, category, severity_score, status, mitigation_plan
            FROM project_risks WHERE project_id = ? AND status != 'closed'
            ORDER BY severity_score DESC LIMIT 4
        `, [id]);

        // Variance
        const budgetVariance = Number(p.approved_budget) - Number(p.actual_cost);
        const budgetBurnPercent = Number(p.approved_budget) > 0 ? Math.round((Number(p.actual_cost) / Number(p.approved_budget)) * 100) : 0;

        res.json({
            success: true,
            data: {
                project: p,
                budgetSummary: {
                    approved: Number(p.approved_budget),
                    actual: Number(p.actual_cost),
                    variance: budgetVariance,
                    burnRate: budgetBurnPercent
                },
                taskBreakdown: tasks,
                milestoneBreakdown: milestones,
                topRisks
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to generate report" });
    }
};
