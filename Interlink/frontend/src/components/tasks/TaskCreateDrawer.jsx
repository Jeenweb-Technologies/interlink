import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { createTask } from "../../api/taskApi";
import AssigneeMultiSelect from "./AssigneeMultiSelect";

export default function TaskCreateDrawer({
    isOpen,
    onClose,
    onCreated,
    metadata = { projects: [], users: [], labels: [], statuses: [], priorities: [] },
    existingTasks = [],
    defaultProjectId = null
}) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [projectId, setProjectId] = useState("");
    const [priority, setPriority] = useState("medium");
    const [status, setStatus] = useState("todo");
    const [selectedAssignees, setSelectedAssignees] = useState([]);
    const [selectedWatchers, setSelectedWatchers] = useState([]);
    const [selectedLabels, setSelectedLabels] = useState([]);
    const [startDate, setStartDate] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [estimatedHours, setEstimatedHours] = useState("");
    const [checklists, setChecklists] = useState([""]);
    const [blockedByIds, setBlockedByIds] = useState([]);

    const [submitting, setSubmitting] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (isOpen) {
            // Reset form
            setTitle("");
            setDescription("");
            setProjectId(defaultProjectId || metadata.projects?.[0]?.id || "");
            setPriority("medium");
            setStatus("todo");
            setSelectedAssignees([]);
            setSelectedWatchers([]);
            setSelectedLabels([]);
            setStartDate("");
            setDueDate("");
            setEstimatedHours("");
            setChecklists([""]);
            setBlockedByIds([]);
            setIsDirty(false);
        }
    }, [isOpen, metadata]);

    if (!isOpen) return null;

    const handleFieldChange = (setter, value) => {
        setter(value);
        setIsDirty(true);
    };

    const handleAddChecklist = () => {
        setChecklists([...checklists, ""]);
        setIsDirty(true);
    };

    const handleChecklistChange = (index, val) => {
        const next = [...checklists];
        next[index] = val;
        setChecklists(next);
        setIsDirty(true);
    };

    const handleRemoveChecklist = (index) => {
        setChecklists(checklists.filter((_, i) => i !== index));
        setIsDirty(true);
    };

    const handleToggleAssignee = (userId) => {
        if (selectedAssignees.includes(userId)) {
            setSelectedAssignees(selectedAssignees.filter(id => id !== userId));
        } else {
            setSelectedAssignees([...selectedAssignees, userId]);
        }
        setIsDirty(true);
    };

    const handleToggleLabel = (labelId) => {
        if (selectedLabels.includes(labelId)) {
            setSelectedLabels(selectedLabels.filter(id => id !== labelId));
        } else {
            setSelectedLabels([...selectedLabels, labelId]);
        }
        setIsDirty(true);
    };

    const handleToggleBlockedBy = (taskId) => {
        const numId = Number(taskId);
        if (blockedByIds.includes(numId)) {
            setBlockedByIds(blockedByIds.filter(id => id !== numId));
        } else {
            setBlockedByIds([...blockedByIds, numId]);
        }
        setIsDirty(true);
    };

    const handleClose = () => {
        if (isDirty) {
            if (window.confirm("You have unsaved changes. Are you sure you want to discard them?")) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("Please enter a task title.");
            return;
        }

        try {
            setSubmitting(true);
            const payload = {
                title: title.trim(),
                description,
                project_id: projectId ? Number(projectId) : null,
                priority,
                status,
                start_date: startDate ? `${startDate} 09:00:00` : null,
                due_date: dueDate ? `${dueDate} 18:00:00` : null,
                estimated_hours: estimatedHours ? parseFloat(estimatedHours) : 0,
                assignees: selectedAssignees,
                watchers: selectedWatchers,
                labels: selectedLabels,
                checklists: checklists.filter(c => c.trim().length > 0),
                blocked_by_ids: blockedByIds
            };

            const res = await createTask(payload);
            if (res.data?.success) {
                toast.success(`Task created: ${res.data.data?.task_code || "Success"}`);
                setIsDirty(false);
                if (onCreated) onCreated();
                onClose();
            } else {
                toast.error(res.data?.message || "Failed to create task");
            }
        } catch (err) {
            console.error("Create task error:", err);
            toast.error(err.response?.data?.message || "Error creating task");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-slate-900/40 backdrop-blur-xs transition-opacity" data-testid="TASK-03-drawer">
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col transform transition-transform duration-300 border-l border-slate-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-[#17365D] text-white">
                    <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center text-sm">
                            <i className="fa-solid fa-plus"></i>
                        </span>
                        <div>
                            <h2 className="text-base font-bold text-white leading-tight">Create Task</h2>
                            <p className="text-xs text-slate-300">Screen ID: TASK-03 • Enterprise Workspace</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Close drawer"
                    >
                        <i className="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                {/* Form Content */}
                <form id="create-task-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#F6F8FB]">
                    {/* Title */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                        <label className="block text-xs font-bold text-[#17212F] uppercase tracking-wider">
                            Task Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Implement Real-Time Gantt Dependency Cascade"
                            value={title}
                            onChange={(e) => handleFieldChange(setTitle, e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#2878C7] focus:ring-1 focus:ring-[#2878C7] transition-all bg-white font-medium"
                        />
                    </div>

                    {/* Description */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-1.5">
                        <label className="block text-xs font-bold text-[#17212F] uppercase tracking-wider">
                            Description & Specifications
                        </label>
                        <textarea
                            rows={4}
                            placeholder="Detailed technical context, acceptance criteria, or execution notes..."
                            value={description}
                            onChange={(e) => handleFieldChange(setDescription, e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#2878C7] focus:ring-1 focus:ring-[#2878C7] transition-all bg-white"
                        ></textarea>
                    </div>

                    {/* Metadata Grid */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Project */}
                        <div>
                            <label className="block text-xs font-bold text-[#17212F] uppercase tracking-wider mb-1">
                                Project
                            </label>
                            <select
                                value={projectId}
                                onChange={(e) => handleFieldChange(setProjectId, e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#2878C7] bg-white cursor-pointer"
                            >
                                <option value="">No Project (Standalone)</option>
                                {metadata.projects?.map((p) => (
                                    <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Priority */}
                        <div>
                            <label className="block text-xs font-bold text-[#17212F] uppercase tracking-wider mb-1">
                                Priority Level
                            </label>
                            <select
                                value={priority}
                                onChange={(e) => handleFieldChange(setPriority, e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#2878C7] bg-white cursor-pointer"
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>

                        {/* Start Date */}
                        <div>
                            <label className="block text-xs font-bold text-[#17212F] uppercase tracking-wider mb-1">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => handleFieldChange(setStartDate, e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#2878C7] bg-white"
                            />
                        </div>

                        {/* Due Date */}
                        <div>
                            <label className="block text-xs font-bold text-[#17212F] uppercase tracking-wider mb-1">
                                Due Date
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => handleFieldChange(setDueDate, e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#2878C7] bg-white"
                            />
                        </div>

                        {/* Estimated Hours */}
                        <div>
                            <label className="block text-xs font-bold text-[#17212F] uppercase tracking-wider mb-1">
                                Estimated Hours
                            </label>
                            <input
                                type="number"
                                step="0.5"
                                min="0"
                                placeholder="e.g. 16.0"
                                value={estimatedHours}
                                onChange={(e) => handleFieldChange(setEstimatedHours, e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#2878C7] bg-white"
                            />
                        </div>

                        {/* Status */}
                        <div>
                            <label className="block text-xs font-bold text-[#17212F] uppercase tracking-wider mb-1">
                                Initial Status
                            </label>
                            <select
                                value={status}
                                onChange={(e) => handleFieldChange(setStatus, e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-hidden focus:border-[#2878C7] bg-white cursor-pointer"
                            >
                                <option value="todo">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="backlog">Backlog</option>
                            </select>
                        </div>
                    </div>

                    {/* Assignees Selector */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                        <AssigneeMultiSelect
                            users={metadata.users}
                            selectedUserIds={selectedAssignees}
                            onChange={(ids) => {
                                setIsDirty(true);
                                setSelectedAssignees(ids);
                            }}
                            companies={metadata.companies}
                            departments={metadata.departments}
                        />
                    </div>

                    {/* Universal Labels */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                        <label className="block text-xs font-bold text-[#17212F] uppercase tracking-wider">
                            Universal Labels
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {metadata.labels?.map((lbl) => {
                                const isSelected = selectedLabels.includes(lbl.id);
                                return (
                                    <button
                                        type="button"
                                        key={lbl.id}
                                        onClick={() => handleToggleLabel(lbl.id)}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                                            isSelected
                                                ? "border-[#2878C7] bg-blue-50 text-[#2878C7] font-semibold ring-1 ring-[#2878C7]"
                                                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                                        }`}
                                    >
                                        <span>#{lbl.name}</span>
                                        {isSelected && <i className="fa-solid fa-check text-[10px]"></i>}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Dependencies (Blocked By / Predecessor) */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-[#17212F] uppercase tracking-wider">
                                Task Dependencies & Blockers
                            </label>
                            <span className="text-[11px] text-[#5B6573]">Finish-to-Start (FS)</span>
                        </div>
                        <p className="text-xs text-[#5B6573]">
                            Select any prerequisite tasks that must be completed before this task can be completed:
                        </p>
                        <div className="max-h-36 overflow-y-auto space-y-1.5 border border-slate-200 rounded-lg p-2 bg-slate-50/50">
                            {existingTasks.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No existing tasks available to link as blockers.</p>
                            ) : (
                                existingTasks.map((t) => {
                                    const isBlocked = blockedByIds.includes(t.id);
                                    return (
                                        <label
                                            key={t.id}
                                            className={`flex items-center justify-between p-2 rounded-md text-xs cursor-pointer border transition-colors ${
                                                isBlocked ? "bg-red-50 border-red-200 text-[#17212F]" : "bg-white border-slate-200 hover:bg-slate-50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isBlocked}
                                                    onChange={() => handleToggleBlockedBy(t.id)}
                                                    className="rounded border-slate-300 text-[#EF4444] focus:ring-red-400"
                                                />
                                                <span className="font-bold text-[#17365D]">#{t.task_code}</span>
                                                <span className="truncate max-w-[280px]">{t.title}</span>
                                            </div>
                                            <span className="text-[10px] uppercase font-semibold text-slate-500">
                                                {t.status}
                                            </span>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Checklists / Subtasks */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-[#17212F] uppercase tracking-wider">
                                Checklists / Action Items
                            </label>
                            <button
                                type="button"
                                onClick={handleAddChecklist}
                                className="text-xs text-[#2878C7] hover:underline font-semibold cursor-pointer inline-flex items-center gap-1"
                            >
                                <i className="fa-solid fa-plus text-[10px]"></i>
                                <span>Add Item</span>
                            </button>
                        </div>
                        <div className="space-y-2">
                            {checklists.map((c, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 font-mono w-4">{idx + 1}.</span>
                                    <input
                                        type="text"
                                        placeholder={`Checklist item ${idx + 1}...`}
                                        value={c}
                                        onChange={(e) => handleChecklistChange(idx, e.target.value)}
                                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-hidden focus:border-[#2878C7]"
                                    />
                                    {checklists.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveChecklist(idx)}
                                            className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                                        >
                                            <i className="fa-solid fa-trash text-xs"></i>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </form>

                {/* Sticky Footer */}
                <div className="px-6 py-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0 shadow-lg">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <div className="flex items-center gap-3">
                        <button
                            type="submit"
                            form="create-task-form"
                            disabled={submitting}
                            className="px-5 py-2 text-sm font-semibold text-white bg-[#17365D] hover:bg-[#102642] disabled:opacity-50 rounded-lg shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <i className="fa-solid fa-spinner fa-spin"></i>
                                    <span>Creating...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-check"></i>
                                    <span>Create Task</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
