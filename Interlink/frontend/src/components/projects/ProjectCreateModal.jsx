import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { createProject } from "../../api/projectApi";
import { getTaskMetadata } from "../../api/taskApi";
import AssigneeMultiSelect from "../tasks/AssigneeMultiSelect";

export default function ProjectCreateModal({ isOpen, onClose, onCreated, parentProject = null }) {
    const [activeTab, setActiveTab] = useState("basic"); // 'basic' | 'finance' | 'notes_details'
    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [description, setDescription] = useState("");
    const [notes, setNotes] = useState("");
    const [keyDeliverables, setKeyDeliverables] = useState("");
    const [risksConstraints, setRisksConstraints] = useState("");
    const [priority, setPriority] = useState("medium");
    const [ownerId, setOwnerId] = useState("");
    const [sponsorId, setSponsorId] = useState("");
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [estimatedBudget, setEstimatedBudget] = useState("");
    const [approvedBudget, setApprovedBudget] = useState("");
    const [isBudgetApproved, setIsBudgetApproved] = useState(false);

    // Initialize/prefill state when modal opens or parentProject changes
    useEffect(() => {
        if (isOpen) {
            setActiveTab("basic");
            if (parentProject) {
                setName("");
                setCode(parentProject.code ? `${parentProject.code}-SUB` : "SUB-");
                setDescription("");
                setNotes("");
                setKeyDeliverables("");
                setRisksConstraints("");
                setPriority(parentProject.priority || "medium");
                setOwnerId(parentProject.owner_id || "");
                setSponsorId(parentProject.sponsor_id || "");
                setStartDate(parentProject.start_date ? parentProject.start_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
                setEndDate(parentProject.end_date ? parentProject.end_date.slice(0, 10) : "");
                setCurrency(parentProject.currency || "USD");
                setEstimatedBudget("");
                setApprovedBudget("");
                setIsBudgetApproved(false);
                setSelectedMemberIds(
                    parentProject.members && Array.isArray(parentProject.members)
                        ? parentProject.members.map((m) => m.id || m.user_id).filter(Boolean)
                        : []
                );
            } else {
                setName("");
                setCode("");
                setDescription("");
                setNotes("");
                setKeyDeliverables("");
                setRisksConstraints("");
                setPriority("medium");
                setOwnerId("");
                setSponsorId("");
                setStartDate(new Date().toISOString().slice(0, 10));
                setEndDate("");
                setCurrency("USD");
                setEstimatedBudget("");
                setApprovedBudget("");
                setIsBudgetApproved(false);
                setSelectedMemberIds([]);
            }

            getTaskMetadata()
                .then((metaRes) => {
                    if (metaRes.data?.success && metaRes.data.data) {
                        setUsers(metaRes.data.data.users || []);
                        setCompanies(metaRes.data.data.companies || []);
                        setDepartments(metaRes.data.data.departments || []);
                    }
                })
                .catch(() => ({ data: { data: { users: [] } } }));
        }
    }, [isOpen, parentProject]);

    if (!isOpen) return null;

    // Auto-suggest uppercase project code when name changes
    const handleNameChange = (e) => {
        const val = e.target.value;
        setName(val);
        const prefix = parentProject?.code ? `${parentProject.code}-` : "PRJ-";
        if (!code || code.startsWith("PRJ-") || (parentProject?.code && code.startsWith(`${parentProject.code}-`))) {
            const clean = val.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
            if (clean) {
                setCode(`${prefix}${clean}`);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error(parentProject ? "Sub-project name is required" : "Project name is required");
            setActiveTab("basic");
            return;
        }

        try {
            setSubmitting(true);

            // Combine project notes and detailed requirements
            const combinedNotes = [
                notes.trim(),
                keyDeliverables.trim() ? `Key Deliverables & Scope:\n${keyDeliverables.trim()}` : "",
                risksConstraints.trim() ? `Known Risks & Constraints:\n${risksConstraints.trim()}` : ""
            ].filter(Boolean).join("\n\n");

            const res = await createProject({
                name: name.trim(),
                code: code.trim(),
                description: description.trim(),
                notes: combinedNotes,
                parent_project_id: parentProject?.id || null,
                priority,
                visibility: "private",
                owner_id: ownerId || null,
                sponsor_id: sponsorId || null,
                start_date: startDate || null,
                end_date: endDate || null,
                currency,
                estimated_budget: Number(estimatedBudget) || 0,
                approved_budget: isBudgetApproved ? (Number(approvedBudget) || Number(estimatedBudget) || 0) : 0,
                is_budget_approved: isBudgetApproved,
                members: selectedMemberIds
            });

            if (res.data?.success) {
                toast.success(parentProject ? "Sub-project created successfully!" : "Project created successfully!");
                onCreated(res.data.data);
                onClose();
            } else {
                toast.error(res.data?.message || (parentProject ? "Failed to create sub-project" : "Failed to create project"));
            }
        } catch (err) {
            console.error("Create project error:", err);
            toast.error(err.response?.data?.message || (parentProject ? "Failed to create sub-project" : "Failed to create project"));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#17365D] flex items-center justify-center font-bold text-sm">
                            <i className={parentProject ? "fa-solid fa-folder-tree text-[#2878C7]" : "fa-solid fa-folder-plus"}></i>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#17212F]">
                                {parentProject ? "Create Sub-Project" : "Create New Project"}
                            </h2>
                            <p className="text-xs text-[#5B6573]">
                                {parentProject
                                    ? `Child workstream governed under ${parentProject.name} (${parentProject.code})`
                                    : "Set up an enterprise initiative with governance & budget"}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-[#F8FAFC] px-6 gap-6 text-xs font-semibold">
                    <button
                        type="button"
                        onClick={() => setActiveTab("basic")}
                        className={`py-3 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                            activeTab === "basic"
                                ? "border-[#17365D] text-[#17365D]"
                                : "border-transparent text-[#5B6573] hover:text-[#17212F]"
                        }`}
                    >
                        <i className="fa-solid fa-info-circle"></i>
                        <span>1. Basic Info</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("finance")}
                        className={`py-3 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                            activeTab === "finance"
                                ? "border-[#17365D] text-[#17365D]"
                                : "border-transparent text-[#5B6573] hover:text-[#17212F]"
                        }`}
                    >
                        <i className="fa-solid fa-coins"></i>
                        <span>2. Governance & Budget</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("notes_details")}
                        className={`py-3 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                            activeTab === "notes_details"
                                ? "border-[#17365D] text-[#17365D]"
                                : "border-transparent text-[#5B6573] hover:text-[#17212F]"
                        }`}
                    >
                        <i className="fa-solid fa-file-lines"></i>
                        <span>3. Notes &amp; Details</span>
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                    {activeTab === "basic" && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            {parentProject && (
                                <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs text-[#17365D]">
                                    <div className="flex items-center gap-2">
                                        <i className="fa-solid fa-diagram-project text-[#2878C7]"></i>
                                        <span>Sub-project under <strong>{parentProject.name}</strong> ({parentProject.code})</span>
                                    </div>
                                    <span className="text-[10px] font-semibold text-[#17365D] bg-white px-2 py-0.5 rounded border border-blue-100">
                                        Common items prefilled
                                    </span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                    {parentProject ? "Sub-project Name" : "Project Name"} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={handleNameChange}
                                    placeholder={parentProject ? "e.g. Mobile Core Client Workstream" : "e.g. Next-Gen Mobile App Client"}
                                    className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] transition-all"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                        Project Code
                                    </label>
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                                        placeholder="e.g. PRJ-MBL"
                                        className="w-full text-sm font-mono px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">Unique identifier for tasks and reports</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                        Priority Level
                                    </label>
                                    <select
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value)}
                                        className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] capitalize"
                                    >
                                        <option value="low">Low Priority</option>
                                        <option value="medium">Medium Priority</option>
                                        <option value="high">High Priority</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                    Description & Strategic Goal
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    placeholder="Describe the initiative, key deliverables, and target outcomes..."
                                    className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                        Target End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                    />
                                </div>
                            </div>

                            {/* Included Team Members (Multi-Select) */}
                            <div className="pt-2 border-t border-slate-200">
                                <AssigneeMultiSelect
                                    label="Included Team Members"
                                    placeholder="Search and select people included in this project..."
                                    users={users}
                                    selectedUserIds={selectedMemberIds}
                                    onChange={setSelectedMemberIds}
                                    companies={companies}
                                    departments={departments}
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Selected members will be included and granted access to this project
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === "finance" && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                        Project Manager (Owner)
                                    </label>
                                    <select
                                        value={ownerId}
                                        onChange={(e) => setOwnerId(e.target.value)}
                                        className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                    >
                                        <option value="">Select Project Manager...</option>
                                        {users.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.email})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-slate-400 mt-1">Responsible for schedule and day-to-day delivery</p>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                        Executive Sponsor
                                    </label>
                                    <select
                                        value={sponsorId}
                                        onChange={(e) => setSponsorId(e.target.value)}
                                        className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                    >
                                        <option value="">Select Sponsor / Stakeholder...</option>
                                        {users.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.email})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[11px] text-slate-400 mt-1">Business stakeholder providing budget and strategic sign-off</p>
                                </div>
                            </div>

                            {/* Project Team Members (Multi-Select) */}
                            <div className="pt-2 border-t border-slate-200">
                                <AssigneeMultiSelect
                                    label="Included Team Members"
                                    placeholder="Search and select people included in this project..."
                                    users={users}
                                    selectedUserIds={selectedMemberIds}
                                    onChange={setSelectedMemberIds}
                                    companies={companies}
                                    departments={departments}
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Team members will be granted access and assigned to this project
                                </p>
                            </div>

                            <div className="pt-2 border-t border-slate-200">
                                <h4 className="text-xs font-bold text-[#17212F] uppercase tracking-wider mb-3">Budget & Financial Allocation</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                            Currency
                                        </label>
                                        <select
                                            value={currency}
                                            onChange={(e) => setCurrency(e.target.value)}
                                            className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                        >
                                            <option value="USD">USD ($)</option>
                                            <option value="INR">INR (₹)</option>
                                            <option value="EUR">EUR (€)</option>
                                            <option value="GBP">GBP (£)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                            Estimated Budget
                                        </label>
                                        <input
                                            type="number"
                                            value={estimatedBudget}
                                            onChange={(e) => setEstimatedBudget(e.target.value)}
                                            placeholder="50000"
                                            className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                            Approved Budget
                                        </label>
                                        <input
                                            type="number"
                                            value={approvedBudget}
                                            onChange={(e) => setApprovedBudget(e.target.value)}
                                            placeholder="50000"
                                            className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <input
                                        type="checkbox"
                                        id="budgetApprovedToggle"
                                        checked={isBudgetApproved}
                                        onChange={(e) => setIsBudgetApproved(e.target.checked)}
                                        className="w-4 h-4 text-[#2878C7] rounded focus:ring-0 cursor-pointer"
                                    />
                                    <label htmlFor="budgetApprovedToggle" className="text-xs font-semibold text-[#17365D] cursor-pointer">
                                        Formally mark project budget as Approved by Sponsor
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "notes_details" && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                    Project Notes &amp; Operating Guidelines
                                </label>
                                <textarea
                                    rows={3}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add context, general guidelines, operational instructions, or handover notes for the project team..."
                                    className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] transition-all resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                    Key Deliverables &amp; Specific Scope Details
                                </label>
                                <textarea
                                    rows={3}
                                    value={keyDeliverables}
                                    onChange={(e) => setKeyDeliverables(e.target.value)}
                                    placeholder="Enumerate concrete milestones, deliverables, expected business outputs, and acceptance criteria..."
                                    className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] transition-all resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                    Known Risks, Assumptions &amp; Dependencies
                                </label>
                                <textarea
                                    rows={3}
                                    value={risksConstraints}
                                    onChange={(e) => setRisksConstraints(e.target.value)}
                                    placeholder="Note down critical risks, external vendor dependencies, budget constraints, or regulatory assumptions..."
                                    className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] transition-all resize-none"
                                />
                            </div>

                            {/* Summary Card */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                <span className="text-[11px] font-bold text-[#17365D] uppercase tracking-wider flex items-center gap-1.5">
                                    <i className="fa-solid fa-clipboard-check text-[#2878C7]"></i>
                                    <span>Initiative Summary Preview</span>
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Code</span>
                                        <span className="font-bold text-[#17212F]">{code || "Auto"}</span>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Priority</span>
                                        <span className="font-bold text-[#17212F] capitalize">{priority}</span>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Est. Budget</span>
                                        <span className="font-bold text-[#17212F]">
                                            {currency} {Number(estimatedBudget || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Members</span>
                                        <span className="font-bold text-[#17212F]">{selectedMemberIds.length} Assigned</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>

                        <div className="flex items-center gap-2">
                            {activeTab !== "notes_details" ? (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab(activeTab === "basic" ? "finance" : "notes_details")}
                                    className="px-4 py-2 text-xs font-semibold text-[#17365D] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer flex items-center gap-1.5"
                                >
                                    <span>Next Step</span>
                                    <i className="fa-solid fa-arrow-right text-[10px]"></i>
                                </button>
                            ) : null}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-5 py-2 text-xs font-bold text-white bg-[#17365D] hover:bg-[#102642] disabled:opacity-50 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                {submitting ? (
                                    <>
                                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                                        <span>{parentProject ? "Creating Sub-Project..." : "Creating Project..."}</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-check"></i>
                                        <span>{parentProject ? "Create Sub-Project" : "Create Project"}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
