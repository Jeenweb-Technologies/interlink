import React, { useState, useMemo } from "react";
import toast from "react-hot-toast";
import { updateTask } from "../../api/taskApi";

export default function TaskGanttView({
    tasks = [],
    onOpenDetail,
    onTaskUpdated
}) {
    const [zoom, setZoom] = useState("day"); // 'day' | 'week'
    const [autoCascade, setAutoCascade] = useState(true);
    const [showCriticalPath, setShowCriticalPath] = useState(false);

    // Compute timeline date bounds
    const { startDate, endDate, totalDays, datesList } = useMemo(() => {
        if (!tasks || tasks.length === 0) {
            const today = new Date();
            const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2);
            const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
            const days = 16;
            const list = [];
            for (let i = 0; i < days; i++) {
                const d = new Date(start);
                d.setDate(d.getDate() + i);
                list.push(d);
            }
            return { startDate: start, endDate: end, totalDays: days, datesList: list };
        }

        let minDate = new Date();
        let maxDate = new Date();

        tasks.forEach((t) => {
            const s = t.start_date ? new Date(t.start_date) : new Date(t.created_at);
            const e = t.due_date ? new Date(t.due_date) : new Date(s.getTime() + 86400000 * 2);

            if (s < minDate) minDate = s;
            if (e > maxDate) maxDate = e;
        });

        // Add 2-day buffer on both sides
        const start = new Date(minDate);
        start.setDate(start.getDate() - 2);
        const end = new Date(maxDate);
        end.setDate(end.getDate() + 6);

        const diffTime = end.getTime() - start.getTime();
        const days = Math.max(14, Math.ceil(diffTime / (1000 * 3600 * 24)));

        const list = [];
        for (let i = 0; i < days; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            list.push(d);
        }

        return { startDate: start, endDate: end, totalDays: days, datesList: list };
    }, [tasks]);

    const dayWidth = zoom === "day" ? 44 : 24;
    const rowHeight = 44;
    const headerHeight = 48;
    const leftWidth = 280;

    // Helper: calculate X offset for date
    const getXForDate = (date) => {
        const d = new Date(date);
        const diffMs = d.getTime() - startDate.getTime();
        const diffDays = diffMs / (1000 * 3600 * 24);
        return Math.max(0, diffDays * dayWidth);
    };

    // Quick shift handler for Gantt bar reschedule
    const handleShiftTask = async (task, daysDelta) => {
        if (daysDelta === 0) return;

        const currentStart = task.start_date ? new Date(task.start_date) : new Date();
        const currentDue = task.due_date ? new Date(task.due_date) : new Date(currentStart.getTime() + 86400000 * 2);

        const newStart = new Date(currentStart);
        newStart.setDate(newStart.getDate() + daysDelta);

        const newDue = new Date(currentDue);
        newDue.setDate(newDue.getDate() + daysDelta);

        try {
            const res = await updateTask(task.id, {
                start_date: newStart.toISOString().slice(0, 19).replace('T', ' '),
                due_date: newDue.toISOString().slice(0, 19).replace('T', ' '),
                auto_cascade: autoCascade
            });

            if (res.data?.success) {
                toast.success(
                    autoCascade
                        ? `Shifted #${task.task_code} and cascaded dependent dates.`
                        : `Shifted #${task.task_code}`
                );
                if (onTaskUpdated) onTaskUpdated();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to reschedule task");
        }
    };

    // Calculate dependency links for SVG arrows
    const dependencyLinks = useMemo(() => {
        const links = [];
        const taskMap = {};
        tasks.forEach((t, index) => {
            taskMap[t.id] = { ...t, index };
        });

        tasks.forEach((succ, succIndex) => {
            if (succ.blockers && succ.blockers.length > 0) {
                succ.blockers.forEach((b) => {
                    const pred = taskMap[b.predecessor_id];
                    if (pred) {
                        const predStart = pred.start_date ? new Date(pred.start_date) : new Date(pred.created_at);
                        const predDue = pred.due_date ? new Date(pred.due_date) : new Date(predStart.getTime() + 86400000 * 2);
                        const succStart = succ.start_date ? new Date(succ.start_date) : new Date(succ.created_at);

                        const startX = getXForDate(predDue);
                        const startY = headerHeight + pred.index * rowHeight + rowHeight / 2;

                        const endX = getXForDate(succStart);
                        const endY = headerHeight + succIndex * rowHeight + rowHeight / 2;

                        const isBlocked = pred.status !== "done";

                        links.push({
                            id: `${pred.id}-${succ.id}`,
                            startX,
                            startY,
                            endX,
                            endY,
                            isBlocked,
                            predCode: pred.task_code,
                            succCode: succ.task_code
                        });
                    }
                });
            }
        });

        return links;
    }, [tasks, startDate, dayWidth]);

    return (
        <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden select-none" data-testid="TASK-05-gantt">
            {/* Toolbar */}
            <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-[#17212F] uppercase tracking-wider">
                        Timeline Zoom:
                    </span>
                    <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium">
                        <button
                            onClick={() => setZoom("day")}
                            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                                zoom === "day" ? "bg-[#17365D] text-white font-semibold" : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            Days (44px)
                        </button>
                        <button
                            onClick={() => setZoom("week")}
                            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                                zoom === "week" ? "bg-[#17365D] text-white font-semibold" : "text-slate-600 hover:text-slate-900"
                            }`}
                        >
                            Compact (24px)
                        </button>
                    </div>

                    <div className="h-4 w-px bg-slate-200 mx-1"></div>

                    {/* Auto-Cascade Toggle (Acceptance criteria) */}
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={autoCascade}
                            onChange={(e) => setAutoCascade(e.target.checked)}
                            className="rounded border-slate-300 text-[#2878C7] focus:ring-[#2878C7]"
                        />
                        <span>Auto-Cascade Dependencies (FS)</span>
                    </label>

                    {/* Critical Path Toggle */}
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showCriticalPath}
                            onChange={(e) => setShowCriticalPath(e.target.checked)}
                            className="rounded border-slate-300 text-[#EF4444] focus:ring-red-400"
                        />
                        <span>Highlight Critical Path</span>
                    </label>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#2878C7]"></span>
                        <span>Normal Task</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#EF4444]"></span>
                        <span>Blocked Task / Critical</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-xs bg-[#10B981]"></span>
                        <span>Completed</span>
                    </div>
                </div>
            </div>

            {/* Split Gantt Container */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Task Hierarchy Column */}
                <div
                    style={{ width: `${leftWidth}px` }}
                    className="border-r border-slate-200 bg-white flex flex-col shrink-0 z-20 shadow-xs"
                >
                    {/* Header */}
                    <div
                        style={{ height: `${headerHeight}px` }}
                        className="px-4 border-b border-slate-200 flex items-center justify-between font-bold text-xs uppercase tracking-wider text-[#17212F] bg-slate-100/70"
                    >
                        <span>Tasks ({tasks.length})</span>
                        <span className="text-[11px] text-slate-400">Reschedule</span>
                    </div>

                    {/* Rows */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                        {tasks.map((t) => (
                            <div
                                key={t.id}
                                style={{ height: `${rowHeight}px` }}
                                onClick={() => onOpenDetail(t.id)}
                                className={`px-3 flex items-center justify-between hover:bg-blue-50/50 transition-colors cursor-pointer group ${
                                    t.is_blocked ? "bg-red-50/30" : ""
                                }`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <span className="font-mono text-xs font-bold text-[#17365D]">
                                        #{t.task_code}
                                    </span>
                                    <span className="text-xs font-semibold text-[#17212F] truncate group-hover:text-[#2878C7]">
                                        {t.title}
                                    </span>
                                </div>

                                {/* Quick +/- Day Shift Controls */}
                                <div
                                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <button
                                        onClick={() => handleShiftTask(t, -1)}
                                        className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] cursor-pointer"
                                        title="Shift -1 day"
                                    >
                                        -1d
                                    </button>
                                    <button
                                        onClick={() => handleShiftTask(t, 1)}
                                        className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] cursor-pointer"
                                        title="Shift +1 day"
                                    >
                                        +1d
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Interactive SVG Timeline Canvas */}
                <div className="flex-1 overflow-auto bg-[#F6F8FB] relative">
                    <div style={{ width: `${totalDays * dayWidth}px`, height: `${headerHeight + tasks.length * rowHeight}px` }}>
                        {/* Timeline Header (Dates) */}
                        <div
                            style={{ height: `${headerHeight}px` }}
                            className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 flex"
                        >
                            {datesList.map((d, i) => {
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                const isToday = d.toDateString() === new Date().toDateString();

                                return (
                                    <div
                                        key={i}
                                        style={{ width: `${dayWidth}px` }}
                                        className={`shrink-0 border-r border-slate-200/80 flex flex-col items-center justify-center text-[10px] select-none ${
                                            isToday ? "bg-blue-100/60 font-bold text-[#17365D]" : isWeekend ? "bg-slate-200/40 text-slate-400" : "text-slate-600"
                                        }`}
                                    >
                                        <span className="font-semibold uppercase">
                                            {d.toLocaleDateString([], { weekday: "narrow" })}
                                        </span>
                                        <span className="text-[11px] font-bold">
                                            {d.getDate()}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Grid Background Lines */}
                        <div className="absolute top-[48px] bottom-0 left-0 right-0 pointer-events-none flex">
                            {datesList.map((d, i) => {
                                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                return (
                                    <div
                                        key={i}
                                        style={{ width: `${dayWidth}px` }}
                                        className={`shrink-0 border-r border-slate-200/50 h-full ${
                                            isWeekend ? "bg-slate-100/30" : ""
                                        }`}
                                    ></div>
                                );
                            })}
                        </div>

                        {/* SVG Dependency Arrows Canvas */}
                        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                            <defs>
                                <marker
                                    id="arrowhead-normal"
                                    markerWidth="8"
                                    markerHeight="6"
                                    refX="7"
                                    refY="3"
                                    orient="auto"
                                >
                                    <polygon points="0 0, 8 3, 0 6" fill="#2878C7" />
                                </marker>
                                <marker
                                    id="arrowhead-blocked"
                                    markerWidth="8"
                                    markerHeight="6"
                                    refX="7"
                                    refY="3"
                                    orient="auto"
                                >
                                    <polygon points="0 0, 8 3, 0 6" fill="#EF4444" />
                                </marker>
                            </defs>

                            {dependencyLinks.map((link) => {
                                // Orthogonal stepped connector path
                                const midX = (link.startX + link.endX) / 2;
                                const pathD = `M ${link.startX} ${link.startY} L ${midX} ${link.startY} L ${midX} ${link.endY} L ${link.endX} ${link.endY}`;

                                return (
                                    <path
                                        key={link.id}
                                        d={pathD}
                                        fill="none"
                                        stroke={link.isBlocked ? "#EF4444" : "#2878C7"}
                                        strokeWidth={link.isBlocked ? "2" : "1.5"}
                                        strokeDasharray={link.isBlocked ? "3,2" : "none"}
                                        markerEnd={link.isBlocked ? "url(#arrowhead-blocked)" : "url(#arrowhead-normal)"}
                                    />
                                );
                            })}
                        </svg>

                        {/* Task Duration Bars */}
                        <div className="relative pt-[0px] z-10">
                            {tasks.map((t, index) => {
                                const s = t.start_date ? new Date(t.start_date) : new Date(t.created_at);
                                const e = t.due_date ? new Date(t.due_date) : new Date(s.getTime() + 86400000 * 2);

                                const left = getXForDate(s);
                                const right = getXForDate(e);
                                const width = Math.max(dayWidth, right - left);
                                const top = index * rowHeight;

                                const isBlocked = t.is_blocked;
                                const isDone = t.status === "done";
                                const isCritical = showCriticalPath && (isBlocked || t.priority === "urgent");

                                let barBg = "bg-[#2878C7]";
                                if (isDone) barBg = "bg-[#10B981]";
                                else if (isBlocked || isCritical) barBg = "bg-[#EF4444]";
                                else if (t.status === "in_progress") barBg = "bg-blue-600";

                                return (
                                    <div
                                        key={t.id}
                                        style={{
                                            position: "absolute",
                                            top: `${top + 8}px`,
                                            left: `${left}px`,
                                            width: `${width}px`,
                                            height: `${rowHeight - 16}px`
                                        }}
                                        onClick={() => onOpenDetail(t.id)}
                                        className={`rounded-lg ${barBg} text-white shadow-xs flex items-center px-2 text-[11px] font-semibold cursor-pointer hover:brightness-110 hover:shadow-md transition-all group overflow-hidden ${
                                            isBlocked ? "ring-2 ring-red-400" : ""
                                        }`}
                                        title={`${t.task_code}: ${t.title} (${t.status})`}
                                    >
                                        <span className="truncate whitespace-nowrap">
                                            {isBlocked ? `⛔ ${t.task_code}` : t.task_code}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
