const express = require("express");
const router = express.Router();
const path = require("path");
const multer = require("multer");
const { verifyToken, verifyAdmin } = require("../middleware/authMiddleware.js");
const uploadConfig = require("../config/uploadConfig.js");
const {
    getConversations,
    getMessages,
    postMessage,
    startDirectChat,
    createChannel,
    markRead,
    reactMessage,
    getAvailableUsers,
    getSettings,
    updateSettings,
    getUserTypePermissions,
    saveUserTypePermission,
    getAllUserPermissionsController,
    saveUserPermissionController
} = require("../controllers/chatController.js");

// Configure Multer for chat file attachments
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadConfig.uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, "chat-" + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// All chat routes require token
router.use(verifyToken);

// Conversation management
router.get("/conversations", getConversations);
router.post("/direct", startDirectChat);
router.post("/channels", createChannel);

// Message handling
router.get("/conversations/:conversationId/messages", getMessages);
router.post("/conversations/:conversationId/messages", upload.single("file"), postMessage);
router.post("/conversations/:conversationId/read", markRead);
router.post("/messages/:messageId/reaction", reactMessage);

// User Master Directory for Chat
router.get("/users", getAvailableUsers);

// Chat Settings Master (Company Governance)
router.get("/settings", getSettings);
router.put("/settings", updateSettings);
router.get("/permissions", getUserTypePermissions);
router.put("/permissions/:userTypeId", saveUserTypePermission);

// User Chat Scope & Department Cross-Communication Permissions
router.get("/user-permissions", getAllUserPermissionsController);
router.put("/user-permissions/:userId", saveUserPermissionController);

module.exports = router;
