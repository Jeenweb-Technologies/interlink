const express = require("express");
const {
    getDepartmentsController,
    getDepartmentByIdController,
    createDepartmentController,
    updateDepartmentController,
    deleteDepartmentController,
    toggleDepartmentStatusController,
    getDepartmentMembersController,
    assignUserDepartmentController
} = require("../controllers/departmentController.js");
const { verifyToken, verifyPermission } = require("../middleware/authMiddleware.js");

const router = express.Router();

// Require authentication for all department routes
router.use(verifyToken);

// List & Read Departments
router.get("/", getDepartmentsController);
router.get("/all", getDepartmentsController);
router.get("/list", getDepartmentsController);
router.get("/:id", getDepartmentByIdController);
router.get("/:id/members", getDepartmentMembersController);

// Write / Create Department
router.post("/", verifyPermission("department_master", "write"), createDepartmentController);
router.post("/create", verifyPermission("department_master", "write"), createDepartmentController);

// Update Department
router.put("/:id", verifyPermission("department_master", "update"), updateDepartmentController);
router.patch("/:id", verifyPermission("department_master", "update"), updateDepartmentController);
router.patch("/:id/status", verifyPermission("department_master", "update"), toggleDepartmentStatusController);

// Delete Department
router.delete("/:id", verifyPermission("department_master", "delete"), deleteDepartmentController);

// Assign User Department
router.post("/user/:userId/assign", verifyPermission("user_master", "update"), assignUserDepartmentController);
router.put("/user/:userId/assign", verifyPermission("user_master", "update"), assignUserDepartmentController);

module.exports = router;
