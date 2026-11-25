import apiClient from "./authApi";

/**
 * Department Master API Service
 */

export const getDepartments = async (includeInactive = false, companyId = null) => {
    const params = new URLSearchParams();
    if (includeInactive) params.append("includeInactive", "true");
    if (companyId) params.append("companyId", companyId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiClient.get(`/departments${qs}`);
};

export const getDepartmentById = async (id) => {
    return apiClient.get(`/departments/${id}`);
};

export const createDepartment = async (data) => {
    return apiClient.post("/departments", data);
};

export const updateDepartment = async (id, data) => {
    return apiClient.put(`/departments/${id}`, data);
};

export const deleteDepartment = async (id) => {
    return apiClient.delete(`/departments/${id}`);
};

export const toggleDepartmentStatus = async (id, currentStatus) => {
    return apiClient.patch(`/departments/${id}/status`, { currentStatus });
};

export const getDepartmentMembers = async (id) => {
    return apiClient.get(`/departments/${id}/members`);
};

export const assignUserDepartment = async (userId, departmentId, role = 'USER') => {
    return apiClient.post("/departments/assign-user", { userId, departmentId, role });
};
