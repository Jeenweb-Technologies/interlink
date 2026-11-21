import React, { useState } from "react";

export default function TaskCalendarView({
    tasks = [],
    onOpenDetail
}) {
    const [currentDate, setCurrentDate] = useState(new Date());

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const monthName = currentDate.toLocaleString("default", { month: "long" });

    // Build calendar grid cells
    const calendarCells = [];
    for (let i = 0; i < firstDayIndex; i++) {
        calendarCells.push({ empty: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const dayTasks = tasks.filter((t) => {
            if (!t.due_date) return false;
            const dueStr = new Date(t.due_date).toISOString().slice(0, 10);
            return dueStr === dateStr;
        });

        const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();

        calendarCells.push({
            day: d,
            dateStr,
            isToday,
            tasks: dayTasks
        });
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden select-none" data-testid="TASK-02-calendar">
            {/* Header */}
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-3">
                    <h2 className="text-sm font-bold text-[#17212F]">
                        {monthName} {year}
                    </h2>
                    <button
                        onClick={handleToday}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md cursor-pointer"
                    >
                        Today
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={handlePrevMonth}
                        className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 cursor-pointer"
                        title="Previous Month"
                    >
                        <i className="fa-solid fa-chevron-left text-xs"></i>
                    </button>
                    <button
                        onClick={handleNextMonth}
                        className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 cursor-pointer"
                        title="Next Month"
                    >
                        <i className="fa-solid fa-chevron-right text-xs"></i>
                    </button>
                </div>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100/70 text-center text-xs font-bold text-slate-600 py-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
                    <div key={idx} className={idx === 0 || idx === 6 ? "text-slate-400" : ""}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid */}
            <div className="flex-1 grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 overflow-y-auto">
                {calendarCells.map((cell, idx) => {
                    if (cell.empty) {
                        return <div key={idx} className="bg-slate-50/40 min-h-[100px]"></div>;
                    }

                    return (
                        <div
                            key={idx}
                            className={`p-2 min-h-[100px] flex flex-col gap-1 transition-colors hover:bg-blue-50/20 ${
                                cell.isToday ? "bg-blue-50/40" : "bg-white"
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <span
                                    className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                                        cell.isToday
                                            ? "bg-[#17365D] text-white"
                                            : "text-slate-700"
                                    }`}
                                >
                                    {cell.day}
                                </span>
                                {cell.tasks.length > 0 && (
                                    <span className="text-[10px] text-slate-400 font-semibold">
                                        {cell.tasks.length} task{cell.tasks.length > 1 ? "s" : ""}
                                    </span>
                                )}
                            </div>

                            <div className="space-y-1 overflow-y-auto max-h-24 pr-0.5">
                                {cell.tasks.map((t) => {
                                    const isDone = t.status === "done";
                                    const isBlocked = t.is_blocked;

                                    return (
                                        <div
                                            key={t.id}
                                            onClick={() => onOpenDetail(t.id)}
                                            className={`px-2 py-1 rounded text-[11px] font-semibold truncate cursor-pointer transition-all border ${
                                                isDone
                                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200 line-through"
                                                    : isBlocked
                                                    ? "bg-red-50 text-red-700 border-red-200"
                                                    : "bg-blue-50 text-[#17365D] border-blue-200 hover:bg-blue-100"
                                            }`}
                                            title={`#${t.task_code}: ${t.title}`}
                                        >
                                            {isBlocked ? "⛔ " : ""}#{t.task_code} {t.title}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
