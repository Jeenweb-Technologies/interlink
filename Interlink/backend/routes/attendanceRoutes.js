const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const { verifyToken } = require("../middleware/authMiddleware");

// Require authentication for all attendance routes
router.use(verifyToken);

// Real-time clocking
router.post("/clock", attendanceController.recordClockEvent);
router.get("/today", attendanceController.getTodayAttendance);

// Calendar history
router.get("/history", attendanceController.getAttendanceHistory);

// Regularization & adjustments
router.post("/adjustments", attendanceController.requestAttendanceAdjustment);
router.get("/adjustments", attendanceController.getAttendanceAdjustments);
router.patch("/adjustments/:id", attendanceController.reviewAttendanceAdjustment);

// Manager team board & shifts
router.get("/team-board", attendanceController.getTeamAttendanceBoard);
router.get("/schedules", attendanceController.getWorkSchedules);

module.exports = router;
