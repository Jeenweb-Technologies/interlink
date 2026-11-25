import { apiClient } from "./authApi";

export const getCompanies = async (params = {}) => {
    return apiClient.get("/companies", { params });
};

export const createCompany = async (data) => {
    return apiClient.post("/companies", data);
};

export const switchCompany = async (companyId) => {
    return apiClient.post("/companies/switch", { companyId });
};

export const updateCompany = async (id, data) => {
    return apiClient.put(`/companies/${id}`, data);
};

export const deleteCompany = async (id) => {
    return apiClient.delete(`/companies/${id}`);
};
