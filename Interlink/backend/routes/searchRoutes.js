const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController.js");
const { verifyToken } = require("../middleware/authMiddleware.js");

// Require auth token for universal record search
router.use(verifyToken);

router.get("/", searchController.searchAllRecords);

module.exports = router;
