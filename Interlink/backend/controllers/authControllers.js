const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db.js");

const {
    findUserByUsername,
    updateUserProfile
} = require("../models/userModel.js");

const { findCompaniesByOrgId } = require("../models/companyModel.js");

const { createAuditLog } = require("../models/auditLogModel.js");

const {
    getApprovedDevice,
    getPendingDevice,
    createPendingDevice
} = require("../models/deviceModel.js");
const { getUserDepartments } = require("../models/departmentModel.js");

// Helper to record login activity in audit logs
const logLoginEvent = async (user, effectiveDeviceId, req, roleName) => {
    try {
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Browser';
        await createAuditLog(
            user.id,
            user.name || user.username || 'User',
            effectiveDeviceId,
            'Account Login',
            'login',
            null,
            {
                username: user.username,
                name: user.name || user.full_name || user.username,
                role: roleName,
                device_id: effectiveDeviceId,
                ip_address: String(clientIp).replace('::ffff:', ''),
                user_agent: userAgent,
                status: 'Success'
            }
        );
    } catch (auditErr) {
        console.error("Failed to log login audit:", auditErr);
    }
};

// Helper to record logout activity in audit logs
const logLogoutEvent = async (user, effectiveDeviceId, req, roleName) => {
    try {
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Browser';
        await createAuditLog(
            user.id,
            user.name || user.username || 'User',
            effectiveDeviceId,
            'Account Logout',
            'logout',
            null,
            {
                username: user.username,
                name: user.name || user.full_name || user.username,
                role: roleName || user.role || 'User',
                device_id: effectiveDeviceId,
                ip_address: String(clientIp).replace('::ffff:', ''),
                user_agent: userAgent,
                status: 'Success'
            }
        );
    } catch (auditErr) {
        console.error("Failed to log logout audit:", auditErr);
    }
};

// Robust password verification supporting plain-text and bcrypt hash
const verifyUserPassword = async (cleanPassword, user) => {
    if (!cleanPassword || !user) return false;

    const trimmedInput = String(cleanPassword).trim();
    const storedPlain = user.password ? String(user.password).trim() : null;
    const storedHash = user.password_hash ? String(user.password_hash).trim() : null;

    // 1. Direct case-sensitive plain-text match if stored in user.password or user.password_hash
    if (storedPlain && storedPlain === trimmedInput) {
        return true;
    }
    if (storedHash && storedHash === trimmedInput) {
        return true;
    }

    // 3. Bcrypt comparison against password_hash (if it starts with $2)
    if (storedHash && (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$'))) {
        try {
            const isMatch = await bcrypt.compare(trimmedInput, storedHash);
            if (isMatch) return true;
        } catch (_) {}
    }

    // 4. Bcrypt comparison against password column (if password was stored as a bcrypt hash)
    if (storedPlain && (storedPlain.startsWith('$2a$') || storedPlain.startsWith('$2b$') || storedPlain.startsWith('$2y$'))) {
        try {
            const isMatch = await bcrypt.compare(trimmedInput, storedPlain);
            if (isMatch) return true;
        } catch (_) {}
    }

    // 5. Fallback passwords for administrator maintenance only
    const uname = String(user.username || '').toLowerCase().trim();
    const isAdmin = (user.role && ['admin', 'master_admin', 'super admin', 'administrator', 'master'].includes(String(user.role).toLowerCase().trim())) ||
                    uname === 'admin' ||
                    Number(user.user_type_id) === 1 ||
                    Number(user.role_id) === 1;

    if (isAdmin) {
        if (['admin', 'password123!', 'admin123', 'admin123!'].includes(trimmedInput.toLowerCase())) {
            return true;
        }
    }

    return false;
};

// ================= LOGIN =================

const login = async (req, res) => {
    try {
        const {
            username,
            password,
            deviceId
        } = req.body;

        const effectiveDeviceId = deviceId || req.headers['x-device-id'] || req.headers['device-id'] || 'BROWSER_DEVICE';

        const cleanUsername = String(username || '').trim();
        const cleanPassword = String(password || '').trim();

        // Validate Input
        if (!cleanUsername || !cleanPassword) {
            return res.status(400).json({
                success: false,
                message: "Username and password are required"
            });
        }

        // Find User
        const user = await findUserByUsername(cleanUsername);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (user.active === 0 || user.active === false) {
            return res.status(403).json({
                success: false,
                message: "Your account is deactivated. Please contact an administrator."
            });
        }

        console.log(`[AUTH-LOGIN] Attempt for "${cleanUsername}"`);

        // Compare Password (supports plain-text, bcrypt hash, and admin fallbacks)
        const isPasswordCorrect = await verifyUserPassword(cleanPassword, user);
        if (!isPasswordCorrect) {
            console.warn(`[AUTH-LOGIN] FAILED: Password mismatch for user "${cleanUsername}" (ID: ${user.id})`);
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }
        console.log(`[AUTH-LOGIN] SUCCESS: Password verified for user "${cleanUsername}" (ID: ${user.id})`);

        const userDepartments = await getUserDepartments(user.id);
        const departmentIds = userDepartments.map(d => d.department_id);

        // ================= ORGANIZATION STATUS GUARD =================
        // Check organization approval status (unless platform developer / superadmin)
        const isDeveloper = user.role === "super_admin" || user.role === "super admin" || user.role === "developer";
        if (!isDeveloper && user.organization_id) {
            const [orgRows] = await db.execute(
                "SELECT name, status FROM organizations WHERE id = ?",
                [user.organization_id]
            );
            const org = orgRows[0];
            if (org) {
                if (org.status === 'pending') {
                    return res.status(403).json({
                        success: false,
                        status: "ORG_PENDING_APPROVAL",
                        message: `The registration for "${org.name}" is awaiting developer approval. You will be able to log in once approved.`
                    });
                }
                if (org.status === 'rejected') {
                    return res.status(403).json({
                        success: false,
                        status: "ORG_REJECTED",
                        message: `The registration request for "${org.name}" was declined. Please contact support.`
                    });
                }
                if (org.status === 'suspended') {
                    return res.status(403).json({
                        success: false,
                        status: "ORG_SUSPENDED",
                        message: `Organization "${org.name}" has been suspended by the platform administrator.`
                    });
                }
            }
        }

        if (user.active === 0 || user.active === false) {
            return res.status(403).json({
                success: false,
                message: "Your account is deactivated. Please contact an administrator."
            });
        }

        // ================= ADMIN LOGIN =================
        const userOrgId = user.organization_id || 1;
        const userCompId = user.company_id || 1;
        let userCompanies = [];
        try {
            userCompanies = await findCompaniesByOrgId(userOrgId);
        } catch (e) {
            console.warn("Could not fetch user companies:", e.message);
        }

        const isAdminRole = (user.role && ['admin', 'master_admin', 'super admin', 'super_admin', 'administrator', 'master', 'developer'].includes(String(user.role).toLowerCase().trim())) ||
                            user.username === 'admin' ||
                            user.username === 'developer' ||
                            Number(user.user_type_id) === 1 ||
                            Number(user.role_id) === 1;

        if (isAdminRole) {
            const token = jwt.sign(
                {
                    id: user.id,
                    role: user.role || 'admin',
                    name: user.name || user.full_name,
                    username: user.username,
                    mob_no: user.mob_no,
                    user_type_id: user.user_type_id || 1,
                    organization_id: userOrgId,
                    company_id: userCompId,
                    department_ids: departmentIds,
                    departments: userDepartments
                },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            await logLoginEvent(user, effectiveDeviceId, req, 'Administrator');

            return res.status(200).json({
                success: true,
                message: "Admin login successful",
                token,
                user: {
                    id: user.id,
                    name: user.name || user.full_name || 'Admin',
                    username: user.username,
                    email: user.email,
                    role: 'admin',
                    user_type_id: user.user_type_id || 1,
                    user_type_name: user.user_type_name || "Super Admin",
                    mob_no: user.mob_no,
                    organization_id: userOrgId,
                    company_id: userCompId,
                    companies: userCompanies,
                    modules: user.modules || [],
                    departments: userDepartments,
                    department_ids: departmentIds,
                    must_change_password: Boolean(user.must_change_password),
                    is_vendor: Boolean(user.is_vendor),
                    can_chat_with_vendors: Boolean(user.can_chat_with_vendors)
                }
            });
        }

        // ================= DEVICE MATCHING FOR NON-ADMINS =================
        const isDeviceVerificationRequired = 
            user.device_verification_required === 1 ||
            user.device_verification_required === true ||
            user.device_verification_required === '1' ||
            String(user.device_verification_required).toLowerCase() === 'true';

        if (!isDeviceVerificationRequired) {
            const token = jwt.sign(
                {
                    id: user.id,
                    role: user.role || 'user',
                    name: user.name || user.full_name,
                    username: user.username,
                    mob_no: user.mob_no,
                    user_type_id: user.user_type_id,
                    organization_id: userOrgId,
                    company_id: userCompId,
                    department_ids: departmentIds,
                    departments: userDepartments,
                    device_allow_download: true,
                    must_change_password: Boolean(user.must_change_password),
                    is_vendor: Boolean(user.is_vendor),
                    can_chat_with_vendors: Boolean(user.can_chat_with_vendors)
                },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            await logLoginEvent(user, effectiveDeviceId, req, user.user_type_name || user.role || 'User');

            return res.status(200).json({
                success: true,
                message: "Login successful",
                token,
                user: {
                    id: user.id,
                    name: user.name || user.full_name,
                    username: user.username,
                    email: user.email,
                    role: user.role || 'user',
                    user_type_id: user.user_type_id,
                    user_type_name: user.user_type_name || 'Standard User',
                    mob_no: user.mob_no,
                    organization_id: userOrgId,
                    company_id: userCompId,
                    companies: userCompanies,
                    modules: user.modules || [],
                    departments: userDepartments,
                    department_ids: departmentIds,
                    device_allow_download: true,
                    must_change_password: Boolean(user.must_change_password),
                    is_vendor: Boolean(user.is_vendor),
                    can_chat_with_vendors: Boolean(user.can_chat_with_vendors)
                }
            });
        }

        const approvedDevice = await getApprovedDevice(user.id);

        if (approvedDevice) {
            if (approvedDevice.device_id === effectiveDeviceId || approvedDevice.device_id === deviceId) {
                // Device matches, login successful
                const allowDownload = approvedDevice.allow_download !== 0 && approvedDevice.allow_download !== false;
                const token = jwt.sign(
                    {
                        id: user.id,
                        role: user.role || 'user',
                        name: user.name || user.full_name,
                        username: user.username,
                        mob_no: user.mob_no,
                        user_type_id: user.user_type_id,
                        organization_id: userOrgId,
                        company_id: userCompId,
                        department_ids: departmentIds,
                        departments: userDepartments,
                        device_allow_download: allowDownload,
                        must_change_password: Boolean(user.must_change_password),
                        is_vendor: Boolean(user.is_vendor),
                        can_chat_with_vendors: Boolean(user.can_chat_with_vendors)
                    },
                    process.env.JWT_SECRET,
                    { expiresIn: "1d" }
                );

                await logLoginEvent(user, effectiveDeviceId, req, user.user_type_name || user.role || 'User');

                return res.status(200).json({
                    success: true,
                    message: "Login successful",
                    token,
                    user: {
                        id: user.id,
                        name: user.name || user.full_name,
                        username: user.username,
                        email: user.email,
                        role: user.role || 'user',
                        user_type_id: user.user_type_id,
                        user_type_name: user.user_type_name || 'Standard User',
                        mob_no: user.mob_no,
                        organization_id: userOrgId,
                        company_id: userCompId,
                        companies: userCompanies,
                        modules: user.modules || [],
                        departments: userDepartments,
                        department_ids: departmentIds,
                        device_allow_download: allowDownload,
                        must_change_password: Boolean(user.must_change_password),
                        is_vendor: Boolean(user.is_vendor),
                        can_chat_with_vendors: Boolean(user.can_chat_with_vendors)
                    }
                });
            } else {
                // Device mismatch, check if they have a pending device for this deviceId
                const pendingDevice = await getPendingDevice(user.id);
                if (pendingDevice && (pendingDevice.device_id === effectiveDeviceId || pendingDevice.device_id === deviceId)) {
                    return res.status(200).json({
                        success: false,
                        status: "PENDING_APPROVAL"
                    });
                }
                return res.status(200).json({
                    success: false,
                    status: "DEVICE_REGISTRATION_REQUIRED",
                    message: "New device detected. Registration required."
                });
            }
        }

        // No approved device found
        const pendingDevice = await getPendingDevice(user.id);
        if (pendingDevice) {
            return res.status(200).json({
                success: false,
                status: "PENDING_APPROVAL"
            });
        }

        // No pending or approved device, needs registration
        return res.status(200).json({
            success: false,
            status: "DEVICE_REGISTRATION_REQUIRED"
        });

    } catch (error) {
        console.error("Login Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

// ================= REQUEST DEVICE REGISTRATION =================

const requestDeviceRegistration = async (req, res) => {
    try {
        const { username, password, deviceId } = req.body;

        const cleanUsername = String(username || '').trim();
        const cleanPassword = String(password || '').trim();

        if (!cleanUsername || !cleanPassword || !deviceId) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const user = await findUserByUsername(cleanUsername);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.active === 0 || user.active === false) {
            return res.status(403).json({
                success: false,
                message: "Your account is deactivated. Please contact an administrator."
            });
        }

        const isPasswordCorrect = await verifyUserPassword(cleanPassword, user);

        if (!isPasswordCorrect) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        // Create pending device
        await createPendingDevice(user.id, deviceId);

        await createAuditLog(
            user.id,
            user.name || user.username || 'Unknown',
            deviceId,
            'Device Management',
            'registration_requested',
            null,
            {
                user_id: user.id,
                username: user.username,
                device_id: deviceId,
                status: 'pending'
            }
        );

        return res.status(200).json({
            success: true,
            status: "PENDING_APPROVAL"
        });

    } catch (error) {
        console.error("Device Registration Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};


// ================= LOGOUT =================

const logout = async (req, res) => {
    try {
        let user = req.user;
        const effectiveDeviceId = req.body?.deviceId || req.headers['x-device-id'] || req.headers['device-id'] || 'BROWSER_DEVICE';

        if (!user && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith("Bearer ")) {
                const token = authHeader.split(" ")[1];
                try {
                    user = jwt.verify(token, process.env.JWT_SECRET || "default_secret_key");
                } catch (e) {
                    try {
                        user = jwt.decode(token);
                    } catch (decodeErr) {}
                }
            }
        }

        if (!user && req.body?.userId) {
            user = { id: req.body.userId, username: req.body.username || 'User', name: req.body.name || req.body.username };
        }

        if (user && user.id) {
            try {
                const [rows] = await db.query(
                    `SELECT u.id, u.username, u.name, r.name as role_name 
                     FROM users u 
                     LEFT JOIN roles r ON u.role_id = r.id 
                     WHERE u.id = ?`,
                    [user.id]
                );
                if (rows.length > 0) {
                    user = { ...user, ...rows[0] };
                }
            } catch (err) {}

            await logLogoutEvent(user, effectiveDeviceId, req, user.role_name || user.role);

            // Notify active sockets if socket instance is attached
            try {
                const io = req.app.get("io");
                if (io) {
                    io.emit("user:offline", { userId: user.id });
                }
            } catch (ioErr) {}
        }

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });
    } catch (error) {
        console.error("Logout Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

// ================= UPDATE PROFILE =================

const updateProfileController = async (req, res) => {
    try {
        const { name, email, mob_no } = req.body;
        const userId = req.user.id;

        if (!name || !email || !mob_no) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and mobile number are required"
            });
        }

        await updateUserProfile(userId, name, email, mob_no);

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: {
                id: userId,
                name,
                email,
                mob_no,
                role: req.user.role
            }
        });

    } catch (error) {
        console.error("Update Profile Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

// ================= GET MY PERMISSIONS =================
const getMyPermissions = async (req, res) => {
    try {
        const userId = req.user.id;
        const role = String(req.user.role || '').toLowerCase().trim();
        const isAdmin = ['admin', 'master_admin', 'super admin', 'administrator', 'master'].includes(role) ||
                        req.user.username === 'admin' ||
                        Number(req.user.user_type_id) === 1 ||
                        Number(req.user.role_id) === 1;

        // Admin has unrestricted access ΓÇö return a wildcard flag or full permissions
        if (isAdmin) {
            return res.status(200).json({
                success: true,
                isAdmin: true,
                permissions: {}
            });
        }

        // Get the user's user_type_id
        const [userRows] = await db.execute(
            'SELECT user_type_id FROM users WHERE id = ?',
            [userId]
        );

        if (!userRows.length || !userRows[0].user_type_id) {
            return res.status(200).json({
                success: true,
                isAdmin: false,
                permissions: {}
            });
        }

        const userTypeId = userRows[0].user_type_id;

        // Fetch all permission rows for this user type
        const [rows] = await db.execute(
            `SELECT master_name, can_read, can_write, can_update, can_delete
             FROM user_type_permissions
             WHERE user_type_id = ?`,
            [userTypeId]
        );

        // Build a keyed map: { location_type: { read, write, update, delete }, ... }
        const permissions = {};
        for (const row of rows) {
            permissions[row.master_name] = {
                read: !!row.can_read,
                write: !!row.can_write,
                update: !!row.can_update,
                delete: !!row.can_delete,
            };
        }

        // Check if user has an active approved device that restricts download
        const [devRows] = await db.execute(
            "SELECT allow_download FROM user_devices WHERE user_id = ? AND status = 'approved' AND closed_at IS NULL LIMIT 1",
            [userId]
        );
        if (devRows.length > 0 && (devRows[0].allow_download === 0 || devRows[0].allow_download === false)) {
            permissions['document_download'] = {
                read: false,
                write: false,
                update: false,
                delete: false
            };
        }

        return res.status(200).json({
            success: true,
            isAdmin: false,
            permissions
        });

    } catch (error) {
        console.error('getMyPermissions Error:', error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const getActiveUsersController = async (req, res) => {
    try {
        const { getAllUsers } = require("../models/userModel.js");
        const users = await getAllUsers(false);
        const mapped = users.map(u => ({
            id: u.id,
            name: u.name,
            username: u.username,
            email: u.email
        }));
        return res.status(200).json({
            success: true,
            data: mapped
        });
    } catch (error) {
        console.error("Get Active Users Error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};

const changeFirstPasswordController = async (req, res) => {
    try {
        const userId = req.user.id;
        const { newPassword, confirmPassword } = req.body;

        const cleanNew = String(newPassword || '').trim();
        const cleanConfirm = String(confirmPassword || '').trim();

        if (!cleanNew || !cleanConfirm) {
            return res.status(400).json({
                success: false,
                message: "New password and confirm password are required"
            });
        }

        if (cleanNew !== cleanConfirm) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match. Please verify your typing."
            });
        }

        if (cleanNew.length < 6) {
            return res.status(400).json({
                success: false,
                message: "New password must be at least 6 characters long."
            });
        }

        if (cleanNew.toLowerCase() === 'password123!') {
            return res.status(400).json({
                success: false,
                message: "You cannot reuse the default password. Please choose a new, secure password."
            });
        }

        const [currentUserRows] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);
        const currentUser = currentUserRows[0];
        if (currentUser) {
            if (currentUser.username && cleanNew.toLowerCase() === String(currentUser.username).toLowerCase().trim()) {
                return res.status(400).json({
                    success: false,
                    message: "Password cannot be your username."
                });
            }
            if (currentUser.password && cleanNew === String(currentUser.password).trim()) {
                return res.status(400).json({
                    success: false,
                    message: "New password cannot be the same as your current password."
                });
            }
        }

        const hashedPassword = await bcrypt.hash(cleanNew, 10);

        // Store plain password in password, hashed in password_hash, and clear must_change_password
        await db.execute(
            "UPDATE users SET password = ?, password_hash = ?, must_change_password = 0, updated_at = NOW() WHERE id = ?",
            [cleanNew, hashedPassword, userId]
        );

        try {
            const clientDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'BROWSER';
            await createAuditLog(
                userId,
                req.user.name || req.user.username || 'User',
                clientDeviceId,
                'Password Change',
                'First-time mandatory password set',
                null,
                { username: req.user.username, status: 'Success' }
            );
        } catch (_) {}

        const [rows] = await db.execute("SELECT * FROM users WHERE id = ?", [userId]);
        const updated = rows[0] || {};
        const userDepartments = await getUserDepartments(userId);
        const departmentIds = userDepartments.map(d => d.department_id);

        // Generate updated JWT token reflecting completed password change
        const refreshedToken = jwt.sign(
            {
                id: updated.id,
                role: updated.role || 'user',
                name: updated.name || updated.full_name,
                username: updated.username,
                mob_no: updated.mob_no,
                user_type_id: updated.user_type_id,
                department_ids: departmentIds,
                departments: userDepartments,
                device_allow_download: true,
                must_change_password: false,
                is_vendor: Boolean(updated.is_vendor),
                can_chat_with_vendors: Boolean(updated.can_chat_with_vendors)
            },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        return res.status(200).json({
            success: true,
            message: "Password updated successfully! Welcome to your workspace.",
            token: refreshedToken,
            user: {
                id: updated.id,
                name: updated.name || updated.full_name,
                username: updated.username,
                email: updated.email,
                role: updated.role,
                user_type_id: updated.user_type_id,
                mob_no: updated.mob_no,
                departments: userDepartments,
                department_ids: departmentIds,
                must_change_password: false,
                is_vendor: Boolean(updated.is_vendor),
                can_chat_with_vendors: Boolean(updated.can_chat_with_vendors)
            }
        });
    } catch (error) {
        console.error("changeFirstPassword Error:", error);
        return res.status(500).json({
            success: false,
            message: "Server error occurred while updating password."
        });
    }
};

const registerOrganization = async (req, res) => {
    try {
        const {
            orgName,
            companyName,
            name,
            username,
            email,
            password,
            mob_no
        } = req.body;

        if (!orgName || !name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Organization name, admin name, email, and password are required"
            });
        }

        const finalUsername = username || email.split("@")[0];

        // Check if user already exists
        const existingUser = await findUserByUsername(finalUsername);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Username or email is already registered"
            });
        }

        // 1. Create Organization (Default status: pending)
        let orgId;
        try {
            const [orgResult] = await db.execute(
                "INSERT INTO organizations (name, email, status) VALUES (?, ?, 'pending')",
                [orgName.trim(), email.trim()]
            );
            orgId = orgResult.insertId;
        } catch (orgErr) {
            if (orgErr.code === 'ER_BAD_FIELD_ERROR') {
                const [orgResult] = await db.execute(
                    "INSERT INTO organizations (name) VALUES (?)",
                    [orgName.trim()]
                );
                orgId = orgResult.insertId;
                db.execute("ALTER TABLE organizations ADD COLUMN email VARCHAR(150) DEFAULT NULL").catch(() => {});
                db.execute("ALTER TABLE organizations ADD COLUMN status VARCHAR(50) DEFAULT 'pending'").catch(() => {});
            } else {
                throw orgErr;
            }
        }

        // 2. Create First Company under this Organization
        const compName = (companyName && companyName.trim()) ? companyName.trim() : `${orgName.trim()} Main`;
        let companyId;
        try {
            const [compResult] = await db.execute(
                "INSERT INTO companies (organization_id, name, email) VALUES (?, ?, ?)",
                [orgId, compName, email.trim()]
            );
            companyId = compResult.insertId;
        } catch (compErr) {
            if (compErr.code === 'ER_BAD_FIELD_ERROR') {
                const [compResult] = await db.execute(
                    "INSERT INTO companies (organization_id, name) VALUES (?, ?)",
                    [orgId, compName]
                );
                companyId = compResult.insertId;
                db.execute("ALTER TABLE companies ADD COLUMN email VARCHAR(150) DEFAULT NULL").catch(() => {});
                db.execute("ALTER TABLE companies ADD COLUMN phone VARCHAR(50) DEFAULT NULL").catch(() => {});
            } else {
                throw compErr;
            }
        }

        // 3. Create Admin User (Created with active=0 until developer approves org)
        const hashedPassword = await bcrypt.hash(password, 10);
        const [userResult] = await db.execute(`
            INSERT INTO users (
                name, username, email, password, role,
                organization_id, company_id,
                mob_no, device_verification_required, active
            ) VALUES (?, ?, ?, ?, 'admin', ?, ?, ?, 0, 0)
        `, [
            name.trim(),
            finalUsername,
            email.trim(),
            hashedPassword,
            orgId,
            companyId,
            mob_no || null
        ]);

        const newUserId = userResult.insertId;

        // Create audit log
        try {
            await createAuditLog(
                newUserId,
                finalUsername,
                "WEB_REGISTER",
                "organizations",
                "PENDING_APPROVAL",
                null,
                JSON.stringify({ orgId, orgName, companyId, companyName: compName, status: "pending" })
            );
        } catch (logErr) {
            console.warn("Audit log warning on register:", logErr.message);
        }

        return res.status(201).json({
            success: true,
            status: "PENDING_APPROVAL",
            message: "Organization registration submitted successfully! Awaiting developer approval before you can log in.",
            organization: { id: orgId, name: orgName, status: "pending" },
            company: { id: companyId, name: compName }
        });
    } catch (error) {
        console.error("Register Organization Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to register organization",
            error: error.message
        });
    }
};

module.exports = {
    login,
    logout,
    registerOrganization,
    updateProfileController,
    requestDeviceRegistration,
    getMyPermissions,
    getActiveUsersController,
    changeFirstPasswordController
};

