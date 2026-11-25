import React, { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getProjectById, createProjectBaseline } from "../../api/projectApi";
import { getTasks, getTaskMetadata, updateTask, bulkUpdateTasks } from "../../api/taskApi";
import { createInstantMeeting } from "../../api/meetingApi";
import ProjectStateWrapper from "../../components/projects/ProjectStateWrapper";
import ProjectHeader from "../../components/projects/ProjectHeader";
import TaskListView from "../../components/tasks/TaskListView";
import TaskCreateDrawer from "../../components/tasks/TaskCreateDrawer";
import TaskDetailDrawer from "../../components/tasks/TaskDetailDrawer";
import ProjectSubprojectsView from "../../components/projects/ProjectSubprojectsView";
import ProjectGanttView from "../../components/projects/ProjectGanttView";
import ProjectMilestonesAndRisksView from "../../components/projects/ProjectMilestonesAndRisksView";
import ProjectWorkloadView from "../../components/projects/ProjectWorkloadView";
import ProjectDocumentsView from "../../components/projects/ProjectDocumentsView";
import ProjectReportView from "../../components/projects/ProjectReportView";

export default function ProjectWorkspacePage() {
    const { id } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

    const handleStartProjectMeeting = async () => {
        if (!project) return;
        try {
            const res = await createInstantMeeting({
                title: `${project.name} - Project Sync`,
                project_id: project.id
            });
            if (res.data?.success && res.data.meeting) {
                toast.success("Project meeting started!");
                navigate(`/meetings/join/${res.data.meeting.room_code}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to start meeting");
        }
    };

    // Active workspace tab
    const [activeTab, setActiveTab] = useState("tasks"); // 'overview' | 'tasks' | 'subprojects' | 'gantt' | 'milestones_risks' | 'workload' | 'documents' | 'report'

    // Data states
    const [project, setProject] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [metadata, setMetadata] = useState({ projects: [], users: [], labels: [], statuses: [], priorities: [] });

    // UI states
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [permissionDenied, setPermissionDenied] = useState(false);

    // Drawers & Modals
    const [createTaskDrawerOpen, setCreateTaskDrawerOpen] = useState(false);
    const [selectedTaskIdForDetail, setSelectedTaskIdForDetail] = useState(null);

    // Selection for Bulk Actions
    const [selectedTaskIds, setSelectedTaskIds] = useState([]);

    const handleToggleSelectTask = (taskId) => {
        if (selectedTaskIds.includes(taskId)) {
            setSelectedTaskIds(selectedTaskIds.filter((tId) => tId !== taskId));
        } else {
            setSelectedTaskIds([...selectedTaskIds, taskId]);
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
                loadProject();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed bulk update");
        }
    };

    const loadProject = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setPermissionDenied(false);

            const [pRes, tRes, mRes] = await Promise.all([
                getProjectById(id),
                getTasks({ project_id: id }),
                getTaskMetadata()
            ]);

            if (pRes.data?.success) {
                setProject(pRes.data.data);
            }
            if (tRes.data?.success) {
                setTasks(tRes.data.data || []);
            }
            if (mRes.data?.success) {
                setMetadata(mRes.data.data || {});
            }
        } catch (err) {
            console.error("Workspace load error:", err);
            if (err.response?.status === 403) {
                setPermissionDenied(true);
            } else {
                setError(err.response?.data?.message || "Failed to load project workspace");
            }
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (id) loadProject();
    }, [id, loadProject]);

    // Handle deep-linked task opening
    useEffect(() => {
        const qTaskId = searchParams.get("taskId");
        if (qTaskId) {
            setSelectedTaskIdForDetail(Number(qTaskId));
        }
    }, [searchParams]);

    const handleCloseDetail = () => {
        setSelectedTaskIdForDetail(null);
        if (searchParams.has("taskId")) {
            searchParams.delete("taskId");
            setSearchParams(searchParams, { replace: true });
        }
    };

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            const res = await updateTask(taskId, { status: newStatus });
            if (res.data?.success) {
                toast.success(`Task moved to ${newStatus}`);
                loadProject();
            }
        } catch (err) {
            toast.error("Failed to update status");
        }
    };

    const handleFreezeBaseline = async () => {
        try {
            const res = await createProjectBaseline(id, {
                name: `Approved Baseline (${new Date().toLocaleDateString()})`
            });
            if (res.data?.success) {
                toast.success(res.data.message || "Baseline frozen!");
                loadProject();
            }
        } catch (err) {
            toast.error("Failed to freeze baseline");
        }
    };

    const tabs = [
        { id: "overview", label: "Overview", icon: "fa-solid fa-gauge-high" },
        { id: "tasks", label: `Tasks (${tasks.length})`, icon: "fa-solid fa-list-check" },
        { id: "subprojects", label: `Sub-projects (${project?.metrics?.subprojects_count || 0})`, icon: "fa-solid fa-folder-tree" },
        { id: "gantt", label: "Gantt & Timeline", icon: "fa-solid fa-chart-gantt" },
        { id: "milestones_risks", label: "Milestones & Risks", icon: "fa-solid fa-shield-halved" },
        { id: "workload", label: "Team Workload", icon: "fa-solid fa-users-gear" },
        { id: "documents", label: `Files (${project?.metrics?.total_documents || 0})`, icon: "fa-regular fa-folder-open" },
        { id: "report", label: "Status Report", icon: "fa-solid fa-file-contract" }
    ];

    return (
        <div className="min-h-screen bg-[#F6F8FB] p-4 sm:p-6 lg:p-8 space-y-6">
            <ProjectStateWrapper
                loading={loading}
                error={error}
                onRetry={loadProject}
                permissionDenied={permissionDenied}
            >
                {project && (
                    <>
                        {/* Project Header Banner */}
                        <ProjectHeader
                            project={project}
                            onOpenCreateTask={() => setCreateTaskDrawerOpen(true)}
                            onOpenCreateMilestone={() => setActiveTab("milestones_risks")}
                            onOpenBaselineModal={handleFreezeBaseline}
                            onStartMeeting={handleStartProjectMeeting}
                        />

                        {/* Navigation Tabs Bar: Full width, strictly equal spacing across all 8 tabs */}
                        <div className="w-full bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-x-auto scrollbar-none">
                            <div className="grid grid-cols-8 w-full min-w-[800px] text-xs font-bold">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`py-3.5 px-2 border-b-2 transition-all cursor-pointer flex items-center justify-center whitespace-nowrap text-center ${
                                            activeTab === tab.id
                                                ? "border-b-[#17365D] text-[#17365D] bg-blue-50/20"
                                                : "border-b-transparent text-[#5B6573] hover:text-[#17212F] hover:bg-slate-50/50"
                                        }`}
                                    >
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Tab Contents */}
                        <div className="space-y-4">
                            {/* 1. Overview Tab */}
                            {activeTab === "overview" && (
                                <div className="space-y-6 animate-in fade-in duration-150">
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        {/* Strategic Goals & Overview */}
                                        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
                                            <h3 className="text-sm font-bold text-[#17212F] uppercase tracking-wider">
                                                Initiative Overview &amp; Scope
                                            </h3>
                                            <p className="text-xs text-[#5B6573] leading-relaxed">
                                                {project.description || "No detailed charter provided. Edit project details to establish scope and success criteria."}
                                            </p>

                                            {project.notes && (
                                                <div className="pt-3 border-t border-slate-100">
                                                    <h4 className="text-xs font-bold text-[#17365D] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                                        <i className="fa-solid fa-note-sticky text-[#2878C7]"></i>
                                                        <span>Project Notes &amp; Operational Details</span>
                                                    </h4>
                                                    <div className="text-xs text-[#5B6573] whitespace-pre-wrap leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                                                        {project.notes}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-slate-100">
                                                <div className="p-3 bg-slate-50 rounded-lg">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Phases Defined</span>
                                                    <p className="text-base font-black text-[#17212F] mt-0.5">{project.phases?.length || 0}</p>
                                                </div>
                                                <div className="p-3 bg-slate-50 rounded-lg">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Target Milestones</span>
                                                    <p className="text-base font-black text-[#17212F] mt-0.5">{project.milestones?.length || 0}</p>
                                                </div>
                                                <div className="p-3 bg-slate-50 rounded-lg">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Active Team Size</span>
                                                    <p className="text-base font-black text-[#17212F] mt-0.5">{project.members?.length || 1}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Key People & Governance */}
                                        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm space-y-4">
                                            <h3 className="text-sm font-bold text-[#17212F] uppercase tracking-wider">
                                                Project Members ({project.members?.length || 0})
                                            </h3>
                                            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                                                {project.members?.map((m) => (
                                                    <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-blue-100 text-[#17365D] font-bold text-[10px] flex items-center justify-center">
                                                                {m.name ? m.name[0].toUpperCase() : "U"}
                                                            </div>
                                                            <span className="font-semibold text-[#17212F]">{m.name}</span>
                                                        </div>
                                                        <span className="text-[10px] font-semibold text-slate-500 capitalize">
                                                            {m.role?.replace("_", " ")}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 2. Tasks Tab (Official Task Table) */}
                            {activeTab === "tasks" && (
                                <div className="w-full animate-in fade-in duration-150">
                                    <TaskListView
                                        title={`${project.code} Tasks`}
                                        tasks={tasks}
                                        selectedTaskIds={selectedTaskIds}
                                        onToggleSelectTask={handleToggleSelectTask}
                                        onSelectAll={handleSelectAll}
                                        onOpenDetail={(taskId) => setSelectedTaskIdForDetail(taskId)}
                                        onBulkAction={handleBulkAction}
                                        onOpenCreate={() => setCreateTaskDrawerOpen(true)}
                                    />
                                </div>
                            )}

                            {/* 3. Sub-projects Tab */}
                            {activeTab === "subprojects" && (
                                <div className="animate-in fade-in duration-150">
                                    <ProjectSubprojectsView projectId={id} projectCode={project.code} />
                                </div>
                            )}

                            {/* 4. Gantt & Timeline Tab */}
                            {activeTab === "gantt" && (
                                <div className="animate-in fade-in duration-150">
                                    <ProjectGanttView projectId={id} />
                                </div>
                            )}

                            {/* 5. Milestones & Risks Tab */}
                            {activeTab === "milestones_risks" && (
                                <div className="animate-in fade-in duration-150">
                                    <ProjectMilestonesAndRisksView projectId={id} phases={project.phases} />
                                </div>
                            )}

                            {/* 6. Workload Tab */}
                            {activeTab === "workload" && (
                                <div className="animate-in fade-in duration-150">
                                    <ProjectWorkloadView projectId={id} />
                                </div>
                            )}

                            {/* 7. Documents Tab */}
                            {activeTab === "documents" && (
                                <div className="animate-in fade-in duration-150">
                                    <ProjectDocumentsView projectId={id} />
                                </div>
                            )}

                            {/* 8. Executive Report Tab */}
                            {activeTab === "report" && (
                                <div className="animate-in fade-in duration-150">
                                    <ProjectReportView projectId={id} />
                                </div>
                            )}
                        </div>

                        {/* Task Create Drawer (pre-filled with project_id) */}
                        <TaskCreateDrawer
                            isOpen={createTaskDrawerOpen}
                            onClose={() => setCreateTaskDrawerOpen(false)}
                            onCreated={loadProject}
                            metadata={metadata}
                            defaultProjectId={Number(id)}
                            existingTasks={tasks}
                        />

                        {/* Task Detail Drawer */}
                        <TaskDetailDrawer
                            taskId={selectedTaskIdForDetail}
                            isOpen={Boolean(selectedTaskIdForDetail)}
                            onClose={handleCloseDetail}
                            onUpdated={loadProject}
                            allTasks={tasks}
                        />
                    </>
                )}
            </ProjectStateWrapper>
        </div>
    );
}
