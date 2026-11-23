const express = require("express");
const {
    getDepartmentsController,
    getDepartmentByIdController,
    createDepartmentController,
    updateDepartmentController,
    deleteDepartmentController,
    toggleDepartmentStatusController,
    getDepartmentMembersController,
    assignUserDepartmentsController
} = require("../controllers/departmentController.js");
const { verifyToken, verifyPermission } = require("../middleware/authMiddleware.js");

const router = express.Router();

// List & Read Departments (Read permission on department_master or user_master)
router.get("/", verifyToken, getDepartmentsController);
router.get("/all", verifyToken, getDepartmentsController);
router.get("/list", verifyToken, getDepartmentsController);
router.get("/:id", verifyToken, getDepartmentByIdController);
router.get("/:id/members", verifyToken, getDepartmentMembersController);

// Write / Create Department
router.post("/", verifyToken, verifyPermission("department_master", "write"), createDepartmentController);
router.post("/create", verifyToken, verifyPermission("department_master", "write"), createDepartmentController);

// Update Department
router.put("/:id", verifyToken, verifyPermission("department_master", "update"), updateDepartmentController);
router.patch("/:id", verifyToken, verifyPermission("department_master", "update"), updateDepartmentController);
router.patch("/:id/status", verifyToken, verifyPermission("department_master", "update"), toggleDepartmentStatusController);

// Delete Department
router.delete("/:id", verifyToken, verifyPermission("department_master", "delete"), deleteDepartmentController);

// Assign User Departments
router.post("/user/:userId/assign", verifyToken, verifyPermission("user_master", "update"), assignUserDepartmentsController);
router.put("/user/:userId/assign", verifyToken, verifyPermission("user_master", "update"), assignUserDepartmentsController);

module.exports = router;
