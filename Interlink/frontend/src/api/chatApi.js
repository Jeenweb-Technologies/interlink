import apiClient from "./authApi";

/**
 * Chat Module API Client
 */

export const getConversations = async () => {
    return apiClient.get("/chat/conversations");
};

export const getMessages = async (conversationId, limit = 100, before = null) => {
    let url = `/chat/conversations/${conversationId}/messages?limit=${limit}`;
    if (before) url += `&before=${before}`;
    return apiClient.get(url);
};

export const postChatMessage = async (conversationId, data, file = null) => {
    if (file) {
        const formData = new FormData();
        formData.append("file", file);
        Object.keys(data || {}).forEach(key => {
            if (data[key] !== undefined && data[key] !== null) {
                formData.append(key, typeof data[key] === "object" ? JSON.stringify(data[key]) : data[key]);
            }
        });
        return apiClient.post(`/chat/conversations/${conversationId}/messages`, formData, {
            headers: { "Content-Type": "multipart/form-data" }
        });
    }
    return apiClient.post(`/chat/conversations/${conversationId}/messages`, data);
};

export const startDirectChat = async (targetUserId) => {
    return apiClient.post("/chat/direct", { targetUserId });
};

export const createChannel = async (channelData) => {
    return apiClient.post("/chat/channels", channelData);
};

export const markConversationRead = async (conversationId, messageId = null) => {
    return apiClient.post(`/chat/conversations/${conversationId}/read`, { messageId });
};

export const toggleReaction = async (messageId, emoji, conversationId) => {
    return apiClient.post(`/chat/messages/${messageId}/reaction`, { emoji, conversationId });
};

export const getAvailableUsersForChat = async () => {
    return apiClient.get("/chat/users");
};

// Chat Settings Master (Company Governance)
export const getChatSettings = async () => {
    return apiClient.get("/chat/settings");
};

export const updateChatSettings = async (settings) => {
    return apiClient.put("/chat/settings", settings);
};

export const getChatUserTypePermissions = async () => {
    return apiClient.get("/chat/permissions");
};

export const saveChatUserTypePermission = async (userTypeId, perms) => {
    return apiClient.put(`/chat/permissions/${userTypeId}`, perms);
};

// User Chat Scope & Department Cross-Communication Permissions
export const getAllUserChatPermissions = async () => {
    return apiClient.get("/chat/user-permissions");
};

export const saveUserChatPermission = async (userId, data) => {
    return apiClient.put(`/chat/user-permissions/${userId}`, data);
};

// Advanced Enterprise Messaging
export const editChatMessage = async (messageId, messageText) => {
    return apiClient.put(`/chat/messages/${messageId}`, { messageText });
};

export const deleteChatMessage = async (messageId) => {
    return apiClient.delete(`/chat/messages/${messageId}`);
};

export const togglePinChatMessage = async (messageId) => {
    return apiClient.post(`/chat/messages/${messageId}/pin`);
};

export const acknowledgeAnnouncement = async (messageId) => {
    return apiClient.post(`/chat/messages/${messageId}/acknowledge`);
};

export const reportChatMessage = async (messageId, reason) => {
    return apiClient.post(`/chat/messages/${messageId}/report`, { reason });
};

export const getChannelParticipants = async (conversationId) => {
    return apiClient.get(`/chat/conversations/${conversationId}/participants`);
};

export const addChannelParticipant = async (conversationId, userId, role = "MEMBER") => {
    return apiClient.post(`/chat/conversations/${conversationId}/participants`, { userId, role });
};

export const removeChannelParticipant = async (conversationId, userId) => {
    return apiClient.delete(`/chat/conversations/${conversationId}/participants/${userId}`);
};

export const getMyChatPermissions = async () => {
    return apiClient.get("/chat/my-permissions");
};
