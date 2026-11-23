const db = require("../config/db.js");

/**
 * Initialize companies table
 */
const createCompaniesTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS companies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_name VARCHAR(150) NOT NULL,
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
            INDEX idx_company_code (company_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(query);

    // Auto-seed default main parent company if table is empty
    try {
        const [rows] = await db.execute("SELECT id FROM companies LIMIT 1");
        if (rows.length === 0) {
            await db.execute(`
                INSERT INTO companies (company_name, company_code, legal_name, industry, description, is_main, status)
                VALUES ('Epoxy House', 'EPOXY', 'Epoxy House Private Limited', 'Manufacturing & Surface Solutions', 'Primary Corporate Entity', 1, 'ACTIVE')
            `);
            console.log("Default main company 'Epoxy House' initialized");
        }
    } catch (e) {
        console.warn("Error checking default company:", e.message);
    }

    console.log("Companies table ready");
};

/**
 * Fetch all companies with department and user count
 */
const getCompanies = async ({ includeInactive = true, search = "" } = {}) => {
    const conditions = [];
    const params = [];

    if (!includeInactive) {
        conditions.push("c.status = 'ACTIVE'");
    }

    if (search && search.trim()) {
        const s = `%${search.trim()}%`;
        conditions.push("(c.company_name LIKE ? OR c.company_code LIKE ? OR c.legal_name LIKE ? OR c.city LIKE ?)");
        params.push(s, s, s, s);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const query = `
        SELECT 
            c.*,
            COUNT(DISTINCT d.id) AS department_count,
            COUNT(DISTINCT ud.user_id) AS user_count
        FROM companies c
        LEFT JOIN departments d ON c.id = d.company_id AND d.status = 'ACTIVE'
        LEFT JOIN user_departments ud ON d.id = ud.department_id
        ${whereClause}
        GROUP BY c.id
        ORDER BY c.is_main DESC, c.company_name ASC
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
    const [depts] = await db.execute(
        `SELECT id, department_name, description, status 
         FROM departments 
         WHERE company_id = ? 
         ORDER BY department_name ASC`,
        [id]
    );
    company.departments = depts;

    return company;
};

/**
 * Get the default/main company
 */
const getDefaultCompany = async () => {
    const [rows] = await db.execute("SELECT * FROM companies WHERE is_main = 1 LIMIT 1");
    if (rows.length > 0) return rows[0];
    const [fallback] = await db.execute("SELECT * FROM companies ORDER BY id ASC LIMIT 1");
    return fallback.length > 0 ? fallback[0] : null;
};

/**
 * Create a new company
 */
const createCompany = async (data) => {
    const {
        company_name,
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

    const cleanName = (company_name || "").trim();
    let cleanCode = (company_code || cleanName.substring(0, 8) || "CO").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!cleanCode) cleanCode = `CO_${Date.now().toString().slice(-4)}`;

    // Check if code already exists and add random suffix if needed
    try {
        const [existing] = await db.execute("SELECT id FROM companies WHERE company_code = ? LIMIT 1", [cleanCode]);
        if (existing.length > 0) {
            cleanCode = `${cleanCode}_${Math.floor(100 + Math.random() * 900)}`;
        }
    } catch (_) {}

    const query = `
        INSERT INTO companies (
            company_name, company_code, legal_name, tax_id, email, phone, website,
            address, city, state, country, postal_code, logo_url, industry,
            description, is_main, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
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

    // Automatically create the company broadcast channel immediately upon company creation
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
        company_name: cleanName,
        company_code: cleanCode,
        ...data,
        is_main: Boolean(is_main),
        status: status || 'ACTIVE'
    };
};

/**
 * Update an existing company
 */
const updateCompany = async (id, data) => {
    const updates = [];
    const values = [];

    const allowedFields = [
        'company_name', 'company_code', 'legal_name', 'tax_id', 'email', 'phone',
        'website', 'address', 'city', 'state', 'country', 'postal_code', 'logo_url',
        'industry', 'description', 'status'
    ];

    allowedFields.forEach(field => {
        if (data[field] !== undefined) {
            updates.push(`${field} = ?`);
            const val = typeof data[field] === 'string' ? data[field].trim() : data[field];
            values.push(val === '' && field !== 'company_name' && field !== 'company_code' ? null : val);
        }
    });

    if (data.is_main !== undefined) {
        updates.push("is_main = ?");
        values.push(data.is_main ? 1 : 0);
    }

    if (updates.length === 0) return await getCompanyById(id);

    values.push(id);
    await db.execute(`UPDATE companies SET ${updates.join(", ")}, updated_at = NOW() WHERE id = ?`, values);
    return await getCompanyById(id);
};

/**
 * Delete a company
 */
const deleteCompany = async (id) => {
    // Check if company has active departments
    const [depts] = await db.execute("SELECT id FROM departments WHERE company_id = ? LIMIT 1", [id]);
    if (depts.length > 0) {
        throw new Error("Cannot delete company that has active departments assigned to it. Reassign or delete the departments first.");
    }

    // Check if it's the main company
    const [comp] = await db.execute("SELECT is_main FROM companies WHERE id = ?", [id]);
    if (comp.length > 0 && comp[0].is_main) {
        throw new Error("Cannot delete the primary/main corporate company entity.");
    }

    await db.execute("DELETE FROM companies WHERE id = ?", [id]);
    return true;
};

/**
 * Toggle status of a company
 */
const toggleCompanyStatus = async (id, newStatus) => {
    const status = newStatus ? newStatus.toUpperCase() : 'ACTIVE';
    await db.execute("UPDATE companies SET status = ?, updated_at = NOW() WHERE id = ?", [status, id]);
    return { id, status };
};

module.exports = {
    createCompaniesTable,
    getCompanies,
    getCompanyById,
    getDefaultCompany,
    createCompany,
    updateCompany,
    deleteCompany,
    toggleCompanyStatus
};
