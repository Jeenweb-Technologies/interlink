import axios from "axios";
import { getDeviceId } from "../utils/device";

export const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "/api",
    withCredentials: true
});

apiClient.interceptors.request.use(async (config) => {
    const token = localStorage.getItem("token");
    if (token && token !== "null" && token !== "undefined" && token.trim()) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    const activeCompanyId = localStorage.getItem("active_company_id");
    if (activeCompanyId) {
        config.headers["x-company-id"] = activeCompanyId;
        config.headers["company-id"] = activeCompanyId;
    }

    try {
        const deviceId = await getDeviceId();
        if (deviceId) {
            config.headers["x-device-id"] = deviceId;
            config.headers["device-id"] = deviceId;
        }
    } catch (error) {
        console.error("Failed to resolve device id for request headers", error);
    }

    // Method tunneling fallback for live environments where firewalls or web servers block PUT/DELETE/PATCH requests
    const methodLower = config.method ? config.method.toLowerCase() : "";
    if (methodLower === "put" || methodLower === "delete" || methodLower === "patch") {
        config.headers["X-HTTP-Method-Override"] = methodLower.toUpperCase();
        config.method = "post";
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            const msg = error.response.data?.message || "";
            if (msg.includes("token") || msg.includes("Unauthorized") || msg.includes("Invalid")) {
                console.warn("Session expired or invalid token:", msg);
                if (window.location.pathname !== "/" && window.location.pathname !== "/login") {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user");
                    window.location.href = "/";
                }
            }
        }
        return Promise.reject(error);
    }
);

export const loginUser = async (data) => {
    return apiClient.post("/auth/login", data);
};

export const registerOrganization = async (data) => {
    return apiClient.post("/auth/register-org", data);
};

export const getCompanies = async () => {
    return apiClient.get("/companies");
};

export const createCompany = async (data) => {
    return apiClient.post("/companies", data);
};

export const requestDeviceRegistration = async (data) => {
    return apiClient.post("/auth/request-device", data);
};

export const logoutUser = async () => {
    return apiClient.post("/auth/logout");
};

export const getDashboardStats = async () => {
    return apiClient.get("/admin/dashboard-stats");
};

export const getAllUsers = async (includeInactive = false) => {
    return apiClient.get(`/admin/users${includeInactive ? '?includeInactive=true' : ''}`);
};

export const toggleUserActive = async (id, active) => {
    return apiClient.patch(`/admin/user/${id}/toggle-active`, { active });
};

export const getPendingDevices = async () => {
    return apiClient.get("/admin/pending-devices");
};

export const approveDevice = async (deviceRowId, allowDownload = true) => {
    return apiClient.put(`/admin/approve-device/${deviceRowId}`, { allowDownload });
};

export const revokeDevice = async (userId) => {
    return apiClient.put(`/admin/revoke-device/${userId}`);
};

export const revokeDeviceById = async (deviceRowId) => {
    return apiClient.put(`/admin/revoke-device-by-id/${deviceRowId}`);
};

export const getUserById = async (id) => {
    return apiClient.get(`/admin/user/${id}`);
};

export const createUserByAdmin = async (data) => {
    return apiClient.post("/admin/create-user", data);
};

export const bulkImportUsers = async (data) => {
    return apiClient.post("/admin/users/bulk-import", data);
};

export const downloadBulkImportTemplate = async () => {
    return apiClient.get("/admin/users/bulk-import/template", {
        responseType: "blob"
    });
};

export const updateUserByAdmin = async (id, data) => {
    return apiClient.put(`/admin/user/${id}`, data);
};

export const deleteUser = async (id) => {
    return apiClient.delete(`/admin/user/${id}`);
};

export const fetchAuditLogs = async (userId = null) => {
    if (userId) {
        return apiClient.get(`/admin/audit-logs/${userId}`);
    }
    return apiClient.get("/admin/audit-logs");
};

export const fetchActivityLogs = async () => {
    return apiClient.get("/admin/activity-logs");
};

export const updateProfile = async (data) => {
    return apiClient.put("/auth/update-profile", data);
};

export const getMyPermissions = async () => {
    return apiClient.get("/auth/my-permissions");
};

export const changeFirstPassword = async (data) => {
    return apiClient.post("/auth/change-first-password", data);
};

export default apiClient;

