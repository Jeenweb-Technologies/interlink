import { apiRequest, ApiResponse } from './apiClient';

export interface AdminUserItem {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  mob_no?: string;
  active: number | boolean;
  type_name?: string;
  user_type_name?: string;
  device_status?: 'approved' | 'pending' | string | null;
  device_id?: string | null;
  device_verification_required?: number | boolean;
  company_id?: number;
  organization_id?: number;
  created_at?: string;
}

export interface CompanyItem {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  organization_id?: number;
  created_at?: string;
}

export interface UserTypePermission {
  masterName?: string;
  master_name?: string;
  canRead?: boolean | number;
  can_read?: boolean | number;
  canWrite?: boolean | number;
  can_write?: boolean | number;
  canUpdate?: boolean | number;
  can_update?: boolean | number;
  canDelete?: boolean | number;
  can_delete?: boolean | number;
}

export interface UserTypeItem {
  id: number;
  type_name: string;
  added_by?: number;
  added_by_name?: string;
  device_id?: string;
  created_at?: string;
  description?: string;
  permissions?: UserTypePermission[];
  user_count?: number;
}

export interface PendingDeviceItem {
  id: number;
  user_id: number;
  device_id: string;
  status: 'pending' | 'approved' | 'revoked' | string;
  submitted_at: string;
  user_name: string;
  user_email: string;
}

export interface DeviceHistoryItem {
  id: number;
  user_id: number;
  device_id: string;
  status: 'pending' | 'approved' | 'revoked' | 'rejected' | string;
  submitted_at: string;
  approved_at?: string | null;
  approved_by?: number | null;
  approved_by_name?: string | null;
  closed_at?: string | null;
  closed_by?: number | null;
  closed_by_name?: string | null;
  user_name: string;
  user_email: string;
}

/**
 * Fetch all users from admin directory
 */
export const fetchAdminUsers = async (includeInactive = true): Promise<ApiResponse<AdminUserItem[]>> => {
  return apiRequest(`/admin/users${includeInactive ? '?includeInactive=true' : ''}`, {
    method: 'GET',
  });
};

/**
 * Toggle user active/deactivated state
 */
export const toggleUserActive = async (id: number, active: boolean): Promise<ApiResponse> => {
  return apiRequest(`/admin/user/${id}/toggle-active`, {
    method: 'PATCH',
    body: { active },
  });
};

/**
 * Revoke active device for a user
 */
export const revokeUserDevice = async (userId: number): Promise<ApiResponse> => {
  return apiRequest(`/admin/revoke-device/${userId}`, {
    method: 'PUT',
  });
};

/**
 * Fetch pending device approval requests
 */
export const fetchPendingDevices = async (): Promise<ApiResponse<{ devices: PendingDeviceItem[] } | PendingDeviceItem[]>> => {
  return apiRequest('/admin/pending-devices', {
    method: 'GET',
  });
};

/**
 * Approve a pending device registration
 */
export const approveDevice = async (deviceRowId: number): Promise<ApiResponse> => {
  return apiRequest(`/admin/approve-device/${deviceRowId}`, {
    method: 'PUT',
  });
};

/**
 * Fetch all device audit logs / device history
 */
export const fetchDeviceAuditLogs = async (
  userId?: number
): Promise<ApiResponse<{ logs: DeviceHistoryItem[] } | DeviceHistoryItem[]>> => {
  const url = userId ? `/admin/audit-logs/${userId}` : '/admin/audit-logs';
  return apiRequest(url, {
    method: 'GET',
  });
};

/**
 * Create a new user by Admin
 */
export const createUserByAdmin = async (data: {
  name: string;
  username: string;
  email: string;
  password?: string;
  role?: string;
  userTypeId?: string | number;
  mobNo?: string;
  mob_no?: string;
  dateOfJoin?: string;
  deviceVerificationRequired?: boolean;
  companyId?: string | number;
  type_name?: string;
}): Promise<ApiResponse> => {
  return apiRequest('/admin/create-user', {
    method: 'POST',
    body: data,
  });
};

/**
 * Fetch all companies
 */
export const fetchCompanies = async (): Promise<ApiResponse<CompanyItem[]>> => {
  return apiRequest('/companies', {
    method: 'GET',
  });
};

/**
 * Create a new company
 */
export const createCompany = async (data: {
  name: string;
  email?: string | null;
  phone?: string | null;
}): Promise<ApiResponse<{ company: CompanyItem }>> => {
  return apiRequest('/companies', {
    method: 'POST',
    body: data,
  });
};

/**
 * Update an existing company
 */
export const updateCompany = async (
  id: number,
  data: {
    name: string;
    email?: string | null;
    phone?: string | null;
  }
): Promise<ApiResponse<{ company: CompanyItem }>> => {
  return apiRequest(`/companies/${id}`, {
    method: 'PUT',
    body: data,
  });
};

/**
 * Delete a company
 */
export const deleteCompany = async (id: number): Promise<ApiResponse> => {
  return apiRequest(`/companies/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Switch active company for the authenticated user
 */
export const switchCompanyApi = async (companyId: number): Promise<ApiResponse<{ activeCompany: CompanyItem }>> => {
  return apiRequest('/companies/switch', {
    method: 'POST',
    body: { companyId },
  });
};

/**
 * Fetch all user types / roles
 */
export const fetchUserTypes = async (): Promise<ApiResponse<UserTypeItem[]>> => {
  return apiRequest('/usertypes/all', {
    method: 'GET',
  });
};

/**
 * Create a new user type
 */
export const createUserType = async (data: {
  typeName: string;
  permissions: {
    masterName: string;
    canRead: boolean;
    canWrite: boolean;
    canUpdate: boolean;
    canDelete: boolean;
  }[];
}): Promise<ApiResponse> => {
  return apiRequest('/usertypes/add', {
    method: 'POST',
    body: data,
  });
};

/**
 * Update an existing user type
 */
export const updateUserType = async (
  id: number,
  data: {
    typeName: string;
    permissions: {
      masterName: string;
      canRead: boolean;
      canWrite: boolean;
      canUpdate: boolean;
      canDelete: boolean;
    }[];
  }
): Promise<ApiResponse> => {
  return apiRequest(`/usertypes/update/${id}`, {
    method: 'PUT',
    body: data,
  });
};

/**
 * Delete a user type
 */
export const deleteUserType = async (id: number): Promise<ApiResponse> => {
  return apiRequest(`/usertypes/delete/${id}`, {
    method: 'DELETE',
  });
};

export interface DepartmentItem {
  id: number;
  company_id?: number;
  department_name: string;
  description?: string | null;
  head_of_department?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  created_at?: string;
  updated_at?: string;
  company_name?: string;
  member_count?: number;
}

export interface DepartmentMemberItem {
  id: number;
  name: string;
  username: string;
  email: string;
  mob_no?: string;
  role: string;
  type_name?: string;
  department_role?: string;
  active?: boolean | number;
}

/**
 * Fetch all departments
 */
export const fetchDepartments = async (
  includeInactive = true,
  companyId?: number | string | null
): Promise<ApiResponse<DepartmentItem[]>> => {
  const params = new URLSearchParams();
  if (includeInactive) params.append('includeInactive', 'true');
  if (companyId) params.append('companyId', String(companyId));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiRequest(`/departments${qs}`, {
    method: 'GET',
  });
};

/**
 * Fetch single department by ID
 */
export const fetchDepartmentById = async (
  id: number
): Promise<ApiResponse<{ department: DepartmentItem }>> => {
  return apiRequest(`/departments/${id}`, {
    method: 'GET',
  });
};

/**
 * Create a new department
 */
export const createDepartmentApi = async (data: {
  department_name: string;
  head_of_department?: string | null;
  description?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  company_id?: number | null;
}): Promise<ApiResponse> => {
  return apiRequest('/departments', {
    method: 'POST',
    body: data,
  });
};

/**
 * Update an existing department
 */
export const updateDepartmentApi = async (
  id: number,
  data: {
    department_name: string;
    head_of_department?: string | null;
    description?: string | null;
    status?: 'ACTIVE' | 'INACTIVE';
    company_id?: number | null;
  }
): Promise<ApiResponse> => {
  return apiRequest(`/departments/${id}`, {
    method: 'PUT',
    body: data,
  });
};

/**
 * Delete department
 */
export const deleteDepartmentApi = async (id: number): Promise<ApiResponse> => {
  return apiRequest(`/departments/${id}`, {
    method: 'DELETE',
  });
};

/**
 * Toggle department status (ACTIVE <-> INACTIVE)
 */
export const toggleDepartmentStatusApi = async (
  id: number,
  currentStatus: string
): Promise<ApiResponse> => {
  return apiRequest(`/departments/${id}/status`, {
    method: 'PATCH',
    body: { currentStatus },
  });
};

/**
 * Fetch department members
 */
export const fetchDepartmentMembers = async (
  id: number
): Promise<ApiResponse<DepartmentMemberItem[]>> => {
  return apiRequest(`/departments/${id}/members`, {
    method: 'GET',
  });
};
