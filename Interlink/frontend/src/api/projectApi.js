import apiClient from "./authApi";

// ─── Portfolio Metrics & Project List ───────────────────────────────────────
export const getPortfolioMetrics = async () => {
    return apiClient.get("/projects/portfolio");
};

export const getProjects = async (params = {}) => {
    return apiClient.get("/projects", { params });
};

export const getProjectById = async (id) => {
    return apiClient.get(`/projects/${id}`);
};

export const createProject = async (data) => {
    return apiClient.post("/projects", data);
};

export const updateProject = async (id, data) => {
    return apiClient.put(`/projects/${id}`, data);
};

export const deleteProject = async (id, archive = false) => {
    return apiClient.delete(`/projects/${id}`, { params: { archive } });
};

// ─── Templates & Blueprint Cloning ──────────────────────────────────────────
export const getProjectTemplates = async () => {
    return apiClient.get("/projects/templates");
};

export const createProjectFromTemplate = async (data) => {
    return apiClient.post("/projects/from-template", data);
};

// ─── Sub-projects ───────────────────────────────────────────────────────────
export const getSubprojects = async (id) => {
    return apiClient.get(`/projects/${id}/subprojects`);
};

// ─── Team Members & Roles ───────────────────────────────────────────────────
export const getProjectMembers = async (id) => {
    return apiClient.get(`/projects/${id}/members`);
};

export const addProjectMember = async (id, data) => {
    return apiClient.post(`/projects/${id}/members`, data);
};

export const removeProjectMember = async (id, userId) => {
    return apiClient.delete(`/projects/${id}/members/${userId}`);
};

export const emailProjectMembers = async (id, data) => {
    return apiClient.post(`/projects/${id}/email`, data);
};

// ─── Phases & Stage Gates ───────────────────────────────────────────────────
export const getProjectPhases = async (id) => {
    return apiClient.get(`/projects/${id}/phases`);
};

export const createProjectPhase = async (id, data) => {
    return apiClient.post(`/projects/${id}/phases`, data);
};

export const updateProjectPhase = async (phaseId, data) => {
    return apiClient.put(`/projects/phases/${phaseId}`, data);
};

export const deleteProjectPhase = async (phaseId) => {
    return apiClient.delete(`/projects/phases/${phaseId}`);
};

// ─── Milestones ─────────────────────────────────────────────────────────────
export const getProjectMilestones = async (id) => {
    return apiClient.get(`/projects/${id}/milestones`);
};

export const createProjectMilestone = async (id, data) => {
    return apiClient.post(`/projects/${id}/milestones`, data);
};

export const updateProjectMilestone = async (milestoneId, data) => {
    return apiClient.put(`/projects/milestones/${milestoneId}`, data);
};

export const deleteProjectMilestone = async (milestoneId) => {
    return apiClient.delete(`/projects/milestones/${milestoneId}`);
};

// ─── Risks & Matrix ─────────────────────────────────────────────────────────
export const getProjectRisks = async (id) => {
    return apiClient.get(`/projects/${id}/risks`);
};

export const createProjectRisk = async (id, data) => {
    return apiClient.post(`/projects/${id}/risks`, data);
};

export const updateProjectRisk = async (riskId, data) => {
    return apiClient.put(`/projects/risks/${riskId}`, data);
};

export const deleteProjectRisk = async (riskId) => {
    return apiClient.delete(`/projects/risks/${riskId}`);
};

// ─── Gantt & Baselines ──────────────────────────────────────────────────────
export const getProjectGantt = async (id) => {
    return apiClient.get(`/projects/${id}/gantt`);
};

export const createProjectBaseline = async (id, data) => {
    return apiClient.post(`/projects/${id}/baseline`, data);
};

// ─── Workload ───────────────────────────────────────────────────────────────
export const getProjectWorkload = async (id) => {
    return apiClient.get(`/projects/${id}/workload`);
};

// ─── Documents ──────────────────────────────────────────────────────────────
export const getProjectDocuments = async (id) => {
    return apiClient.get(`/projects/${id}/documents`);
};

export const uploadProjectDocument = async (id, formData) => {
    return apiClient.post(`/projects/${id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
    });
};

export const deleteProjectDocument = async (docId) => {
    return apiClient.delete(`/projects/documents/${docId}`);
};

// ─── Executive Report ───────────────────────────────────────────────────────
export const getProjectReport = async (id) => {
    return apiClient.get(`/projects/${id}/report`);
};
