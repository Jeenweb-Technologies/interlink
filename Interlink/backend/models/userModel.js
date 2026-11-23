const db = require("../config/db.js");

const createUsersTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NULL,
            full_name VARCHAR(100) DEFAULT NULL,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(150) NOT NULL UNIQUE,
            password VARCHAR(255) NULL,
            password_hash VARCHAR(255) DEFAULT NULL,
            role VARCHAR(50) DEFAULT 'user',
            role_id INT DEFAULT NULL,
            user_type_id INT DEFAULT NULL,
            mob_no VARCHAR(20) DEFAULT NULL,
            date_of_join DATE DEFAULT NULL,
            device_verification_required BOOLEAN DEFAULT TRUE,
            device_id VARCHAR(255) DEFAULT NULL,
            modules JSON DEFAULT NULL,
            active BOOLEAN DEFAULT TRUE,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ON UPDATE CURRENT_TIMESTAMP
        )
    `;

    await db.execute(query);

    const columnsToEnsure = [
        {
            name: 'name',
            query: 'ALTER TABLE users ADD COLUMN name VARCHAR(100) NULL AFTER id'
        },
        {
            name: 'full_name',
            query: 'ALTER TABLE users ADD COLUMN full_name VARCHAR(100) DEFAULT NULL'
        },
        {
            name: 'password',
            query: 'ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL AFTER email'
        },
        {
            name: 'password_hash',
            query: 'ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) DEFAULT NULL'
        },
        {
            name: 'active',
            query: 'ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT TRUE'
        },
        {
            name: 'is_active',
            query: 'ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE'
        },
        {
            name: 'user_type_id',
            query: 'ALTER TABLE users ADD COLUMN user_type_id INT DEFAULT NULL'
        },
        {
            name: 'mob_no',
            query: 'ALTER TABLE users ADD COLUMN mob_no VARCHAR(20) DEFAULT NULL'
        },
        {
            name: 'date_of_join',
            query: 'ALTER TABLE users ADD COLUMN date_of_join DATE DEFAULT NULL'
        },
        {
            name: 'device_verification_required',
            query: 'ALTER TABLE users ADD COLUMN device_verification_required BOOLEAN DEFAULT TRUE'
        },
        {
            name: 'device_id',
            query: 'ALTER TABLE users ADD COLUMN device_id VARCHAR(255) DEFAULT NULL'
        },
        {
            name: 'username',
            query: 'ALTER TABLE users ADD COLUMN username VARCHAR(50) DEFAULT NULL'
        },
        {
            name: 'role_id',
            query: 'ALTER TABLE users ADD COLUMN role_id INT DEFAULT NULL'
        },
        {
            name: 'modules',
            query: 'ALTER TABLE users ADD COLUMN modules JSON DEFAULT NULL'
        },
        {
            name: 'allow_whatsapp',
            query: 'ALTER TABLE users ADD COLUMN allow_whatsapp BOOLEAN DEFAULT TRUE'
        },
        {
            name: 'can_chat_all_departments',
            query: 'ALTER TABLE users ADD COLUMN can_chat_all_departments BOOLEAN DEFAULT FALSE'
        },
        {
            name: 'allowed_chat_departments',
            query: 'ALTER TABLE users ADD COLUMN allowed_chat_departments JSON DEFAULT NULL'
        },
        {
            name: 'company_id',
            query: 'ALTER TABLE users ADD COLUMN company_id INT DEFAULT NULL'
        },
        {
            name: 'can_chat_all_companies',
            query: 'ALTER TABLE users ADD COLUMN can_chat_all_companies BOOLEAN DEFAULT FALSE'
        },
        {
            name: 'allowed_chat_companies',
            query: 'ALTER TABLE users ADD COLUMN allowed_chat_companies JSON DEFAULT NULL'
        },
        {
            name: 'is_vendor',
            query: 'ALTER TABLE users ADD COLUMN is_vendor BOOLEAN DEFAULT FALSE'
        },
        {
            name: 'can_chat_with_vendors',
            query: 'ALTER TABLE users ADD COLUMN can_chat_with_vendors BOOLEAN DEFAULT FALSE'
        },
        {
            name: 'must_change_password',
            query: 'ALTER TABLE users ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE'
        },
        {
            name: 'updated_at',
            query: 'ALTER TABLE users ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
        }
    ];

    for (const column of columnsToEnsure) {
        try {
            const [rows] = await db.execute(`SHOW COLUMNS FROM users LIKE '${column.name}'`);
            if (rows.length === 0) {
                await db.execute(column.query);
            }
        } catch (err) {}
    }

    // Assign default company (1) to existing users if unassigned
    try {
        await db.execute("UPDATE users SET company_id = 1 WHERE company_id IS NULL");
    } catch (e) {}

    // Sync redundant columns between legacy dumps and updated schema
    try {
        await db.execute("UPDATE users SET name = full_name WHERE (name IS NULL OR name = '') AND full_name IS NOT NULL");
        await db.execute("UPDATE users SET full_name = name WHERE (full_name IS NULL OR full_name = '') AND name IS NOT NULL");
        await db.execute("UPDATE users SET password = password_hash WHERE (password IS NULL OR password = '') AND password_hash IS NOT NULL");
        await db.execute("UPDATE users SET password_hash = password WHERE (password_hash IS NULL OR password_hash = '') AND password IS NOT NULL");
        await db.execute("UPDATE users SET active = is_active WHERE active IS NULL");
        await db.execute("UPDATE users SET is_active = active WHERE is_active IS NULL");
        await db.execute("UPDATE users SET role = 'admin' WHERE LOWER(role) IN ('master_admin', 'super admin', 'administrator', 'master') OR username = 'admin' OR user_type_id = 1");
        await db.execute("UPDATE users SET device_verification_required = 0 WHERE LOWER(role) IN ('admin', 'master_admin', 'super admin', 'administrator', 'master') OR username = 'admin' OR user_type_id = 1");
    } catch (e) {}

    // Add UNIQUE index on username if not already present
    try {
        const [indexes] = await db.execute(`SHOW INDEX FROM users WHERE Key_name = 'username'`);
        if (indexes.length === 0) {
            await db.execute(`
                UPDATE users
                SET username = CONCAT('user_', id)
                WHERE username IS NULL OR username = ''
            `);
            await db.execute(`ALTER TABLE users ADD UNIQUE INDEX username (username)`);
        }
    } catch (e) {
        console.warn("Could not add username unique index (may already exist):", e.message);
    }

    console.log("Users table ready");
};

const initUserModel = async () => {
    await createUsersTable();
};

const createUser = async (
    name,
    username,
    email,
    rawPassword,
    hashedPassword,
    userTypeId = null,
    mobNo = null,
    dateOfJoin = null,
    deviceVerificationRequired = true,
    active = true,
    role = 'user',
    allowWhatsapp = true,
    mustChangePassword = true,
    isVendor = false,
    canChatWithVendors = false
) => {
    const roleId = (role === 'admin' || role === 'super admin' || role === 'master_admin') ? 1 : 2;
    const displayName = name || username || "User";
    const plainPass = rawPassword || hashedPassword;

    const query = `
        INSERT INTO users
        (name, full_name, username, email, password, password_hash, user_type_id, mob_no, date_of_join, device_verification_required, active, is_active, role, role_id, allow_whatsapp, must_change_password, is_vendor, can_chat_with_vendors)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(query, [
        displayName,
        displayName,
        username,
        email,
        plainPass,
        hashedPassword,
        userTypeId ? Number(userTypeId) : null,
        mobNo || null,
        dateOfJoin || null,
        deviceVerificationRequired ? 1 : 0,
        active ? 1 : 0,
        active ? 1 : 0,
        role || 'user',
        roleId,
        allowWhatsapp ? 1 : 0,
        mustChangePassword ? 1 : 0,
        isVendor ? 1 : 0,
        canChatWithVendors ? 1 : 0
    ]);

    return result;
};

const findUserByEmail = async (email) => {
    const query = `
        SELECT * FROM users
        WHERE email = ?
    `;

    const [rows] = await db.execute(query, [email]);
    return rows[0];
};

const findUserByUsername = async (username) => {
    if (!username) return null;
    const clean = String(username).trim();
    const query = `
        SELECT u.*, COALESCE(ut.type_name, ut.name) AS user_type_name
        FROM users u
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
        WHERE LOWER(TRIM(u.username)) = LOWER(?) OR LOWER(TRIM(u.email)) = LOWER(?)
    `;

    const [rows] = await db.execute(query, [clean, clean]);
    if (!rows[0]) return null;
    const u = rows[0];
    if (!u.name && u.full_name) u.name = u.full_name;
    if (!u.full_name && u.name) u.full_name = u.name;
    if (!u.password && u.password_hash) u.password = u.password_hash;
    if (!u.password_hash && u.password) u.password_hash = u.password;
    return u;
};

const getAllUsers = async (includeInactive = false) => {
    const whereClause = includeInactive ? '' : 'WHERE (u.active = TRUE OR u.is_active = TRUE)';
    const query = `
        SELECT 
            u.id, COALESCE(u.name, u.full_name) AS name, u.username, u.email,
            u.user_type_id, u.mob_no, u.date_of_join, u.device_verification_required,
            COALESCE(ut.type_name, ut.name) AS user_type_name, COALESCE(u.active, u.is_active, 1) AS active,
            u.role, COALESCE(u.allow_whatsapp, 1) AS allow_whatsapp,
            COALESCE(u.is_vendor, 0) AS is_vendor,
            COALESCE(u.can_chat_with_vendors, 0) AS can_chat_with_vendors,
            COALESCE(u.must_change_password, 0) AS must_change_password,
            u.company_id, comp.company_name
        FROM users u
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
        LEFT JOIN companies comp ON u.company_id = comp.id
        ${whereClause}
        ORDER BY COALESCE(u.name, u.full_name) ASC
    `;

    const [rows] = await db.execute(query);

    // Fetch user department assignments
    const [deptRows] = await db.execute(`
        SELECT ud.user_id, ud.department_id, ud.department_role, d.department_name
        FROM user_departments ud
        JOIN departments d ON ud.department_id = d.id
        WHERE d.status = 'ACTIVE'
    `);

    const deptMap = new Map();
    for (const d of deptRows) {
        if (!deptMap.has(d.user_id)) {
            deptMap.set(d.user_id, []);
        }
        deptMap.get(d.user_id).push({
            department_id: d.department_id,
            department_name: d.department_name,
            department_role: d.department_role
        });
    }

    return rows.map(u => {
        const userDepts = deptMap.get(u.id) || [];
        return {
            ...u,
            departments: userDepts,
            department_names: userDepts.map(d => d.department_name).join(', ') || 'Unassigned',
            primary_department: userDepts[0]?.department_name || 'Unassigned',
            department_role: userDepts[0]?.department_role || 'USER'
        };
    });
};

const updateUserProfile = async (userId, name, email, mob_no) => {
    const displayName = name || "";
    const query = `UPDATE users SET name = ?, full_name = ?, email = ?, mob_no = ? where id = ?`;

    const [result] = await db.execute(query, [
        displayName,
        displayName,
        email,
        mob_no,
        userId
    ]);

    return result;
};

const getUserById = async (id) => {
    const query = `SELECT * FROM users WHERE id = ?`;
    const [rows] = await db.execute(query, [id]);
    if (!rows[0]) return null;
    const u = rows[0];

    // Fetch department assignments
    const [depts] = await db.execute(`
        SELECT ud.department_id, ud.department_role, d.department_name
        FROM user_departments ud
        JOIN departments d ON ud.department_id = d.id
        WHERE ud.user_id = ? AND d.status = 'ACTIVE'
    `, [id]);
    u.departments = depts;
    if (u.allowed_chat_departments && typeof u.allowed_chat_departments === 'string') {
        try { u.allowed_chat_departments = JSON.parse(u.allowed_chat_departments); } catch (_) {}
    }
    return u;
};

const toggleUserActive = async (id, active) => {
    const query = `UPDATE users SET active = ?, is_active = ? WHERE id = ?`;
    const [result] = await db.execute(query, [active ? 1 : 0, active ? 1 : 0, id]);
    return result;
};

const searchCoworkers = async (searchTerm, excludeUserId = null, departmentIds = null, userScope = null, filterOptions = {}) => {
    let where = "WHERE (u.active = TRUE OR u.is_active = TRUE)";
    const params = [];

    if (excludeUserId) {
        where += " AND u.id != ?";
        params.push(excludeUserId);
    }

    // Vendor Boundary Isolation:
    const currentUserIsVendor = Boolean(userScope?.isVendor);
    const userCanChatWithVendors = Boolean(userScope?.canChatWithVendors || userScope?.isGlobalAdmin);

    if (currentUserIsVendor) {
        // Vendors cannot initiate chats with other vendors or discover fellow vendors
        where += " AND (u.is_vendor = 0 OR u.is_vendor IS NULL)";
    } else if (!userCanChatWithVendors) {
        // Staff without vendor chat permission cannot discover or initiate chats with vendors
        where += " AND (u.is_vendor = 0 OR u.is_vendor IS NULL)";
    }

    // Explicit Filter Options (e.g. from CreateGroupModal for company-wise or multi-department group)
    const explicitCompIds = Array.isArray(filterOptions.companyIds) ? filterOptions.companyIds.map(Number).filter(Boolean) : [];
    const explicitDeptIds = Array.isArray(filterOptions.departmentIds) ? filterOptions.departmentIds.map(Number).filter(Boolean) : [];

    if (explicitCompIds.length > 0) {
        const placeholders = explicitCompIds.map(() => '?').join(',');
        where += ` AND u.company_id IN (${placeholders})`;
        params.push(...explicitCompIds);
    }

    if (explicitDeptIds.length > 0) {
        const placeholders = explicitDeptIds.map(() => '?').join(',');
        where += ` AND u.id IN (
            SELECT DISTINCT user_id FROM user_departments WHERE department_id IN (${placeholders})
        )`;
        params.push(...explicitDeptIds);
    }

    // Company & Department boundary filtering (when explicit filters are not already applied)
    if (explicitCompIds.length === 0 && explicitDeptIds.length === 0) {
        if (userScope && !userScope.isGlobalAdmin) {
            if (userScope.canChatAllCompanies) {
                // Can chat across all companies, just filter by departmentIds if applicable
                if (Array.isArray(departmentIds) && departmentIds.length > 0) {
                    const placeholders = departmentIds.map(() => '?').join(',');
                    where += ` AND u.id IN (
                        SELECT DISTINCT user_id FROM user_departments WHERE department_id IN (${placeholders})
                    )`;
                    params.push(...departmentIds);
                } else if (Array.isArray(departmentIds) && departmentIds.length === 0) {
                    return [];
                }
            } else {
                const allowedCompObj = userScope.allowedChatCompanies || {};
                const allowedCompIds = Array.isArray(allowedCompObj.companyIds) ? allowedCompObj.companyIds : [];
                const allowedCrossDepts = Array.isArray(allowedCompObj.departmentIds) ? allowedCompObj.departmentIds : [];
                const ownCompId = userScope.companyId;

                if (allowedCompIds.length > 0) {
                    // User can chat with OWN company (under regular departmentIds scope)
                    // OR selected partner companies (under allowedCrossDepts scope, or any dept if empty)
                    const partnerPlaceholders = allowedCompIds.map(() => '?').join(',');

                    let ownCompDeptClause = "";
                    const ownCompDeptParams = [];
                    if (Array.isArray(departmentIds) && departmentIds.length > 0) {
                        const pl = departmentIds.map(() => '?').join(',');
                        ownCompDeptClause = `AND u.id IN (SELECT DISTINCT user_id FROM user_departments WHERE department_id IN (${pl}))`;
                        ownCompDeptParams.push(...departmentIds);
                    }

                    let partnerCompDeptClause = "";
                    const partnerCompDeptParams = [];
                    if (allowedCrossDepts.length > 0) {
                        const pl = allowedCrossDepts.map(() => '?').join(',');
                        partnerCompDeptClause = `AND u.id IN (SELECT DISTINCT user_id FROM user_departments WHERE department_id IN (${pl}))`;
                        partnerCompDeptParams.push(...allowedCrossDepts);
                    }

                    if (ownCompId) {
                        where += ` AND (
                            ( (u.company_id = ? OR u.company_id IS NULL) ${ownCompDeptClause} )
                            OR
                            ( u.company_id IN (${partnerPlaceholders}) ${partnerCompDeptClause} )
                        )`;
                        params.push(ownCompId, ...ownCompDeptParams, ...allowedCompIds, ...partnerCompDeptParams);
                    } else {
                        where += ` AND (
                            ( u.company_id IS NULL ${ownCompDeptClause} )
                            OR
                            ( u.company_id IN (${partnerPlaceholders}) ${partnerCompDeptClause} )
                        )`;
                        params.push(...ownCompDeptParams, ...allowedCompIds, ...partnerCompDeptParams);
                    }
                } else {
                    // Restricted to own company only
                    if (ownCompId) {
                        where += " AND (u.company_id = ? OR u.company_id IS NULL)";
                        params.push(ownCompId);
                    }
                    if (Array.isArray(departmentIds) && departmentIds.length > 0) {
                        const placeholders = departmentIds.map(() => '?').join(',');
                        where += ` AND u.id IN (
                            SELECT DISTINCT user_id FROM user_departments WHERE department_id IN (${placeholders})
                        )`;
                        params.push(...departmentIds);
                    } else if (Array.isArray(departmentIds) && departmentIds.length === 0) {
                        return [];
                    }
                }
            }
        } else {
            // Fallback / legacy or global admin without company restriction
            if (Array.isArray(departmentIds) && departmentIds.length > 0) {
                const placeholders = departmentIds.map(() => '?').join(',');
                where += ` AND u.id IN (
                    SELECT DISTINCT user_id FROM user_departments WHERE department_id IN (${placeholders})
                )`;
                params.push(...departmentIds);
            } else if (Array.isArray(departmentIds) && departmentIds.length === 0) {
                return [];
            }
        }
    }

    if (searchTerm && searchTerm.trim()) {
        where += " AND (COALESCE(u.name, u.full_name) LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.mob_no LIKE ?)";
        const pattern = `%${searchTerm.trim()}%`;
        params.push(pattern, pattern, pattern, pattern);
    }

    const query = `
        SELECT 
            u.id, COALESCE(u.name, u.full_name) AS name, u.username, u.email, u.mob_no, u.role, u.user_type_id,
            u.company_id, comp.company_name, comp.company_code,
            COALESCE(ut.type_name, ut.name) AS user_type_name,
            COALESCE(u.is_vendor, 0) AS is_vendor,
            COALESCE(u.can_chat_with_vendors, 0) AS can_chat_with_vendors
        FROM users u
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
        LEFT JOIN companies comp ON u.company_id = comp.id
        ${where}
        ORDER BY COALESCE(u.name, u.full_name) ASC
        LIMIT 50
    `;
    const [rows] = await db.execute(query, params);

    // Fetch department tags for search results
    if (rows.length > 0) {
        const uids = rows.map(r => r.id);
        const placeholders = uids.map(() => '?').join(',');
        const [deptRows] = await db.execute(`
            SELECT ud.user_id, ud.department_id, ud.department_role, d.department_name
            FROM user_departments ud
            JOIN departments d ON ud.department_id = d.id
            WHERE ud.user_id IN (${placeholders}) AND d.status = 'ACTIVE'
        `, uids);

        const deptMap = new Map();
        for (const d of deptRows) {
            if (!deptMap.has(d.user_id)) deptMap.set(d.user_id, []);
            deptMap.get(d.user_id).push(d);
        }

        return rows.map(r => {
            const depts = deptMap.get(r.id) || [];
            return {
                ...r,
                departments: depts,
                department_name: depts.map(d => d.department_name).join(', ') || 'General'
            };
        });
    }

    return rows;
};

module.exports = {
    initUserModel,
    createUsersTable,
    createUser,
    findUserByEmail,
    findUserByUsername,
    getAllUsers,
    updateUserProfile,
    getUserById,
    toggleUserActive,
    searchCoworkers
};