const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const meetingController = require("../controllers/meetingController.js");
const { verifyToken } = require("../middleware/authMiddleware.js");

// Optional auth helper for guest entry endpoints
const optionalAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
        try {
            const token = authHeader.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            const headerCompId = req.headers["x-company-id"] || req.headers["company-id"];
            if (headerCompId) {
                const parsed = parseInt(headerCompId, 10);
                if (!isNaN(parsed) && parsed > 0) {
                    req.user.company_id = parsed;
                }
            }
        } catch (e) {
            req.user = null;
        }
    } else {
        req.user = null;
    }
    next();
};

// ─── Protected CRUD & Scheduling Endpoints ─────────────────────────
router.post("/instant", verifyToken, meetingController.createInstantMeeting);
router.post("/schedule", verifyToken, meetingController.scheduleMeeting);
router.get("/", verifyToken, meetingController.listMeetings);
router.get("/summary/:id", verifyToken, meetingController.getMeetingSummary);

// ─── Room & Access Endpoints (Allow Guests or Authenticated Users) ───
router.get("/room/:roomCode", optionalAuth, meetingController.getMeetingDetails);
router.post("/:roomCode/token", optionalAuth, meetingController.generateMeetingToken);
router.post("/:roomCode/lobby", optionalAuth, meetingController.joinLobby);

// ─── Host Control Endpoints ─────────────────────────────────────────
router.put("/:roomCode/participants/:participantId/admit", verifyToken, meetingController.admitParticipant);
router.put("/:roomCode/participants/:participantId/deny", verifyToken, meetingController.denyParticipant);
router.post("/:roomCode/cancel", verifyToken, meetingController.cancelMeeting);
router.post("/:roomCode/end", verifyToken, meetingController.endMeetingSession);

// ─── Whiteboard Endpoints ───────────────────────────────────────────
router.get("/:meetingId/whiteboard", optionalAuth, meetingController.getMeetingWhiteboard);
router.post("/:meetingId/whiteboard", optionalAuth, meetingController.saveMeetingWhiteboard);

// ─── Collaborative Notes Endpoints ──────────────────────────────────
router.get("/:meetingId/notes", optionalAuth, meetingController.getNotes);
router.post("/:meetingId/notes", verifyToken, meetingController.saveNotes);

// ─── Recordings Endpoints ───────────────────────────────────────────
router.post("/:meetingId/recordings", verifyToken, meetingController.recordMeeting);

module.exports = router;
