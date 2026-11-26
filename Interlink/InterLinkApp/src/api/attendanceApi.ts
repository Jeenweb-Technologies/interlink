import { apiRequest, ApiResponse } from './apiClient';

export interface AttendanceTodayData {
  activeState: 'CLOCKED_OUT' | 'CLOCKED_IN' | 'ON_BREAK' | string;
  is_clocked_in?: boolean;
  lastClockInTimestamp?: string;
  lastEvent?: {
    id: number;
    event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end' | string;
    timestamp: string;
    location_type?: string;
    notes?: string;
  };
  summary?: {
    in_time?: string;
    out_time?: string;
    total_work_minutes?: number;
    total_break_minutes?: number;
    work_duration_formatted?: string;
    break_duration_formatted?: string;
    status?: string;
  };
  shift?: {
    id?: number;
    name?: string;
    start_time?: string;
    end_time?: string;
    grace_period_mins?: number;
  };
  today_records?: Array<{
    id: number;
    event_type: string;
    timestamp: string;
    location_type?: string;
    notes?: string;
  }>;
}

export interface AttendanceHistoryRecord {
  id: number;
  work_date: string;
  clock_in?: string;
  clock_out?: string;
  total_work_minutes?: number;
  total_break_minutes?: number;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'HOLIDAY' | 'ON_LEAVE' | string;
  location_type?: string;
}

export interface AttendanceHistoryData {
  records: AttendanceHistoryRecord[];
  stats: {
    present_days: number;
    late_days: number;
    half_days: number;
    absent_days: number;
    total_work_hours: number | string;
    avg_daily_hours?: number | string;
  };
}

export interface WorkScheduleItem {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes?: number;
  half_day_hours?: number;
  full_day_hours?: number;
  is_default?: boolean;
}

export interface TeamBoardMember {
  id: number;
  name: string;
  username?: string;
  email?: string;
  department_name?: string;
  status: 'CLOCKED_IN' | 'ON_BREAK' | 'CLOCKED_OUT' | 'NOT_STARTED' | string;
  last_clock_in?: string;
  total_work_minutes?: number;
  shift_name?: string;
}

export interface AttendanceAdjustmentItem {
  id: number;
  user_id: number;
  user_name?: string;
  work_date: string;
  requested_clock_in: string;
  requested_clock_out: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  reviewer_comments?: string;
  created_at?: string;
}

export const recordClockEvent = async (data: {
  event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  location_type?: 'OFFICE' | 'REMOTE' | 'FIELD' | string;
  notes?: string;
}): Promise<ApiResponse<{ message?: string; today?: AttendanceTodayData }>> => {
  return apiRequest('/attendance/clock', {
    method: 'POST',
    body: data,
  });
};

export const getTodayAttendance = async (): Promise<
  ApiResponse<{ data: AttendanceTodayData }>
> => {
  return apiRequest('/attendance/today', {
    method: 'GET',
  });
};

export const getAttendanceHistory = async (params: {
  month?: string;
} = {}): Promise<ApiResponse<{ data: AttendanceHistoryData }>> => {
  const query = new URLSearchParams();
  if (params.month) query.append('month', params.month);
  const qs = query.toString();
  return apiRequest(`/attendance/history${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
};

export const requestAttendanceAdjustment = async (data: {
  work_date: string;
  requested_clock_in: string;
  requested_clock_out: string;
  reason: string;
}): Promise<ApiResponse> => {
  return apiRequest('/attendance/adjustments', {
    method: 'POST',
    body: data,
  });
};

export const getAttendanceAdjustments = async (params: {
  queue?: string;
  status?: string;
} = {}): Promise<ApiResponse<{ adjustments: AttendanceAdjustmentItem[] }>> => {
  const query = new URLSearchParams();
  if (params.queue) query.append('queue', params.queue);
  if (params.status && params.status !== 'ALL') query.append('status', params.status);
  const qs = query.toString();
  return apiRequest(`/attendance/adjustments${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
};

export const reviewAttendanceAdjustment = async (
  id: number,
  data: { status: 'APPROVED' | 'REJECTED'; reviewer_comments?: string }
): Promise<ApiResponse> => {
  return apiRequest(`/attendance/adjustments/${id}`, {
    method: 'PATCH',
    body: data,
  });
};

export const getTeamAttendanceBoard = async (params: {
  department_id?: number | string;
} = {}): Promise<ApiResponse<{ board: TeamBoardMember[] }>> => {
  const query = new URLSearchParams();
  if (params.department_id) query.append('department_id', String(params.department_id));
  const qs = query.toString();
  return apiRequest(`/attendance/team-board${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
};

export const getWorkSchedules = async (): Promise<
  ApiResponse<{ schedules: WorkScheduleItem[] }>
> => {
  return apiRequest('/attendance/schedules', {
    method: 'GET',
  });
};
