const db = require("../config/db.js");
const uploadConfig = require("../config/uploadConfig.js");
const path = require("path");
const fs = require("fs");

// Helper: resolve effective note permission for a given user
// Returns 'owner' | 'edit' | 'comment' | 'view' | null
const resolveUserNotePermission = async (noteId, user) => {
    if (!user) return null;
    const isSuper = user.role === 'super_admin' || user.role === 'super admin' || user.role === 'developer';

    const [noteRows] = await db.execute(
        "SELECT id, owner_id, tenant_id, company_id, deleted_at FROM notes WHERE id = ?",
        [noteId]
    );
    if (noteRows.length === 0 || noteRows[0].deleted_at !== null) return null;

    const note = noteRows[0];
    if (isSuper) return 'owner';
    if (note.owner_id === user.id) return 'owner';

    // Check direct user share or group share
    const [shares] = await db.execute(`
        SELECT permission, expires_at 
        FROM note_shares 
        WHERE note_id = ? 
          AND (
            user_id = ? 
            OR (user_type_id IS NOT NULL AND user_type_id = ?)
          )
          AND (expires_at IS NULL OR expires_at > NOW())
    `, [noteId, user.id, user.user_type_id || -1]);

    if (shares.length === 0) {
        if (user.role === 'admin') return 'edit';
        return null;
    }

    // Determine highest permission: edit > comment > view
    const perms = shares.map(s => s.permission);
    if (perms.includes('edit')) return 'edit';
    if (perms.includes('comment')) return 'comment';
    if (perms.includes('view')) return 'view';

    return null;
};

// Helper: log note activity
const logNoteActivity = async (noteId, userId, actionType, details = null) => {
    try {
        await db.execute(`
            INSERT INTO note_activities (note_id, user_id, action_type, details)
            VALUES (?, ?, ?, ?)
        `, [noteId, userId, actionType, details ? JSON.stringify(details) : null]);
    } catch (err) {
        console.error("Failed to log note activity:", err.message);
    }
};

// ─── 1. Get Notes List (My Notes, Shared with Me, Archived) ─────────────────
exports.getNotes = async (req, res) => {
    try {
        const user = req.user;
        const tenantId = user.organization_id || 1;
        const companyId = user.company_id || 1;
        const scope = req.query.scope || "my_notes"; // 'my_notes' | 'shared_with_me' | 'archived'
        const priority = req.query.priority;
        const label = req.query.label;
        const color = req.query.color;
        const search = (req.query.q || req.query.search || "").trim();

        let baseQuery = "";
        let params = [];

        if (scope === "my_notes") {
            baseQuery = `
                SELECT 
                    n.*,
                    u.name AS owner_name,
                    u.email AS owner_email,
                    u.username AS owner_username,
                    'owner' AS my_permission,
                    (SELECT COUNT(*) FROM note_checklists nc WHERE nc.note_id = n.id) AS total_checklists,
                    (SELECT COUNT(*) FROM note_checklists nc WHERE nc.note_id = n.id AND nc.is_completed = 1) AS completed_checklists,
                    (SELECT COUNT(*) FROM note_attachments na WHERE na.note_id = n.id) AS attachments_count,
                    (SELECT COUNT(*) FROM note_links nl WHERE nl.note_id = n.id) AS links_count,
                    (SELECT COUNT(*) FROM note_shares ns WHERE ns.note_id = n.id) AS shares_count
                FROM notes n
                JOIN users u ON n.owner_id = u.id
                WHERE n.owner_id = ?
                  AND n.deleted_at IS NULL
                  AND n.is_archived = 0
            `;
            params.push(user.id);
        } else if (scope === "shared_with_me") {
            baseQuery = `
                SELECT 
                    n.*,
                    u.name AS owner_name,
                    u.email AS owner_email,
                    u.username AS owner_username,
                    MAX(CASE 
                        WHEN ns.permission = 'edit' THEN 'edit'
                        WHEN ns.permission = 'comment' THEN 'comment'
                        ELSE 'view'
                    END) AS my_permission,
                    (SELECT COUNT(*) FROM note_checklists nc WHERE nc.note_id = n.id) AS total_checklists,
                    (SELECT COUNT(*) FROM note_checklists nc WHERE nc.note_id = n.id AND nc.is_completed = 1) AS completed_checklists,
                    (SELECT COUNT(*) FROM note_attachments na WHERE na.note_id = n.id) AS attachments_count,
                    (SELECT COUNT(*) FROM note_links nl WHERE nl.note_id = n.id) AS links_count,
                    (SELECT COUNT(*) FROM note_shares ns_all WHERE ns_all.note_id = n.id) AS shares_count
                FROM notes n
                JOIN users u ON n.owner_id = u.id
                JOIN note_shares ns ON n.id = ns.note_id
                WHERE (
                    ns.user_id = ? 
                    OR (ns.user_type_id IS NOT NULL AND ns.user_type_id = ?)
                )
                  AND (ns.expires_at IS NULL OR ns.expires_at > NOW())
                  AND n.owner_id != ?
                  AND n.deleted_at IS NULL
                  AND n.is_archived = 0
                GROUP BY n.id, u.name, u.email, u.username
            `;
            params.push(user.id, user.user_type_id || -1, user.id);
        } else if (scope === "archived") {
            baseQuery = `
                SELECT 
                    n.*,
                    u.name AS owner_name,
                    u.email AS owner_email,
                    u.username AS owner_username,
                    CASE WHEN n.owner_id = ? THEN 'owner' ELSE 'view' END AS my_permission,
                    (SELECT COUNT(*) FROM note_checklists nc WHERE nc.note_id = n.id) AS total_checklists,
                    (SELECT COUNT(*) FROM note_checklists nc WHERE nc.note_id = n.id AND nc.is_completed = 1) AS completed_checklists,
                    (SELECT COUNT(*) FROM note_attachments na WHERE na.note_id = n.id) AS attachments_count,
                    (SELECT COUNT(*) FROM note_links nl WHERE nl.note_id = n.id) AS links_count,
                    (SELECT COUNT(*) FROM note_shares ns WHERE ns.note_id = n.id) AS shares_count
                FROM notes n
                JOIN users u ON n.owner_id = u.id
                LEFT JOIN note_shares ns ON n.id = ns.note_id AND (ns.user_id = ? OR ns.user_type_id = ?)
                WHERE (n.owner_id = ? OR ns.id IS NOT NULL)
                  AND n.deleted_at IS NULL
                  AND n.is_archived = 1
                GROUP BY n.id, u.name, u.email, u.username
            `;
            params.push(user.id, user.id, user.user_type_id || -1, user.id);
        } else {
            return res.status(400).json({ success: false, message: "Invalid scope parameter" });
        }

        // Additional filters
        let filterSql = "";
        if (priority) {
            filterSql += " AND n.priority = ?";
            params.push(priority);
        }
        if (color) {
            filterSql += " AND n.color = ?";
            params.push(color);
        }
        if (search) {
            filterSql += " AND (n.title LIKE ? OR n.content LIKE ?)";
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }

        const finalQuery = `
            SELECT * FROM (
                ${baseQuery}
            ) AS note_list
            WHERE 1=1 ${filterSql}
            ORDER BY is_pinned DESC, updated_at DESC
        `;

        const [notes] = await db.execute(finalQuery, params);

        // Parse labels JSON safely
        const formattedNotes = notes.map(note => ({
            ...note,
            labels: typeof note.labels === 'string' ? JSON.parse(note.labels || "[]") : (note.labels || []),
            is_pinned: Boolean(note.is_pinned),
            is_archived: Boolean(note.is_archived)
        }));

        res.status(200).json({
            success: true,
            scope,
            count: formattedNotes.length,
            notes: formattedNotes
        });
    } catch (err) {
        console.error("Error in getNotes:", err);
        res.status(500).json({ success: false, message: "Failed to fetch notes" });
    }
};

// ─── 2. Get Single Note by ID (Full Details) ────────────────────────────────
exports.getNoteById = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (!permission) {
            return res.status(403).json({ success: false, message: "Access denied to this note" });
        }

        const [notes] = await db.execute(`
            SELECT 
                n.*,
                u.name AS owner_name,
                u.email AS owner_email,
                u.username AS owner_username
            FROM notes n
            JOIN users u ON n.owner_id = u.id
            WHERE n.id = ? AND n.deleted_at IS NULL
        `, [noteId]);

        if (notes.length === 0) {
            return res.status(404).json({ success: false, message: "Note not found" });
        }

        const note = notes[0];
        note.labels = typeof note.labels === 'string' ? JSON.parse(note.labels || "[]") : (note.labels || []);
        note.is_pinned = Boolean(note.is_pinned);
        note.is_archived = Boolean(note.is_archived);
        note.my_permission = permission;

        // Fetch Checklists
        const [checklists] = await db.execute(
            "SELECT * FROM note_checklists WHERE note_id = ? ORDER BY position ASC, id ASC",
            [noteId]
        );

        // Fetch Attachments with absolute/express URL
        const [attachments] = await db.execute(`
            SELECT 
                na.*,
                u.name AS uploader_name
            FROM note_attachments na
            JOIN users u ON na.uploaded_by = u.id
            WHERE na.note_id = ?
            ORDER BY na.created_at DESC
        `, [noteId]);

        const formattedAttachments = attachments.map(att => ({
            ...att,
            file_url: uploadConfig.getFileUrl(att.file_path)
        }));

        // Fetch Polymorphic Links
        const [links] = await db.execute(
            "SELECT * FROM note_links WHERE note_id = ? ORDER BY created_at DESC",
            [noteId]
        );

        // Fetch Collaborator Shares (if user has owner or edit access)
        let shares = [];
        if (permission === 'owner' || user.role === 'admin') {
            const [shareRows] = await db.execute(`
                SELECT 
                    ns.*,
                    u.name AS user_name,
                    u.email AS user_email,
                    ut.type_name AS group_name
                FROM note_shares ns
                LEFT JOIN users u ON ns.user_id = u.id
                LEFT JOIN user_types ut ON ns.user_type_id = ut.id
                WHERE ns.note_id = ?
                ORDER BY ns.created_at DESC
            `, [noteId]);
            shares = shareRows;
        }

        res.status(200).json({
            success: true,
            note: {
                ...note,
                checklists: checklists.map(c => ({ ...c, is_completed: Boolean(c.is_completed) })),
                attachments: formattedAttachments,
                links,
                shares
            }
        });
    } catch (err) {
        console.error("Error in getNoteById:", err);
        res.status(500).json({ success: false, message: "Failed to fetch note details" });
    }
};

// ─── 3. Create Note ─────────────────────────────────────────────────────────
exports.createNote = async (req, res) => {
    try {
        const user = req.user;
        const tenantId = user.organization_id || 1;
        const companyId = user.company_id || 1;

        const {
            title,
            content = "",
            color = "#FFFFFF",
            priority = "medium",
            labels = [],
            is_pinned = false,
            checklists = [],
            links = []
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: "Note title is required" });
        }

        const labelsJson = JSON.stringify(Array.isArray(labels) ? labels : []);

        const [result] = await db.execute(`
            INSERT INTO notes (
                tenant_id, company_id, owner_id, title, content, 
                color, priority, labels, is_pinned, version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
            tenantId,
            companyId,
            user.id,
            title.trim(),
            content,
            color,
            priority,
            labelsJson,
            is_pinned ? 1 : 0
        ]);

        const noteId = result.insertId;

        // Insert Checklists if any
        if (Array.isArray(checklists) && checklists.length > 0) {
            for (let i = 0; i < checklists.length; i++) {
                const item = checklists[i];
                if (item && item.item_text && item.item_text.trim()) {
                    await db.execute(`
                        INSERT INTO note_checklists (note_id, item_text, is_completed, position)
                        VALUES (?, ?, ?, ?)
                    `, [noteId, item.item_text.trim(), item.is_completed ? 1 : 0, i]);
                }
            }
        }

        // Insert Links if any
        if (Array.isArray(links) && links.length > 0) {
            for (const link of links) {
                if (link && link.entity_type && link.entity_id) {
                    await db.execute(`
                        INSERT IGNORE INTO note_links (note_id, entity_type, entity_id, title, created_by)
                        VALUES (?, ?, ?, ?, ?)
                    `, [noteId, link.entity_type, link.entity_id, link.title || "", user.id]);
                }
            }
        }

        // Create initial Version snapshot (v1)
        await db.execute(`
            INSERT INTO note_versions (note_id, version_number, title, content, edited_by, change_summary)
            VALUES (?, 1, ?, ?, ?, 'Initial creation')
        `, [noteId, title.trim(), content, user.id]);

        // Log creation activity
        await logNoteActivity(noteId, user.id, 'created', { title: title.trim() });

        res.status(201).json({
            success: true,
            message: "Note created successfully",
            noteId
        });
    } catch (err) {
        console.error("Error in createNote:", err);
        res.status(500).json({ success: false, message: "Failed to create note" });
    }
};

// ─── 4. Update Note (with Optimistic Concurrency Conflict Detection) ────────
exports.updateNote = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (!permission || (permission !== 'owner' && permission !== 'edit')) {
            return res.status(403).json({ success: false, message: "You do not have edit permission for this note" });
        }

        const [existingRows] = await db.execute(
            "SELECT * FROM notes WHERE id = ? AND deleted_at IS NULL",
            [noteId]
        );
        if (existingRows.length === 0) {
            return res.status(404).json({ success: false, message: "Note not found" });
        }

        const currentNote = existingRows[0];

        // ─── Conflict Detection ─────────────────────────────────────────────
        const expectedVersion = req.body.version;
        if (expectedVersion !== undefined && expectedVersion !== null) {
            if (parseInt(expectedVersion, 10) !== currentNote.version) {
                return res.status(409).json({
                    success: false,
                    conflict: true,
                    message: "Conflict detected: This note has been updated by another user or session.",
                    currentVersion: currentNote.version,
                    currentNote: {
                        id: currentNote.id,
                        title: currentNote.title,
                        content: currentNote.content,
                        version: currentNote.version,
                        updated_at: currentNote.updated_at
                    }
                });
            }
        }

        const {
            title,
            content,
            color,
            priority,
            labels,
            is_pinned,
            is_archived,
            checklists,
            change_summary
        } = req.body;

        const newVersion = currentNote.version + 1;
        const updatedTitle = title !== undefined ? title.trim() : currentNote.title;
        const updatedContent = content !== undefined ? content : currentNote.content;
        const updatedColor = color !== undefined ? color : currentNote.color;
        const updatedPriority = priority !== undefined ? priority : currentNote.priority;
        const updatedLabels = labels !== undefined ? JSON.stringify(labels) : currentNote.labels;
        const updatedPinned = is_pinned !== undefined ? (is_pinned ? 1 : 0) : currentNote.is_pinned;
        const updatedArchived = is_archived !== undefined ? (is_archived ? 1 : 0) : currentNote.is_archived;

        await db.execute(`
            UPDATE notes 
            SET title = ?,
                content = ?,
                color = ?,
                priority = ?,
                labels = ?,
                is_pinned = ?,
                is_archived = ?,
                version = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [
            updatedTitle,
            updatedContent,
            updatedColor,
            updatedPriority,
            updatedLabels,
            updatedPinned,
            updatedArchived,
            newVersion,
            noteId
        ]);

        // Sync Checklists if provided
        if (Array.isArray(checklists)) {
            // Remove existing and re-insert in order
            await db.execute("DELETE FROM note_checklists WHERE note_id = ?", [noteId]);
            for (let i = 0; i < checklists.length; i++) {
                const item = checklists[i];
                if (item && item.item_text && item.item_text.trim()) {
                    await db.execute(`
                        INSERT INTO note_checklists (note_id, item_text, is_completed, position)
                        VALUES (?, ?, ?, ?)
                    `, [noteId, item.item_text.trim(), item.is_completed ? 1 : 0, i]);
                }
            }
        }

        // Save new version snapshot
        await db.execute(`
            INSERT INTO note_versions (note_id, version_number, title, content, edited_by, change_summary)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            noteId,
            newVersion,
            updatedTitle,
            updatedContent,
            user.id,
            change_summary || `Updated to version ${newVersion}`
        ]);

        // Log activity
        await logNoteActivity(noteId, user.id, 'updated', {
            version: newVersion,
            summary: change_summary || "Note content updated"
        });

        res.status(200).json({
            success: true,
            message: "Note updated successfully",
            version: newVersion
        });
    } catch (err) {
        console.error("Error in updateNote:", err);
        res.status(500).json({ success: false, message: "Failed to update note" });
    }
};

// ─── 5. Delete / Archive Note ───────────────────────────────────────────────
exports.deleteNote = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (permission !== 'owner' && user.role !== 'admin' && user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: "Only the note owner can delete this note" });
        }

        await db.execute("UPDATE notes SET deleted_at = NOW() WHERE id = ?", [noteId]);
        await logNoteActivity(noteId, user.id, 'archived', { action: "deleted" });

        res.status(200).json({ success: true, message: "Note deleted successfully" });
    } catch (err) {
        console.error("Error in deleteNote:", err);
        res.status(500).json({ success: false, message: "Failed to delete note" });
    }
};

// ─── 6. Toggle Pin Status ───────────────────────────────────────────────────
exports.togglePinNote = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (!permission) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        const [rows] = await db.execute("SELECT is_pinned FROM notes WHERE id = ?", [noteId]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Note not found" });

        const newPinnedState = rows[0].is_pinned ? 0 : 1;
        await db.execute("UPDATE notes SET is_pinned = ? WHERE id = ?", [newPinnedState, noteId]);

        await logNoteActivity(noteId, user.id, newPinnedState ? 'pinned' : 'unpinned');

        res.status(200).json({
            success: true,
            is_pinned: Boolean(newPinnedState),
            message: newPinnedState ? "Note pinned to top" : "Note unpinned"
        });
    } catch (err) {
        console.error("Error in togglePinNote:", err);
        res.status(500).json({ success: false, message: "Failed to toggle pin" });
    }
};

// ─── 7. Toggle Checklist Item ───────────────────────────────────────────────
exports.toggleChecklistItem = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const checklistId = parseInt(req.params.checklistId, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (!permission || permission === 'view') {
            return res.status(403).json({ success: false, message: "Cannot edit checklist with view-only access" });
        }

        const [rows] = await db.execute(
            "SELECT is_completed FROM note_checklists WHERE id = ? AND note_id = ?",
            [checklistId, noteId]
        );
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Checklist item not found" });

        const newState = rows[0].is_completed ? 0 : 1;
        await db.execute(
            "UPDATE note_checklists SET is_completed = ? WHERE id = ?",
            [newState, checklistId]
        );

        res.status(200).json({
            success: true,
            checklistId,
            is_completed: Boolean(newState)
        });
    } catch (err) {
        console.error("Error in toggleChecklistItem:", err);
        res.status(500).json({ success: false, message: "Failed to toggle checklist" });
    }
};

// ─── 8. Share Note & Assign Permissions ─────────────────────────────────────
exports.shareNote = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (permission !== 'owner' && user.role !== 'admin' && user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: "Only the owner can share this note" });
        }

        const {
            userId,
            userTypeId,
            permission: sharePermission = 'view',
            expiresAt = null
        } = req.body;

        if (!userId && !userTypeId) {
            return res.status(400).json({ success: false, message: "Please select a user or group to share with" });
        }

        if (!['view', 'comment', 'edit'].includes(sharePermission)) {
            return res.status(400).json({ success: false, message: "Invalid permission level" });
        }

        // Prevent sharing with oneself
        if (userId && parseInt(userId, 10) === user.id) {
            return res.status(400).json({ success: false, message: "You already own this note" });
        }

        if (userId) {
            // Upsert user share
            await db.execute(`
                INSERT INTO note_shares (note_id, user_id, permission, shared_by, expires_at)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    permission = VALUES(permission),
                    expires_at = VALUES(expires_at),
                    updated_at = NOW()
            `, [noteId, userId, sharePermission, user.id, expiresAt]);
        } else if (userTypeId) {
            // Upsert group share
            await db.execute(`
                INSERT INTO note_shares (note_id, user_type_id, permission, shared_by, expires_at)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    permission = VALUES(permission),
                    expires_at = VALUES(expires_at),
                    updated_at = NOW()
            `, [noteId, userTypeId, sharePermission, user.id, expiresAt]);
        }

        await logNoteActivity(noteId, user.id, 'shared', {
            target: userId ? `user_${userId}` : `group_${userTypeId}`,
            permission: sharePermission
        });

        res.status(200).json({
            success: true,
            message: `Shared with ${sharePermission} permission`
        });
    } catch (err) {
        console.error("Error in shareNote:", err);
        res.status(500).json({ success: false, message: "Failed to share note" });
    }
};

// ─── 9. Revoke Access Immediately ───────────────────────────────────────────
exports.revokeNoteShare = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const shareId = parseInt(req.params.shareId, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (permission !== 'owner' && user.role !== 'admin' && user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: "Only the owner can revoke access" });
        }

        const [rows] = await db.execute("SELECT * FROM note_shares WHERE id = ? AND note_id = ?", [shareId, noteId]);
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Share permission not found" });
        }

        await db.execute("DELETE FROM note_shares WHERE id = ? AND note_id = ?", [shareId, noteId]);
        await logNoteActivity(noteId, user.id, 'access_revoked', { shareId });

        res.status(200).json({
            success: true,
            message: "Access revoked immediately"
        });
    } catch (err) {
        console.error("Error in revokeNoteShare:", err);
        res.status(500).json({ success: false, message: "Failed to revoke access" });
    }
};

// ─── 10. Get Note Activity & Version History ────────────────────────────────
exports.getNoteHistory = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (!permission) {
            return res.status(403).json({ success: false, message: "Access denied" });
        }

        // Fetch Activities
        const [activities] = await db.execute(`
            SELECT 
                na.*,
                u.name AS user_name,
                u.email AS user_email
            FROM note_activities na
            JOIN users u ON na.user_id = u.id
            WHERE na.note_id = ?
            ORDER BY na.created_at DESC
            LIMIT 50
        `, [noteId]);

        // Fetch Versions
        const [versions] = await db.execute(`
            SELECT 
                nv.id,
                nv.note_id,
                nv.version_number,
                nv.title,
                nv.content,
                nv.change_summary,
                nv.created_at,
                u.name AS edited_by_name
            FROM note_versions nv
            JOIN users u ON nv.edited_by = u.id
            WHERE nv.note_id = ?
            ORDER BY nv.version_number DESC
            LIMIT 30
        `, [noteId]);

        res.status(200).json({
            success: true,
            activities: activities.map(a => ({
                ...a,
                details: typeof a.details === 'string' ? JSON.parse(a.details || "{}") : (a.details || {})
            })),
            versions
        });
    } catch (err) {
        console.error("Error in getNoteHistory:", err);
        res.status(500).json({ success: false, message: "Failed to fetch note history" });
    }
};

// ─── 11. Restore Past Version ───────────────────────────────────────────────
exports.restoreNoteVersion = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const versionId = parseInt(req.params.versionId, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (permission !== 'owner' && permission !== 'edit') {
            return res.status(403).json({ success: false, message: "You do not have permission to restore versions" });
        }

        const [versionRows] = await db.execute(
            "SELECT * FROM note_versions WHERE id = ? AND note_id = ?",
            [versionId, noteId]
        );
        if (versionRows.length === 0) {
            return res.status(404).json({ success: false, message: "Version snapshot not found" });
        }

        const targetVersion = versionRows[0];

        const [noteRows] = await db.execute("SELECT version FROM notes WHERE id = ?", [noteId]);
        const currentVersion = noteRows[0].version;
        const newVersionNumber = currentVersion + 1;

        await db.execute(`
            UPDATE notes 
            SET title = ?,
                content = ?,
                version = ?,
                updated_at = NOW()
            WHERE id = ?
        `, [targetVersion.title, targetVersion.content, newVersionNumber, noteId]);

        // Create a new version snapshot for this restore event
        await db.execute(`
            INSERT INTO note_versions (note_id, version_number, title, content, edited_by, change_summary)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [noteId, newVersionNumber, targetVersion.title, targetVersion.content, user.id, `Restored from version ${targetVersion.version_number}`]);

        await logNoteActivity(noteId, user.id, 'restored', {
            restoredFromVersion: targetVersion.version_number,
            newVersion: newVersionNumber
        });

        res.status(200).json({
            success: true,
            message: `Restored version ${targetVersion.version_number} successfully`,
            newVersion: newVersionNumber
        });
    } catch (err) {
        console.error("Error in restoreNoteVersion:", err);
        res.status(500).json({ success: false, message: "Failed to restore version" });
    }
};

// ─── 12. Upload Note Attachment ─────────────────────────────────────────────
exports.uploadNoteAttachment = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (permission !== 'owner' && permission !== 'edit') {
            return res.status(403).json({ success: false, message: "Cannot attach files with view/comment access" });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const relativePath = path.relative(uploadConfig.uploadDir, req.file.path).replace(/\\/g, "/");

        const [result] = await db.execute(`
            INSERT INTO note_attachments (note_id, file_name, file_path, file_size, mime_type, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            noteId,
            req.file.originalname,
            relativePath,
            req.file.size,
            req.file.mimetype || 'application/octet-stream',
            user.id
        ]);

        await logNoteActivity(noteId, user.id, 'updated', {
            action: "attached_file",
            fileName: req.file.originalname
        });

        res.status(201).json({
            success: true,
            message: "Attachment uploaded successfully",
            attachment: {
                id: result.insertId,
                note_id: noteId,
                file_name: req.file.originalname,
                file_path: relativePath,
                file_url: uploadConfig.getFileUrl(relativePath),
                file_size: req.file.size,
                mime_type: req.file.mimetype
            }
        });
    } catch (err) {
        console.error("Error in uploadNoteAttachment:", err);
        res.status(500).json({ success: false, message: "Failed to upload attachment" });
    }
};

// ─── 13. Delete Note Attachment ─────────────────────────────────────────────
exports.deleteNoteAttachment = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const attachmentId = parseInt(req.params.attachmentId, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (permission !== 'owner' && permission !== 'edit') {
            return res.status(403).json({ success: false, message: "Cannot delete attachments with view-only access" });
        }

        const [rows] = await db.execute(
            "SELECT * FROM note_attachments WHERE id = ? AND note_id = ?",
            [attachmentId, noteId]
        );
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Attachment not found" });
        }

        await db.execute("DELETE FROM note_attachments WHERE id = ?", [attachmentId]);

        res.status(200).json({ success: true, message: "Attachment deleted successfully" });
    } catch (err) {
        console.error("Error in deleteNoteAttachment:", err);
        res.status(500).json({ success: false, message: "Failed to delete attachment" });
    }
};

// ─── 14. Add / Delete Polymorphic Entity Links ──────────────────────────────
exports.addNoteLink = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (permission !== 'owner' && permission !== 'edit') {
            return res.status(403).json({ success: false, message: "Cannot add links without edit permission" });
        }

        const { entity_type, entity_id, title } = req.body;
        if (!entity_type || !entity_id) {
            return res.status(400).json({ success: false, message: "Entity type and ID are required" });
        }

        const [result] = await db.execute(`
            INSERT INTO note_links (note_id, entity_type, entity_id, title, created_by)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE title = VALUES(title)
        `, [noteId, entity_type, entity_id, title || "", user.id]);

        await logNoteActivity(noteId, user.id, 'linked', { entity_type, entity_id, title });

        res.status(201).json({
            success: true,
            message: "Link added successfully",
            linkId: result.insertId
        });
    } catch (err) {
        console.error("Error in addNoteLink:", err);
        res.status(500).json({ success: false, message: "Failed to add entity link" });
    }
};

exports.deleteNoteLink = async (req, res) => {
    try {
        const noteId = parseInt(req.params.id, 10);
        const linkId = parseInt(req.params.linkId, 10);
        const user = req.user;

        const permission = await resolveUserNotePermission(noteId, user);
        if (permission !== 'owner' && permission !== 'edit') {
            return res.status(403).json({ success: false, message: "Cannot remove links without edit permission" });
        }

        await db.execute("DELETE FROM note_links WHERE id = ? AND note_id = ?", [linkId, noteId]);
        await logNoteActivity(noteId, user.id, 'unlinked', { linkId });

        res.status(200).json({ success: true, message: "Link removed successfully" });
    } catch (err) {
        console.error("Error in deleteNoteLink:", err);
        res.status(500).json({ success: false, message: "Failed to remove link" });
    }
};

// ─── 15. Helper: Get Linkable Entities (Tasks & Projects in tenant) ──────────
exports.getLinkableEntities = async (req, res) => {
    try {
        const user = req.user;
        const tenantId = user.organization_id || 1;
        const companyId = user.company_id || 1;

        // Fetch recent tasks
        const [tasks] = await db.execute(`
            SELECT id, title, task_code, status, priority 
            FROM tasks 
            WHERE tenant_id = ? AND company_id = ? AND deleted_at IS NULL
            ORDER BY id DESC LIMIT 50
        `, [tenantId, companyId]);

        // Fetch recent projects
        const [projects] = await db.execute(`
            SELECT id, name AS title, code AS project_code, status 
            FROM projects 
            WHERE tenant_id = ?
            ORDER BY id DESC LIMIT 50
        `, [tenantId]);

        res.status(200).json({
            success: true,
            tasks,
            projects
        });
    } catch (err) {
        console.error("Error in getLinkableEntities:", err);
        res.status(500).json({ success: false, message: "Failed to fetch linkable entities" });
    }
};

// ─── 16. Helper: Get Company Users & User Types (for Share Modal) ───────────
exports.getCompanyUsersAndGroups = async (req, res) => {
    try {
        const user = req.user;
        const tenantId = user.organization_id || 1;
        const companyId = user.company_id || 1;

        // Fetch users in same tenant
        const [users] = await db.execute(`
            SELECT id, name, email, username, role 
            FROM users 
            WHERE organization_id = ? AND active = 1 AND id != ?
            ORDER BY name ASC
        `, [tenantId, user.id]);

        // Fetch user types / groups
        const [groups] = await db.execute(`
            SELECT id, type_name 
            FROM user_types 
            ORDER BY type_name ASC
        `);

        res.status(200).json({
            success: true,
            users,
            groups
        });
    } catch (err) {
        console.error("Error in getCompanyUsersAndGroups:", err);
        res.status(500).json({ success: false, message: "Failed to fetch users and groups" });
    }
};
