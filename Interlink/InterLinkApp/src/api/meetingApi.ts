import { apiRequest, ApiResponse } from './apiClient';

export interface MeetingItem {
  id: number;
  room_code: string;
  title: string;
  description?: string;
  status: 'scheduled' | 'live' | 'ended' | string;
  meeting_type?: 'instant' | 'scheduled' | string;
  scheduled_start?: string;
  duration_minutes?: number;
  actual_start?: string;
  actual_end?: string;
  is_lobby_enabled?: boolean;
  host_id?: number;
  host_name?: string;
  host_email?: string;
  project_id?: number;
  project_name?: string;
  task_id?: number;
  task_name?: string;
  created_at?: string;
}

export interface WhiteboardData {
  meeting_id: number;
  canvas_data: string;
  version?: number;
  updated_at?: string;
}

export const createInstantMeeting = async (data: {
  title?: string;
  is_lobby_enabled?: boolean;
  project_id?: number;
  task_id?: number;
} = {}): Promise<ApiResponse<{ meeting: MeetingItem }>> => {
  return apiRequest('/meetings/instant', {
    method: 'POST',
    body: data,
  });
};

export const scheduleMeeting = async (data: {
  title: string;
  description?: string;
  scheduled_start: string;
  duration_minutes: number;
  project_id?: number;
  task_id?: number;
  is_lobby_enabled?: boolean;
}): Promise<ApiResponse<{ meeting: MeetingItem }>> => {
  return apiRequest('/meetings/schedule', {
    method: 'POST',
    body: data,
  });
};

export const getMeetings = async (params: {
  status?: string;
  search?: string;
} = {}): Promise<ApiResponse<{ meetings: MeetingItem[] }>> => {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'all') query.append('status', params.status);
  if (params.search) query.append('search', params.search);
  const qs = query.toString();
  return apiRequest(`/meetings${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
};

export const getMeetingDetails = async (
  roomCode: string
): Promise<ApiResponse<{ meeting: MeetingItem }>> => {
  return apiRequest(`/meetings/room/${roomCode}`, {
    method: 'GET',
  });
};

export const cancelMeeting = async (
  roomCode: string
): Promise<ApiResponse> => {
  return apiRequest(`/meetings/${roomCode}/cancel`, {
    method: 'POST',
  });
};

export const endMeeting = async (
  roomCode: string
): Promise<ApiResponse> => {
  return apiRequest(`/meetings/${roomCode}/end`, {
    method: 'POST',
  });
};

export const getMeetingWhiteboard = async (
  meetingId: number | string
): Promise<ApiResponse<{ whiteboard: WhiteboardData }>> => {
  return apiRequest(`/meetings/${meetingId}/whiteboard`, {
    method: 'GET',
  });
};

export const saveMeetingWhiteboard = async (
  meetingId: number | string,
  data: { canvas_data: string }
): Promise<ApiResponse> => {
  return apiRequest(`/meetings/${meetingId}/whiteboard`, {
    method: 'POST',
    body: data,
  });
};

export const getMeetingSummary = async (
  meetingId: number | string
): Promise<ApiResponse<{ summary: any }>> => {
  return apiRequest(`/meetings/summary/${meetingId}`, {
    method: 'GET',
  });
};
