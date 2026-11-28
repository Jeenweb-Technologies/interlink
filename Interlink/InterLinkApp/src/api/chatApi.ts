import { Platform } from 'react-native';
import { apiRequest, ApiResponse } from './apiClient';

export interface ChatConversation {
  id: number;
  type: 'DIRECT' | 'GROUP' | 'BROADCAST' | string;
  title?: string;
  description?: string;
  other_user_id?: number;
  other_user_name?: string;
  other_user_email?: string;
  other_user_role?: string;
  other_user_department?: string;
  member_count?: number;
  is_announcement_only?: boolean;
  target_department_id?: number;
  target_department_name?: string;
  last_message_id?: number;
  last_message_text?: string;
  last_message_type?: string;
  last_message_time?: string;
  last_message_sender_name?: string;
  unread_count: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_name?: string;
  sender_email?: string;
  sender_role?: string;
  message_text: string;
  message_type?: 'TEXT' | 'FILE' | 'IMAGE' | 'SYSTEM' | string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_mime?: string;
  is_announcement?: boolean;
  parent_message_id?: number;
  reactions?: Array<{ emoji: string; count: number; users: number[] }>;
  created_at: string;
  is_read?: boolean;
  [key: string]: any;
}

export interface ChatSettings {
  allow_direct_messaging: boolean;
  allow_group_creation: 'ALL' | 'ADMIN_ONLY' | 'DISABLED' | string;
  allow_broadcast_creation: 'ADMIN_ONLY' | 'ALL' | 'DISABLED' | string;
  allow_file_sharing: boolean;
  allow_file_downloads?: boolean;
  max_file_size_mb: number;
  cross_department_chat?: boolean;
  read_receipts_enabled: boolean;
  typing_indicators_enabled?: boolean;
  message_retention_days?: number;
  legal_hold_enabled?: boolean;
  allow_message_editing?: boolean;
  allow_message_deletion?: boolean;
  [key: string]: any;
}

export interface ChatUserTypePermission {
  user_type_id: number;
  type_name: string;
  can_direct_chat: boolean;
  can_create_group: boolean;
  can_create_broadcast: boolean;
  can_send_files: boolean;
  can_download_files?: boolean;
  [key: string]: any;
}

export interface UserChatScopeItem {
  user_id: number;
  name: string;
  username?: string;
  email: string;
  department_id?: number;
  department_name?: string;
  chat_scope: 'DEPARTMENT_ONLY' | 'COMPANY_WIDE' | 'MULTI_DEPARTMENT' | string;
  allowed_department_ids?: number[];
  can_direct_chat?: boolean;
  can_create_group?: boolean;
  can_create_broadcast?: boolean;
  can_send_files?: boolean;
  can_download_files?: boolean;
  [key: string]: any;
}

export interface ChatDirectoryUser {
  id: number;
  name: string;
  email: string;
  username?: string;
  role?: string;
  department_id?: number;
  department_name?: string;
  company_id?: number;
  user_type?: string;
  active?: boolean;
  [key: string]: any;
}

/**
 * Fetch list of conversations for current user
 */
export const getConversations = async (): Promise<ApiResponse<{ conversations: ChatConversation[] }>> => {
  return apiRequest('/chat/conversations', {
    method: 'GET',
  });
};

/**
 * Fetch messages for a specific conversation
 */
export const getMessages = async (
  conversationId: number,
  limit = 100,
  before?: number | null
): Promise<ApiResponse<{ messages: ChatMessage[] }>> => {
  let url = `/chat/conversations/${conversationId}/messages?limit=${limit}`;
  if (before) url += `&before=${before}`;
  return apiRequest(url, {
    method: 'GET',
  });
};

/**
 * Send chat message
 */
export const postChatMessage = async (
  conversationId: number,
  data: {
    messageText: string;
    parentMessageId?: number | null;
    isAnnouncement?: boolean;
    announcementTitle?: string | null;
    announcementExpiry?: string | null;
    mentions?: any;
    file?: { uri: string; name: string; type: string } | null;
  }
): Promise<ApiResponse<{ message: ChatMessage }>> => {
  if (data.file) {
    const formData = new FormData();
    let fileUri = data.file.uri;
    if (Platform.OS === 'android' && !fileUri.startsWith('content://') && !fileUri.startsWith('file://')) {
      fileUri = `file://${fileUri}`;
    }

    let fileName = data.file.name || 'upload';
    let mimeType = data.file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      const ext = fileName.split('.').pop()?.toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'png') mimeType = 'image/png';
      else if (ext === 'gif') mimeType = 'image/gif';
      else if (ext === 'webp') mimeType = 'image/webp';
      else if (ext === 'pdf') mimeType = 'application/pdf';
      else if (ext === 'doc') mimeType = 'application/msword';
      else if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (ext === 'xls') mimeType = 'application/vnd.ms-excel';
      else if (ext === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      else mimeType = 'application/octet-stream';
    }

    if (mimeType.startsWith('image/') && !fileName.includes('.')) {
      fileName = `${fileName}.jpg`;
    }

    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);
    formData.append('messageText', data.messageText || '');
    if (data.parentMessageId) formData.append('parentMessageId', String(data.parentMessageId));
    if (data.isAnnouncement) formData.append('isAnnouncement', 'true');
    if (data.announcementTitle) formData.append('announcementTitle', data.announcementTitle);
    if (data.announcementExpiry) formData.append('announcementExpiry', data.announcementExpiry);
    if (data.mentions) formData.append('mentions', JSON.stringify(data.mentions));
    return apiRequest(`/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: formData,
    });
  }

  return apiRequest(`/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: data,
  });
};

/**
 * Start or retrieve 1-on-1 direct conversation with target user
 */
export const startDirectChat = async (
  targetUserId: number,
  companyId?: number
): Promise<ApiResponse<{ conversation: ChatConversation; conversationId?: number }>> => {
  return apiRequest('/chat/direct', {
    method: 'POST',
    body: { targetUserId },
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Create a new group channel or broadcast channel
 */
export const createChannel = async (channelData: {
  title: string;
  description?: string;
  type: 'GROUP' | 'BROADCAST';
  memberIds?: number[];
  isAdminOnly?: boolean;
  broadcastPriority?: string;
  targetDepartmentId?: number | string | null;
}): Promise<ApiResponse<{ channel: ChatConversation }>> => {
  return apiRequest('/chat/channels', {
    method: 'POST',
    body: channelData,
  });
};

/**
 * Mark a conversation as read
 */
export const markConversationRead = async (
  conversationId: number,
  messageId?: number | null
): Promise<ApiResponse<void>> => {
  return apiRequest(`/chat/conversations/${conversationId}/read`, {
    method: 'POST',
    body: { messageId },
  });
};

/**
 * Toggle emoji reaction on a message
 */
export const toggleReaction = async (
  messageId: number,
  emoji: string,
  conversationId: number
): Promise<ApiResponse<{ reactions: any[] }>> => {
  return apiRequest(`/chat/messages/${messageId}/reaction`, {
    method: 'POST',
    body: { emoji, conversationId },
  });
};

/**
 * Fetch available directory users for chat
 */
export const getAvailableUsersForChat = async (companyId?: number): Promise<ApiResponse<{ users: ChatDirectoryUser[] }>> => {
  return apiRequest('/chat/users', {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Fetch company chat settings & governance policies
 */
export const getChatSettings = async (companyId?: number): Promise<ApiResponse<{ settings: ChatSettings }>> => {
  return apiRequest('/chat/settings', {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Update company chat settings
 */
export const updateChatSettings = async (
  settings: Partial<ChatSettings>,
  companyId?: number
): Promise<ApiResponse<{ settings: ChatSettings }>> => {
  return apiRequest('/chat/settings', {
    method: 'PUT',
    body: settings,
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Fetch role-based chat permissions
 */
export const getChatUserTypePermissions = async (
  companyId?: number
): Promise<ApiResponse<{ permissions: ChatUserTypePermission[] }>> => {
  return apiRequest('/chat/permissions', {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Save chat permissions for specific user role
 */
export const saveChatUserTypePermission = async (
  userTypeId: number,
  perms: {
    can_direct_chat: boolean;
    can_create_group: boolean;
    can_create_broadcast: boolean;
    can_send_files: boolean;
    can_download_files?: boolean;
  },
  companyId?: number
): Promise<ApiResponse<void>> => {
  return apiRequest(`/chat/permissions/${userTypeId}`, {
    method: 'PUT',
    body: perms,
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Fetch all employee communication scopes
 */
export const getAllUserChatPermissions = async (
  companyId?: number
): Promise<ApiResponse<{ users: UserChatScopeItem[] }>> => {
  return apiRequest('/chat/user-permissions', {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Save chat scope & department cross-communication permissions for an individual user
 */
export const saveUserChatPermission = async (
  userId: number,
  data: {
    chat_scope: string;
    allowed_department_ids?: number[] | null;
    can_direct_chat?: boolean;
    can_create_group?: boolean;
    can_create_broadcast?: boolean;
    can_send_files?: boolean;
    can_download_files?: boolean;
  },
  companyId?: number
): Promise<ApiResponse<void>> => {
  return apiRequest(`/chat/user-permissions/${userId}`, {
    method: 'PUT',
    body: data,
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};
