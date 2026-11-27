import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import { getReminders, snoozeReminder, completeReminder } from "../../api/reminderApi";

// Play a pleasant 2-tone melodic notification chime using Web Audio API
const playChime = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        if (ctx.state === "suspended") {
            ctx.resume();
        }

        const playTone = (freq, start, duration) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
            gain.gain.setValueAtTime(0.2, ctx.currentTime + start);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(ctx.currentTime + start);
            osc.stop(ctx.currentTime + start + duration);
        };

        playTone(587.33, 0, 0.25); // D5
        playTone(880, 0.18, 0.45); // A5
    } catch (_) {
        // Audio playback may be restricted if user has not interacted with document yet
    }
};

// Show a system desktop notification if permitted
const showDesktopNotification = (alertData) => {
    try {
        if (!("Notification" in window)) return;
        if (Notification.permission === "granted") {
            new Notification(`🔔 Reminder: ${alertData.title}`, {
                body: alertData.description || "Your scheduled reminder is due now.",
                icon: "/favicon.ico"
            });
        } else if (Notification.permission === "default") {
            Notification.requestPermission();
        }
    } catch (_) {}
};

export default function ReminderNotificationManager() {
    const navigate = useNavigate();
    const [alerts, setAlerts] = useState([]);
    const shownIdsRef = useRef(new Set());
    const socketRef = useRef(null);

    const triggerAlert = useCallback((reminder) => {
        if (!reminder || !reminder.id) return;
        if (shownIdsRef.current.has(reminder.id)) return;

        shownIdsRef.current.add(reminder.id);
        playChime();
        showDesktopNotification(reminder);

        setAlerts((prev) => {
            if (prev.some((a) => a.id === reminder.id)) return prev;
            return [reminder, ...prev];
        });

        // Notify other components (like ReminderCenterPage) that a reminder became active
        window.dispatchEvent(new CustomEvent("reminder_updated", { detail: reminder }));
    }, []);

    // 1. Socket.IO connection for real-time alerts
    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) return;

        const socketUrl =
            import.meta.env.VITE_SOCKET_URL ||
            (import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "") : null) ||
            "http://localhost:5000";

        const socketPath = import.meta.env.VITE_SOCKET_PATH || "/api/socket.io";

        const socket = io(socketUrl, {
            path: socketPath,
            auth: { token },
            withCredentials: true,
            transports: ["polling", "websocket"],
            reconnectionAttempts: 10,
            reconnectionDelay: 3000
        });

        socketRef.current = socket;

        socket.on("reminder_alert", (data) => {
            triggerAlert(data);
        });

        socket.on("reminder_escalated", (data) => {
            triggerAlert({
                ...data,
                isEscalated: true
            });
        });

        return () => {
            socket.disconnect();
        };
    }, [triggerAlert]);

    // 2. High-precision fallback polling (every 25 seconds + on window focus)
    const checkDueReminders = useCallback(async () => {
        const token = localStorage.getItem("token");
        if (!token) return;

        try {
            const res = await getReminders({ status: "overdue", limit: 10 });
            if (res.data?.success && Array.isArray(res.data.data)) {
                res.data.data.forEach((rem) => {
                    // Only trigger if not already dismissed/snoozed in this session
                    if (!shownIdsRef.current.has(rem.id)) {
                        triggerAlert({
                            id: rem.id,
                            title: rem.title,
                            description: rem.description,
                            sourceType: rem.source_type,
                            sourceId: rem.source_id,
                            deepLinkUrl: rem.deep_link_url,
                            triggerAt: rem.trigger_at,
                            snoozeCount: rem.snooze_count
                        });
                    }
                });
            }
        } catch (_) {}
    }, [triggerAlert]);

    useEffect(() => {
        // Initial check after 3 seconds
        const initTimeout = setTimeout(checkDueReminders, 3000);

        // Periodic interval
        const interval = setInterval(checkDueReminders, 25000);

        // Also check whenever user switches back to this browser tab
        const handleFocus = () => checkDueReminders();
        window.addEventListener("focus", handleFocus);

        return () => {
            clearTimeout(initTimeout);
            clearInterval(interval);
            window.removeEventListener("focus", handleFocus);
        };
    }, [checkDueReminders]);

    // Action handlers for alert card
    const handleSnooze = async (id, minutes) => {
        try {
            await snoozeReminder(id, { minutes });
            toast.success(`Snoozed for ${minutes >= 60 ? `${minutes / 60} hour(s)` : `${minutes} mins`}`);
            setAlerts((prev) => prev.filter((a) => a.id !== id));
            window.dispatchEvent(new CustomEvent("reminder_updated"));
        } catch (_) {
            toast.error("Failed to snooze reminder");
        }
    };

    const handleComplete = async (id) => {
        try {
            await completeReminder(id);
            toast.success("Reminder completed!");
            setAlerts((prev) => prev.filter((a) => a.id !== id));
            window.dispatchEvent(new CustomEvent("reminder_updated"));
        } catch (_) {
            toast.error("Failed to mark complete");
        }
    };

    const handleDismiss = (id) => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
    };

    const handleOpenReminder = (alert) => {
        setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
        if (alert.deepLinkUrl) {
            navigate(alert.deepLinkUrl);
        } else {
            navigate("/reminders");
        }
    };

    if (alerts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none select-none">
            {alerts.map((alert) => (
                <div
                    key={alert.id}
                    className="pointer-events-auto bg-white rounded-2xl border-2 border-rose-300 shadow-2xl p-4 flex flex-col gap-3 animate-in slide-in-from-top-4 duration-200 ring-4 ring-rose-100"
                >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                <i className="fa-solid fa-bell animate-bounce text-sm"></i>
                            </span>
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">
                                    {alert.isEscalated ? "Escalated Reminder" : "Reminder Due"}
                                </span>
                                <h4
                                    onClick={() => handleOpenReminder(alert)}
                                    className="text-xs font-black text-slate-900 hover:text-blue-600 cursor-pointer line-clamp-1"
                                    title="Click to view"
                                >
                                    {alert.title}
                                </h4>
                            </div>
                        </div>

                        <button
                            onClick={() => handleDismiss(alert.id)}
                            className="text-slate-400 hover:text-slate-600 w-6 h-6 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Dismiss notification"
                        >
                            <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                    </div>

                    {/* Description if present */}
                    {alert.description && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 px-1">
                            {alert.description}
                        </p>
                    )}

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handleSnooze(alert.id, 15)}
                                className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                title="Snooze for 15 minutes"
                            >
                                <i className="fa-regular fa-clock text-[9px]"></i>
                                +15m
                            </button>
                            <button
                                onClick={() => handleSnooze(alert.id, 60)}
                                className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                                title="Snooze for 1 hour"
                            >
                                +1h
                            </button>
                        </div>

                        <button
                            onClick={() => handleComplete(alert.id)}
                            className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                        >
                            <i className="fa-solid fa-check text-[9px]"></i>
                            Complete
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
