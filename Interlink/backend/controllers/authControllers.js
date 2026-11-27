const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/db.js");

const {
    findUserByUsername,
    updateUserProfile
} = require("../models/userModel.js");

const { findCompaniesByOrgId, getUserCompanies } = require("../models/companyModel.js");

const { createAuditLog } = require("../models/auditLogModel.js");

const {
    getApprovedDevice,
    getPendingDevice,
    createPendingDevice
} = require("../models/deviceModel.js");

// ================= LOGIN =================

const login = async (req, res) => {
    try {
        const {
            username,
            password,
            deviceId
        } = req.body;

        // Validate Input
        if (!username || !password || !deviceId) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        // Find User
        const user = await findUserByUsername(username);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // Compare Password
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: "Invalid credentials"
            });
        }

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
            if (user.role === "admin" || user.role === "super_admin" || user.role === "super admin" || user.role === "developer") {
                userCompanies = await findCompaniesByOrgId(userOrgId);
            } else {
                userCompanies = await getUserCompanies(user.id);
                if (userCompanies.length === 0) {
                    const [defRows] = await db.execute("SELECT id, organization_id, name, email, phone FROM companies WHERE id = ?", [userCompId]);
                    userCompanies = defRows.length > 0 ? defRows : await findCompaniesByOrgId(userOrgId);
                }
            }
        } catch (e) {
            console.warn("Could not fetch user companies:", e.message);
        }

        // ================= DEVICE VERIFICATION CHECK =================
        const isDeviceVerificationRequired = !(
            user.device_verification_required === 0 ||
            user.device_verification_required === false ||
            user.device_verification_required === '0' ||
            user.device_verification_required === 'false'
        );

        if (user.role === "admin" && !isDeviceVerificationRequired) {
            const token = jwt.sign(
                { id: user.id, role: user.role, name: user.name, username: user.username, mob_no: user.mob_no, organization_id: userOrgId, company_id: userCompId },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            return res.status(200).json({
                success: true,
                message: "Admin login successful",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    mob_no: user.mob_no,
                    organization_id: userOrgId,
                    company_id: userCompId,
                    companies: userCompanies,
                    modules: user.modules || []
                }
            });
        }

        // ================= DEVICE MATCHING =================
        if (!isDeviceVerificationRequired) {
            const token = jwt.sign(
                { id: user.id, role: user.role, name: user.name, username: user.username, mob_no: user.mob_no, organization_id: userOrgId, company_id: userCompId },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            return res.status(200).json({
                success: true,
                message: "Login successful",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    mob_no: user.mob_no,
                    organization_id: userOrgId,
                    company_id: userCompId,
                    companies: userCompanies,
                    modules: user.modules || []
                }
            });
        }

        const cleanDeviceId = String(deviceId || "").trim();

        // 1. Check if THIS device is approved for the user
        let approvedDevice = await getApprovedDevice(user.id, cleanDeviceId);

        // Fallback: check if the user's latest approved active device matches (case-insensitive / trimmed)
        if (!approvedDevice) {
            const latestApproved = await getApprovedDevice(user.id);
            if (latestApproved && String(latestApproved.device_id || "").trim().toLowerCase() === cleanDeviceId.toLowerCase()) {
                approvedDevice = latestApproved;
            }
        }

        if (approvedDevice) {
            // Device matches, login successful
            const token = jwt.sign(
                { id: user.id, role: user.role, name: user.name, username: user.username, mob_no: user.mob_no, organization_id: userOrgId, company_id: userCompId },
                process.env.JWT_SECRET,
                { expiresIn: "1d" }
            );

            return res.status(200).json({
                success: true,
                message: "Login successful",
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    mob_no: user.mob_no,
                    organization_id: userOrgId,
                    company_id: userCompId,
                    companies: userCompanies,
                    modules: user.modules || []
                }
            });
        }

        // 2. Not approved. Check if this specific device is pending approval
        const pendingDevice = await getPendingDevice(user.id, cleanDeviceId);
        if (pendingDevice) {
            return res.status(200).json({
                success: false,
                status: "PENDING_APPROVAL",
                message: "This device is awaiting administrator approval."
            });
        }

        // 3. Neither approved nor pending -> Device registration required
        return res.status(200).json({
            success: false,
            status: "DEVICE_REGISTRATION_REQUIRED",
            message: "New device detected. Registration required."
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

        if (!username || !password || !deviceId) {
            return res.status(400).json({
                success: false,
                message: "All fields are required"
            });
        }

        const user = await findUserByUsername(username);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.active === 0 || user.active === false) {
            return res.status(403).json({
                success: false,
                message: "Your account is deactivated. Please contact an administrator."
            });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        const cleanDeviceId = String(deviceId || "").trim();

        // Check if device is already approved
        const alreadyApproved = await getApprovedDevice(user.id, cleanDeviceId);
        if (alreadyApproved) {
            return res.status(200).json({
                success: true,
                status: "APPROVED",
                message: "This device is already approved. You can log in."
            });
        }

        // Check if device is already pending
        const existingPending = await getPendingDevice(user.id, cleanDeviceId);
        if (!existingPending) {
            await createPendingDevice(user.id, cleanDeviceId);
        }

        await createAuditLog(
            user.id,
            user.name || user.username || 'Unknown',
            cleanDeviceId,
            'Device Management',
            'registration_requested',
            null,
            {
                user_id: user.id,
                username: user.username,
                device_id: cleanDeviceId,
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
        const {name, email, mob_no} = req.body;
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

        // Admin has unrestricted access — return a wildcard flag or full permissions
        if (req.user.role === 'admin') {
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
                read:   !!row.can_read,
                write:  !!row.can_write,
                update: !!row.can_update,
                delete: !!row.can_delete,
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
    getActiveUsersController
};