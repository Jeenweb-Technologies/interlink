import { apiClient } from "./authApi";

export const getDeveloperStats = async () => {
    return apiClient.get("/superadmin/stats");
};

export const getAllOrganizations = async (status = "all") => {
    return apiClient.get(`/superadmin/organizations${status ? `?status=${status}` : ""}`);
};

export const updateOrganizationStatus = async (id, status) => {
    return apiClient.patch(`/superadmin/organizations/${id}/status`, { status });
};

export const createOrganization = async (payload) => {
    return apiClient.post("/superadmin/organizations", payload);
};
