import apiClient from "./authApi";

export const getCompanies = async (includeInactive = true, search = "") => {
    const params = new URLSearchParams();
    if (!includeInactive) params.append("includeInactive", "false");
    if (search) params.append("search", search);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await apiClient.get(`/companies${qs}`);
    const result = res.data || {};
    result.data = res.data;
    return result;
};

export const getCompanyById = async (id) => {
    const res = await apiClient.get(`/companies/${id}`);
    const result = res.data || {};
    result.data = res.data;
    return result;
};

export const createCompany = async (companyData) => {
    const res = await apiClient.post("/companies", companyData);
    const result = res.data || {};
    result.data = res.data;
    return result;
};

export const updateCompany = async (id, companyData) => {
    const res = await apiClient.put(`/companies/${id}`, companyData);
    const result = res.data || {};
    result.data = res.data;
    return result;
};

export const deleteCompany = async (id) => {
    const res = await apiClient.delete(`/companies/${id}`);
    const result = res.data || {};
    result.data = res.data;
    return result;
};

export const switchCompany = async (companyId) => {
    const res = await apiClient.post("/companies/switch", { companyId });
    const result = res.data || {};
    result.data = res.data;
    return result;
};

export const toggleCompanyStatus = async (id, status) => {
    const res = await apiClient.patch(`/companies/${id}/status`, { status });
    const result = res.data || {};
    result.data = res.data;
    return result;
};
