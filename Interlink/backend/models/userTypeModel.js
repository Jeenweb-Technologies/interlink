const db = require('../config/db.js');

// ─── Masters list (must match frontend) ─────────────────────────────────────
const MASTERS = [
    { key: 'user_type', label: 'User Type Master' },
    { key: 'user_master', label: 'User Master' },
    { key: 'device_approval', label: 'Device Approval' },
    { key: 'activity_report', label: 'Activity Report' },
    { key: 'chat', label: 'Internal Chat (Messages)' },
    { key: 'camera_access', label: 'Camera Access (Photos)' },
    { key: 'whatsapp', label: 'WhatsApp Web Integration (Scan & Chats)' },
    { key: 'document_view', label: 'Document View (Online)' },
    { key: 'document_upload', label: 'Document Upload (Attach)' },
    { key: 'document_download', label: 'Document Download (To PC)' },
    { key: 'group_create', label: 'Group Channel Creation' },
    { key: 'cloud_storage', label: 'Cloud Storage Master' },
    { key: 'department_master', label: 'Department Master' },
    { key: 'company_master', label: 'Company Master' },
];

// ─── Table creation ──────────────────────────────────────────────────────────
const createUserTypesTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS user_types (
            id INT AUTO_INCREMENT PRIMARY KEY,
            type_name VARCHAR(100) NULL,
            name VARCHAR(100) NULL,
            added_by INT NOT NULL DEFAULT 1,
            device_id VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `;

    await db.execute(query);

    // Schema updates for existing/legacy tables (from dump imports)
    const cols = [
        { name: 'type_name', sql: "ALTER TABLE user_types ADD COLUMN type_name VARCHAR(100) NULL AFTER id" },
        { name: 'name', sql: "ALTER TABLE user_types ADD COLUMN name VARCHAR(100) NULL AFTER type_name" },
        { name: 'added_by', sql: "ALTER TABLE user_types ADD COLUMN added_by INT NOT NULL DEFAULT 1" },
        { name: 'device_id', sql: "ALTER TABLE user_types ADD COLUMN device_id VARCHAR(255) DEFAULT NULL" },
        { name: 'is_vendor', sql: "ALTER TABLE user_types ADD COLUMN is_vendor BOOLEAN DEFAULT FALSE" }
    ];

    for (const c of cols) {
        try {
            const [rows] = await db.execute(`SHOW COLUMNS FROM user_types LIKE '${c.name}'`);
            if (rows.length === 0) {
                await db.execute(c.sql);
            }
        } catch (e) {}
    }

    // Sync type_name and name columns
    try {
        await db.execute("UPDATE user_types SET type_name = name WHERE (type_name IS NULL OR type_name = '') AND (name IS NOT NULL AND name != '')");
        await db.execute("UPDATE user_types SET name = type_name WHERE (name IS NULL OR name = '') AND (type_name IS NOT NULL AND type_name != '')");
    } catch (e) {}

    console.log("User types table ready");
};

const createUserTypePermissionsTable = async () => {
    const query = `
        CREATE TABLE IF NOT EXISTS user_type_permissions (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            user_type_id INT NOT NULL,
            master_name  VARCHAR(100) NOT NULL,
            can_read     TINYINT(1) DEFAULT 0,
            can_write    TINYINT(1) DEFAULT 0,
            can_update   TINYINT(1) DEFAULT 0,
            can_delete   TINYINT(1) DEFAULT 0,
            UNIQUE KEY uq_ut_master (user_type_id, master_name),
            FOREIGN KEY (user_type_id) REFERENCES user_types(id) ON DELETE CASCADE
        )
    `;
    await db.execute(query);
    console.log("User type permissions table ready");

    // Seed standard user types if missing
    try {
        await seedStandardUserTypes();
    } catch (err) {
        console.error("Failed to seed standard user types:", err.message);
    }
};

const seedStandardUserTypes = async () => {
    const [existing] = await db.execute("SELECT COALESCE(type_name, name) AS type_name FROM user_types");
    const existingNames = new Set(existing.map(r => r.type_name).filter(Boolean));

    const standardRoles = [
        {
            typeName: 'Super Administrator',
            perms: MASTERS.map(m => ({ masterName: m.key, canRead: true, canWrite: true, canUpdate: true, canDelete: true }))
        },
        {
            typeName: 'Department Manager',
            perms: [
                { masterName: 'chat', canRead: true, canWrite: true, canUpdate: true, canDelete: false },
                { masterName: 'camera_access', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_upload', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_view', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_download', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'group_create', canRead: true, canWrite: true, canUpdate: true, canDelete: true },
                { masterName: 'device_approval', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'activity_report', canRead: true, canWrite: false, canUpdate: false, canDelete: false },
            ]
        },
        {
            typeName: 'Standard Employee',
            perms: [
                { masterName: 'chat', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'camera_access', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_upload', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_view', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_download', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'group_create', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
            ]
        },
        {
            typeName: 'Field Operations / Inspector',
            perms: [
                { masterName: 'chat', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'camera_access', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_upload', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_view', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_download', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'group_create', canRead: false, canWrite: false, canUpdate: false, canDelete: false },
            ]
        },
        {
            typeName: 'Read-Only / Auditor',
            perms: [
                { masterName: 'chat', canRead: true, canWrite: false, canUpdate: false, canDelete: false },
                { masterName: 'camera_access', canRead: false, canWrite: false, canUpdate: false, canDelete: false },
                { masterName: 'document_upload', canRead: false, canWrite: false, canUpdate: false, canDelete: false },
                { masterName: 'document_view', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_download', canRead: false, canWrite: false, canUpdate: false, canDelete: false },
                { masterName: 'group_create', canRead: false, canWrite: false, canUpdate: false, canDelete: false },
                { masterName: 'activity_report', canRead: true, canWrite: false, canUpdate: false, canDelete: false },
            ]
        },
        {
            typeName: 'Guest / External Client',
            perms: [
                { masterName: 'chat', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'camera_access', canRead: false, canWrite: false, canUpdate: false, canDelete: false },
                { masterName: 'document_upload', canRead: false, canWrite: false, canUpdate: false, canDelete: false },
                { masterName: 'document_view', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_download', canRead: false, canWrite: false, canUpdate: false, canDelete: false },
                { masterName: 'group_create', canRead: false, canWrite: false, canUpdate: false, canDelete: false },
            ]
        },
        {
            typeName: 'Vendor / External Partner',
            isVendor: true,
            perms: [
                { masterName: 'chat', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'camera_access', canRead: false, canWrite: false, canUpdate: false, canDelete: false },
                { masterName: 'document_upload', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_view', canRead: true, canWrite: true, canUpdate: false, canDelete: false },
                { masterName: 'document_download', canRead: false, canWrite: false, canUpdate: false, canDelete: false },
                { masterName: 'group_create', canRead: false, canWrite: false, canUpdate: false, canDelete: false },
            ]
        }
    ];

    for (const role of standardRoles) {
        if (!existingNames.has(role.typeName)) {
            const [res] = await db.execute(
                "INSERT INTO user_types (type_name, name, added_by, device_id, is_vendor) VALUES (?, ?, 1, 'SystemInit', ?)",
                [role.typeName, role.typeName, role.isVendor ? 1 : 0]
            );
            const newId = res.insertId;
            for (const p of role.perms) {
                await db.execute(
                    `INSERT IGNORE INTO user_type_permissions (user_type_id, master_name, can_read, can_write, can_update, can_delete)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [newId, p.masterName, p.canRead ? 1 : 0, p.canWrite ? 1 : 0, p.canUpdate ? 1 : 0, p.canDelete ? 1 : 0]
                );
            }
            console.log(`✅ Standard user type "${role.typeName}" seeded with ID: ${newId}`);
        }
    }
};

// ─── Permissions helpers ─────────────────────────────────────────────────────

/**
 * permissions = [{ masterName, canRead, canWrite, canUpdate, canDelete }, ...]
 */
const upsertPermissions = async (userTypeId, permissions) => {
    if (!permissions || permissions.length === 0) return;

    for (const p of permissions) {
        const query = `
            INSERT INTO user_type_permissions
                (user_type_id, master_name, can_read, can_write, can_update, can_delete)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                can_read   = VALUES(can_read),
                can_write  = VALUES(can_write),
                can_update = VALUES(can_update),
                can_delete = VALUES(can_delete)
        `;
        await db.execute(query, [
            userTypeId,
            p.masterName,
            p.canRead ? 1 : 0,
            p.canWrite ? 1 : 0,
            p.canUpdate ? 1 : 0,
            p.canDelete ? 1 : 0,
        ]);
    }
};

const getPermissionsByUserTypeId = async (userTypeId) => {
    const [rows] = await db.execute(
        `SELECT master_name, can_read, can_write, can_update, can_delete
         FROM user_type_permissions
         WHERE user_type_id = ?`,
        [userTypeId]
    );
    return rows;
};

// ─── User Type CRUD ──────────────────────────────────────────────────────────

const createUserType = async (typeName, addedBy, deviceId, permissions, isVendor = false) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        const [result] = await conn.execute(
            `INSERT INTO user_types (type_name, name, added_by, device_id, is_vendor) VALUES (?, ?, ?, ?, ?)`,
            [typeName, typeName, addedBy, deviceId, isVendor ? 1 : 0]
        );

        const newId = result.insertId;

        if (permissions && permissions.length > 0) {
            for (const p of permissions) {
                await conn.execute(
                    `INSERT INTO user_type_permissions
                        (user_type_id, master_name, can_read, can_write, can_update, can_delete)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        can_read   = VALUES(can_read),
                        can_write  = VALUES(can_write),
                        can_update = VALUES(can_update),
                        can_delete = VALUES(can_delete)`,
                    [newId, p.masterName, p.canRead ? 1 : 0, p.canWrite ? 1 : 0, p.canUpdate ? 1 : 0, p.canDelete ? 1 : 0]
                );
            }
        }

        await conn.commit();
        return result;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const getAllUserTypes = async () => {
    const query = `
        SELECT
            ut.id,
            COALESCE(ut.type_name, ut.name) AS type_name,
            COALESCE(u.name, u.full_name, 'Unknown') AS added_by_name,
            ut.device_id,
            ut.is_vendor,
            ut.created_at
        FROM user_types ut
        LEFT JOIN users u ON ut.added_by = u.id
        ORDER BY ut.created_at DESC
    `;

    const [results] = await db.execute(query);

    // Fetch permissions for each user type
    for (const row of results) {
        const perms = await getPermissionsByUserTypeId(row.id);
        row.permissions = perms.map(p => ({
            masterName: p.master_name,
            canRead: !!p.can_read,
            canWrite: !!p.can_write,
            canUpdate: !!p.can_update,
            canDelete: !!p.can_delete,
        }));
    }

    return results;
};

const updateUserType = async (id, typeName, permissions, isVendor = undefined) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        if (isVendor !== undefined) {
            await conn.execute(
                `UPDATE user_types SET type_name = ?, name = ?, is_vendor = ? WHERE id = ?`,
                [typeName, typeName, isVendor ? 1 : 0, id]
            );
        } else {
            await conn.execute(
                `UPDATE user_types SET type_name = ?, name = ? WHERE id = ?`,
                [typeName, typeName, id]
            );
        }

        if (permissions && permissions.length > 0) {
            for (const p of permissions) {
                await conn.execute(
                    `INSERT INTO user_type_permissions
                        (user_type_id, master_name, can_read, can_write, can_update, can_delete)
                     VALUES (?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                        can_read   = VALUES(can_read),
                        can_write  = VALUES(can_write),
                        can_update = VALUES(can_update),
                        can_delete = VALUES(can_delete)`,
                    [id, p.masterName, p.canRead ? 1 : 0, p.canWrite ? 1 : 0, p.canUpdate ? 1 : 0, p.canDelete ? 1 : 0]
                );
            }
        }

        await conn.commit();
        return { affectedRows: 1 };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
};

const deleteUserType = async (id) => {
    const query = `DELETE FROM user_types WHERE id = ?`;
    const [result] = await db.execute(query, [id]);
    return result;
};

const getUserTypeById = async (id) => {
    const [rows] = await db.execute(
        `SELECT id, COALESCE(type_name, name) AS type_name, added_by, device_id, created_at, updated_at FROM user_types WHERE id = ?`,
        [id]
    );
    if (!rows[0]) return null;
    const permissions = await getPermissionsByUserTypeId(id);
    return {
        ...rows[0],
        permissions: permissions.map((p) => ({
            masterName: p.master_name,
            canRead: !!p.can_read,
            canWrite: !!p.can_write,
            canUpdate: !!p.can_update,
            canDelete: !!p.can_delete,
        })),
    };
};

module.exports = {
    MASTERS,
    createUserTypesTable,
    createUserTypePermissionsTable,
    upsertPermissions,
    getPermissionsByUserTypeId,
    createUserType,
    getAllUserTypes,
    updateUserType,
    deleteUserType,
    getUserTypeById
};
