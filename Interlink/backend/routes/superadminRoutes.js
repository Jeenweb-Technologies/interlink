const express = require("express");
const {
    getDeveloperStats,
    getAllOrganizations,
    updateOrganizationStatus,
    createOrganization
} = require("../controllers/superadminController.js");
const { verifyToken, verifySuperAdmin } = require("../middleware/authMiddleware.js");

const router = express.Router();

// All superadmin routes require valid token and superadmin/developer role
router.use(verifyToken);
router.use(verifySuperAdmin);

router.get("/stats", getDeveloperStats);
router.get("/organizations", getAllOrganizations);
router.post("/organizations", createOrganization);
router.patch("/organizations/:id/status", updateOrganizationStatus);

module.exports = router;
