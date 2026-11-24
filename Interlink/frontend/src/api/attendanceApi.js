import apiClient from "./authApi";

// ── Attendance Endpoints ───────────────────────────────────────────────────

// Record Clock Event (CLOCK_IN, BREAK_START, BREAK_END, CLOCK_OUT)
export const recordClockEvent = async (eventData) => {
    return apiClient.post("/attendance/clock", eventData);
};

// Get Today's Status & Active Timer
export const getTodayAttendance = async () => {
    return apiClient.get("/attendance/today");
};

// Get Monthly Attendance History
export const getAttendanceHistory = async (params = {}) => {
    return apiClient.get("/attendance/history", { params });
};

// Request Attendance Adjustment / Correction
export const requestAttendanceAdjustment = async (data) => {
    return apiClient.post("/attendance/adjustments", data);
};

// Get Attendance Adjustments (Self or Manager Queue)
export const getAttendanceAdjustments = async (params = {}) => {
    return apiClient.get("/attendance/adjustments", { params });
};

// Review Attendance Adjustment (Approve / Reject)
export const reviewAttendanceAdjustment = async (id, data) => {
    return apiClient.patch(`/attendance/adjustments/${id}`, data);
};

// Manager Live Team Attendance Board
export const getTeamAttendanceBoard = async (params = {}) => {
    return apiClient.get("/attendance/team-board", { params });
};

// Get Work Schedules
export const getWorkSchedules = async () => {
    return apiClient.get("/attendance/schedules");
};
