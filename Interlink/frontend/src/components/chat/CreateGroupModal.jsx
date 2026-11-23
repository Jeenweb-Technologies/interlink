import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { createGroupChat, searchCoworkers } from "../../api/chatApi";
import { getDepartments } from "../../api/departmentApi";
import { getCompanies } from "../../api/companyApi";
import { isUserAdmin } from "../../utils/roleUtils";

export default function CreateGroupModal({ onClose, onGroupCreated }) {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const isAdmin = isUserAdmin(user);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [groupType, setGroupType] = useState("COMPANY"); // 'COMPANY' | 'CUSTOM'

    // Companies & Departments data
    const [allCompanies, setAllCompanies] = useState([]);
    const [allDepartments, setAllDepartments] = useState([]);
    const [selectedCompanyIds, setSelectedCompanyIds] = useState([]);
    const [selectedDepartmentIds, setSelectedDepartmentIds] = useState([]);
    const [allDeptsInCompanySelected, setAllDeptsInCompanySelected] = useState(true);

    // Standard department select (for CUSTOM mode)
    const [customDepartmentId, setCustomDepartmentId] = useState("");

    // Message permissions
    const [whoCanPost, setWhoCanPost] = useState("ALL_MEMBERS"); // ALL_MEMBERS | SELECTED_MEMBERS | ADMIN_ONLY
    const [allowedPosterIds, setAllowedPosterIds] = useState([]);

    // Members search & selection
    const [searchTerm, setSearchTerm] = useState("");
    const [coworkers, setCoworkers] = useState([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [isLoadingUsers, setIsLoadingUsers] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 1. Load Companies and Departments accessible to the user
    useEffect(() => {
        let isMounted = true;
        const loadMetadata = async () => {
            try {
                // Fetch companies
                let compList = [];
                try {
                    const compRes = await getCompanies(false);
                    compList = compRes?.companies || compRes?.data || (Array.isArray(compRes) ? compRes : []);
                } catch (_) {}

                // Fetch departments
                let deptList = [];
                try {
                    const deptRes = await getDepartments(false);
                    deptList = deptRes?.departments || deptRes?.data || (Array.isArray(deptRes) ? deptRes : []);
                } catch (_) {}

                if (!isMounted) return;

                // Resolve accessible companies
                let userAllowedCompanies = [];
                if (isAdmin || user.can_chat_all_companies) {
                    userAllowedCompanies = compList;
                } else {
                    const ownCompId = user.company_id ? Number(user.company_id) : null;
                    const crossCompIds = (user.allowed_chat_companies?.companyIds || []).map(Number);
                    userAllowedCompanies = compList.filter(c =>
                        (ownCompId && c.id === ownCompId) || crossCompIds.includes(c.id)
                    );
                    if (userAllowedCompanies.length === 0 && user.company_name) {
                        userAllowedCompanies = [{
                            id: ownCompId || 1,
                            company_name: user.company_name,
                            company_code: user.company_code || 'MAIN'
                        }];
                    }
                }
                setAllCompanies(userAllowedCompanies);

                // Default selected company: user's company or first available
                const initialCompIds = userAllowedCompanies.length > 0 ? [userAllowedCompanies[0].id] : [];
                setSelectedCompanyIds(initialCompIds);

                // Resolve accessible departments
                let userAllowedDepts = [];
                if (isAdmin || user.can_chat_all_departments) {
                    userAllowedDepts = deptList;
                } else {
                    const userDeptIds = (user.departments || []).map(d => Number(d.department_id || d.id));
                    const crossDeptIds = (user.allowed_chat_departments || []).map(Number);
                    const allowedIds = new Set([...userDeptIds, ...crossDeptIds]);
                    userAllowedDepts = deptList.filter(d => allowedIds.has(Number(d.id)));
                    if (userAllowedDepts.length === 0 && Array.isArray(user.departments)) {
                        userAllowedDepts = user.departments.map(d => ({
                            id: d.department_id || d.id,
                            department_name: d.department_name || d.name,
                            company_id: d.company_id || null
                        }));
                    }
                }
                setAllDepartments(userAllowedDepts);

                if (userAllowedDepts.length > 0) {
                    setCustomDepartmentId(userAllowedDepts[0].id);
                }
            } catch (error) {
                console.error("Failed to load companies/departments:", error);
            }
        };

        loadMetadata();
        return () => { isMounted = false; };
    }, [isAdmin]);

    // Available departments filtered by currently selected companies
    const availableDepartmentsInScope = useMemo(() => {
        if (selectedCompanyIds.length === 0) return allDepartments;
        return allDepartments.filter(d =>
            !d.company_id || selectedCompanyIds.includes(Number(d.company_id))
        );
    }, [allDepartments, selectedCompanyIds]);

    // When company selection changes, default to all departments in scope
    useEffect(() => {
        if (allDeptsInCompanySelected) {
            setSelectedDepartmentIds(availableDepartmentsInScope.map(d => d.id));
        }
    }, [availableDepartmentsInScope, allDeptsInCompanySelected]);

    // 2. Fetch Coworkers based on Company & Department scope
    useEffect(() => {
        let isMounted = true;
        const fetchScopeUsers = async () => {
            try {
                setIsLoadingUsers(true);
                const params = {};

                if (groupType === "COMPANY") {
                    if (selectedCompanyIds.length > 0) {
                        params.companyIds = selectedCompanyIds;
                    }
                    if (!allDeptsInCompanySelected && selectedDepartmentIds.length > 0) {
                        params.departmentIds = selectedDepartmentIds;
                    }
                } else if (customDepartmentId) {
                    params.departmentId = customDepartmentId;
                }

                const res = await searchCoworkers(searchTerm, params);
                if (isMounted) {
                    const list = res?.coworkers || res?.data || (Array.isArray(res) ? res : []);
                    const valid = Array.isArray(list) ? list : [];
                    setCoworkers(valid);

                    // Auto-select all matching members by default if currently empty
                    if (selectedMemberIds.length === 0 && valid.length > 0) {
                        const allIds = valid.map(u => u.id);
                        setSelectedMemberIds(allIds);
                        setAllowedPosterIds(allIds);
                    }
                }
            } catch (error) {
                console.error("Failed to load coworkers:", error);
            } finally {
                if (isMounted) setIsLoadingUsers(false);
            }
        };

        const timer = setTimeout(fetchScopeUsers, 200);
        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [groupType, selectedCompanyIds, selectedDepartmentIds, allDeptsInCompanySelected, customDepartmentId, searchTerm]);

    // Toggle company selection
    const toggleCompany = (cId) => {
        setSelectedCompanyIds(prev => {
            if (prev.includes(cId)) {
                if (prev.length === 1) return prev; // Keep at least one
                return prev.filter(id => id !== cId);
            } else {
                return [...prev, cId];
            }
        });
    };

    // Toggle department selection in company-wise mode
    const toggleDepartment = (dId) => {
        setAllDeptsInCompanySelected(false);
        setSelectedDepartmentIds(prev => {
            if (prev.includes(dId)) {
                return prev.filter(id => id !== dId);
            } else {
                return [...prev, dId];
            }
        });
    };

    // Toggle individual member
    const toggleMember = (uId) => {
        setSelectedMemberIds(prev => {
            const next = prev.includes(uId) ? prev.filter(id => id !== uId) : [...prev, uId];
            return next;
        });
        setAllowedPosterIds(prev => {
            return prev.includes(uId) ? prev.filter(id => id !== uId) : [...prev, uId];
        });
    };

    // Select/Deselect all members in current scope
    const isAllMembersSelected = coworkers.length > 0 && selectedMemberIds.length >= coworkers.length;

    const handleToggleSelectAllMembers = () => {
        if (isAllMembersSelected) {
            setSelectedMemberIds([]);
            setAllowedPosterIds([]);
        } else {
            const allIds = coworkers.map(u => u.id);
            setSelectedMemberIds(allIds);
            setAllowedPosterIds(allIds);
        }
    };

    // Toggle poster permission
    const toggleCanPost = (uId, e) => {
        if (e) e.stopPropagation();
        setAllowedPosterIds(prev =>
            prev.includes(uId) ? prev.filter(id => id !== uId) : [...prev, uId]
        );
    };

    // Submit group creation
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("Please enter a group name");
            return;
        }

        if (groupType === "COMPANY" && selectedCompanyIds.length === 0) {
            toast.error("Please select at least one company");
            return;
        }

        if (selectedMemberIds.length === 0) {
            toast.error("Please select at least one member for the group");
            return;
        }

        try {
            setIsSubmitting(true);

            const payload = {
                title: title.trim(),
                description: description.trim() || null,
                memberIds: selectedMemberIds,
                whoCanPost,
                isCompanyGroup: groupType === "COMPANY",
                companyIds: groupType === "COMPANY" ? selectedCompanyIds : undefined,
                departmentIds: groupType === "COMPANY"
                    ? (allDeptsInCompanySelected ? availableDepartmentsInScope.map(d => d.id) : selectedDepartmentIds)
                    : (customDepartmentId ? [Number(customDepartmentId)] : undefined),
                departmentId: groupType === "CUSTOM" && customDepartmentId ? Number(customDepartmentId) : undefined,
                allowedMemberIds: whoCanPost === "SELECTED_MEMBERS" ? allowedPosterIds : undefined
            };

            const res = await createGroupChat(payload);
            toast.success("Group created successfully!");
            if (onGroupCreated) onGroupCreated(res.data || res.conversation);
            onClose();
        } catch (error) {
            console.error("Failed to create group:", error);
            toast.error(error.response?.data?.message || "Failed to create group");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
                
                {/* ── Modal Header ── */}
                <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#2D333B] text-[#ED1C28] border border-slate-700/60 flex items-center justify-center text-xs shadow-2xs font-bold">
                            <i className="fa-solid fa-users"></i>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm tracking-tight">Create Group</h3>
                            <p className="text-[11px] text-slate-500 font-normal">
                                Company-wise or department-scoped team channels
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-7 h-7 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors"
                    >
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                {/* ── Form Body ── */}
                <form onSubmit={handleCreate} className="p-5 space-y-4 overflow-y-auto flex-1 custom-chat-scrollbar text-xs">
                    
                    {/* 1. Group Name & Description */}
                    <div className="space-y-2">
                        <div>
                            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                                Group Name *
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. Epoxy Sales & Operations Core"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#ED1C28] bg-slate-50/80 focus:bg-white transition-colors"
                                required
                            />
                        </div>
                        <div>
                            <input
                                type="text"
                                placeholder="Short description or channel goal (optional)"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700 focus:outline-none focus:border-[#ED1C28] bg-slate-50/60 focus:bg-white transition-colors"
                            />
                        </div>
                    </div>

                    {/* 2. Group Scope Mode Selection */}
                    <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                            Group Type & Scope
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                                type="button"
                                onClick={() => setGroupType("COMPANY")}
                                className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                    groupType === "COMPANY"
                                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                <i className="fa-solid fa-building text-[11px] text-emerald-600"></i>
                                <span>Company-Wise Group</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setGroupType("CUSTOM")}
                                className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                                    groupType === "CUSTOM"
                                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200/60"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                <i className="fa-solid fa-layer-group text-[11px] text-indigo-600"></i>
                                <span>Single Unit / Custom</span>
                            </button>
                        </div>
                    </div>

                    {/* 3. Company-Wise Scope Options */}
                    {groupType === "COMPANY" ? (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                            
                            {/* Companies Multi-Select */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                                        <i className="fa-solid fa-building text-slate-500 text-[10px]"></i>
                                        Target Company / Companies ({selectedCompanyIds.length} selected)
                                    </span>
                                    {allCompanies.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedCompanyIds.length === allCompanies.length) {
                                                    setSelectedCompanyIds([allCompanies[0].id]);
                                                } else {
                                                    setSelectedCompanyIds(allCompanies.map(c => c.id));
                                                }
                                            }}
                                            className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                                        >
                                            {selectedCompanyIds.length === allCompanies.length ? "Reset Selection" : "Select All Companies"}
                                        </button>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                                    {allCompanies.map((c) => {
                                        const isChecked = selectedCompanyIds.includes(c.id);
                                        return (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onClick={() => toggleCompany(c.id)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                                                    isChecked
                                                        ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs"
                                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                                                }`}
                                            >
                                                <i className={`fa-solid ${isChecked ? "fa-circle-check text-emerald-600" : "fa-circle text-slate-300"} text-[10px]`}></i>
                                                <span>{c.company_name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Departments Scope within Selected Companies */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1">
                                        <i className="fa-solid fa-layer-group text-slate-500 text-[10px]"></i>
                                        Departments in Scope
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAllDeptsInCompanySelected(!allDeptsInCompanySelected);
                                            if (!allDeptsInCompanySelected) {
                                                setSelectedDepartmentIds(availableDepartmentsInScope.map(d => d.id));
                                            }
                                        }}
                                        className={`text-[10px] font-bold cursor-pointer transition-colors ${
                                            allDeptsInCompanySelected ? "text-emerald-700" : "text-blue-600 hover:underline"
                                        }`}
                                    >
                                        {allDeptsInCompanySelected ? "✓ All Departments Included" : "Include All Departments"}
                                    </button>
                                </div>

                                {!allDeptsInCompanySelected && (
                                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto no-scrollbar pt-1">
                                        {availableDepartmentsInScope.map((d) => {
                                            const isChecked = selectedDepartmentIds.includes(d.id);
                                            return (
                                                <button
                                                    key={d.id}
                                                    type="button"
                                                    onClick={() => toggleDepartment(d.id)}
                                                    className={`px-2 py-0.8 rounded-md text-[11px] font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
                                                        isChecked
                                                            ? "bg-indigo-50 border-indigo-300 text-indigo-800 shadow-2xs font-semibold"
                                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                                                    }`}
                                                >
                                                    <i className={`fa-solid ${isChecked ? "fa-check text-indigo-600" : "fa-plus text-slate-300"} text-[9px]`}></i>
                                                    <span>{d.department_name || d.name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Custom / Single Department select */
                        <div>
                            <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1">
                                Primary Unit / Department
                            </label>
                            <select
                                value={customDepartmentId}
                                onChange={(e) => setCustomDepartmentId(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#ED1C28] bg-slate-50 focus:bg-white cursor-pointer"
                            >
                                <option value="">Open / Cross-Functional</option>
                                {allDepartments.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.department_name || d.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* 4. Who Can Send Messages? */}
                    <div>
                        <label className="block font-bold text-slate-700 uppercase tracking-wider text-[10px] mb-1.5">
                            Who Can Send Messages?
                        </label>
                        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                                type="button"
                                onClick={() => setWhoCanPost("ALL_MEMBERS")}
                                className={`py-1.5 rounded-md font-bold text-xs transition-all cursor-pointer ${
                                    whoCanPost === "ALL_MEMBERS"
                                        ? "bg-white text-slate-900 shadow-2xs"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                All Members
                            </button>
                            <button
                                type="button"
                                onClick={() => setWhoCanPost("SELECTED_MEMBERS")}
                                className={`py-1.5 rounded-md font-bold text-xs transition-all cursor-pointer ${
                                    whoCanPost === "SELECTED_MEMBERS"
                                        ? "bg-white text-slate-900 shadow-2xs"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                Selected
                            </button>
                            <button
                                type="button"
                                onClick={() => setWhoCanPost("ADMIN_ONLY")}
                                className={`py-1.5 rounded-md font-bold text-xs transition-all cursor-pointer ${
                                    whoCanPost === "ADMIN_ONLY"
                                        ? "bg-white text-slate-900 shadow-2xs"
                                        : "text-slate-500 hover:text-slate-900"
                                }`}
                            >
                                Admins Only
                            </button>
                        </div>
                    </div>

                    {/* 5. Members List in Scope with Search & Select All */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="font-bold text-slate-700 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                                <span>Members in Scope</span>
                                <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold">
                                    {selectedMemberIds.length} / {coworkers.length} selected
                                </span>
                            </label>

                            {coworkers.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleToggleSelectAllMembers}
                                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
                                >
                                    <i className={`fa-solid ${isAllMembersSelected ? "fa-square-minus text-amber-600" : "fa-square-check text-blue-600"}`}></i>
                                    <span>{isAllMembersSelected ? "Deselect All" : "Select All in Scope"}</span>
                                </button>
                            )}
                        </div>

                        <div className="relative mb-2">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-xs"></i>
                            <input
                                type="text"
                                placeholder="Search coworkers in this scope..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:border-[#ED1C28]"
                            />
                        </div>

                        <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white custom-chat-scrollbar">
                            {isLoadingUsers ? (
                                <div className="p-5 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                                    <i className="fa-solid fa-circle-notch fa-spin text-slate-500"></i>
                                    <span>Loading coworkers in scope...</span>
                                </div>
                            ) : coworkers.length === 0 ? (
                                <div className="p-6 text-center text-slate-400 text-xs">
                                    No active coworkers found for selected company & department scope.
                                </div>
                            ) : (
                                coworkers.map((u) => {
                                    const isSelected = selectedMemberIds.includes(u.id);
                                    const canPost = allowedPosterIds.includes(u.id);

                                    return (
                                        <div
                                            key={u.id}
                                            className={`p-2.5 flex items-center justify-between gap-2 transition-colors ${
                                                isSelected ? "bg-red-50/20" : "hover:bg-slate-50/70"
                                            }`}
                                        >
                                            {/* Member Name + Details */}
                                            <div
                                                onClick={() => toggleMember(u.id)}
                                                className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleMember(u.id)}
                                                    className="w-4 h-4 rounded text-[#ED1C28] focus:ring-[#ED1C28] border-slate-300 cursor-pointer shrink-0"
                                                />
                                                <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0">
                                                    {(u.name || u.username || "U")[0].toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 truncate">
                                                        <span className="font-semibold text-slate-900 truncate">
                                                            {u.name || u.username}
                                                        </span>
                                                        {u.role === 'admin' && (
                                                            <span className="px-1 py-0.1 rounded bg-purple-100 text-purple-700 text-[8px] font-bold">
                                                                ADMIN
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate">
                                                        {u.company_name && (
                                                            <span className="text-emerald-700 font-medium">
                                                                {u.company_name}
                                                            </span>
                                                        )}
                                                        {u.department_name && u.department_name !== 'General' && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-slate-600 truncate">
                                                                    {u.department_name}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Button to let them message when whoCanPost === "SELECTED_MEMBERS" */}
                                            {isSelected && whoCanPost === "SELECTED_MEMBERS" && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => toggleCanPost(u.id, e)}
                                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                                                        canPost
                                                            ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                                                            : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                                                    }`}
                                                >
                                                    {canPost ? "Can Message" : "Read Only"}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || selectedMemberIds.length === 0}
                            className="px-5 py-2 rounded-xl bg-[#ED1C28] hover:bg-[#C5131E] disabled:opacity-40 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                        >
                            {isSubmitting && <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>}
                            <span>Create {groupType === "COMPANY" ? "Company Group" : "Group"}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
