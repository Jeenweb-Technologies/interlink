import apiClient from "./authApi";

export const getConversations = async () => {
    const res = await apiClient.get("/chat/conversations");
    return res.data;
};

export const startDirectChat = async (targetUserId) => {
    const res = await apiClient.post("/chat/direct", { targetUserId });
    return res.data;
};
export const createDirectChat = startDirectChat;

export const createGroupChat = async (payloadOrTitle, memberIds = []) => {
    const body = typeof payloadOrTitle === "object"
        ? payloadOrTitle
        : { title: payloadOrTitle, memberIds };
    const res = await apiClient.post("/chat/group", body);
    return res.data;
};
export const createGroup = createGroupChat;

export const deleteGroupChat = async (conversationId) => {
    const res = await apiClient.delete(`/chat/group/${conversationId}`);
    return res.data;
};

export const updateGroupSettings = async (conversationId, settings) => {
    const res = await apiClient.patch(`/chat/group/${conversationId}/settings`, settings);
    return res.data;
};

export const getGroupMembers = async (conversationId) => {
    const res = await apiClient.get(`/chat/group/${conversationId}/members`);
    return res.data;
};


export const searchCoworkers = async (q = "", params = {}) => {
    const searchParams = new URLSearchParams();
    if (q) searchParams.append("q", q);
    if (params.departmentId) searchParams.append("departmentId", params.departmentId);
    if (params.departmentIds) {
        const val = Array.isArray(params.departmentIds) ? params.departmentIds.join(",") : params.departmentIds;
        if (val) searchParams.append("departmentIds", val);
    }
    if (params.companyId) searchParams.append("companyId", params.companyId);
    if (params.companyIds) {
        const val = Array.isArray(params.companyIds) ? params.companyIds.join(",") : params.companyIds;
        if (val) searchParams.append("companyIds", val);
    }
    const res = await apiClient.get(`/chat/users/search?${searchParams.toString()}`);
    return res.data;
};

export const getConversationMessages = async (conversationId) => {
    const res = await apiClient.get(`/chat/messages/${conversationId}`);
    return res.data;
};
export const getMessages = getConversationMessages;

export const sendChatMessage = async (payload) => {
    const res = await apiClient.post("/chat/messages", payload);
    return res.data;
};
export const sendMessage = sendChatMessage;

export const uploadChatAttachment = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await apiClient.post("/chat/upload", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });
    return res.data;
};
export const uploadFile = uploadChatAttachment;

export const createPoll = async (payload) => {
    const res = await apiClient.post("/chat/polls", payload);
    return res.data;
};

export const votePoll = async (pollId, optionId) => {
    const res = await apiClient.post(`/chat/polls/${pollId}/vote`, { optionId });
    return res.data;
};

export const getNotifications = async () => {
    const res = await apiClient.get("/chat/notifications");
    return res.data;
};

export const markNotificationRead = async (id) => {
    const res = await apiClient.patch(`/chat/notifications/${id}/read`);
    return res.data;
};

export const getStorageConfig = async () => {
    const res = await apiClient.get("/admin/storage-config");
    return res.data;
};

export const updateStorageConfig = async (data) => {
    const res = await apiClient.post("/admin/storage-config", data);
    return res.data;
};

export const testStorageConfig = async (data) => {
    const res = await apiClient.post("/admin/storage-config/test", data);
    return res.data;
};

export const getOneDriveAuthUrl = async (params) => {
    const res = await apiClient.get("/admin/storage-config/onedrive/auth-url", { params });
    return res.data;
};

export const deleteMessage = async (messageId, deleteType = 'FOR_ME') => {
    const res = await apiClient.delete(`/chat/messages/${messageId}`, {
        data: { deleteType }
    });
    return res.data;
};

export const getOnlineUsers = async () => {
    const res = await apiClient.get("/chat/online-users");
    return res.data;
};
