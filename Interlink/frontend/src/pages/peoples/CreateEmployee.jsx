import React, { useState, useEffect, useMemo } from "react";
import { createUserByAdmin } from "../../api/authApi";
import { getUserTypes } from "../../api/userTypeMasterApi";
import { getDepartments } from "../../api/departmentApi";
import { getCompanies } from "../../api/companyApi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function CreateEmployee() {
    const navigate = useNavigate();
    const [userTypes, setUserTypes] = useState([]);
    const [loadingTypes, setLoadingTypes] = useState(true);
    const [departmentsList, setDepartmentsList] = useState([]);
    const [loadingDepts, setLoadingDepts] = useState(true);
    const [companiesList, setCompaniesList] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [capsLockActive, setCapsLockActive] = useState(false);

    const handlePasswordKeyEvent = (e) => {
        if (e && typeof e.getModifierState === "function") {
            setCapsLockActive(e.getModifierState("CapsLock"));
        }
    };

    // Department assignment state
    // Mode: 'SINGLE' or 'MULTIPLE'
    const [deptAssignmentMode, setDeptAssignmentMode] = useState("MULTIPLE");
    const [selectedSingleDept, setSelectedSingleDept] = useState("");
    const [selectedMultiDepts, setSelectedMultiDepts] = useState([]);
    const [deptSearchQuery, setDeptSearchQuery] = useState("");
    const [deptRole, setDeptRole] = useState("USER"); // 'USER' or 'ADMIN'

    // Inter-Department Chat Permission state (Step 3)
    const [chatScopeMode, setChatScopeMode] = useState("OWN"); // 'OWN' | 'ALL' | 'CUSTOM'
    const [customChatDepts, setCustomChatDepts] = useState([]);
    const [chatDeptSearchQuery, setChatDeptSearchQuery] = useState("");

    // Inter-Company Chat Permission state (Step 4)
    const [interCompanyMode, setInterCompanyMode] = useState("NONE"); // 'NONE' | 'ALL' | 'CUSTOM'
    const [selectedInterCompanies, setSelectedInterCompanies] = useState([]);
    const [interCompanyDeptScope, setInterCompanyDeptScope] = useState("ALL"); // 'ALL' | 'CUSTOM'
    const [selectedInterCompanyDepts, setSelectedInterCompanyDepts] = useState([]);

    const [newUserForm, setNewUserForm] = useState({
        name: "",
        username: "",
        email: "",
        password: "Password123!",
        companyId: "",
        userTypeId: "",
        mobNo: "",
        dateOfJoin: new Date().toISOString().split("T")[0],
        deviceVerificationRequired: false,
        allowWhatsapp: true,
        canChatWithVendors: false,
        isVendor: false,
        role: "user"
    });
    const [creatingUser, setCreatingUser] = useState(false);

    const loadData = async () => {
        setLoadingTypes(true);
        setLoadingDepts(true);
        setLoadingCompanies(true);
        try {
            const [typesResult, deptsResult, compsResult] = await Promise.allSettled([
                getUserTypes(),
                getDepartments(false),
                getCompanies(false)
            ]);

            if (typesResult.status === "fulfilled") {
                const typesRes = typesResult.value;
                const list = typesRes.data?.data || typesRes.data || [];
                setUserTypes(Array.isArray(list) ? list : []);
                if (Array.isArray(list) && list.length > 0) {
                    const defaultType = list.find(t => 
                        t.type_name?.toLowerCase().includes("specialist") || 
                        t.type_name?.toLowerCase().includes("member") || 
                        t.type_name?.toLowerCase().includes("staff")
                    ) || list[0];
                    setNewUserForm(prev => ({
                        ...prev,
                        userTypeId: defaultType.id
                    }));
                }
            } else {
                console.warn("Failed to load user types:", typesResult.reason);
            }

            if (deptsResult.status === "fulfilled") {
                const deptsRes = deptsResult.value;
                const dList = deptsRes?.departments || deptsRes?.data || (Array.isArray(deptsRes) ? deptsRes : []);
                const validDepts = Array.isArray(dList) ? dList : [];
                setDepartmentsList(validDepts);
                if (validDepts.length > 0) {
                    setSelectedSingleDept(validDepts[0].id);
                    setSelectedMultiDepts([validDepts[0].id]);
                }
            } else {
                console.warn("Failed to load departments:", deptsResult.reason);
            }

            if (compsResult.status === "fulfilled") {
                const cRes = compsResult.value;
                const cList = cRes?.companies || cRes?.data || (Array.isArray(cRes) ? cRes : []);
                const validComps = Array.isArray(cList) ? cList : [];
                setCompaniesList(validComps);
                if (validComps.length > 0) {
                    const mainComp = validComps.find(c => c.is_main) || validComps[0];
                    setNewUserForm(prev => ({
                        ...prev,
                        companyId: mainComp.id
                    }));
                }
            } else {
                console.warn("Failed to load companies:", compsResult.reason);
            }

            if (typesResult.status === "rejected" && deptsResult.status === "rejected") {
                toast.error("Failed to load options.");
            }
        } catch (error) {
            console.error("Error loading options:", error);
            toast.error("Failed to load options.");
        } finally {
            setLoadingTypes(false);
            setLoadingDepts(false);
            setLoadingCompanies(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Selected user type object
    const selectedTypeObj = useMemo(() => {
        return userTypes.find(t => String(t.id) === String(newUserForm.userTypeId)) || null;
    }, [userTypes, newUserForm.userTypeId]);

    // Selected company object
    const selectedCompanyObj = useMemo(() => {
        return companiesList.find(c => String(c.id) === String(newUserForm.companyId)) || null;
    }, [companiesList, newUserForm.companyId]);

    // Filter departments for Step 2 Assignment
    const filteredAssignDepts = useMemo(() => {
        if (!deptSearchQuery.trim()) return departmentsList;
        const q = deptSearchQuery.toLowerCase();
        return departmentsList.filter(d => 
            (d.department_name && d.department_name.toLowerCase().includes(q)) ||
            (d.company_name && d.company_name.toLowerCase().includes(q))
        );
    }, [departmentsList, deptSearchQuery]);

    // Filter departments for Step 3 Inter-Dept Chat Permissions
    const filteredChatDepts = useMemo(() => {
        if (!chatDeptSearchQuery.trim()) return departmentsList;
        const q = chatDeptSearchQuery.toLowerCase();
        return departmentsList.filter(d => 
            (d.department_name && d.department_name.toLowerCase().includes(q))
        );
    }, [departmentsList, chatDeptSearchQuery]);

    // Generate random password
    const handleGeneratePassword = () => {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
        let pass = "";
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setNewUserForm(prev => ({ ...prev, password: pass }));
        setShowPassword(true);
        toast.success("Generated secure password");
    };

    // Auto-generate username from name
    const handleNameChange = (val) => {
        setNewUserForm(prev => {
            const updated = { ...prev, name: val };
            if (!prev.username || prev.username === prev.name.toLowerCase().replace(/[^a-z0-9]/g, '_')) {
                updated.username = val.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 20);
            }
            return updated;
        });
    };

    // Toggle multi-department assignment
    const toggleMultiDept = (id) => {
        setSelectedMultiDepts(prev => {
            if (prev.includes(id)) {
                if (prev.length === 1) {
                    toast.error("At least one department must remain selected");
                    return prev;
                }
                return prev.filter(d => d !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const selectAllDepts = () => {
        setSelectedMultiDepts(departmentsList.map(d => d.id));
        toast.success(`Selected all ${departmentsList.length} departments`);
    };

    const clearAllDepts = () => {
        if (departmentsList.length > 0) {
            setSelectedMultiDepts([departmentsList[0].id]);
            setSelectedSingleDept(departmentsList[0].id);
        } else {
            setSelectedMultiDepts([]);
        }
    };

    // Step 3: Inter-department permissions
    const toggleCustomChatDept = (id) => {
        setCustomChatDepts(prev =>
            prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
        );
    };

    const selectAllChatDepts = () => {
        setCustomChatDepts(departmentsList.map(d => d.id));
    };

    const clearAllChatDepts = () => {
        setCustomChatDepts([]);
    };

    // Step 4: Inter-company permissions
    const toggleInterCompany = (id) => {
        setSelectedInterCompanies(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const selectAllInterCompanies = () => {
        const others = companiesList.filter(c => String(c.id) !== String(newUserForm.companyId)).map(c => c.id);
        setSelectedInterCompanies(others.length > 0 ? others : companiesList.map(c => c.id));
    };

    const clearAllInterCompanies = () => {
        setSelectedInterCompanies([]);
    };

    const toggleInterCompanyDept = (id) => {
        setSelectedInterCompanyDepts(prev =>
            prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
        );
    };

    const selectAllInterCompanyDepts = () => {
        setSelectedInterCompanyDepts(departmentsList.map(d => d.id));
    };

    const clearAllInterCompanyDepts = () => {
        setSelectedInterCompanyDepts([]);
    };

    // Submit handler
    const handleCreateUser = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newUserForm.name.trim() || !newUserForm.username.trim() || !newUserForm.email.trim() || !newUserForm.password) {
            toast.error("Please fill in all required fields (Name, Username, Email, Password).");
            return;
        }

        let departmentsPayload = [];
        const isDepartmentAdminRole = deptRole === "ADMIN" || newUserForm.role === "admin";

        if (isDepartmentAdminRole) {
            if (selectedMultiDepts.length === 0) {
                toast.error("Please select at least one authorized department for this admin.");
                return;
            }
            departmentsPayload = selectedMultiDepts.map(id => ({
                departmentId: Number(id),
                role: 'ADMIN'
            }));
        } else {
            // Regular User role
            if (deptAssignmentMode === "MULTIPLE") {
                if (selectedMultiDepts.length === 0) {
                    toast.error("Please select at least one department.");
                    return;
                }
                departmentsPayload = selectedMultiDepts.map(id => ({
                    departmentId: Number(id),
                    role: 'USER'
                }));
            } else {
                if (!selectedSingleDept) {
                    toast.error("Please assign the user to a department.");
                    return;
                }
                departmentsPayload = [{
                    departmentId: Number(selectedSingleDept),
                    role: 'USER'
                }];
            }
        }

        setCreatingUser(true);
        try {
            const payload = {
                ...newUserForm,
                departments: departmentsPayload,
                canChatWithVendors: Boolean(newUserForm.canChatWithVendors),
                isVendor: Boolean(newUserForm.isVendor),
                mustChangePassword: true,
                canChatAllDepartments: chatScopeMode === "ALL",
                allowedChatDepartments: chatScopeMode === "CUSTOM" ? customChatDepts : [],
                canChatAllCompanies: interCompanyMode === "ALL",
                allowedChatCompanies: interCompanyMode === "CUSTOM" ? {
                    companyIds: selectedInterCompanies,
                    departmentIds: interCompanyDeptScope === "ALL" ? [] : selectedInterCompanyDepts
                } : { companyIds: [], departmentIds: [] }
            };

            const res = await createUserByAdmin(payload);
            if (res.data?.success || res.status === 201 || res.status === 200) {
                toast.success(`User account "${newUserForm.name}" created successfully!`);
                setTimeout(() => {
                    navigate("/peoples");
                }, 600);
            } else {
                toast.error(res.data?.message || "Failed to create user account.");
            }
        } catch (error) {
            console.error("Create User error:", error);
            toast.error(error.response?.data?.message || "Failed to create user account.");
        } finally {
            setCreatingUser(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-[#F8FAFC] font-sans text-slate-800 select-text">
            {/* FULL LENGTH CONTAINER: Spans full width without artificial max-w-7xl constraint */}
            <main className="flex-1 flex flex-col w-full px-3 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6">
                
                {/* ── Top Header & Actions Banner ───────────────────────────────────── */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5 sm:mb-6 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-900 to-slate-950 text-white flex items-center justify-center text-xl shadow-sm shrink-0">
                            <i className="fa-solid fa-user-plus text-[#2878C7]"></i>
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                    Create User Account
                                </h1>
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-[#2878C7] border border-red-200">
                                    Enterprise Directory
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                Setup employee credentials, assign single or multiple departments, and define organizational messaging scope.
                            </p>
                        </div>
                    </div>

                    {/* Stats pills & Header CTAs */}
                    <div className="flex items-center gap-3 shrink-0 flex-wrap">
                        <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                            <span><strong className="text-slate-900">{departmentsList.length}</strong> Depts</span>
                            <span className="text-slate-300">&bull;</span>
                            <span><strong className="text-slate-900">{companiesList.length}</strong> Companies</span>
                            <span className="text-slate-300">&bull;</span>
                            <span><strong className="text-slate-900">{userTypes.length}</strong> Roles</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => navigate("/peoples")}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                        >
                            <i className="fa-solid fa-arrow-left text-[11px] text-slate-400"></i>
                            <span>Back to Users</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCreateUser}
                            disabled={creatingUser}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#17365D] hover:bg-[#102642] text-white text-xs font-bold shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
                        >
                            {creatingUser ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    <span>Creating Account...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-check text-xs"></i>
                                    <span>Create Account</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* ── Form Body: Structured, Spacious Full-Length Layout ───────────────── */}
                <form onSubmit={handleCreateUser} className="space-y-6 pb-24">
                    
                    {/* ── CARD 1: Account Identity & Credentials (Full Width) ─────────────── */}
                    <div className="bg-white rounded-2xl p-4 sm:p-6 lg:p-7 border border-slate-200/90 shadow-xs space-y-5 sm:space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/80 flex items-center justify-center text-sm shadow-2xs">
                                    <i className="fa-solid fa-id-card"></i>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">1. Account Identity & Credentials</h3>
                                    <p className="text-xs text-slate-500 font-normal">Employee personal profile details, authentication keys, and security settings</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60">
                                Step 1
                            </span>
                        </div>

                        {/* 3-Column Responsive Inputs Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {/* Full Name */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Full Name <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <i className="fa-solid fa-signature absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                    <input
                                        type="text"
                                        required
                                        value={newUserForm.name}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                        placeholder="e.g. Alex Rivera"
                                        className="w-full pl-9 pr-3.5 h-10.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] shadow-2xs transition-all"
                                    />
                                </div>
                            </div>

                            {/* Username */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Username <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <i className="fa-solid fa-at absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                    <input
                                        type="text"
                                        required
                                        value={newUserForm.username}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                                        placeholder="e.g. alex_rivera"
                                        className="w-full pl-9 pr-3.5 h-10.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] shadow-2xs transition-all"
                                    />
                                </div>
                            </div>

                            {/* Email Address */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Email Address <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <i className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                    <input
                                        type="email"
                                        required
                                        value={newUserForm.email}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                                        placeholder="e.g. alex@epoxyhouse.com"
                                        className="w-full pl-9 pr-3.5 h-10.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] shadow-2xs transition-all"
                                    />
                                </div>
                            </div>

                            {/* Password with generator */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                        Password <span className="text-rose-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleGeneratePassword}
                                        className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                                    >
                                        <i className="fa-solid fa-wand-magic-sparkles text-[10px] mr-1"></i>
                                        Auto-Generate
                                    </button>
                                </div>
                                <div className="relative">
                                    <i className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        value={newUserForm.password}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                                        onKeyDown={handlePasswordKeyEvent}
                                        onKeyUp={handlePasswordKeyEvent}
                                        placeholder="Enter secure password"
                                        className="w-full pl-9 pr-9 h-10.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] shadow-2xs transition-all"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer p-1"
                                        title={showPassword ? "Hide password" : "Show password"}
                                    >
                                        <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                                    </button>
                                </div>
                                {capsLockActive && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold mt-1.5">
                                        <span className="text-amber-600 font-bold">⇪</span>
                                        <span>Caps Lock is ON — passwords are case-sensitive</span>
                                    </div>
                                )}
                            </div>

                            {/* Mobile Number */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Mobile Number
                                </label>
                                <div className="relative">
                                    <i className="fa-solid fa-phone absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                    <input
                                        type="tel"
                                        value={newUserForm.mobNo}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, mobNo: e.target.value })}
                                        placeholder="e.g. +91 9876543210"
                                        className="w-full pl-9 pr-3.5 h-10.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] shadow-2xs transition-all"
                                    />
                                </div>
                            </div>

                            {/* Date of Joining */}
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Date of Joining
                                </label>
                                <div className="relative">
                                    <i className="fa-solid fa-calendar absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                    <input
                                        type="date"
                                        value={newUserForm.dateOfJoin}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, dateOfJoin: e.target.value })}
                                        className="w-full pl-9 pr-3.5 h-10.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] shadow-2xs transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Hardware Device Fingerprint Setting Strip */}
                        <div className="pt-2">
                            <div className="flex items-center justify-between bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 text-xs shadow-2xs">
                                        <i className="fa-solid fa-mobile-screen-button"></i>
                                    </div>
                                    <div>
                                        <label htmlFor="deviceVerif" className="text-xs font-bold text-slate-800 cursor-pointer block">
                                            Require Hardware Fingerprint Device Verification on First Login
                                        </label>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            When enabled, system admin must approve user's PC/Mobile hardware signature before they can login.
                                        </p>
                                    </div>
                                </div>
                                <input
                                    id="deviceVerif"
                                    type="checkbox"
                                    checked={newUserForm.deviceVerificationRequired}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, deviceVerificationRequired: e.target.checked })}
                                    className="h-5 w-5 text-[#2878C7] rounded border-slate-300 focus:ring-[#2878C7] cursor-pointer shrink-0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── CARD 2: Role & Department Assignment (Full Width & Expansive Grid) ── */}
                    <div className="bg-white rounded-2xl p-4 sm:p-6 lg:p-7 border border-slate-200/90 shadow-xs space-y-5 sm:space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/80 flex items-center justify-center text-sm shadow-2xs">
                                    <i className="fa-solid fa-sitemap"></i>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">2. Role & Department Assignment</h3>
                                    <p className="text-xs text-slate-500 font-normal">Select company affiliation, user role tier, and assign one or multiple departmental workgroups</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                                Step 2
                            </span>
                        </div>

                        {/* Top Tier: Company & Role */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Primary Company Entity <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <i className="fa-solid fa-building absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                                    <select
                                        value={newUserForm.companyId}
                                        onChange={(e) => setNewUserForm(prev => ({ ...prev, companyId: e.target.value }))}
                                        required
                                        className="w-full pl-9 pr-3.5 h-10.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] shadow-2xs cursor-pointer"
                                    >
                                        <option value="">-- Select Company --</option>
                                        {companiesList.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.company_name} {c.is_main ? "★ (Primary Entity)" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">The main enterprise organization this employee is legally affiliated with.</p>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    User Role / Security Profile <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <i className="fa-solid fa-user-shield absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
                                    <select
                                        value={newUserForm.userTypeId}
                                        onChange={(e) => {
                                            const typeId = e.target.value;
                                            const typeObj = userTypes.find(t => String(t.id) === String(typeId));
                                            const name = (typeObj?.type_name || "").toLowerCase();
                                             const isSuper = name.includes("super admin") || Number(typeId) === 1;
                                            const isDeptAdm = name.includes("department admin") || name.includes("dept admin") || Number(typeId) === 2;
                                            const isVendorRole = Boolean(typeObj?.is_vendor) || name.includes("vendor");

                                            setNewUserForm(prev => ({
                                                ...prev,
                                                userTypeId: typeId,
                                                role: isSuper ? "admin" : "user",
                                                isVendor: isVendorRole
                                            }));

                                            if (isSuper || isDeptAdm) {
                                                setDeptRole("ADMIN");
                                                if (isSuper && departmentsList.length > 0) {
                                                    setSelectedMultiDepts(departmentsList.map(d => d.id));
                                                }
                                            } else {
                                                setDeptRole("USER");
                                            }
                                        }}
                                        required
                                        className="w-full pl-9 pr-3.5 h-10.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] shadow-2xs cursor-pointer"
                                    >
                                        <option value="">-- Select Role --</option>
                                        {userTypes.map((type) => (
                                            <option key={type.id} value={type.id}>
                                                {type.type_name} {type.is_vendor ? "(Vendor Account)" : ""}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">Controls administrative permissions and feature authorizations.</p>
                            </div>
                        </div>

                        {/* ── VENDOR / EXTERNAL PARTNER ACCESS POLICY ── */}
                        <div className="pt-2">
                            {newUserForm.isVendor ? (
                                <div className="p-4 bg-amber-50/90 border border-amber-200 rounded-2xl flex items-start gap-3.5 shadow-2xs">
                                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200">
                                        <i className="fa-solid fa-handshake text-sm"></i>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                                                External Vendor / Partner Account
                                            </h4>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-900">
                                                Restricted Isolation
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                                            Vendors can safely receive messages and chat with authorized staff members who reach out to them. By corporate security policy, external vendors cannot initiate new conversations or communicate with other external vendors.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-slate-50/90 border border-slate-200/90 rounded-2xl flex items-center justify-between gap-4 shadow-2xs">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/80 flex items-center justify-center shrink-0 text-sm">
                                            <i className="fa-solid fa-comments"></i>
                                        </div>
                                        <div>
                                            <label htmlFor="vendorChatToggle" className="text-xs font-bold text-slate-800 cursor-pointer block">
                                                Allow Direct Chat with External Vendors
                                            </label>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                Grant this employee explicit permission to initiate 1-to-1 conversations with external vendors and add vendors to group workgroups.
                                            </p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                        <input
                                            id="vendorChatToggle"
                                            type="checkbox"
                                            checked={newUserForm.canChatWithVendors}
                                            onChange={(e) => setNewUserForm(prev => ({ ...prev, canChatWithVendors: e.target.checked }))}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2878C7]"></div>
                                    </label>
                                </div>
                            )}
                        </div>

                        {/* ── EXPANSIVE FULL-LENGTH DEPARTMENT SELECTION ── */}
                        <div className="pt-4 border-t border-slate-100 space-y-4">
                            {/* Toolbar: Title, Segmented Toggle, Search & Quick Actions */}
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 bg-slate-50/90 p-4 rounded-xl border border-slate-200/80">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                                            Department Workgroup Scope <span className="text-rose-500">*</span>
                                        </h4>
                                        {deptRole === "ADMIN" && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                                Admin Supervisory Scope
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Assign this user to one specific department or multiple departments across the company.
                                    </p>
                                </div>

                                <div className="flex items-center gap-3 flex-wrap">
                                    {/* Segmented Control Mode Toggle */}
                                    {deptRole !== "ADMIN" && (
                                        <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDeptAssignmentMode("SINGLE");
                                                    if (selectedMultiDepts.length > 0) {
                                                        setSelectedSingleDept(selectedMultiDepts[0]);
                                                    } else if (departmentsList.length > 0) {
                                                        setSelectedSingleDept(departmentsList[0].id);
                                                    }
                                                }}
                                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                    deptAssignmentMode === "SINGLE"
                                                        ? "bg-slate-900 text-white shadow-2xs"
                                                        : "text-slate-600 hover:text-slate-900"
                                                }`}
                                            >
                                                <i className="fa-solid fa-building text-[11px]"></i>
                                                <span>Single Department</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDeptAssignmentMode("MULTIPLE");
                                                    if (selectedSingleDept && !selectedMultiDepts.includes(Number(selectedSingleDept))) {
                                                        setSelectedMultiDepts([Number(selectedSingleDept)]);
                                                    }
                                                }}
                                                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                                    deptAssignmentMode === "MULTIPLE"
                                                        ? "bg-indigo-600 text-white shadow-2xs"
                                                        : "text-slate-600 hover:text-slate-900"
                                                }`}
                                            >
                                                <i className="fa-solid fa-network-wired text-[11px]"></i>
                                                <span>Multiple Departments</span>
                                                <span className="text-[9px] px-1.5 py-0.2 bg-white/20 text-white rounded font-extrabold">NEW</span>
                                            </button>
                                        </div>
                                    )}

                                    {/* Filter input */}
                                    <div className="relative min-w-[200px]">
                                        <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                        <input
                                            type="text"
                                            value={deptSearchQuery}
                                            onChange={(e) => setDeptSearchQuery(e.target.value)}
                                            placeholder="Search departments..."
                                            className="w-full pl-8.5 pr-3 h-9 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                                        />
                                        {deptSearchQuery && (
                                            <button
                                                type="button"
                                                onClick={() => setDeptSearchQuery("")}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                            >
                                                <i className="fa-solid fa-xmark"></i>
                                            </button>
                                        )}
                                    </div>

                                    {/* Select All & Reset */}
                                    <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-slate-200">
                                        <button
                                            type="button"
                                            onClick={selectAllDepts}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-50 transition-colors cursor-pointer"
                                        >
                                            Select All ({departmentsList.length})
                                        </button>
                                        <span className="text-slate-200">|</span>
                                        <button
                                            type="button"
                                            onClick={clearAllDepts}
                                            className="text-xs font-bold text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Department Selection Display */}
                            {deptRole !== "ADMIN" && deptAssignmentMode === "SINGLE" ? (
                                /* Single Mode: Selectable Card View for All Departments */
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span>Click to pick the single active department for this user:</span>
                                        <span className="font-semibold text-slate-700">
                                            Active: <strong className="text-indigo-600 font-bold">{departmentsList.find(d => String(d.id) === String(selectedSingleDept))?.department_name || "None selected"}</strong>
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                        {filteredAssignDepts.map((d) => {
                                            const isSelected = String(d.id) === String(selectedSingleDept);
                                            return (
                                                <div
                                                    key={d.id}
                                                    onClick={() => {
                                                        setSelectedSingleDept(d.id);
                                                        setSelectedMultiDepts([d.id]);
                                                    }}
                                                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 cursor-pointer transition-all select-none ${
                                                        isSelected
                                                            ? "bg-indigo-50/90 border-indigo-600 text-indigo-950 font-bold shadow-xs ring-2 ring-indigo-500/20"
                                                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                                                            isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                                                        }`}>
                                                            <i className="fa-solid fa-building"></i>
                                                        </div>
                                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                                            isSelected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"
                                                        }`}>
                                                            {isSelected && <i className="fa-solid fa-check text-[9px]"></i>}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h5 className="text-xs font-bold truncate" title={d.department_name}>{d.department_name}</h5>
                                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{d.company_name || "Company"}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                /* Multiple Mode (Full Length Grid without cramped scroll box!) */
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">
                                            Assigning user across multiple organizational workgroups. Select all that apply:
                                        </span>
                                        <span className="font-bold text-slate-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full text-indigo-700">
                                            <i className="fa-solid fa-circle-check text-indigo-600 mr-1.5"></i>
                                            {selectedMultiDepts.length} of {departmentsList.length} Departments Selected
                                        </span>
                                    </div>

                                    {/* Expansive Full-Length Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                                        {filteredAssignDepts.map((d) => {
                                            const isChecked = selectedMultiDepts.includes(d.id);
                                            const isPrimary = isChecked && selectedMultiDepts[0] === d.id;
                                            return (
                                                <div
                                                    key={d.id}
                                                    onClick={() => toggleMultiDept(d.id)}
                                                    className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 cursor-pointer transition-all select-none ${
                                                        isChecked
                                                            ? "bg-indigo-50/90 border-indigo-600 text-indigo-950 font-bold shadow-xs ring-1 ring-indigo-500/20"
                                                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs ${
                                                            isChecked ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                                                        }`}>
                                                            <i className="fa-solid fa-network-wired"></i>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {isPrimary && (
                                                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-200 text-indigo-800">
                                                                    Primary
                                                                </span>
                                                            )}
                                                            <div className={`w-4.5 h-4.5 rounded flex items-center justify-center text-[10px] border transition-colors ${
                                                                isChecked
                                                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                                                    : "border-slate-300 bg-white text-transparent"
                                                            }`}>
                                                                <i className="fa-solid fa-check"></i>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <h5 className="text-xs font-bold truncate" title={d.department_name}>{d.department_name}</h5>
                                                        <p className="text-[10px] text-slate-400 truncate mt-0.5">{d.company_name || "Company"}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {filteredAssignDepts.length === 0 && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
                                            <i className="fa-solid fa-magnifying-glass text-slate-400 text-lg mb-2"></i>
                                            <p className="text-xs font-semibold text-slate-600">No departments match your filter "{deptSearchQuery}".</p>
                                            <button
                                                type="button"
                                                onClick={() => setDeptSearchQuery("")}
                                                className="text-xs font-bold text-indigo-600 hover:underline mt-2 inline-block cursor-pointer"
                                            >
                                                Clear filter
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── SPLIT 2-COLUMN GRID: Step 3 (Inter-Dept) & Step 4 (Inter-Company) ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        
                        {/* ── CARD 3: Inter-Department Chat Permissions ────────────────────── */}
                        <div className="bg-white rounded-2xl p-4 sm:p-6 lg:p-7 border border-slate-200/90 shadow-xs space-y-4 sm:space-y-5">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center text-sm shadow-2xs">
                                        <i className="fa-solid fa-comments"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">3. Inter-Department Chat Permissions</h3>
                                        <p className="text-xs text-slate-500 font-normal">Cross-department messaging rules within the company</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                    Step 3
                                </span>
                            </div>

                            {/* 3 Scope Options Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div
                                    onClick={() => setChatScopeMode("OWN")}
                                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                        chatScopeMode === "OWN"
                                            ? "border-blue-600 bg-blue-50/60 shadow-xs"
                                            : "border-slate-200 bg-slate-50/40 hover:bg-white hover:border-slate-300"
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                                            <i className="fa-solid fa-building-user"></i>
                                        </div>
                                        <input
                                            type="radio"
                                            name="chatScopeMode"
                                            checked={chatScopeMode === "OWN"}
                                            onChange={() => setChatScopeMode("OWN")}
                                            className="h-4 w-4 text-blue-600 cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900">Own Dept Only</h4>
                                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Chats limited strictly within assigned department(s)</p>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setChatScopeMode("ALL")}
                                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                        chatScopeMode === "ALL"
                                            ? "border-emerald-600 bg-emerald-50/60 shadow-xs"
                                            : "border-slate-200 bg-slate-50/40 hover:bg-white hover:border-slate-300"
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                                            <i className="fa-solid fa-globe"></i>
                                        </div>
                                        <input
                                            type="radio"
                                            name="chatScopeMode"
                                            checked={chatScopeMode === "ALL"}
                                            onChange={() => setChatScopeMode("ALL")}
                                            className="h-4 w-4 text-emerald-600 cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900">All Departments</h4>
                                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Unrestricted messaging with any department across company</p>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setChatScopeMode("CUSTOM")}
                                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                        chatScopeMode === "CUSTOM"
                                            ? "border-purple-600 bg-purple-50/60 shadow-xs"
                                            : "border-slate-200 bg-slate-50/40 hover:bg-white hover:border-slate-300"
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
                                            <i className="fa-solid fa-network-wired"></i>
                                        </div>
                                        <input
                                            type="radio"
                                            name="chatScopeMode"
                                            checked={chatScopeMode === "CUSTOM"}
                                            onChange={() => setChatScopeMode("CUSTOM")}
                                            className="h-4 w-4 text-purple-600 cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900">Specific Depts</h4>
                                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Permit chats only with chosen partner departments</p>
                                    </div>
                                </div>
                            </div>

                            {/* Custom allowed departments selection */}
                            {chatScopeMode === "CUSTOM" && (
                                <div className="pt-3 border-t border-slate-100 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-slate-800">Allowed Chat Partner Departments:</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={selectAllChatDepts}
                                                className="text-xs font-bold text-purple-600 hover:text-purple-800 cursor-pointer"
                                            >
                                                Select All
                                            </button>
                                            <span className="text-slate-300">|</span>
                                            <button
                                                type="button"
                                                onClick={clearAllChatDepts}
                                                className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {filteredChatDepts.map((d) => {
                                            const isChecked = customChatDepts.includes(d.id);
                                            return (
                                                <div
                                                    key={d.id}
                                                    onClick={() => toggleCustomChatDept(d.id)}
                                                    className={`px-3 py-2 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all select-none ${
                                                        isChecked
                                                            ? "bg-purple-50 border-purple-300 text-purple-950 font-bold shadow-2xs"
                                                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isChecked}
                                                        onChange={() => {}}
                                                        className="h-4 w-4 text-purple-600 rounded border-slate-300 cursor-pointer shrink-0"
                                                    />
                                                    <span className="text-xs truncate">{d.department_name}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── CARD 4: Inter-Company Chat Permissions ───────────────────────── */}
                        <div className="bg-white rounded-2xl p-4 sm:p-6 lg:p-7 border border-slate-200/90 shadow-xs space-y-4 sm:space-y-5">
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/80 flex items-center justify-center text-sm shadow-2xs">
                                        <i className="fa-solid fa-city"></i>
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900">4. Inter-Company Chat Permissions</h3>
                                        <p className="text-xs text-slate-500 font-normal">Cross-company partner communications and boundaries</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                                    Step 4
                                </span>
                            </div>

                            {/* 3 Scope Options Cards */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div
                                    onClick={() => setInterCompanyMode("NONE")}
                                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                        interCompanyMode === "NONE"
                                            ? "border-blue-600 bg-blue-50/60 shadow-xs"
                                            : "border-slate-200 bg-slate-50/40 hover:bg-white hover:border-slate-300"
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                                            <i className="fa-solid fa-building-shield"></i>
                                        </div>
                                        <input
                                            type="radio"
                                            name="interCompanyMode"
                                            checked={interCompanyMode === "NONE"}
                                            onChange={() => setInterCompanyMode("NONE")}
                                            className="h-4 w-4 text-blue-600 cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900">Own Company Only</h4>
                                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Chats limited strictly within assigned entity</p>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setInterCompanyMode("ALL")}
                                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                        interCompanyMode === "ALL"
                                            ? "border-emerald-600 bg-emerald-50/60 shadow-xs"
                                            : "border-slate-200 bg-slate-50/40 hover:bg-white hover:border-slate-300"
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                                            <i className="fa-solid fa-earth-americas"></i>
                                        </div>
                                        <input
                                            type="radio"
                                            name="interCompanyMode"
                                            checked={interCompanyMode === "ALL"}
                                            onChange={() => setInterCompanyMode("ALL")}
                                            className="h-4 w-4 text-emerald-600 cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900">All Entities</h4>
                                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Unrestricted messaging across all partner companies</p>
                                    </div>
                                </div>

                                <div
                                    onClick={() => setInterCompanyMode("CUSTOM")}
                                    className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                                        interCompanyMode === "CUSTOM"
                                            ? "border-purple-600 bg-purple-50/60 shadow-xs"
                                            : "border-slate-200 bg-slate-50/40 hover:bg-white hover:border-slate-300"
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center text-xs">
                                            <i className="fa-solid fa-sitemap"></i>
                                        </div>
                                        <input
                                            type="radio"
                                            name="interCompanyMode"
                                            checked={interCompanyMode === "CUSTOM"}
                                            onChange={() => setInterCompanyMode("CUSTOM")}
                                            className="h-4 w-4 text-purple-600 cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-900">Specific Entities</h4>
                                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Select authorized external corporate partners</p>
                                    </div>
                                </div>
                            </div>

                            {/* Specific Companies and Department Whitelist */}
                            {interCompanyMode === "CUSTOM" && (
                                <div className="pt-3 border-t border-slate-100 space-y-4">
                                    {/* Companies checklist */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-slate-800">1. Allowed Partner Companies:</span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={selectAllInterCompanies}
                                                    className="text-xs font-bold text-purple-600 hover:text-purple-800 cursor-pointer"
                                                >
                                                    Select All
                                                </button>
                                                <span className="text-slate-300">|</span>
                                                <button
                                                    type="button"
                                                    onClick={clearAllInterCompanies}
                                                    className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {companiesList.map((c) => {
                                                const isCurrentPrimary = String(c.id) === String(newUserForm.companyId);
                                                const isChecked = selectedInterCompanies.includes(c.id);
                                                return (
                                                    <div
                                                        key={c.id}
                                                        onClick={() => toggleInterCompany(c.id)}
                                                        className={`px-3 py-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all select-none ${
                                                            isChecked
                                                                ? "bg-purple-50 border-purple-300 text-purple-950 font-bold shadow-2xs"
                                                                : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => {}}
                                                                className="h-4 w-4 text-purple-600 rounded border-slate-300 cursor-pointer shrink-0"
                                                            />
                                                            <span className="text-xs font-semibold truncate">{c.company_name}</span>
                                                        </div>
                                                        {isCurrentPrimary && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 shrink-0">
                                                                Home
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Department Scope in Partner Companies */}
                                    <div className="pt-2 border-t border-slate-100">
                                        <span className="block text-xs font-bold text-slate-800 mb-2">
                                            2. Department Scope in Partner Companies:
                                        </span>
                                        <div className="grid grid-cols-2 gap-2 mb-3">
                                            <div
                                                onClick={() => setInterCompanyDeptScope("ALL")}
                                                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2 ${
                                                    interCompanyDeptScope === "ALL"
                                                        ? "bg-purple-50 border-purple-300 text-purple-900 font-bold"
                                                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="interCompanyDeptScope"
                                                    checked={interCompanyDeptScope === "ALL"}
                                                    onChange={() => setInterCompanyDeptScope("ALL")}
                                                    className="h-4 w-4 text-purple-600 cursor-pointer"
                                                />
                                                <span className="text-xs font-semibold">All Departments</span>
                                            </div>

                                            <div
                                                onClick={() => setInterCompanyDeptScope("CUSTOM")}
                                                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2 ${
                                                    interCompanyDeptScope === "CUSTOM"
                                                        ? "bg-purple-50 border-purple-300 text-purple-900 font-bold"
                                                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                                }`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="interCompanyDeptScope"
                                                    checked={interCompanyDeptScope === "CUSTOM"}
                                                    onChange={() => setInterCompanyDeptScope("CUSTOM")}
                                                    className="h-4 w-4 text-purple-600 cursor-pointer"
                                                />
                                                <span className="text-xs font-semibold">Specific Departments</span>
                                            </div>
                                        </div>

                                        {interCompanyDeptScope === "CUSTOM" && (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                                                {departmentsList.map((d) => {
                                                    const isChecked = selectedInterCompanyDepts.includes(d.id);
                                                    return (
                                                        <div
                                                            key={d.id}
                                                            onClick={() => toggleInterCompanyDept(d.id)}
                                                            className={`px-3 py-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all select-none ${
                                                                isChecked
                                                                    ? "bg-purple-50 border-purple-300 text-purple-950 font-bold shadow-2xs"
                                                                    : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
                                                            }`}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => {}}
                                                                className="h-4 w-4 text-purple-600 rounded border-slate-300 cursor-pointer"
                                                            />
                                                            <span className="text-xs truncate">{d.department_name}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── STICKY BOTTOM ACTION BAR: Provides fast submit & real-time summary ─ */}
                    <div className="sticky bottom-4 z-40 bg-white/95 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center text-sm shrink-0">
                                {newUserForm.name ? newUserForm.name.charAt(0).toUpperCase() : <i className="fa-solid fa-user"></i>}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <strong className="text-sm font-bold text-slate-900 truncate">
                                        {newUserForm.name || "New Employee Account"}
                                    </strong>
                                    {newUserForm.username && (
                                        <span className="text-xs font-mono text-slate-500">
                                            (@{newUserForm.username})
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5 flex-wrap">
                                    <span>🏢 {selectedCompanyObj?.company_name || "Company"}</span>
                                    <span>&bull;</span>
                                    <span>🛡️ {selectedTypeObj?.type_name || "Role"}</span>
                                    <span>&bull;</span>
                                    <span className="text-indigo-600 font-bold">
                                        🏬 {deptAssignmentMode === "SINGLE" ? "1 Dept" : `${selectedMultiDepts.length} Depts Assigned`}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto justify-end shrink-0">
                            <button
                                type="button"
                                onClick={() => navigate("/peoples")}
                                className="flex-1 sm:flex-initial px-4 sm:px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition-all cursor-pointer shadow-2xs text-center justify-center"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={creatingUser}
                                className="flex-1 sm:flex-initial px-5 sm:px-7 py-2.5 rounded-xl bg-[#17365D] hover:bg-[#102642] text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                            >
                                {creatingUser ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Creating Account...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-user-plus text-xs"></i>
                                        <span>Create User Account</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </main>
        </div>
    );
}
