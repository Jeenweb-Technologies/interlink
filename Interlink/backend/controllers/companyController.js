const db = require("../config/db.js");
const {
    findCompaniesByOrgId,
    findCompanyById,
    createCompanyRecord
} = require("../models/companyModel.js");

// 1. Get all companies under the authenticated user's organization
const getCompanies = async (req, res) => {
    try {
        const organizationId = req.user?.organization_id || 1;
        const companies = await findCompaniesByOrgId(organizationId);

        return res.status(200).json({
            success: true,
            companies
        });
    } catch (error) {
        console.error("Error in getCompanies:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch companies",
            error: error.message
        });
    }
};

// 2. Create a new company under the user's organization
const createCompany = async (req, res) => {
    try {
        const { name, email, phone } = req.body;
        const organizationId = req.user?.organization_id || 1;

        if (!name || name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Company name is required"
            });
        }

        const newCompany = await createCompanyRecord(
            organizationId,
            name.trim(),
            email || null,
            phone || null
        );

        return res.status(201).json({
            success: true,
            message: "Company created successfully",
            company: newCompany
        });
    } catch (error) {
        console.error("Error in createCompany:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create company",
            error: error.message
        });
    }
};

// 3. Get single company details
const getCompanyDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const company = await findCompanyById(id);

        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        return res.status(200).json({
            success: true,
            company
        });
    } catch (error) {
        console.error("Error in getCompanyDetails:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch company details",
            error: error.message
        });
    }
};

// 4. Switch active company for the logged-in user
const switchActiveCompany = async (req, res) => {
    try {
        const { companyId } = req.body;
        const userId = req.user?.id;
        const organizationId = req.user?.organization_id || 1;

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "companyId is required"
            });
        }

        // Verify company exists under this org
        const company = await findCompanyById(companyId);
        if (!company || company.organization_id !== organizationId) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this company"
            });
        }

        await db.execute(
            "UPDATE users SET company_id = ? WHERE id = ?",
            [companyId, userId]
        );

        return res.status(200).json({
            success: true,
            message: `Switched active company to ${company.name}`,
            activeCompany: company
        });
    } catch (error) {
        console.error("Error in switchActiveCompany:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to switch active company",
            error: error.message
        });
    }
};

// 5. Update company details
const updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone } = req.body;
        const organizationId = req.user?.organization_id || 1;

        if (!name || name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Company name is required"
            });
        }

        // Verify company exists and belongs to this organization
        const company = await findCompanyById(id);
        if (!company || company.organization_id !== organizationId) {
            return res.status(403).json({
                success: false,
                message: "You do not have access to this company"
            });
        }

        await db.execute(
            "UPDATE companies SET name = ?, email = ?, phone = ? WHERE id = ? AND organization_id = ?",
            [name.trim(), email ? email.trim() : null, phone ? phone.trim() : null, id, organizationId]
        );

        return res.status(200).json({
            success: true,
            message: "Company updated successfully",
            company: {
                id: parseInt(id, 10),
                organization_id: organizationId,
                name: name.trim(),
                email: email ? email.trim() : null,
                phone: phone ? phone.trim() : null
            }
        });
    } catch (error) {
        console.error("Error in updateCompany:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update company",
            error: error.message
        });
    }
};

// 6. Delete company
const deleteCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user?.organization_id || 1;

        // Ensure at least one company remains
        const companies = await findCompaniesByOrgId(organizationId);
        if (companies.length <= 1) {
            return res.status(400).json({
                success: false,
                message: "You cannot delete the only remaining company in your organization."
            });
        }

        // Verify company belongs to this organization
        const company = await findCompanyById(id);
        if (!company || company.organization_id !== organizationId) {
            return res.status(403).json({
                success: false,
                message: "Company not found or access denied"
            });
        }

        await db.execute(
            "DELETE FROM companies WHERE id = ? AND organization_id = ?",
            [id, organizationId]
        );

        return res.status(200).json({
            success: true,
            message: "Company deleted successfully"
        });
    } catch (error) {
        console.error("Error in deleteCompany:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete company",
            error: error.message
        });
    }
};

module.exports = {
    getCompanies,
    createCompany,
    getCompanyDetails,
    switchActiveCompany,
    updateCompany,
    deleteCompany
};
