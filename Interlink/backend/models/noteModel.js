const db = require("../config/db.js");

const createNoteTables = async () => {
    try {
        // 1. Core Notes Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                tenant_id INT NOT NULL DEFAULT 1,
                company_id INT NOT NULL DEFAULT 1,
                owner_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                content LONGTEXT NULL,
                color VARCHAR(20) DEFAULT '#FFFFFF',
                is_pinned BOOLEAN DEFAULT FALSE,
                is_archived BOOLEAN DEFAULT FALSE,
                priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
                labels JSON NULL,
                version INT NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP NULL,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT,
                INDEX idx_notes_tenant_owner (tenant_id, owner_id),
                INDEX idx_notes_tenant_pinned (tenant_id, is_pinned),
                INDEX idx_notes_tenant_archived (tenant_id, is_archived)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. Note Shares & Permissions Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS note_shares (
                id INT AUTO_INCREMENT PRIMARY KEY,
                note_id INT NOT NULL,
                user_id INT NULL,
                user_type_id INT NULL,
                permission ENUM('view', 'comment', 'edit') NOT NULL DEFAULT 'view',
                shared_by INT NOT NULL,
                expires_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (user_type_id) REFERENCES user_types(id) ON DELETE CASCADE,
                FOREIGN KEY (shared_by) REFERENCES users(id) ON DELETE RESTRICT,
                INDEX idx_shares_note (note_id),
                INDEX idx_shares_user (user_id),
                INDEX idx_shares_group (user_type_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 3. Note Checklists Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS note_checklists (
                id INT AUTO_INCREMENT PRIMARY KEY,
                note_id INT NOT NULL,
                item_text TEXT NOT NULL,
                is_completed BOOLEAN DEFAULT FALSE,
                position INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                INDEX idx_checklists_note (note_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 4. Note Attachments Table
        await db.execute(`
            CREATE TABLE IF NOT EXISTS note_attachments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                note_id INT NOT NULL,
                file_name VARCHAR(255) NOT NULL,
                file_path VARCHAR(500) NOT NULL,
                file_size INT NOT NULL,
                mime_type VARCHAR(100) NULL,
                uploaded_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
                INDEX idx_attachments_note (note_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 5. Note Version Snapshots Table (for Concurrency & History)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS note_versions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                note_id INT NOT NULL,
                version_number INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                content LONGTEXT NULL,
                edited_by INT NOT NULL,
                change_summary VARCHAR(255) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE RESTRICT,
                INDEX idx_versions_note (note_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 6. Note Activities Table (Audit History)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS note_activities (
                id INT AUTO_INCREMENT PRIMARY KEY,
                note_id INT NOT NULL,
                user_id INT NOT NULL,
                action_type ENUM(
                    'created',
                    'updated',
                    'shared',
                    'permission_changed',
                    'access_revoked',
                    'pinned',
                    'unpinned',
                    'archived',
                    'unarchived',
                    'linked',
                    'unlinked',
                    'restored'
                ) NOT NULL,
                details JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
                INDEX idx_activities_note (note_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 7. Polymorphic Entity Links Table (Tasks, Projects, Meetings, Knowledge Articles)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS note_links (
                id INT AUTO_INCREMENT PRIMARY KEY,
                note_id INT NOT NULL,
                entity_type ENUM('task', 'project', 'meeting', 'knowledge') NOT NULL,
                entity_id INT NOT NULL,
                title VARCHAR(255) NULL,
                created_by INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
                INDEX idx_links_note (note_id),
                INDEX idx_links_entity (entity_type, entity_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        console.log("Note tables initialized successfully.");
    } catch (err) {
        console.error("Error creating note tables:", err);
        throw err;
    }
};

module.exports = {
    createNoteTables
};
