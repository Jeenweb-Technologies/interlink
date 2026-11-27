import FingerprintJS from '@fingerprintjs/fingerprintjs';

const DEVICE_ID_KEY = 'deviceId';
let cachedDeviceId = null;
let pendingInitPromise = null;

// Safely get cookie value by name
const getCookie = (name) => {
    if (typeof document === 'undefined' || !document.cookie) return null;
    const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
};

// Check if device ID is stored in memory, localStorage, or cookie
const getStoredDeviceId = () => {
    if (cachedDeviceId) return cachedDeviceId;

    try {
        if (typeof localStorage !== 'undefined') {
            const localId = localStorage.getItem(DEVICE_ID_KEY);
            if (localId && localId.trim()) {
                return localId.trim();
            }
        }
    } catch (_) {}

    try {
        const cookieId = getCookie(DEVICE_ID_KEY);
        if (cookieId && cookieId.trim()) {
            return cookieId.trim();
        }
    } catch (_) {}

    return null;
};

// Persist device ID across memory, localStorage, and document.cookie
const persistDeviceId = (id) => {
    if (!id || typeof id !== 'string') return;
    const cleanId = id.trim();
    cachedDeviceId = cleanId;

    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(DEVICE_ID_KEY, cleanId);
        }
    } catch (_) {}

    try {
        if (typeof document !== 'undefined') {
            const d = new Date();
            d.setTime(d.getTime() + (10 * 365 * 24 * 60 * 60 * 1000));
            document.cookie = `${DEVICE_ID_KEY}=${encodeURIComponent(cleanId)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
        }
    } catch (_) {}
};

export const getDeviceId = async () => {
    // 1. If device ID is already stored in memory, localStorage, or cookie, return immediately
    const existing = getStoredDeviceId();
    if (existing) {
        persistDeviceId(existing); // Ensure both localStorage and cookie stay synced
        return existing;
    }

    // 2. Prevent concurrent fingerprint generation race conditions on page load
    if (pendingInitPromise) {
        return pendingInitPromise;
    }

    pendingInitPromise = (async () => {
        try {
            // Re-check in case another async task just finished
            const recheck = getStoredDeviceId();
            if (recheck) {
                persistDeviceId(recheck);
                return recheck;
            }

            let visitorId = null;
            try {
                const fp = await FingerprintJS.load();
                const result = await fp.get();
                if (result && result.visitorId) {
                    visitorId = String(result.visitorId).trim();
                }
            } catch (fpError) {
                console.warn('FingerprintJS failed to load or evaluate:', fpError);
            }

            // Fallback generation if FingerprintJS is blocked or fails
            if (!visitorId) {
                if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                    visitorId = crypto.randomUUID().replace(/-/g, '');
                } else {
                    visitorId = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
                }
            }

            persistDeviceId(visitorId);
            return visitorId;
        } finally {
            pendingInitPromise = null;
        }
    })();

    return pendingInitPromise;
};
