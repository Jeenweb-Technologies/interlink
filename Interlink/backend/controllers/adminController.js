const bcrypt = require("bcryptjs");
const db = require("../config/db.js");
let ExcelJS = null;
try {
    ExcelJS = require("exceljs");
} catch (e) {
    console.warn("ExcelJS not yet available on boot:", e.message);
}

const {
    createUser,
    getUserById,
    toggleUserActive
} = require("../models/userModel.js");
const { addUserToDefaultGroups } = require("../models/conversationModel.js");

const {
    approveDevice,
    revokeAllActiveDevices,
    getAllDeviceHistory,
    getDeviceHistoryForUser,
    getPendingDevicesAllUsers
} = require("../models/deviceModel.js");
const { getAllAuditLogs, createAuditLog } = require("../models/auditLogModel.js");

const {
    assignUserDepartments,
    getUserDepartments
} = require("../models/departmentModel.js");

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

        // Fetch users along with their active device status
        const query = `
            SELECT 
                u.id, COALESCE(u.name, u.full_name) AS name, u.username, u.email, u.mob_no, u.role,
                u.organization_id, u.company_id, comp.company_name, comp.company_code,
                d.status AS device_status, COALESCE(ut.type_name, ut.name) AS type_name, COALESCE(ut.type_name, ut.name) AS user_type_name,
                u.user_type_id, d.device_id, device_verification_required, COALESCE(u.active, u.is_active, 1) AS active,
                u.can_chat_all_departments, u.allowed_chat_departments,
                u.can_chat_all_companies, u.allowed_chat_companies
            FROM users u
            LEFT JOIN user_devices d ON d.user_id = u.id AND d.closed_at IS NULL
            LEFT JOIN user_types ut ON u.user_type_id = ut.id
            LEFT JOIN companies comp ON u.company_id = comp.id
            ${whereSQL}
            ORDER BY COALESCE(u.name, u.full_name) ASC
        `;
        const [users] = await db.execute(query, params);

        // Fetch department assignments for all users
        const [deptRows] = await db.execute(`
            SELECT ud.user_id, ud.department_id, ud.department_role, d.department_name
            FROM user_departments ud
            JOIN departments d ON ud.department_id = d.id
            WHERE d.status = 'ACTIVE'
        `);

        const deptMap = new Map();
        for (const d of deptRows) {
            if (!deptMap.has(d.user_id)) deptMap.set(d.user_id, []);
            deptMap.get(d.user_id).push({
                department_id: d.department_id,
                department_name: d.department_name,
                department_role: d.department_role
            });
        }

        const usersWithDepts = users.map(u => {
            const depts = deptMap.get(u.id) || [];
            let parsedAllowedChatDepts = [];
            if (u.allowed_chat_departments) {
                try {
                    parsedAllowedChatDepts = typeof u.allowed_chat_departments === 'string'
                        ? JSON.parse(u.allowed_chat_departments)
                        : u.allowed_chat_departments;
                    if (!Array.isArray(parsedAllowedChatDepts)) parsedAllowedChatDepts = [];
                } catch (_) { parsedAllowedChatDepts = []; }
            }

            let parsedAllowedChatCompanies = { companyIds: [], departmentIds: [] };
            if (u.allowed_chat_companies) {
                try {
                    const val = typeof u.allowed_chat_companies === 'string'
                        ? JSON.parse(u.allowed_chat_companies)
                        : u.allowed_chat_companies;
                    if (Array.isArray(val)) {
                        parsedAllowedChatCompanies = { companyIds: val.map(Number), departmentIds: [] };
                    } else if (val && typeof val === 'object') {
                        parsedAllowedChatCompanies = {
                            companyIds: Array.isArray(val.companyIds) ? val.companyIds.map(Number) : [],
                            departmentIds: Array.isArray(val.departmentIds) ? val.departmentIds.map(Number) : []
                        };
                    }
                } catch (_) { parsedAllowedChatCompanies = { companyIds: [], departmentIds: [] }; }
            }

            return {
                ...u,
                can_chat_all_departments: Boolean(u.can_chat_all_departments),
                allowed_chat_departments: parsedAllowedChatDepts,
                can_chat_all_companies: Boolean(u.can_chat_all_companies),
                allowed_chat_companies: parsedAllowedChatCompanies,
                is_vendor: Boolean(u.is_vendor),
                can_chat_with_vendors: Boolean(u.can_chat_with_vendors),
                must_change_password: Boolean(u.must_change_password),
                departments: depts,
                department_names: depts.map(d => d.department_name).join(', ') || 'Unassigned',
                primary_department: depts[0]?.department_name || 'Unassigned',
                department_role: depts.some(d => d.department_role === 'ADMIN') ? 'ADMIN' : (depts[0]?.department_role || 'USER')
            };
        });

        return res.status(200).json({
            success: true,
            users: usersWithDepts
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
            departments,
            departmentId,
            departmentRole
        } = req.body;

        if (!name || !username || !email || !password) {
            return res.status(400).json({ success: false, message: "Name, username, email and password are required" });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const organizationId = req.user?.organization_id || 1;
        const companyId = req.body.companyId ? parseInt(req.body.companyId, 10) : (req.body.company_id ? parseInt(req.body.company_id, 10) : (req.user?.company_id || 1));

        const rawDeviceVerif = deviceVerificationRequired !== undefined ? deviceVerificationRequired : req.body.device_verification_required;
        const finalDeviceVerif = rawDeviceVerif === true || rawDeviceVerif === 1 || rawDeviceVerif === '1' || rawDeviceVerif === 'true';

        let isVendorUser = Boolean(req.body.isVendor !== undefined ? req.body.isVendor : req.body.is_vendor);
        if (!isVendorUser && userTypeId) {
            try {
                const [utRows] = await db.execute("SELECT is_vendor FROM user_types WHERE id = ?", [Number(userTypeId)]);
                if (utRows.length > 0 && utRows[0].is_vendor) isVendorUser = true;
            } catch (_) {}
        }

        const rawCanChatWithVendors = req.body.canChatWithVendors !== undefined ? req.body.canChatWithVendors : req.body.can_chat_with_vendors;
        const finalCanChatWithVendors = rawCanChatWithVendors === true || rawCanChatWithVendors === 1 || rawCanChatWithVendors === '1' || rawCanChatWithVendors === 'true';

        // Newly created accounts are required to change password on first login
        const rawMustChange = req.body.mustChangePassword !== undefined ? req.body.mustChangePassword : req.body.must_change_password;
        const finalMustChange = rawMustChange !== undefined ? (rawMustChange === true || rawMustChange === 1 || rawMustChange === '1' || rawMustChange === 'true') : true;

        const newUser = await createUser(
            name,
            username,
            email,
            password, // Plain text password stored in database
            hashedPassword, // Bcrypt hash stored in database
            userTypeId || null,
            mobNo || null,
            dateOfJoin || null,
            finalDeviceVerif,
            true,
            role || 'user',
            true,
            finalMustChange,
            isVendorUser,
            finalCanChatWithVendors,
            organizationId,
            companyId
        );

        if (newUser && newUser.insertId) {
            await addUserToDefaultGroups(newUser.insertId);

            // Handle department assignments
            let deptAssignments = [];
            if (Array.isArray(departments) && departments.length > 0) {
                deptAssignments = departments;
            } else if (departmentId) {
                deptAssignments = [{
                    departmentId: Number(departmentId),
                    role: departmentRole || 'USER'
                }];
            }

            if (deptAssignments.length > 0) {
                await assignUserDepartments(newUser.insertId, deptAssignments);
            }

            // Handle company assignment, inter-department, and inter-company chat permissions
            const rawCompanyId = req.body.companyId || req.body.company_id;
            const finalCompanyId = rawCompanyId ? Number(rawCompanyId) : 1;

            const rawCanChatAll = req.body.canChatAllDepartments !== undefined ? req.body.canChatAllDepartments : req.body.can_chat_all_departments;
            const finalCanChatAll = rawCanChatAll === true || rawCanChatAll === 1 || rawCanChatAll === 'true' || rawCanChatAll === '1';
            let finalAllowedChat = req.body.allowedChatDepartments !== undefined ? req.body.allowedChatDepartments : req.body.allowed_chat_departments;
            if (typeof finalAllowedChat === 'string') {
                try { finalAllowedChat = JSON.parse(finalAllowedChat); } catch (_) { finalAllowedChat = []; }
            }
            if (!Array.isArray(finalAllowedChat)) finalAllowedChat = [];

            const rawCanChatAllComp = req.body.canChatAllCompanies !== undefined ? req.body.canChatAllCompanies : req.body.can_chat_all_companies;
            const finalCanChatAllComp = rawCanChatAllComp === true || rawCanChatAllComp === 1 || rawCanChatAllComp === 'true' || rawCanChatAllComp === '1';

            let rawAllowedChatComp = req.body.allowedChatCompanies !== undefined ? req.body.allowedChatCompanies : req.body.allowed_chat_companies;
            if (typeof rawAllowedChatComp === 'string') {
                try { rawAllowedChatComp = JSON.parse(rawAllowedChatComp); } catch (_) { rawAllowedChatComp = { companyIds: [], departmentIds: [] }; }
            }
            let finalAllowedChatCompanies = { companyIds: [], departmentIds: [] };
            if (Array.isArray(rawAllowedChatComp)) {
                finalAllowedChatCompanies = { companyIds: rawAllowedChatComp.map(Number), departmentIds: [] };
            } else if (rawAllowedChatComp && typeof rawAllowedChatComp === 'object') {
                finalAllowedChatCompanies = {
                    companyIds: Array.isArray(rawAllowedChatComp.companyIds) ? rawAllowedChatComp.companyIds.map(Number) : [],
                    departmentIds: Array.isArray(rawAllowedChatComp.departmentIds) ? rawAllowedChatComp.departmentIds.map(Number) : []
                };
            }

            await db.execute(
                "UPDATE users SET company_id = ?, can_chat_all_departments = ?, allowed_chat_departments = ?, can_chat_all_companies = ?, allowed_chat_companies = ? WHERE id = ?",
                [
                    finalCompanyId,
                    finalCanChatAll ? 1 : 0,
                    JSON.stringify(finalAllowedChat),
                    finalCanChatAllComp ? 1 : 0,
                    JSON.stringify(finalAllowedChatCompanies),
                    newUser.insertId
                ]
            );
        }

        // Automatically enroll newly created user into default groups & company broadcast
        try {
            await addUserToDefaultGroups(newUser.insertId);
        } catch (enrollErr) {
            console.warn("Failed to auto-enroll user into default groups:", enrollErr.message);
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
                departments: departments || departmentId,
                company_id: companyId
            },
            null,
            companyId
        );

        return res.status(201).json({ success: true, message: "User created successfully", userId: newUser.insertId });
    } catch (error) {
        console.log("Create User Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            const errStr = (error.sqlMessage || error.message || "").toLowerCase();
            if (errStr.includes('email')) {
                return res.status(400).json({ success: false, message: "A user with this email already exists." });
            }
            if (errStr.includes('username')) {
                return res.status(400).json({ success: false, message: "A user with this username already exists." });
            }
            return res.status(400).json({ success: false, message: "Username or email already exists." });
        }
        return res.status(500).json({ success: false, message: error.message || "Server Error" });
    }
};

const updateUserByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            email,
            mobNo,
            userTypeId,
            role,
            password,
            deviceVerificationRequired,
            departments,
            departmentId,
            departmentRole
        } = req.body;

        const before = await getUserById(id);
        if (!before) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const updates = [];
        const values = [];

        if (name !== undefined && name.trim()) {
            updates.push("name = ?", "full_name = ?");
            values.push(name.trim(), name.trim());
        }
        if (email !== undefined && email.trim()) {
            updates.push("email = ?");
            values.push(email.trim());
        }
        if (mobNo !== undefined) {
            updates.push("mob_no = ?");
            values.push(mobNo ? mobNo.trim() : null);
        }
        if (userTypeId !== undefined) {
            updates.push("user_type_id = ?");
            values.push(userTypeId ? Number(userTypeId) : null);
        }
        const rawCompanyId = req.body.companyId !== undefined ? req.body.companyId : req.body.company_id;
        if (rawCompanyId !== undefined) {
            updates.push("company_id = ?");
            values.push(rawCompanyId ? Number(rawCompanyId) : null);
        }

        const rawCanChatAll = req.body.canChatAllDepartments !== undefined ? req.body.canChatAllDepartments : req.body.can_chat_all_departments;
        if (rawCanChatAll !== undefined) {
            const finalCanChatAll = rawCanChatAll === true || rawCanChatAll === 1 || rawCanChatAll === 'true' || rawCanChatAll === '1';
            updates.push("can_chat_all_departments = ?");
            values.push(finalCanChatAll ? 1 : 0);
        }

        const rawAllowedChat = req.body.allowedChatDepartments !== undefined ? req.body.allowedChatDepartments : req.body.allowed_chat_departments;
        if (rawAllowedChat !== undefined) {
            let finalAllowedChat = rawAllowedChat;
            if (typeof finalAllowedChat === 'string') {
                try { finalAllowedChat = JSON.parse(finalAllowedChat); } catch (_) { finalAllowedChat = []; }
            }
            if (!Array.isArray(finalAllowedChat)) finalAllowedChat = [];
            updates.push("allowed_chat_departments = ?");
            values.push(JSON.stringify(finalAllowedChat));
        }

        const rawCanChatAllComp = req.body.canChatAllCompanies !== undefined ? req.body.canChatAllCompanies : req.body.can_chat_all_companies;
        if (rawCanChatAllComp !== undefined) {
            const finalCanChatAllComp = rawCanChatAllComp === true || rawCanChatAllComp === 1 || rawCanChatAllComp === 'true' || rawCanChatAllComp === '1';
            updates.push("can_chat_all_companies = ?");
            values.push(finalCanChatAllComp ? 1 : 0);
        }

        const rawAllowedChatComp = req.body.allowedChatCompanies !== undefined ? req.body.allowedChatCompanies : req.body.allowed_chat_companies;
        if (rawAllowedChatComp !== undefined) {
            let parsed = rawAllowedChatComp;
            if (typeof parsed === 'string') {
                try { parsed = JSON.parse(parsed); } catch (_) { parsed = { companyIds: [], departmentIds: [] }; }
            }
            let finalAllowedChatCompanies = { companyIds: [], departmentIds: [] };
            if (Array.isArray(parsed)) {
                finalAllowedChatCompanies = { companyIds: parsed.map(Number), departmentIds: [] };
            } else if (parsed && typeof parsed === 'object') {
                finalAllowedChatCompanies = {
                    companyIds: Array.isArray(parsed.companyIds) ? parsed.companyIds.map(Number) : [],
                    departmentIds: Array.isArray(parsed.departmentIds) ? parsed.departmentIds.map(Number) : []
                };
            }
            updates.push("allowed_chat_companies = ?");
            values.push(JSON.stringify(finalAllowedChatCompanies));
        }

        if (role !== undefined) {
            updates.push("role = ?");
            values.push(role);
        }
        const rawDeviceVerif = deviceVerificationRequired !== undefined ? deviceVerificationRequired : req.body.device_verification_required;
        if (rawDeviceVerif !== undefined) {
            const finalDeviceVerif = rawDeviceVerif === true || rawDeviceVerif === 1 || rawDeviceVerif === '1' || rawDeviceVerif === 'true';
            updates.push("device_verification_required = ?");
            values.push(finalDeviceVerif ? 1 : 0);
        }
        const rawIsVendor = req.body.isVendor !== undefined ? req.body.isVendor : req.body.is_vendor;
        if (rawIsVendor !== undefined) {
            const finalIsVendor = rawIsVendor === true || rawIsVendor === 1 || rawIsVendor === '1' || rawIsVendor === 'true';
            updates.push("is_vendor = ?");
            values.push(finalIsVendor ? 1 : 0);
        }

        const rawCanChatWithVendors = req.body.canChatWithVendors !== undefined ? req.body.canChatWithVendors : req.body.can_chat_with_vendors;
        if (rawCanChatWithVendors !== undefined) {
            const finalCanChatWithVendors = rawCanChatWithVendors === true || rawCanChatWithVendors === 1 || rawCanChatWithVendors === '1' || rawCanChatWithVendors === 'true';
            updates.push("can_chat_with_vendors = ?");
            values.push(finalCanChatWithVendors ? 1 : 0);
        }

        const rawMustChange = req.body.mustChangePassword !== undefined ? req.body.mustChangePassword : req.body.must_change_password;
        if (rawMustChange !== undefined) {
            const finalMustChange = rawMustChange === true || rawMustChange === 1 || rawMustChange === '1' || rawMustChange === 'true';
            updates.push("must_change_password = ?");
            values.push(finalMustChange ? 1 : 0);
        }

        if (password && password.trim()) {
            const cleanPass = password.trim();
            const hashed = await bcrypt.hash(cleanPass, 10);
            updates.push("password = ?", "password_hash = ?");
            values.push(cleanPass, hashed);
        }

        if (updates.length > 0) {
            values.push(id);
            await db.execute(`UPDATE users SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, values);
        }

        // Update departments if provided
        if (Array.isArray(departments)) {
            await assignUserDepartments(id, departments);
        } else if (departmentId !== undefined) {
            const deptAssignments = departmentId ? [{ departmentId: Number(departmentId), role: departmentRole || 'USER' }] : [];
            await assignUserDepartments(id, deptAssignments);
        }

        // Sync group and broadcast enrollments if company or departments changed
        try {
            await addUserToDefaultGroups(id);
        } catch (_) {}

        const updatedUser = await getUserById(id);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'User Master',
            'updated',
            { name: before.name, email: before.email, role: before.role, user_type_id: before.user_type_id },
            { name: updatedUser.name, email: updatedUser.email, role: updatedUser.role, user_type_id: updatedUser.user_type_id, departments }
        );

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error("Update User By Admin Error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "A user with this username or email already exists." });
        }
        return res.status(500).json({ success: false, message: error.message || "Server Error" });
    }
};

const approveDeviceController = async (req, res) => {
    try {
        const { deviceRowId } = req.params;
        const allowDownload = req.body?.allowDownload !== false;
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

        await approveDevice(deviceRowId, adminId, allowDownload);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            adminId,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'Device Management',
            'approved',
            { status: 'pending', device_id: deviceInfo.device_id, user: deviceInfo.user_name },
            { status: 'approved', device_id: deviceInfo.device_id, user: deviceInfo.user_name, approved_by: req.user?.name, allow_download: allowDownload }
        );

        return res.status(200).json({
            success: true,
            message: `Device approved successfully (${allowDownload ? 'Download Allowed' : 'Download Restricted to In-App View'})`
        });
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

const getDashboardStats = async (req, res) => {
    try {
        // 1. User counts
        const [[userCounts]] = await db.execute(`
            SELECT 
                COUNT(*) AS total_users,
                SUM(CASE WHEN COALESCE(active, is_active, 1) = 1 THEN 1 ELSE 0 END) AS active_users,
                SUM(CASE WHEN COALESCE(active, is_active, 1) = 0 THEN 1 ELSE 0 END) AS inactive_users,
                SUM(CASE WHEN LOWER(COALESCE(role, '')) IN ('admin', 'super admin', 'master_admin', 'administrator', 'master') OR username = 'admin' OR user_type_id = 1 THEN 1 ELSE 0 END) AS admin_users,
                SUM(CASE WHEN LOWER(COALESCE(role, '')) NOT IN ('admin', 'super admin', 'master_admin', 'administrator', 'master') AND username != 'admin' AND (user_type_id != 1 OR user_type_id IS NULL) THEN 1 ELSE 0 END) AS standard_users,
                SUM(CASE WHEN device_verification_required = 1 THEN 1 ELSE 0 END) AS device_verification_required_users
            FROM users
        `);

        // 2. Roles breakdown & count
        const [roleRows] = await db.execute(`
            SELECT 
                COALESCE(ut.type_name, ut.name, u.role, 'Unassigned') AS role_name,
                COUNT(u.id) AS count
            FROM users u
            LEFT JOIN user_types ut ON u.user_type_id = ut.id
            GROUP BY COALESCE(ut.type_name, ut.name, u.role, 'Unassigned')
            ORDER BY count DESC
        `);

        let totalUserTypes = 0;
        try {
            const [[userTypeCount]] = await db.execute(`SELECT COUNT(*) AS total_types FROM user_types`);
            totalUserTypes = Number(userTypeCount?.total_types || 0);
        } catch (e) {
            console.warn("Could not query user_types count:", e.message);
        }

        // 3. Device counts
        let deviceStats = {
            pending: 0,
            approved: 0,
            revoked: 0,
            totalLogs: 0
        };
        try {
            const [[deviceCounts]] = await db.execute(`
                SELECT 
                    SUM(CASE WHEN status = 'pending' AND closed_at IS NULL THEN 1 ELSE 0 END) AS pending_devices,
                    SUM(CASE WHEN status = 'approved' AND closed_at IS NULL THEN 1 ELSE 0 END) AS approved_devices,
                    SUM(CASE WHEN status = 'revoked' OR closed_at IS NOT NULL THEN 1 ELSE 0 END) AS revoked_devices,
                    COUNT(*) AS total_device_logs
                FROM user_devices
            `);
            deviceStats = {
                pending: Number(deviceCounts?.pending_devices || 0),
                approved: Number(deviceCounts?.approved_devices || 0),
                revoked: Number(deviceCounts?.revoked_devices || 0),
                totalLogs: Number(deviceCounts?.total_device_logs || 0)
            };
        } catch (e) {
            console.warn("Could not query user_devices:", e.message);
        }

        // 4. Chat & Workspace statistics
        let chatStats = {
            total_conversations: 0,
            direct_chats: 0,
            group_channels: 0,
            total_messages: 0,
            total_attachments: 0,
            total_polls: 0
        };

        try {
            const [[convCounts]] = await db.execute(`
                SELECT 
                    COUNT(*) AS total_conversations,
                    SUM(CASE WHEN type = 'DIRECT' THEN 1 ELSE 0 END) AS direct_chats,
                    SUM(CASE WHEN type = 'GROUP' THEN 1 ELSE 0 END) AS group_channels
                FROM conversations
            `);
            const [[msgCounts]] = await db.execute(`SELECT COUNT(*) AS total_messages FROM messages`);
            
            let totalAttachments = 0;
            try {
                const [[attCounts]] = await db.execute(`SELECT COUNT(*) AS total_attachments FROM message_attachments`);
                totalAttachments = Number(attCounts?.total_attachments || 0);
            } catch (err) {}

            let totalPolls = 0;
            try {
                const [[pollCounts]] = await db.execute(`SELECT COUNT(*) AS total_polls FROM polls`);
                totalPolls = Number(pollCounts?.total_polls || 0);
            } catch (err) {}

            chatStats = {
                total_conversations: Number(convCounts?.total_conversations || 0),
                direct_chats: Number(convCounts?.direct_chats || 0),
                group_channels: Number(convCounts?.group_channels || 0),
                total_messages: Number(msgCounts?.total_messages || 0),
                total_attachments: totalAttachments,
                total_polls: totalPolls
            };
        } catch (e) {
            console.warn("Could not query chat tables for stats:", e.message);
        }

        // 5. Recent pending devices preview
        let recentPending = [];
        try {
            const [recentPendingRows] = await db.execute(`
                SELECT 
                    d.id, d.device_id, d.submitted_at,
                    u.name AS user_name, u.email AS user_email, u.username
                FROM user_devices d
                JOIN users u ON u.id = d.user_id
                WHERE d.status = 'pending' AND d.closed_at IS NULL
                ORDER BY d.submitted_at DESC
                LIMIT 5
            `);
            recentPending = recentPendingRows;
        } catch (e) {
            console.warn("Could not query recent pending devices:", e.message);
        }

        // 6. Recent audit logs preview
        let recentAuditLogs = [];
        try {
            const [recentLogs] = await db.execute(`
                SELECT id, username, master_name, change_type, created_at
                FROM audit_logs
                ORDER BY created_at DESC
                LIMIT 5
            `);
            recentAuditLogs = recentLogs;
        } catch (e) {
            console.warn("Could not query recent audit logs:", e.message);
        }

        return res.status(200).json({
            success: true,
            stats: {
                users: {
                    total: Number(userCounts?.total_users || 0),
                    active: Number(userCounts?.active_users || 0),
                    inactive: Number(userCounts?.inactive_users || 0),
                    admins: Number(userCounts?.admin_users || 0),
                    standard: Number(userCounts?.standard_users || 0),
                    verificationRequired: Number(userCounts?.device_verification_required_users || 0)
                },
                userTypes: {
                    totalTypes: totalUserTypes,
                    distribution: roleRows.map(r => ({ name: r.role_name, count: Number(r.count) }))
                },
                devices: {
                    ...deviceStats,
                    recentPending
                },
                workspace: chatStats,
                recentAuditLogs
            }
        });
    } catch (error) {
        console.error("Fetch Dashboard Stats Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const fetchUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const query = `
            SELECT 
                u.id, COALESCE(u.name, u.full_name) AS name, u.username, u.email, u.mob_no, u.role,
                u.company_id, comp.company_name, comp.company_code,
                d.status AS device_status, COALESCE(ut.type_name, ut.name) AS type_name,
                u.user_type_id, d.device_id, device_verification_required, COALESCE(u.active, u.is_active, 1) AS active,
                u.can_chat_all_departments, u.allowed_chat_departments,
                u.can_chat_all_companies, u.allowed_chat_companies
            FROM users u
            LEFT JOIN user_devices d ON d.user_id = u.id AND d.closed_at IS NULL
            LEFT JOIN user_types ut ON u.user_type_id = ut.id
            LEFT JOIN companies comp ON u.company_id = comp.id
            WHERE u.id = ?
        `;
        const [rows] = await db.execute(query, [id]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const user = rows[0];

        let parsedAllowedChatDepts = [];
        if (user.allowed_chat_departments) {
            try {
                parsedAllowedChatDepts = typeof user.allowed_chat_departments === 'string'
                    ? JSON.parse(user.allowed_chat_departments)
                    : user.allowed_chat_departments;
                if (!Array.isArray(parsedAllowedChatDepts)) parsedAllowedChatDepts = [];
            } catch (_) { parsedAllowedChatDepts = []; }
        }
        user.allowed_chat_departments = parsedAllowedChatDepts;

        let parsedAllowedChatCompanies = { companyIds: [], departmentIds: [] };
        if (user.allowed_chat_companies) {
            try {
                const val = typeof user.allowed_chat_companies === 'string'
                    ? JSON.parse(user.allowed_chat_companies)
                    : user.allowed_chat_companies;
                if (Array.isArray(val)) {
                    parsedAllowedChatCompanies = { companyIds: val.map(Number), departmentIds: [] };
                } else if (val && typeof val === 'object') {
                    parsedAllowedChatCompanies = {
                        companyIds: Array.isArray(val.companyIds) ? val.companyIds.map(Number) : [],
                        departmentIds: Array.isArray(val.departmentIds) ? val.departmentIds.map(Number) : []
                    };
                }
            } catch (_) { parsedAllowedChatCompanies = { companyIds: [], departmentIds: [] }; }
        }
        user.allowed_chat_companies = parsedAllowedChatCompanies;
        user.can_chat_all_companies = Boolean(user.can_chat_all_companies);
        user.can_chat_all_departments = Boolean(user.can_chat_all_departments);

        const [deptRows] = await db.execute(`
            SELECT ud.department_id, ud.department_role, d.department_name
            FROM user_departments ud
            JOIN departments d ON ud.department_id = d.id
            WHERE ud.user_id = ? AND d.status = 'ACTIVE'
        `, [id]);
        user.departments = deptRows;
        return res.status(200).json({ success: true, user });
    } catch (error) {
        console.error("Fetch User By Id Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const deleteUserByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await db.execute("DELETE FROM users WHERE id = ?", [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        return res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        console.error("Delete User Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Server Error" });
    }
};

const revokeSingleDeviceController = async (req, res) => {
    try {
        const { deviceRowId } = req.params;
        const adminId = req.user.id;
        await revokeDevice(deviceRowId, adminId);
        return res.status(200).json({ success: true, message: "Device revoked successfully" });
    } catch (error) {
        console.error("Revoke Single Device Error:", error);
        return res.status(500).json({ success: false, message: "Server Error" });
    }
};

const bulkImportUsersController = async (req, res) => {
    try {
        const { users: rawUsers, options = {} } = req.body;

        if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No user records provided for bulk import."
            });
        }

        const skipDuplicates = options.skipDuplicates !== false; // default true
        const defaultPassword = options.defaultPassword || "Password123!";
        const enforcePasswordChange = options.mustChangePassword !== false; // default true
        const defaultDeviceVerification = options.deviceVerificationRequired !== false; // default true

        // 1. Fetch metadata mappings for resolving companies, departments, user types
        const [companyRows] = await db.execute("SELECT id, company_name, company_code FROM companies");
        const [deptRows] = await db.execute("SELECT id, department_name, company_id FROM departments");
        const [userTypeRows] = await db.execute("SELECT id, COALESCE(type_name, name) AS type_name, is_vendor FROM user_types");

        // Build lookup maps (lowercased)
        const companyMap = new Map();
        companyRows.forEach(c => {
            companyMap.set(String(c.id), c.id);
            if (c.company_name) companyMap.set(c.company_name.toLowerCase().trim(), c.id);
            if (c.company_code) companyMap.set(c.company_code.toLowerCase().trim(), c.id);
        });

        const deptMap = new Map();
        deptRows.forEach(d => {
            deptMap.set(String(d.id), d.id);
            if (d.department_name) {
                const normName = d.department_name.toLowerCase().trim();
                if (!deptMap.has(normName)) {
                    deptMap.set(normName, d.id);
                }
            }
        });

        const userTypeMap = new Map();
        let defaultUserTypeId = null;
        userTypeRows.forEach(ut => {
            userTypeMap.set(String(ut.id), ut);
            if (ut.type_name) {
                const normName = ut.type_name.toLowerCase().trim();
                userTypeMap.set(normName, ut);
                if (normName.includes("standard") || normName.includes("employee") || normName.includes("user")) {
                    if (!defaultUserTypeId) defaultUserTypeId = ut.id;
                }
            }
        });
        if (!defaultUserTypeId && userTypeRows.length > 0) {
            const nonAdmin = userTypeRows.find(u => u.id !== 1);
            defaultUserTypeId = nonAdmin ? nonAdmin.id : userTypeRows[0].id;
        }

        // 2. Fetch existing users to check collisions
        const [existingUserRows] = await db.execute("SELECT id, email, username FROM users");
        const existingEmails = new Set(existingUserRows.map(u => (u.email || "").toLowerCase().trim()));
        const existingUsernames = new Set(existingUserRows.map(u => (u.username || "").toLowerCase().trim()));

        const batchEmails = new Set();
        const batchUsernames = new Set();

        const createdUsers = [];
        const skippedUsers = [];

        // Pre-hash the default password
        const defaultPasswordHash = await bcrypt.hash(defaultPassword, 10);

        for (let i = 0; i < rawUsers.length; i++) {
            const row = rawUsers[i];
            const rowNumber = i + 1;

            // Normalize fields across headers
            const rawName = row.name || row.fullName || row["Full Name"] || row["full_name"] || row["Name"] || "";
            const rawEmail = row.email || row.Email || row["email_address"] || row["Email Address"] || "";
            const rawUsername = row.username || row.Username || row["User Name"] || "";
            const rawPassword = row.password || row.Password || defaultPassword;
            const rawMobNo = row.mobNo || row.mob_no || row.mobile || row["Mobile"] || row["Mobile Number"] || row["Phone"] || null;
            const rawRole = (row.role || row.Role || "user").toLowerCase().trim();
            const rawCompany = row.company || row.companyId || row.company_id || row["Company"] || row["Company Name"] || "";
            const rawDepartments = row.departments || row.department || row["Department"] || row["Departments"] || "";
            const rawDeptRole = (row.departmentRole || row.deptRole || row["Department Role"] || "USER").toUpperCase().trim();
            const rawUserType = row.userType || row.userTypeId || row.user_type_id || row["User Type"] || row["User Type Name"] || "";
            const rawIsVendor = row.isVendor !== undefined ? row.isVendor : (row.is_vendor !== undefined ? row.is_vendor : row["Is Vendor"]);
            const rawCanChatVendor = row.canChatWithVendors !== undefined ? row.canChatWithVendors : (row.can_chat_with_vendors !== undefined ? row.can_chat_with_vendors : row["Can Chat With Vendors"]);
            const rawDeviceVerif = row.deviceVerificationRequired !== undefined ? row.deviceVerificationRequired : (row.device_verification_required !== undefined ? row.device_verification_required : row["Device Verification Required"]);
            const rawDateOfJoin = row.dateOfJoin || row.date_of_join || row["Date of Joining"] || row["Joining Date"] || null;

            const name = String(rawName).trim();
            const email = String(rawEmail).trim().toLowerCase();

            // Validate Name
            if (!name) {
                skippedUsers.push({ row: rowNumber, name: name || "Empty", email: email || "Empty", reason: "Full Name is required" });
                continue;
            }

            // Validate Email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) {
                skippedUsers.push({ row: rowNumber, name, email: email || "Empty", reason: "Invalid or missing email address" });
                continue;
            }

            // Check email duplication
            if (existingEmails.has(email)) {
                if (skipDuplicates) {
                    skippedUsers.push({ row: rowNumber, name, email, reason: "Email already exists in system" });
                    continue;
                } else {
                    return res.status(400).json({
                        success: false,
                        message: `Row ${rowNumber}: User with email "${email}" already exists.`
                    });
                }
            }

            if (batchEmails.has(email)) {
                skippedUsers.push({ row: rowNumber, name, email, reason: "Duplicate email within uploaded batch" });
                continue;
            }

            // Determine unique username
            let baseUsername = String(rawUsername || "").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
            if (!baseUsername) {
                baseUsername = email.split("@")[0].replace(/[^a-z0-9._-]/g, "");
            }
            if (!baseUsername) {
                baseUsername = `user_${Date.now().toString(36)}`;
            }

            let candidateUsername = baseUsername;
            let counter = 1;
            while (existingUsernames.has(candidateUsername) || batchUsernames.has(candidateUsername)) {
                candidateUsername = `${baseUsername}_${counter}`;
                counter++;
            }
            const finalUsername = candidateUsername;

            // Password handling
            let finalPasswordHash = defaultPasswordHash;
            let finalPlainPassword = defaultPassword;
            if (rawPassword && rawPassword !== defaultPassword) {
                finalPlainPassword = String(rawPassword);
                finalPasswordHash = await bcrypt.hash(finalPlainPassword, 10);
            }

            // Role
            const finalRole = rawRole === "admin" ? "admin" : "user";

            // Company resolution
            let resolvedCompanyId = 1;
            if (rawCompany) {
                const normComp = String(rawCompany).toLowerCase().trim();
                if (companyMap.has(normComp)) {
                    resolvedCompanyId = companyMap.get(normComp);
                }
            }

            // User Type & Vendor resolution
            let resolvedUserTypeId = defaultUserTypeId;
            let isVendor = false;
            if (rawUserType) {
                const normUt = String(rawUserType).toLowerCase().trim();
                if (userTypeMap.has(normUt)) {
                    const utObj = userTypeMap.get(normUt);
                    resolvedUserTypeId = utObj.id;
                    if (utObj.is_vendor) isVendor = true;
                }
            }

            // Explicit Vendor flag overrides
            if (rawIsVendor !== undefined && rawIsVendor !== null && rawIsVendor !== "") {
                const str = String(rawIsVendor).toLowerCase().trim();
                isVendor = str === "yes" || str === "1" || str === "true" || str === "vendor";
            }

            let canChatWithVendors = false;
            if (rawCanChatVendor !== undefined && rawCanChatVendor !== null && rawCanChatVendor !== "") {
                const str = String(rawCanChatVendor).toLowerCase().trim();
                canChatWithVendors = str === "yes" || str === "1" || str === "true";
            }

            // Device verification flag
            let deviceVerificationRequired = defaultDeviceVerification;
            if (rawDeviceVerif !== undefined && rawDeviceVerif !== null && rawDeviceVerif !== "") {
                const str = String(rawDeviceVerif).toLowerCase().trim();
                deviceVerificationRequired = str === "yes" || str === "1" || str === "true";
            }
            if (finalRole === "admin") {
                deviceVerificationRequired = false;
            }

            // Date of Join
            let dateOfJoin = null;
            if (rawDateOfJoin) {
                const parsedDate = new Date(rawDateOfJoin);
                if (!isNaN(parsedDate.getTime())) {
                    dateOfJoin = parsedDate.toISOString().slice(0, 10);
                }
            }

            // Department resolution
            const deptAssignments = [];
            if (rawDepartments) {
                let deptList = [];
                if (Array.isArray(rawDepartments)) {
                    deptList = rawDepartments;
                } else if (typeof rawDepartments === "string") {
                    deptList = rawDepartments.split(/[,;|]/).map(d => d.trim()).filter(Boolean);
                }

                for (const deptItem of deptList) {
                    const normDept = String(deptItem).toLowerCase().trim();
                    if (deptMap.has(normDept)) {
                        const dId = deptMap.get(normDept);
                        if (!deptAssignments.some(a => a.departmentId === dId)) {
                            deptAssignments.push({
                                departmentId: dId,
                                role: rawDeptRole === "ADMIN" ? "ADMIN" : "USER"
                            });
                        }
                    }
                }
            }

            // Create User in DB
            try {
                const newUser = await createUser(
                    name,
                    finalUsername,
                    email,
                    finalPlainPassword,
                    finalPasswordHash,
                    resolvedUserTypeId,
                    rawMobNo ? String(rawMobNo).trim() : null,
                    dateOfJoin,
                    deviceVerificationRequired,
                    true, // active
                    finalRole,
                    true, // allowWhatsapp
                    enforcePasswordChange, // mustChangePassword
                    isVendor,
                    canChatWithVendors
                );

                if (newUser && newUser.insertId) {
                    const newUserId = newUser.insertId;

                    // Set company_id and default chat permissions
                    await db.execute(
                        "UPDATE users SET company_id = ?, can_chat_all_departments = 1, can_chat_all_companies = 1 WHERE id = ?",
                        [resolvedCompanyId, newUserId]
                    );

                    // Assign departments
                    if (deptAssignments.length > 0) {
                        await assignUserDepartments(newUserId, deptAssignments);
                    }

                    // Add to default groups
                    await addUserToDefaultGroups(newUserId);

                    batchEmails.add(email);
                    existingEmails.add(email);
                    batchUsernames.add(finalUsername);
                    existingUsernames.add(finalUsername);

                    createdUsers.push({
                        row: rowNumber,
                        id: newUserId,
                        name,
                        username: finalUsername,
                        email,
                        role: finalRole,
                        companyId: resolvedCompanyId,
                        departmentsCount: deptAssignments.length,
                        isVendor
                    });
                }
            } catch (createErr) {
                console.error(`Error importing row ${rowNumber} (${email}):`, createErr);
                skippedUsers.push({
                    row: rowNumber,
                    name,
                    email,
                    reason: createErr.message || "Database insert error"
                });
            }
        }

        // Audit Log
        try {
            const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Admin Browser';
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Admin',
                adminDeviceId,
                'Bulk Employee Import',
                'created',
                null,
                {
                    totalRows: rawUsers.length,
                    createdCount: createdUsers.length,
                    skippedCount: skippedUsers.length,
                    timestamp: new Date().toISOString()
                }
            );
        } catch (auditErr) {
            console.warn("Could not write audit log for bulk import:", auditErr.message);
        }

        return res.status(200).json({
            success: true,
            message: `Bulk import completed: ${createdUsers.length} created, ${skippedUsers.length} skipped.`,
            summary: {
                total: rawUsers.length,
                created: createdUsers.length,
                skipped: skippedUsers.length
            },
            createdUsers,
            skippedUsers
        });

    } catch (error) {
        console.error("Bulk Import Users Error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to process bulk import"
        });
    }
};

const generateBulkImportTemplateController = async (req, res) => {
    try {
        if (!ExcelJS) {
            try {
                ExcelJS = require("exceljs");
            } catch (err) {
                return res.status(500).json({
                    success: false,
                    message: "ExcelJS module is not yet installed on this server. Please upload exceljs_addon.zip into your backend folder and extract it."
                });
            }
        }

        // 1. Fetch live master data for dropdowns
        const [companyRows] = await db.execute(
            "SELECT DISTINCT company_name FROM companies WHERE (status = 'ACTIVE' OR status IS NULL) AND company_name IS NOT NULL AND TRIM(company_name) != '' ORDER BY company_name ASC"
        );
        const [deptRows] = await db.execute(
            "SELECT DISTINCT department_name FROM departments WHERE (status = 'ACTIVE' OR status IS NULL) AND department_name IS NOT NULL AND TRIM(department_name) != '' ORDER BY department_name ASC"
        );
        const [userTypeRows] = await db.execute(
            "SELECT DISTINCT COALESCE(type_name, name) AS type_name FROM user_types WHERE COALESCE(type_name, name) IS NOT NULL AND TRIM(COALESCE(type_name, name)) != '' ORDER BY type_name ASC"
        );

        let companies = companyRows.map(r => r.company_name?.trim()).filter(Boolean);
        if (companies.length === 0) companies = ["Epoxy House"];

        let departments = deptRows.map(r => r.department_name?.trim()).filter(Boolean);
        if (departments.length === 0) departments = ["Sales", "Operations", "Procurement", "Support"];

        let userTypes = userTypeRows.map(r => r.type_name?.trim()).filter(Boolean);
        if (userTypes.length === 0) userTypes = ["Standard User", "Vendor / External Partner"];

        // 2. Initialize ExcelJS Workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Epoxy House Admin";
        workbook.created = new Date();

        // 3. Sheet 1: Main Employee Import Template
        const wsTemplate = workbook.addWorksheet("Employees_Template", {
            views: [{ showGridLines: true }]
        });

        wsTemplate.columns = [
            { header: "Full Name*", key: "name", width: 22 },
            { header: "Username", key: "username", width: 18 },
            { header: "Email*", key: "email", width: 28 },
            { header: "Password", key: "password", width: 16 },
            { header: "Mobile Number", key: "mobile", width: 18 },
            { header: "Company", key: "company", width: 22 },
            { header: "Departments", key: "departments", width: 26 },
            { header: "Department Role", key: "deptRole", width: 18 },
            { header: "User Type", key: "userType", width: 26 },
            { header: "Role", key: "role", width: 12 },
            { header: "Is Vendor", key: "isVendor", width: 12 },
            { header: "Can Chat With Vendors", key: "canChatWithVendors", width: 24 },
            { header: "Device Verification Required", key: "deviceVerificationRequired", width: 26 },
            { header: "Date of Joining", key: "dateOfJoin", width: 18 }
        ];

        // Format Header Row
        const headerRow = wsTemplate.getRow(1);
        headerRow.height = 26;
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        headerRow.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF1E293B" } // Slate-800
        };
        headerRow.alignment = { vertical: "middle", horizontal: "center" };

        // Sample Data Rows (3 realistic sample rows)
        const sampleRows = [
            {
                name: "Rajesh Patel",
                username: "rajesh.patel",
                email: "rajesh.patel@example.com",
                password: "",
                mobile: "+91 9876543210",
                company: companies[0] || "Epoxy House",
                departments: departments[0] || "Sales, Marketing",
                deptRole: "USER",
                userType: userTypes[0] || "Standard User",
                role: "user",
                isVendor: "No",
                canChatWithVendors: "Yes",
                deviceVerificationRequired: "Yes",
                dateOfJoin: "2026-01-15"
            },
            {
                name: "Anita Sharma",
                username: "anita.sharma",
                email: "anita.sharma@example.com",
                password: "",
                mobile: "+91 9876543211",
                company: companies[0] || "Epoxy House",
                departments: departments[1] || departments[0] || "Operations",
                deptRole: "ADMIN",
                userType: userTypes[0] || "Standard User",
                role: "user",
                isVendor: "No",
                canChatWithVendors: "No",
                deviceVerificationRequired: "Yes",
                dateOfJoin: "2026-02-01"
            },
            {
                name: "Vikram Malhotra",
                username: "vikram.vendor",
                email: "vikram@resinsupplier.com",
                password: "",
                mobile: "+91 9876543212",
                company: companies[0] || "Epoxy House",
                departments: departments[2] || departments[0] || "Procurement",
                deptRole: "USER",
                userType: userTypes.find(t => t.toLowerCase().includes("vendor")) || userTypes[1] || userTypes[0] || "Vendor / External Partner",
                role: "user",
                isVendor: "Yes",
                canChatWithVendors: "No",
                deviceVerificationRequired: "Yes",
                dateOfJoin: "2026-02-15"
            }
        ];

        sampleRows.forEach(row => wsTemplate.addRow(row));

        // 4. Sheet 2: Preloaded Masters Data (Reference Sheet)
        const wsMasters = workbook.addWorksheet("Masters_Data", {
            views: [{ showGridLines: true }]
        });

        wsMasters.columns = [
            { header: "Company Name", key: "comp", width: 28 },
            { header: "Department Name", key: "dept", width: 28 },
            { header: "User Type Name", key: "utype", width: 28 }
        ];

        const mHeader = wsMasters.getRow(1);
        mHeader.height = 24;
        mHeader.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        mHeader.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF334155" } // Slate-700
        };
        mHeader.alignment = { vertical: "middle", horizontal: "center" };

        const maxMasterRows = Math.max(companies.length, departments.length, userTypes.length);
        for (let i = 0; i < maxMasterRows; i++) {
            wsMasters.addRow([
                companies[i] || "",
                departments[i] || "",
                userTypes[i] || ""
            ]);
        }

        // 5. Sheet 3: Field Guide & Instructions
        const wsGuide = workbook.addWorksheet("Instructions_Guide", {
            views: [{ showGridLines: true }]
        });
        wsGuide.columns = [
            { header: "Column Name", width: 30 },
            { header: "Requirement", width: 16 },
            { header: "Allowed Values / Examples", width: 34 },
            { header: "Description & Defaults", width: 60 }
        ];

        const gHeader = wsGuide.getRow(1);
        gHeader.height = 24;
        gHeader.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        gHeader.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0F172A" }
        };
        gHeader.alignment = { vertical: "middle", horizontal: "center" };

        const guideRows = [
            ["Full Name*", "REQUIRED", "e.g. John Doe, Rajesh Patel", "Employee's full legal or display name."],
            ["Email*", "REQUIRED", "e.g. user@domain.com", "Must be a valid, unique email address."],
            ["Username", "OPTIONAL", "e.g. jdoe, rajesh.p", "If left empty, auto-generated from email username."],
            ["Password", "OPTIONAL", "e.g. SecurePass123", "If left empty, default 'Password123!' is assigned."],
            ["Mobile Number", "OPTIONAL", "e.g. +91 9876543210", "Contact mobile or phone number."],
            ["Company", "OPTIONAL", "Dropdown / Preloaded Master", "Select from dropdown. Defaults to main company if empty."],
            ["Departments", "OPTIONAL", "Dropdown or Comma-separated", "Select from dropdown or enter comma-separated department names."],
            ["Department Role", "OPTIONAL", "USER or ADMIN", "Role inside assigned department. Default is USER."],
            ["User Type", "OPTIONAL", "Dropdown / Preloaded Master", "Select from dropdown. Defaults to Standard User if empty."],
            ["Role", "OPTIONAL", "user or admin", "System permission role. Default is user."],
            ["Is Vendor", "OPTIONAL", "Yes or No", "Set Yes for external contractors/suppliers."],
            ["Can Chat With Vendors", "OPTIONAL", "Yes or No", "Permit internal user to chat with vendors. Default No."],
            ["Device Verification Required", "OPTIONAL", "Yes or No", "Whether PC hardware approval is required. Default Yes."],
            ["Date of Joining", "OPTIONAL", "YYYY-MM-DD", "Official start date e.g. 2026-01-15."],
            ["", "", "", ""],
            ["SECURITY POLICY", "", "", ""],
            ["All imported users will be required to change their password on first login for security.", "", "", ""]
        ];
        guideRows.forEach(r => wsGuide.addRow(r));

        // 6. Apply Data Validation Dropdowns to wsTemplate for rows 2 through 1000
        const compFormula = `'Masters_Data'!$A$2:$A$${companies.length + 1}`;
        const deptFormula = `'Masters_Data'!$B$2:$B$${departments.length + 1}`;
        const typeFormula = `'Masters_Data'!$C$2:$C$${userTypes.length + 1}`;

        for (let r = 2; r <= 1000; r++) {
            // 1. Company (Col 6 / F) - Preloaded Dropdown
            wsTemplate.getCell(`F${r}`).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: [compFormula],
                showErrorMessage: true,
                errorTitle: "Invalid Company",
                error: "Please select an active company from the preloaded dropdown list"
            };

            // 2. Departments (Col 7 / G) - Preloaded Dropdown
            // Note: showErrorMessage: false allows users to either pick 1 from the dropdown or type comma-separated multiple
            wsTemplate.getCell(`G${r}`).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: [deptFormula],
                showErrorMessage: false,
                promptTitle: "Departments",
                prompt: "Select a department from the dropdown or type comma-separated departments"
            };

            // Department Role (Col 8 / H)
            wsTemplate.getCell(`H${r}`).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: ['"USER,ADMIN"']
            };

            // 3. User Type (Col 9 / I) - Preloaded Dropdown
            wsTemplate.getCell(`I${r}`).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: [typeFormula],
                showErrorMessage: true,
                errorTitle: "Invalid User Type",
                error: "Please select an active user type from the preloaded dropdown list"
            };

            // Role (Col 10 / J)
            wsTemplate.getCell(`J${r}`).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: ['"user,admin"']
            };

            // Is Vendor (Col 11 / K)
            wsTemplate.getCell(`K${r}`).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: ['"No,Yes"']
            };

            // Can Chat With Vendors (Col 12 / L)
            wsTemplate.getCell(`L${r}`).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: ['"No,Yes"']
            };

            // Device Verification Required (Col 13 / M)
            wsTemplate.getCell(`M${r}`).dataValidation = {
                type: "list",
                allowBlank: true,
                formulae: ['"Yes,No"']
            };
        }

        // 7. Stream workbook directly to client response
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="EpoxyHouse_Employee_Import_Template.xlsx"'
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("generateBulkImportTemplateController error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate Excel template: " + error.message
        });
    }
};

module.exports = {
    fetchUsers,
    fetchUserById,
    createUserByAdmin,
    bulkImportUsersController,
    generateBulkImportTemplateController,
    updateUserByAdmin,
    deleteUserByAdmin,
    approveDeviceController,
    revokeDeviceController,
    revokeSingleDeviceController,
    fetchAuditLogs,
    fetchUserAuditLogs,
    fetchActivityLogs,
    fetchPendingDevices,
    toggleUserActiveController,
    getDashboardStats
};

