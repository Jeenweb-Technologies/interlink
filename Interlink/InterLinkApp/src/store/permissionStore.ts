import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMyPermissions } from '../api/authApi';
import { useAuthStore } from './authStore';

const PERMISSIONS_KEY = '@interlink_user_permissions';
const IS_ADMIN_KEY = '@interlink_is_admin';

export interface ActionPermission {
  read: boolean;
  write: boolean;
  update: boolean;
  delete: boolean;
}

export type PermissionAction = 'read' | 'write' | 'update' | 'delete';

interface PermissionState {
  permissions: Record<string, ActionPermission>;
  isAdmin: boolean;
  loading: boolean;
  hasLoaded: boolean;

  fetchPermissions: () => Promise<void>;
  hasPermission: (masterName: string, action?: PermissionAction) => boolean;
  clearPermissions: () => Promise<void>;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: {},
  isAdmin: false,
  loading: false,
  hasLoaded: false,

  fetchPermissions: async () => {
    const authState = useAuthStore.getState();
    const user = authState.user;

    // Admin / Super Admin / Developer roles always have unrestricted full access
    if (
      user?.role === 'admin' ||
      user?.role === 'super admin' ||
      user?.role === 'super_admin' ||
      user?.role === 'developer'
    ) {
      set({ isAdmin: true, permissions: {}, loading: false, hasLoaded: true });
      return;
    }

    set({ loading: true });
    try {
      // 1. Try restoring from cache first if not yet loaded
      if (!get().hasLoaded) {
        const cachedPerms = await AsyncStorage.getItem(PERMISSIONS_KEY);
        const cachedAdmin = await AsyncStorage.getItem(IS_ADMIN_KEY);
        if (cachedPerms) {
          try {
            set({
              permissions: JSON.parse(cachedPerms),
              isAdmin: cachedAdmin === 'true',
              hasLoaded: true,
            });
          } catch {
            // Ignore parse errors
          }
        }
      }

      // 2. Fetch fresh permissions from API
      const res = await getMyPermissions();
      if (res.success) {
        const rawPerms = (res as any).permissions || res.data?.permissions || {};
        const isAdmin = Boolean((res as any).isAdmin || res.data?.isAdmin);

        await AsyncStorage.setItem(PERMISSIONS_KEY, JSON.stringify(rawPerms));
        await AsyncStorage.setItem(IS_ADMIN_KEY, String(isAdmin));

        set({
          permissions: rawPerms,
          isAdmin,
          loading: false,
          hasLoaded: true,
        });
      } else {
        set({ loading: false, hasLoaded: true });
      }
    } catch (err) {
      console.warn('Failed to fetch user permissions:', err);
      set({ loading: false, hasLoaded: true });
    }
  },

  hasPermission: (masterName: string, action: PermissionAction = 'read'): boolean => {
    const authState = useAuthStore.getState();
    const user = authState.user;

    // Admins and developers always have unrestricted access to all modules and masters
    if (
      get().isAdmin ||
      user?.role === 'admin' ||
      user?.role === 'super admin' ||
      user?.role === 'super_admin' ||
      user?.role === 'developer'
    ) {
      return true;
    }

    const { permissions } = get();
    const modPerm = permissions[masterName];
    if (!modPerm) return false;

    return Boolean(modPerm[action]);
  },

  clearPermissions: async () => {
    await AsyncStorage.removeItem(PERMISSIONS_KEY);
    await AsyncStorage.removeItem(IS_ADMIN_KEY);
    set({ permissions: {}, isAdmin: false, loading: false, hasLoaded: false });
  },
}));
