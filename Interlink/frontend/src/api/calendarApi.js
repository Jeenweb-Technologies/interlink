import { apiClient } from "./authApi";

// ─── Calendar API Client ──────────────────────────────────────────

export const getCalendarFeed = async (params = {}) => {
    return apiClient.get("/calendar/feed", { params });
};

export const getCalendars = async () => {
    return apiClient.get("/calendar/calendars");
};

export const createCalendar = async (data) => {
    return apiClient.post("/calendar/calendars", data);
};

export const updateCalendar = async (id, data) => {
    return apiClient.put(`/calendar/calendars/${id}`, data);
};

export const deleteCalendar = async (id) => {
    return apiClient.delete(`/calendar/calendars/${id}`);
};

export const getCalendarShares = async (id) => {
    return apiClient.get(`/calendar/calendars/${id}/shares`);
};

export const addCalendarShare = async (id, data) => {
    return apiClient.post(`/calendar/calendars/${id}/shares`, data);
};

export const removeCalendarShare = async (id, shareId) => {
    return apiClient.delete(`/calendar/calendars/${id}/shares/${shareId}`);
};

export const createEvent = async (data) => {
    return apiClient.post("/calendar/events", data);
};

export const getEventById = async (id) => {
    return apiClient.get(`/calendar/events/${id}`);
};

export const updateEvent = async (id, data) => {
    return apiClient.put(`/calendar/events/${id}`, data);
};

export const deleteEvent = async (id) => {
    return apiClient.delete(`/calendar/events/${id}`);
};

export const respondRSVP = async (id, data) => {
    return apiClient.post(`/calendar/events/${id}/rsvp`, data);
};

export const checkAvailability = async (data) => {
    return apiClient.post("/calendar/availability", data);
};
