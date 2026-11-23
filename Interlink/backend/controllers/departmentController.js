const {
    getDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    toggleDepartmentStatus,
    getDepartmentMembers,
    assignUserDepartment
} = require("../models/departmentModel.js");
const { createAuditLog } = require("../models/auditLogModel.js");

// ─── GET ALL DEPARTMENTS ───────────────────────────────────────────────────────
const getDepartmentsController = async (req, res) => {
    try {
        const includeInactive = req.query.includeInactive !== 'false';
        const companyId = req.query.companyId || req.query.company_id || req.user?.company_id || null;
        const departments = await getDepartments(includeInactive, companyId);
        return res.status(200).json({
            success: true,
            data: departments,
            departments
        });
    } catch (error) {
        console.error("getDepartmentsController error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch departments", error: error.message });
    }
};

// ─── GET SINGLE DEPARTMENT ────────────────────────────────────────────────────
const getDepartmentByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        const department = await getDepartmentById(id);
        if (!department) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }
        return res.status(200).json({ success: true, data: department, department });
    } catch (error) {
        console.error("getDepartmentByIdController error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch department details" });
    }
};

// ─── CREATE DEPARTMENT ────────────────────────────────────────────────────────
const createDepartmentController = async (req, res) => {
    try {
        const {
            department_name,
            departmentName,
            description,
            head_of_department,
            headOfDepartment,
            status = 'ACTIVE',
            company_id,
            companyId
        } = req.body;

        const name = (department_name || departmentName || '').trim();
        const hod = (head_of_department || headOfDepartment || null);
        const targetCompanyId = company_id !== undefined ? company_id : (companyId || req.user?.company_id || 1);

        if (!name) {
            return res.status(400).json({ success: false, message: "Department name is required" });
        }

        const newDept = await createDepartment(name, description, status, targetCompanyId, hod);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        try {
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Unknown',
                adminDeviceId,
                'Department Master',
                'created',
                null,
                { id: newDept.id, name, description, status, company_id: newDept.company_id }
            );
        } catch (_) {}

        return res.status(201).json({
            success: true,
            message: `Department "${name}" created successfully`,
            data: newDept,
            department: newDept
        });
    } catch (error) {
        console.error("createDepartmentController error:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to create department" });
    }
};

// ─── UPDATE DEPARTMENT ────────────────────────────────────────────────────────
const updateDepartmentController = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            department_name,
            departmentName,
            description,
            head_of_department,
            headOfDepartment,
            status,
            company_id,
            companyId
        } = req.body;

        const before = await getDepartmentById(id);
        if (!before) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }

        const updated = await updateDepartment(id, {
            department_name: (department_name || departmentName),
            description,
            head_of_department: (head_of_department !== undefined ? head_of_department : headOfDepartment),
            status,
            company_id: company_id !== undefined ? company_id : companyId
        });

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        try {
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Unknown',
                adminDeviceId,
                'Department Master',
                'updated',
                { name: before.department_name, description: before.description },
                { name: updated.department_name, description: updated.description }
            );
        } catch (_) {}

        return res.status(200).json({
            success: true,
            message: `Department "${updated.department_name}" updated successfully`,
            data: updated,
            department: updated
        });
    } catch (error) {
        console.error("updateDepartmentController error:", error);
        return res.status(500).json({ success: false, message: "Failed to update department" });
    }
};

// ─── DELETE DEPARTMENT ────────────────────────────────────────────────────────
const deleteDepartmentController = async (req, res) => {
    try {
        const { id } = req.params;
        const before = await getDepartmentById(id);
        if (!before) {
            return res.status(404).json({ success: false, message: "Department not found" });
        }

        await deleteDepartment(id);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        try {
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Unknown',
                adminDeviceId,
                'Department Master',
                'deleted',
                { name: before.department_name, description: before.description },
                null
            );
        } catch (_) {}

        return res.status(200).json({
            success: true,
            message: `Department "${before.department_name}" deleted successfully`
        });
    } catch (error) {
        console.error("deleteDepartmentController error:", error);
        return res.status(500).json({ success: false, message: "Failed to delete department" });
    }
};

// ─── TOGGLE DEPARTMENT STATUS ─────────────────────────────────────────────────
const toggleDepartmentStatusController = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const updated = await toggleDepartmentStatus(id, status);

        const adminDeviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        try {
            await createAuditLog(
                req.user?.id,
                req.user?.name || req.user?.username || 'Unknown',
                adminDeviceId,
                'Department Master',
                updated.status === 'ACTIVE' ? 'activated' : 'deactivated',
                null,
                { id, status: updated.status }
            );
        } catch (_) {}

        return res.status(200).json({
            success: true,
            message: `Department status updated to ${updated.status}`,
            data: updated,
            department: updated
        });
    } catch (error) {
        console.error("toggleDepartmentStatusController error:", error);
        return res.status(500).json({ success: false, message: "Failed to toggle status" });
    }
};

// ─── GET DEPARTMENT MEMBERS ───────────────────────────────────────────────────
const getDepartmentMembersController = async (req, res) => {
    try {
        const { id } = req.params;
        const members = await getDepartmentMembers(id);
        return res.status(200).json({
            success: true,
            data: members,
            members
        });
    } catch (error) {
        console.error("getDepartmentMembersController error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch department members" });
    }
};

// ─── ASSIGN USER DEPARTMENT ───────────────────────────────────────────────────
const assignUserDepartmentController = async (req, res) => {
    try {
        const { userId } = req.params;
        const { departmentId, role } = req.body;

        const result = await assignUserDepartment(userId, departmentId, role);

        return res.status(200).json({
            success: true,
            message: "User department updated successfully",
            data: result
        });
    } catch (error) {
        console.error("assignUserDepartmentController error:", error);
        return res.status(500).json({ success: false, message: "Failed to assign user department" });
    }
};

module.exports = {
    getDepartmentsController,
    getDepartmentByIdController,
    createDepartmentController,
    updateDepartmentController,
    deleteDepartmentController,
    toggleDepartmentStatusController,
    getDepartmentMembersController,
    assignUserDepartmentController
};
