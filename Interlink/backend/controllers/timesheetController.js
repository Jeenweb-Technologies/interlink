const timesheetModel = require("../models/timesheetModel");

/**
 * Get or initialize current weekly timesheet
 */
const getCurrentTimesheet = async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const { date } = req.query; // e.g. "2026-11-24"

        const data = await timesheetModel.getOrCreateWeeklyTimesheet(userId, organizationId, companyId, date);
        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error("getCurrentTimesheet error:", error);
        return res.status(500).json({ success: false, message: "Failed to load timesheet." });
    }
};

/**
 * Add or update time entry
 */
const saveTimeEntry = async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const entryData = req.body;

        if (!entryData.timesheet_id || !entryData.project_id || !entryData.work_date || !entryData.duration_minutes || !entryData.description) {
            return res.status(400).json({ success: false, message: "timesheet_id, project_id, work_date, duration_minutes, and description are required." });
        }

        const entryId = await timesheetModel.addOrUpdateTimeEntry(userId, organizationId, companyId, entryData);
        return res.status(200).json({ success: true, message: "Time entry saved.", entryId });
    } catch (error) {
        console.error("saveTimeEntry error:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to save time entry." });
    }
};

/**
 * Delete a time entry
 */
const deleteTimeEntry = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        await timesheetModel.deleteTimeEntry(userId, id);
        return res.status(200).json({ success: true, message: "Time entry removed." });
    } catch (error) {
        console.error("deleteTimeEntry error:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to delete time entry." });
    }
};

/**
 * Submit weekly timesheet for manager review
 */
const submitTimesheet = async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const { id } = req.params;

        await timesheetModel.submitTimesheet(id, userId, organizationId, companyId);
        return res.status(200).json({ success: true, message: "Timesheet submitted for review." });
    } catch (error) {
        console.error("submitTimesheet error:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to submit timesheet." });
    }
};

/**
 * Get manager approval queue
 */
const getTimesheetApprovalsQueue = async (req, res) => {
    try {
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const { status = 'SUBMITTED' } = req.query;

        const queue = await timesheetModel.getTimesheetApprovalsQueue(organizationId, companyId, status);
        return res.status(200).json({ success: true, queue });
    } catch (error) {
        console.error("getTimesheetApprovalsQueue error:", error);
        return res.status(500).json({ success: false, message: "Failed to load approval queue." });
    }
};

/**
 * Approve a timesheet
 */
const approveTimesheet = async (req, res) => {
    try {
        const approverId = req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const { id } = req.params;
        const { comment } = req.body;

        await timesheetModel.approveTimesheet(id, approverId, organizationId, companyId, comment);
        return res.status(200).json({ success: true, message: "Timesheet approved and locked." });
    } catch (error) {
        console.error("approveTimesheet error:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to approve timesheet." });
    }
};

/**
 * Reject a timesheet
 */
const rejectTimesheet = async (req, res) => {
    try {
        const approverId = req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const { id } = req.params;
        const { comment } = req.body;

        if (!comment || !comment.trim()) {
            return res.status(400).json({ success: false, message: "A rejection reason/comment is required." });
        }

        await timesheetModel.rejectTimesheet(id, approverId, organizationId, companyId, comment);
        return res.status(200).json({ success: true, message: "Timesheet rejected and returned for revision." });
    } catch (error) {
        console.error("rejectTimesheet error:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to reject timesheet." });
    }
};

/**
 * Timesheet analytics & reports
 */
const getTimesheetReports = async (req, res) => {
    try {
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const { startDate, endDate, projectId, userId } = req.query;

        const report = await timesheetModel.getTimesheetReports(organizationId, companyId, {
            startDate,
            endDate,
            projectId,
            userId
        });

        return res.status(200).json({ success: true, report });
    } catch (error) {
        console.error("getTimesheetReports error:", error);
        return res.status(500).json({ success: false, message: "Failed to generate timesheet report." });
    }
};

module.exports = {
    getCurrentTimesheet,
    saveTimeEntry,
    deleteTimeEntry,
    submitTimesheet,
    getTimesheetApprovalsQueue,
    approveTimesheet,
    rejectTimesheet,
    getTimesheetReports
};
