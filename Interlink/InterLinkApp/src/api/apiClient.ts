import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getDeviceId } from '../utils/device';

// Default development API host (10.0.2.2 for Android emulator, localhost for iOS simulator)
export const DEFAULT_API_BASE_URL = Platform.select({
  android: 'http://10.0.2.2:5001/api',
  // ios: 'http://192.168.1.10:5001/api',
  ios: 'http://localhost:5001/api',
  default: 'http://localhost:5001/api',
});

const TOKEN_KEY = '@interlink_token';
const COMPANY_ID_KEY = '@interlink_active_company_id';
const BASE_URL_KEY = '@interlink_custom_api_url';

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  status?: string;
  data?: T;
  [key: string]: any;
}

/**
 * Retrieves the currently active base API URL
 */
export const getApiBaseUrl = async (): Promise<string> => {
  try {
    const custom = await AsyncStorage.getItem(BASE_URL_KEY);
    return custom || DEFAULT_API_BASE_URL;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
};

/**
 * Configures a custom base API URL (e.g. your physical machine's LAN IP)
 */
export const setApiBaseUrl = async (url: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(BASE_URL_KEY, url);
  } catch (error) {
    console.error('Error saving custom API URL:', error);
  }
};

/**
 * Universal API Request Wrapper supporting auto-injected headers (Token, Device ID, Company ID)
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<ApiResponse<T>> {
  const baseUrl = await getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${baseUrl}${cleanEndpoint}`;

  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const activeCompanyId = await AsyncStorage.getItem(COMPANY_ID_KEY);
  const deviceId = await getDeviceId();

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  const reqHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {}),
  };

  if (token) {
    reqHeaders.Authorization = `Bearer ${token}`;
  }

  if (deviceId) {
    reqHeaders['x-device-id'] = deviceId;
    reqHeaders['device-id'] = deviceId;
  }

  if (activeCompanyId) {
    reqHeaders['x-company-id'] = activeCompanyId;
    reqHeaders['company-id'] = activeCompanyId;
  }

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: reqHeaders,
      body: isFormData
        ? options.body
        : options.body
          ? JSON.stringify(options.body)
          : undefined,
    });

    const responseData = await response.json().catch(() => ({
      success: response.ok,
      message: response.statusText,
    }));

    if (!response.ok) {
      // Backend returned 4xx or 5xx
      return {
        success: false,
        status: responseData.status,
        message: responseData.message || `Request failed with status ${response.status}`,
        ...responseData,
      };
    }

    return responseData;
  } catch (networkError: any) {
    console.error(`API Request to ${url} failed:`, networkError);
    return {
      success: false,
      message: networkError.message || 'Cannot connect to server. Check network or backend status.',
      status: 'NETWORK_ERROR',
    };
  }
}
