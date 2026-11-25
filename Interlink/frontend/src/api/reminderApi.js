import { apiClient } from "./authApi";

// ─── Reminders API Client ─────────────────────────────────────────

export const getReminders = async (params = {}) => {
    return apiClient.get("/reminders", { params });
};

export const getReminderMetrics = async () => {
    return apiClient.get("/reminders/metrics");
};

export const createReminder = async (data) => {
    return apiClient.post("/reminders", data);
};

export const snoozeReminder = async (id, data) => {
    return apiClient.put(`/reminders/${id}/snooze`, data);
};

export const completeReminder = async (id) => {
    return apiClient.put(`/reminders/${id}/complete`);
};

export const dismissReminder = async (id) => {
    return apiClient.put(`/reminders/${id}/dismiss`);
};

export const escalateReminder = async (id, data = {}) => {
    return apiClient.post(`/reminders/${id}/escalate`, data);
};

export const deleteReminder = async (id) => {
    return apiClient.delete(`/reminders/${id}`);
};

export const getReminderPreferences = async () => {
    return apiClient.get("/reminders/preferences");
};

export const updateReminderPreferences = async (data) => {
    return apiClient.put("/reminders/preferences", data);
};
