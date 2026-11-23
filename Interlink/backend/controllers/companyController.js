const db = require("../config/db.js");
const {
    getCompanies: getCompaniesModel,
    getCompanyById: getCompanyByIdModel,
    findCompanyById,
    createCompany: createCompanyModel,
    updateCompany: updateCompanyModel,
    deleteCompany: deleteCompanyModel,
    toggleCompanyStatus: toggleCompanyStatusModel,
    findCompaniesByOrgId
} = require("../models/companyModel.js");
const { createAuditLog } = require("../models/auditLogModel.js");
const { ensureCompanyBroadcastForCompany } = require("../models/conversationModel.js");

// 1. Get all companies
const getCompanies = async (req, res) => {
    try {
        const organizationId = req.user?.organization_id || 1;
        const includeInactive = req.query.includeInactive === "true" || req.query.includeInactive === true || req.query.includeInactive === undefined;
        const search = req.query.search || "";

        const companies = await getCompaniesModel({
            includeInactive,
            search,
            organizationId
        });

        return res.status(200).json({
            success: true,
            companies,
            data: companies
        });
    } catch (error) {
        console.error("getCompanies error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch companies", error: error.message });
    }
};

const getCompaniesController = getCompanies;

// 2. Get single company details
const getCompanyDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const company = await getCompanyByIdModel(id);
        if (!company) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }
        return res.status(200).json({
            success: true,
            company,
            data: company
        });
    } catch (error) {
        console.error("getCompanyDetails error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch company details", error: error.message });
    }
};

const getCompanyByIdController = getCompanyDetails;

// 3. Create company
const createCompany = async (req, res) => {
    try {
        const organizationId = req.user?.organization_id || 1;
        const body = req.body || {};
        const name = body.name || body.company_name;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Company name is required"
            });
        }

        const newCompany = await createCompanyModel({
            ...body,
            organization_id: organizationId,
            company_name: name.trim(),
            name: name.trim(),
            adminId: req.user?.id || 1
        });

        // Broadcast channel
        let broadcastConvId = null;
        try {
            if (typeof ensureCompanyBroadcastForCompany === "function") {
                const bc = await ensureCompanyBroadcastForCompany(newCompany.id, newCompany.company_name, req.user?.id || 1);
                broadcastConvId = bc?.id || null;
            }
        } catch (_) {}

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        try {
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Unknown',
                adminDeviceId,
                'Company Master',
                'created',
                null,
                { id: newCompany.id, company_name: newCompany.company_name, company_code: newCompany.company_code, broadcast_channel_id: broadcastConvId }
            );
        } catch (_) {}

        return res.status(201).json({
            success: true,
            message: `Company "${newCompany.company_name}" created successfully`,
            company: { ...newCompany, broadcast_channel_id: broadcastConvId },
            data: { ...newCompany, broadcast_channel_id: broadcastConvId }
        });
    } catch (error) {
        console.error("createCompany error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "A company with this code or name already exists." });
        }
        return res.status(500).json({ success: false, message: "Failed to create company", error: error.message });
    }
};

const createCompanyController = createCompany;

// 4. Update company
const updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body || {};
        const existing = await findCompanyById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }

        const updated = await updateCompanyModel(id, body);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        try {
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Unknown',
                adminDeviceId,
                'Company Master',
                'updated',
                { id: existing.id, company_name: existing.company_name || existing.name },
                { id: updated.id, company_name: updated.company_name || updated.name }
            );
        } catch (_) {}

        return res.status(200).json({
            success: true,
            message: "Company updated successfully",
            company: updated,
            data: updated
        });
    } catch (error) {
        console.error("updateCompany error:", error);
        return res.status(500).json({ success: false, message: "Failed to update company", error: error.message });
    }
};

const updateCompanyController = updateCompany;

// 5. Delete company
const deleteCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const existing = await findCompanyById(id);
        if (!existing) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }

        if (existing.is_main) {
            return res.status(400).json({ success: false, message: "Primary / main corporate entity cannot be deleted." });
        }

        await deleteCompanyModel(id);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        try {
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Unknown',
                adminDeviceId,
                'Company Master',
                'deleted',
                { id: existing.id, company_name: existing.company_name || existing.name },
                null
            );
        } catch (_) {}

        return res.status(200).json({
            success: true,
            message: "Company deleted successfully"
        });
    } catch (error) {
        console.error("deleteCompany error:", error);
        return res.status(500).json({ success: false, message: "Failed to delete company", error: error.message });
    }
};

const deleteCompanyController = deleteCompany;

// 6. Switch active company
const switchActiveCompany = async (req, res) => {
    try {
        const userId = req.user?.id;
        const organizationId = req.user?.organization_id || 1;
        const { companyId } = req.body;

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: "Company ID is required"
            });
        }

        const company = await findCompanyById(companyId);
        if (!company) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        if (req.user?.role !== "super_admin" && req.user?.role !== "super admin" && req.user?.role !== "developer") {
            if (company.organization_id && company.organization_id !== organizationId) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have access to this company"
                });
            }
        }

        await db.execute(
            "UPDATE users SET company_id = ? WHERE id = ?",
            [companyId, userId]
        );

        return res.status(200).json({
            success: true,
            message: `Switched active company to ${company.company_name || company.name}`,
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

// 7. Toggle company status
const toggleCompanyStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const result = await toggleCompanyStatusModel(id, status);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        try {
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Unknown',
                adminDeviceId,
                'Company Master',
                'status_toggled',
                null,
                { id, status: result.status }
            );
        } catch (_) {}

        return res.status(200).json({
            success: true,
            message: `Company status updated to ${result.status}`,
            data: result
        });
    } catch (error) {
        console.error("toggleCompanyStatus error:", error);
        return res.status(500).json({ success: false, message: "Failed to update company status" });
    }
};

const toggleCompanyStatusController = toggleCompanyStatus;

module.exports = {
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
};
