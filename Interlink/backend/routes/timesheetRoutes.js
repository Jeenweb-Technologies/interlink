const express = require("express");
const router = express.Router();
const timesheetController = require("../controllers/timesheetController");
const { verifyToken } = require("../middleware/authMiddleware");

// Require authentication for all timesheet routes
router.use(verifyToken);

// Weekly Timesheet Container & Entries
router.get("/current", timesheetController.getCurrentTimesheet);
router.post("/entries", timesheetController.saveTimeEntry);
router.delete("/entries/:id", timesheetController.deleteTimeEntry);
router.post("/:id/submit", timesheetController.submitTimesheet);

// Manager Approvals & Actions
router.get("/approvals", timesheetController.getTimesheetApprovalsQueue);
router.post("/:id/approve", timesheetController.approveTimesheet);
router.post("/:id/reject", timesheetController.rejectTimesheet);

// Reports
router.get("/reports", timesheetController.getTimesheetReports);

module.exports = router;
