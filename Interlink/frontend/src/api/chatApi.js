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
        if (data.messageText) formData.append("messageText", data.messageText);
        if (data.parentMessageId) formData.append("parentMessageId", data.parentMessageId);
        if (data.isAnnouncement) formData.append("isAnnouncement", "true");
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
