import { useState, useEffect } from "react";
import { createUserByAdmin } from "../../../api/authApi";
import { getUserTypes } from "../../../api/userTypeMasterApi";
import { getDepartments } from "../../../api/departmentApi";
import { getCompanies } from "../../../api/companyApi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function CreateUser() {
    const navigate = useNavigate();
    const [userTypes, setUserTypes] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [companies, setCompanies] = useState([]);
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const activeCompanyId = localStorage.getItem("active_company_id") || user.company_id || "1";
    const activeCompanyName = user.companies?.find(c => String(c.id) === String(activeCompanyId))?.name || "Active Workspace";

    const [selectedCompanyIds, setSelectedCompanyIds] = useState([String(activeCompanyId)]);
    const [loadingCompanies, setLoadingCompanies] = useState(true);

    const [newUserForm, setNewUserForm] = useState({
        name: "",
        username: "",
        email: "",
        password: "",
        designation: "",
        userTypeId: "",
        departmentIds: [],
        departmentId: "",
        mobNo: "",
        dateOfJoin: "",
        deviceVerificationRequired: true,
        role: "user"
    });
    const [creatingUser, setCreatingUser] = useState(false);

    const loadUserTypes = async () => {
        try {
            const res = await getUserTypes();
            setUserTypes(res.data.data || []);
        } catch (error) {
            console.error("Error loading user types:", error);
            toast.error("Failed to load user type options.");
        }
    };

    const loadDepartments = async () => {
        try {
            const res = await getDepartments(false, activeCompanyId);
            if (res.data?.success && Array.isArray(res.data.departments)) {
                setDepartments(res.data.departments);
            }
        } catch (error) {
            console.error("Error loading departments:", error);
        }
    };

    const loadCompanies = async () => {
        setLoadingCompanies(true);
        try {
            const res = await getCompanies({ scope: "all" });
            if (res.data?.success && Array.isArray(res.data.companies)) {
                setCompanies(res.data.companies);
                const activeStr = String(activeCompanyId);
                setSelectedCompanyIds(prev => prev.length > 0 ? prev : [activeStr]);
            }
        } catch (error) {
            console.error("Error loading companies for user creation:", error);
        } finally {
            setLoadingCompanies(false);
        }
    };

    useEffect(() => {
        loadUserTypes();
        loadDepartments();
        loadCompanies();
    }, [activeCompanyId]);

    const handleToggleCompany = (companyId) => {
        const idStr = String(companyId);
        setSelectedCompanyIds((prev) => {
            if (prev.includes(idStr)) {
                if (prev.length === 1) {
                    toast.error("User must have access to at least one company.");
                    return prev;
                }
                return prev.filter((id) => id !== idStr);
            } else {
                return [...prev, idStr];
            }
        });
    };

    const handleToggleDepartment = (deptId) => {
        const idStr = String(deptId);
        setNewUserForm((prev) => {
            const exists = prev.departmentIds.includes(idStr);
            const updated = exists
                ? prev.departmentIds.filter((id) => id !== idStr)
                : [...prev.departmentIds, idStr];
            return {
                ...prev,
                departmentIds: updated,
                departmentId: updated[0] || ""
            };
        });
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        if (selectedCompanyIds.length === 0) {
            toast.error("Please select at least one company for user access.");
            return;
        }

        setCreatingUser(true);
        try {
            await createUserByAdmin({
                ...newUserForm,
                designation: newUserForm.designation ? newUserForm.designation.trim() : null,
                departmentIds: newUserForm.departmentIds.map((id) => parseInt(id, 10)),
                departmentId: newUserForm.departmentIds[0] ? parseInt(newUserForm.departmentIds[0], 10) : null,
                companyId: activeCompanyId,
                companyIds: selectedCompanyIds.map((id) => parseInt(id, 10))
            });
            toast.success("User created successfully with assigned company access");
            setNewUserForm({
                name: "",
                username: "",
                email: "",
                password: "",
                designation: "",
                userTypeId: "",
                departmentIds: [],
                departmentId: "",
                mobNo: "",
                dateOfJoin: "",
                deviceVerificationRequired: true,
                role: "user"
            });
            setTimeout(() => {
                navigate("/admin/dashboard");
            }, 1000);
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to create user");
        } finally {
            setCreatingUser(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-slate-900">Create New User</h1>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold shadow-xs">
                                <i className="fa-solid fa-building text-[10px]"></i>
                                {activeCompanyName}
                            </span>
                        </div>
                        <p className="text-slate-500 mt-1">
                            Configure user credentials and assign company workspace access across your organization.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate("/admin/dashboard")}
                        className="text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center gap-1 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        Back to User list
                    </button>
                </div>

                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                    <form onSubmit={handleCreateUser} className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newUserForm.name}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Enter Full Name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                                <input
                                    type="text"
                                    required
                                    value={newUserForm.username}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Enter Username"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={newUserForm.email}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Enter Email Address"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                                <input
                                    type="password"
                                    required
                                    value={newUserForm.password}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Enter Password"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">User Type</label>
                                <select
                                    value={newUserForm.userTypeId}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, userTypeId: e.target.value })}
                                    className="block w-full px-3 py-2 border border-slate-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                >
                                    <option value="">Select user type</option>
                                    {userTypes.map((type) => (
                                        <option key={type.id} value={type.id}>
                                            {type.type_name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
                                <input
                                    type="text"
                                    value={newUserForm.designation}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, designation: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="e.g. Senior Software Engineer"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">User Group (Role)</label>
                                <select
                                    value={newUserForm.role}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                                    className="block w-full px-3 py-2 border border-slate-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                >
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
                                <input
                                    type="tel"
                                    required
                                    value={newUserForm.mobNo}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, mobNo: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                    placeholder="Enter mobile number"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Join</label>
                                <input
                                    type="date"
                                    value={newUserForm.dateOfJoin}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, dateOfJoin: e.target.value })}
                                    className="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>

                            {/* Department Multiple Selection Field */}
                            <div className="sm:col-span-2">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-slate-700">
                                        Departments <span className="text-xs font-normal text-slate-400">(Multiple Selection)</span>
                                    </label>
                                    <span className="text-xs font-semibold px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                                        {newUserForm.departmentIds.length} {newUserForm.departmentIds.length === 1 ? "department" : "departments"} selected
                                    </span>
                                </div>
                                {departments.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic py-2">No departments available.</p>
                                ) : (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-3 border border-slate-200 rounded-lg bg-slate-50/50">
                                        {departments.map((dept) => {
                                            const isChecked = newUserForm.departmentIds.includes(String(dept.id));
                                            return (
                                                <label
                                                    key={dept.id}
                                                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                                                        isChecked
                                                            ? "bg-blue-50 border-blue-400 text-blue-900 font-medium shadow-xs"
                                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => handleToggleDepartment(dept.id)}
                                                        className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                                    />
                                                    <span className="truncate">{dept.department_name}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <input
                                id="deviceVerification"
                                type="checkbox"
                                checked={newUserForm.deviceVerificationRequired}
                                onChange={(e) => setNewUserForm({ ...newUserForm, deviceVerificationRequired: e.target.checked })}
                                className="h-4 w-4 text-[#0056cf] border-slate-300 rounded focus:ring-[#0056cf]"
                            />
                            <label htmlFor="deviceVerification" className="text-sm font-medium text-slate-700">
                                Require device verification for this user
                            </label>
                        </div>

                        {/* Company Workspace Access Checkbox Section */}
                        <div className="pt-4 border-t border-slate-200">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                <div>
                                    <label className="block text-sm font-bold text-slate-800">
                                        Company Workspace Access <span className="text-rose-500">*</span>
                                    </label>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Select the companies this user can access and switch between. By default, the user has access to the current company only.
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1.5 self-start sm:self-auto text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md">
                                    <i className="fa-solid fa-building text-[10px] text-blue-500"></i>
                                    <span>{selectedCompanyIds.length} of {companies.length} selected</span>
                                </span>
                            </div>

                            {loadingCompanies ? (
                                <div className="flex items-center gap-2 text-xs text-slate-400 py-3">
                                    <i className="fa-solid fa-circle-notch fa-spin text-blue-500"></i>
                                    <span>Loading available companies...</span>
                                </div>
                            ) : companies.length === 0 ? (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500">
                                    No other companies found in this organization. The user will be assigned to {activeCompanyName}.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {companies.map((comp) => {
                                        const isSelected = selectedCompanyIds.includes(String(comp.id));
                                        const isCurrent = String(comp.id) === String(activeCompanyId);

                                        return (
                                            <div
                                                key={comp.id}
                                                onClick={() => handleToggleCompany(comp.id)}
                                                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                                                    isSelected
                                                        ? "bg-blue-50/70 border-blue-300 shadow-2xs"
                                                        : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60"
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}}
                                                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-xs font-bold text-slate-800 truncate">
                                                            {comp.name}
                                                        </span>
                                                        {isCurrent && (
                                                            <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded border border-blue-200">
                                                                Current
                                                            </span>
                                                        )}
                                                    </div>
                                                    {comp.email ? (
                                                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{comp.email}</p>
                                                    ) : (
                                                        <p className="text-[11px] text-slate-400 truncate mt-0.5">ID: #{comp.id}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={creatingUser}
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-[#0056cf] hover:bg-[#0040a1] focus:ring-2 focus:ring-offset-2 focus:ring-[#0056cf] disabled:opacity-50 transition-colors"
                            >
                                {creatingUser ? "Creating..." : "Create User Account"}
                            </button>
                        </div>
                    </form>
                </div>
        </div>
    );
}

