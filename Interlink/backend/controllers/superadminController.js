const db = require("../config/db.js");
const { createAuditLog } = require("../models/auditLogModel.js");

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

module.exports = {
    getDeveloperStats,
    getAllOrganizations,
    updateOrganizationStatus
};
