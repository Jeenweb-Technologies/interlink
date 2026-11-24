import { apiClient } from "./authApi";

// ─── Meetings API Client ────────────────────────────────────────────

export const createInstantMeeting = async (data = {}) => {
    return apiClient.post("/meetings/instant", data);
};

export const scheduleMeeting = async (data) => {
    return apiClient.post("/meetings/schedule", data);
};

export const getMeetings = async (params = {}) => {
    return apiClient.get("/meetings", { params });
};

export const getMeetingDetails = async (roomCode) => {
    return apiClient.get(`/meetings/room/${roomCode}`);
};

export const getMeetingToken = async (roomCode, data = {}) => {
    return apiClient.post(`/meetings/${roomCode}/token`, data);
};

export const joinMeetingLobby = async (roomCode, data = {}) => {
    return apiClient.post(`/meetings/${roomCode}/lobby`, data);
};

export const admitParticipant = async (roomCode, participantId) => {
    return apiClient.put(`/meetings/${roomCode}/participants/${participantId}/admit`);
};

export const denyParticipant = async (roomCode, participantId) => {
    return apiClient.put(`/meetings/${roomCode}/participants/${participantId}/deny`);
};

export const cancelMeeting = async (roomCode) => {
    return apiClient.post(`/meetings/${roomCode}/cancel`);
};

export const endMeeting = async (roomCode) => {
    return apiClient.post(`/meetings/${roomCode}/end`);
};

export const getMeetingWhiteboard = async (meetingId) => {
    return apiClient.get(`/meetings/${meetingId}/whiteboard`);
};

export const saveMeetingWhiteboard = async (meetingId, data) => {
    return apiClient.post(`/meetings/${meetingId}/whiteboard`, data);
};

export const getMeetingNotes = async (meetingId) => {
    return apiClient.get(`/meetings/${meetingId}/notes`);
};

export const saveMeetingNotes = async (meetingId, data) => {
    return apiClient.post(`/meetings/${meetingId}/notes`, data);
};

export const getMeetingSummary = async (meetingId) => {
    return apiClient.get(`/meetings/summary/${meetingId}`);
};

export const saveMeetingRecording = async (meetingId, data) => {
    return apiClient.post(`/meetings/${meetingId}/recordings`, data);
};
