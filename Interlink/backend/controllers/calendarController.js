const {
    getUserAccessibleCalendars,
    createCalendar,
    updateCalendar,
    deleteCalendar,
    getCalendarShares,
    addCalendarShare,
    removeCalendarShare,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    getCalendarEventById,
    upsertEventAttendees,
    updateRSVPStatus
} = require("../models/calendarModel.js");
const { getUnifiedFeed, checkAvailability } = require("../services/unifiedCalendarService.js");

// 1. Get unified calendar feed
exports.getCalendarFeed = async (req, res) => {
    try {
        const organizationId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;
        const userId = req.user?.id;
        const userDepartmentId = req.user?.department_id || null;

        const {
            startDate,
            endDate,
            includeEvents,
            includeMeetings,
            includeTasks,
            includeProjects,
            includeReminders,
            calendarIds
        } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "startDate and endDate are required query parameters (YYYY-MM-DD)."
            });
        }

        let parsedCalendarIds = null;
        if (calendarIds) {
            parsedCalendarIds = calendarIds.split(',').map((id) => parseInt(id.trim(), 10)).filter(Boolean);
        }

        const items = await getUnifiedFeed({
            organizationId,
            companyId,
            userId,
            userDepartmentId,
            startDate,
            endDate,
            filters: {
                includeEvents: includeEvents !== 'false',
                includeMeetings: includeMeetings !== 'false',
                includeTasks: includeTasks !== 'false',
                includeProjects: includeProjects !== 'false',
                includeReminders: includeReminders !== 'false',
                selectedCalendarIds: parsedCalendarIds
            }
        });

        return res.status(200).json({
            success: true,
            count: items.length,
            startDate,
            endDate,
            data: items
        });
    } catch (err) {
        console.error("[CalendarController] getCalendarFeed error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to load calendar events",
            error: err.message
        });
    }
};

// 2. Get user accessible calendars
exports.getCalendars = async (req, res) => {
    try {
        const organizationId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;
        const userId = req.user?.id;
        const userDepartmentId = req.user?.department_id || null;

        const calendars = await getUserAccessibleCalendars(organizationId, companyId, userId, userDepartmentId);

        return res.status(200).json({
            success: true,
            data: calendars
        });
    } catch (err) {
        console.error("[CalendarController] getCalendars error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch calendars",
            error: err.message
        });
    }
};

// 3. Create a new calendar
exports.createCalendar = async (req, res) => {
    try {
        const organizationId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;
        const userId = req.user?.id;
        const { name, description, color, type, department_id, project_id, is_public, timezone } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Calendar name is required."
            });
        }

        const calendar = await createCalendar({
            organization_id: organizationId,
            company_id: companyId,
            owner_id: userId,
            name: name.trim(),
            description,
            color: color || '#2878C7',
            type: type || 'personal',
            department_id: department_id || null,
            project_id: project_id || null,
            is_default: false,
            is_public: Boolean(is_public),
            timezone: timezone || 'UTC'
        });

        return res.status(201).json({
            success: true,
            message: "Calendar created successfully",
            data: calendar
        });
    } catch (err) {
        console.error("[CalendarController] createCalendar error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to create calendar",
            error: err.message
        });
    }
};

// 4. Update calendar
exports.updateCalendar = async (req, res) => {
    try {
        const calendarId = parseInt(req.params.id, 10);
        const updates = req.body;

        const updated = await updateCalendar(calendarId, updates);
        if (!updated) {
            return res.status(400).json({ success: false, message: "No valid fields provided for update" });
        }

        return res.status(200).json({
            success: true,
            message: "Calendar updated successfully"
        });
    } catch (err) {
        console.error("[CalendarController] updateCalendar error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update calendar",
            error: err.message
        });
    }
};

// 5. Delete calendar
exports.deleteCalendar = async (req, res) => {
    try {
        const calendarId = parseInt(req.params.id, 10);
        await deleteCalendar(calendarId);

        return res.status(200).json({
            success: true,
            message: "Calendar deleted successfully"
        });
    } catch (err) {
        console.error("[CalendarController] deleteCalendar error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete calendar",
            error: err.message
        });
    }
};

// 6. Sharing endpoints
exports.getShares = async (req, res) => {
    try {
        const calendarId = parseInt(req.params.id, 10);
        const shares = await getCalendarShares(calendarId);

        return res.status(200).json({
            success: true,
            data: shares
        });
    } catch (err) {
        console.error("[CalendarController] getShares error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch calendar shares" });
    }
};

exports.addShare = async (req, res) => {
    try {
        const calendarId = parseInt(req.params.id, 10);
        const { sharedWithUserId, sharedWithDepartmentId, permissionLevel } = req.body;

        if (!sharedWithUserId && !sharedWithDepartmentId) {
            return res.status(400).json({
                success: false,
                message: "Must specify sharedWithUserId or sharedWithDepartmentId"
            });
        }

        const shareId = await addCalendarShare(calendarId, {
            sharedWithUserId,
            sharedWithDepartmentId,
            permissionLevel: permissionLevel || 'free_busy_only'
        });

        return res.status(201).json({
            success: true,
            message: "Calendar shared successfully",
            shareId
        });
    } catch (err) {
        console.error("[CalendarController] addShare error:", err);
        return res.status(500).json({ success: false, message: "Failed to share calendar" });
    }
};

exports.removeShare = async (req, res) => {
    try {
        const shareId = parseInt(req.params.shareId, 10);
        await removeCalendarShare(shareId);

        return res.status(200).json({
            success: true,
            message: "Calendar share revoked"
        });
    } catch (err) {
        console.error("[CalendarController] removeShare error:", err);
        return res.status(500).json({ success: false, message: "Failed to remove calendar share" });
    }
};

// 7. Event CRUD
exports.createEvent = async (req, res) => {
    try {
        const organizationId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;
        const userId = req.user?.id;

        const {
            calendar_id,
            title,
            description,
            location,
            meeting_url,
            is_all_day,
            start_time,
            end_time,
            timezone,
            category,
            color_override,
            is_recurring,
            recurrence_rule,
            linked_meeting_id,
            linked_task_id,
            linked_project_id,
            attendees = []
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: "Event title is required." });
        }
        if (!start_time || !end_time) {
            return res.status(400).json({ success: false, message: "Start time and end time are required." });
        }

        // If calendar_id is missing, find user's default calendar
        let targetCalId = calendar_id;
        if (!targetCalId) {
            const calendars = await getUserAccessibleCalendars(organizationId, companyId, userId);
            const defCal = calendars.find((c) => c.is_default) || calendars[0];
            targetCalId = defCal?.id;
        }

        const eventId = await createCalendarEvent({
            organization_id: organizationId,
            company_id: companyId,
            calendar_id: targetCalId,
            creator_id: userId,
            title: title.trim(),
            description,
            location,
            meeting_url,
            is_all_day: Boolean(is_all_day),
            start_time,
            end_time,
            timezone: timezone || 'UTC',
            category: category || 'general',
            color_override,
            is_recurring: Boolean(is_recurring),
            recurrence_rule,
            linked_meeting_id,
            linked_task_id,
            linked_project_id
        });

        // Add creator as organizer attendee
        const fullAttendees = [
            { user_id: userId, is_organizer: true, rsvp_status: 'accepted' },
            ...attendees.filter((a) => a.user_id !== userId)
        ];

        await upsertEventAttendees(eventId, fullAttendees);

        const createdEvent = await getCalendarEventById(eventId);

        return res.status(201).json({
            success: true,
            message: "Event created successfully",
            data: createdEvent
        });
    } catch (err) {
        console.error("[CalendarController] createEvent error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to create event",
            error: err.message
        });
    }
};

exports.getEventById = async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const event = await getCalendarEventById(eventId);

        if (!event) {
            return res.status(404).json({ success: false, message: "Event not found" });
        }

        return res.status(200).json({
            success: true,
            data: event
        });
    } catch (err) {
        console.error("[CalendarController] getEventById error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch event" });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const updates = req.body;
        const { attendees } = updates;

        await updateCalendarEvent(eventId, updates);

        if (attendees && Array.isArray(attendees)) {
            await upsertEventAttendees(eventId, attendees);
        }

        const updatedEvent = await getCalendarEventById(eventId);

        return res.status(200).json({
            success: true,
            message: "Event updated successfully",
            data: updatedEvent
        });
    } catch (err) {
        console.error("[CalendarController] updateEvent error:", err);
        return res.status(500).json({ success: false, message: "Failed to update event" });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        await deleteCalendarEvent(eventId);

        return res.status(200).json({
            success: true,
            message: "Event removed"
        });
    } catch (err) {
        console.error("[CalendarController] deleteEvent error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete event" });
    }
};

exports.respondRSVP = async (req, res) => {
    try {
        const eventId = parseInt(req.params.id, 10);
        const userId = req.user?.id;
        const { status, notes } = req.body;

        const allowed = ['needs_action', 'accepted', 'tentative', 'declined'];
        if (!allowed.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid RSVP status" });
        }

        await updateRSVPStatus(eventId, userId, status, notes);

        return res.status(200).json({
            success: true,
            message: "RSVP updated successfully"
        });
    } catch (err) {
        console.error("[CalendarController] respondRSVP error:", err);
        return res.status(500).json({ success: false, message: "Failed to update RSVP" });
    }
};

// 8. Availability & Conflict Check
exports.checkAvailability = async (req, res) => {
    try {
        const organizationId = req.user?.organization_id || 1;
        const companyId = req.user?.company_id || 1;
        const { attendeeUserIds, startTime, endTime } = req.body;

        if (!startTime || !endTime) {
            return res.status(400).json({ success: false, message: "startTime and endTime are required." });
        }

        const result = await checkAvailability({
            organizationId,
            companyId,
            attendeeUserIds: attendeeUserIds || [],
            startTime,
            endTime
        });

        return res.status(200).json({
            success: true,
            data: result
        });
    } catch (err) {
        console.error("[CalendarController] checkAvailability error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to check availability",
            error: err.message
        });
    }
};
