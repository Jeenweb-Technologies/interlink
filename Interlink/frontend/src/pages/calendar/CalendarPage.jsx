import React, { useState, useEffect, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { getCalendarFeed, getCalendars, createCalendar } from "../../api/calendarApi";
import EventEditorModal from "../../components/calendar/EventEditorModal";
import CalendarShareModal from "../../components/calendar/CalendarShareModal";

export default function CalendarPage() {
    const user = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("user") || "{}");
        } catch {
            return {};
        }
    }, []);

    // Current navigation date & view
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentView, setCurrentView] = useState("month"); // 'month', 'week', 'day', 'agenda'
    const [timezone, setTimezone] = useState("UTC");

    // Module overlay filters
    const [includeEvents, setIncludeEvents] = useState(true);
    const [includeMeetings, setIncludeMeetings] = useState(true);
    const [includeTasks, setIncludeTasks] = useState(true);
    const [includeProjects, setIncludeProjects] = useState(true);
    const [includeReminders, setIncludeReminders] = useState(true);

    // Calendars state
    const [calendars, setCalendars] = useState([]);
    const [selectedCalendarIds, setSelectedCalendarIds] = useState([]);
    const [loadingCalendars, setLoadingCalendars] = useState(true);

    // Items feed state
    const [feedItems, setFeedItems] = useState([]);
    const [loadingFeed, setLoadingFeed] = useState(true);
    const [feedError, setFeedError] = useState(null);

    // Modals
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedInitialDate, setSelectedInitialDate] = useState(null);

    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [calendarToShare, setCalendarToShare] = useState(null);

    const [showNewCalendarInput, setShowNewCalendarInput] = useState(false);
    const [newCalendarName, setNewCalendarName] = useState("");
    const [newCalendarColor, setNewCalendarColor] = useState("#2878C7");

    // Calculate current visible date window depending on active view
    const dateRange = useMemo(() => {
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth();

        if (currentView === "month") {
            const firstDay = new Date(y, m, 1);
            const lastDay = new Date(y, m + 1, 0);
            return {
                startDate: new Date(firstDay.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                endDate: new Date(lastDay.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            };
        } else if (currentView === "week") {
            const d = new Date(currentDate);
            const dayOfWeek = d.getDay(); // 0 is Sun
            const start = new Date(d.setDate(d.getDate() - dayOfWeek));
            const end = new Date(d.setDate(d.getDate() + 6));
            return {
                startDate: start.toISOString().slice(0, 10),
                endDate: end.toISOString().slice(0, 10)
            };
        } else {
            // Day or Agenda
            return {
                startDate: new Date(currentDate.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                endDate: new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            };
        }
    }, [currentDate, currentView]);

    // Fetch user accessible calendars
    const fetchCalendars = useCallback(async () => {
        setLoadingCalendars(true);
        try {
            const res = await getCalendars();
            if (res.data?.success) {
                const list = res.data.data || [];
                setCalendars(list);
                setSelectedCalendarIds(list.map(c => c.id));
            }
        } catch (err) {
            console.error("Failed to load calendars:", err);
        } finally {
            setLoadingCalendars(false);
        }
    }, []);

    // Fetch unified feed items
    const fetchFeed = useCallback(async () => {
        setLoadingFeed(true);
        setFeedError(null);
        try {
            const res = await getCalendarFeed({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
                includeEvents,
                includeMeetings,
                includeTasks,
                includeProjects,
                includeReminders,
                calendarIds: selectedCalendarIds.join(",")
            });
            if (res.data?.success) {
                setFeedItems(res.data.data || []);
            }
        } catch (err) {
            console.error("Failed to load feed:", err);
            setFeedError("Failed to synchronize calendar events.");
        } finally {
            setLoadingFeed(false);
        }
    }, [dateRange, includeEvents, includeMeetings, includeTasks, includeProjects, includeReminders, selectedCalendarIds]);

    useEffect(() => {
        fetchCalendars();
    }, [fetchCalendars]);

    useEffect(() => {
        if (selectedCalendarIds.length >= 0) {
            fetchFeed();
        }
    }, [fetchFeed, selectedCalendarIds]);

    // Navigator actions
    const handlePrev = () => {
        const d = new Date(currentDate);
        if (currentView === "month") d.setMonth(d.getMonth() - 1);
        else if (currentView === "week") d.setDate(d.getDate() - 7);
        else d.setDate(d.getDate() - 1);
        setCurrentDate(d);
    };

    const handleNext = () => {
        const d = new Date(currentDate);
        if (currentView === "month") d.setMonth(d.getMonth() + 1);
        else if (currentView === "week") d.setDate(d.getDate() + 7);
        else d.setDate(d.getDate() + 1);
        setCurrentDate(d);
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    // Toggle specific calendar selection
    const toggleCalendarSelection = (calId) => {
        if (selectedCalendarIds.includes(calId)) {
            setSelectedCalendarIds(selectedCalendarIds.filter(id => id !== calId));
        } else {
            setSelectedCalendarIds([...selectedCalendarIds, calId]);
        }
    };

    // Quick add calendar
    const handleCreateCalendar = async (e) => {
        e.preventDefault();
        if (!newCalendarName.trim()) return;
        try {
            const res = await createCalendar({
                name: newCalendarName.trim(),
                color: newCalendarColor,
                type: 'personal'
            });
            if (res.data?.success) {
                toast.success("Calendar created!");
                setNewCalendarName("");
                setShowNewCalendarInput(false);
                fetchCalendars();
            }
        } catch (err) {
            toast.error("Failed to create calendar");
        }
    };

    // Open Event Modal
    const handleOpenCreateEvent = (dateStr = null) => {
        setSelectedEvent(null);
        setSelectedInitialDate(dateStr || new Date().toISOString().slice(0, 10));
        setIsEventModalOpen(true);
    };

    const handleOpenEditEvent = (item) => {
        setSelectedEvent(item);
        setIsEventModalOpen(true);
    };

    const monthTitle = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

    // Month Grid Generator
    const monthGridData = useMemo(() => {
        if (currentView !== "month") return [];
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        const firstDayIdx = new Date(year, month, 1).getDay(); // 0 = Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();

        const cells = [];

        // Previous month filler days
        for (let i = firstDayIdx - 1; i >= 0; i--) {
            const dayNum = daysInPrevMonth - i;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            cells.push({
                day: dayNum,
                dateStr,
                isOtherMonth: true,
                isToday: false,
                items: []
            });
        }

        // Current month days
        const todayStr = new Date().toISOString().slice(0, 10);
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayItems = feedItems.filter(item => {
                if (!item.startTime) return false;
                const itemDateStr = item.startTime.slice(0, 10);
                return itemDateStr === dateStr;
            });

            cells.push({
                day: d,
                dateStr,
                isOtherMonth: false,
                isToday: dateStr === todayStr,
                items: dayItems
            });
        }

        // Next month filler days to complete grid (multiples of 7)
        const totalCells = Math.ceil(cells.length / 7) * 7;
        let nextDay = 1;
        while (cells.length < totalCells) {
            const dateStr = `${year}-${String(month + 2).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
            cells.push({
                day: nextDay,
                dateStr,
                isOtherMonth: true,
                isToday: false,
                items: []
            });
            nextDay++;
        }

        return cells;
    }, [currentDate, currentView, feedItems]);

    // Week Grid Days
    const weekDays = useMemo(() => {
        if (currentView !== "week") return [];
        const start = new Date(dateRange.startDate);
        const days = [];
        const todayStr = new Date().toISOString().slice(0, 10);

        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().slice(0, 10);
            const dayItems = feedItems.filter(item => item.startTime?.slice(0, 10) === dateStr);

            days.push({
                date: d,
                dayNum: d.getDate(),
                dayName: d.toLocaleString("default", { weekday: "short" }),
                dateStr,
                isToday: dateStr === todayStr,
                items: dayItems
            });
        }
        return days;
    }, [currentView, dateRange, feedItems]);

    return (
        <div className="flex-1 flex flex-col bg-[#F6F8FB] min-h-[calc(100vh-4rem)] select-none" data-testid="CAL-01-calendar">
            {/* Top Navigation & View Controller */}
            <div className="bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 shadow-xs">
                {/* Left: Month title & Nav Buttons */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
                        <button
                            onClick={handlePrev}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white transition-all cursor-pointer shadow-2xs"
                            title="Previous"
                        >
                            <i className="fa-solid fa-chevron-left text-xs"></i>
                        </button>
                        <button
                            onClick={handleToday}
                            className="px-3 h-8 rounded-lg text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-white transition-all cursor-pointer shadow-2xs"
                        >
                            Today
                        </button>
                        <button
                            onClick={handleNext}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-white transition-all cursor-pointer shadow-2xs"
                            title="Next"
                        >
                            <i className="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    </div>

                    <h1 className="text-xl font-black tracking-tight text-[#17212F] flex items-center gap-2">
                        <span>{monthTitle}</span>
                        {loadingFeed && <i className="fa-solid fa-circle-notch fa-spin text-blue-500 text-sm"></i>}
                    </h1>
                </div>

                {/* Right: View Switcher & Action Buttons */}
                <div className="flex items-center gap-3">
                    {/* View Switcher Tabs */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                        {["month", "week", "day", "agenda"].map((v) => (
                            <button
                                key={v}
                                onClick={() => setCurrentView(v)}
                                className={`px-3.5 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                                    currentView === v
                                        ? "bg-white text-[#17365D] shadow-xs font-black"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                {v}
                            </button>
                        ))}
                    </div>

                    {/* Timezone Selector */}
                    <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                        <i className="fa-solid fa-globe text-blue-500 text-xs"></i>
                        <span>{timezone}</span>
                    </div>

                    {/* Primary "New Event" Button */}
                    <button
                        onClick={() => handleOpenCreateEvent()}
                        className="px-4 py-2 rounded-xl bg-[#17365D] hover:bg-[#102642] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                    >
                        <i className="fa-solid fa-plus text-xs"></i>
                        <span>New Event</span>
                    </button>
                </div>
            </div>

            {/* Main Workspace Layout (Sidebar + Calendar Grid) */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Mini-Rail / Filters Sidebar */}
                <aside className="w-64 border-r border-slate-200 bg-white p-5 flex flex-col gap-6 shrink-0 overflow-y-auto hidden md:flex">
                    {/* Quick Create Action */}
                    <button
                        onClick={() => handleOpenCreateEvent()}
                        className="w-full py-2.5 px-3 rounded-xl border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50/50 hover:bg-blue-50 text-blue-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <i className="fa-solid fa-calendar-plus"></i>
                        <span>Schedule on Calendar</span>
                    </button>

                    {/* My Calendars List */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                My Calendars
                            </span>
                            <button
                                onClick={() => setShowNewCalendarInput(!showNewCalendarInput)}
                                className="text-slate-400 hover:text-blue-600 text-xs cursor-pointer"
                                title="Add Calendar"
                            >
                                <i className="fa-solid fa-plus"></i>
                            </button>
                        </div>

                        {showNewCalendarInput && (
                            <form onSubmit={handleCreateCalendar} className="mb-3 p-2 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                                <input
                                    type="text"
                                    value={newCalendarName}
                                    onChange={(e) => setNewCalendarName(e.target.value)}
                                    placeholder="Calendar name..."
                                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                                    autoFocus
                                />
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-1">
                                        {["#2878C7", "#10B981", "#8B5CF6", "#F59E0B"].map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setNewCalendarColor(c)}
                                                style={{ backgroundColor: c }}
                                                className={`w-4 h-4 rounded-full ${newCalendarColor === c ? "ring-2 ring-slate-400" : ""}`}
                                            />
                                        ))}
                                    </div>
                                    <button
                                        type="submit"
                                        className="px-2.5 py-1 bg-blue-600 text-white rounded-md text-[10px] font-bold"
                                    >
                                        Save
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="space-y-1.5">
                            {calendars.map((c) => (
                                <div key={c.id} className="flex items-center justify-between group py-1 px-1.5 rounded-lg hover:bg-slate-50">
                                    <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                                        <input
                                            type="checkbox"
                                            checked={selectedCalendarIds.includes(c.id)}
                                            onChange={() => toggleCalendarSelection(c.id)}
                                            className="rounded-sm border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                                        />
                                        <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                            style={{ backgroundColor: c.color }}
                                        />
                                        <span className="text-xs font-semibold text-slate-700 truncate">
                                            {c.name}
                                        </span>
                                    </label>
                                    <button
                                        onClick={() => {
                                            setCalendarToShare(c);
                                            setIsShareModalOpen(true);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600 text-[10px] p-1 cursor-pointer transition-opacity"
                                        title="Share Calendar"
                                    >
                                        <i className="fa-solid fa-share-nodes"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Integrated Cross-Module Overlays */}
                    <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                            Integrated Overlays
                        </span>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeMeetings}
                                    onChange={(e) => setIncludeMeetings(e.target.checked)}
                                    className="rounded-sm border-slate-300 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
                                <span className="text-xs font-semibold text-slate-700">Interlink Meetings</span>
                            </label>

                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeTasks}
                                    onChange={(e) => setIncludeTasks(e.target.checked)}
                                    className="rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="text-xs font-semibold text-slate-700">Task Due Dates</span>
                            </label>

                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeProjects}
                                    onChange={(e) => setIncludeProjects(e.target.checked)}
                                    className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
                                <span className="text-xs font-semibold text-slate-700">Project Deadlines</span>
                            </label>

                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={includeReminders}
                                    onChange={(e) => setIncludeReminders(e.target.checked)}
                                    className="rounded-sm border-slate-300 text-pink-600 focus:ring-pink-500 w-3.5 h-3.5 cursor-pointer"
                                />
                                <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shrink-0" />
                                <span className="text-xs font-semibold text-slate-700">Reminders</span>
                            </label>
                        </div>
                    </div>
                </aside>

                {/* Calendar Grid Canvas */}
                <main className="flex-1 flex flex-col p-4 md:p-6 overflow-y-auto">
                    {/* Error Banner */}
                    {feedError && (
                        <div className="mb-4 p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 flex items-center justify-between text-xs font-bold">
                            <span>{feedError}</span>
                            <button
                                onClick={fetchFeed}
                                className="px-3 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all cursor-pointer"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* MONTH VIEW */}
                    {currentView === "month" && (
                        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                            {/* Days of week header */}
                            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center py-2.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                                    <div key={day}>{day}</div>
                                ))}
                            </div>

                            {/* Month Grid Cells */}
                            <div className="flex-1 grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100">
                                {monthGridData.map((cell, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => handleOpenCreateEvent(cell.dateStr)}
                                        className={`min-h-[110px] p-2 flex flex-col transition-colors cursor-pointer group hover:bg-blue-50/20 ${
                                            cell.isOtherMonth ? "bg-slate-50/40 text-slate-400" : "bg-white text-slate-900"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span
                                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                                    cell.isToday
                                                        ? "bg-blue-600 text-white shadow-xs"
                                                        : cell.isOtherMonth
                                                        ? "text-slate-400"
                                                        : "text-slate-700"
                                                }`}
                                            >
                                                {cell.day}
                                            </span>
                                            {cell.items.length > 0 && (
                                                <span className="text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {cell.items.length} item{cell.items.length > 1 ? "s" : ""}
                                                </span>
                                            )}
                                        </div>

                                        {/* Event Pills */}
                                        <div className="flex-1 space-y-1 overflow-hidden">
                                            {cell.items.slice(0, 3).map((item) => (
                                                <div
                                                    key={item.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenEditEvent(item);
                                                    }}
                                                    style={{ borderLeftColor: item.color }}
                                                    className="px-2 py-1 rounded-md text-[11px] font-semibold truncate border-l-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-800 transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                                >
                                                    {item.sourceType === 'meeting' && <i className="fa-solid fa-video text-[9px] text-teal-600 shrink-0"></i>}
                                                    {item.sourceType === 'task' && <i className="fa-solid fa-list-check text-[9px] text-emerald-600 shrink-0"></i>}
                                                    {item.sourceType === 'project' && <i className="fa-solid fa-flag text-[9px] text-indigo-600 shrink-0"></i>}
                                                    {item.sourceType === 'reminder' && <i className="fa-solid fa-bell text-[9px] text-pink-600 shrink-0"></i>}
                                                    <span className="truncate">{item.title}</span>
                                                </div>
                                            ))}
                                            {cell.items.length > 3 && (
                                                <div className="text-[10px] font-bold text-blue-600 pl-1">
                                                    +{cell.items.length - 3} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* WEEK VIEW */}
                    {currentView === "week" && (
                        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 text-center py-3 divide-x divide-slate-200">
                                {weekDays.map((wd) => (
                                    <div key={wd.dateStr} className={`px-2 ${wd.isToday ? "bg-blue-50/50" : ""}`}>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase">{wd.dayName}</p>
                                        <p className={`text-base font-black ${wd.isToday ? "text-blue-600" : "text-slate-800"}`}>
                                            {wd.dayNum}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 p-2 min-h-[500px]">
                                {weekDays.map((wd) => (
                                    <div
                                        key={wd.dateStr}
                                        onClick={() => handleOpenCreateEvent(wd.dateStr)}
                                        className="p-1 space-y-1.5 hover:bg-slate-50/50 transition-colors cursor-pointer"
                                    >
                                        {wd.items.map((item) => (
                                            <div
                                                key={item.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenEditEvent(item);
                                                }}
                                                style={{ borderLeftColor: item.color }}
                                                className="p-2 rounded-xl text-xs font-bold border-l-4 bg-white border border-slate-200 shadow-2xs hover:shadow-xs transition-all space-y-1"
                                            >
                                                <div className="flex items-center gap-1.5 text-slate-800">
                                                    <span className="truncate">{item.title}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-medium">
                                                    {item.isAllDay ? "All Day" : new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* DAY & AGENDA VIEW */}
                    {(currentView === "day" || currentView === "agenda") && (
                        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-xs p-6 overflow-y-auto space-y-4">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">
                                Scheduled Agenda
                            </h3>
                            {feedItems.length === 0 ? (
                                <div className="py-16 text-center space-y-3">
                                    <i className="fa-regular fa-calendar-xmark text-4xl text-slate-300"></i>
                                    <p className="text-sm font-semibold text-slate-500">No events or deadlines scheduled for this period.</p>
                                    <button
                                        onClick={() => handleOpenCreateEvent()}
                                        className="px-4 py-2 bg-[#17365D] text-white text-xs font-bold rounded-xl shadow-xs"
                                    >
                                        Schedule an Event
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {feedItems.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleOpenEditEvent(item)}
                                            className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 bg-white hover:bg-slate-50 transition-all flex items-center justify-between cursor-pointer shadow-2xs group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div
                                                    className="w-3 h-10 rounded-full shrink-0"
                                                    style={{ backgroundColor: item.color }}
                                                />
                                                <div>
                                                    <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                                                        {item.title}
                                                    </h4>
                                                    <p className="text-xs text-slate-500">
                                                        {new Date(item.startTime).toLocaleDateString([], { month: "short", day: "numeric", weekday: "short" })} &bull;{" "}
                                                        {item.isAllDay ? "All Day" : `${new Date(item.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(item.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600">
                                                    {item.sourceType}
                                                </span>
                                                {item.meetingUrl && (
                                                    <a
                                                        href={item.meetingUrl}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                                                    >
                                                        <i className="fa-solid fa-video text-xs"></i>
                                                        <span>Join</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Event Editor / Detail Modal */}
            <EventEditorModal
                isOpen={isEventModalOpen}
                onClose={() => setIsEventModalOpen(false)}
                event={selectedEvent}
                initialDate={selectedInitialDate}
                calendars={calendars}
                onEventSaved={fetchFeed}
                onEventDeleted={fetchFeed}
            />

            {/* Calendar Sharing Modal */}
            <CalendarShareModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                calendar={calendarToShare}
            />
        </div>
    );
}
