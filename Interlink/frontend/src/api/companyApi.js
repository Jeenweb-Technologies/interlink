import apiClient from "./authApi";

export const getCompanies = async (includeInactive = true, search = "") => {
    const params = new URLSearchParams();
    if (!includeInactive) params.append("includeInactive", "false");
    if (search) params.append("search", search);
    const res = await apiClient.get(`/admin/companies?${params.toString()}`);
    return res.data;
};

export const getCompanyById = async (id) => {
    const res = await apiClient.get(`/admin/companies/${id}`);
    return res.data;
};

export const createCompany = async (companyData) => {
    const res = await apiClient.post("/admin/companies", companyData);
    return res.data;
};

export const updateCompany = async (id, companyData) => {
    const res = await apiClient.put(`/admin/companies/${id}`, companyData);
    return res.data;
};

export const deleteCompany = async (id) => {
    const res = await apiClient.delete(`/admin/companies/${id}`);
    return res.data;
};

export const toggleCompanyStatus = async (id, status) => {
    const res = await apiClient.patch(`/admin/companies/${id}/status`, { status });
    return res.data;
};
