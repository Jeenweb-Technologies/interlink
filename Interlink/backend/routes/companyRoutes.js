const express = require("express");
const {
    getCompaniesController,
    getCompanyByIdController,
    createCompanyController,
    updateCompanyController,
    deleteCompanyController,
    toggleCompanyStatusController
} = require("../controllers/companyController.js");
const { verifyToken, verifyPermission } = require("../middleware/authMiddleware.js");

const router = express.Router();

// List & Read Companies
router.get("/", verifyToken, getCompaniesController);
router.get("/all", verifyToken, getCompaniesController);
router.get("/list", verifyToken, getCompaniesController);
router.get("/:id", verifyToken, getCompanyByIdController);

// Write / Create Company
router.post("/", verifyToken, verifyPermission("company_master", "write"), createCompanyController);
router.post("/create", verifyToken, verifyPermission("company_master", "write"), createCompanyController);

// Update Company
router.put("/:id", verifyToken, verifyPermission("company_master", "update"), updateCompanyController);
router.patch("/:id", verifyToken, verifyPermission("company_master", "update"), updateCompanyController);
router.patch("/:id/status", verifyToken, verifyPermission("company_master", "update"), toggleCompanyStatusController);

// Delete Company
router.delete("/:id", verifyToken, verifyPermission("company_master", "delete"), deleteCompanyController);

module.exports = router;
