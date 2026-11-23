const express = require("express");
const multer = require("multer");
const {
    fetchUserConversations,
    startDirectChatController,
    createGroupController,
    getGroupMembersController,
    updateGroupSettingsController,
    deleteGroupController,
    fetchConversationMessages,

    sendMessageController,
    uploadFileController,
    viewFileController,
    downloadFileController,
    createPollController,
    votePollController,
    searchCoworkersController,
    getNotificationsController,
    markNotificationReadController,
    getOnlineUsersController,
    deleteMessageController
} = require("../controllers/chatController.js");

const { verifyToken, verifyPermission } = require("../middleware/authMiddleware.js");

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB max file size
});

const router = express.Router();

// Conversations, Online Status & Users
router.get("/online-users", verifyToken, getOnlineUsersController);
router.get("/conversations", verifyToken, verifyPermission("chat", "read"), fetchUserConversations);
router.post("/direct", verifyToken, verifyPermission("chat", "write"), startDirectChatController);
router.post("/group", verifyToken, verifyPermission("group_create", "write"), createGroupController);
router.get("/group/:conversationId/members", verifyToken, verifyPermission("chat", "read"), getGroupMembersController);
router.patch("/group/:conversationId/settings", verifyToken, updateGroupSettingsController);
router.put("/group/:conversationId/settings", verifyToken, updateGroupSettingsController);
router.delete("/group/:conversationId", verifyToken, deleteGroupController);
router.delete("/conversations/:conversationId", verifyToken, deleteGroupController);
router.get("/users/search", verifyToken, verifyPermission("chat", "read"), searchCoworkersController);


// Messages
router.get("/messages/:conversationId", verifyToken, verifyPermission("chat", "read"), fetchConversationMessages);
router.post("/messages", verifyToken, verifyPermission("chat", "write"), sendMessageController);
router.delete("/messages/:messageId", verifyToken, verifyPermission("chat", "write"), deleteMessageController);

// Files (Upload, View, Download)
router.post("/upload", verifyToken, verifyPermission("document_upload", "write"), upload.single("file"), uploadFileController);
router.get("/files/:attachmentId/view", verifyToken, verifyPermission("document_view", "read"), viewFileController);
router.get("/files/:attachmentId/download", verifyToken, downloadFileController);

// Polls
router.post("/polls", verifyToken, verifyPermission("poll_create", "write"), createPollController);
router.post("/polls/:pollId/vote", verifyToken, verifyPermission("chat", "write"), votePollController);

// Notifications
router.get("/notifications", verifyToken, getNotificationsController);
router.patch("/notifications/:id/read", verifyToken, markNotificationReadController);

module.exports = router;
