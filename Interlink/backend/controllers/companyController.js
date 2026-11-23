const {
    getCompanies,
    getCompanyById,
    createCompany,
    updateCompany,
    deleteCompany,
    toggleCompanyStatus
} = require("../models/companyModel.js");
const { createAuditLog } = require("../models/auditLogModel.js");
const { ensureCompanyBroadcastForCompany } = require("../models/conversationModel.js");

// ─── GET ALL COMPANIES ────────────────────────────────────────────────────────
const getCompaniesController = async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive !== 'false';
        const search = req.query.search || '';
        const companies = await getCompanies({ includeInactive, search });
        return res.status(200).json({
            success: true,
            data: companies,
            companies
        });
    } catch (error) {
        console.error("getCompaniesController error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch companies" });
    }
};

// ─── GET SINGLE COMPANY ───────────────────────────────────────────────────────
const getCompanyByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        const company = await getCompanyById(id);
        if (!company) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }
        return res.status(200).json({ success: true, data: company, company });
    } catch (error) {
        console.error("getCompanyByIdController error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch company details" });
    }
};

// ─── CREATE COMPANY ───────────────────────────────────────────────────────────
const createCompanyController = async (req, res) => {
    try {
        const {
            company_name,
            company_code,
            legal_name,
            tax_id,
            email,
            phone,
            website,
            address,
            city,
            state,
            country,
            postal_code,
            logo_url,
            industry,
            description,
            is_main,
            status
        } = req.body;

        if (!company_name || !company_name.trim()) {
            return res.status(400).json({ success: false, message: "Company name is required" });
        }

        const newCompany = await createCompany({
            company_name: company_name.trim(),
            company_code: (company_code || '').trim(),
            legal_name,
            tax_id,
            email,
            phone,
            website,
            address,
            city,
            state,
            country,
            postal_code,
            logo_url,
            industry,
            description,
            is_main,
            status,
            adminId: req.user?.id || 1
        });

        // Automatically create company broadcast channel immediately with company creation
        let broadcastConvId = null;
        try {
            broadcastConvId = await ensureCompanyBroadcastForCompany(newCompany.id, newCompany.company_name, req.user?.id || 1);
        } catch (bErr) {
            console.error("Auto company broadcast creation error in controller:", bErr.message);
        }

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'Company Master',
            'created',
            null,
            { id: newCompany.id, company_name: newCompany.company_name, company_code: newCompany.company_code, broadcast_channel_id: broadcastConvId }
        );

        return res.status(201).json({
            success: true,
            message: `Company "${newCompany.company_name}" created successfully with broadcast channel`,
            data: { ...newCompany, broadcast_channel_id: broadcastConvId },
            company: { ...newCompany, broadcast_channel_id: broadcastConvId }
        });
    } catch (error) {
        console.error("createCompanyController error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "A company with this code or name already exists." });
        }
        return res.status(500).json({ success: false, message: error.message || "Failed to create company" });
    }
};

// ─── UPDATE COMPANY ───────────────────────────────────────────────────────────
const updateCompanyController = async (req, res) => {
    try {
        const { id } = req.params;
        const before = await getCompanyById(id);
        if (!before) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }

        const updated = await updateCompany(id, req.body);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'Company Master',
            'updated',
            { name: before.company_name, code: before.company_code },
            { name: updated.company_name, code: updated.company_code }
        );

        return res.status(200).json({
            success: true,
            message: `Company "${updated.company_name}" updated successfully`,
            data: updated,
            company: updated
        });
    } catch (error) {
        console.error("updateCompanyController error:", error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: "A company with this code already exists." });
        }
        return res.status(500).json({ success: false, message: error.message || "Failed to update company" });
    }
};

// ─── DELETE COMPANY ───────────────────────────────────────────────────────────
const deleteCompanyController = async (req, res) => {
    try {
        const { id } = req.params;
        const company = await getCompanyById(id);
        if (!company) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }

        await deleteCompany(id);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'Company Master',
            'deleted',
            { id: company.id, company_name: company.company_name, company_code: company.company_code },
            null
        );

        return res.status(200).json({
            success: true,
            message: `Company "${company.company_name}" deleted successfully`
        });
    } catch (error) {
        console.error("deleteCompanyController error:", error);
        return res.status(400).json({ success: false, message: error.message || "Failed to delete company" });
    }
};

// ─── TOGGLE COMPANY STATUS ────────────────────────────────────────────────────
const toggleCompanyStatusController = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const result = await toggleCompanyStatus(id, status);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            adminDeviceId,
            'Company Master',
            'status_toggled',
            null,
            { id, status: result.status }
        );

        return res.status(200).json({
            success: true,
            message: `Company status updated to ${result.status}`,
            data: result
        });
    } catch (error) {
        console.error("toggleCompanyStatusController error:", error);
        return res.status(500).json({ success: false, message: "Failed to update company status" });
    }
};

module.exports = {
    getCompaniesController,
    getCompanyByIdController,
    createCompanyController,
    updateCompanyController,
    deleteCompanyController,
    toggleCompanyStatusController
};
