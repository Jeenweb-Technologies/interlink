const db = require("../config/db.js");

const createSystemSettingsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS system_settings (
            \`key\` VARCHAR(100) PRIMARY KEY,
            \`value\` TEXT NOT NULL,
            description VARCHAR(255) NULL,
            is_encrypted BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.execute(query);

    try {
        const [cols] = await db.execute("SHOW COLUMNS FROM system_settings");
        const colNames = cols.map(c => c.Field);
        if (!colNames.includes('key') && colNames.includes('setting_key')) {
            await db.execute("ALTER TABLE system_settings CHANGE COLUMN setting_key `key` VARCHAR(100)");
        }
        if (!colNames.includes('value') && colNames.includes('setting_value')) {
            await db.execute("ALTER TABLE system_settings CHANGE COLUMN setting_value `value` TEXT");
        }
    } catch (e) {}

    console.log("System settings table ready");
};

const getSetting = async (keyName) => {
    try {
        const [rows] = await db.execute("SELECT `value` FROM system_settings WHERE `key` = ?", [keyName]);
        return rows.length > 0 ? rows[0].value : null;
    } catch (e) {
        return null;
    }
};

const setSetting = async (keyName, valueText, description = null) => {
    const query = `
        INSERT INTO system_settings (\`key\`, \`value\`, description)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`), description = COALESCE(VALUES(description), description), updated_at = NOW()
    `;
    return await db.execute(query, [keyName, valueText, description]);
};

const getAllSettings = async () => {
    const [rows] = await db.execute("SELECT * FROM system_settings");
    const map = {};
    rows.forEach(r => {
        const k = r.key || r.setting_key;
        const v = r.value !== undefined ? r.value : r.setting_value;
        if (k) map[k] = v;
    });
    return map;
};

module.exports = {
    createSystemSettingsTable,
    getSetting,
    setSetting,
    getAllSettings
};
