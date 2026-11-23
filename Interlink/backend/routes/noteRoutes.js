const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const noteController = require("../controllers/noteController.js");
const { verifyToken } = require("../middleware/authMiddleware.js");
const uploadConfig = require("../config/uploadConfig.js");

// Configure Multer for note attachments
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadConfig.uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, "note-att-" + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB max
});

// Require authenticated user for all note endpoints
router.use(verifyToken);

// ─── Special Endpoints (Must precede /:id) ──────────────────────────────────
router.get("/linkable-entities", noteController.getLinkableEntities);
router.get("/collaborators-meta", noteController.getCompanyUsersAndGroups);

// ─── Core Note CRUD ─────────────────────────────────────────────────────────
router.get("/", noteController.getNotes);
router.post("/", noteController.createNote);
router.get("/:id", noteController.getNoteById);
router.put("/:id", noteController.updateNote);
router.delete("/:id", noteController.deleteNote);

// ─── Pin & Checklist Item Operations ────────────────────────────────────────
router.patch("/:id/pin", noteController.togglePinNote);
router.put("/:id/checklists/:checklistId/toggle", noteController.toggleChecklistItem);

// ─── Sharing & Permissions ──────────────────────────────────────────────────
router.post("/:id/shares", noteController.shareNote);
router.delete("/:id/shares/:shareId", noteController.revokeNoteShare);

// ─── History & Version Snapshots ────────────────────────────────────────────
router.get("/:id/history", noteController.getNoteHistory);
router.post("/:id/restore/:versionId", noteController.restoreNoteVersion);

// ─── Attachments ────────────────────────────────────────────────────────────
router.post("/:id/attachments", upload.single("file"), noteController.uploadNoteAttachment);
router.delete("/:id/attachments/:attachmentId", noteController.deleteNoteAttachment);

// ─── Entity Links ───────────────────────────────────────────────────────────
router.post("/:id/links", noteController.addNoteLink);
router.delete("/:id/links/:linkId", noteController.deleteNoteLink);

module.exports = router;
