const express = require("express");
const {
    getCompanies,
    createCompany,
    getCompanyDetails,
    switchActiveCompany,
    updateCompany,
    deleteCompany
} = require("../controllers/companyController.js");
const { verifyToken } = require("../middleware/authMiddleware.js");

const router = express.Router();

// All company routes require authentication
router.use(verifyToken);

router.get("/", getCompanies);
router.post("/", createCompany);
router.get("/:id", getCompanyDetails);
router.put("/:id", updateCompany);
router.delete("/:id", deleteCompany);
router.post("/switch", switchActiveCompany);

module.exports = router;
