import { apiRequest, ApiResponse } from './apiClient';

export interface WorkScheduleItem {
  id: number;
  organization_id?: number;
  company_id?: number;
  name: string;
  schedule_type: 'FIXED' | 'FLEXIBLE' | 'ROTATIONAL' | string;
  start_time: string; // e.g. "09:00:00"
  end_time: string; // e.g. "18:00:00"
  break_duration_minutes: number;
  grace_period_minutes: number;
  half_day_threshold_minutes?: number;
  full_day_threshold_minutes?: number;
  work_days?: any;
  timezone?: string;
  is_default?: boolean | number;
  is_active?: boolean | number;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceEventItem {
  id: number;
  organization_id?: number;
  company_id?: number;
  user_id?: number;
  event_type: 'CLOCK_IN' | 'BREAK_START' | 'BREAK_END' | 'CLOCK_OUT' | string;
  event_time: string;
  location_type: 'OFFICE' | 'REMOTE' | 'CLIENT_SITE' | string;
  ip_address?: string | null;
  device_info?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  created_at?: string;
}

export interface AttendanceDailySummary {
  id: number;
  organization_id?: number;
  company_id?: number;
  user_id: number;
  work_date: string;
  schedule_id?: number | null;
  first_clock_in?: string | null;
  last_clock_out?: string | null;
  total_work_minutes: number;
  total_break_minutes: number;
  expected_work_minutes?: number;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND' | string;
  late_minutes?: number;
  early_exit_minutes?: number;
  overtime_minutes?: number;
  is_regularized?: boolean | number;
  updated_at?: string;
}

export interface AttendanceTodayData {
  schedule: WorkScheduleItem | null;
  events: AttendanceEventItem[];
  summary: AttendanceDailySummary | null;
  activeState: 'CLOCKED_IN' | 'ON_BREAK' | 'CLOCKED_OUT' | string;
  lastClockInTimestamp?: string | null;
  lastBreakStartTimestamp?: string | null;
}

export interface AttendanceHistoryRecord extends AttendanceDailySummary {
  schedule_name?: string;
  scheduled_start?: string;
  scheduled_end?: string;
}

export interface AttendanceHistoryStats {
  totalDays: number;
  presentCount: number;
  lateCount: number;
  halfDayCount: number;
  totalWorkHours: string | number;
  averageDailyHours: string | number;
}

export interface AttendanceHistoryData {
  month: string;
  records: AttendanceHistoryRecord[];
  stats: AttendanceHistoryStats;
}

export interface AttendanceAdjustmentItem {
  id: number;
  organization_id?: number;
  company_id?: number;
  user_id: number;
  user_name?: string;
  user_email?: string;
  department_name?: string;
  work_date: string;
  requested_clock_in: string; // e.g. "09:00"
  requested_clock_out: string; // e.g. "18:00"
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  reviewer_id?: number | null;
  reviewer_name?: string | null;
  reviewer_comment?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
}

export interface TeamBoardMember {
  user_id: number;
  name: string;
  email: string;
  role: string;
  department_name?: string;
  today_status?: string;
  first_clock_in?: string | null;
  last_clock_out?: string | null;
  total_work_minutes?: number;
  total_break_minutes?: number;
  late_minutes?: number;
  live_event_type?: string;
  location_type?: string;
  liveStatus: 'CLOCKED_IN' | 'ON_BREAK' | 'CLOCKED_OUT' | 'NOT_ARRIVED' | string;
  totalWorkHours: string | number;
}

// ── API Methods ─────────────────────────────────────────────────────────────

/**
 * Record a real-time clock event (CLOCK_IN, BREAK_START, BREAK_END, CLOCK_OUT)
 */
export const recordClockEvent = async (data: {
  event_type: 'CLOCK_IN' | 'BREAK_START' | 'BREAK_END' | 'CLOCK_OUT' | string;
  location_type?: 'OFFICE' | 'REMOTE' | 'CLIENT_SITE' | string;
  latitude?: number;
  longitude?: number;
  notes?: string | null;
}): Promise<ApiResponse<AttendanceTodayData>> => {
  const normalizedType = (data.event_type || '').toUpperCase();
  return apiRequest<AttendanceTodayData>('/attendance/clock', {
    method: 'POST',
    body: {
      ...data,
      event_type: normalizedType,
      location_type: data.location_type || 'OFFICE',
    },
  });
};

/**
 * Get current user's today attendance status, active timer & shift details
 */
export const getTodayAttendance = async (): Promise<
  ApiResponse<AttendanceTodayData>
> => {
  return apiRequest<AttendanceTodayData>('/attendance/today', {
    method: 'GET',
  });
};

/**
 * Get monthly attendance history & summary KPIs
 */
export const getAttendanceHistory = async (params: {
  month?: string; // e.g. "2026-11"
  user_id?: number;
} = {}): Promise<ApiResponse<AttendanceHistoryData>> => {
  const query = new URLSearchParams();
  if (params.month) query.append('month', params.month);
  if (params.user_id) query.append('user_id', String(params.user_id));
  const qs = query.toString();
  return apiRequest<AttendanceHistoryData>(`/attendance/history${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
};

/**
 * Submit an attendance adjustment / correction request
 */
export const requestAttendanceAdjustment = async (data: {
  work_date: string; // YYYY-MM-DD
  requested_clock_in: string; // HH:mm
  requested_clock_out: string; // HH:mm
  reason: string;
}): Promise<ApiResponse<{ requestId: number }>> => {
  return apiRequest<{ requestId: number }>('/attendance/adjustments', {
    method: 'POST',
    body: data,
  });
};

/**
 * Get attendance adjustments (self or manager review queue)
 */
export const getAttendanceAdjustments = async (params: {
  queue?: 'manager' | 'self' | string;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL' | string;
} = {}): Promise<ApiResponse<{ adjustments: AttendanceAdjustmentItem[] }>> => {
  const query = new URLSearchParams();
  if (params.queue) query.append('queue', params.queue);
  if (params.status && params.status !== 'ALL') query.append('status', params.status);
  const qs = query.toString();
  return apiRequest<{ adjustments: AttendanceAdjustmentItem[] }>(
    `/attendance/adjustments${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
    }
  );
};

/**
 * Review an attendance adjustment request (Approve / Reject)
 */
export const reviewAttendanceAdjustment = async (
  id: number,
  data: {
    status: 'APPROVED' | 'REJECTED';
    reviewer_comment?: string;
    reviewer_comments?: string;
  }
): Promise<ApiResponse<{ message: string }>> => {
  const comment = data.reviewer_comment || data.reviewer_comments || '';
  return apiRequest<{ message: string }>(`/attendance/adjustments/${id}`, {
    method: 'PATCH',
    body: {
      status: data.status,
      reviewer_comment: comment,
    },
  });
};

/**
 * Manager Live Team Attendance Presence Board
 */
export const getTeamAttendanceBoard = async (params: {
  department_id?: number | string;
} = {}): Promise<ApiResponse<{ board: TeamBoardMember[] }>> => {
  const query = new URLSearchParams();
  if (params.department_id) query.append('department_id', String(params.department_id));
  const qs = query.toString();
  return apiRequest<{ board: TeamBoardMember[] }>(
    `/attendance/team-board${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
    }
  );
};

/**
 * Get all company work schedules and shifts
 */
export const getWorkSchedules = async (): Promise<
  ApiResponse<{ schedules: WorkScheduleItem[] }>
> => {
  return apiRequest<{ schedules: WorkScheduleItem[] }>('/attendance/schedules', {
    method: 'GET',
  });
};
