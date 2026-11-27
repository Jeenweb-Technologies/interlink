const {
    getReminders,
    getReminderById,
    createReminder,
    snoozeReminder,
    completeReminder,
    dismissReminder,
    escalateReminder,
    deleteReminder,
    getReminderPreferences,
    updateReminderPreferences,
    getReminderMetrics
} = require("../models/reminderModel.js");

// 1. Get user reminders with filtering and pagination
exports.getReminders = async (req, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.user?.organization_id || 1;
        const { status = 'all', sourceType, page = 1, limit = 50 } = req.query;

        const offset = (Number(page) - 1) * Number(limit);

        const reminders = await getReminders(userId, organizationId, {
            status,
            sourceType,
            limit: Number(limit),
            offset: Number(offset)
        });

        return res.status(200).json({
            success: true,
            page: Number(page),
            limit: Number(limit),
            count: reminders.length,
            data: reminders
        });
    } catch (err) {
        console.error("[ReminderController] getReminders error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch reminders",
            error: err.message
        });
    }
};

// 2. Get Reminder Center summary metrics
exports.getMetrics = async (req, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.user?.organization_id || 1;

        const metrics = await getReminderMetrics(userId, organizationId);

        return res.status(200).json({
            success: true,
            data: metrics
        });
    } catch (err) {
        console.error("[ReminderController] getMetrics error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch reminder metrics" });
    }
};

// 3. Create a new reminder
exports.createReminder = async (req, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;

        const {
            title,
            description,
            source_type,
            source_id,
            deep_link_url,
            trigger_at,
            timezone,
            is_recurring,
            recurrence_rule,
            escalation_enabled,
            escalation_rule,
            expires_at
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: "Reminder title is required." });
        }
        if (!trigger_at) {
            return res.status(400).json({ success: false, message: "trigger_at timestamp is required." });
        }

        const reminderId = await createReminder({
            organization_id: organizationId,
            company_id: companyId,
            user_id: userId,
            title: title.trim(),
            description,
            source_type: source_type || 'personal',
            source_id: source_id || null,
            deep_link_url,
            trigger_at,
            timezone: timezone || 'UTC',
            is_recurring: Boolean(is_recurring),
            recurrence_rule,
            escalation_enabled: Boolean(escalation_enabled),
            escalation_rule,
            expires_at
        });

        const created = await getReminderById(reminderId);

        return res.status(201).json({
            success: true,
            message: "Reminder scheduled successfully",
            data: created
        });
    } catch (err) {
        console.error("[ReminderController] createReminder error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to create reminder",
            error: err.message
        });
    }
};

// 4. Snooze reminder
exports.snoozeReminder = async (req, res) => {
    try {
        const reminderId = parseInt(req.params.id, 10);
        const { snoozeUntil, minutes } = req.body;

        if (!snoozeUntil && (!minutes || Number(minutes) <= 0)) {
            return res.status(400).json({ success: false, message: "snoozeUntil timestamp or minutes duration is required" });
        }

        await snoozeReminder(reminderId, { snoozeUntil, minutes });

        return res.status(200).json({
            success: true,
            message: "Reminder snoozed successfully"
        });
    } catch (err) {
        console.error("[ReminderController] snoozeReminder error:", err);
        return res.status(500).json({ success: false, message: "Failed to snooze reminder" });
    }
};

// 5. Complete reminder
exports.completeReminder = async (req, res) => {
    try {
        const reminderId = parseInt(req.params.id, 10);
        await completeReminder(reminderId);

        return res.status(200).json({
            success: true,
            message: "Reminder marked as completed"
        });
    } catch (err) {
        console.error("[ReminderController] completeReminder error:", err);
        return res.status(500).json({ success: false, message: "Failed to complete reminder" });
    }
};

// 6. Dismiss reminder
exports.dismissReminder = async (req, res) => {
    try {
        const reminderId = parseInt(req.params.id, 10);
        await dismissReminder(reminderId);

        return res.status(200).json({
            success: true,
            message: "Reminder dismissed"
        });
    } catch (err) {
        console.error("[ReminderController] dismissReminder error:", err);
        return res.status(500).json({ success: false, message: "Failed to dismiss reminder" });
    }
};

// 7. Escalate reminder
exports.escalateReminder = async (req, res) => {
    try {
        const reminderId = parseInt(req.params.id, 10);
        const { escalateToUserId } = req.body;

        await escalateReminder(reminderId, escalateToUserId || null);

        return res.status(200).json({
            success: true,
            message: "Reminder escalated"
        });
    } catch (err) {
        console.error("[ReminderController] escalateReminder error:", err);
        return res.status(500).json({ success: false, message: "Failed to escalate reminder" });
    }
};

// 8. Delete reminder
exports.deleteReminder = async (req, res) => {
    try {
        const reminderId = parseInt(req.params.id, 10);
        await deleteReminder(reminderId);

        return res.status(200).json({
            success: true,
            message: "Reminder deleted"
        });
    } catch (err) {
        console.error("[ReminderController] deleteReminder error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete reminder" });
    }
};

// 9. Preferences
exports.getPreferences = async (req, res) => {
    try {
        const userId = req.user?.id;
        const prefs = await getReminderPreferences(userId);

        return res.status(200).json({
            success: true,
            data: prefs
        });
    } catch (err) {
        console.error("[ReminderController] getPreferences error:", err);
        return res.status(500).json({ success: false, message: "Failed to load preferences" });
    }
};

exports.updatePreferences = async (req, res) => {
    try {
        const userId = req.user?.id;
        const updates = req.body;

        await updateReminderPreferences(userId, updates);

        const updated = await getReminderPreferences(userId);

        return res.status(200).json({
            success: true,
            message: "Preferences updated successfully",
            data: updated
        });
    } catch (err) {
        console.error("[ReminderController] updatePreferences error:", err);
        return res.status(500).json({ success: false, message: "Failed to update preferences" });
    }
};
