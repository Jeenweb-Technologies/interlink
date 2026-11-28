import { apiRequest, ApiResponse } from './apiClient';

export interface CalendarItem {
  id: number;
  organization_id?: number;
  company_id?: number;
  owner_id?: number;
  name: string;
  description?: string;
  color: string;
  type: 'personal' | 'department' | 'project' | 'company' | string;
  department_id?: number;
  project_id?: number;
  is_default?: boolean | number;
  is_public?: boolean | number;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AttendeeItem {
  user_id?: number;
  guest_email?: string;
  guest_name?: string;
  is_organizer?: boolean;
  rsvp_status?: 'accepted' | 'declined' | 'tentative' | 'needs_action';
}

export interface CalendarFeedItem {
  id: string; // e.g. "event_1", "meeting_5", "task_12", "project_3", "reminder_8"
  sourceType: 'event' | 'meeting' | 'task' | 'project' | 'reminder';
  sourceId: number;
  title: string;
  description?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  startTime: string; // ISO string
  endTime: string; // ISO string
  isAllDay: boolean;
  color: string;
  category: string;
  isReadOnly: boolean;
  calendarId?: number;
  calendarName?: string;
  creatorName?: string;
  status?: string;
  priority?: string;
  attendees?: AttendeeItem[];
  metadata?: Record<string, any>;
  deepLink?: string;
}

export interface CalendarFeedParams {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  includeEvents?: boolean;
  includeMeetings?: boolean;
  includeTasks?: boolean;
  includeProjects?: boolean;
  includeReminders?: boolean;
  calendarIds?: string; // Comma separated IDs
}

export interface CreateEventPayload {
  calendar_id?: number;
  title: string;
  description?: string;
  location?: string;
  meeting_url?: string;
  is_all_day?: boolean;
  start_time: string; // YYYY-MM-DD HH:mm:ss or ISO
  end_time: string; // YYYY-MM-DD HH:mm:ss or ISO
  timezone?: string;
  category?: string;
  color_override?: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
  linked_meeting_id?: number;
  linked_task_id?: number;
  linked_project_id?: number;
  attendees?: AttendeeItem[];
}

export interface CreateCalendarPayload {
  name: string;
  description?: string;
  color?: string;
  type?: 'personal' | 'department' | 'project' | string;
  is_public?: boolean;
  timezone?: string;
}

/**
 * Fetch unified calendar feed across events, meetings, tasks, projects, reminders
 */
export const getCalendarFeed = async (
  params: CalendarFeedParams
): Promise<ApiResponse<CalendarFeedItem[]>> => {
  const query = new URLSearchParams();
  query.append('startDate', params.startDate);
  query.append('endDate', params.endDate);
  if (params.includeEvents !== undefined) query.append('includeEvents', String(params.includeEvents));
  if (params.includeMeetings !== undefined) query.append('includeMeetings', String(params.includeMeetings));
  if (params.includeTasks !== undefined) query.append('includeTasks', String(params.includeTasks));
  if (params.includeProjects !== undefined) query.append('includeProjects', String(params.includeProjects));
  if (params.includeReminders !== undefined) query.append('includeReminders', String(params.includeReminders));
  if (params.calendarIds) query.append('calendarIds', params.calendarIds);

  return apiRequest<CalendarFeedItem[]>(`/calendar/feed?${query.toString()}`, {
    method: 'GET',
  });
};

/**
 * Fetch user accessible calendars
 */
export const getCalendars = async (): Promise<ApiResponse<CalendarItem[]>> => {
  return apiRequest<CalendarItem[]>('/calendar/calendars', {
    method: 'GET',
  });
};

/**
 * Create a new calendar
 */
export const createCalendar = async (
  data: CreateCalendarPayload
): Promise<ApiResponse<CalendarItem>> => {
  return apiRequest<CalendarItem>('/calendar/calendars', {
    method: 'POST',
    body: data,
  });
};

/**
 * Update an existing calendar
 */
export const updateCalendar = async (
  id: number,
  data: Partial<CreateCalendarPayload>
): Promise<ApiResponse<CalendarItem>> => {
  return apiRequest<CalendarItem>(`/calendar/calendars/${id}`, {
    method: 'PUT',
    body: data,
  });
};

/**
 * Delete a calendar
 */
export const deleteCalendar = async (id: number): Promise<ApiResponse<null>> => {
  return apiRequest<null>(`/calendar/calendars/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Schedule / Create a new calendar event
 */
export const createCalendarEvent = async (
  data: CreateEventPayload
): Promise<ApiResponse<{ eventId?: number; event?: any }>> => {
  return apiRequest('/calendar/events', {
    method: 'POST',
    body: data,
  });
};

/**
 * Fetch calendar event by ID
 */
export const getEventById = async (id: number): Promise<ApiResponse<CalendarFeedItem>> => {
  return apiRequest<CalendarFeedItem>(`/calendar/events/${id}`, {
    method: 'GET',
  });
};

/**
 * Update a calendar event
 */
export const updateCalendarEvent = async (
  id: number,
  data: Partial<CreateEventPayload>
): Promise<ApiResponse<{ eventId?: number }>> => {
  return apiRequest(`/calendar/events/${id}`, {
    method: 'PUT',
    body: data,
  });
};

/**
 * Delete a calendar event
 */
export const deleteCalendarEvent = async (id: number): Promise<ApiResponse<null>> => {
  return apiRequest<null>(`/calendar/events/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Respond to event RSVP (accepted, declined, tentative)
 */
export const respondRSVP = async (
  id: number,
  status: 'accepted' | 'declined' | 'tentative'
): Promise<ApiResponse<null>> => {
  return apiRequest<null>(`/calendar/events/${id}/rsvp`, {
    method: 'POST',
    body: { status },
  });
};
