const express = require("express");

const {
    fetchUsers,
    fetchUserById,
    createUserByAdmin,
    bulkImportUsersController,
    generateBulkImportTemplateController,
    updateUserByAdmin,
    deleteUserByAdmin,
    approveDeviceController,
    revokeDeviceController,
    revokeSingleDeviceController,
    fetchAuditLogs,
    fetchUserAuditLogs,
    fetchActivityLogs,
    fetchPendingDevices,
    toggleUserActiveController,
    getDashboardStats
} = require("../controllers/adminController.js");
const { verifyToken, verifyAdmin, verifyPermission, verifyReportPermission, verifyAnyPermission } = require("../middleware/authMiddleware.js");
const departmentRoutes = require("./departmentRoutes.js");

const router = express.Router();

// Department routes under /api/admin/departments
router.use("/departments", departmentRoutes);

router.get("/dashboard-stats", verifyToken, verifyPermission("user_master", "read"), getDashboardStats);
router.get("/users", verifyToken, verifyPermission("user_master", "read"), fetchUsers);
router.get("/user/:id", verifyToken, verifyPermission("user_master", "read"), fetchUserById);
router.post("/create-user", verifyToken, verifyPermission("user_master", "write"), createUserByAdmin);
router.get("/users/bulk-import/template", verifyToken, verifyPermission("user_master", "read"), generateBulkImportTemplateController);
router.get("/bulk-import/template", verifyToken, verifyPermission("user_master", "read"), generateBulkImportTemplateController);
router.post("/users/bulk-import", verifyToken, verifyPermission("user_master", "write"), bulkImportUsersController);
router.post("/bulk-import-users", verifyToken, verifyPermission("user_master", "write"), bulkImportUsersController);
router.put("/user/:id", verifyToken, verifyPermission("user_master", "update"), updateUserByAdmin);
router.patch("/user/:id", verifyToken, verifyPermission("user_master", "update"), updateUserByAdmin);
router.delete("/user/:id", verifyToken, verifyPermission("user_master", "delete"), deleteUserByAdmin);
router.patch("/user/:id/toggle-active", verifyToken, verifyPermission("user_master", "update"), toggleUserActiveController);

router.get("/pending-devices", verifyToken, verifyPermission("device_approval", "read"), fetchPendingDevices);
router.put("/approve-device/:deviceRowId", verifyToken, verifyPermission("device_approval", "write"), approveDeviceController);
router.put("/revoke-device/:userId", verifyToken, verifyPermission("device_approval", "write"), revokeDeviceController);
router.put("/revoke-device-by-id/:deviceRowId", verifyToken, verifyPermission("device_approval", "write"), revokeSingleDeviceController);

router.get("/audit-logs", verifyToken, verifyAnyPermission([
    { master: "device_approval", action: "read" },
    { master: "activity_report", action: "read" }
]), fetchAuditLogs);
router.get("/audit-logs/:userId", verifyToken, verifyAnyPermission([
    { master: "device_approval", action: "read" },
    { master: "activity_report", action: "read" }
]), fetchUserAuditLogs);
router.get('/activity-logs', verifyToken, verifyReportPermission, fetchActivityLogs);

module.exports = router;