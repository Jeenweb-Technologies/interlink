const db = require("../config/db.js");
const {
    getDueRemindersForWorker,
    logReminderDelivery,
    escalateReminder,
    getReminderPreferences
} = require("../models/reminderModel.js");

let daemonInterval = null;

/**
 * Start precision scheduler daemon for background reminders & escalations
 */
const startReminderDaemon = (io) => {
    if (daemonInterval) {
        clearInterval(daemonInterval);
    }

    console.log("[ReminderDaemon] Precision scheduler started (interval: 30s).");

    const processTick = async () => {
        try {
            // 1. Process Due Reminders
            const dueReminders = await getDueRemindersForWorker(50);
            
            for (const rem of dueReminders) {
                const prefs = await getReminderPreferences(rem.user_id);

                // Check quiet hours (DND)
                let suppressForQuietHours = false;
                if (prefs.quiet_hours_enabled) {
                    const now = new Date();
                    const nowTime = now.toTimeString().slice(0, 8); // "HH:MM:SS"
                    if (prefs.quiet_hours_start < prefs.quiet_hours_end) {
                        suppressForQuietHours = nowTime >= prefs.quiet_hours_start && nowTime <= prefs.quiet_hours_end;
                    } else {
                        // Overnight quiet hours (e.g. 22:00 to 08:00)
                        suppressForQuietHours = nowTime >= prefs.quiet_hours_start || nowTime <= prefs.quiet_hours_end;
                    }
                }

                // In-App Socket.IO delivery
                if (prefs.channel_in_app && !suppressForQuietHours && io) {
                    io.to(`user_${rem.user_id}`).emit("reminder_alert", {
                        id: rem.id,
                        title: rem.title,
                        description: rem.description,
                        sourceType: rem.source_type,
                        sourceId: rem.source_id,
                        deepLinkUrl: rem.deep_link_url,
                        triggerAt: rem.trigger_at,
                        snoozeCount: rem.snooze_count,
                        timestamp: new Date().toISOString()
                    });
                    await logReminderDelivery(rem.id, rem.user_id, 'in_app', 'sent');
                } else if (suppressForQuietHours) {
                    await logReminderDelivery(rem.id, rem.user_id, 'in_app', 'suppressed_quiet_hours');
                }

                // If snoozed, reset status back to pending after firing alert
                if (rem.status === 'snoozed') {
                    await db.execute(`
                        UPDATE reminders 
                        SET status = 'pending', snooze_until = NULL 
                        WHERE id = ?
                    `, [rem.id]);
                }
            }

            // 2. Process Escalations for overdue, unacknowledged reminders
            const [pendingEscalations] = await db.execute(`
                SELECT r.*, u.name as user_name, u.department_id
                FROM reminders r
                JOIN users u ON r.user_id = u.id
                WHERE r.status = 'pending'
                  AND r.escalation_enabled = TRUE
                  AND r.escalated_at IS NULL
                  AND r.trigger_at <= DATE_SUB(NOW(), INTERVAL 60 MINUTE)
                LIMIT 20
            `);

            for (const item of pendingEscalations) {
                let targetEscalateUserId = null;
                try {
                    const escRule = typeof item.escalation_rule === 'string' 
                        ? JSON.parse(item.escalation_rule) 
                        : item.escalation_rule;

                    targetEscalateUserId = escRule?.escalate_to_user_id || null;
                } catch (_) {}

                // If no specific user specified in rule, escalate to department head or admin
                if (!targetEscalateUserId && item.department_id) {
                    const [dept] = await db.execute(`
                        SELECT manager_id FROM departments WHERE id = ?
                    `, [item.department_id]);
                    if (dept.length > 0 && dept[0].manager_id) {
                        targetEscalateUserId = dept[0].manager_id;
                    }
                }

                if (targetEscalateUserId) {
                    await escalateReminder(item.id, targetEscalateUserId);

                    if (io) {
                        io.to(`user_${targetEscalateUserId}`).emit("reminder_escalated", {
                            id: item.id,
                            title: `[ESCALATED] ${item.title}`,
                            description: `Reminder for ${item.user_name} was unacknowledged for over 60 minutes.`,
                            sourceType: item.source_type,
                            sourceId: item.source_id,
                            deepLinkUrl: item.deep_link_url,
                            originalUserId: item.user_id,
                            originalUserName: item.user_name,
                            timestamp: new Date().toISOString()
                        });
                    }
                }
            }
        } catch (err) {
            if (err.code === 'ER_NO_SUCH_TABLE') {
                return; // Suppress logs while tables are being established
            }
            console.error("[ReminderDaemon] Error in processing cycle:", err.message);
        }
    };

    // Run immediately on launch, then every 15 seconds for precision alerting
    processTick();
    daemonInterval = setInterval(processTick, 15000);
};

const stopReminderDaemon = () => {
    if (daemonInterval) {
        clearInterval(daemonInterval);
        daemonInterval = null;
    }
};

module.exports = {
    startReminderDaemon,
    stopReminderDaemon
};
