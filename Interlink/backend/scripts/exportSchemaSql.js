require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const db = require("../config/db.js");

async function exportSql() {
    let sql = `-- ==========================================================\n`;
    sql += `-- INTERLINK ENTERPRISE DATABASE SCHEMA & SEED DATA\n`;
    sql += `-- Target Domain: https://interlink.jeenhost.in/\n`;
    sql += `-- Compatible with: MySQL 8.x / MariaDB 10.x / cPanel phpMyAdmin\n`;
    sql += `-- ==========================================================\n\n`;
    sql += `SET FOREIGN_KEY_CHECKS = 0;\n`;
    sql += `SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n`;
    sql += `SET NAMES utf8mb4;\n\n`;

    const [tables] = await db.execute("SHOW TABLES");
    const tableNames = tables.map(t => Object.values(t)[0]);

    for (const t of tableNames) {
        const [createRows] = await db.execute(`SHOW CREATE TABLE \`${t}\``);
        const createSql = createRows[0]["Create Table"];
        sql += `-- ----------------------------------------------------------\n`;
        sql += `-- Table structure for \`${t}\`\n`;
        sql += `-- ----------------------------------------------------------\n`;
        sql += `${createSql};\n\n`;

        // Export data for core seeded tables
        if (["organizations", "companies", "departments", "user_types", "user_type_permissions"].includes(t)) {
            let query = `SELECT * FROM \`${t}\``;
            if (t === "organizations" || t === "companies") {
                query += " WHERE id = 1";
            }
            const [rows] = await db.execute(query);
            if (rows.length > 0) {
                sql += `-- Seed data for \`${t}\`\n`;
                for (const r of rows) {
                    const cols = Object.keys(r).map(c => `\`${c}\``).join(", ");
                    const vals = Object.values(r).map(v => {
                        if (v === null || v === undefined) return "NULL";
                        if (typeof v === "number") return v;
                        if (typeof v === "boolean") return v ? 1 : 0;
                        if (v instanceof Date) return `'${v.toISOString().slice(0, 19).replace("T", " ")}'`;
                        const str = typeof v === "object" ? JSON.stringify(v) : String(v);
                        return `'${str.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
                    }).join(", ");
                    sql += `INSERT IGNORE INTO \`${t}\` (${cols}) VALUES (${vals});\n`;
                }
                sql += `\n`;
            }
        }
    }

    // Seed developer and admin users
    const hashedDev = await bcrypt.hash("developer123", 10);
    const hashedAdmin = await bcrypt.hash("admin123", 10);

    sql += `-- ----------------------------------------------------------\n`;
    sql += `-- Seed Developer & Administrator Accounts\n`;
    sql += `-- ----------------------------------------------------------\n`;
    sql += `INSERT INTO \`users\` (\`id\`, \`name\`, \`username\`, \`email\`, \`password\`, \`role\`, \`organization_id\`, \`company_id\`, \`device_verification_required\`, \`active\`) \n`;
    sql += `VALUES (1, 'Platform Developer', 'developer', 'developer@interlink.com', '${hashedDev}', 'super_admin', 1, 1, 0, 1)\n`;
    sql += `ON DUPLICATE KEY UPDATE \`password\` = VALUES(\`password\`), \`role\` = 'super_admin', \`active\` = 1, \`device_verification_required\` = 0;\n\n`;

    sql += `INSERT INTO \`users\` (\`id\`, \`name\`, \`username\`, \`email\`, \`password\`, \`role\`, \`organization_id\`, \`company_id\`, \`device_verification_required\`, \`active\`) \n`;
    sql += `VALUES (2, 'Organization Admin', 'admin', 'admin@interlink.com', '${hashedAdmin}', 'admin', 1, 1, 0, 1)\n`;
    sql += `ON DUPLICATE KEY UPDATE \`password\` = VALUES(\`password\`), \`role\` = 'admin', \`active\` = 1, \`device_verification_required\` = 0;\n\n`;

    // Seed user_companies junction for developer and admin
    sql += `INSERT IGNORE INTO \`user_companies\` (\`user_id\`, \`company_id\`) VALUES (1, 1), (2, 1);\n\n`;

    sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    const outPath1 = path.resolve(__dirname, "../../database_schema.sql");
    const outPath2 = path.resolve(__dirname, "./database_schema.sql");
    fs.writeFileSync(outPath1, sql, "utf8");
    fs.writeFileSync(outPath2, sql, "utf8");
    console.log(`✅ Clean database_schema.sql generated successfully (${tableNames.length} tables).`);
    process.exit(0);
}

exportSql().catch(err => {
    console.error("Export error:", err);
    process.exit(1);
});
