const express = require("express");
const {
    getCompanies,
    getCompaniesController,
    getCompanyDetails,
    getCompanyByIdController,
    createCompany,
    createCompanyController,
    updateCompany,
    updateCompanyController,
    deleteCompany,
    deleteCompanyController,
    switchActiveCompany,
    toggleCompanyStatus,
    toggleCompanyStatusController
} = require("../controllers/companyController.js");
const { verifyToken, verifyPermission } = require("../middleware/authMiddleware.js");

const router = express.Router();

// All company routes require authentication
router.use(verifyToken);

// Switch active company
router.post("/switch", switchActiveCompany);

// List & Read Companies
router.get("/", getCompanies);
router.get("/all", getCompanies);
router.get("/list", getCompanies);
router.get("/:id", getCompanyDetails);

// Write / Create Company
router.post("/", verifyPermission("company_master", "write"), createCompany);
router.post("/create", verifyPermission("company_master", "write"), createCompany);

// Update Company
router.put("/:id", verifyPermission("company_master", "update"), updateCompany);
router.patch("/:id", verifyPermission("company_master", "update"), updateCompany);
router.patch("/:id/status", verifyPermission("company_master", "update"), toggleCompanyStatus);

// Delete Company
router.delete("/:id", verifyPermission("company_master", "delete"), deleteCompany);

module.exports = router;
