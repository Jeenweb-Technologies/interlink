const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const projectController = require("../controllers/projectController.js");
const { verifyToken } = require("../middleware/authMiddleware.js");
const uploadConfig = require("../config/uploadConfig.js");

// Configure Multer for project documents
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadConfig.uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, "doc-" + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// Require authenticated user for all project endpoints
router.use(verifyToken);

// ─── Portfolio & Template Endpoints (Must be before /:id) ───────────────────
router.get("/portfolio", projectController.getPortfolioMetrics);
router.get("/templates", projectController.getTemplates);
router.post("/from-template", projectController.createProjectFromTemplate);

// ─── Base Projects CRUD ─────────────────────────────────────────────────────
router.get("/", projectController.getProjects);
router.post("/", projectController.createProject);
router.get("/:id", projectController.getProjectById);
router.put("/:id", projectController.updateProject);
router.delete("/:id", projectController.deleteProject);

// ─── Sub-projects ───────────────────────────────────────────────────────────
router.get("/:id/subprojects", projectController.getSubprojects);

// ─── Members & Resource Allocation ──────────────────────────────────────────
router.get("/:id/members", projectController.getMembers);
router.post("/:id/members", projectController.addMember);
router.delete("/:id/members/:userId", projectController.removeMember);

// ─── Phases ─────────────────────────────────────────────────────────────────
router.get("/:id/phases", projectController.getPhases);
router.post("/:id/phases", projectController.createPhase);
router.put("/phases/:phaseId", projectController.updatePhase);
router.delete("/phases/:phaseId", projectController.deletePhase);

// ─── Milestones ─────────────────────────────────────────────────────────────
router.get("/:id/milestones", projectController.getMilestones);
router.post("/:id/milestones", projectController.createMilestone);
router.put("/milestones/:milestoneId", projectController.updateMilestone);
router.delete("/milestones/:milestoneId", projectController.deleteMilestone);

// ─── Risks & Matrix ─────────────────────────────────────────────────────────
router.get("/:id/risks", projectController.getRisks);
router.post("/:id/risks", projectController.createRisk);
router.put("/risks/:riskId", projectController.updateRisk);
router.delete("/risks/:riskId", projectController.deleteRisk);

// ─── Gantt & Baselines ──────────────────────────────────────────────────────
router.get("/:id/gantt", projectController.getGanttData);
router.post("/:id/baseline", projectController.createBaselineSnapshot);

// ─── Workload Capacity ──────────────────────────────────────────────────────
router.get("/:id/workload", projectController.getWorkload);

// ─── Documents ──────────────────────────────────────────────────────────────
router.get("/:id/documents", projectController.getDocuments);
router.post("/:id/documents", upload.single("file"), projectController.uploadDocument);
router.delete("/documents/:docId", projectController.deleteDocument);

// ─── Executive Report ───────────────────────────────────────────────────────
router.get("/:id/report", projectController.getProjectReport);

module.exports = router;
