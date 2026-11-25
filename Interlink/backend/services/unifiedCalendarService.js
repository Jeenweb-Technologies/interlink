const db = require("../config/db.js");

/**
 * Unified Calendar Aggregation Service
 * Dynamically aggregates native calendar events, scheduled meetings, task deadlines,
 * project milestones, and reminders WITHOUT duplicating source records.
 */

// Format date to ISO string safely
const toISO = (date) => {
    if (!date) return null;
    try {
        return new Date(date).toISOString();
    } catch (_) {
        return null;
    }
};

/**
 * Query unified calendar feed across all modules for a date range
 */
const getUnifiedFeed = async ({
    organizationId,
    companyId,
    userId,
    userDepartmentId = null,
    startDate,
    endDate,
    filters = {}
}) => {
    const {
        includeEvents = true,
        includeMeetings = true,
        includeTasks = true,
        includeProjects = true,
        includeReminders = true,
        selectedCalendarIds = null // Array or comma-delimited string of calendar IDs
    } = filters;

    const items = [];
    const startStr = `${startDate} 00:00:00`;
    const endStr = `${endDate} 23:59:59`;

    // 1. Native Calendar Events
    if (includeEvents) {
        let calIdFilter = "";
        const calParams = [userId, userId, userDepartmentId || -1, organizationId, startStr, endStr, endStr, startStr];

        if (selectedCalendarIds && Array.isArray(selectedCalendarIds) && selectedCalendarIds.length > 0) {
            const placeholders = selectedCalendarIds.map(() => '?').join(',');
            calIdFilter = `AND ce.calendar_id IN (${placeholders})`;
            calParams.push(...selectedCalendarIds);
        }

        const [events] = await db.execute(`
            SELECT 
                ce.*,
                c.name as calendar_name,
                c.color as calendar_color,
                c.type as calendar_type,
                cs.permission_level as shared_permission,
                CASE 
                    WHEN c.owner_id = ? THEN 'admin'
                    WHEN cs.permission_level IS NOT NULL THEN cs.permission_level
                    WHEN c.is_public = 1 THEN 'view_details'
                    ELSE 'none'
                END as effective_permission,
                u.name as creator_name
            FROM calendar_events ce
            JOIN calendars c ON ce.calendar_id = c.id
            JOIN users u ON ce.creator_id = u.id
            LEFT JOIN calendar_shares cs ON c.id = cs.calendar_id AND (
                cs.shared_with_user_id = ? 
                OR (cs.shared_with_department_id IS NOT NULL AND cs.shared_with_department_id = ?)
            )
            WHERE ce.deleted_at IS NULL
              AND c.organization_id = ?
              AND ce.start_time <= ? 
              AND ce.end_time >= ?
              ${calIdFilter}
        `, [userId, userId, userDepartmentId || -1, organizationId, endStr, startStr, ...(selectedCalendarIds && Array.isArray(selectedCalendarIds) && selectedCalendarIds.length > 0 ? selectedCalendarIds : [])]);

        for (const evt of events) {
            const isFreeBusyOnly = evt.effective_permission === 'free_busy_only' && evt.creator_id !== userId;

            items.push({
                id: `event_${evt.id}`,
                sourceType: 'event',
                sourceId: evt.id,
                title: isFreeBusyOnly ? 'Busy' : evt.title,
                description: isFreeBusyOnly ? null : evt.description,
                location: isFreeBusyOnly ? null : evt.location,
                meetingUrl: isFreeBusyOnly ? null : evt.meeting_url,
                startTime: toISO(evt.start_time),
                endTime: toISO(evt.end_time),
                isAllDay: Boolean(evt.is_all_day),
                color: evt.color_override || evt.calendar_color || '#2878C7',
                category: evt.category || 'general',
                isReadOnly: evt.effective_permission === 'free_busy_only' || evt.effective_permission === 'view_details',
                calendarId: evt.calendar_id,
                calendarName: evt.calendar_name,
                isRecurring: Boolean(evt.is_recurring),
                deepLink: `/calendar?event=${evt.id}`,
                metadata: {
                    creatorName: isFreeBusyOnly ? null : evt.creator_name,
                    isOrganizer: evt.creator_id === userId,
                    linkedMeetingId: evt.linked_meeting_id,
                    linkedTaskId: evt.linked_task_id,
                    linkedProjectId: evt.linked_project_id
                }
            });
        }
    }

    // 2. Scheduled Meetings (LiveKit / Video Meetings from `meetings` table)
    if (includeMeetings) {
        const [meetings] = await db.execute(`
            SELECT 
                m.*,
                u.name as host_name,
                u.email as host_email,
                mp.role as user_role,
                mp.status as participant_status
            FROM meetings m
            JOIN users u ON m.host_id = u.id
            LEFT JOIN meeting_participants mp ON m.id = mp.meeting_id AND mp.user_id = ?
            WHERE m.organization_id = ?
              AND m.status != 'cancelled'
              AND (m.host_id = ? OR mp.user_id = ?)
              AND m.scheduled_start IS NOT NULL
              AND m.scheduled_start <= ?
              AND (m.scheduled_end >= ? OR (m.scheduled_end IS NULL AND m.scheduled_start >= ?))
        `, [userId, organizationId, userId, userId, endStr, startStr, startStr]);

        for (const m of meetings) {
            const start = toISO(m.scheduled_start);
            const end = m.scheduled_end 
                ? toISO(m.scheduled_end) 
                : toISO(new Date(new Date(m.scheduled_start).getTime() + 60 * 60 * 1000));

            const isEnded = m.status === 'ended';

            items.push({
                id: `meeting_${m.id}`,
                sourceType: 'meeting',
                sourceId: m.id,
                title: m.title || 'Scheduled Meeting',
                description: m.description,
                location: `Room ${m.room_code}`,
                meetingUrl: isEnded ? null : `/meetings/join/${m.room_code}`,
                startTime: start,
                endTime: end,
                isAllDay: false,
                color: isEnded ? '#64748B' : '#0284c7', // Slate if ended, Cyan/Blue if active
                category: 'meeting',
                isReadOnly: m.host_id !== userId,
                calendarName: 'Interlink Meetings',
                deepLink: isEnded ? `/meetings/summary/${m.id}` : `/meetings/join/${m.room_code}`,
                metadata: {
                    roomCode: m.room_code,
                    hostName: m.host_name,
                    hostId: m.host_id,
                    meetingStatus: m.status,
                    userRole: m.user_role || (m.host_id === userId ? 'host' : 'participant'),
                    isEnded
                }
            });
        }
    }

    // 3. Task Due Dates & Milestones (from `tasks` table)
    if (includeTasks) {
        const [tasks] = await db.execute(`
            SELECT 
                t.id, t.task_code, t.title, t.description, t.status, t.priority,
                t.start_date, t.due_date, t.owner_id,
                p.name as project_name, p.code as project_code,
                u.name as owner_name
            FROM tasks t
            LEFT JOIN projects p ON t.project_id = p.id
            JOIN users u ON t.owner_id = u.id
            WHERE t.tenant_id = ?
              AND t.deleted_at IS NULL
              AND t.status != 'cancelled'
              AND (t.owner_id = ? OR t.assigned_team_id IS NOT NULL)
              AND (
                  (t.due_date IS NOT NULL AND t.due_date BETWEEN ? AND ?)
                  OR (t.start_date IS NOT NULL AND t.start_date BETWEEN ? AND ?)
              )
        `, [organizationId, userId, startStr, endStr, startStr, endStr]);

        for (const t of tasks) {
            const dueDate = t.due_date ? toISO(t.due_date) : toISO(t.start_date);
            const isCompleted = t.status === 'done';

            // Priority-based accent color
            let taskColor = '#10B981'; // done/default emerald
            if (!isCompleted) {
                if (t.priority === 'urgent') taskColor = '#EF4444'; // Red
                else if (t.priority === 'high') taskColor = '#F59E0B'; // Amber
                else taskColor = '#3B82F6'; // Blue
            }

            items.push({
                id: `task_${t.id}`,
                sourceType: 'task',
                sourceId: t.id,
                title: `[${t.task_code}] ${t.title}`,
                description: t.description,
                location: t.project_name ? `Project: ${t.project_name}` : null,
                meetingUrl: null,
                startTime: dueDate,
                endTime: dueDate,
                isAllDay: true,
                color: taskColor,
                category: 'task',
                isReadOnly: false,
                calendarName: 'My Tasks',
                deepLink: `/tasks?selected=${t.id}`,
                metadata: {
                    taskCode: t.task_code,
                    status: t.status,
                    priority: t.priority,
                    projectName: t.project_name,
                    isCompleted
                }
            });
        }
    }

    // 4. Project Milestones (from `projects` table)
    if (includeProjects) {
        // Exclude cancelled and archived projects (adhering to latest git PR #27 project status ENUMs)
        const [projects] = await db.execute(`
            SELECT 
                p.id, p.code, p.name, p.description, p.status, p.priority,
                p.start_date, p.end_date,
                u.name as manager_name
            FROM projects p
            JOIN users u ON p.owner_id = u.id
            WHERE p.tenant_id = ?
              AND p.deleted_at IS NULL
              AND p.status NOT IN ('cancelled', 'archived')
              AND (
                  (p.end_date IS NOT NULL AND p.end_date BETWEEN ? AND ?)
                  OR (p.start_date IS NOT NULL AND p.start_date BETWEEN ? AND ?)
              )
        `, [organizationId, startDate, endDate, startDate, endDate]);

        for (const p of projects) {
            if (p.end_date) {
                items.push({
                    id: `project_end_${p.id}`,
                    sourceType: 'project',
                    sourceId: p.id,
                    title: `🏁 [${p.code}] ${p.name} (Deadline)`,
                    description: p.description,
                    location: null,
                    meetingUrl: null,
                    startTime: toISO(p.end_date),
                    endTime: toISO(p.end_date),
                    isAllDay: true,
                    color: '#6366F1', // Indigo
                    category: 'milestone',
                    isReadOnly: true,
                    calendarName: 'Project Milestones',
                    deepLink: `/projects/${p.id}`,
                    metadata: {
                        projectCode: p.code,
                        status: p.status,
                        priority: p.priority,
                        managerName: p.manager_name
                    }
                });
            }
        }
    }

    // 5. Active / Scheduled Reminders (from `reminders` table)
    if (includeReminders) {
        const [reminders] = await db.execute(`
            SELECT r.*
            FROM reminders r
            WHERE r.user_id = ? 
              AND r.organization_id = ?
              AND r.status IN ('pending', 'snoozed')
              AND (
                  (r.status = 'pending' AND r.trigger_at BETWEEN ? AND ?)
                  OR (r.status = 'snoozed' AND r.snooze_until BETWEEN ? AND ?)
              )
        `, [userId, organizationId, startStr, endStr, startStr, endStr]);

        for (const rem of reminders) {
            const triggerTime = rem.status === 'snoozed' && rem.snooze_until ? rem.snooze_until : rem.trigger_at;
            items.push({
                id: `reminder_${rem.id}`,
                sourceType: 'reminder',
                sourceId: rem.id,
                title: `🔔 ${rem.title}`,
                description: rem.description,
                location: null,
                meetingUrl: null,
                startTime: toISO(triggerTime),
                endTime: toISO(triggerTime),
                isAllDay: false,
                color: '#EC4899', // Pink
                category: 'reminder',
                isReadOnly: false,
                calendarName: 'Reminders',
                deepLink: rem.deep_link_url || `/reminders?id=${rem.id}`,
                metadata: {
                    status: rem.status,
                    sourceType: rem.source_type,
                    sourceId: rem.source_id,
                    snoozeCount: rem.snooze_count
                }
            });
        }
    }

    // Sort chronologically by startTime
    items.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    return items;
};

/**
 * Multi-user Availability & Conflict Matrix
 * Evaluates whether proposed meeting time conflicts with any attendee's calendar
 */
const checkAvailability = async ({
    organizationId,
    attendeeUserIds = [],
    startTime,
    endTime
}) => {
    if (!attendeeUserIds || attendeeUserIds.length === 0) {
        return { hasConflict: false, conflictingAttendees: [], suggestedSlots: [] };
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    const startStr = start.toISOString().slice(0, 19).replace('T', ' ');
    const endStr = end.toISOString().slice(0, 19).replace('T', ' ');

    const placeholders = attendeeUserIds.map(() => '?').join(',');

    // Check overlaps with native events & accepted meetings
    const [conflicts] = await db.execute(`
        SELECT 
            u.id as user_id,
            u.name as user_name,
            u.email as user_email,
            'event' as conflict_type,
            ce.title,
            ce.start_time,
            ce.end_time
        FROM users u
        JOIN calendar_event_attendees cea ON u.id = cea.user_id AND cea.rsvp_status != 'declined'
        JOIN calendar_events ce ON cea.event_id = ce.id AND ce.deleted_at IS NULL
        WHERE u.id IN (${placeholders})
          AND ce.start_time < ? 
          AND ce.end_time > ?

        UNION ALL

        SELECT 
            u.id as user_id,
            u.name as user_name,
            u.email as user_email,
            'meeting' as conflict_type,
            m.title,
            m.scheduled_start as start_time,
            COALESCE(m.scheduled_end, DATE_ADD(m.scheduled_start, INTERVAL 1 HOUR)) as end_time
        FROM users u
        LEFT JOIN meeting_participants mp ON u.id = mp.user_id
        JOIN meetings m ON (m.host_id = u.id OR mp.meeting_id = m.id)
        WHERE u.id IN (${placeholders})
          AND m.status IN ('scheduled', 'live')
          AND m.scheduled_start < ?
          AND COALESCE(m.scheduled_end, DATE_ADD(m.scheduled_start, INTERVAL 1 HOUR)) > ?
    `, [
        ...attendeeUserIds, endStr, startStr,
        ...attendeeUserIds, endStr, startStr
    ]);

    const conflictingMap = new Map();
    for (const c of conflicts) {
        if (!conflictingMap.has(c.user_id)) {
            conflictingMap.set(c.user_id, {
                userId: c.user_id,
                name: c.user_name,
                email: c.user_email,
                conflictingWith: c.title,
                start: toISO(c.start_time),
                end: toISO(c.end_time)
            });
        }
    }

    const conflictingAttendees = Array.from(conflictingMap.values());
    const hasConflict = conflictingAttendees.length > 0;

    // Suggest 3 next available smart slots if conflicts exist
    const suggestedSlots = [];
    if (hasConflict) {
        const durationMinutes = Math.max(15, Math.round((end.getTime() - start.getTime()) / (60 * 1000)));
        // Suggest +1 hr, +2 hrs, and tomorrow same time
        const slot1Start = new Date(end.getTime() + 15 * 60 * 1000);
        const slot1End = new Date(slot1Start.getTime() + durationMinutes * 60 * 1000);

        const slot2Start = new Date(end.getTime() + 60 * 60 * 1000);
        const slot2End = new Date(slot2Start.getTime() + durationMinutes * 60 * 1000);

        const slot3Start = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        const slot3End = new Date(slot3Start.getTime() + durationMinutes * 60 * 1000);

        suggestedSlots.push(
            { startTime: slot1Start.toISOString(), endTime: slot1End.toISOString(), label: "15 min after proposed slot" },
            { startTime: slot2Start.toISOString(), endTime: slot2End.toISOString(), label: "1 hour after proposed slot" },
            { startTime: slot3Start.toISOString(), endTime: slot3End.toISOString(), label: "Tomorrow same time" }
        );
    }

    return {
        hasConflict,
        conflictingAttendees,
        suggestedSlots
    };
};

module.exports = {
    getUnifiedFeed,
    checkAvailability
};
