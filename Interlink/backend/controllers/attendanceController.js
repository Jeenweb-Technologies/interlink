const attendanceModel = require("../models/attendanceModel");

/**
 * Record a clock-in, break-start, break-end, or clock-out event
 */
const recordClockEvent = async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const { event_type, location_type, latitude, longitude, notes } = req.body;

        if (!event_type || !['CLOCK_IN', 'BREAK_START', 'BREAK_END', 'CLOCK_OUT'].includes(event_type)) {
            return res.status(400).json({ success: false, message: "Valid event_type is required." });
        }

        const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        const device_info = req.headers['user-agent'] || null;

        const result = await attendanceModel.recordAttendanceEvent(userId, organizationId, companyId, {
            event_type,
            location_type: location_type || 'OFFICE',
            latitude,
            longitude,
            notes,
            ip_address,
            device_info
        });

        const todayData = await attendanceModel.getTodayAttendance(userId, organizationId, companyId);

        return res.status(200).json({
            success: true,
            message: `Successfully recorded ${event_type}`,
            data: todayData
        });
    } catch (error) {
        console.error("recordClockEvent error:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to record clock event." });
    }
};

/**
 * Get current user's today attendance state & active timer
 */
const getTodayAttendance = async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;

        const data = await attendanceModel.getTodayAttendance(userId, organizationId, companyId);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("getTodayAttendance error:", error);
        return res.status(500).json({ success: false, message: "Failed to load today's attendance." });
    }
};

/**
 * Get monthly attendance history for calendar and summaries
 */
const getAttendanceHistory = async (req, res) => {
    try {
        const userId = (req.query.user_id && (req.user.role === 'admin' || req.user.role === 'super admin'))
            ? req.query.user_id
            : req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const { month } = req.query; // e.g. "2026-11"

        const data = await attendanceModel.getAttendanceHistory(userId, organizationId, companyId, month);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("getAttendanceHistory error:", error);
        return res.status(500).json({ success: false, message: "Failed to load attendance history." });
    }
};

/**
 * Submit an attendance correction request
 */
const requestAttendanceAdjustment = async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const { work_date, requested_clock_in, requested_clock_out, reason } = req.body;

        if (!work_date || !requested_clock_in || !requested_clock_out || !reason) {
            return res.status(400).json({ success: false, message: "work_date, requested_clock_in, requested_clock_out, and reason are required." });
        }

        const requestId = await attendanceModel.requestAttendanceAdjustment(userId, organizationId, companyId, {
            work_date,
            requested_clock_in,
            requested_clock_out,
            reason
        });

        return res.status(201).json({ success: true, message: "Attendance adjustment request submitted.", requestId });
    } catch (error) {
        console.error("requestAttendanceAdjustment error:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to submit adjustment request." });
    }
};

/**
 * Get attendance adjustments (self or manager queue)
 */
const getAttendanceAdjustments = async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const isManager = req.user.role === 'admin' || req.user.role === 'super admin' || req.query.queue === 'manager';
        const { status } = req.query;

        const data = await attendanceModel.getAttendanceAdjustments(userId, organizationId, companyId, isManager, status);
        return res.status(200).json({ success: true, adjustments: data });
    } catch (error) {
        console.error("getAttendanceAdjustments error:", error);
        return res.status(500).json({ success: false, message: "Failed to load adjustments." });
    }
};

/**
 * Review an attendance adjustment (Approve / Reject)
 */
const reviewAttendanceAdjustment = async (req, res) => {
    try {
        const { id } = req.params;
        const reviewerId = req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const { status, reviewer_comment } = req.body;

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ success: false, message: "Status must be APPROVED or REJECTED." });
        }

        await attendanceModel.reviewAttendanceAdjustment(id, reviewerId, organizationId, companyId, {
            status,
            reviewer_comment
        });

        return res.status(200).json({ success: true, message: `Request successfully ${status.toLowerCase()}.` });
    } catch (error) {
        console.error("reviewAttendanceAdjustment error:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to review request." });
    }
};

/**
 * Manager Team Attendance Presence Board
 */
const getTeamAttendanceBoard = async (req, res) => {
    try {
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const { department_id } = req.query;

        const board = await attendanceModel.getTeamAttendanceBoard(organizationId, companyId, department_id || null);
        return res.status(200).json({ success: true, board });
    } catch (error) {
        console.error("getTeamAttendanceBoard error:", error);
        return res.status(500).json({ success: false, message: "Failed to load team attendance board." });
    }
};

/**
 * Get work schedules
 */
const getWorkSchedules = async (req, res) => {
    try {
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;

        const schedules = await attendanceModel.getWorkSchedules(organizationId, companyId);
        return res.status(200).json({ success: true, schedules });
    } catch (error) {
        console.error("getWorkSchedules error:", error);
        return res.status(500).json({ success: false, message: "Failed to load work schedules." });
    }
};

module.exports = {
    recordClockEvent,
    getTodayAttendance,
    getAttendanceHistory,
    requestAttendanceAdjustment,
    getAttendanceAdjustments,
    reviewAttendanceAdjustment,
    getTeamAttendanceBoard,
    getWorkSchedules
};
