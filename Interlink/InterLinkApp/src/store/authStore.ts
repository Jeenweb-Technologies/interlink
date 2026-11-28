import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loginUser, logoutUser, UserData, UserCompany } from '../api/authApi';
import { getDeviceId } from '../utils/device';
import { usePermissionStore } from './permissionStore';

const USER_KEY = '@interlink_user';
const TOKEN_KEY = '@interlink_token';
const ACTIVE_COMPANY_KEY = '@interlink_active_company_id';

export interface LoginResult {
  success: boolean;
  status?: string;
  message?: string;
}

interface AuthState {
  user: UserData | null;
  token: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  isLoading: boolean;
  error: string | null;
  activeCompanyId: number | null;
  activeCompany: UserCompany | null;

  // Actions
  initializeAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  switchCompany: (companyId: number) => Promise<void>;
  updateUserProfile: (updatedFields: Partial<UserData>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isInitializing: true,
  isLoading: false,
  error: null,
  activeCompanyId: null,
  activeCompany: null,

  initializeAuth: async () => {
    set({ isInitializing: true });
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUserJson = await AsyncStorage.getItem(USER_KEY);
      const storedCompanyId = await AsyncStorage.getItem(ACTIVE_COMPANY_KEY);

      if (storedToken && storedUserJson) {
        const user: UserData = JSON.parse(storedUserJson);
        const activeCompanyId = storedCompanyId
          ? parseInt(storedCompanyId, 10)
          : user.company_id || (user.companies?.[0]?.id ?? null);

        const activeCompany =
          user.companies?.find((c) => c.id === activeCompanyId) ||
          user.companies?.[0] ||
          null;

        set({
          user,
          token: storedToken,
          isAuthenticated: true,
          activeCompanyId,
          activeCompany,
          isInitializing: false,
        });

        // Fetch user permissions for mobile module access control
        usePermissionStore.getState().fetchPermissions().catch(() => {});
        return;
      }
    } catch (err) {
      console.error('Failed to restore auth session:', err);
    }
    set({ isInitializing: false, isAuthenticated: false, user: null, token: null });
  },

  login: async (username: string, password: string): Promise<LoginResult> => {
    set({ isLoading: true, error: null });
    try {
      const deviceId = await getDeviceId();
      const response = await loginUser({ username, password, deviceId });

      if (!response.success) {
        set({
          isLoading: false,
          error: response.message || 'Login failed. Please verify credentials.',
        });
        return {
          success: false,
          status: response.status,
          message: response.message,
        };
      }

      const user: UserData = response.user;
      const token: string = response.token;

      const activeCompanyId =
        user.company_id || (user.companies?.[0]?.id ?? 1);
      const activeCompany =
        user.companies?.find((c) => c.id === activeCompanyId) ||
        user.companies?.[0] ||
        null;

      // Persist in AsyncStorage
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      await AsyncStorage.setItem(TOKEN_KEY, token);
      if (activeCompanyId) {
        await AsyncStorage.setItem(ACTIVE_COMPANY_KEY, String(activeCompanyId));
      }

      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        activeCompanyId,
        activeCompany,
        error: null,
      });

      // Fetch user permissions for mobile module access control
      usePermissionStore.getState().fetchPermissions().catch(() => {});

      return { success: true };
    } catch (err: any) {
      const message = err.message || 'An unexpected error occurred during login.';
      set({ isLoading: false, error: message });
      return { success: false, message };
    }
  },

  logout: async () => {
    // Non-blocking fire-and-forget server logout notification
    logoutUser().catch((err) => console.log('Server logout note:', err));

    try {
      await Promise.all([
        AsyncStorage.removeItem(USER_KEY),
        AsyncStorage.removeItem(TOKEN_KEY),
        AsyncStorage.removeItem(ACTIVE_COMPANY_KEY),
        usePermissionStore.getState().clearPermissions().catch(() => {}),
      ]);
    } catch (err) {
      console.error('Error clearing local storage on logout:', err);
    }

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      activeCompanyId: null,
      activeCompany: null,
      error: null,
    });
  },

  switchCompany: async (companyId: number) => {
    const { user } = get();
    if (!user) return;

    await AsyncStorage.setItem(ACTIVE_COMPANY_KEY, String(companyId));
    const activeCompany = user.companies?.find((c) => c.id === companyId) || null;

    set({
      activeCompanyId: companyId,
      activeCompany,
    });
  },

  updateUserProfile: async (updatedFields: Partial<UserData>) => {
    const { user } = get();
    if (!user) return;
    const updated = { ...user, ...updatedFields };
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updated));
    set({ user: updated });
  },

  clearError: () => set({ error: null }),
}));
