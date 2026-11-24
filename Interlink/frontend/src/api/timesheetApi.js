import apiClient from "./authApi";

// ── Timesheet Endpoints ────────────────────────────────────────────────────

// Get Current Weekly Timesheet Container & Entries
export const getCurrentTimesheet = async (params = {}) => {
    return apiClient.get("/timesheets/current", { params });
};

// Add or Update Time Entry
export const saveTimeEntry = async (entryData) => {
    return apiClient.post("/timesheets/entries", entryData);
};

// Delete Time Entry
export const deleteTimeEntry = async (id) => {
    return apiClient.delete(`/timesheets/entries/${id}`);
};

// Submit Timesheet for Manager Review
export const submitTimesheet = async (timesheetId) => {
    return apiClient.post(`/timesheets/${timesheetId}/submit`);
};

// Manager Timesheet Approvals Queue
export const getTimesheetApprovalsQueue = async (params = {}) => {
    return apiClient.get("/timesheets/approvals", { params });
};

// Approve Timesheet
export const approveTimesheet = async (timesheetId, data = {}) => {
    return apiClient.post(`/timesheets/${timesheetId}/approve`, data);
};

// Reject Timesheet
export const rejectTimesheet = async (timesheetId, data) => {
    return apiClient.post(`/timesheets/${timesheetId}/reject`, data);
};

// Timesheet Analytics & Reports
export const getTimesheetReports = async (params = {}) => {
    return apiClient.get("/timesheets/reports", { params });
};
