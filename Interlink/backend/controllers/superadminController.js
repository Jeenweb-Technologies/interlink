const db = require("../config/db.js");
const { createAuditLog } = require("../models/auditLogModel.js");
const bcrypt = require("bcryptjs");

// 1. Get Platform Developer Statistics
const getDeveloperStats = async (req, res) => {
    try {
        const [orgCounts] = await db.execute(`
            SELECT 
                COUNT(*) as total_orgs,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_orgs,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_orgs,
                SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_orgs,
                SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) as suspended_orgs
            FROM organizations
        `);

        const [userCount] = await db.execute("SELECT COUNT(*) as total_users FROM users WHERE role != 'super_admin'");
        const [compCount] = await db.execute("SELECT COUNT(*) as total_companies FROM companies");
        const [projectCount] = await db.execute("SELECT COUNT(*) as total_projects FROM projects WHERE deleted_at IS NULL");

        return res.status(200).json({
            success: true,
            stats: {
                total_orgs: orgCounts[0].total_orgs || 0,
                pending_orgs: orgCounts[0].pending_orgs || 0,
                approved_orgs: orgCounts[0].approved_orgs || 0,
                rejected_orgs: orgCounts[0].rejected_orgs || 0,
                suspended_orgs: orgCounts[0].suspended_orgs || 0,
                total_users: userCount[0].total_users || 0,
                total_companies: compCount[0].total_companies || 0,
                total_projects: projectCount[0].total_projects || 0
            }
        });
    } catch (error) {
        console.error("Error in getDeveloperStats:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load developer stats",
            error: error.message
        });
    }
};

// 2. Get All Organizations (with primary company and admin details)
const getAllOrganizations = async (req, res) => {
    try {
        const { status } = req.query;

        let query = `
            SELECT 
                o.id,
                o.name,
                o.email,
                COALESCE(o.status, 'pending') as status,
                o.created_at,
                (SELECT c.name FROM companies c WHERE c.organization_id = o.id ORDER BY c.id ASC LIMIT 1) as primary_company_name,
                (SELECT COUNT(*) FROM companies c WHERE c.organization_id = o.id) as companies_count,
                (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id) as users_count,
                u_admin.name as admin_name,
                u_admin.username as admin_username,
                u_admin.email as admin_email,
                u_admin.mob_no as admin_phone,
                u_admin.active as admin_active
            FROM organizations o
            LEFT JOIN users u_admin ON u_admin.organization_id = o.id AND u_admin.role = 'admin'
        `;

        const params = [];
        if (status && status !== 'all') {
            query += " WHERE o.status = ?";
            params.push(status);
        }

        query += " ORDER BY CASE WHEN o.status = 'pending' THEN 0 ELSE 1 END, o.created_at DESC";

        const [organizations] = await db.execute(query, params);

        return res.status(200).json({
            success: true,
            organizations
        });
    } catch (error) {
        console.error("Error in getAllOrganizations:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load organizations",
            error: error.message
        });
    }
};

// 3. Update Organization Status (Approve, Reject, Suspend)
const updateOrganizationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'approved' | 'rejected' | 'suspended'

        if (!['approved', 'rejected', 'suspended', 'pending'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value"
            });
        }

        // Get current organization info
        const [orgRows] = await db.execute("SELECT id, name, status FROM organizations WHERE id = ?", [id]);
        if (orgRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Organization not found"
            });
        }
        const org = orgRows[0];

        // Update organization status
        await db.execute(
            "UPDATE organizations SET status = ? WHERE id = ?",
            [status, id]
        );

        // Update user active flags accordingly
        if (status === 'approved') {
            await db.execute(
                "UPDATE users SET active = 1 WHERE organization_id = ?",
                [id]
            );
        } else if (status === 'rejected' || status === 'suspended') {
            await db.execute(
                "UPDATE users SET active = 0 WHERE organization_id = ?",
                [id]
            );
        }

        // Audit log
        try {
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Developer',
                req.headers['x-device-id'] || 'PLATFORM_PANEL',
                'Organization Approval',
                status.toUpperCase(),
                JSON.stringify({ previousStatus: org.status }),
                JSON.stringify({ newStatus: status, orgId: id, orgName: org.name })
            );
        } catch (logErr) {
            console.warn("Audit log notice:", logErr.message);
        }

        return res.status(200).json({
            success: true,
            message: `Organization "${org.name}" has been ${status} successfully.`,
            status
        });
    } catch (error) {
        console.error("Error in updateOrganizationStatus:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update organization status",
            error: error.message
        });
    }
};

// 4. Create Organization for Client (Developer Provisioning)
const createOrganization = async (req, res) => {
    try {
        const {
            orgName,
            companyName,
            name,
            username,
            email,
            password,
            mob_no,
            status = 'approved'
        } = req.body;

        if (!orgName || !name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Organization name, administrator name, email, and password are required"
            });
        }

        const finalUsername = (username && username.trim()) ? username.trim() : email.trim().split("@")[0];

        // Check if user already exists
        const [existingUsers] = await db.execute(
            "SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1",
            [finalUsername, email.trim()]
        );
        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Username or email is already registered to another account"
            });
        }

        const orgStatus = ['approved', 'pending'].includes(status) ? status : 'approved';

        // 1. Create Organization
        let orgId;
        try {
            const [orgResult] = await db.execute(
                "INSERT INTO organizations (name, email, status) VALUES (?, ?, ?)",
                [orgName.trim(), email.trim(), orgStatus]
            );
            orgId = orgResult.insertId;
        } catch (orgErr) {
            if (orgErr.code === 'ER_BAD_FIELD_ERROR') {
                const [orgResult] = await db.execute(
                    "INSERT INTO organizations (name) VALUES (?)",
                    [orgName.trim()]
                );
                orgId = orgResult.insertId;
                await db.execute("ALTER TABLE organizations ADD COLUMN email VARCHAR(150) DEFAULT NULL").catch(() => {});
                await db.execute("ALTER TABLE organizations ADD COLUMN status VARCHAR(50) DEFAULT 'approved'").catch(() => {});
            } else {
                throw orgErr;
            }
        }

        // 2. Create First Primary Company under this Organization
        const compName = (companyName && companyName.trim()) ? companyName.trim() : `${orgName.trim()} Main`;
        let companyId;
        try {
            const [compResult] = await db.execute(
                "INSERT INTO companies (organization_id, name, email, phone) VALUES (?, ?, ?, ?)",
                [orgId, compName, email.trim(), mob_no ? mob_no.trim() : null]
            );
            companyId = compResult.insertId;
        } catch (compErr) {
            if (compErr.code === 'ER_BAD_FIELD_ERROR') {
                const [compResult] = await db.execute(
                    "INSERT INTO companies (organization_id, name) VALUES (?, ?)",
                    [orgId, compName]
                );
                companyId = compResult.insertId;
            } else {
                throw compErr;
            }
        }

        // 3. Create Admin User for this Client
        const hashedPassword = await bcrypt.hash(password, 10);
        const isActive = orgStatus === 'approved' ? 1 : 0;

        const [userResult] = await db.execute(`
            INSERT INTO users (
                name, username, email, password, role,
                organization_id, company_id,
                mob_no, device_verification_required, is_approved, active
            ) VALUES (?, ?, ?, ?, 'admin', ?, ?, ?, 0, 1, ?)
        `, [
            name.trim(),
            finalUsername,
            email.trim(),
            hashedPassword,
            orgId,
            companyId,
            mob_no ? mob_no.trim() : null,
            isActive
        ]);

        const newUserId = userResult.insertId;

        // 4. Link user to company in user_companies
        try {
            await db.execute(
                "INSERT IGNORE INTO user_companies (user_id, company_id) VALUES (?, ?)",
                [newUserId, companyId]
            );
        } catch (_) {}

        // 5. Audit Log
        try {
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Developer',
                req.headers['x-device-id'] || 'PLATFORM_PANEL',
                'Create Client Organization',
                'CREATE',
                null,
                JSON.stringify({
                    orgId,
                    orgName: orgName.trim(),
                    companyId,
                    companyName: compName,
                    adminId: newUserId,
                    adminEmail: email.trim(),
                    adminUsername: finalUsername,
                    status: orgStatus
                })
            );
        } catch (logErr) {
            console.warn("Audit log notice:", logErr.message);
        }

        return res.status(201).json({
            success: true,
            message: `Organization "${orgName.trim()}" created successfully for client!`,
            organization: {
                id: orgId,
                name: orgName.trim(),
                email: email.trim(),
                status: orgStatus,
                primary_company_name: compName,
                companies_count: 1,
                users_count: 1,
                admin_name: name.trim(),
                admin_username: finalUsername,
                admin_email: email.trim(),
                admin_phone: mob_no ? mob_no.trim() : null,
                admin_active: isActive,
                created_at: new Date()
            },
            credentials: {
                orgName: orgName.trim(),
                adminName: name.trim(),
                email: email.trim(),
                username: finalUsername,
                password: password,
                status: orgStatus
            }
        });
    } catch (error) {
        console.error("Error in createOrganization:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create organization for client",
            error: error.message
        });
    }
};

module.exports = {
    getDeveloperStats,
    getAllOrganizations,
    updateOrganizationStatus,
    createOrganization
};
