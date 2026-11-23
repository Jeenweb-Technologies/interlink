export const isUserAdmin = (user) => {
    if (!user) return false;
    const role = String(user.role || '').toLowerCase().trim();
    const typeName = String(user.user_type_name || user.typeName || '').toLowerCase().trim();
    return (
        ['admin', 'master_admin', 'super admin', 'administrator', 'super administrator', 'master'].includes(role) ||
        ['admin', 'master_admin', 'super admin', 'administrator', 'super administrator'].includes(typeName) ||
        user.username === 'admin' ||
        Number(user.user_type_id) === 1 ||
        Number(user.role_id) === 1
    );
};

export const isDepartmentAdmin = (user) => {
    if (!user) return false;
    if (isUserAdmin(user)) return true;
    if (Array.isArray(user.departments)) {
        return user.departments.some(d => d.department_role === 'ADMIN' || d.role === 'ADMIN');
    }
    return false;
};

export const isAnyAdmin = (user) => {
    return isUserAdmin(user) || isDepartmentAdmin(user);
};
