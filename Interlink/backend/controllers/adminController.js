const bcrypt = require("bcryptjs");
const db = require("../config/db.js");

const {
    createUser,
    getUserById,
    toggleUserActive
} = require("../models/userModel.js");
const { assignUserDepartment } = require("../models/departmentModel.js");
const { assignUserCompanies, getUserCompanyIds } = require("../models/companyModel.js");

const {
    approveDevice,
    revokeAllActiveDevices,
    getAllDeviceHistory,
    getDeviceHistoryForUser,
    getPendingDevicesAllUsers
} = require("../models/deviceModel.js");
const { getAllAuditLogs, createAuditLog } = require("../models/auditLogModel.js");

const fetchUsers = async (req, res) => {
    try {
        const organizationId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;
        const isSuper = req.user?.role === "super_admin" || req.user?.role === "super admin" || req.user?.role === "developer";

        const includeInactive = req.query.includeInactive === 'true';
        let whereClauses = [];
        let params = [];

        if (!includeInactive) {
            whereClauses.push('u.active = TRUE');
        }

        if (!isSuper) {
            whereClauses.push('u.organization_id = ?');
            params.push(organizationId);
            whereClauses.push('u.company_id = ?');
            params.push(companyId);
        } else if (req.headers["x-company-id"] || req.headers["company-id"]) {
            whereClauses.push('u.company_id = ?');
            params.push(companyId);
        }

        const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Fetch users along with their active device status and department
        const query = `
            SELECT 
                u.id, u.name, u.username, u.email, u.mob_no, u.role, u.organization_id, u.company_id,
                d.status AS device_status, ut.type_name,
                d.device_id, device_verification_required, u.active,
                u.department_id, dept.department_name
            FROM users u
            LEFT JOIN user_devices d ON d.user_id = u.id AND d.closed_at IS NULL
            LEFT JOIN user_types ut ON u.user_type_id = ut.id
            LEFT JOIN departments dept ON u.department_id = dept.id
            ${whereSQL}
            ORDER BY u.id DESC
        `;
        const [users] = await db.execute(query, params);

        // Fetch user companies mapping
        let userCompsMap = {};
        try {
            const [userCompsRows] = await db.execute(`
                SELECT uc.user_id, uc.company_id, c.name AS company_name
                FROM user_companies uc
                JOIN companies c ON uc.company_id = c.id
            `);
            userCompsRows.forEach((r) => {
                if (!userCompsMap[r.user_id]) userCompsMap[r.user_id] = [];
                userCompsMap[r.user_id].push({ id: r.company_id, name: r.company_name });
            });
        } catch (_) {}

        const enhancedUsers = users.map((u) => ({
            ...u,
            allowed_companies: userCompsMap[u.id] || (u.company_id ? [{ id: u.company_id }] : [])
        }));

        return res.status(200).json({
            success: true,
            users: enhancedUsers
        });

    } catch (error) {
        console.log("Fetch Users Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const createUserByAdmin = async (req, res) => {
    try {
        const {
            name,
            username,
            email,
            password,
            userTypeId,
            mobNo,
            dateOfJoin,
            deviceVerificationRequired,
            role,
            departmentId,
            companyId,
            companyIds
        } = req.body;

        if (!name || !username || !email || !password) {
            return res.status(400).json({ success: false, message: "Name, username, email and password are required" });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const organizationId = req.user?.organization_id || 1;
        const resolvedCompanyId = companyId
            ? parseInt(companyId, 10)
            : (Array.isArray(companyIds) && companyIds.length > 0 ? parseInt(companyIds[0], 10) : (req.user?.company_id || 1));
        const parsedDeptId = departmentId ? parseInt(departmentId, 10) : null;

        const newUser = await createUser(
            name,
            username,
            email,
            hashedPassword,
            userTypeId || null,
            mobNo || null,
            dateOfJoin || null,
            typeof deviceVerificationRequired === 'boolean' ? deviceVerificationRequired : true,
            true,
            role || 'user',
            organizationId,
            resolvedCompanyId,
            parsedDeptId
        );

        if (newUser.insertId) {
            // Assign company access permissions
            const targetCompanyIds = Array.isArray(companyIds) && companyIds.length > 0
                ? companyIds
                : [resolvedCompanyId];
            try {
                await assignUserCompanies(newUser.insertId, targetCompanyIds);
            } catch (compErr) {
                console.warn("Failed to sync user_companies junction:", compErr.message);
            }

            if (parsedDeptId) {
                try {
                    await assignUserDepartment(newUser.insertId, parsedDeptId, 'USER');
                } catch (deptErr) {
                    console.warn("Failed to sync user_departments junction:", deptErr.message);
                }
            }
        }

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'User Master',
            'created',
            null,
            {
                id: newUser.insertId,
                name,
                username,
                email,
                user_type_id: userTypeId || null,
                mob_no: mobNo || null,
                date_of_join: dateOfJoin || null,
                device_verification_required: deviceVerificationRequired,
                role: role || 'user',
                company_id: companyId,
                department_id: parsedDeptId
            },
            null,
            companyId
        );

        return res.status(201).json({ success: true, message: "User created successfully", userId: newUser.insertId });
    } catch (error) {
        console.log("Create User Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const approveDeviceController = async (req, res) => {
    try {
        const { deviceRowId } = req.params;
        const adminId = req.user.id;

        // Fetch device info before approval for the log
        const [deviceRows] = await db.execute(
            `SELECT ud.device_id, ud.user_id, u.username, u.name AS user_name
             FROM user_devices ud
             JOIN users u ON u.id = ud.user_id
             WHERE ud.id = ?`,
            [deviceRowId]
        );
        const deviceInfo = deviceRows[0] || {};

        await approveDevice(deviceRowId, adminId);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            adminId,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'Device Management',
            'approved',
            { status: 'pending', device_id: deviceInfo.device_id, user: deviceInfo.user_name },
            { status: 'approved', device_id: deviceInfo.device_id, user: deviceInfo.user_name, approved_by: req.user?.name }
        );

        return res.status(200).json({ success: true, message: "Device approved successfully" });
    } catch (error) {
        console.log("Approve Device Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const revokeDeviceController = async (req, res) => {
    try {
        const { userId } = req.params;
        const adminId = req.user.id;

        await revokeAllActiveDevices(userId, adminId);

        return res.status(200).json({ success: true, message: "Device revoked successfully" });
    } catch (error) {
        console.log("Revoke Device Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};


const fetchAuditLogs = async (req, res) => {
    try {
        const organizationId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;
        const isSuper = req.user?.role === "super_admin" || req.user?.role === "super admin" || req.user?.role === "developer";

        const logs = await getAllDeviceHistory(isSuper ? null : organizationId, isSuper ? null : companyId);
        return res.status(200).json({ success: true, logs });
    } catch (error) {
        console.log("Fetch Audit Logs Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const fetchUserAuditLogs = async (req, res) => {
    try {
        const { userId } = req.params;
        const logs = await getDeviceHistoryForUser(userId);
        return res.status(200).json({ success: true, logs });
    } catch (error) {
        console.log("Fetch User Audit Logs Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const fetchActivityLogs = async (req, res) => {
    try {
        const isAdmin = req.user.role === "admin" || req.user.role === "super admin";
        const companyId = req.user?.company_id || 1;
        let logs = [];

        if (isAdmin) {
            logs = await getAllAuditLogs(null, companyId);
        } else {
            const userId = req.user.id;
            const [userRows] = await db.execute(
                "SELECT user_type_id FROM users WHERE id = ?",
                [userId]
            );
            if (userRows.length > 0 && userRows[0].user_type_id !== null) {
                const userTypeId = userRows[0].user_type_id;
                const [permRows] = await db.execute(
                    "SELECT master_name, can_read AS permitted FROM user_type_permissions WHERE user_type_id = ? AND master_name IN ('activity_report', 'closed_inquiry_report')",
                    [userTypeId]
                );
                
                const hasActivity = permRows.some(r => r.master_name === 'activity_report' && r.permitted === 1);
                const hasClosed = permRows.some(r => r.master_name === 'closed_inquiry_report' && r.permitted === 1);

                if (hasActivity || hasClosed) {
                    const rawLogs = await getAllAuditLogs(userId, companyId);
                    logs = rawLogs.filter(row => {
                        const isClosedInquiry = row.master_name === 'Inquiry' && 
                                                row.change_type === 'status_updated' && 
                                                row.after_data?.status === 'closed';
                        
                        if (hasActivity && hasClosed) {
                            return true;
                        }
                        if (hasActivity) {
                            return !isClosedInquiry;
                        }
                        if (hasClosed) {
                            return isClosedInquiry;
                        }
                        return false;
                    });
                }
            }
        }
        return res.status(200).json({ success: true, logs });
    } catch (error) {
        console.log("Fetch Activity Logs Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const fetchPendingDevices = async (req, res) => {
    try {
        const organizationId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;
        const isSuper = req.user?.role === "super_admin" || req.user?.role === "super admin" || req.user?.role === "developer";

        const devices = await getPendingDevicesAllUsers(isSuper ? null : organizationId, isSuper ? null : companyId);
        return res.status(200).json({ success: true, devices });
    } catch (error) {
        console.log("Fetch Pending Devices Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const toggleUserActiveController = async (req, res) => {
    try {
        const { id } = req.params;
        const { active } = req.body;
        const adminId = req.user.id;
        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const beforeData = await getUserById(id);
        if (!beforeData) return res.status(404).json({ success: false, message: "User not found" });

        await toggleUserActive(id, active);

        await createAuditLog(
            adminId,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'User Master',
            active ? 'activated' : 'deactivated',
            { name: beforeData.name, username: beforeData.username, active: beforeData.active },
            { name: beforeData.name, username: beforeData.username, active: active }
        );

        return res.status(200).json({ success: true, message: `User ${active ? 'activated' : 'deactivated'}` });
    } catch (error) {
        console.log("Toggle User Active Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const updateUserByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            username,
            email,
            password,
            userTypeId,
            mobNo,
            dateOfJoin,
            deviceVerificationRequired,
            role,
            departmentId,
            active,
            companyIds
        } = req.body;

        const beforeUser = await getUserById(id);
        if (!beforeUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const updates = [];
        const params = [];

        if (name !== undefined) {
            updates.push("name = ?");
            params.push(name ? name.trim() : "");
        }
        if (username !== undefined) {
            updates.push("username = ?");
            params.push(username ? username.trim() : "");
        }
        if (email !== undefined) {
            updates.push("email = ?");
            params.push(email ? email.trim() : "");
        }
        if (mobNo !== undefined) {
            updates.push("mob_no = ?");
            params.push(mobNo ? mobNo.trim() : null);
        }
        if (userTypeId !== undefined) {
            updates.push("user_type_id = ?");
            params.push(userTypeId ? parseInt(userTypeId, 10) : null);
        }
        if (role !== undefined) {
            updates.push("role = ?");
            params.push(role);
        }
        if (dateOfJoin !== undefined) {
            updates.push("date_of_join = ?");
            params.push(dateOfJoin || null);
        }
        if (deviceVerificationRequired !== undefined) {
            updates.push("device_verification_required = ?");
            params.push(deviceVerificationRequired ? 1 : 0);
        }
        if (active !== undefined) {
            updates.push("active = ?");
            params.push(active ? 1 : 0);
        }
        if (password && password.trim().length > 0) {
            const hashedPassword = await bcrypt.hash(password.trim(), 10);
            updates.push("password = ?");
            params.push(hashedPassword);
        }
        if (departmentId !== undefined) {
            const parsedDeptId = departmentId ? parseInt(departmentId, 10) : null;
            updates.push("department_id = ?");
            params.push(parsedDeptId);
            // keep user_departments junction synced
            await assignUserDepartment(id, parsedDeptId);
        }

        if (companyIds !== undefined && Array.isArray(companyIds)) {
            await assignUserCompanies(id, companyIds);
            if (companyIds.length > 0 && !companyIds.map(Number).includes(Number(beforeUser.company_id))) {
                updates.push("company_id = ?");
                params.push(parseInt(companyIds[0], 10));
            }
        }

        if (updates.length > 0) {
            params.push(id);
            await db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        const afterUser = await getUserById(id);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'User Master',
            'updated',
            {
                name: beforeUser.name,
                username: beforeUser.username,
                email: beforeUser.email,
                role: beforeUser.role,
                department_id: beforeUser.department_id,
                user_type_id: beforeUser.user_type_id
            },
            {
                name: afterUser.name,
                username: afterUser.username,
                email: afterUser.email,
                role: afterUser.role,
                department_id: afterUser.department_id,
                user_type_id: afterUser.user_type_id
            },
            null,
            beforeUser.company_id
        );

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
            user: afterUser
        });
    } catch (error) {
        console.log("Update User Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Server Error" });
    }
};

module.exports = {
    fetchUsers,
    createUserByAdmin,
    updateUserByAdmin,
    approveDeviceController,
    revokeDeviceController,
    fetchAuditLogs,
    fetchUserAuditLogs,
    fetchActivityLogs,
    fetchPendingDevices,
    toggleUserActiveController
};