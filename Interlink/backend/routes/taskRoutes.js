const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController.js");
const { verifyToken } = require("../middleware/authMiddleware.js");

// Apply verifyToken to all task routes
router.use(verifyToken);

// Special endpoints (must be defined before /:id)
router.get("/dashboard", taskController.getDashboardMetrics);
router.get("/metadata", taskController.getTaskMetadata);
router.get("/saved-views", taskController.getSavedViews);
router.post("/saved-views", taskController.createSavedView);
router.get("/templates", taskController.getTemplates);
router.post("/templates", taskController.createTemplate);
router.post("/bulk", taskController.bulkUpdateTasks);
router.post("/dependencies", taskController.addDependency);
router.delete("/dependencies/:id", taskController.deleteDependency);
router.get("/time/active", taskController.getActiveTimer);
router.delete("/time/discard", taskController.discardTimer);
router.post("/time/stop", taskController.stopTimer);
router.delete("/time-entries/:id", taskController.deleteTimeEntry);
router.put("/checklists/:id/toggle", taskController.toggleChecklistItem);

// Base Task CRUD
router.get("/", taskController.getTasks);
router.post("/", taskController.createTask);
router.get("/:id", taskController.getTaskById);
router.put("/:id", taskController.updateTask);
router.delete("/:id", taskController.deleteTask);

// Task sub-resources
router.post("/:id/checklists", taskController.addChecklistItem);
router.post("/:id/comments", taskController.addComment);
router.post("/:id/time/start", taskController.startTimer);
router.post("/:id/time/manual", taskController.logManualTime);

module.exports = router;
