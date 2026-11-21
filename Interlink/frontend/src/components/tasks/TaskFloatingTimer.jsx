import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTaskTimer } from "../../context/TaskTimerContext";

export default function TaskFloatingTimer() {
    const navigate = useNavigate();
    const {
        activeTimer,
        formattedTime,
        isPaused,
        activeDrawerTaskId,
        idleAlert,
        handleKeepIdleTime,
        handleDeductIdleTime,
        pause,
        resume,
        stopAndSave,
        discard
    } = useTaskTimer();

    const [submitting, setSubmitting] = useState(false);

    if (!activeTimer) return null;

    // If the drawer for this specific task is currently open in front of the user,
    // the timer is already visible inside the drawer, so hide the floating pill to avoid clutter
    if (activeDrawerTaskId === activeTimer.taskId) {
        return null;
    }

    const handleOpenTask = () => {
        navigate(`/tasks?taskId=${activeTimer.taskId}`);
    };

    const handleQuickSave = async () => {
        try {
            setSubmitting(true);
            await stopAndSave();
        } finally {
            setSubmitting(false);
        }
    };

    const handleQuickDiscard = () => {
        if (window.confirm(`Discard timer for #${activeTimer.taskCode}? Time will not be logged.`)) {
            discard();
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2 select-none animate-in fade-in slide-in-from-bottom-4 duration-200">
            {/* Idle Warning Notification Banner */}
            {idleAlert && (
                <div className="bg-amber-500 text-white text-xs px-4 py-2 rounded-xl shadow-xl flex items-center gap-2.5 border border-amber-400/50 backdrop-blur-md animate-bounce">
                    <i className="fa-solid fa-bed text-sm"></i>
                    <span>
                        Idle for <strong>{idleAlert.idleMinutes}m</strong> detected.
                    </span>
                    <button
                        onClick={handleKeepIdleTime}
                        className="px-2 py-0.5 bg-white/20 hover:bg-white/30 rounded text-[11px] font-semibold cursor-pointer"
                        title="Keep full elapsed time"
                    >
                        Keep All
                    </button>
                    <button
                        onClick={handleDeductIdleTime}
                        className="px-2 py-0.5 bg-black/30 hover:bg-black/40 rounded text-[11px] font-semibold cursor-pointer"
                        title="Subtract idle time"
                    >
                        Deduct {idleAlert.idleMinutes}m
                    </button>
                </div>
            )}

            {/* Main Floating Pill */}
            <div className="bg-[#17365D]/95 hover:bg-[#17365D] text-white px-4 py-2.5 rounded-full shadow-2xl border border-white/20 flex items-center gap-3 backdrop-blur-md transition-all">
                {/* Status Dot */}
                <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isPaused ? "bg-amber-400" : "bg-emerald-400 animate-pulse"
                    }`}
                    title={isPaused ? "Timer Paused" : "Timer Running"}
                ></span>

                {/* Clock Display */}
                <span className="font-mono text-sm font-bold tracking-wider text-white">
                    {formattedTime}
                </span>

                <div className="h-4 w-px bg-white/20"></div>

                {/* Task Info Pill (Click to open Drawer) */}
                <button
                    type="button"
                    onClick={handleOpenTask}
                    className="flex items-center gap-1.5 text-left group cursor-pointer max-w-[180px]"
                    title={`Click to open #${activeTimer.taskCode} details`}
                >
                    <span className="font-mono text-xs font-bold text-sky-300 group-hover:underline">
                        #{activeTimer.taskCode}
                    </span>
                    <span className="text-xs text-slate-200 truncate group-hover:text-white">
                        {activeTimer.title}
                    </span>
                </button>

                <div className="h-4 w-px bg-white/20"></div>

                {/* Controls */}
                <div className="flex items-center gap-1.5">
                    {/* Pause / Resume */}
                    {isPaused ? (
                        <button
                            type="button"
                            onClick={resume}
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 text-emerald-400 flex items-center justify-center text-xs transition-colors cursor-pointer"
                            title="Resume Timer"
                        >
                            <i className="fa-solid fa-play"></i>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={pause}
                            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 text-amber-300 flex items-center justify-center text-xs transition-colors cursor-pointer"
                            title="Pause Timer"
                        >
                            <i className="fa-solid fa-pause"></i>
                        </button>
                    )}

                    {/* Direct Stop & Log (No notes prompt) */}
                    <button
                        type="button"
                        disabled={submitting}
                        onClick={handleQuickSave}
                        className="px-2.5 py-1 rounded-full bg-[#2878C7] hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                        title="Stop & Log Time"
                    >
                        <i className="fa-solid fa-stop text-[10px]"></i>
                        <span>{submitting ? "Saving..." : "Save"}</span>
                    </button>

                    {/* Discard */}
                    <button
                        type="button"
                        onClick={handleQuickDiscard}
                        className="w-6 h-6 rounded-full hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center text-xs transition-colors cursor-pointer ml-0.5"
                        title="Discard Timer"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}
