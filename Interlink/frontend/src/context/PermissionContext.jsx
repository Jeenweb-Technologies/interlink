import React, { createContext, useState, useEffect, useContext } from "react";
import { getMyPermissions } from "../api/authApi";

const defaultPermissionContext = {
    permissions: {},
    isAdmin: false,
    loading: false,
    hasPermission: (masterName, action) => {
        try {
            const user = JSON.parse(localStorage.getItem("user") || "null");
            if (user && (user.role === "admin" || user.role === "super_admin" || user.role === "super admin" || user.role === "developer")) {
                return true;
            }
        } catch {
            return false;
        }
        return false;
    },
    refreshPermissions: () => {}
};

const PermissionContext = createContext(defaultPermissionContext);

export function PermissionProvider({ children }) {
    const [permissions, setPermissions] = useState({});
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchPermissions = async () => {
        const token = localStorage.getItem("token");
        const user = JSON.parse(localStorage.getItem("user") || "null");

        if (!token || !user) {
            setPermissions({});
            setIsAdmin(false);
            setLoading(false);
            return;
        }

        if (user.role === "admin" || user.role === "super_admin" || user.role === "super admin" || user.role === "developer") {
            setIsAdmin(true);
            setPermissions({});
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            const response = await getMyPermissions();
            if (response.data && response.data.success) {
                setPermissions(response.data.permissions || {});
                setIsAdmin(!!response.data.isAdmin);
            } else {
                setPermissions({});
                setIsAdmin(false);
            }
        } catch (error) {
            console.error("Failed to fetch user permissions:", error);
            setPermissions({});
            setIsAdmin(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPermissions();
        
        // Listen for storage or custom events for login/logout
        const handleStorageChange = () => {
            fetchPermissions();
        };
        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("auth-change", handleStorageChange);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("auth-change", handleStorageChange);
        };
    }, []);

    const hasPermission = (masterName, action) => {
        // Admins and developers always have all permissions
        if (isAdmin) return true;
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (user && (user.role === "admin" || user.role === "super_admin" || user.role === "super admin" || user.role === "developer")) return true;

        const perm = permissions[masterName];
        if (!perm) return false;

        return !!perm[action];
    };

    return (
        <PermissionContext.Provider value={{ permissions, isAdmin, loading, hasPermission, refreshPermissions: fetchPermissions }}>
            {children}
        </PermissionContext.Provider>
    );
}

export function usePermission() {
    const context = useContext(PermissionContext);
    if (!context) {
        return defaultPermissionContext;
    }
    return context;
}
