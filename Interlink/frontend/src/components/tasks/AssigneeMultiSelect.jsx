import React, { useState, useMemo, useRef, useEffect } from "react";

/**
 * AssigneeMultiSelect Component
 * Multi-select dropdown for task assignees with fast live search,
 * company filter, and department filter.
 */
export default function AssigneeMultiSelect({
    users = [],
    selectedUserIds = [],
    onChange = () => {},
    companies = [],
    departments = [],
    label = "Assignees",
    placeholder = "Select assignees..."
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCompany, setSelectedCompany] = useState("");
    const [selectedDepartment, setSelectedDepartment] = useState("");

    const containerRef = useRef(null);
    const searchInputRef = useRef(null);

    // Close on outside click or Escape key
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isOpen) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    // Auto-focus search input when opening
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 50);
        }
    }, [isOpen]);

    // Fast lookup set of selected IDs
    const selectedSet = useMemo(() => {
        return new Set((selectedUserIds || []).map((id) => Number(id)));
    }, [selectedUserIds]);

    // Derive companies list from props or unique user company names
    const availableCompanies = useMemo(() => {
        if (companies && companies.length > 0) {
            return companies.map(c => typeof c === "string" ? c : c.name).filter(Boolean);
        }
        const set = new Set();
        users.forEach(u => {
            if (u.company_name) set.add(u.company_name);
        });
        return Array.from(set);
    }, [companies, users]);

    // Derive departments list from props or unique user department names
    const availableDepartments = useMemo(() => {
        if (departments && departments.length > 0) {
            return departments.map(d => typeof d === "string" ? d : (d.department_name || d.name)).filter(Boolean);
        }
        const set = new Set();
        users.forEach(u => {
            if (u.department_name) set.add(u.department_name);
        });
        return Array.from(set);
    }, [departments, users]);

    // Selected users details list
    const selectedUsers = useMemo(() => {
        return users.filter(u => selectedSet.has(Number(u.id)));
    }, [users, selectedSet]);

    // Filtered users matching search query, company, and department
    const filteredUsers = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return users.filter(u => {
            // Text search match on name, username, or email
            if (q) {
                const name = (u.name || "").toLowerCase();
                const username = (u.username || "").toLowerCase();
                const email = (u.email || "").toLowerCase();
                if (!name.includes(q) && !username.includes(q) && !email.includes(q)) {
                    return false;
                }
            }

            // Company filter match
            if (selectedCompany) {
                const comp = (u.company_name || "").toLowerCase();
                if (comp !== selectedCompany.toLowerCase()) {
                    return false;
                }
            }

            // Department filter match
            if (selectedDepartment) {
                const dept = (u.department_name || "").toLowerCase();
                if (dept !== selectedDepartment.toLowerCase()) {
                    return false;
                }
            }

            return true;
        });
    }, [users, searchQuery, selectedCompany, selectedDepartment]);

    // Toggle single user
    const handleToggleUser = (userId) => {
        const numId = Number(userId);
        if (selectedSet.has(numId)) {
            onChange(selectedUserIds.filter(id => Number(id) !== numId));
        } else {
            onChange([...selectedUserIds, numId]);
        }
    };

    // Remove single selected user
    const handleRemoveUser = (e, userId) => {
        e.stopPropagation();
        const numId = Number(userId);
        onChange(selectedUserIds.filter(id => Number(id) !== numId));
    };

    // Select all currently filtered users
    const handleSelectAllFiltered = () => {
        const filteredIds = filteredUsers.map(u => Number(u.id));
        const combined = Array.from(new Set([...selectedUserIds.map(Number), ...filteredIds]));
        onChange(combined);
    };

    // Deselect all currently filtered users
    const handleDeselectAllFiltered = () => {
        const filteredIdSet = new Set(filteredUsers.map(u => Number(u.id)));
        onChange(selectedUserIds.filter(id => !filteredIdSet.has(Number(id))));
    };

    const hasActiveFilters = Boolean(searchQuery.trim() || selectedCompany || selectedDepartment);

    const handleResetFilters = () => {
        setSearchQuery("");
        setSelectedCompany("");
        setSelectedDepartment("");
    };

    const isAllFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedSet.has(Number(u.id)));

    return (
        <div className="relative w-full space-y-1.5" ref={containerRef}>
            {label && (
                <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-[#17212F] uppercase tracking-wider">
                        {label} {selectedUserIds.length > 0 && `(${selectedUserIds.length})`}
                    </label>
                    {selectedUserIds.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            className="text-[11px] text-slate-400 hover:text-red-500 font-semibold cursor-pointer transition-colors"
                        >
                            Clear All
                        </button>
                    )}
                </div>
            )}

            {/* Trigger Button & Selected Chips View */}
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full min-h-[42px] px-3 py-1.5 bg-white border rounded-xl text-left cursor-pointer transition-all flex items-center justify-between gap-2 shadow-2xs ${
                    isOpen
                        ? "border-[#2878C7] ring-2 ring-blue-500/20 shadow-sm"
                        : "border-slate-200 hover:border-slate-300"
                }`}
            >
                {selectedUsers.length === 0 ? (
                    <span className="text-xs text-slate-400 select-none">{placeholder}</span>
                ) : (
                    <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0 py-0.5">
                        {selectedUsers.map((u) => (
                            <span
                                key={u.id}
                                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200/80 text-blue-800 text-xs font-semibold shadow-2xs animate-in fade-in duration-100"
                            >
                                <span className="w-4 h-4 rounded-full bg-[#17365D] text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                                    {(u.name || "U")[0].toUpperCase()}
                                </span>
                                <span className="truncate max-w-[120px]">{u.name}</span>
                                <button
                                    type="button"
                                    onClick={(e) => handleRemoveUser(e, u.id)}
                                    className="text-blue-500 hover:text-blue-800 hover:bg-blue-100 rounded p-0.5 transition-colors cursor-pointer"
                                    title={`Remove ${u.name}`}
                                >
                                    <i className="fa-solid fa-xmark text-[10px]"></i>
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-1.5 text-slate-400 shrink-0">
                    <span className="text-[11px] font-semibold text-slate-400">
                        {selectedUserIds.length > 0 ? `${selectedUserIds.length} assigned` : ""}
                    </span>
                    <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-150 ${isOpen ? "rotate-180 text-blue-600" : ""}`}></i>
                </div>
            </div>

            {/* Dropdown Popover */}
            {isOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* Header: Search and Filter Controls */}
                    <div className="p-3 bg-slate-50 border-b border-slate-200/80 space-y-2.5">
                        {/* Search Input */}
                        <div className="relative">
                            <i className="fa-solid fa-magnifying-glass text-xs text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search member by name or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                                >
                                    <i className="fa-solid fa-xmark text-xs"></i>
                                </button>
                            )}
                        </div>

                        {/* Filters Row: Company and Department */}
                        <div className="grid grid-cols-2 gap-2">
                            {/* Company Filter */}
                            <div>
                                <select
                                    value={selectedCompany}
                                    onChange={(e) => setSelectedCompany(e.target.value)}
                                    className="w-full text-[11px] font-medium px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer truncate"
                                >
                                    <option value="">All Companies</option>
                                    {availableCompanies.map((c, idx) => (
                                        <option key={idx} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Department Filter */}
                            <div>
                                <select
                                    value={selectedDepartment}
                                    onChange={(e) => setSelectedDepartment(e.target.value)}
                                    className="w-full text-[11px] font-medium px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer truncate"
                                >
                                    <option value="">All Departments</option>
                                    {availableDepartments.map((d, idx) => (
                                        <option key={idx} value={d}>{d}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Action Bar / Status */}
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                            <div className="flex items-center gap-1.5">
                                <span>
                                    {filteredUsers.length} member{filteredUsers.length === 1 ? "" : "s"}
                                </span>
                                {hasActiveFilters && (
                                    <button
                                        type="button"
                                        onClick={handleResetFilters}
                                        className="text-blue-600 hover:underline font-semibold cursor-pointer ml-1"
                                    >
                                        Reset Filters
                                    </button>
                                )}
                            </div>

                            {filteredUsers.length > 0 && (
                                <button
                                    type="button"
                                    onClick={isAllFilteredSelected ? handleDeselectAllFiltered : handleSelectAllFiltered}
                                    className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                                >
                                    {isAllFilteredSelected ? "Deselect Filtered" : "Select All Filtered"}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Users List */}
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 p-1">
                        {filteredUsers.length === 0 ? (
                            <div className="py-6 text-center text-xs text-slate-400">
                                <i className="fa-solid fa-user-xmark text-lg text-slate-300 block mb-1.5"></i>
                                No team members found matching current filters.
                            </div>
                        ) : (
                            filteredUsers.map((u) => {
                                const isSelected = selectedSet.has(Number(u.id));
                                return (
                                    <div
                                        key={u.id}
                                        onClick={() => handleToggleUser(u.id)}
                                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors ${
                                            isSelected
                                                ? "bg-blue-50/80 text-blue-950 font-medium"
                                                : "hover:bg-slate-50 text-slate-700"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {/* Custom Checkbox */}
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                                isSelected
                                                    ? "bg-[#17365D] border-[#17365D] text-white"
                                                    : "border-slate-300 bg-white"
                                            }`}>
                                                {isSelected && <i className="fa-solid fa-check text-[9px]"></i>}
                                            </div>

                                            {/* Avatar */}
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#17365D] to-[#2878C7] text-white flex items-center justify-center font-bold text-[11px] shrink-0 shadow-2xs">
                                                {(u.name || "U")[0].toUpperCase()}
                                            </div>

                                            {/* Name & Details */}
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-slate-800 truncate">{u.name}</span>
                                                    {u.role && (
                                                        <span className="text-[10px] text-slate-400 capitalize">({u.role})</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                                                    {u.company_name && (
                                                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200/80">
                                                            <i className="fa-solid fa-building text-[8px] mr-1 text-slate-400"></i>
                                                            {u.company_name}
                                                        </span>
                                                    )}
                                                    {u.department_name && (
                                                        <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200/60">
                                                            <i className="fa-solid fa-sitemap text-[8px] mr-1 text-blue-400"></i>
                                                            {u.department_name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {isSelected && (
                                            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider shrink-0 ml-2">
                                                Assigned
                                            </span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Popover Footer */}
                    <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-500">
                            {selectedUserIds.length} of {users.length} assigned
                        </span>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-3 py-1 bg-[#17365D] hover:bg-[#102642] text-white text-[11px] font-bold rounded-lg shadow-2xs cursor-pointer transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
