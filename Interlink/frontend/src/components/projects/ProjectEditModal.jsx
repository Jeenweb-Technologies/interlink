import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { updateProject, getProjectById } from "../../api/projectApi";
import { getTaskMetadata } from "../../api/taskApi";
import AssigneeMultiSelect from "../tasks/AssigneeMultiSelect";

export default function ProjectEditModal({ isOpen, onClose, project, onUpdated }) {
    const [activeTab, setActiveTab] = useState("basic"); // 'basic' | 'finance' | 'notes_details'
    const [users, setUsers] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Form state
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [description, setDescription] = useState("");
    const [notes, setNotes] = useState("");
    const [status, setStatus] = useState("planning");
    const [priority, setPriority] = useState("medium");
    const [ownerId, setOwnerId] = useState("");
    const [sponsorId, setSponsorId] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [currency, setCurrency] = useState("USD");
    const [estimatedBudget, setEstimatedBudget] = useState("");
    const [approvedBudget, setApprovedBudget] = useState("");
    const [isBudgetApproved, setIsBudgetApproved] = useState(false);

    // Populate initial state from project prop and fetch full project detail
    useEffect(() => {
        if (!isOpen || !project) return;

        setActiveTab("basic");
        setName(project.name || "");
        setCode(project.code || "");
        setDescription(project.description || "");
        setNotes(project.notes || "");
        setStatus(project.status || "planning");
        setPriority(project.priority || "medium");
        setOwnerId(project.owner_id || "");
        setSponsorId(project.sponsor_id || "");
        setStartDate(project.start_date ? project.start_date.slice(0, 10) : "");
        setEndDate(project.end_date ? project.end_date.slice(0, 10) : "");
        setCurrency(project.currency || "USD");
        setEstimatedBudget(project.estimated_budget ?? "");
        setApprovedBudget(project.approved_budget ?? "");
        setIsBudgetApproved(Boolean(project.is_budget_approved));

        const initialMembers = project.members && Array.isArray(project.members)
            ? project.members.map((m) => m.id || m.user_id).filter(Boolean)
            : [];
        setSelectedMemberIds(initialMembers);

        // Load users, companies, and departments metadata
        getTaskMetadata()
            .then((metaRes) => {
                if (metaRes.data?.success && metaRes.data.data) {
                    setUsers(metaRes.data.data.users || []);
                    setCompanies(metaRes.data.data.companies || []);
                    setDepartments(metaRes.data.data.departments || []);
                }
            })
            .catch(() => {});

        // Fetch latest detailed project data (including members and full notes)
        if (project.id) {
            setLoadingDetail(true);
            getProjectById(project.id)
                .then((res) => {
                    if (res.data?.success && res.data.data) {
                        const d = res.data.data;
                        setName(d.name || "");
                        setCode(d.code || "");
                        setDescription(d.description || "");
                        setNotes(d.notes || "");
                        setStatus(d.status || "planning");
                        setPriority(d.priority || "medium");
                        setOwnerId(d.owner_id || "");
                        setSponsorId(d.sponsor_id || "");
                        setStartDate(d.start_date ? d.start_date.slice(0, 10) : "");
                        setEndDate(d.end_date ? d.end_date.slice(0, 10) : "");
                        setCurrency(d.currency || "USD");
                        setEstimatedBudget(d.estimated_budget ?? "");
                        setApprovedBudget(d.approved_budget ?? "");
                        setIsBudgetApproved(Boolean(d.is_budget_approved));

                        if (Array.isArray(d.members)) {
                            setSelectedMemberIds(d.members.map((m) => m.id || m.user_id).filter(Boolean));
                        }
                    }
                })
                .catch((err) => console.warn("Failed to load full project details:", err))
                .finally(() => setLoadingDetail(false));
        }
    }, [isOpen, project]);

    if (!isOpen || !project) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Project name is required");
            setActiveTab("basic");
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                name: name.trim(),
                code: code.trim(),
                description: description.trim(),
                notes: notes.trim(),
                status,
                priority,
                owner_id: ownerId || null,
                sponsor_id: sponsorId || null,
                start_date: startDate || null,
                end_date: endDate || null,
                currency,
                estimated_budget: Number(estimatedBudget) || 0,
                approved_budget: isBudgetApproved ? (Number(approvedBudget) || Number(estimatedBudget) || 0) : (Number(approvedBudget) || 0),
                is_budget_approved: isBudgetApproved,
                members: selectedMemberIds
            };

            const res = await updateProject(project.id, payload);
            if (res.data?.success) {
                toast.success("Project specifications updated successfully!");
                if (onUpdated) {
                    onUpdated({ ...project, ...payload });
                }
                onClose();
            } else {
                toast.error(res.data?.message || "Failed to update project");
            }
        } catch (err) {
            console.error("Update project error:", err);
            toast.error(err.response?.data?.message || "Failed to update project");
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
                            <i className="fa-regular fa-pen-to-square text-[#2878C7]"></i>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-[#17212F]">Edit Project Specifications</h2>
                                <span className="font-mono text-[11px] font-bold text-[#17365D] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                    {project.code}
                                </span>
                            </div>
                            <p className="text-xs text-[#5B6573]">Update initiative charter, governance, timeline, budget &amp; team</p>
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
                        <span>2. Governance &amp; Budget</span>
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
                    {loadingDetail && (
                        <div className="p-2.5 bg-blue-50/60 border border-blue-200/60 rounded-lg flex items-center gap-2 text-xs text-[#17365D]">
                            <i className="fa-solid fa-circle-notch fa-spin text-[#2878C7]"></i>
                            <span>Loading latest project specifications...</span>
                        </div>
                    )}

                    {/* 1. Basic Info */}
                    {activeTab === "basic" && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                    Project Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Project title"
                                    className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] transition-all"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                        Project Code
                                    </label>
                                    <input
                                        type="text"
                                        value={code}
                                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                                        placeholder="PRJ-XXXX"
                                        className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] font-mono uppercase"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                        Status
                                    </label>
                                    <select
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value)}
                                        className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                    >
                                        <option value="planning">Planning</option>
                                        <option value="active">Active</option>
                                        <option value="on_hold">On Hold</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                        Priority
                                    </label>
                                    <select
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value)}
                                        className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="urgent">Urgent</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                    Project Description &amp; Charter
                                </label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    placeholder="Describe the initiative, key objectives, and deliverables..."
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
                            </div>
                        </div>
                    )}

                    {/* 2. Governance & Budget */}
                    {activeTab === "finance" && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                        Project Owner / Lead
                                    </label>
                                    <select
                                        value={ownerId}
                                        onChange={(e) => setOwnerId(e.target.value)}
                                        className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                    >
                                        <option value="">Unassigned</option>
                                        {users.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.email || u.username})
                                            </option>
                                        ))}
                                    </select>
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
                                        <option value="">None</option>
                                        {users.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name} ({u.email || u.username})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                                <h3 className="text-xs font-bold text-[#17365D] uppercase tracking-wider flex items-center gap-1.5">
                                    <i className="fa-solid fa-coins text-[#2878C7]"></i>
                                    <span>Budget &amp; Financial Governance</span>
                                </h3>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-[#17212F] mb-1">Currency</label>
                                        <select
                                            value={currency}
                                            onChange={(e) => setCurrency(e.target.value)}
                                            className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                        >
                                            <option value="USD">USD ($)</option>
                                            <option value="EUR">EUR (€)</option>
                                            <option value="GBP">GBP (£)</option>
                                            <option value="INR">INR (₹)</option>
                                            <option value="CAD">CAD ($)</option>
                                            <option value="AUD">AUD ($)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-[#17212F] mb-1">Estimated Budget</label>
                                        <input
                                            type="number"
                                            value={estimatedBudget}
                                            onChange={(e) => setEstimatedBudget(e.target.value)}
                                            placeholder="50000"
                                            className="w-full text-sm px-3.5 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7]"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-[#17212F] mb-1">Approved Budget</label>
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
                                        id="editBudgetApprovedToggle"
                                        checked={isBudgetApproved}
                                        onChange={(e) => setIsBudgetApproved(e.target.checked)}
                                        className="w-4 h-4 text-[#2878C7] rounded focus:ring-0 cursor-pointer"
                                    />
                                    <label htmlFor="editBudgetApprovedToggle" className="text-xs font-semibold text-[#17365D] cursor-pointer">
                                        Formally mark project budget as Approved by Sponsor
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. Notes & Details */}
                    {activeTab === "notes_details" && (
                        <div className="space-y-4 animate-in fade-in duration-150">
                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">
                                    Project Notes, Scope &amp; Operating Guidelines
                                </label>
                                <textarea
                                    rows={8}
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add context, general guidelines, operational instructions, key deliverables, or handover notes for the project team..."
                                    className="w-full text-sm px-3.5 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#2878C7]/20 focus:border-[#2878C7] transition-all resize-none"
                                />
                            </div>

                            {/* Summary Card */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                                <span className="text-[11px] font-bold text-[#17365D] uppercase tracking-wider flex items-center gap-1.5">
                                    <i className="fa-solid fa-clipboard-check text-[#2878C7]"></i>
                                    <span>Specification Summary Preview</span>
                                </span>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                                        <span className="text-[10px] text-slate-400 block font-semibold uppercase">Status</span>
                                        <span className="font-bold text-[#17212F] capitalize">{status?.replace("_", " ")}</span>
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
                                        <span>Saving Changes...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-check"></i>
                                        <span>Save Specifications</span>
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
