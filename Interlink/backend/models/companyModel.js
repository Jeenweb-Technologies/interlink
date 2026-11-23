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

/**
 * Initialize organizations and companies tables
 */
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
            organization_id INT DEFAULT 1,
            company_name VARCHAR(150) NOT NULL,
            name VARCHAR(150) NULL,
            company_code VARCHAR(50) NOT NULL UNIQUE,
            legal_name VARCHAR(200) NULL,
            tax_id VARCHAR(100) NULL,
            email VARCHAR(150) NULL,
            phone VARCHAR(50) NULL,
            website VARCHAR(255) NULL,
            address TEXT NULL,
            city VARCHAR(100) NULL,
            state VARCHAR(100) NULL,
            country VARCHAR(100) NULL,
            postal_code VARCHAR(50) NULL,
            logo_url VARCHAR(255) NULL,
            industry VARCHAR(100) NULL,
            description TEXT NULL,
            is_main BOOLEAN DEFAULT FALSE,
            status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_company_status (status),
            INDEX idx_company_code (company_code),
            INDEX idx_comp_org (organization_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Ensure columns exist on companies and organizations
    await ensureColumn('organizations', 'email', 'VARCHAR(150) DEFAULT NULL');
    await ensureColumn('organizations', 'status', "VARCHAR(50) DEFAULT 'pending'");

    await ensureColumn('companies', 'organization_id', 'INT DEFAULT 1');
    await ensureColumn('companies', 'name', 'VARCHAR(150) DEFAULT NULL');
    await ensureColumn('companies', 'company_name', 'VARCHAR(150) DEFAULT NULL');
    await ensureColumn('companies', 'company_code', 'VARCHAR(50) DEFAULT NULL');
    await ensureColumn('companies', 'legal_name', 'VARCHAR(200) DEFAULT NULL');
    await ensureColumn('companies', 'tax_id', 'VARCHAR(100) DEFAULT NULL');
    await ensureColumn('companies', 'email', 'VARCHAR(150) DEFAULT NULL');
    await ensureColumn('companies', 'phone', 'VARCHAR(50) DEFAULT NULL');
    await ensureColumn('companies', 'website', 'VARCHAR(255) DEFAULT NULL');
    await ensureColumn('companies', 'address', 'TEXT DEFAULT NULL');
    await ensureColumn('companies', 'city', 'VARCHAR(100) DEFAULT NULL');
    await ensureColumn('companies', 'state', 'VARCHAR(100) DEFAULT NULL');
    await ensureColumn('companies', 'country', 'VARCHAR(100) DEFAULT NULL');
    await ensureColumn('companies', 'postal_code', 'VARCHAR(50) DEFAULT NULL');
    await ensureColumn('companies', 'logo_url', 'VARCHAR(255) DEFAULT NULL');
    await ensureColumn('companies', 'industry', 'VARCHAR(100) DEFAULT NULL');
    await ensureColumn('companies', 'description', 'TEXT DEFAULT NULL');
    await ensureColumn('companies', 'is_main', 'BOOLEAN DEFAULT FALSE');
    await ensureColumn('companies', 'status', "VARCHAR(50) DEFAULT 'ACTIVE'");

    // Ensure foreign references
    await ensureColumn('users', 'organization_id', 'INT DEFAULT 1');
    await ensureColumn('users', 'company_id', 'INT DEFAULT 1');
    await ensureColumn('projects', 'company_id', 'INT DEFAULT 1');
    await ensureColumn('tasks', 'company_id', 'INT DEFAULT 1');
    await ensureColumn('user_types', 'organization_id', 'INT DEFAULT 1');
    await ensureColumn('user_types', 'company_id', 'INT DEFAULT NULL');
    await ensureColumn('audit_logs', 'organization_id', 'INT DEFAULT 1');
    await ensureColumn('audit_logs', 'company_id', 'INT DEFAULT NULL');

    // Default Org & Company Seed
    try {
        const [orgs] = await db.execute("SELECT id FROM organizations LIMIT 1");
        if (orgs.length === 0) {
            await db.execute("INSERT INTO organizations (id, name, email, status) VALUES (1, 'Default Organization', 'admin@interlink.com', 'approved')");
            console.log("[Auto-Schema] Seeded default Organization (ID: 1)");
        }

        const [comps] = await db.execute("SELECT id FROM companies LIMIT 1");
        if (comps.length === 0) {
            await db.execute(`
                INSERT INTO companies (id, organization_id, company_name, name, company_code, legal_name, industry, description, is_main, status)
                VALUES (1, 1, 'Epoxy House', 'Epoxy House', 'EPOXY', 'Epoxy House Private Limited', 'Manufacturing & Surface Solutions', 'Primary Corporate Entity', 1, 'ACTIVE')
            `);
            console.log("[Auto-Schema] Seeded default Company 'Epoxy House' (ID: 1)");
        } else {
            // Keep name and company_name in sync
            await db.execute("UPDATE companies SET name = company_name WHERE name IS NULL AND company_name IS NOT NULL");
            await db.execute("UPDATE companies SET company_name = name WHERE company_name IS NULL AND name IS NOT NULL");
        }

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
    } catch (seedErr) {
        console.warn("[Auto-Schema] Notice seeding default org/company:", seedErr.message);
    }

    console.log("Companies and Organizations tables ready.");
};

const createCompaniesTable = async () => {
    await createOrganizationAndCompanyTables();
};

const initCompanyModel = async () => {
    await createOrganizationAndCompanyTables();
};

const findOrganizationById = async (id) => {
    const [rows] = await db.execute("SELECT * FROM organizations WHERE id = ?", [id]);
    return rows[0] || null;
};

const findCompaniesByOrgId = async (orgId) => {
    const [rows] = await db.execute(
        `SELECT id, organization_id, 
                COALESCE(company_name, name) AS name, 
                COALESCE(company_name, name) AS company_name, 
                company_code, email, phone, status, created_at 
         FROM companies 
         WHERE organization_id = ? OR organization_id IS NULL 
         ORDER BY is_main DESC, id ASC`,
        [orgId]
    );
    return rows;
};

const findCompanyById = async (companyId) => {
    const [rows] = await db.execute(
        `SELECT *, 
                COALESCE(company_name, name) AS name, 
                COALESCE(company_name, name) AS company_name 
         FROM companies WHERE id = ?`,
        [companyId]
    );
    return rows[0] || null;
};

const createCompanyRecord = async (organizationId, name, email = null, phone = null) => {
    return await createCompany({
        organization_id: organizationId,
        company_name: name,
        name: name,
        email: email,
        phone: phone
    });
};

/**
 * Fetch all companies with department and user count
 */
const getCompanies = async (opts = {}) => {
    const { includeInactive = true, search = "", organizationId = null } = (typeof opts === 'object' && opts !== null) ? opts : {};
    const conditions = [];
    const params = [];

    if (!includeInactive) {
        conditions.push("(c.status = 'ACTIVE' OR c.status IS NULL)");
    }

    if (organizationId) {
        conditions.push("(c.organization_id = ? OR c.organization_id IS NULL)");
        params.push(organizationId);
    }

    if (search && String(search).trim()) {
        const s = `%${String(search).trim()}%`;
        conditions.push("(c.company_name LIKE ? OR c.name LIKE ? OR c.company_code LIKE ? OR c.legal_name LIKE ? OR c.city LIKE ?)");
        params.push(s, s, s, s, s);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT 
            c.*,
            COALESCE(c.company_name, c.name) AS company_name,
            COALESCE(c.name, c.company_name) AS name,
            COUNT(DISTINCT d.id) AS department_count,
            COUNT(DISTINCT ud.user_id) AS user_count
        FROM companies c
        LEFT JOIN departments d ON c.id = d.company_id AND (d.status = 'ACTIVE' OR d.status IS NULL)
        LEFT JOIN user_departments ud ON d.id = ud.department_id
        ${whereClause}
        GROUP BY c.id
        ORDER BY c.is_main DESC, c.id ASC
    `;

    const [rows] = await db.execute(query, params);
    return rows.map(r => ({
        ...r,
        department_count: Number(r.department_count || 0),
        user_count: Number(r.user_count || 0),
        is_main: Boolean(r.is_main)
    }));
};

/**
 * Get single company by ID including its departments
 */
const getCompanyById = async (id) => {
    const query = `
        SELECT 
            c.*,
            COALESCE(c.company_name, c.name) AS company_name,
            COALESCE(c.name, c.company_name) AS name,
            COUNT(DISTINCT d.id) AS department_count,
            COUNT(DISTINCT ud.user_id) AS user_count
        FROM companies c
        LEFT JOIN departments d ON c.id = d.company_id
        LEFT JOIN user_departments ud ON d.id = ud.department_id
        WHERE c.id = ?
        GROUP BY c.id
    `;
    const [rows] = await db.execute(query, [id]);
    if (rows.length === 0) return null;

    const company = {
        ...rows[0],
        department_count: Number(rows[0].department_count || 0),
        user_count: Number(rows[0].user_count || 0),
        is_main: Boolean(rows[0].is_main)
    };

    // Also fetch its active departments
    try {
        const [depts] = await db.execute(
            `SELECT id, department_name, description, status 
             FROM departments 
             WHERE company_id = ? 
             ORDER BY department_name ASC`,
            [id]
        );
        company.departments = depts;
    } catch (_) {
        company.departments = [];
    }

    // Also fetch employees assigned to this company
    try {
        const [employees] = await db.execute(
            `SELECT u.id, u.name, u.username, u.email, u.mob_no, u.role, u.is_vendor, u.active, ut.name as user_type_name
             FROM users u
             LEFT JOIN user_types ut ON u.user_type_id = ut.id
             WHERE u.company_id = ?
             ORDER BY u.name ASC`,
            [id]
        );
        company.employees = employees || [];
    } catch (_) {
        company.employees = [];
    }

    return company;
};

const getDefaultCompany = async () => {
    const [rows] = await db.execute("SELECT * FROM companies WHERE is_main = 1 LIMIT 1");
    if (rows.length > 0) return rows[0];
    const [fallback] = await db.execute("SELECT * FROM companies ORDER BY id ASC LIMIT 1");
    return fallback.length > 0 ? fallback[0] : null;
};

const createCompany = async (data) => {
    const {
        organization_id = 1,
        company_name,
        name,
        company_code,
        legal_name = null,
        tax_id = null,
        email = null,
        phone = null,
        website = null,
        address = null,
        city = null,
        state = null,
        country = null,
        postal_code = null,
        logo_url = null,
        industry = null,
        description = null,
        is_main = false,
        status = "ACTIVE"
    } = data;

    const cleanName = (company_name || name || "").trim();
    let cleanCode = (company_code || cleanName.substring(0, 8) || "CO").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!cleanCode) cleanCode = `CO_${Date.now().toString().slice(-4)}`;

    try {
        const [existing] = await db.execute("SELECT id FROM companies WHERE company_code = ? LIMIT 1", [cleanCode]);
        if (existing.length > 0) {
            cleanCode = `${cleanCode}_${Math.floor(100 + Math.random() * 900)}`;
        }
    } catch (_) {}

    const query = `
        INSERT INTO companies (
            organization_id, company_name, name, company_code, legal_name, tax_id, email, phone, website,
            address, city, state, country, postal_code, logo_url, industry,
            description, is_main, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
        organization_id || 1,
        cleanName,
        cleanName,
        cleanCode,
        legal_name ? legal_name.trim() : null,
        tax_id ? tax_id.trim() : null,
        email ? email.trim() : null,
        phone ? phone.trim() : null,
        website ? website.trim() : null,
        address ? address.trim() : null,
        city ? city.trim() : null,
        state ? state.trim() : null,
        country ? country.trim() : null,
        postal_code ? postal_code.trim() : null,
        logo_url ? logo_url.trim() : null,
        industry ? industry.trim() : null,
        description ? description.trim() : null,
        is_main ? 1 : 0,
        ['ACTIVE', 'INACTIVE'].includes(status?.toUpperCase()) ? status.toUpperCase() : 'ACTIVE'
    ];

    const [result] = await db.execute(query, values);
    const newCompanyId = result.insertId;

    try {
        const { ensureCompanyBroadcastForCompany } = require("./conversationModel.js");
        if (typeof ensureCompanyBroadcastForCompany === "function") {
            await ensureCompanyBroadcastForCompany(newCompanyId, cleanName, data.adminId || 1);
        }
    } catch (broadcastErr) {
        console.error("Auto company broadcast creation error:", broadcastErr.message);
    }

    return {
        id: newCompanyId,
        organization_id: organization_id || 1,
        name: cleanName,
        company_name: cleanName,
        company_code: cleanCode,
        ...data,
        is_main: Boolean(is_main),
        status: status || 'ACTIVE'
    };
};

const updateCompany = async (id, data) => {
    const updates = [];
    const values = [];

    const allowedFields = [
        'company_name', 'name', 'company_code', 'legal_name', 'tax_id', 'email', 'phone',
        'website', 'address', 'city', 'state', 'country', 'postal_code', 'logo_url',
        'industry', 'description', 'status', 'organization_id'
    ];

    allowedFields.forEach(field => {
        if (data[field] !== undefined) {
            updates.push(`${field} = ?`);
            const val = typeof data[field] === 'string' ? data[field].trim() : data[field];
            values.push(val);
        }
    });

    if (data.company_name && !data.name) {
        updates.push("name = ?");
        values.push(data.company_name.trim());
    } else if (data.name && !data.company_name) {
        updates.push("company_name = ?");
        values.push(data.name.trim());
    }

    if (updates.length === 0) return await findCompanyById(id);

    values.push(id);
    await db.execute(`UPDATE companies SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
    return await findCompanyById(id);
};

const deleteCompany = async (id) => {
    const [result] = await db.execute("DELETE FROM companies WHERE id = ?", [id]);
    return result.affectedRows > 0;
};

const toggleCompanyStatus = async (id, currentStatus) => {
    const status = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    await db.execute("UPDATE companies SET status = ?, updated_at = NOW() WHERE id = ?", [status, id]);
    return { id, status };
};

module.exports = {
    ensureColumn,
    createOrganizationAndCompanyTables,
    createCompaniesTable,
    initCompanyModel,
    findOrganizationById,
    findCompaniesByOrgId,
    findCompanyById,
    createCompanyRecord,
    getCompanies,
    getCompanyById,
    getDefaultCompany,
    createCompany,
    updateCompany,
    deleteCompany,
    toggleCompanyStatus
};
