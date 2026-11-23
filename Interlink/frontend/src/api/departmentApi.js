import apiClient from "./authApi";

export const getDepartments = async (includeInactive = true) => {
    const res = await apiClient.get(`/admin/departments?includeInactive=${includeInactive}`);
    return res.data;
};

export const getDepartmentById = async (id) => {
    const res = await apiClient.get(`/admin/departments/${id}`);
    return res.data;
};

export const createDepartment = async (departmentData) => {
    const res = await apiClient.post("/admin/departments", departmentData);
    return res.data;
};

export const updateDepartment = async (id, departmentData) => {
    const res = await apiClient.put(`/admin/departments/${id}`, departmentData);
    return res.data;
};

export const deleteDepartment = async (id) => {
    const res = await apiClient.delete(`/admin/departments/${id}`);
    return res.data;
};

export const toggleDepartmentStatus = async (id, status) => {
    const res = await apiClient.patch(`/admin/departments/${id}/status`, { status });
    return res.data;
};

export const getDepartmentMembers = async (id) => {
    const res = await apiClient.get(`/admin/departments/${id}/members`);
    return res.data;
};

export const assignUserDepartments = async (userId, departments) => {
    const res = await apiClient.post(`/admin/departments/user/${userId}/assign`, { departments });
    return res.data;
};

export const updateUserByAdmin = async (userId, userData) => {
    const res = await apiClient.put(`/admin/user/${userId}`, userData);
    return res.data;
};
