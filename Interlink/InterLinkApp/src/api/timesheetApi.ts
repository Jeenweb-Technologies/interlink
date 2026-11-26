import { apiRequest, ApiResponse } from './apiClient';

export interface TimeEntryItem {
  id: number;
  timesheet_id?: number;
  project_id: number;
  project_name?: string;
  project_code?: string;
  task_id?: number;
  task_name?: string;
  work_date: string;
  duration_minutes: number;
  description?: string;
  is_billable: boolean;
  category: 'DEVELOPMENT' | 'DESIGN' | 'TESTING' | 'MEETING' | 'BUG_FIX' | 'RESEARCH' | 'OTHER' | string;
}

export interface WeeklyTimesheetContainer {
  id: number;
  user_id?: number;
  period_start_date: string;
  period_end_date: string;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | string;
  total_minutes: number;
  billable_minutes: number;
  non_billable_minutes: number;
  submitted_at?: string;
  approved_at?: string;
  rejection_reason?: string;
}

export interface CurrentTimesheetResponse {
  timesheet: WeeklyTimesheetContainer;
  entries: TimeEntryItem[];
  summary: {
    total_hours: number | string;
    billable_hours: number | string;
    non_billable_hours: number | string;
  };
}

export interface TimesheetApprovalQueueItem {
  id: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  department_name?: string;
  period_start_date: string;
  period_end_date: string;
  status: string;
  total_minutes: number;
  billable_minutes: number;
  non_billable_minutes: number;
  submitted_at?: string;
  entry_count?: number;
}

export const getCurrentTimesheet = async (params: {
  date?: string;
} = {}): Promise<ApiResponse<{ data: CurrentTimesheetResponse }>> => {
  const query = new URLSearchParams();
  if (params.date) query.append('date', params.date);
  const qs = query.toString();
  return apiRequest(`/timesheets/current${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
};

export const saveTimeEntry = async (data: {
  id?: number;
  timesheet_id?: number;
  project_id: number;
  task_id?: number | null;
  work_date: string;
  duration_hours?: number;
  duration_minutes: number;
  description?: string;
  is_billable?: boolean;
  category?: string;
}): Promise<ApiResponse<{ entry: TimeEntryItem }>> => {
  return apiRequest('/timesheets/entries', {
    method: 'POST',
    body: data,
  });
};

export const deleteTimeEntry = async (id: number): Promise<ApiResponse> => {
  return apiRequest(`/timesheets/entries/${id}`, {
    method: 'DELETE',
  });
};

export const submitTimesheet = async (
  timesheetId: number
): Promise<ApiResponse> => {
  return apiRequest(`/timesheets/${timesheetId}/submit`, {
    method: 'POST',
  });
};

export const getTimesheetApprovalsQueue = async (params: {
  status?: string;
} = {}): Promise<ApiResponse<{ queue: TimesheetApprovalQueueItem[] }>> => {
  const query = new URLSearchParams();
  if (params.status && params.status !== 'ALL') query.append('status', params.status);
  const qs = query.toString();
  return apiRequest(`/timesheets/approvals${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
};

export const approveTimesheet = async (
  timesheetId: number,
  data: { comments?: string } = {}
): Promise<ApiResponse> => {
  return apiRequest(`/timesheets/${timesheetId}/approve`, {
    method: 'POST',
    body: data,
  });
};

export const rejectTimesheet = async (
  timesheetId: number,
  data: { comments: string }
): Promise<ApiResponse> => {
  return apiRequest(`/timesheets/${timesheetId}/reject`, {
    method: 'POST',
    body: data,
  });
};

export const getTimesheetReports = async (params: {
  startDate?: string;
  endDate?: string;
  projectId?: number | string;
} = {}): Promise<ApiResponse<{ report: any }>> => {
  const query = new URLSearchParams();
  if (params.startDate) query.append('startDate', params.startDate);
  if (params.endDate) query.append('endDate', params.endDate);
  if (params.projectId) query.append('projectId', String(params.projectId));
  const qs = query.toString();
  return apiRequest(`/timesheets/reports${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
};
