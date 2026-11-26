const db = require("../config/db.js");
const bcrypt = require("bcryptjs");

// Helper to safely add column if it doesn't already exist
const ensureColumn = async (tableName, columnName, columnDef) => {
    try {
        // First check if the table exists
        const [tables] = await db.execute(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = ?
        `, [tableName]);

        if (tables.length === 0) return;

        const [rows] = await db.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = ? 
              AND COLUMN_NAME = ?
        `, [tableName, columnName]);

        if (rows.length === 0) {
            await db.execute(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDef}`);
            console.log(`[Auto-Schema] Added column ${columnName} to ${tableName}`);
        }
    } catch (err) {
        // Suppress notice
    }
};

const createOrganizationAndCompanyTables = async () => {
    // 1. Create organizations table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS organizations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(150) DEFAULT NULL,
            status VARCHAR(50) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Create companies table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS companies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            organization_id INT NOT NULL,
            name VARCHAR(150) NOT NULL,
            email VARCHAR(150) DEFAULT NULL,
            phone VARCHAR(50) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_comp_org (organization_id),
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Insert default organization and default company if none exist (for backwards compatibility)
    try {
        const [orgs] = await db.execute("SELECT id FROM organizations LIMIT 1");
        if (orgs.length === 0) {
            const [orgResult] = await db.execute(
                "INSERT INTO organizations (id, name, email) VALUES (1, 'Default Organization', 'admin@interlink.com')"
            );
            await db.execute(
                "INSERT INTO companies (id, organization_id, name) VALUES (1, 1, 'Default Company')"
            );
            console.log("[Auto-Schema] Seeded default Organization and default Company (ID: 1)");
        }
    } catch (seedErr) {
        console.warn("[Auto-Schema] Notice seeding default org/company:", seedErr.message);
    }

    // 4. Automatically ensure columns on existing tables
    await ensureColumn('organizations', 'email', 'VARCHAR(150) DEFAULT NULL');
    await ensureColumn('organizations', 'status', "VARCHAR(50) DEFAULT 'pending'");
    await ensureColumn('companies', 'name', 'VARCHAR(150) DEFAULT NULL');
    await ensureColumn('companies', 'email', 'VARCHAR(150) DEFAULT NULL');
    await ensureColumn('companies', 'phone', 'VARCHAR(50) DEFAULT NULL');

    // Backward-compatibility: if legacy company_name or company_code columns exist from previous schema migrations,
    // ensure they don't block inserts if they have NOT NULL constraints
    try {
        await db.execute("ALTER TABLE companies MODIFY COLUMN company_name VARCHAR(150) NULL");
    } catch (_) {}
    try {
        await db.execute("ALTER TABLE companies MODIFY COLUMN company_code VARCHAR(50) NULL");
    } catch (_) {}

    await ensureColumn('users', 'organization_id', 'INT DEFAULT 1');
    await ensureColumn('users', 'company_id', 'INT DEFAULT 1');

    await ensureColumn('projects', 'company_id', 'INT DEFAULT 1');

    await ensureColumn('tasks', 'company_id', 'INT DEFAULT 1');

    await ensureColumn('user_types', 'organization_id', 'INT DEFAULT 1');
    await ensureColumn('user_types', 'company_id', 'INT DEFAULT NULL');

    await ensureColumn('audit_logs', 'organization_id', 'INT DEFAULT 1');
    await ensureColumn('audit_logs', 'company_id', 'INT DEFAULT NULL');

    // 5. Backfill any existing NULL rows to default 1 so nothing breaks
    try {
        await db.execute("UPDATE organizations SET status = 'approved' WHERE id = 1");
        await db.execute("UPDATE users SET organization_id = 1, company_id = 1 WHERE organization_id IS NULL OR company_id IS NULL");
        await db.execute("UPDATE projects SET company_id = 1 WHERE company_id IS NULL");
        await db.execute("UPDATE tasks SET company_id = 1 WHERE company_id IS NULL");

        // Seed Platform Developer / Superadmin account if not already present
        const [devUsers] = await db.execute("SELECT id FROM users WHERE role = 'super_admin' OR username = 'developer'");
        if (devUsers.length === 0) {
            const hashedDevPassword = await bcrypt.hash("developer123", 10);
            await db.execute(`
                INSERT INTO users (name, username, email, password, role, organization_id, company_id, device_verification_required, active)
                VALUES ('Platform Developer', 'developer', 'developer@interlink.com', ?, 'super_admin', 1, 1, 0, 1)
            `, [hashedDevPassword]);
            console.log("[Auto-Schema] Seeded default Developer account (Username: developer, Password: developer123)");
        }
    } catch (backfillErr) {
        // Suppress backfill errors if tables do not exist yet (they will be created sequentially)
    }

    // 6. User-Companies Junction Table (controls which companies each user can access/switch to)
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS user_companies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                company_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_user_comp (user_id, company_id),
                INDEX idx_uc_user (user_id),
                INDEX idx_uc_comp (company_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // Backfill user_companies from existing users table
        await db.execute(`
            INSERT IGNORE INTO user_companies (user_id, company_id)
            SELECT id, company_id FROM users WHERE company_id IS NOT NULL AND company_id > 0
        `);
    } catch (ucErr) {
        console.warn("[Auto-Schema] Notice initializing user_companies table:", ucErr.message);
    }

    console.log("[Auto-Schema] Organizations, Companies, and User-Companies tables ready.");
};

const initCompanyModel = async () => {
    await createOrganizationAndCompanyTables();
};

// Model helper functions
const findOrganizationById = async (id) => {
    const [rows] = await db.execute("SELECT * FROM organizations WHERE id = ?", [id]);
    return rows[0] || null;
};

const findCompaniesByOrgId = async (orgId) => {
    const [rows] = await db.execute(
        "SELECT id, organization_id, name, email, phone, created_at FROM companies WHERE organization_id = ? ORDER BY name ASC",
        [orgId]
    );
    return rows;
};

const findCompanyById = async (companyId) => {
    const [rows] = await db.execute("SELECT id, organization_id, name, email, phone, created_at FROM companies WHERE id = ?", [companyId]);
    return rows[0] || null;
};

const createCompanyRecord = async (organizationId, name, email = null, phone = null) => {
    try {
        const [result] = await db.execute(
            `INSERT INTO companies (organization_id, name, email, phone) 
             VALUES (?, ?, ?, ?)`,
            [organizationId, name, email, phone]
        );
        return {
            id: result.insertId,
            organization_id: organizationId,
            name,
            email,
            phone
        };
    } catch (err) {
        if (err.code === 'ER_BAD_FIELD_ERROR' || err.code === 'ER_NO_DEFAULT_FOR_FIELD') {
            const [fallbackResult] = await db.execute(
                "INSERT INTO companies (organization_id, name) VALUES (?, ?)",
                [organizationId, name]
            );
            return {
                id: fallbackResult.insertId,
                organization_id: organizationId,
                name,
                email: null,
                phone: null
            };
        }
        throw err;
    }
};

const getUserCompanyIds = async (userId) => {
    if (!userId) return [];
    try {
        const [rows] = await db.execute(
            "SELECT company_id FROM user_companies WHERE user_id = ?",
            [userId]
        );
        return rows.map((r) => r.company_id);
    } catch (err) {
        console.error("getUserCompanyIds error:", err.message);
        return [];
    }
};

const getUserCompanies = async (userId) => {
    if (!userId) return [];
    try {
        const [rows] = await db.execute(`
            SELECT c.* 
            FROM companies c
            JOIN user_companies uc ON uc.company_id = c.id
            WHERE uc.user_id = ?
            ORDER BY c.name ASC
        `, [userId]);
        return rows;
    } catch (err) {
        console.error("getUserCompanies error:", err.message);
        return [];
    }
};

const assignUserCompanies = async (userId, companyIds) => {
    if (!userId) return;
    try {
        const ids = Array.isArray(companyIds)
            ? companyIds.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id) && id > 0)
            : [];

        await db.execute("DELETE FROM user_companies WHERE user_id = ?", [userId]);

        if (ids.length > 0) {
            const placeholders = ids.map(() => "(?, ?)").join(", ");
            const params = [];
            ids.forEach((cId) => {
                params.push(userId, cId);
            });
            await db.execute(
                `INSERT IGNORE INTO user_companies (user_id, company_id) VALUES ${placeholders}`,
                params
            );
        }
    } catch (err) {
        console.error("assignUserCompanies error:", err.message);
    }
};

const checkUserCompanyAccess = async (userId, companyId) => {
    if (!userId || !companyId) return false;
    try {
        const [rows] = await db.execute(
            "SELECT id FROM user_companies WHERE user_id = ? AND company_id = ?",
            [userId, companyId]
        );
        return rows.length > 0;
    } catch (err) {
        console.error("checkUserCompanyAccess error:", err.message);
        return false;
    }
};

module.exports = {
    initCompanyModel,
    createOrganizationAndCompanyTables,
    findOrganizationById,
    findCompaniesByOrgId,
    findCompanyById,
    createCompanyRecord,
    getUserCompanyIds,
    getUserCompanies,
    assignUserCompanies,
    checkUserCompanyAccess,
    ensureColumn
};
