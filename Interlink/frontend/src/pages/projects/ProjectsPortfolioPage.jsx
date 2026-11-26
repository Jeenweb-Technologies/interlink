import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getPortfolioMetrics, getProjects } from "../../api/projectApi";
import DataTable from "../../components/DataTable";
import ProjectStateWrapper from "../../components/projects/ProjectStateWrapper";
import ProjectCard from "../../components/projects/ProjectCard";
import ProjectCreateModal from "../../components/projects/ProjectCreateModal";

export default function ProjectsPortfolioPage() {
    const navigate = useNavigate();

    // Data States
    const [metrics, setMetrics] = useState(null);
    const [projects, setProjects] = useState([]);

    // UI States
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [viewMode, setViewMode] = useState("table"); // 'table' | 'grid'
    const [search, setSearch] = useState("");

    // "View By" sorting state (identical to Task Management)
    const [viewBy, setViewBy] = useState("none"); // 'none' | 'status' | 'priority'
    const [viewByOpen, setViewByOpen] = useState(false);
    const viewByRef = useRef(null);

    // Modal
    const [createModalOpen, setCreateModalOpen] = useState(false);

    // Close "View By" popover on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (viewByRef.current && !viewByRef.current.contains(event.target)) {
                setViewByOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setPermissionDenied(false);

            const [metricsRes, projectsRes] = await Promise.all([
                getPortfolioMetrics(),
                getProjects()
            ]);

            if (metricsRes.data?.success) {
                setMetrics(metricsRes.data.data);
            }
            if (projectsRes.data?.success) {
                setProjects(projectsRes.data.data || []);
            }
        } catch (err) {
            console.error("Portfolio page error:", err);
            if (err.response?.status === 403) {
                setPermissionDenied(true);
            } else {
                setError(err.response?.data?.message || "Failed to load project portfolio");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Process projects based on "View By" sorting
    const processedProjects = useMemo(() => {
        if (viewBy === "none") return projects;
        const copy = [...projects];
        if (viewBy === "status") {
            const statusOrder = { active: 0, planning: 1, on_hold: 2, completed: 3, archived: 4 };
            copy.sort((a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99));
        } else if (viewBy === "priority") {
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
            copy.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));
        }
        return copy;
    }, [projects, viewBy]);

    // Real-time search filter for Grid Card View
    const filteredProjects = useMemo(() => {
        if (!search.trim()) return processedProjects;
        const q = search.toLowerCase();
        return processedProjects.filter((p) =>
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.code && p.code.toLowerCase().includes(q)) ||
            (p.description && p.description.toLowerCase().includes(q)) ||
            (p.owner_name && p.owner_name.toLowerCase().includes(q)) ||
            (p.parent_project_name && p.parent_project_name.toLowerCase().includes(q)) ||
            (p.parent_project_code && p.parent_project_code.toLowerCase().includes(q))
        );
    }, [processedProjects, search]);

    // DataTable columns definition
    const columns = useMemo(() => [
        {
            key: "code",
            label: "Code",
            minWidth: "110px",
            render: (row) => (
                <span className="font-mono text-[#17365D] font-bold text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {row.code}
                </span>
            )
        },
        {
            key: "name",
            label: "Project Name",
            minWidth: "260px",
            render: (row) => (
                <div
                    className="flex flex-col gap-0.5 py-1 cursor-pointer group"
                    onClick={() => navigate(`/projects/${row.id}`)}
                >
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#17212F] group-hover:text-[#2878C7] transition-colors line-clamp-1">
                            {row.name}
                        </span>
                        {row.parent_project_id && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#17365D] border border-blue-200 px-1.5 py-0.2 rounded flex items-center gap-1">
                                <i className="fa-solid fa-diagram-project text-[9px] text-[#2878C7]"></i>
                                Sub-project
                            </span>
                        )}
                        {row.visibility === "private" && (
                            <span title="Private project" className="text-slate-400 text-xs">
                                <i className="fa-solid fa-lock"></i>
                            </span>
                        )}
                    </div>
                    {row.parent_project_name && (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mt-0.5">
                            <span className="text-[#2878C7] font-semibold flex items-center gap-1">
                                <i className="fa-solid fa-turn-up rotate-90 text-[10px]"></i>
                                Sub-project of:
                            </span>
                            <span
                                className="font-bold text-[#17365D] hover:underline cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/projects/${row.parent_project_id}`);
                                }}
                            >
                                {row.parent_project_name}
                            </span>
                            {row.parent_project_code && (
                                <span className="font-mono text-[10px] text-slate-400">
                                    ({row.parent_project_code})
                                </span>
                            )}
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {row.subprojects_count > 0 && (
                            <span className="text-blue-600 font-semibold inline-flex items-center gap-1">
                                <i className="fa-solid fa-folder-tree text-[10px]"></i>
                                {row.subprojects_count} Sub-projects
                            </span>
                        )}
                        <span>{row.tasks_count || 0} Tasks</span>
                        {row.open_risks_count > 0 && (
                            <span className="text-amber-600 font-semibold">
                                &bull; {row.open_risks_count} Risks
                            </span>
                        )}
                    </div>
                </div>
            )
        },
        {
            key: "status",
            label: "Status",
            minWidth: "120px",
            render: (row) => {
                const getStatusStyle = (status) => {
                    switch (status) {
                        case "active": return "bg-emerald-50 text-emerald-700 border-emerald-200";
                        case "completed": return "bg-blue-50 text-blue-700 border-blue-200";
                        case "planning": return "bg-amber-50 text-amber-700 border-amber-200";
                        case "on_hold": return "bg-purple-50 text-purple-700 border-purple-200";
                        case "archived": return "bg-slate-100 text-slate-600 border-slate-200";
                        default: return "bg-slate-50 text-slate-700 border-slate-200";
                    }
                };
                return (
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${getStatusStyle(row.status)}`}>
                        {row.status?.replace("_", " ")}
                    </span>
                );
            }
        },
        {
            key: "priority",
            label: "Priority",
            minWidth: "110px",
            render: (row) => {
                const getPriorityStyle = (priority) => {
                    switch (priority) {
                        case "urgent": return "text-red-700 bg-red-50 border-red-200";
                        case "high": return "text-amber-700 bg-amber-50 border-amber-200";
                        case "medium": return "text-blue-700 bg-blue-50 border-blue-200";
                        default: return "text-slate-600 bg-slate-50 border-slate-200";
                    }
                };
                return (
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${getPriorityStyle(row.priority)}`}>
                        {row.priority}
                    </span>
                );
            }
        },
        {
            key: "progress_percentage",
            label: "Progress",
            minWidth: "150px",
            render: (row) => {
                const progress = Math.min(Math.max(Number(row.progress_percentage) || 0, 0), 100);
                return (
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                    progress >= 80 ? "bg-[#10B981]" : progress >= 40 ? "bg-[#2878C7]" : "bg-[#F59E0B]"
                                }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="text-xs font-bold text-[#17212F] min-w-[32px] text-right">
                            {progress}%
                        </span>
                    </div>
                );
            }
        },
        {
            key: "approved_budget",
            label: "Budget",
            minWidth: "140px",
            render: (row) => (
                <div className="text-xs">
                    <span className="font-bold text-[#17212F]">
                        {row.currency || "$"} {Number(row.approved_budget || 0).toLocaleString()}
                    </span>
                    {Number(row.actual_cost) > 0 && (
                        <p className="text-[10px] text-slate-400">
                            Spent: {row.currency || "$"} {Number(row.actual_cost || 0).toLocaleString()}
                        </p>
                    )}
                </div>
            )
        },
        {
            key: "owner_name",
            label: "Project Lead",
            minWidth: "140px",
            render: (row) => (
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#17365D] to-[#2878C7] text-white flex items-center justify-center font-bold text-[10px]">
                        {row.owner_name ? row.owner_name[0].toUpperCase() : "U"}
                    </div>
                    <span className="text-xs font-medium text-[#17212F] truncate max-w-[100px]" title={row.owner_name}>
                        {row.owner_name || "Unassigned"}
                    </span>
                </div>
            )
        },
        {
            key: "end_date",
            label: "Target Date",
            minWidth: "110px",
            render: (row) => (
                <span className="text-xs text-slate-600">
                    {row.end_date ? new Date(row.end_date).toLocaleDateString() : "—"}
                </span>
            )
        },
        {
            key: "actions",
            label: "Action",
            sortable: false,
            minWidth: "80px",
            render: (row) => (
                <button
                    onClick={() => navigate(`/projects/${row.id}`)}
                    className="px-2.5 py-1 text-xs font-semibold text-[#17365D] bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                >
                    View
                </button>
            )
        }
    ], [navigate]);

    // Custom Title: Exactly like in Task Management (Navy square icon badge + 2xl bold text)
    const customTitle = (
        <span className="inline-flex items-center gap-2.5 select-none">
            <span className="w-8 h-8 rounded-md bg-[#17365D] text-white inline-flex items-center justify-center text-[16px] shadow-2xs shrink-0">
                <i className="fa-solid fa-diagram-project"></i>
            </span>
            <span className="text-2xl font-bold text-[#17365D] tracking-tight">
                Project Management
            </span>
        </span>
    );

    // Far-right addition button: Exactly like in Task Management
    const createButton = (
        <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="h-10 w-10 rounded-lg bg-[#17365D] hover:bg-[#102642] text-white flex items-center justify-center text-lg shadow-sm transition-all cursor-pointer shrink-0"
            title="Create New Project"
        >
            <i className="fa-solid fa-plus"></i>
        </button>
    );

    // View By dropdown + View Switcher (Grid/Table)
    const viewByDropdown = (
        <div className="flex items-center gap-2">
            <div className="relative" ref={viewByRef}>
                <button
                    type="button"
                    onClick={() => setViewByOpen(!viewByOpen)}
                    className={`h-10 px-3 border rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                        viewBy !== "none" || viewByOpen
                            ? "border-[#2878C7] bg-blue-50/80 text-[#2878C7]"
                            : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                    }`}
                >
                    <span>View By{viewBy !== "none" ? `: ${viewBy.charAt(0).toUpperCase() + viewBy.slice(1)}` : ""}</span>
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {viewByOpen && (
                    <div className="absolute right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in duration-150">
                        <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                            View By
                        </div>
                        {[
                            { key: "none", label: "None (Default)" },
                            { key: "status", label: "Status" },
                            { key: "priority", label: "Priority" }
                        ].map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => {
                                    setViewBy(item.key);
                                    setViewByOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-left hover:bg-slate-50 cursor-pointer ${
                                    viewBy === item.key ? "text-[#2878C7] font-bold bg-blue-50/50" : "text-slate-700"
                                }`}
                            >
                                <span>{item.label}</span>
                                {viewBy === item.key && (
                                    <i className="fa-solid fa-check text-xs text-[#2878C7]"></i>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Grid / Table toggle */}
            <div className="flex items-center border border-slate-300 rounded-lg bg-white p-0.5 h-10 shadow-2xs">
                <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`h-full px-2.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        viewMode === "table" ? "bg-[#17365D] text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Table View"
                >
                    <i className="fa-solid fa-table-list"></i>
                </button>
                <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`h-full px-2.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        viewMode === "grid" ? "bg-[#17365D] text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                    title="Cards View"
                >
                    <i className="fa-solid fa-grip"></i>
                </button>
            </div>
        </div>
    );

    const summary = metrics?.summary || {};
    const health = metrics?.health || { onTrack: 0, atRisk: 0, delayed: 0 };
    const upcomingMilestones = metrics?.upcomingMilestones || [];
    const totalApproved = Number(summary.total_approved_budget) || 0;
    const totalActual = Number(summary.total_actual_cost) || 0;

    return (
        <div className="min-h-screen bg-[#F6F8FB] p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Portfolio Executive KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Active Projects */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-[#5B6573] uppercase tracking-wider">Active Projects</p>
                        <h3 className="text-2xl font-black text-[#17212F] mt-1">{summary.active_projects || 0}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            {summary.total_projects || 0} total initiatives
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-[#2878C7] flex items-center justify-center text-lg border border-blue-100">
                        <i className="fa-solid fa-diagram-project"></i>
                    </div>
                </div>

                {/* Health Breakdown */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-[#5B6573] uppercase tracking-wider">Schedule Health</p>
                        <div className="flex items-center gap-2 mt-1.5">
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200" title="On Track">
                                {health.onTrack} On Track
                            </span>
                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200" title="At Risk">
                                {health.atRisk} At Risk
                            </span>
                            {health.delayed > 0 && (
                                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700 border border-red-200" title="Delayed">
                                    {health.delayed} Delayed
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Based on milestone &amp; risk gates</p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#10B981] flex items-center justify-center text-lg border border-emerald-100">
                        <i className="fa-solid fa-heart-pulse"></i>
                    </div>
                </div>

                {/* Budget Utilization */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-[#5B6573] uppercase tracking-wider">Total Approved Budget</p>
                        <h3 className="text-2xl font-black text-[#17212F] mt-1">
                            ${totalApproved.toLocaleString()}
                        </h3>
                        <p className="text-[11px] text-[#5B6573] mt-0.5">
                            Spent: <span className="font-semibold text-[#17212F]">${totalActual.toLocaleString()}</span>
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg border border-purple-100">
                        <i className="fa-solid fa-chart-pie"></i>
                    </div>
                </div>

                {/* Upcoming Milestones */}
                <div className="bg-white rounded-xl border border-[#E2E8F0] p-4 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-bold text-[#5B6573] uppercase tracking-wider">Upcoming Milestones</p>
                        <h3 className="text-2xl font-black text-[#17212F] mt-1">
                            {upcomingMilestones.length}
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            Targeted next 30 days
                        </p>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-amber-50 text-[#F59E0B] flex items-center justify-center text-lg border border-amber-100">
                        <i className="fa-solid fa-flag-checkered"></i>
                    </div>
                </div>
            </div>

            {/* Main Portfolio Content with 6 UI States */}
            <ProjectStateWrapper
                loading={loading}
                error={error}
                onRetry={loadData}
                permissionDenied={permissionDenied}
                isEmpty={projects.length === 0}
                onAction={() => setCreateModalOpen(true)}
                actionLabel="Create First Project"
                emptyTitle="No Projects Found in Portfolio"
                emptyDescription="Launch your organization's first initiative with dedicated phases, budget tracking, and milestones."
            >
                {viewMode === "table" ? (
                    /* Official DataTable View (identical to Task Management) */
                    <div className="relative flex flex-col w-full" data-testid="PROJ-02-list">
                        <DataTable
                            tableId="projects_portfolio_table"
                            title={customTitle}
                            data={processedProjects}
                            columns={columns}
                            searchPlaceholder="Search project name or code..."
                            toggleActions={viewByDropdown}
                            actionButton={createButton}
                        />
                    </div>
                ) : (
                    /* Cards Grid View with Dedicated Real-time Search */
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-sm">
                            {customTitle}
                            <div className="flex flex-wrap items-center gap-2.5">
                                {/* Search in Grid Card View */}
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search project name or code..."
                                        className="h-10 rounded-lg border border-slate-300 bg-white pl-9 pr-8 text-sm outline-none focus:border-[#2878C7] transition-all w-60 sm:w-64 text-[#17212F] shadow-2xs placeholder:text-slate-400"
                                    />
                                    <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                    {search && (
                                        <button
                                            type="button"
                                            onClick={() => setSearch("")}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                                            title="Clear search"
                                        >
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                    )}
                                </div>
                                {viewByDropdown}
                                {createButton}
                            </div>
                        </div>

                        {filteredProjects.length === 0 ? (
                            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
                                    <i className="fa-solid fa-magnifying-glass"></i>
                                </div>
                                <h4 className="text-sm font-bold text-[#17212F]">No matching projects</h4>
                                <p className="text-xs text-[#5B6573]">
                                    No projects found matching &ldquo;{search}&rdquo;. Try another term or clear your search query.
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setSearch("")}
                                    className="text-xs text-[#2878C7] hover:underline font-bold cursor-pointer"
                                >
                                    Clear search filter
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {filteredProjects.map((proj) => (
                                    <ProjectCard key={proj.id} project={proj} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </ProjectStateWrapper>

            {/* Create Project Modal */}
            <ProjectCreateModal
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onCreated={() => loadData()}
            />
        </div>
    );
}
