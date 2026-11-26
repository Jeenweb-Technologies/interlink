import React from "react";
import { useNavigate } from "react-router-dom";

export default function ProjectCard({ project }) {
    const navigate = useNavigate();

    const getStatusStyle = (status) => {
        switch (status) {
            case "active":
                return "bg-emerald-50 text-emerald-700 border-emerald-200";
            case "completed":
                return "bg-blue-50 text-blue-700 border-blue-200";
            case "planning":
                return "bg-amber-50 text-amber-700 border-amber-200";
            case "on_hold":
                return "bg-purple-50 text-purple-700 border-purple-200";
            case "archived":
                return "bg-slate-100 text-slate-600 border-slate-200";
            default:
                return "bg-slate-50 text-slate-700 border-slate-200";
        }
    };

    const getPriorityStyle = (priority) => {
        switch (priority) {
            case "urgent":
                return "text-red-700 bg-red-50 border-red-200";
            case "high":
                return "text-amber-700 bg-amber-50 border-amber-200";
            case "medium":
                return "text-blue-700 bg-blue-50 border-blue-200";
            default:
                return "text-slate-600 bg-slate-50 border-slate-200";
        }
    };

    const progress = Math.min(Math.max(Number(project.progress_percentage) || 0, 0), 100);
    const approvedBudget = Number(project.approved_budget) || 0;
    const actualCost = Number(project.actual_cost) || 0;
    const currency = project.currency || "$";

    const isOverBudget = approvedBudget > 0 && actualCost > approvedBudget;

    return (
        <div
            onClick={() => navigate(`/projects/${project.id}`)}
            className="group relative bg-white border border-[#E2E8F0] hover:border-[#2878C7]/60 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
        >
            <div>
                {/* Header Row: Code & Status */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold font-mono text-[#17365D] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {project.code}
                        </span>
                        {project.parent_project_id && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#17365D] border border-blue-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <i className="fa-solid fa-diagram-project text-[9px] text-[#2878C7]"></i>
                                Sub-project
                            </span>
                        )}
                        {project.visibility === "private" && (
                            <span title="Private project" className="text-slate-400 text-xs">
                                <i className="fa-solid fa-lock"></i>
                            </span>
                        )}
                        {project.subprojects_count > 0 && (
                            <span title={`${project.subprojects_count} Sub-projects`} className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-semibold">
                                <i className="fa-solid fa-folder-tree mr-1"></i>{project.subprojects_count}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${getPriorityStyle(project.priority)}`}>
                            {project.priority}
                        </span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${getStatusStyle(project.status)}`}>
                            {project.status?.replace("_", " ")}
                        </span>
                    </div>
                </div>

                {/* Title & Description */}
                <h3 className="text-base font-bold text-[#17212F] group-hover:text-[#2878C7] transition-colors line-clamp-1 mb-1.5">
                    {project.name}
                </h3>
                {project.parent_project_name && (
                    <div
                        className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-lg mb-2 w-fit hover:bg-slate-100 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/projects/${project.parent_project_id}`);
                        }}
                    >
                        <span className="text-[#2878C7] font-semibold flex items-center gap-1">
                            <i className="fa-solid fa-turn-up rotate-90 text-[10px]"></i>
                            Sub-project of:
                        </span>
                        <span className="font-bold text-[#17365D]">
                            {project.parent_project_name}
                        </span>
                        {project.parent_project_code && (
                            <span className="font-mono text-[10px] text-slate-400">
                                ({project.parent_project_code})
                            </span>
                        )}
                    </div>
                )}
                <p className="text-xs text-[#5B6573] line-clamp-2 leading-relaxed mb-4">
                    {project.description || "No description provided."}
                </p>

                {/* Progress Bar */}
                <div className="space-y-1 mb-4">
                    <div className="flex justify-between text-xs font-semibold text-[#5B6573]">
                        <span>Progress</span>
                        <span className="text-[#17212F]">{progress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${
                                progress >= 80 ? "bg-[#10B981]" : progress >= 40 ? "bg-[#2878C7]" : "bg-[#F59E0B]"
                            }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Budget Gauge */}
                {approvedBudget > 0 && (
                    <div className="bg-[#F8FAFC] border border-[#EDF2F7] rounded-lg p-2.5 mb-4 text-xs">
                        <div className="flex justify-between items-center mb-1 text-[#5B6573]">
                            <span>Budget Spent:</span>
                            <span className={`font-bold ${isOverBudget ? "text-[#EF4444]" : "text-[#17212F]"}`}>
                                {currency} {actualCost.toLocaleString()} / {currency} {approvedBudget.toLocaleString()}
                            </span>
                        </div>
                        {isOverBudget && (
                            <p className="text-[10px] text-[#EF4444] font-medium flex items-center gap-1">
                                <i className="fa-solid fa-triangle-exclamation"></i> Over approved budget
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Footer: Owner, Tasks & Risk Indicators */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#5B6573]">
                {/* Owner info */}
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#17365D] to-[#2878C7] text-white flex items-center justify-center font-bold text-[10px]">
                        {project.owner_name ? project.owner_name[0].toUpperCase() : "U"}
                    </div>
                    <span className="text-xs font-medium text-[#17212F] max-w-[100px] truncate" title={project.owner_name}>
                        {project.owner_name || "Unassigned"}
                    </span>
                </div>

                {/* Micro metrics */}
                <div className="flex items-center gap-3 text-[11px] font-semibold">
                    <span className="flex items-center gap-1" title="Tasks">
                        <i className="fa-solid fa-list-check text-slate-400"></i>
                        <span>{project.completed_tasks_count || 0}/{project.tasks_count || 0}</span>
                    </span>
                    {project.open_risks_count > 0 && (
                        <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200" title={`${project.open_risks_count} Open Risks`}>
                            <i className="fa-solid fa-shield-halved"></i>
                            <span>{project.open_risks_count}</span>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
