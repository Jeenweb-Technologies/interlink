import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
    getTasks,
    getDashboardMetrics,
    getTaskMetadata,
    updateTask,
    bulkUpdateTasks
} from "../../api/taskApi";
import { createInstantMeeting } from "../../api/meetingApi";
import TaskStateWrapper from "../../components/tasks/TaskStateWrapper";
import TaskDashboardView from "../../components/tasks/TaskDashboardView";
import TaskListView from "../../components/tasks/TaskListView";
import TaskKanbanView from "../../components/tasks/TaskKanbanView";
import TaskCalendarView from "../../components/tasks/TaskCalendarView";
import TaskGanttView from "../../components/tasks/TaskGanttView";
import TaskCreateDrawer from "../../components/tasks/TaskCreateDrawer";
import TaskDetailDrawer from "../../components/tasks/TaskDetailDrawer";

export default function TasksPage() {
    // Current Active View ('dashboard' | 'list' | 'kanban' | 'calendar' | 'gantt')
    const [activeView, setActiveView] = useState("list");

    // Data States
    const [tasks, setTasks] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [metadata, setMetadata] = useState({ projects: [], users: [], labels: [], statuses: [], priorities: [] });
    
    // UI / Fetch States
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [permissionDenied, setPermissionDenied] = useState(false);

    // Filters & Search
    const [search, setSearch] = useState("");
    const [selectedProject, setSelectedProject] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("");
    const [selectedPriority, setSelectedPriority] = useState("");
    const [selectedAssignee, setSelectedAssignee] = useState("");
    const [dueFilter, setDueFilter] = useState("");
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
    const filterDropdownRef = useRef(null);

    // Close filters dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
                setFilterDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Selection for Bulk Actions
    const [selectedTaskIds, setSelectedTaskIds] = useState([]);

    // URL Search params for deep link opening of task detail drawer
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const handleStartTaskMeeting = async () => {
        try {
            const res = await createInstantMeeting({
                title: selectedProject
                    ? `Task Review - Project ${selectedProject}`
                    : "Task Standup & Review Meeting",
                project_id: selectedProject ? parseInt(selectedProject, 10) : null
            });
            if (res.data?.success && res.data.meeting) {
                toast.success("Task meeting started!");
                navigate(`/meetings/join/${res.data.meeting.room_code}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to start meeting");
        }
    };

    // Drawers
    const [createDrawerOpen, setCreateDrawerOpen] = useState(false);
    const [selectedTaskIdForDetail, setSelectedTaskIdForDetail] = useState(null);

    // Sync URL ?taskId=... with drawer state
    useEffect(() => {
        const qTaskId = searchParams.get("taskId");
        if (qTaskId) {
            setSelectedTaskIdForDetail(Number(qTaskId));
        }
    }, [searchParams]);

    // Handle closing detail drawer cleanly
    const handleCloseDetail = () => {
        setSelectedTaskIdForDetail(null);
        if (searchParams.has("taskId")) {
            searchParams.delete("taskId");
            setSearchParams(searchParams, { replace: true });
        }
    };

    // Fetch Metadata
    const loadMetadata = async () => {
        try {
            const res = await getTaskMetadata();
            if (res.data?.success) {
                setMetadata(res.data.data);
            }
        } catch (err) {
            console.error("Metadata load error:", err);
        }
    };

    // Fetch Tasks & Dashboard Data
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setPermissionDenied(false);

            const params = {};
            if (search.trim()) params.search = search.trim();
            if (selectedProject) params.project_id = selectedProject;
            if (selectedStatus) params.status = selectedStatus;
            if (selectedPriority) params.priority = selectedPriority;
            if (selectedAssignee) params.assignee_id = selectedAssignee;
            if (dueFilter) params.due_filter = dueFilter;

            const [tasksRes, dashRes] = await Promise.all([
                getTasks(params),
                getDashboardMetrics()
            ]);

            if (tasksRes.data?.success) {
                setTasks(tasksRes.data.data || []);
            }
            if (dashRes.data?.success) {
                setDashboardData(dashRes.data.data || null);
            }
        } catch (err) {
            console.error("Task page load error:", err);
            if (err.response?.status === 403) {
                setPermissionDenied(true);
            } else {
                setError(err.response?.data?.message || err.message || "Failed to load tasks");
            }
        } finally {
            setLoading(false);
        }
    }, [search, selectedProject, selectedStatus, selectedPriority, selectedAssignee, dueFilter]);

    useEffect(() => {
        loadMetadata();
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Listen to global timer stop/save events to refresh task list and metrics
    useEffect(() => {
        const handleGlobalTaskUpdate = () => {
            loadData();
        };
        window.addEventListener("task-updated", handleGlobalTaskUpdate);
        return () => window.removeEventListener("task-updated", handleGlobalTaskUpdate);
    }, [loadData]);

    // Bulk selection handlers
    const handleToggleSelectTask = (id) => {
        if (selectedTaskIds.includes(id)) {
            setSelectedTaskIds(selectedTaskIds.filter((tId) => tId !== id));
        } else {
            setSelectedTaskIds([...selectedTaskIds, id]);
        }
    };

    const handleSelectAll = () => {
        if (selectedTaskIds.length === tasks.length) {
            setSelectedTaskIds([]);
        } else {
            setSelectedTaskIds(tasks.map((t) => t.id));
        }
    };

    const handleBulkAction = async (action, value) => {
        try {
            const res = await bulkUpdateTasks({
                task_ids: selectedTaskIds,
                action,
                value
            });
            if (res.data?.success) {
                toast.success(res.data.message || "Bulk update applied");
                setSelectedTaskIds([]);
                loadData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed bulk update");
        }
    };

    // Quick status change from Kanban
    const handleStatusChange = async (taskId, newStatus) => {
        try {
            const res = await updateTask(taskId, { status: newStatus });
            if (res.data?.success) {
                toast.success(`Task moved to ${newStatus}`);
                loadData();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to update status");
        }
    };

    // Filter reset
    const handleClearFilters = () => {
        setSearch("");
        setSelectedProject("");
        setSelectedStatus("");
        setSelectedPriority("");
        setSelectedAssignee("");
        setDueFilter("");
    };

    const hasActiveFilters = Boolean(
        search.trim() || selectedProject || selectedStatus || selectedPriority || selectedAssignee || dueFilter
    );

    const activeFilterCount = [selectedProject, selectedPriority, selectedStatus, dueFilter].filter(Boolean).length;

    const isFilterEmpty = hasActiveFilters && tasks.length === 0;
    const isZeroDataEmpty = !hasActiveFilters && tasks.length === 0;

    return (
        <div className="flex flex-col min-h-full bg-[#F6F8FB] font-sans">
            {/* Top Bar: View Tabs Full Width + Consolidated Filters Popover Button on Right */}
            <div className="px-6 py-3 bg-white border-b border-slate-200 shrink-0 select-none">
                <div className="flex items-center justify-between gap-4">
                    {/* View Paradigm Switcher taking available width */}
                    <div className="flex-1 grid grid-cols-5 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-bold gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveView("dashboard")}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md transition-all cursor-pointer ${
                                activeView === "dashboard"
                                    ? "bg-[#17365D] text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                            }`}
                        >
                            <i className="fa-solid fa-chart-pie text-xs"></i>
                            <span className="truncate">Dashboard</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveView("list")}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md transition-all cursor-pointer ${
                                activeView === "list"
                                    ? "bg-[#17365D] text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                            }`}
                        >
                            <i className="fa-solid fa-table-list text-xs"></i>
                            <span className="truncate">List View</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveView("kanban")}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md transition-all cursor-pointer ${
                                activeView === "kanban"
                                    ? "bg-[#17365D] text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                            }`}
                        >
                            <i className="fa-solid fa-table-columns text-xs"></i>
                            <span className="truncate">Kanban</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveView("calendar")}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md transition-all cursor-pointer ${
                                activeView === "calendar"
                                    ? "bg-[#17365D] text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                            }`}
                        >
                            <i className="fa-regular fa-calendar-days text-xs"></i>
                            <span className="truncate">Calendar</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveView("gantt")}
                            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-md transition-all cursor-pointer ${
                                activeView === "gantt"
                                    ? "bg-[#17365D] text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                            }`}
                        >
                            <i className="fa-solid fa-timeline text-xs"></i>
                            <span className="truncate">Gantt</span>
                        </button>
                    </div>

                    {/* Consolidated Filters Dropdown on Right */}
                    <div className="relative shrink-0 flex items-center gap-2" ref={filterDropdownRef}>
                        <button
                            type="button"
                            onClick={handleStartTaskMeeting}
                            className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                            title="Start instant video meeting for task review"
                        >
                            <i className="fa-solid fa-video text-xs"></i>
                            <span>Start Meeting</span>
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                                className={`h-9 px-3.5 border rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all shadow-2xs ${
                                    activeFilterCount > 0 || filterDropdownOpen
                                        ? "border-[#2878C7] bg-blue-50 text-[#2878C7]"
                                        : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                                }`}
                                title="Filter Tasks"
                            >
                                <i className="fa-solid fa-sliders text-xs"></i>
                                <span>Filters</span>
                                {activeFilterCount > 0 && (
                                    <span className="min-w-4 h-4 px-1 rounded-full bg-[#2878C7] text-white flex items-center justify-center text-[10px] font-bold">
                                        {activeFilterCount}
                                    </span>
                                )}
                                <i className="fa-solid fa-chevron-down text-[10px] opacity-70"></i>
                            </button>

                            {activeFilterCount > 0 && (
                                <button
                                    type="button"
                                    onClick={handleClearFilters}
                                    className="h-9 px-2 text-xs text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                    title="Reset all filters"
                                >
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                            )}
                        </div>

                        {/* Filters Popover Menu */}
                        {filterDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-4 space-y-3.5 animate-in fade-in duration-150">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                    <div className="flex items-center gap-1.5 font-bold text-xs text-[#17212F] uppercase tracking-wider">
                                        <i className="fa-solid fa-sliders text-[#2878C7]"></i>
                                        <span>Task Filters</span>
                                    </div>
                                    {activeFilterCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleClearFilters}
                                            className="text-[11px] text-red-600 hover:underline font-semibold cursor-pointer"
                                        >
                                            Reset All
                                        </button>
                                    )}
                                </div>

                                {/* Project Filter */}
                                <div className="space-y-1">
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                        Project
                                    </label>
                                    <select
                                        value={selectedProject}
                                        onChange={(e) => setSelectedProject(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-hidden focus:border-[#2878C7] cursor-pointer"
                                    >
                                        <option value="">All Projects</option>
                                        {metadata.projects?.map((p) => (
                                            <option key={p.id} value={p.id}>{p.code}: {p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Priority Filter */}
                                <div className="space-y-1">
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                        Priority
                                    </label>
                                    <select
                                        value={selectedPriority}
                                        onChange={(e) => setSelectedPriority(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-hidden focus:border-[#2878C7] cursor-pointer"
                                    >
                                        <option value="">All Priorities</option>
                                        <option value="urgent">Urgent</option>
                                        <option value="high">High</option>
                                        <option value="medium">Medium</option>
                                        <option value="low">Low</option>
                                    </select>
                                </div>

                                {/* Status Filter */}
                                <div className="space-y-1">
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                        Status
                                    </label>
                                    <select
                                        value={selectedStatus}
                                        onChange={(e) => setSelectedStatus(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-hidden focus:border-[#2878C7] cursor-pointer"
                                    >
                                        <option value="">All Statuses</option>
                                        <option value="todo">To Do</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="in_review">In Review</option>
                                        <option value="done">Done</option>
                                        <option value="backlog">Backlog</option>
                                    </select>
                                </div>

                                {/* Deadline Filter */}
                                <div className="space-y-1">
                                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                                        Deadline
                                    </label>
                                    <select
                                        value={dueFilter}
                                        onChange={(e) => setDueFilter(e.target.value)}
                                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-hidden focus:border-[#2878C7] cursor-pointer"
                                    >
                                        <option value="">All Deadlines</option>
                                        <option value="overdue">Overdue</option>
                                        <option value="today">Due Today</option>
                                        <option value="this_week">Due This Week</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Interactive Content Canvas with 6 Mandatory UI States */}
            <div className="flex-1 p-6">
                <TaskStateWrapper
                    loading={loading}
                    error={error}
                    onRetry={loadData}
                    permissionDenied={permissionDenied}
                    isEmpty={isZeroDataEmpty}
                    isFilterEmpty={isFilterEmpty}
                    onClearFilters={handleClearFilters}
                    onAction={() => setCreateDrawerOpen(true)}
                    actionLabel="Create First Task"
                    emptyTitle="No tasks created yet"
                    emptyDescription="Your task workspace is ready. Create a task with assignees, dependencies, and deadlines to begin collaborating."
                >
                    {activeView === "dashboard" && (
                        <TaskDashboardView
                            dashboardData={dashboardData}
                            onOpenDetail={(id) => setSelectedTaskIdForDetail(id)}
                            onOpenCreate={() => setCreateDrawerOpen(true)}
                        />
                    )}

                    {activeView === "list" && (
                        <TaskListView
                            tasks={tasks}
                            selectedTaskIds={selectedTaskIds}
                            onToggleSelectTask={handleToggleSelectTask}
                            onSelectAll={handleSelectAll}
                            onOpenDetail={(id) => setSelectedTaskIdForDetail(id)}
                            onBulkAction={handleBulkAction}
                            metadata={metadata}
                            search={search}
                            onSearchChange={setSearch}
                            onOpenCreate={() => setCreateDrawerOpen(true)}
                        />
                    )}

                    {activeView === "kanban" && (
                        <TaskKanbanView
                            tasks={tasks}
                            onOpenDetail={(id) => setSelectedTaskIdForDetail(id)}
                            onStatusChange={handleStatusChange}
                            onOpenCreate={() => setCreateDrawerOpen(true)}
                        />
                    )}

                    {activeView === "calendar" && (
                        <TaskCalendarView
                            tasks={tasks}
                            onOpenDetail={(id) => setSelectedTaskIdForDetail(id)}
                        />
                    )}

                    {activeView === "gantt" && (
                        <TaskGanttView
                            tasks={tasks}
                            onOpenDetail={(id) => setSelectedTaskIdForDetail(id)}
                            onTaskUpdated={loadData}
                        />
                    )}
                </TaskStateWrapper>
            </div>

            {/* Slide-over Drawers */}
            <TaskCreateDrawer
                isOpen={createDrawerOpen}
                onClose={() => setCreateDrawerOpen(false)}
                onCreated={loadData}
                metadata={metadata}
                existingTasks={tasks}
            />

            <TaskDetailDrawer
                taskId={selectedTaskIdForDetail}
                isOpen={Boolean(selectedTaskIdForDetail)}
                onClose={handleCloseDetail}
                onUpdated={loadData}
                allTasks={tasks}
            />
        </div>
    );
}
