import { apiRequest, ApiResponse } from './apiClient';

export interface TaskPriorityItem {
  priority: 'urgent' | 'high' | 'medium' | 'low' | string;
  count: number | string;
}

export interface TaskStatusItem {
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | 'blocked' | string;
  count: number | string;
}

export interface TaskDashboardMetrics {
  total?: number | string;
  overdue_count?: number | string;
  due_today_count?: number | string;
  in_progress_count?: number | string;
  completed_this_week?: number | string;
  completed_projects_count?: number | string;
  avg_project_duration_days?: string;
  total_project_hours_logged?: string;
}

export interface TeamWorkloadMember {
  user_id: number;
  name: string;
  email: string;
  active_tasks: number | string;
  total_estimated_hours: number | string;
  total_logged_hours: number | string;
}

export interface ProjectDurationItem {
  id: number;
  code: string;
  name: string;
  status: string;
  total_tasks: number | string;
  completed_tasks: number | string;
  start_date?: string;
  end_date?: string;
  completed_at?: string;
  actual_completion_duration_days?: number | string | null;
  total_logged_hours?: number | string;
  total_estimated_hours?: number | string;
}

export interface BlockedTaskStreamItem {
  id: number;
  task_code: string;
  title: string;
  priority: string;
  due_date?: string;
  blocker_id: number;
  blocker_code: string;
  blocker_title: string;
  blocker_status: string;
}

export interface TaskDashboardData {
  metrics: TaskDashboardMetrics;
  priorities: TaskPriorityItem[];
  statuses: TaskStatusItem[];
  workload?: TeamWorkloadMember[];
  blocked_stream?: BlockedTaskStreamItem[];
  project_durations?: ProjectDurationItem[];
}

export interface TaskAssignee {
  user_id: number;
  name: string;
  email: string;
  username?: string;
}

export interface TaskLabel {
  id: number;
  name: string;
  color: string;
}

export interface TaskBlocker {
  id?: number;
  blocking_task_id?: number;
  blocking_task_code?: string;
  blocking_task_title?: string;
}

export interface TaskItem {
  id: number;
  task_code?: string;
  title: string;
  description?: string;
  status: string;
  priority: 'urgent' | 'high' | 'medium' | 'low' | string;
  project_id?: number;
  project_name?: string;
  project_code?: string;
  due_date?: string;
  start_date?: string;
  created_at?: string;
  estimated_hours?: number;
  actual_hours?: number;
  logged_hours?: number;
  checklist_total?: number;
  checklist_completed?: number;
  total_checklists?: number;
  completed_checklists?: number;
  comment_count?: number;
  attachment_count?: number;
  assignees?: TaskAssignee[];
  labels?: TaskLabel[];
  is_blocked?: boolean;
  blockers?: TaskBlocker[];
}

export interface TaskMetadata {
  projects: Array<{ id: number; name: string; code: string; status: string }>;
  users: Array<{ id: number; name: string; username: string; email: string; role: string }>;
  labels: Array<{ id: number; name: string; color: string }>;
  statuses: string[];
  priorities: string[];
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  project_id?: number | null;
  due_date?: string | null;
  start_date?: string | null;
  estimated_hours?: number;
  assignees?: number[];
  watchers?: number[];
  labels?: number[];
  checklists?: string[];
  blocked_by_ids?: number[];
}

/**
 * Fetch task dashboard metrics including priority distribution, project durations, and team workload
 */
export const fetchTaskDashboard = async (
  companyId?: number
): Promise<ApiResponse<TaskDashboardData>> => {
  return apiRequest('/tasks/dashboard', {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Fetch task list with optional filters
 */
export const fetchTasks = async (
  params?: Record<string, any>,
  companyId?: number
): Promise<ApiResponse<TaskItem[]>> => {
  let queryStr = '';
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      queryStr = `?${qs}`;
    }
  }
  return apiRequest(`/tasks${queryStr}`, {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Fetch task metadata (projects, users, labels, statuses, priorities)
 */
export const fetchTaskMetadataApi = async (
  companyId?: number
): Promise<ApiResponse<TaskMetadata>> => {
  return apiRequest('/tasks/metadata', {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Create a new task
 */
export const createTaskApi = async (
  data: CreateTaskPayload,
  companyId?: number
): Promise<ApiResponse<{ id: number; task_code: string }>> => {
  return apiRequest('/tasks', {
    method: 'POST',
    body: data,
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Update an existing task
 */
export const updateTaskApi = async (
  id: number,
  data: Partial<TaskItem>,
  companyId?: number
): Promise<ApiResponse<void>> => {
  return apiRequest(`/tasks/${id}`, {
    method: 'PUT',
    body: data,
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Delete a task
 */
export const deleteTaskApi = async (
  id: number,
  companyId?: number
): Promise<ApiResponse<void>> => {
  return apiRequest(`/tasks/${id}`, {
    method: 'DELETE',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};
