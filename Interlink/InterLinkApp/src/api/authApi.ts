import { apiRequest, ApiResponse } from './apiClient';

export interface LoginPayload {
  username: string;
  password: string;
  deviceId?: string;
}

export interface UserCompany {
  id: number;
  name: string;
  email?: string;
}

export interface UserData {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  mob_no?: string;
  organization_id?: number;
  company_id?: number;
  companies?: UserCompany[];
  modules?: string[];
}

export interface LoginResponseData {
  success: boolean;
  message?: string;
  token?: string;
  user?: UserData;
  status?:
    | 'DEVICE_REGISTRATION_REQUIRED'
    | 'PENDING_APPROVAL'
    | 'ORG_PENDING_APPROVAL'
    | 'ORG_REJECTED'
    | 'ORG_SUSPENDED'
    | 'DEVICE_MISMATCH';
}

/**
 * Login user with username, password, and deviceId
 */
export const loginUser = async (data: LoginPayload): Promise<ApiResponse<LoginResponseData>> => {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: data,
  });
};

/**
 * Request device authorization for pending approval
 */
export const requestDeviceRegistration = async (data: {
  username: string;
  password: string;
  deviceId: string;
}): Promise<ApiResponse> => {
  return apiRequest('/auth/request-device', {
    method: 'POST',
    body: data,
  });
};

/**
 * Register a new organization
 */
export const registerOrganization = async (data: {
  orgName: string;
  companyName?: string;
  name: string;
  username?: string;
  email: string;
  password: string;
  mob_no?: string;
}): Promise<ApiResponse> => {
  return apiRequest('/auth/register-org', {
    method: 'POST',
    body: data,
  });
};

/**
 * Logout current user
 */
export const logoutUser = async (): Promise<ApiResponse> => {
  return apiRequest('/auth/logout', {
    method: 'POST',
  });
};

/**
 * Get current user's permissions
 */
export const getMyPermissions = async (): Promise<ApiResponse> => {
  return apiRequest('/auth/my-permissions', {
    method: 'GET',
  });
};

/**
 * Fetch companies for active organization
 */
export const getCompanies = async (): Promise<ApiResponse> => {
  return apiRequest('/companies', {
    method: 'GET',
  });
};

/**
 * Update current user's profile
 */
export const updateUserProfileApi = async (data: {
  name: string;
  email: string;
  mob_no?: string;
}): Promise<ApiResponse<{ user: UserData }>> => {
  return apiRequest('/auth/update-profile', {
    method: 'PUT',
    body: data,
  });
};
