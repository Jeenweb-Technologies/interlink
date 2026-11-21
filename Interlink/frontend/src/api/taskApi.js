import apiClient from "./authApi";

export const getTasks = async (params = {}) => {
    return apiClient.get("/tasks", { params });
};

export const getTaskById = async (id) => {
    return apiClient.get(`/tasks/${id}`);
};

export const createTask = async (data) => {
    return apiClient.post("/tasks", data);
};

export const updateTask = async (id, data) => {
    return apiClient.put(`/tasks/${id}`, data);
};

export const deleteTask = async (id) => {
    return apiClient.delete(`/tasks/${id}`);
};

export const bulkUpdateTasks = async (data) => {
    return apiClient.post("/tasks/bulk", data);
};

export const getDashboardMetrics = async () => {
    return apiClient.get("/tasks/dashboard");
};

export const getTaskMetadata = async () => {
    return apiClient.get("/tasks/metadata");
};

export const getSavedViews = async () => {
    return apiClient.get("/tasks/saved-views");
};

export const createSavedView = async (data) => {
    return apiClient.post("/tasks/saved-views", data);
};

export const getTemplates = async () => {
    return apiClient.get("/tasks/templates");
};

export const createTemplate = async (data) => {
    return apiClient.post("/tasks/templates", data);
};

export const addDependency = async (data) => {
    return apiClient.post("/tasks/dependencies", data);
};

export const deleteDependency = async (depId) => {
    return apiClient.delete(`/tasks/dependencies/${depId}`);
};

export const addChecklistItem = async (taskId, title) => {
    return apiClient.post(`/tasks/${taskId}/checklists`, { title });
};

export const toggleChecklistItem = async (itemId, is_completed) => {
    return apiClient.put(`/tasks/checklists/${itemId}/toggle`, { is_completed });
};

export const addComment = async (taskId, comment_text) => {
    return apiClient.post(`/tasks/${taskId}/comments`, { comment_text });
};

export const getActiveTimer = async () => {
    return apiClient.get("/tasks/time/active");
};

export const startTimer = async (taskId) => {
    return apiClient.post(`/tasks/${taskId}/time/start`);
};

export const stopTimer = async (data = {}) => {
    return apiClient.post("/tasks/time/stop", data);
};

export const discardTimer = async () => {
    return apiClient.delete("/tasks/time/discard");
};

export const logManualTime = async (taskId, data) => {
    return apiClient.post(`/tasks/${taskId}/time/manual`, data);
};
