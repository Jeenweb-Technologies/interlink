const express = require("express");
const router = express.Router();
const reminderController = require("../controllers/reminderController.js");
const { verifyToken } = require("../middleware/authMiddleware.js");

// Apply verifyToken to all reminder routes
router.use(verifyToken);

// Metrics & List
router.get("/metrics", reminderController.getMetrics);
router.get("/preferences", reminderController.getPreferences);
router.put("/preferences", reminderController.updatePreferences);

// Reminders CRUD & Actions
router.get("/", reminderController.getReminders);
router.post("/", reminderController.createReminder);
router.put("/:id/snooze", reminderController.snoozeReminder);
router.put("/:id/complete", reminderController.completeReminder);
router.put("/:id/dismiss", reminderController.dismissReminder);
router.post("/:id/escalate", reminderController.escalateReminder);
router.delete("/:id", reminderController.deleteReminder);

module.exports = router;
