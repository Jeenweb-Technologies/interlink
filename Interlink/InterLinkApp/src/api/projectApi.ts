import { apiRequest, ApiResponse } from './apiClient';

export interface PortfolioSummary {
  total_projects?: number;
  active_projects?: number;
  planning_projects?: number;
  on_hold_projects?: number;
  completed_projects?: number;
  archived_projects?: number;
  total_estimated_budget?: number | string;
  total_approved_budget?: number | string;
  total_actual_cost?: number | string;
}

export interface PortfolioHealth {
  onTrack: number;
  atRisk: number;
  delayed: number;
  totalActive?: number;
}

export interface UpcomingMilestone {
  id: number;
  title: string;
  due_date: string;
  status: string;
  project_id: number;
  project_name: string;
  project_code: string;
}

export interface PortfolioMetricsData {
  summary: PortfolioSummary;
  health: PortfolioHealth;
  upcomingMilestones: UpcomingMilestone[];
}

export interface ProjectItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  status: 'active' | 'planning' | 'on_hold' | 'completed' | 'archived' | string;
  priority: 'low' | 'medium' | 'high' | 'urgent' | string;
  visibility?: 'public' | 'private' | string;
  progress_percentage: number | string;
  start_date?: string;
  end_date?: string;
  approved_budget?: number | string;
  actual_cost?: number | string;
  currency?: string;
  owner_id?: number | null;
  owner_name?: string;
  owner_email?: string;
  sponsor_id?: number | null;
  sponsor_name?: string;
  parent_project_id?: number | null;
  tasks_count?: number;
  completed_tasks_count?: number;
  members_count?: number;
  open_risks_count?: number;
  subprojects_count?: number;
}

export interface CreateProjectPayload {
  name: string;
  code?: string;
  description?: string;
  parent_project_id?: number | string | null;
  status?: string;
  priority?: string;
  visibility?: string;
  owner_id?: number | null;
  sponsor_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  currency?: string;
  estimated_budget?: number;
  approved_budget?: number;
  is_budget_approved?: boolean;
}

export interface UpdateProjectPayload {
  name?: string;
  code?: string;
  description?: string;
  notes?: string;
  status?: string;
  priority?: string;
  visibility?: string;
  owner_id?: number | null;
  sponsor_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  currency?: string;
  estimated_budget?: number;
  approved_budget?: number;
  is_budget_approved?: boolean;
  actual_cost?: number;
  progress_percentage?: number;
  members?: number[];
}

export interface ProjectMember {
  id: number;
  membership_id?: number;
  name: string;
  email: string;
  role: string;
  system_role?: string;
  allocation_percentage?: number;
  hourly_billing_rate?: number;
  joined_at?: string;
}

export interface ProjectPhase {
  id: number;
  project_id: number;
  name: string;
  status: string;
  start_date?: string;
  end_date?: string;
  sort_order?: number;
}

export interface ProjectMilestone {
  id: number;
  project_id: number;
  name: string;
  status: string;
  due_date?: string;
  phase_name?: string;
  sort_order?: number;
}

export interface ProjectMetrics {
  total_tasks?: number;
  completed_tasks?: number;
  open_risks?: number;
  total_documents?: number;
  subprojects_count?: number;
}

export interface ProjectRisk {
  id: number;
  title: string;
  description?: string;
  probability?: number;
  impact?: number;
  severity_score?: number;
  status: string;
  category?: string;
  mitigation_strategy?: string;
  owner_name?: string;
}

export interface ProjectDocument {
  id: number;
  title: string;
  file_name?: string;
  file_path?: string;
  file_size?: number;
  mime_type?: string;
  category?: string;
  created_at?: string;
}

export interface ProjectWorkloadMember {
  user_id: number;
  name: string;
  email?: string;
  role?: string;
  allocation_percentage?: number;
  weeklyCapacityHours?: number;
  assigned_tasks?: number;
  active_tasks_count?: number;
  total_estimated_hours?: number;
  total_actual_hours?: number;
  utilizationPercentage?: number;
  isOverAllocated?: boolean;
  load_status?: 'balanced' | 'over_capacity' | 'high' | 'available' | string;
}

export interface ProjectReportData {
  summary?: string;
  progress_percentage?: number;
  budget_variance?: number;
  schedule_status?: string;
  accomplishments?: string[];
  blockers?: string[];
  [key: string]: any;
}

export interface ProjectDetailData extends ProjectItem {
  calculatedProgress?: number;
  members?: ProjectMember[];
  phases?: ProjectPhase[];
  milestones?: ProjectMilestone[];
  metrics?: ProjectMetrics;
  parent_project_name?: string;
  parent_project_code?: string;
}

/**
 * Fetch portfolio executive metrics (active projects, approved budget, upcoming milestones)
 */
export const fetchPortfolioMetrics = async (
  companyId?: number
): Promise<ApiResponse<PortfolioMetricsData>> => {
  return apiRequest('/projects/portfolio', {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Fetch all projects
 */
export const fetchProjects = async (
  params?: {
    search?: string;
    status?: string;
    priority?: string;
  },
  companyId?: number
): Promise<ApiResponse<ProjectItem[]>> => {
  const queryParts: string[] = [];
  if (params?.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
  if (params?.status && params.status !== 'all') queryParts.push(`status=${encodeURIComponent(params.status)}`);
  if (params?.priority && params.priority !== 'all') queryParts.push(`priority=${encodeURIComponent(params.priority)}`);
  const queryString = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  return apiRequest(`/projects${queryString}`, {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Fetch a single project by ID with members, phases, milestones & counts
 */
export const fetchProjectById = async (
  id: number | string,
  companyId?: number
): Promise<ApiResponse<ProjectDetailData>> => {
  return apiRequest(`/projects/${id}`, {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Fetch subprojects for a project
 */
export const fetchProjectSubprojects = async (
  id: number | string,
  companyId?: number
): Promise<ApiResponse<ProjectItem[]>> => {
  return apiRequest(`/projects/${id}/subprojects`, {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Fetch project risks
 */
export const fetchProjectRisks = async (
  id: number | string,
  companyId?: number
): Promise<ApiResponse<{ risks: ProjectRisk[]; [key: string]: any } | ProjectRisk[]>> => {
  return apiRequest(`/projects/${id}/risks`, {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Fetch project workload
 */
export const fetchProjectWorkload = async (
  id: number | string,
  companyId?: number
): Promise<ApiResponse<ProjectWorkloadMember[]>> => {
  return apiRequest(`/projects/${id}/workload`, {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Fetch project documents
 */
export const fetchProjectDocuments = async (
  id: number | string,
  companyId?: number
): Promise<ApiResponse<ProjectDocument[]>> => {
  return apiRequest(`/projects/${id}/documents`, {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Fetch project executive report
 */
export const fetchProjectReport = async (
  id: number | string,
  companyId?: number
): Promise<ApiResponse<ProjectReportData>> => {
  return apiRequest(`/projects/${id}/report`, {
    method: 'GET',
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Create a new project
 */
export const createProjectApi = async (
  data: CreateProjectPayload,
  companyId?: number
): Promise<ApiResponse<ProjectItem>> => {
  return apiRequest('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};

/**
 * Update an existing project
 */
export const updateProjectApi = async (
  id: number | string,
  data: UpdateProjectPayload,
  companyId?: number
): Promise<ApiResponse<ProjectItem>> => {
  return apiRequest(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
    headers: companyId ? { 'x-company-id': String(companyId), 'company-id': String(companyId) } : undefined,
  });
};
