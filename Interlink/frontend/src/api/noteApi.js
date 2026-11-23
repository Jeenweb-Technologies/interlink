import apiClient from "./authApi";

export const getNotes = async (params = {}) => {
    return apiClient.get("/notes", { params });
};

export const getNoteById = async (id) => {
    return apiClient.get(`/notes/${id}`);
};

export const createNote = async (data) => {
    return apiClient.post("/notes", data);
};

export const updateNote = async (id, data) => {
    return apiClient.put(`/notes/${id}`, data);
};

export const deleteNote = async (id) => {
    return apiClient.delete(`/notes/${id}`);
};

export const togglePinNote = async (id) => {
    return apiClient.patch(`/notes/${id}/pin`);
};

export const toggleChecklistItem = async (noteId, checklistId) => {
    return apiClient.put(`/notes/${noteId}/checklists/${checklistId}/toggle`);
};

export const shareNote = async (noteId, data) => {
    return apiClient.post(`/notes/${noteId}/shares`, data);
};

export const revokeNoteShare = async (noteId, shareId) => {
    return apiClient.delete(`/notes/${noteId}/shares/${shareId}`);
};

export const getNoteHistory = async (noteId) => {
    return apiClient.get(`/notes/${noteId}/history`);
};

export const restoreNoteVersion = async (noteId, versionId) => {
    return apiClient.post(`/notes/${noteId}/restore/${versionId}`);
};

export const uploadNoteAttachment = async (noteId, formData) => {
    return apiClient.post(`/notes/${noteId}/attachments`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
    });
};

export const deleteNoteAttachment = async (noteId, attachmentId) => {
    return apiClient.delete(`/notes/${noteId}/attachments/${attachmentId}`);
};

export const addNoteLink = async (noteId, data) => {
    return apiClient.post(`/notes/${noteId}/links`, data);
};

export const deleteNoteLink = async (noteId, linkId) => {
    return apiClient.delete(`/notes/${noteId}/links/${linkId}`);
};

export const getLinkableEntities = async () => {
    return apiClient.get("/notes/linkable-entities");
};

export const getCollaboratorsMeta = async () => {
    return apiClient.get("/notes/collaborators-meta");
};
