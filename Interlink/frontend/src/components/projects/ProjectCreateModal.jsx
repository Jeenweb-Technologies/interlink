import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { createProject, getProjectTemplates, createProjectFromTemplate } from "../../api/projectApi";
import { getTaskMetadata } from "../../api/taskApi";
import AssigneeMultiSelect from "../tasks/AssigneeMultiSelect";

export default function ProjectCreateModal({ isOpen, onClose, onCreated }) {
    const [activeTab, setActiveTab] = useState("basic"); // 'basic' | 'finance' | 'template'
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("medium");
    const [visibility, setVisibility] = useState("public");
    const [ownerId, setOwnerId] = useState("");
    const [sponsorId, setSponsorId] = useState("");
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
    const [endDate, setEndDate] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [estimatedBudget, setEstimatedBudget] = useState("");
    const [approvedBudget, setApprovedBudget] = useState("");
    const [isBudgetApproved, setIsBudgetApproved] = useState(false);

    // Load templates and users metadata
    useEffect(() => {
        if (isOpen) {
            Promise.all([
                getProjectTemplates().catch(() => ({ data: { data: [] } })),
                getTaskMetadata().catch(() => ({ data: { data: { users: [] } } }))
            ]).then(([tplRes, metaRes]) => {
                if (tplRes.data?.success) setTemplates(tplRes.data.data || []);
                if (metaRes.data?.success && metaRes.data.data) {
                    setUsers(metaRes.data.data.users || []);
                    setCompanies(metaRes.data.data.companies || []);
                    setDepartments(metaRes.data.data.departments || []);
                }
            });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    // Auto-suggest uppercase project code when name changes
    const handleNameChange = (e) => {
        const val = e.target.value;
        setName(val);
        if (!code || code.startsWith("PRJ-")) {
            const clean = val.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
            if (clean) {
                setCode(`PRJ-${clean}`);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Project name is required");
            setActiveTab("basic");
            return;
        }

        try {
            setSubmitting(true);

            if (selectedTemplateId) {
                // Creation via template
                const res = await createProjectFromTemplate({
                    template_id: selectedTemplateId,
                    name: name.trim(),
                    code: code.trim(),
                    owner_id: ownerId || null,
                    sponsor_id: sponsorId || null,
                    start_date: startDate || null,
                    end_date: endDate || null,
                    estimated_budget: Number(estimatedBudget) || 50000,
                    members: selectedMemberIds
                });
                if (res.data?.success) {
                    toast.success(res.data.message || "Project created from template!");
                    onCreated(res.data.data);
                    onClose();
                }
            } else {
                // Standard project creation
                const res = await createProject({
                    name: name.trim(),
                    code: code.trim(),
                    description: description.trim(),
                    priority,
                    visibility,
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
                    toast.success("Project created successfully!");
                    onCreated(res.data.data);
                    onClose();
                }
            }
        } catch (err) {
            console.error("Create project error:", err);
            toast.error(err.response?.data?.message || "Failed to create project");
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
                            <i className="fa-solid fa-folder-plus"></i>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[#17212F]">Create New Project</h2>
                            <p className="text-xs text-[#5B6573]">Set up an enterprise initiative with governance & budget</p>
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
                        onClick={() => setActiveTab("template")}
                        className={`py-3 border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                            activeTab === "template"
                                ? "border-[#17365D] text-[#17365D]"
                                : "border-transparent text-[#5B6573] hover:text-[#17212F]"
                        }`}
                    >
                        <i className="fa-solid fa-cubes"></i>
                        <span>3. Blueprint Template</span>
                    </button>
                </div>

                {/* Modal Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                    {activeTab === "basic" && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                    Project Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={handleNameChange}
                                    placeholder="e.g. Next-Gen Mobile App Client"
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

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                        Visibility
                                    </label>
                                    <select
                                        value={visibility}
                                        onChange={(e) => setVisibility(e.target.value)}
                                        className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                    >
                                        <option value="public">Public to Workspace</option>
                                        <option value="private">Private to Team Members</option>
                                        <option value="restricted">Restricted / Confidential</option>
                                    </select>
                                </div>

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

                    {activeTab === "template" && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <p className="text-xs text-[#5B6573]">
                                Choose an enterprise blueprint to automatically populate standard phases, key milestones, and starter tasks for this project.
                            </p>

                            <div className="grid grid-cols-1 gap-3">
                                <div
                                    onClick={() => setSelectedTemplateId("")}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                        selectedTemplateId === ""
                                            ? "border-[#17365D] bg-slate-50 ring-2 ring-[#17365D]/10"
                                            : "border-slate-200 hover:border-slate-300 bg-white"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center text-sm font-bold">
                                                <i className="fa-solid fa-file"></i>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-[#17212F]">Blank Project</h4>
                                                <p className="text-xs text-[#5B6573]">Start with an empty structure and define phases manually</p>
                                            </div>
                                        </div>
                                        {selectedTemplateId === "" && (
                                            <span className="text-blue-600 font-bold text-sm">
                                                <i className="fa-solid fa-circle-check"></i>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {templates.map((tpl) => (
                                    <div
                                        key={tpl.id}
                                        onClick={() => setSelectedTemplateId(tpl.id)}
                                        className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                            selectedTemplateId === tpl.id
                                                ? "border-[#2878C7] bg-blue-50/50 ring-2 ring-[#2878C7]/20"
                                                : "border-slate-200 hover:border-slate-300 bg-white"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#17365D] flex items-center justify-center text-sm font-bold">
                                                    <i className="fa-solid fa-layer-group"></i>
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-[#17212F]">{tpl.name}</h4>
                                                    <span className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">
                                                        {tpl.category}
                                                    </span>
                                                </div>
                                            </div>
                                            {selectedTemplateId === tpl.id && (
                                                <span className="text-[#2878C7] font-bold text-sm">
                                                    <i className="fa-solid fa-circle-check"></i>
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[#5B6573] line-clamp-2 mt-1">
                                            {tpl.description}
                                        </p>
                                    </div>
                                ))}
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
                            {activeTab !== "template" ? (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab(activeTab === "basic" ? "finance" : "template")}
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
                                        <span>Creating Project...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-check"></i>
                                        <span>Create Project</span>
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
