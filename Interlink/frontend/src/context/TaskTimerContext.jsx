import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import {
    getActiveTimer,
    startTimer as apiStartTimer,
    stopTimer as apiStopTimer,
    discardTimer as apiDiscardTimer
} from "../api/taskApi";

const TaskTimerContext = createContext(null);

const STORAGE_KEY = "interlink_active_task_timer";
const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes of inactivity

export function TaskTimerProvider({ children }) {
    const [activeTimer, setActiveTimer] = useState(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? JSON.parse(saved) : null;
        } catch {
            return null;
        }
    });

    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [activeDrawerTaskId, setActiveDrawerTaskId] = useState(null);
    const [idleAlert, setIdleAlert] = useState(null); // { idleMinutes, detectedAt }
    const lastActivityRef = useRef(Date.now());
    const isIdleRef = useRef(false);

    // Synchronize running timer from backend on initial mount
    useEffect(() => {
        const syncWithBackend = async () => {
            try {
                const res = await getActiveTimer();
                if (res.data?.success && res.data.data) {
                    const serverTimer = res.data.data;
                    const serverStartEpoch = new Date(serverTimer.start_time).getTime();
                    const now = Date.now();
                    const diffSec = Math.max(0, Math.floor((now - serverStartEpoch) / 1000));

                    setActiveTimer((prev) => {
                        // If already stored locally for the same task, keep current pause state if paused
                        if (prev && prev.taskId === serverTimer.task_id) {
                            return prev;
                        }
                        const synced = {
                            taskId: serverTimer.task_id,
                            taskCode: serverTimer.task_code,
                            title: serverTimer.title,
                            startTime: serverTimer.start_time,
                            accumulatedSeconds: diffSec,
                            isPaused: false,
                            lastResumeTime: now
                        };
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
                        return synced;
                    });
                }
            } catch (err) {
                console.error("Failed to sync timer with backend:", err);
            }
        };

        syncWithBackend();
    }, []);

    // Save timer state to localStorage whenever changed
    useEffect(() => {
        if (activeTimer) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(activeTimer));
        } else {
            localStorage.removeItem(STORAGE_KEY);
            setElapsedSeconds(0);
        }
    }, [activeTimer]);

    // Timer Ticker (Drift-free, calculate from epoch)
    useEffect(() => {
        if (!activeTimer) {
            setElapsedSeconds(0);
            return;
        }

        const computeElapsed = () => {
            if (activeTimer.isPaused || !activeTimer.lastResumeTime) {
                return activeTimer.accumulatedSeconds || 0;
            }
            const currentRunSec = Math.max(0, Math.floor((Date.now() - activeTimer.lastResumeTime) / 1000));
            return (activeTimer.accumulatedSeconds || 0) + currentRunSec;
        };

        setElapsedSeconds(computeElapsed());

        if (activeTimer.isPaused) return;

        const interval = setInterval(() => {
            setElapsedSeconds(computeElapsed());
        }, 1000);

        return () => clearInterval(interval);
    }, [activeTimer]);

    // Inactivity / Idle behavior detection
    useEffect(() => {
        if (!activeTimer || activeTimer.isPaused) return;

        const handleUserAction = () => {
            const now = Date.now();
            const timeSinceLast = now - lastActivityRef.current;

            if (timeSinceLast >= IDLE_THRESHOLD_MS && !isIdleRef.current) {
                isIdleRef.current = true;
                const idleMins = Math.floor(timeSinceLast / 60000);
                setIdleAlert({
                    idleMinutes: idleMins,
                    detectedAt: now
                });
            }
            lastActivityRef.current = now;
        };

        window.addEventListener("mousemove", handleUserAction, { passive: true });
        window.addEventListener("keydown", handleUserAction, { passive: true });
        window.addEventListener("click", handleUserAction, { passive: true });
        window.addEventListener("scroll", handleUserAction, { passive: true });

        return () => {
            window.removeEventListener("mousemove", handleUserAction);
            window.removeEventListener("keydown", handleUserAction);
            window.removeEventListener("click", handleUserAction);
            window.removeEventListener("scroll", handleUserAction);
        };
    }, [activeTimer]);

    // Handle Idle Actions
    const handleKeepIdleTime = () => {
        setIdleAlert(null);
        isIdleRef.current = false;
        lastActivityRef.current = Date.now();
    };

    const handleDeductIdleTime = () => {
        if (!idleAlert || !activeTimer) return;
        const deductSec = idleAlert.idleMinutes * 60;
        setActiveTimer((prev) => {
            if (!prev) return null;
            const newAccumulated = Math.max(0, (prev.accumulatedSeconds || 0) - deductSec);
            return {
                ...prev,
                accumulatedSeconds: newAccumulated
            };
        });
        toast.success(`Deducted ${idleAlert.idleMinutes} minutes of idle time`);
        setIdleAlert(null);
        isIdleRef.current = false;
        lastActivityRef.current = Date.now();
    };

    // Public API: Start
    const start = useCallback(async (task) => {
        try {
            const res = await apiStartTimer(task.id);
            if (res.data?.success) {
                const now = Date.now();
                const newTimer = {
                    taskId: task.id,
                    taskCode: task.task_code,
                    title: task.title,
                    startTime: new Date().toISOString(),
                    accumulatedSeconds: 0,
                    isPaused: false,
                    lastResumeTime: now
                };
                setActiveTimer(newTimer);
                lastActivityRef.current = now;
                isIdleRef.current = false;
                toast.success(`Timer started for #${task.task_code}`);
            }
        } catch (err) {
            console.error("Start timer error:", err);
            toast.error(err.response?.data?.message || "Failed to start timer");
        }
    }, []);

    // Public API: Pause
    const pause = useCallback(() => {
        setActiveTimer((prev) => {
            if (!prev || prev.isPaused) return prev;
            const currentRunSec = Math.max(0, Math.floor((Date.now() - prev.lastResumeTime) / 1000));
            return {
                ...prev,
                accumulatedSeconds: (prev.accumulatedSeconds || 0) + currentRunSec,
                isPaused: true,
                lastResumeTime: null
            };
        });
    }, []);

    // Public API: Resume
    const resume = useCallback(() => {
        setActiveTimer((prev) => {
            if (!prev || !prev.isPaused) return prev;
            return {
                ...prev,
                isPaused: false,
                lastResumeTime: Date.now()
            };
        });
        lastActivityRef.current = Date.now();
    }, []);

    // Public API: Stop and Log Time
    const stopAndSave = useCallback(async (notes = "") => {
        if (!activeTimer) return;
        try {
            const res = await apiStopTimer({ notes, is_billable: true });
            if (res.data?.success) {
                const loggedMins = res.data.duration_minutes || Math.max(1, Math.round(elapsedSeconds / 60));
                toast.success(`Logged ${loggedMins}m to #${activeTimer.taskCode}`);
                const finishedTaskId = activeTimer.taskId;
                setActiveTimer(null);
                setIdleAlert(null);

                // Notify other components (list, detail) to reload data
                window.dispatchEvent(new CustomEvent("task-updated", { detail: { taskId: finishedTaskId } }));
            }
        } catch (err) {
            console.error("Stop timer error:", err);
            toast.error(err.response?.data?.message || "Failed to stop timer");
        }
    }, [activeTimer, elapsedSeconds]);

    // Public API: Discard
    const discard = useCallback(async () => {
        try {
            await apiDiscardTimer();
            setActiveTimer(null);
            setIdleAlert(null);
            toast("Timer discarded", { icon: "🗑️" });
        } catch (err) {
            console.error("Discard timer error:", err);
            setActiveTimer(null);
            setIdleAlert(null);
        }
    }, []);

    // Helper: format seconds to 00:00:00
    const formatTime = (secs) => {
        const hrs = Math.floor(secs / 3600);
        const mins = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    return (
        <TaskTimerContext.Provider
            value={{
                activeTimer,
                elapsedSeconds,
                formattedTime: formatTime(elapsedSeconds),
                isPaused: activeTimer?.isPaused || false,
                activeDrawerTaskId,
                setActiveDrawerTaskId,
                idleAlert,
                handleKeepIdleTime,
                handleDeductIdleTime,
                start,
                pause,
                resume,
                stopAndSave,
                discard,
                formatTime
            }}
        >
            {children}
        </TaskTimerContext.Provider>
    );
}

export function useTaskTimer() {
    const context = useContext(TaskTimerContext);
    if (!context) {
        throw new Error("useTaskTimer must be used within a TaskTimerProvider");
    }
    return context;
}
