const db = require("../config/db.js");

/**
 * Initialize department tables and ensure columns
 */
const createDepartmentTables = async () => {
    // 1. Departments Table
    const createDepartmentsQuery = `
        CREATE TABLE IF NOT EXISTS departments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT DEFAULT 1,
            department_name VARCHAR(100) NOT NULL,
            description VARCHAR(255) NULL,
            head_of_department VARCHAR(100) NULL,
            status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_dept_status (status),
            INDEX idx_dept_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(createDepartmentsQuery);

    // 2. User-Departments Junction Table (supports multi-department allocation)
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
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    try {
        await db.execute(createUserDeptsQuery);
    } catch (udErr) {
        console.warn("[Auto-Schema] Notice initializing user_departments table:", udErr.message);
    }

    // 3. Ensure department_id column exists on users table
    try {
        const [userCols] = await db.execute("SHOW COLUMNS FROM users LIKE 'department_id'");
        if (userCols.length === 0) {
            await db.execute("ALTER TABLE users ADD COLUMN department_id INT NULL DEFAULT NULL AFTER company_id");
            console.log("[Auto-Schema] Added department_id column to users table");
        }
    } catch (err) {
        console.warn("[Auto-Schema] Notice ensuring department_id on users:", err.message);
    }

    // 4. Ensure head_of_department column on departments
    try {
        const [hodCols] = await db.execute("SHOW COLUMNS FROM departments LIKE 'head_of_department'");
        if (hodCols.length === 0) {
            await db.execute("ALTER TABLE departments ADD COLUMN head_of_department VARCHAR(100) NULL AFTER description");
        }
    } catch (_) {}

    // 5. Ensure company_id column on departments
    try {
        const [compCols] = await db.execute("SHOW COLUMNS FROM departments LIKE 'company_id'");
        if (compCols.length === 0) {
            await db.execute("ALTER TABLE departments ADD COLUMN company_id INT DEFAULT 1 AFTER id");
        }
    } catch (_) {}

    // 6. Seed default core departments if none exist
    try {
        const [existing] = await db.execute("SELECT id FROM departments LIMIT 1");
        if (existing.length === 0) {
            const defaults = [
                { name: "Executive Leadership", desc: "Strategy, executive direction, and corporate governance", hod: "Chief Executive Officer" },
                { name: "Information Technology", desc: "Software engineering, infrastructure, devops, and security", hod: "Chief Technology Officer" },
                { name: "Human Resources", desc: "People operations, talent acquisition, culture, and employee welfare", hod: "Head of People Operations" },
                { name: "Sales & Business Development", desc: "Client partnerships, revenue growth, and corporate accounts", hod: "VP of Sales" },
                { name: "Finance & Accounts", desc: "Treasury, taxation, billing, audits, and financial planning", hod: "Head of Finance" },
                { name: "Operations & Quality Assurance", desc: "Process optimization, standards compliance, and client delivery", hod: "Operations Director" }
            ];

            for (const d of defaults) {
                await db.execute(
                    "INSERT INTO departments (company_id, department_name, description, head_of_department, status) VALUES (1, ?, ?, ?, 'ACTIVE')",
                    [d.name, d.desc, d.hod]
                );
            }
            console.log("[Auto-Schema] Seeded 6 default enterprise departments");
        }
    } catch (seedErr) {
        console.warn("[Auto-Schema] Notice seeding default departments:", seedErr.message);
    }

    console.log("Departments and User-Departments tables ready.");
};

/**
 * Fetch all departments with member counts and company details
 */
const getDepartments = async (includeInactive = true, companyId = null) => {
    let whereClauses = [];
    let params = [];

    if (!includeInactive) {
        whereClauses.push("d.status = 'ACTIVE'");
    }

    if (companyId) {
        whereClauses.push("(d.company_id = ? OR d.company_id IS NULL)");
        params.push(companyId);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const query = `
        SELECT 
            d.id,
            d.company_id,
            d.department_name,
            d.description,
            d.head_of_department,
            d.status,
            d.created_at,
            d.updated_at,
            COALESCE(c.name, 'Default Company') AS company_name,
            COUNT(DISTINCT u.id) AS member_count
        FROM departments d
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN users u ON (u.department_id = d.id OR u.id IN (SELECT user_id FROM user_departments WHERE department_id = d.id))
        ${whereSQL}
        GROUP BY d.id
        ORDER BY d.department_name ASC
    `;

    const [rows] = await db.execute(query, params);
    return rows.map(r => ({
        ...r,
        member_count: Number(r.member_count || 0)
    }));
};

/**
 * Get single department by ID with active members
 */
const getDepartmentById = async (id) => {
    const query = `
        SELECT 
            d.id,
            d.company_id,
            d.department_name,
            d.description,
            d.head_of_department,
            d.status,
            d.created_at,
            d.updated_at,
            COALESCE(c.name, 'Default Company') AS company_name,
            COUNT(DISTINCT u.id) AS member_count
        FROM departments d
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN users u ON (u.department_id = d.id OR u.id IN (SELECT user_id FROM user_departments WHERE department_id = d.id))
        WHERE d.id = ?
        GROUP BY d.id
    `;
    const [rows] = await db.execute(query, [id]);
    if (rows.length === 0) return null;

    const dept = {
        ...rows[0],
        member_count: Number(rows[0].member_count || 0)
    };

    // Also fetch assigned members
    const [members] = await db.execute(`
        SELECT u.id, u.name, u.username, u.email, u.mob_no, u.role, u.active, ut.type_name
        FROM users u
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
        WHERE u.department_id = ? OR u.id IN (SELECT user_id FROM user_departments WHERE department_id = ?)
        ORDER BY u.name ASC
    `, [id, id]);

    dept.members = members || [];
    return dept;
};

/**
 * Create a new department
 */
const createDepartment = async (departmentName, description = null, status = 'ACTIVE', companyId = 1, headOfDepartment = null) => {
    const cleanName = (departmentName || '').trim();
    if (!cleanName) throw new Error("Department name is required");

    const [result] = await db.execute(
        `INSERT INTO departments (company_id, department_name, description, head_of_department, status) 
         VALUES (?, ?, ?, ?, ?)`,
        [companyId || 1, cleanName, description || null, headOfDepartment || null, status || 'ACTIVE']
    );

    return {
        id: result.insertId,
        company_id: companyId || 1,
        department_name: cleanName,
        description,
        head_of_department: headOfDepartment,
        status: status || 'ACTIVE'
    };
};

/**
 * Update an existing department
 */
const updateDepartment = async (id, data) => {
    const updates = [];
    const values = [];

    const allowedFields = ['department_name', 'description', 'head_of_department', 'status', 'company_id'];
    allowedFields.forEach(field => {
        if (data[field] !== undefined) {
            updates.push(`${field} = ?`);
            const val = typeof data[field] === 'string' ? data[field].trim() : data[field];
            values.push(val);
        }
    });

    if (updates.length === 0) return await getDepartmentById(id);

    values.push(id);
    await db.execute(`UPDATE departments SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
    return await getDepartmentById(id);
};

/**
 * Delete a department
 */
const deleteDepartment = async (id) => {
    // Unassign users from this department
    await db.execute("UPDATE users SET department_id = NULL WHERE department_id = ?", [id]);
    await db.execute("DELETE FROM user_departments WHERE department_id = ?", [id]);
    const [result] = await db.execute("DELETE FROM departments WHERE id = ?", [id]);
    return result.affectedRows > 0;
};

/**
 * Toggle department status (ACTIVE <-> INACTIVE)
 */
const toggleDepartmentStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await db.execute("UPDATE departments SET status = ?, updated_at = NOW() WHERE id = ?", [nextStatus, id]);
    return { id, status: nextStatus };
};

/**
 * Get members assigned to a department
 */
const getDepartmentMembers = async (departmentId) => {
    const [rows] = await db.execute(`
        SELECT u.id, u.name, u.username, u.email, u.mob_no, u.role, u.active, ut.type_name
        FROM users u
        LEFT JOIN user_types ut ON u.user_type_id = ut.id
        WHERE u.department_id = ? OR u.id IN (SELECT user_id FROM user_departments WHERE department_id = ?)
        ORDER BY u.name ASC
    `, [departmentId, departmentId]);
    return rows;
};

/**
 * Assign a user to multiple departments (syncs user_departments junction table)
 */
const assignUserDepartments = async (userId, departmentIds = [], defaultRole = 'USER') => {
    const validIds = Array.isArray(departmentIds)
        ? departmentIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0)
        : (departmentIds ? [parseInt(departmentIds, 10)].filter(id => !isNaN(id) && id > 0) : []);

    // Clear previous assignments for this user
    await db.execute("DELETE FROM user_departments WHERE user_id = ?", [userId]);

    if (validIds.length === 0) {
        await db.execute("UPDATE users SET department_id = NULL WHERE id = ?", [userId]);
        return { userId, departmentIds: [] };
    }

    // Set primary department on users table
    const primaryId = validIds[0];
    await db.execute("UPDATE users SET department_id = ? WHERE id = ?", [primaryId, userId]);

    // Insert all into user_departments
    for (const dId of validIds) {
        await db.execute(`
            INSERT INTO user_departments (user_id, department_id, department_role)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE department_role = VALUES(department_role), updated_at = NOW()
        `, [userId, dId, defaultRole || 'USER']);
    }

    return { userId, departmentIds: validIds };
};

/**
 * Assign a user to a single department (wrapper for backward compatibility)
 */
const assignUserDepartment = async (userId, departmentId, role = 'USER') => {
    return await assignUserDepartments(userId, departmentId ? [departmentId] : [], role);
};

/**
 * Get all departments assigned to a specific user
 */
const getUserDepartments = async (userId) => {
    const [rows] = await db.execute(`
        SELECT d.id, d.department_name, d.description, ud.department_role
        FROM user_departments ud
        JOIN departments d ON ud.department_id = d.id
        WHERE ud.user_id = ?
        ORDER BY d.department_name ASC
    `, [userId]);
    return rows;
};

module.exports = {
    createDepartmentTables,
    getDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    toggleDepartmentStatus,
    getDepartmentMembers,
    assignUserDepartment,
    assignUserDepartments,
    getUserDepartments
};
