const db = require("../config/db.js");

/**
 * Initialize department tables and conversation foreign key
 */
const createDepartmentTables = async () => {
    // 1. Departments Table
    const createDepartmentsQuery = `
        CREATE TABLE IF NOT EXISTS departments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            department_name VARCHAR(100) NOT NULL,
            description VARCHAR(255) NULL,
            status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_dept_name (department_name),
            INDEX idx_dept_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createDepartmentsQuery);

    // 2. User-Departments Junction Table
    const createUserDeptsQuery = `
        CREATE TABLE IF NOT EXISTS user_departments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            department_id INT NOT NULL,
            department_role ENUM('ADMIN', 'USER') NOT NULL DEFAULT 'USER',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uq_user_dept (user_id, department_id),
            INDEX idx_ud_user (user_id),
            INDEX idx_ud_dept (department_id),
            INDEX idx_ud_role (department_role),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createUserDeptsQuery);

    // 3. Ensure department_id column on conversations table
    try {
        const [rows] = await db.execute("SHOW COLUMNS FROM conversations LIKE 'department_id'");
        if (rows.length === 0) {
            await db.execute(`
                ALTER TABLE conversations 
                ADD COLUMN department_id INT NULL AFTER created_by,
                ADD CONSTRAINT fk_conversations_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
                ADD INDEX idx_conv_dept (department_id)
            `);
            console.log("Added department_id column to conversations table");
        }
    } catch (e) {
        // Index / Column might already exist
    }

    // 4. Ensure schema compatibility for legacy dumps (name vs department_name)
    try {
        const [deptNameCol] = await db.execute("SHOW COLUMNS FROM departments LIKE 'department_name'");
        if (deptNameCol.length === 0) {
            await db.execute("ALTER TABLE departments ADD COLUMN department_name VARCHAR(150) NULL AFTER id");
        }

        const [nameCol] = await db.execute("SHOW COLUMNS FROM departments LIKE 'name'");
        if (nameCol.length > 0) {
            await db.execute("UPDATE departments SET department_name = name WHERE (department_name IS NULL OR department_name = '') AND name IS NOT NULL");
        }

        await db.execute("ALTER TABLE departments MODIFY COLUMN status VARCHAR(20) DEFAULT 'ACTIVE'");
        await db.execute("UPDATE departments SET status = UPPER(status)");

        // Ensure dept_code is nullable if present from older schemas
        const [deptCodeCol] = await db.execute("SHOW COLUMNS FROM departments LIKE 'dept_code'");
        if (deptCodeCol.length > 0) {
            await db.execute("ALTER TABLE departments MODIFY COLUMN dept_code VARCHAR(50) NULL DEFAULT NULL");
        }
    } catch (e) {
        // Ignored if table is fresh
    }

    // 5. Ensure company_id column on departments table
    try {
        const [compCols] = await db.execute("SHOW COLUMNS FROM departments LIKE 'company_id'");
        if (compCols.length === 0) {
            await db.execute("ALTER TABLE departments ADD COLUMN company_id INT NULL AFTER id, ADD INDEX idx_dept_company (company_id)");
            console.log("Added company_id column to departments table");
        }

        // Link existing unassigned departments to default main company
        const [defaultComp] = await db.execute("SELECT id FROM companies WHERE is_main = 1 LIMIT 1");
        if (defaultComp.length > 0) {
            await db.execute("UPDATE departments SET company_id = ? WHERE company_id IS NULL", [defaultComp[0].id]);
        }
    } catch (e) {
        console.warn("Error ensuring company_id on departments:", e.message);
    }

    // 6. Adjust unique index on departments so multiple companies can each have a department with the same name
    try {
        const [indexes] = await db.execute("SHOW INDEX FROM departments WHERE Key_name = 'uq_dept_name'");
        if (indexes.length > 0) {
            await db.execute("ALTER TABLE departments DROP INDEX uq_dept_name");
        }
        const [compIndex] = await db.execute("SHOW INDEX FROM departments WHERE Key_name = 'uq_company_dept'");
        if (compIndex.length === 0) {
            await db.execute("ALTER TABLE departments ADD UNIQUE KEY uq_company_dept (company_id, department_name)");
        }
    } catch (e) {
        // Ignored if index modification not needed
    }

    console.log("Department tables ready");
};

// ─── Department CRUD ──────────────────────────────────────────────────────────

const createDepartment = async (departmentName, description = null, status = 'ACTIVE', companyId = null) => {
    const trimmedName = departmentName.trim();

    // If companyId is not provided, resolve default main company id
    let targetCompanyId = companyId ? Number(companyId) : null;
    if (!targetCompanyId) {
        try {
            const [mainComp] = await db.execute("SELECT id FROM companies WHERE is_main = 1 LIMIT 1");
            if (mainComp.length > 0) targetCompanyId = mainComp[0].id;
            else {
                const [firstComp] = await db.execute("SELECT id FROM companies LIMIT 1");
                if (firstComp.length > 0) targetCompanyId = firstComp[0].id;
            }
        } catch (_) {}
    }

    // Check if legacy column 'name' exists in departments table
    let hasNameCol = false;
    try {
        const [cols] = await db.execute("SHOW COLUMNS FROM departments LIKE 'name'");
        hasNameCol = cols.length > 0;
    } catch (e) {
        hasNameCol = false;
    }

    let query, params;
    if (hasNameCol) {
        query = `
            INSERT INTO departments (company_id, name, department_name, description, status)
            VALUES (?, ?, ?, ?, ?)
        `;
        params = [targetCompanyId, trimmedName, trimmedName, description ? description.trim() : null, status];
    } else {
        query = `
            INSERT INTO departments (company_id, department_name, description, status)
            VALUES (?, ?, ?, ?)
        `;
        params = [targetCompanyId, trimmedName, description ? description.trim() : null, status];
    }

    const [result] = await db.execute(query, params);
    return {
        id: result.insertId,
        company_id: targetCompanyId,
        department_name: trimmedName,
        name: trimmedName,
        description,
        status
    };
};

const getDepartments = async (includeInactive = true, companyId = null) => {
    const conditions = [];
    const params = [];

    if (!includeInactive) {
        conditions.push("d.status = 'ACTIVE'");
    }

    if (companyId) {
        conditions.push("d.company_id = ?");
        params.push(Number(companyId));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT 
            d.id, 
            d.company_id,
            d.department_name, 
            d.description, 
            d.status, 
            d.created_at, 
            d.updated_at,
            c.company_name,
            c.company_code,
            COUNT(DISTINCT ud.user_id) AS member_count,
            SUM(CASE WHEN ud.department_role = 'ADMIN' THEN 1 ELSE 0 END) AS admin_count
        FROM departments d
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN user_departments ud ON d.id = ud.department_id
        ${where}
        GROUP BY d.id, d.company_id, d.department_name, d.description, d.status, d.created_at, d.updated_at, c.company_name, c.company_code
        ORDER BY c.company_name ASC, d.department_name ASC
    `;
    const [rows] = await db.execute(query, params);
    return rows.map(r => ({
        ...r,
        member_count: Number(r.member_count || 0),
        admin_count: Number(r.admin_count || 0)
    }));
};

const getDepartmentById = async (departmentId) => {
    const query = `
        SELECT 
            d.id, 
            d.company_id,
            d.department_name, 
            d.description, 
            d.status, 
            d.created_at, 
            d.updated_at,
            c.company_name,
            c.company_code,
            COUNT(DISTINCT ud.user_id) AS member_count
        FROM departments d
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN user_departments ud ON d.id = ud.department_id
        WHERE d.id = ?
        GROUP BY d.id, d.company_id, d.department_name, d.description, d.status, d.created_at, d.updated_at, c.company_name, c.company_code
    `;
    const [rows] = await db.execute(query, [departmentId]);
    return rows.length > 0 ? rows[0] : null;
};

const updateDepartment = async (departmentId, { department_name, description, status, company_id, companyId }) => {
    const updates = [];
    const values = [];

    const targetCompanyId = company_id !== undefined ? company_id : companyId;
    if (targetCompanyId !== undefined) {
        updates.push("company_id = ?");
        values.push(targetCompanyId ? Number(targetCompanyId) : null);
    }

    // Check if legacy column 'name' exists in departments table
    let hasNameCol = false;
    try {
        const [cols] = await db.execute("SHOW COLUMNS FROM departments LIKE 'name'");
        hasNameCol = cols.length > 0;
    } catch (e) {
        hasNameCol = false;
    }

    if (department_name !== undefined && department_name.trim()) {
        updates.push("department_name = ?");
        values.push(department_name.trim());
        if (hasNameCol) {
            updates.push("name = ?");
            values.push(department_name.trim());
        }
    }
    if (description !== undefined) {
        updates.push("description = ?");
        values.push(description ? description.trim() : null);
    }
    if (status !== undefined && ['ACTIVE', 'INACTIVE'].includes(status.toUpperCase())) {
        updates.push("status = ?");
        values.push(status.toUpperCase());
    }

    if (updates.length > 0) {
        values.push(departmentId);
        await db.execute(`UPDATE departments SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, values);
    }

    return await getDepartmentById(departmentId);
};

const deleteDepartment = async (departmentId) => {
    const [result] = await db.execute("DELETE FROM departments WHERE id = ?", [departmentId]);
    return result.affectedRows > 0;
};

const toggleDepartmentStatus = async (departmentId, status) => {
    const newStatus = status ? 'ACTIVE' : 'INACTIVE';
    await db.execute("UPDATE departments SET status = ?, updated_at = NOW() WHERE id = ?", [newStatus, departmentId]);
    return await getDepartmentById(departmentId);
};

// ─── User-Department Assignments ─────────────────────────────────────────────

/**
 * Get all departments assigned to a specific user
 */
const getUserDepartments = async (userId) => {
    const query = `
        SELECT 
            d.id,
            d.id AS department_id,
            d.department_name,
            d.description,
            d.status AS department_status,
            d.company_id,
            c.company_name,
            c.company_code,
            ud.department_role,
            ud.created_at AS assigned_at
        FROM user_departments ud
        JOIN departments d ON ud.department_id = d.id
        LEFT JOIN companies c ON d.company_id = c.id
        WHERE ud.user_id = ? AND d.status = 'ACTIVE'
        ORDER BY d.department_name ASC
    `;
    const [rows] = await db.execute(query, [userId]);
    return rows;
};

/**
 * Assign user to departments.
 * assignments: [{ departmentId: 1, role: 'ADMIN' }, { departmentId: 2, role: 'USER' }]
 * or [1, 2] (default role: 'USER')
 */
const assignUserDepartments = async (userId, assignments = []) => {
    if (!userId) return;

    // Delete existing assignments
    await db.execute("DELETE FROM user_departments WHERE user_id = ?", [userId]);

    if (!assignments || assignments.length === 0) return [];

    for (const item of assignments) {
        const deptId = typeof item === 'object' ? item.departmentId || item.id || item.department_id : item;
        const role = typeof item === 'object' && item.role ? item.role.toUpperCase() : 'USER';
        const validRole = ['ADMIN', 'USER'].includes(role) ? role : 'USER';

        if (deptId) {
            await db.execute(
                `INSERT INTO user_departments (user_id, department_id, department_role, created_at, updated_at)
                 VALUES (?, ?, ?, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE department_role = VALUES(department_role), updated_at = NOW()`,
                [userId, deptId, validRole]
            );

            // Automatically enroll user into this department's group chat
            try {
                const [deptConvs] = await db.execute(
                    "SELECT id FROM conversations WHERE department_id = ? AND type = 'GROUP'",
                    [deptId]
                );
                for (const dc of deptConvs) {
                    const convRole = validRole === 'ADMIN' ? 'ADMIN' : 'MEMBER';
                    await db.execute(
                        "INSERT IGNORE INTO conversation_members (conversation_id, user_id, role, can_post, joined_at) VALUES (?, ?, ?, 1, NOW())",
                        [dc.id, userId, convRole]
                    );
                }
            } catch (err) {
                // Non-critical if conversations table not yet initialized
            }
        }
    }

    return await getUserDepartments(userId);
};

/**
 * Get all members belonging to a department
 */
const getDepartmentMembers = async (departmentId) => {
    const query = `
        SELECT 
            u.id, 
            COALESCE(u.name, u.full_name) AS name, 
            u.username, 
            u.email, 
            u.mob_no, 
            u.role,
            ud.department_role,
            ud.created_at AS joined_department_at,
            COALESCE(ut.type_name, ut.name) AS user_type_name
        FROM user_departments ud
        JOIN users u ON ud.user_id = u.id
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
        WHERE ud.department_id = ? AND (u.active = 1 OR u.is_active = 1 OR u.active IS NULL)
        ORDER BY ud.department_role ASC, COALESCE(u.name, u.full_name) ASC
    `;
    const [rows] = await db.execute(query, [departmentId]);
    return rows;
};

/**
 * Helper to get authorized department IDs for a user
 * Returns { isGlobalAdmin: boolean, departmentIds: number[], isDeptAdmin: boolean }
 */
const getUserDepartmentScope = async (userId, userRole = '') => {
    const roleStr = String(userRole || '').toLowerCase().trim();
    const isGlobalAdmin = ['admin', 'master_admin', 'super admin', 'administrator', 'master'].includes(roleStr);

    if (isGlobalAdmin) {
        const [allDepts] = await db.execute("SELECT id FROM departments WHERE status = 'ACTIVE'");
        const allDeptIds = allDepts.map(d => d.id);
        return {
            isGlobalAdmin: true,
            isDeptAdmin: true,
            canChatAllDepartments: true,
            allowedChatDepartmentIds: allDeptIds,
            departmentIds: allDeptIds,
            chatDepartmentIds: allDeptIds
        };
    }

    // Read user settings for inter-department and inter-company chat
    let canChatAllDepartments = false;
    let allowedChatDepts = [];
    let companyId = null;
    let canChatAllCompanies = false;
    let allowedChatCompanies = { companyIds: [], departmentIds: [] };
    let isVendor = false;
    let canChatWithVendors = false;

    try {
        const [uRows] = await db.execute(
            "SELECT company_id, can_chat_all_companies, allowed_chat_companies, can_chat_all_departments, allowed_chat_departments, is_vendor, can_chat_with_vendors FROM users WHERE id = ?",
            [userId]
        );
        if (uRows.length > 0) {
            companyId = uRows[0].company_id;
            isVendor = Boolean(uRows[0].is_vendor);
            canChatWithVendors = Boolean(uRows[0].can_chat_with_vendors);
            canChatAllCompanies = Boolean(uRows[0].can_chat_all_companies);
            if (uRows[0].allowed_chat_companies) {
                try {
                    const parsed = typeof uRows[0].allowed_chat_companies === 'string'
                        ? JSON.parse(uRows[0].allowed_chat_companies)
                        : uRows[0].allowed_chat_companies;
                    if (Array.isArray(parsed)) {
                        allowedChatCompanies = { companyIds: parsed.map(Number), departmentIds: [] };
                    } else if (parsed && typeof parsed === 'object') {
                        allowedChatCompanies = {
                            companyIds: Array.isArray(parsed.companyIds) ? parsed.companyIds.map(Number) : [],
                            departmentIds: Array.isArray(parsed.departmentIds) ? parsed.departmentIds.map(Number) : []
                        };
                    }
                } catch (_) {}
            }
            canChatAllDepartments = Boolean(uRows[0].can_chat_all_departments);
            if (uRows[0].allowed_chat_departments) {
                const parsed = typeof uRows[0].allowed_chat_departments === 'string'
                    ? JSON.parse(uRows[0].allowed_chat_departments)
                    : uRows[0].allowed_chat_departments;
                if (Array.isArray(parsed)) allowedChatDepts = parsed.map(Number);
            }
        }
    } catch (_) {}

    const [userDepts] = await db.execute(`
        SELECT ud.department_id, ud.department_role
        FROM user_departments ud
        JOIN departments d ON ud.department_id = d.id
        WHERE ud.user_id = ? AND d.status = 'ACTIVE'
    `, [userId]);

    const departmentIds = userDepts.map(d => d.department_id);
    const isDeptAdmin = userDepts.some(d => d.department_role === 'ADMIN');

    let chatDepartmentIds = [...departmentIds];
    if (canChatAllDepartments) {
        const [allDepts] = await db.execute("SELECT id FROM departments WHERE status = 'ACTIVE'");
        chatDepartmentIds = allDepts.map(d => d.id);
    } else if (allowedChatDepts.length > 0) {
        const combined = new Set([...departmentIds, ...allowedChatDepts]);
        chatDepartmentIds = Array.from(combined);
    }

    return {
        isGlobalAdmin: false,
        isDeptAdmin,
        companyId,
        isVendor,
        canChatWithVendors,
        canChatAllCompanies,
        allowedChatCompanies,
        canChatAllDepartments,
        allowedChatDepartmentIds: allowedChatDepts,
        departmentIds,
        chatDepartmentIds
    };
};

/**
 * Check if two users share at least one active department or have inter-department / inter-company chat permissions
 */
const doUsersShareDepartment = async (userId1, userId2) => {
    if (Number(userId1) === Number(userId2)) return true;

    // Check if either user is global master admin
    const [users] = await db.execute(
        "SELECT id, role, user_type_id, company_id, can_chat_all_companies, allowed_chat_companies, can_chat_all_departments, allowed_chat_departments, is_vendor, can_chat_with_vendors FROM users WHERE id IN (?, ?)",
        [userId1, userId2]
    );
    const hasGlobalAdmin = users.some(u => {
        const r = String(u.role || '').toLowerCase().trim();
        return ['admin', 'master_admin', 'super admin', 'administrator', 'master'].includes(r) || Number(u.user_type_id) === 1;
    });
    if (hasGlobalAdmin) return true;

    const user1Obj = users.find(u => Number(u.id) === Number(userId1));
    const user2Obj = users.find(u => Number(u.id) === Number(userId2));

    // Vendor Boundary Isolation:
    // 1. Two vendors can never chat with each other
    if (user1Obj?.is_vendor && user2Obj?.is_vendor) {
        return false;
    }
    // 2. Staff without can_chat_with_vendors cannot chat with a vendor
    if (user1Obj?.is_vendor && !user2Obj?.can_chat_with_vendors) {
        return false;
    }
    if (user2Obj?.is_vendor && !user1Obj?.can_chat_with_vendors) {
        return false;
    }

    const parseAllowedComp = (u) => {
        if (!u || !u.allowed_chat_companies) return { companyIds: [], departmentIds: [] };
        try {
            const parsed = typeof u.allowed_chat_companies === 'string' ? JSON.parse(u.allowed_chat_companies) : u.allowed_chat_companies;
            if (Array.isArray(parsed)) return { companyIds: parsed.map(Number), departmentIds: [] };
            if (parsed && typeof parsed === 'object') {
                return {
                    companyIds: Array.isArray(parsed.companyIds) ? parsed.companyIds.map(Number) : [],
                    departmentIds: Array.isArray(parsed.departmentIds) ? parsed.departmentIds.map(Number) : []
                };
            }
        } catch (_) {}
        return { companyIds: [], departmentIds: [] };
    };

    // Fetch assigned departments for both users
    const [userDepts] = await db.execute(`
        SELECT ud.user_id, ud.department_id
        FROM user_departments ud
        JOIN departments d ON ud.department_id = d.id
        WHERE ud.user_id IN (?, ?) AND d.status = 'ACTIVE'
    `, [userId1, userId2]);

    const u1Depts = userDepts.filter(d => Number(d.user_id) === Number(userId1)).map(d => Number(d.department_id));
    const u2Depts = userDepts.filter(d => Number(d.user_id) === Number(userId2)).map(d => Number(d.department_id));

    // Check company boundaries
    const u1Comp = user1Obj?.company_id;
    const u2Comp = user2Obj?.company_id;
    const sameCompany = (u1Comp === u2Comp) || (!u1Comp && !u2Comp);

    if (!sameCompany) {
        // Cross-company communication check
        const u1CompAccess = parseAllowedComp(user1Obj);
        const u2CompAccess = parseAllowedComp(user2Obj);

        // Can u1 talk to u2's company?
        const u1CanReachU2Comp = Boolean(user1Obj?.can_chat_all_companies) || (
            u2Comp && u1CompAccess.companyIds.includes(Number(u2Comp)) && (
                u1CompAccess.departmentIds.length === 0 || u2Depts.some(d => u1CompAccess.departmentIds.includes(d))
            )
        );

        // Can u2 talk to u1's company?
        const u2CanReachU1Comp = Boolean(user2Obj?.can_chat_all_companies) || (
            u1Comp && u2CompAccess.companyIds.includes(Number(u1Comp)) && (
                u2CompAccess.departmentIds.length === 0 || u1Depts.some(d => u2CompAccess.departmentIds.includes(d))
            )
        );

        if (!u1CanReachU2Comp && !u2CanReachU1Comp) {
            return false;
        }
        return true;
    }

    // Same company: check if either has permission to chat with ALL departments
    if (Boolean(user1Obj?.can_chat_all_departments) || Boolean(user2Obj?.can_chat_all_departments)) return true;

    // 1. Direct shared assigned department
    const shared = u1Depts.some(d => u2Depts.includes(d));
    if (shared) return true;

    // 2. Inter-department chat permission check
    const getChatDepts = (u, assigned) => {
        let allowed = [];
        if (u && u.allowed_chat_departments) {
            try {
                const parsed = typeof u.allowed_chat_departments === 'string'
                    ? JSON.parse(u.allowed_chat_departments)
                    : u.allowed_chat_departments;
                if (Array.isArray(parsed)) allowed = parsed.map(Number);
            } catch (_) {}
        }
        return new Set([...assigned, ...allowed]);
    };

    const u1AllowedChat = getChatDepts(user1Obj, u1Depts);
    const u2AllowedChat = getChatDepts(user2Obj, u2Depts);

    // If User 1 can chat with any of User 2's departments, or User 2 can chat with any of User 1's departments
    const u1CanReachU2 = u2Depts.some(d => u1AllowedChat.has(d));
    const u2CanReachU1 = u1Depts.some(d => u2AllowedChat.has(d));

    return u1CanReachU2 || u2CanReachU1;
};

module.exports = {
    createDepartmentTables,
    createDepartment,
    getDepartments,
    getDepartmentById,
    updateDepartment,
    deleteDepartment,
    toggleDepartmentStatus,
    getUserDepartments,
    assignUserDepartments,
    getDepartmentMembers,
    getUserDepartmentScope,
    doUsersShareDepartment
};
