import React from "react";
import { useNavigate } from "react-router-dom";

export default function ProjectHeader({
    project,
    onOpenCreateTask,
    onOpenCreateMilestone,
    onOpenBaselineModal,
    onStartMeeting
}) {
    const navigate = useNavigate();

    const progress = Math.min(Math.max(Number(project.calculatedProgress ?? project.progress_percentage) || 0, 0), 100);
    const approvedBudget = Number(project.approved_budget) || 0;
    const actualCost = Number(project.actual_cost) || 0;
    const currency = project.currency || "$";
    const isOverBudget = approvedBudget > 0 && actualCost > approvedBudget;

    const startDate = project.start_date ? new Date(project.start_date).toLocaleDateString() : "—";
    const endDate = project.end_date ? new Date(project.end_date).toLocaleDateString() : "—";

    return (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-6 shadow-sm space-y-5">
            {/* Top Navigation & Breadcrumbs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <button
                        onClick={() => navigate("/projects")}
                        className="hover:text-[#17365D] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-arrow-left text-[11px]"></i>
                        <span>Portfolio</span>
                    </button>
                    <span>/</span>
                    <span className="font-mono text-slate-600">{project.code}</span>
                    <span>/</span>
                    <span className="text-[#17365D] font-bold truncate max-w-[200px]">{project.name}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {onStartMeeting && (
                        <button
                            onClick={onStartMeeting}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                            title="Start instant video meeting & whiteboard for this project"
                        >
                            <i className="fa-solid fa-video text-emerald-600"></i>
                            <span>Start Meeting</span>
                        </button>
                    )}
                    {onOpenBaselineModal && (
                        <button
                            onClick={onOpenBaselineModal}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                            title="Snapshot approved schedule baseline"
                        >
                            <i className="fa-solid fa-camera text-slate-500"></i>
                            <span>Freeze Baseline</span>
                        </button>
                    )}
                    {onOpenCreateMilestone && (
                        <button
                            onClick={onOpenCreateMilestone}
                            className="px-3 py-1.5 text-xs font-semibold text-[#17365D] bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                            <i className="fa-solid fa-flag-checkered text-[#2878C7]"></i>
                            <span>+ Milestone</span>
                        </button>
                    )}
                    {onOpenCreateTask && (
                        <button
                            onClick={onOpenCreateTask}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg shadow-sm transition-all cursor-pointer flex items-center"
                        >
                            <span>+ Add Task</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Main Title Banner & Attributes */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
                <div>
                    <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
                        <span className="text-xs font-bold font-mono text-[#17365D] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {project.code}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 capitalize">
                            {project.status?.replace("_", " ")}
                        </span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200 capitalize">
                            {project.priority} priority
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                            <i className={`fa-solid ${project.visibility === "private" ? "fa-lock text-slate-400" : "fa-globe text-slate-400"}`}></i>
                            <span className="capitalize">{project.visibility}</span>
                        </span>
                    </div>

                    <h1 className="text-2xl font-black text-[#17212F] tracking-tight">
                        {project.name}
                    </h1>
                    {project.description && (
                        <p className="text-xs text-[#5B6573] max-w-2xl mt-1 leading-relaxed">
                            {project.description}
                        </p>
                    )}
                </div>

                {/* Stakeholders & Key People */}
                <div className="flex items-center gap-5 bg-slate-50/80 border border-slate-200/80 p-3 rounded-xl">
                    {/* Owner / Project Manager */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#17365D] to-[#2878C7] text-white flex items-center justify-center font-bold text-xs shadow-sm">
                            {project.owner_name ? project.owner_name[0].toUpperCase() : "P"}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project Lead</p>
                            <p className="text-xs font-bold text-[#17212F] truncate max-w-[110px]" title={project.owner_name}>
                                {project.owner_name || "Unassigned"}
                            </p>
                        </div>
                    </div>

                    <div className="h-7 w-px bg-slate-200"></div>

                    {/* Executive Sponsor */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                            {project.sponsor_name ? project.sponsor_name[0].toUpperCase() : "S"}
                        </div>
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Executive Sponsor</p>
                            <p className="text-xs font-bold text-[#17212F] truncate max-w-[110px]" title={project.sponsor_name}>
                                {project.sponsor_name || "None Designated"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Scorecard Metric Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
                {/* Progress bar */}
                <div className="p-3 bg-[#F8FAFC] border border-[#EDF2F7] rounded-xl space-y-1.5">
                    <div className="flex justify-between items-center text-[#5B6573] font-semibold text-xs">
                        <span>Overall Progress</span>
                        <span className="font-bold text-[#17212F]">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-300 ${
                                progress >= 80 ? "bg-[#10B981]" : progress >= 40 ? "bg-[#2878C7]" : "bg-[#F59E0B]"
                            }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                {/* Budget */}
                <div className="p-3 bg-[#F8FAFC] border border-[#EDF2F7] rounded-xl">
                    <p className="text-[10px] font-bold text-[#5B6573] uppercase tracking-wider">Approved Budget</p>
                    <p className="text-sm font-black text-[#17212F] mt-0.5">
                        {currency} {approvedBudget.toLocaleString()}
                    </p>
                    <p className={`text-[11px] font-semibold ${isOverBudget ? "text-red-600" : "text-slate-500"}`}>
                        Spent: {currency} {actualCost.toLocaleString()}
                    </p>
                </div>

                {/* Timeline */}
                <div className="p-3 bg-[#F8FAFC] border border-[#EDF2F7] rounded-xl">
                    <p className="text-[10px] font-bold text-[#5B6573] uppercase tracking-wider">Project Timeline</p>
                    <p className="text-xs font-bold text-[#17212F] mt-0.5 truncate">
                        {startDate} → {endDate}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                        Target completion schedule
                    </p>
                </div>

                {/* Workstream summary */}
                <div className="p-3 bg-[#F8FAFC] border border-[#EDF2F7] rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-[#5B6573] uppercase tracking-wider">Workstream Gates</p>
                        <p className="text-xs font-bold text-[#17212F] mt-0.5">
                            {project.phases?.length || 0} Phases &bull; {project.milestones?.length || 0} Milestones
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            {project.metrics?.open_risks || 0} monitored risks
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
