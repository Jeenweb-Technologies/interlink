const db = require("../config/db.js");
const bcrypt = require("bcryptjs");

// Helper to safely add column if it doesn't already exist
const ensureColumn = async (tableName, columnName, columnDef) => {
    try {
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
        console.warn(`[Auto-Schema] Notice ensuring column ${columnName} in ${tableName}:`, err.message);
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
    await ensureColumn('companies', 'email', 'VARCHAR(150) DEFAULT NULL');
    await ensureColumn('companies', 'phone', 'VARCHAR(50) DEFAULT NULL');

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

    console.log("[Auto-Schema] Organizations and Companies tables ready.");
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
    const [rows] = await db.execute("SELECT * FROM companies WHERE id = ?", [companyId]);
    return rows[0] || null;
};

const createCompanyRecord = async (organizationId, name, email = null, phone = null) => {
    try {
        const [result] = await db.execute(
            "INSERT INTO companies (organization_id, name, email, phone) VALUES (?, ?, ?, ?)",
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
        if (err.code === 'ER_BAD_FIELD_ERROR') {
            const [fallbackResult] = await db.execute(
                "INSERT INTO companies (organization_id, name) VALUES (?, ?)",
                [organizationId, name]
            );
            db.execute("ALTER TABLE companies ADD COLUMN email VARCHAR(150) DEFAULT NULL").catch(() => {});
            db.execute("ALTER TABLE companies ADD COLUMN phone VARCHAR(50) DEFAULT NULL").catch(() => {});
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

module.exports = {
    initCompanyModel,
    createOrganizationAndCompanyTables,
    findOrganizationById,
    findCompaniesByOrgId,
    findCompanyById,
    createCompanyRecord,
    ensureColumn
};
