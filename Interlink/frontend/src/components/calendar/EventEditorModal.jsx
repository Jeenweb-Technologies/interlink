import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { createEvent, updateEvent, deleteEvent, respondRSVP, checkAvailability } from "../../api/calendarApi";

export default function EventEditorModal({
    isOpen,
    onClose,
    event = null,
    initialDate = null,
    calendars = [],
    onEventSaved = () => {},
    onEventDeleted = () => {}
}) {
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    const [calendarId, setCalendarId] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [isAllDay, setIsAllDay] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [startTime, setStartTime] = useState("09:00");
    const [endDate, setEndDate] = useState("");
    const [endTime, setEndTime] = useState("10:00");
    const [category, setCategory] = useState("general");
    const [colorOverride, setColorOverride] = useState("#2878C7");
    const [hasMeeting, setHasMeeting] = useState(false);
    const [meetingUrl, setMeetingUrl] = useState("");
    const [recurrenceFreq, setRecurrenceFreq] = useState("none"); // none, DAILY, WEEKLY, MONTHLY
    
    // Attendees & availability
    const [attendeeEmail, setAttendeeEmail] = useState("");
    const [attendees, setAttendees] = useState([]);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [availabilityResult, setAvailabilityResult] = useState(null);

    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Initialize state when modal opens
    useEffect(() => {
        if (!isOpen) return;

        if (event) {
            setCalendarId(event.calendarId || event.calendar_id || calendars[0]?.id || "");
            setTitle(event.title || "");
            setDescription(event.description || "");
            setLocation(event.location || "");
            setIsAllDay(Boolean(event.isAllDay ?? event.is_all_day));
            
            const start = event.startTime || event.start_time;
            const end = event.endTime || event.end_time;
            if (start) {
                const sDate = new Date(start);
                setStartDate(sDate.toISOString().slice(0, 10));
                setStartTime(sDate.toTimeString().slice(0, 5));
            }
            if (end) {
                const eDate = new Date(end);
                setEndDate(eDate.toISOString().slice(0, 10));
                setEndTime(eDate.toTimeString().slice(0, 5));
            }
            setCategory(event.category || "general");
            setColorOverride(event.color || event.color_override || "#2878C7");
            setHasMeeting(Boolean(event.meetingUrl || event.meeting_url));
            setMeetingUrl(event.meetingUrl || event.meeting_url || "");
            setAttendees(event.attendees || []);
            setAvailabilityResult(null);
        } else {
            const defaultDate = initialDate || new Date().toISOString().slice(0, 10);
            setCalendarId(calendars[0]?.id || "");
            setTitle("");
            setDescription("");
            setLocation("");
            setIsAllDay(false);
            setStartDate(defaultDate);
            setStartTime("09:00");
            setEndDate(defaultDate);
            setEndTime("10:00");
            setCategory("general");
            setColorOverride("#2878C7");
            setHasMeeting(false);
            setMeetingUrl("");
            setAttendees([{ user_id: user.id, guest_name: user.name || "Organizer", is_organizer: true, rsvp_status: 'accepted' }]);
            setAvailabilityResult(null);
        }
    }, [isOpen, event, initialDate, calendars, user.id, user.name]);

    if (!isOpen) return null;

    const isReadOnly = event?.isReadOnly;
    const isMeetingModuleItem = event?.sourceType === 'meeting';
    const isTaskModuleItem = event?.sourceType === 'task';
    const isProjectModuleItem = event?.sourceType === 'project';
    const isReminderModuleItem = event?.sourceType === 'reminder';
    const isExternalModule = isMeetingModuleItem || isTaskModuleItem || isProjectModuleItem || isReminderModuleItem;

    const handleAddAttendee = () => {
        if (!attendeeEmail.trim()) return;
        setAttendees([...attendees, { guest_email: attendeeEmail.trim(), guest_name: attendeeEmail.trim(), rsvp_status: 'needs_action' }]);
        setAttendeeEmail("");
    };

    const handleRemoveAttendee = (idx) => {
        setAttendees(attendees.filter((_, i) => i !== idx));
    };

    // Live conflict detection
    const handleCheckConflicts = async () => {
        const userIds = attendees.map(a => a.user_id).filter(Boolean);
        if (userIds.length === 0) {
            toast("Add users with accounts to check live calendar conflicts", { icon: "ℹ️" });
            return;
        }

        const startISO = `${startDate}T${startTime}:00.000Z`;
        const endISO = `${endDate}T${endTime}:00.000Z`;

        setCheckingAvailability(true);
        try {
            const res = await checkAvailability({
                attendeeUserIds: userIds,
                startTime: startISO,
                endTime: endISO
            });
            if (res.data?.success) {
                setAvailabilityResult(res.data.data);
                if (res.data.data.hasConflict) {
                    toast.error("Scheduling conflict detected for one or more attendees!");
                } else {
                    toast.success("All selected attendees are free!");
                }
            }
        } catch (err) {
            console.error("Conflict check error:", err);
        } finally {
            setCheckingAvailability(false);
        }
    };

    const handleApplySuggestedSlot = (slot) => {
        const s = new Date(slot.startTime);
        const e = new Date(slot.endTime);
        setStartDate(s.toISOString().slice(0, 10));
        setStartTime(s.toTimeString().slice(0, 5));
        setEndDate(e.toISOString().slice(0, 10));
        setEndTime(e.toTimeString().slice(0, 5));
        setAvailabilityResult(null);
        toast.success(`Applied slot: ${slot.label}`);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.error("Please enter an event title");
            return;
        }

        const startISO = isAllDay ? `${startDate} 00:00:00` : `${startDate} ${startTime}:00`;
        const endISO = isAllDay ? `${endDate} 23:59:59` : `${endDate} ${endTime}:00`;

        // Auto-generate LiveKit room URL if meeting toggled and not provided
        let generatedMeetingUrl = meetingUrl;
        if (hasMeeting && !generatedMeetingUrl) {
            const randomCode = `room-${Math.random().toString(36).substring(2, 9)}`;
            generatedMeetingUrl = `/meetings/join/${randomCode}`;
        }

        setSaving(true);
        try {
            const payload = {
                calendar_id: calendarId,
                title: title.trim(),
                description: description.trim() || null,
                location: location.trim() || null,
                meeting_url: hasMeeting ? generatedMeetingUrl : null,
                is_all_day: isAllDay,
                start_time: startISO,
                end_time: endISO,
                category,
                color_override: colorOverride,
                is_recurring: recurrenceFreq !== "none",
                recurrence_rule: recurrenceFreq !== "none" ? { freq: recurrenceFreq } : null,
                attendees
            };

            if (event && event.sourceType === 'event') {
                await updateEvent(event.sourceId, payload);
                toast.success("Event updated successfully");
            } else {
                await createEvent(payload);
                toast.success("Event created successfully");
            }
            onEventSaved();
            onClose();
        } catch (err) {
            console.error("Save event error:", err);
            toast.error(err.response?.data?.message || "Failed to save event");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to remove this event?")) return;
        setDeleting(true);
        try {
            await deleteEvent(event.sourceId);
            toast.success("Event deleted");
            onEventDeleted();
            onClose();
        } catch (err) {
            toast.error("Failed to delete event");
        } finally {
            setDeleting(false);
        }
    };

    const handleRSVP = async (status) => {
        try {
            await respondRSVP(event.sourceId, { status });
            toast.success(`RSVP updated: ${status}`);
            onEventSaved();
            onClose();
        } catch (err) {
            toast.error("Failed to update RSVP");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs select-none">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2.5">
                        <span className="w-3.5 h-3.5 rounded-full shadow-xs" style={{ backgroundColor: colorOverride }}></span>
                        <h2 className="text-base font-bold text-[#17212F]">
                            {isExternalModule ? "View Linked Item" : event ? "Edit Calendar Event" : "Create New Event"}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                        <i className="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* External Module Banner */}
                    {isExternalModule && (
                        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <i className="fa-solid fa-arrow-up-right-from-square text-blue-600 text-lg"></i>
                                <div>
                                    <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                                        Source: {event.sourceType.toUpperCase()}
                                    </p>
                                    <p className="text-xs text-blue-700">
                                        This record is managed in its primary module and unified here without duplication.
                                    </p>
                                </div>
                            </div>
                            {event.deepLink && (
                                <a
                                    href={event.deepLink}
                                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs"
                                >
                                    Open in {event.sourceType}
                                </a>
                            )}
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Title <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            disabled={isReadOnly}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Design Architecture Sync"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-semibold focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all disabled:bg-slate-50 disabled:text-slate-500"
                            required
                        />
                    </div>

                    {/* Calendar & Color */}
                    {!isExternalModule && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Calendar
                                </label>
                                <select
                                    disabled={isReadOnly}
                                    value={calendarId}
                                    onChange={(e) => setCalendarId(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-medium focus:outline-hidden focus:border-blue-500 cursor-pointer"
                                >
                                    {calendars.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.name} ({c.type})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Color Pill
                                </label>
                                <div className="flex items-center gap-2 pt-1">
                                    {["#2878C7", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#06B6D4", "#EC4899"].map((col) => (
                                        <button
                                            key={col}
                                            type="button"
                                            onClick={() => setColorOverride(col)}
                                            style={{ backgroundColor: col }}
                                            className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                                                colorOverride === col ? "scale-125 ring-2 ring-offset-2 ring-slate-400" : "hover:scale-110"
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Date and Time Grid */}
                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                Event Timing
                            </span>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isAllDay}
                                    disabled={isReadOnly}
                                    onChange={(e) => setIsAllDay(e.target.checked)}
                                    className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                                <span className="text-xs font-semibold text-slate-600">All Day</span>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-slate-500">Start</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        disabled={isReadOnly}
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                                    />
                                    {!isAllDay && (
                                        <input
                                            type="time"
                                            disabled={isReadOnly}
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="w-28 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-slate-500">End</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        disabled={isReadOnly}
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                                    />
                                    {!isAllDay && (
                                        <input
                                            type="time"
                                            disabled={isReadOnly}
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="w-28 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Recurrence Selector */}
                        {!isExternalModule && (
                            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-600">Repeat:</span>
                                <select
                                    disabled={isReadOnly}
                                    value={recurrenceFreq}
                                    onChange={(e) => setRecurrenceFreq(e.target.value)}
                                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
                                >
                                    <option value="none">Does not repeat</option>
                                    <option value="DAILY">Daily</option>
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="MONTHLY">Monthly</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* LiveKit Video Conference Integration */}
                    {!isExternalModule && (
                        <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/40 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <i className="fa-solid fa-video text-teal-600"></i>
                                    <span className="text-xs font-bold text-teal-950 uppercase tracking-wider">
                                        LiveKit Video Meeting
                                    </span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={hasMeeting}
                                        disabled={isReadOnly}
                                        onChange={(e) => setHasMeeting(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                                </label>
                            </div>
                            {hasMeeting && (
                                <p className="text-xs text-teal-700">
                                    A dedicated LiveKit room code will be attached, enabling 1-click video conferencing for all invitees.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Location & Description */}
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Location / Link
                            </label>
                            <input
                                type="text"
                                disabled={isReadOnly}
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                                placeholder="e.g. Conference Room B or Zoom URL"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Description &amp; Agenda
                            </label>
                            <textarea
                                rows={3}
                                disabled={isReadOnly}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Meeting agenda, briefing notes..."
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800"
                            />
                        </div>
                    </div>

                    {/* Attendees & Live Conflict Detection */}
                    {!isExternalModule && (
                        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Attendees &amp; RSVP
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCheckConflicts}
                                    disabled={checkingAvailability}
                                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                    <i className={`fa-solid ${checkingAvailability ? "fa-spinner fa-spin" : "fa-calendar-check"}`}></i>
                                    <span>Check Conflicts</span>
                                </button>
                            </div>

                            {/* Add attendee input */}
                            {!isReadOnly && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={attendeeEmail}
                                        onChange={(e) => setAttendeeEmail(e.target.value)}
                                        placeholder="Add attendee email or name..."
                                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddAttendee();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddAttendee}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
                                    >
                                        Add
                                    </button>
                                </div>
                            )}

                            {/* Attendee list */}
                            <div className="flex flex-wrap gap-2 pt-1">
                                {attendees.map((a, i) => (
                                    <span
                                        key={i}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 font-medium shadow-2xs"
                                    >
                                        <i className="fa-regular fa-user text-[10px] text-slate-400"></i>
                                        <span>{a.guest_name || a.guest_email || a.user_id}</span>
                                        {a.is_organizer && (
                                            <span className="text-[9px] px-1 bg-blue-100 text-blue-700 font-bold rounded-xs">
                                                Host
                                            </span>
                                        )}
                                        {!isReadOnly && !a.is_organizer && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAttendee(i)}
                                                className="text-slate-400 hover:text-rose-500 cursor-pointer ml-1"
                                            >
                                                &times;
                                            </button>
                                        )}
                                    </span>
                                ))}
                            </div>

                            {/* Conflict Detection Results Banner */}
                            {availabilityResult && (
                                <div className={`p-3 rounded-lg text-xs border ${
                                    availabilityResult.hasConflict
                                        ? "bg-rose-50 border-rose-200 text-rose-800"
                                        : "bg-emerald-50 border-emerald-200 text-emerald-800"
                                }`}>
                                    {availabilityResult.hasConflict ? (
                                        <div className="space-y-2">
                                            <div className="font-bold flex items-center gap-1.5">
                                                <i className="fa-solid fa-triangle-exclamation"></i>
                                                <span>Conflict detected for:</span>
                                            </div>
                                            <ul className="list-disc list-inside space-y-0.5">
                                                {availabilityResult.conflictingAttendees.map((c, i) => (
                                                    <li key={i}>
                                                        <strong>{c.name}</strong> is busy with <em>"{c.conflictingWith}"</em>
                                                    </li>
                                                ))}
                                            </ul>
                                            {availabilityResult.suggestedSlots?.length > 0 && (
                                                <div className="pt-2 border-t border-rose-200">
                                                    <p className="font-bold text-[11px] text-rose-900 mb-1">
                                                        Suggested Free Slots:
                                                    </p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {availabilityResult.suggestedSlots.map((s, idx) => (
                                                            <button
                                                                key={idx}
                                                                type="button"
                                                                onClick={() => handleApplySuggestedSlot(s)}
                                                                className="px-2 py-1 rounded-md bg-white border border-rose-300 text-rose-700 font-bold hover:bg-rose-100 transition-all cursor-pointer text-[10px]"
                                                            >
                                                                {s.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="font-bold flex items-center gap-1.5">
                                            <i className="fa-solid fa-circle-check"></i>
                                            <span>All invitees are available during this slot!</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </form>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                        {event && !isExternalModule && !isReadOnly && (
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={deleting}
                                className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer"
                            >
                                {deleting ? "Deleting..." : "Delete Event"}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-all cursor-pointer"
                        >
                            Close
                        </button>

                        {!isReadOnly && !isExternalModule && (
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="px-5 py-2 rounded-xl bg-[#17365D] hover:bg-[#102642] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                            >
                                {saving ? "Saving..." : event ? "Save Changes" : "Create Event"}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
