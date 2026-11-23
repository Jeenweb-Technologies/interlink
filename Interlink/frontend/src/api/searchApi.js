import apiClient from "./authApi";

export const searchAllRecords = async (query) => {
    return apiClient.get("/search", { params: { q: query } });
};
