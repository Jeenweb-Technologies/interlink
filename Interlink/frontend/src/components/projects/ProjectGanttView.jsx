import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { getProjectGantt, createProjectBaseline } from "../../api/projectApi";

export default function ProjectGanttView({ projectId }) {
    const [ganttData, setGanttData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState("day"); // 'day' | 'week'
    const [showBaseline, setShowBaseline] = useState(true);
    const [freezingBaseline, setFreezingBaseline] = useState(false);

    const loadGantt = async () => {
        try {
            setLoading(true);
            const res = await getProjectGantt(projectId);
            if (res.data?.success) {
                setGanttData(res.data.data);
            }
        } catch (err) {
            console.error("Load Gantt error:", err);
            toast.error("Failed to load Gantt schedule");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) loadGantt();
    }, [projectId]);

    const handleFreezeBaseline = async () => {
        try {
            setFreezingBaseline(true);
            const res = await createProjectBaseline(projectId, {
                name: `Baseline Plan (${new Date().toLocaleDateString()})`
            });
            if (res.data?.success) {
                toast.success(res.data.message || "Baseline frozen!");
                loadGantt();
            }
        } catch (err) {
            toast.error("Failed to freeze baseline");
        } finally {
            setFreezingBaseline(false);
        }
    };

    // Calculate timeline bounds
    const { startDate, totalDays, datesList } = useMemo(() => {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 45);

        const days = Math.max(30, Math.ceil((end - start) / (1000 * 3600 * 24)));
        const list = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            list.push(d);
        }

        return { startDate: start, totalDays: days, datesList: list };
    }, []);

    const dayWidth = zoom === "day" ? 42 : 22;

    const getXForDate = (dateStr) => {
        if (!dateStr) return 0;
        const d = new Date(dateStr);
        const diffMs = d.getTime() - startDate.getTime();
        const diffDays = diffMs / (1000 * 3600 * 24);
        return Math.max(0, diffDays * dayWidth);
    };

    const getWidthForDates = (startStr, endStr) => {
        if (!startStr) return dayWidth * 3;
        const s = new Date(startStr);
        const e = endStr ? new Date(endStr) : new Date(s.getTime() + 86400000 * 3);
        const diffDays = Math.max(1, Math.ceil((e - s) / (1000 * 3600 * 24)));
        return diffDays * dayWidth;
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-4">
                <div className="h-8 w-64 bg-slate-200 rounded"></div>
                <div className="h-64 bg-slate-100 rounded-xl"></div>
            </div>
        );
    }

    const phases = ganttData?.phases || [];
    const milestones = ganttData?.milestones || [];
    const tasks = ganttData?.tasks || [];
    const project = ganttData?.project || {};

    return (
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col">
            {/* Control Bar */}
            <div className="p-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4 bg-[#F8FAFC]">
                <div>
                    <h3 className="text-sm font-bold text-[#17212F] flex items-center gap-2">
                        <i className="fa-solid fa-chart-gantt text-[#2878C7]"></i>
                        <span>Project Gantt &amp; Baseline Drift</span>
                    </h3>
                    <p className="text-[11px] text-[#5B6573]">
                        Multi-phase schedule tracking against the frozen approved baseline
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Baseline toggle */}
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showBaseline}
                            onChange={(e) => setShowBaseline(e.target.checked)}
                            className="w-3.5 h-3.5 text-[#2878C7] rounded focus:ring-0"
                        />
                        <span>Show Baseline</span>
                    </label>

                    {/* Freeze Baseline Button */}
                    <button
                        onClick={handleFreezeBaseline}
                        disabled={freezingBaseline}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-camera text-slate-500"></i>
                        <span>{freezingBaseline ? "Saving..." : "Freeze Baseline"}</span>
                    </button>

                    {/* Zoom Toggle */}
                    <div className="flex items-center border border-slate-200 rounded-lg bg-white p-0.5 text-xs">
                        <button
                            onClick={() => setZoom("day")}
                            className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                                zoom === "day" ? "bg-[#17365D] text-white" : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            Day
                        </button>
                        <button
                            onClick={() => setZoom("week")}
                            className={`px-2.5 py-1 rounded font-semibold cursor-pointer ${
                                zoom === "week" ? "bg-[#17365D] text-white" : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            Week
                        </button>
                    </div>
                </div>
            </div>

            {/* Gantt Visual Grid */}
            <div className="overflow-x-auto overflow-y-auto max-h-[600px] flex">
                {/* Left Fixed Tree / Item Names */}
                <div className="w-72 shrink-0 border-r border-[#E2E8F0] bg-white sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                    <div className="h-10 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 flex items-center font-bold text-xs text-[#5B6573] uppercase tracking-wider">
                        Phases &amp; Workstreams
                    </div>

                    <div className="divide-y divide-slate-100 text-xs">
                        {/* Project Overall */}
                        <div className="h-11 px-4 flex items-center font-bold text-[#17365D] bg-slate-50/80 truncate">
                            <i className="fa-solid fa-folder mr-2 text-[#2878C7]"></i>
                            <span>{project.name}</span>
                        </div>

                        {/* Phases & Child Tasks */}
                        {phases.map((ph) => (
                            <React.Fragment key={ph.id}>
                                <div className="h-10 px-6 flex items-center font-bold text-slate-800 bg-[#F8FAFC] truncate">
                                    <i className="fa-solid fa-layer-group mr-2 text-slate-400"></i>
                                    <span>{ph.name}</span>
                                </div>
                                {tasks
                                    .filter((t) => t.phase_id === ph.id)
                                    .map((t) => (
                                        <div key={t.id} className="h-9 px-8 flex items-center text-slate-700 truncate hover:bg-slate-50">
                                            <span className="font-mono text-[10px] text-slate-400 mr-2">#{t.task_code}</span>
                                            <span className="truncate">{t.title}</span>
                                        </div>
                                    ))}
                            </React.Fragment>
                        ))}

                        {/* Milestones list */}
                        {milestones.length > 0 && (
                            <div className="h-10 px-6 flex items-center font-bold text-amber-900 bg-amber-50/50 truncate">
                                <i className="fa-solid fa-flag-checkered mr-2 text-amber-600"></i>
                                <span>Milestones ({milestones.length})</span>
                            </div>
                        )}
                        {milestones.map((m) => (
                            <div key={m.id} className="h-9 px-8 flex items-center text-slate-700 truncate hover:bg-slate-50">
                                <i className="fa-solid fa-diamond text-[9px] text-amber-500 mr-2"></i>
                                <span className="truncate">{m.title}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Scrolling Timeline Grid */}
                <div className="flex-1 relative" style={{ width: `${datesList.length * dayWidth}px` }}>
                    {/* Timeline Date Header */}
                    <div className="h-10 border-b border-[#E2E8F0] bg-[#F8FAFC] flex sticky top-0 z-10">
                        {datesList.map((d, idx) => {
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                            const isToday = d.toDateString() === new Date().toDateString();
                            return (
                                <div
                                    key={idx}
                                    style={{ width: `${dayWidth}px` }}
                                    className={`shrink-0 border-r border-slate-200/60 flex flex-col items-center justify-center text-[10px] font-semibold ${
                                        isToday
                                            ? "bg-blue-100/60 text-[#2878C7] font-bold"
                                            : isWeekend
                                            ? "bg-slate-100/50 text-slate-400"
                                            : "text-slate-600"
                                    }`}
                                >
                                    <span>{d.getDate()}</span>
                                    <span className="text-[9px] opacity-70">
                                        {d.toLocaleDateString("en-US", { weekday: "narrow" })}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Bars Rows */}
                    <div className="divide-y divide-slate-100 text-xs relative">
                        {/* Project Overall Bar */}
                        <div className="h-11 relative flex items-center bg-slate-50/40">
                            <div
                                className="absolute h-4 rounded-md bg-[#17365D] text-white text-[10px] font-bold px-2 flex items-center truncate shadow-xs"
                                style={{
                                    left: `${getXForDate(project.start_date)}px`,
                                    width: `${getWidthForDates(project.start_date, project.end_date)}px`
                                }}
                            >
                                {project.name}
                            </div>
                        </div>

                        {/* Phases & Tasks Bars */}
                        {phases.map((ph) => (
                            <React.Fragment key={ph.id}>
                                {/* Phase Summary Bar */}
                                <div className="h-10 relative flex items-center bg-[#F8FAFC]/50">
                                    <div
                                        className="absolute h-3.5 rounded bg-slate-700/80 text-white text-[9px] font-bold px-2 flex items-center truncate"
                                        style={{
                                            left: `${getXForDate(ph.start_date || project.start_date)}px`,
                                            width: `${getWidthForDates(ph.start_date || project.start_date, ph.end_date || project.end_date)}px`
                                        }}
                                    >
                                        {ph.name}
                                    </div>
                                </div>

                                {/* Phase Tasks */}
                                {tasks
                                    .filter((t) => t.phase_id === ph.id)
                                    .map((t) => {
                                        const left = getXForDate(t.start_date || project.start_date);
                                        const width = getWidthForDates(t.start_date || project.start_date, t.due_date);
                                        const isDone = t.status === "done";
                                        return (
                                            <div key={t.id} className="h-9 relative flex items-center hover:bg-slate-50/80">
                                                {/* Ghosted Baseline Bar */}
                                                {showBaseline && t.baseline_start_date && (
                                                    <div
                                                        className="absolute h-1.5 rounded-full bg-slate-300 opacity-60 top-1.5"
                                                        style={{
                                                            left: `${getXForDate(t.baseline_start_date)}px`,
                                                            width: `${getWidthForDates(t.baseline_start_date, t.baseline_due_date)}px`
                                                        }}
                                                        title="Approved Baseline"
                                                    />
                                                )}

                                                {/* Active Task Bar */}
                                                <div
                                                    className={`absolute h-5 rounded-md px-2 flex items-center text-[10px] font-bold text-white shadow-xs truncate ${
                                                        isDone ? "bg-[#10B981]" : "bg-[#2878C7]"
                                                    }`}
                                                    style={{ left: `${left}px`, width: `${width}px` }}
                                                >
                                                    <span className="truncate">{t.title}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </React.Fragment>
                        ))}

                        {/* Milestones Row */}
                        {milestones.length > 0 && <div className="h-10 bg-amber-50/20"></div>}
                        {milestones.map((m) => {
                            const left = getXForDate(m.due_date);
                            const isAchieved = m.status === "achieved";
                            return (
                                <div key={m.id} className="h-9 relative flex items-center hover:bg-slate-50">
                                    <div
                                        className={`absolute w-4 h-4 rotate-45 border -ml-2 flex items-center justify-center text-[8px] shadow-xs cursor-pointer ${
                                            isAchieved
                                                ? "bg-emerald-500 border-emerald-600 text-white"
                                                : "bg-amber-400 border-amber-500 text-amber-950"
                                        }`}
                                        style={{ left: `${left}px` }}
                                        title={`${m.title} (${m.due_date})`}
                                    >
                                        <i className="fa-solid fa-flag text-[7px] -rotate-45"></i>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
