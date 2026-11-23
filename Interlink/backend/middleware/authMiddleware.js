const jwt = require("jsonwebtoken");
const db = require("../config/db.js");

const verifyToken = async (req, res, next) => {
    let token = null;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    } else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token || token === "null" || token === "undefined" || !token.trim()) {
        return res.status(401).json({
            success: false,
            message: "No token provided. Unauthorized."
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

        if (!req.user.username || !req.user.name || !req.user.organization_id) {
            const [rows] = await db.execute(
                "SELECT name, username, role, organization_id, company_id FROM users WHERE id = ?",
                [req.user.id]
            );

            if (rows.length) {
                req.user = {
                    ...req.user,
                    name: rows[0].name,
                    username: rows[0].username,
                    role: rows[0].role || req.user.role,
                    organization_id: rows[0].organization_id || 1,
                    company_id: rows[0].company_id || 1
                };
            }
        }

        // Default fallbacks
        req.user.organization_id = req.user.organization_id || 1;
        req.user.tenant_id = req.user.organization_id;
        req.user.company_id = req.user.company_id || 1;

        // Allow frontend header override for switching companies dynamically
        const headerCompId = req.headers["x-company-id"] || req.headers["company-id"];
        if (headerCompId) {
            const parsed = parseInt(headerCompId, 10);
            if (!isNaN(parsed) && parsed > 0) {
                req.user.company_id = parsed;
            }
        }

        if (req.user?.id) {
            const activeMap = req.app.get("userLastSeen") || new Map();
            activeMap.set(String(req.user.id), Date.now());
            req.app.set("userLastSeen", activeMap);
        }

        next();
    } catch (error) {
        return res.status(403).json({
            success: false,
            message: "Invalid or expired token."
        });
    }
};

const isUserAdmin = (user) => {
    if (!user) return false;
    const role = String(user.role || '').toLowerCase().trim();
    return (
        ['admin', 'master_admin', 'super admin', 'administrator', 'master'].includes(role) ||
        user.username === 'admin' ||
        Number(user.user_type_id) === 1 ||
        Number(user.role_id) === 1
    );
};

const verifyAdmin = (req, res, next) => {
    if (!req.user || !isUserAdmin(req.user)) {
        return res.status(403).json({
            success: false,
            message: "Access denied. Admin only."
        });
    }
    next();
};

const verifyPermission = (masterName, action) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized. No user information."
                });
            }

            // Admins bypass all permission checks
            if (isUserAdmin(req.user)) {
                return next();
            }

            const userId = req.user.id;

            // Specific check for WhatsApp permission (checks users table allow_whatsapp flag)
            if (masterName === 'whatsapp') {
                const [uRows] = await db.execute("SELECT allow_whatsapp FROM users WHERE id = ?", [userId]);
                if (uRows.length && (uRows[0].allow_whatsapp === 0 || uRows[0].allow_whatsapp === false)) {
                    return res.status(403).json({
                        success: false,
                        message: "Access Denied. WhatsApp feature has been disabled for your account."
                    });
                }
            }

            // Get user's user_type_id
            const [userRows] = await db.execute(
                "SELECT user_type_id FROM users WHERE id = ?",
                [userId]
            );

            if (userRows.length === 0 || userRows[0].user_type_id === null) {
                // By default, chat communications are permitted for all registered coworkers unless explicitly restricted by a user_type
                const defaultAllowedChatMasters = ['chat', 'document_view', 'document_upload', 'camera_access', 'document_download', 'group_create', 'poll_create'];
                if (defaultAllowedChatMasters.includes(masterName)) {
                    return next();
                }

                return res.status(403).json({
                    success: false,
                    message: `Access Denied. You do not have permission for ${masterName} (${action}).`
                });
            }

            const userTypeId = userRows[0].user_type_id;

            // Query permission table
            let column = "";
            if (action === "read") column = "can_read";
            else if (action === "write") column = "can_write";
            else if (action === "update") column = "can_update";
            else if (action === "delete") column = "can_delete";
            else {
                return res.status(500).json({
                    success: false,
                    message: "Invalid permission action."
                });
            }

            const query = `
                SELECT ${column} AS permitted 
                FROM user_type_permissions 
                WHERE user_type_id = ? AND master_name = ?
            `;
            const [permRows] = await db.execute(query, [userTypeId, masterName]);

            if (permRows.length > 0) {
                if (permRows[0].permitted === 1) {
                    return next();
                } else {
                    return res.status(403).json({
                        success: false,
                        message: `Access Denied. Insufficient permissions for ${masterName} (${action}).`
                    });
                }
            }

            // Default permit for core chat if not explicitly restricted
            if (masterName === 'chat') {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: `Access Denied. Insufficient permissions for ${masterName} (${action}).`
            });

        } catch (error) {
            console.error("Error in verifyPermission middleware:", error);
            return res.status(500).json({
                success: false,
                message: "Internal Server Error during permission verification."
            });
        }
    };
};
const verifyReportPermission = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. No user information."
            });
        }

        // Admin/Super Admin bypass all permission checks
        if (isUserAdmin(req.user)) {
            return next();
        }

        const userId = req.user.id;

        // Get user's user_type_id
        const [userRows] = await db.execute(
            "SELECT user_type_id FROM users WHERE id = ?",
            [userId]
        );

        if (userRows.length === 0 || userRows[0].user_type_id === null) {
            return res.status(403).json({
                success: false,
                message: "Access Denied. You do not have report permissions."
            });
        }

        const userTypeId = userRows[0].user_type_id;

        // Check if they have read permission on activity_report
        const query = `
            SELECT can_read AS permitted 
            FROM user_type_permissions 
            WHERE user_type_id = ? AND master_name = 'activity_report'
        `;
        const [permRows] = await db.execute(query, [userTypeId]);
        const hasAnyPerm = permRows.some(row => row.permitted === 1);

        if (hasAnyPerm) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: "Access Denied. You do not have permission to view reports."
        });
    } catch (error) {
        console.error("verifyReportPermission error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error verifying report permissions."
        });
    }
};

const verifyAnyPermission = (permissions = []) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized. No user information."
                });
            }

            // Admins bypass all permission checks
            if (isUserAdmin(req.user)) {
                return next();
            }

            const userId = req.user.id;
            const [userRows] = await db.execute(
                "SELECT user_type_id FROM users WHERE id = ?",
                [userId]
            );

            if (userRows.length === 0 || userRows[0].user_type_id === null) {
                return res.status(403).json({
                    success: false,
                    message: "Access Denied. No user role assigned."
                });
            }

            const userTypeId = userRows[0].user_type_id;

            for (const perm of permissions) {
                const actionCol = perm.action === "write" ? "can_write"
                    : perm.action === "update" ? "can_update"
                    : perm.action === "delete" ? "can_delete"
                    : "can_read";

                const [permRows] = await db.execute(
                    `SELECT ${actionCol} AS permitted FROM user_type_permissions WHERE user_type_id = ? AND master_name = ?`,
                    [userTypeId, perm.master]
                );

                if (permRows.length > 0 && Number(permRows[0].permitted) === 1) {
                    return next();
                }
            }

            return res.status(403).json({
                success: false,
                message: "Access Denied. You do not have sufficient permissions."
            });
        } catch (error) {
            console.error("verifyAnyPermission error:", error);
            return res.status(500).json({
                success: false,
                message: "Internal server error verifying permissions."
            });
        }
    };
};

const verifySuperAdmin = (req, res, next) => {
    if (!req.user || (req.user.role !== "super admin" && req.user.role !== "super_admin" && req.user.role !== "developer")) {
        return res.status(403).json({
            success: false,
            message: "Access Denied. Developer / Superadmin access only."
        });
    }
    next();
};

module.exports = { isUserAdmin, verifyToken, verifyAdmin, verifyPermission, verifyReportPermission, verifyAnyPermission, verifySuperAdmin };
