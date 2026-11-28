import { apiRequest, ApiResponse } from './apiClient';

export interface ReminderItem {
  id: number;
  organization_id: number;
  company_id: number;
  user_id: number;
  title: string;
  description?: string | null;
  source_type: 'personal' | 'task' | 'project' | 'document' | 'approval' | 'meeting' | string;
  source_id?: number | null;
  deep_link_url?: string | null;
  trigger_at: string;
  timezone?: string;
  is_recurring?: boolean | number;
  recurrence_rule?: any;
  status: 'pending' | 'snoozed' | 'completed' | 'dismissed' | 'escalated' | 'expired' | string;
  snooze_until?: string | null;
  snooze_count?: number;
  completed_at?: string | null;
  dismissed_at?: string | null;
  escalation_enabled?: boolean | number;
  escalation_rule?: any;
  escalated_at?: string | null;
  escalated_to_user_id?: number | null;
  expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  user_name?: string;
  user_email?: string;
  escalated_to_user_name?: string | null;
}

export interface ReminderMetrics {
  overdue_count: number;
  today_count: number;
  snoozed_count: number;
  upcoming_count: number;
}

export interface ReminderPreferences {
  channel_in_app: boolean;
  channel_push: boolean;
  channel_email: boolean;
  notify_tasks?: { in_app: boolean; push: boolean; email: boolean };
  notify_projects?: { in_app: boolean; push: boolean; email: boolean };
  notify_approvals?: { in_app: boolean; push: boolean; email: boolean };
  notify_meetings?: { in_app: boolean; push: boolean; email: boolean };
  notify_personal?: { in_app: boolean; push: boolean; email: boolean };
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
}

export interface CreateReminderPayload {
  title: string;
  description?: string | null;
  source_type?: string;
  source_id?: number | null;
  deep_link_url?: string | null;
  trigger_at: string; // YYYY-MM-DD HH:mm:ss or ISO
  timezone?: string;
  is_recurring?: boolean;
  recurrence_rule?: any;
  escalation_enabled?: boolean;
  escalation_rule?: any;
  expires_at?: string | null;
}

export interface GetRemindersParams {
  status?: string; // 'all' | 'overdue' | 'today' | 'upcoming' | 'snoozed' | 'completed' | 'dismissed'
  sourceType?: string;
  page?: number;
  limit?: number;
}

/**
 * Fetch reminders list with optional status and source filtering
 */
export const getReminders = async (
  params: GetRemindersParams = {}
): Promise<ApiResponse<ReminderItem[]>> => {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.sourceType && params.sourceType !== 'all') query.append('sourceType', params.sourceType);
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));

  return apiRequest<ReminderItem[]>(`/reminders?${query.toString()}`, {
    method: 'GET',
  });
};

/**
 * Fetch Reminder Center summary metrics (overdue, today, snoozed, upcoming)
 */
export const getReminderMetrics = async (): Promise<ApiResponse<ReminderMetrics>> => {
  return apiRequest<ReminderMetrics>('/reminders/metrics', {
    method: 'GET',
  });
};

/**
 * Create / Schedule a new reminder
 */
export const createReminder = async (
  data: CreateReminderPayload
): Promise<ApiResponse<ReminderItem>> => {
  return apiRequest<ReminderItem>('/reminders', {
    method: 'POST',
    body: data,
  });
};

/**
 * Snooze a reminder until specified timestamp
 */
export const snoozeReminder = async (
  id: number,
  data: { snoozeUntil: string }
): Promise<ApiResponse<null>> => {
  return apiRequest<null>(`/reminders/${id}/snooze`, {
    method: 'PUT',
    body: data,
  });
};

/**
 * Mark a reminder as completed
 */
export const completeReminder = async (id: number): Promise<ApiResponse<null>> => {
  return apiRequest<null>(`/reminders/${id}/complete`, {
    method: 'PUT',
  });
};

/**
 * Dismiss a reminder
 */
export const dismissReminder = async (id: number): Promise<ApiResponse<null>> => {
  return apiRequest<null>(`/reminders/${id}/dismiss`, {
    method: 'PUT',
  });
};

/**
 * Escalate a reminder to manager / lead
 */
export const escalateReminder = async (
  id: number,
  data: { escalateToUserId?: number } = {}
): Promise<ApiResponse<null>> => {
  return apiRequest<null>(`/reminders/${id}/escalate`, {
    method: 'POST',
    body: data,
  });
};

/**
 * Delete a reminder
 */
export const deleteReminder = async (id: number): Promise<ApiResponse<null>> => {
  return apiRequest<null>(`/reminders/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Get user reminder communication preferences
 */
export const getReminderPreferences = async (): Promise<ApiResponse<ReminderPreferences>> => {
  return apiRequest<ReminderPreferences>('/reminders/preferences', {
    method: 'GET',
  });
};

/**
 * Update user reminder communication preferences
 */
export const updateReminderPreferences = async (
  data: Partial<ReminderPreferences>
): Promise<ApiResponse<ReminderPreferences>> => {
  return apiRequest<ReminderPreferences>('/reminders/preferences', {
    method: 'PUT',
    body: data,
  });
};
