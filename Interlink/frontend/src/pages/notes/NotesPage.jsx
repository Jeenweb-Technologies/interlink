import React, { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import {
    getNotes,
    deleteNote,
    togglePinNote
} from "../../api/noteApi";
import NoteCard from "../../components/notes/NoteCard";
import NoteEditorModal from "../../components/notes/NoteEditorModal";
import NoteShareModal from "../../components/notes/NoteShareModal";
import NoteHistoryDrawer from "../../components/notes/NoteHistoryDrawer";
import NoteConflictModal from "../../components/notes/NoteConflictModal";

export default function NotesPage() {
    // Current user id from localStorage or auth token
    const userStr = localStorage.getItem("user");
    const currentUser = userStr ? JSON.parse(userStr) : null;
    const currentUserId = currentUser?.id;

    // View state
    const [scope, setScope] = useState("my_notes"); // 'my_notes' | 'shared_with_me' | 'archived'
    const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'list'
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPriority, setSelectedPriority] = useState("all");
    const [selectedColor, setSelectedColor] = useState("all");

    // Data state
    const [notes, setNotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modals state
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState(null);

    const [shareOpen, setShareOpen] = useState(false);
    const [sharingNoteId, setSharingNoteId] = useState(null);

    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyNoteId, setHistoryNoteId] = useState(null);

    const [conflictModalOpen, setConflictModalOpen] = useState(false);
    const [conflictData, setConflictData] = useState(null);

    // Fetch notes from server
    const fetchNotes = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = { scope };
            if (selectedPriority !== "all") params.priority = selectedPriority;
            if (selectedColor !== "all") params.color = selectedColor;
            if (searchQuery.trim()) params.q = searchQuery.trim();

            const res = await getNotes(params);
            setNotes(res.data.notes || []);
        } catch (err) {
            console.error("Failed to load notes:", err);
            setError(err.response?.data?.message || "Failed to load notes. Please try again.");
        } finally {
            setLoading(false);
        }
    }, [scope, selectedPriority, selectedColor, searchQuery]);

    useEffect(() => {
        fetchNotes();
    }, [fetchNotes]);

    // Handlers
    const handleCreateNew = () => {
        setEditingNoteId(null);
        setEditorOpen(true);
    };

    const handleOpenNote = (note) => {
        setEditingNoteId(note.id);
        setEditorOpen(true);
    };

    const handleTogglePin = async (id) => {
        try {
            const res = await togglePinNote(id);
            setNotes((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_pinned: res.data.is_pinned } : n))
            );
            toast.success(res.data.message);
        } catch (err) {
            toast.error("Failed to toggle pin");
        }
    };

    const handleDeleteNote = async (id) => {
        if (!window.confirm("Are you sure you want to delete this note?")) return;
        try {
            await deleteNote(id);
            setNotes((prev) => prev.filter((n) => n.id !== id));
            toast.success("Note deleted successfully");
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to delete note");
        }
    };

    const handleOpenShare = (note) => {
        setSharingNoteId(note.id);
        setShareOpen(true);
    };

    const handleOpenHistory = (note) => {
        setHistoryNoteId(note.id);
        setHistoryOpen(true);
    };

    const handleConflictDetected = (data) => {
        setConflictData(data);
        setConflictModalOpen(true);
    };

    // Pinned vs regular notes split
    const { pinnedNotes, otherNotes } = useMemo(() => {
        const pinned = [];
        const other = [];
        notes.forEach((n) => {
            if (n.is_pinned) pinned.push(n);
            else other.push(n);
        });
        return { pinnedNotes: pinned, otherNotes: other };
    }, [notes]);

    const colorPills = [
        { hex: "all", label: "All Colors" },
        { hex: "#FFFFFF", label: "White" },
        { hex: "#FEF3C7", label: "Amber" },
        { hex: "#D1FAE5", label: "Emerald" },
        { hex: "#E0F2FE", label: "Sky" },
        { hex: "#F3E8FF", label: "Purple" },
        { hex: "#FFE4E6", label: "Rose" }
    ];

    const hasActiveFilters = searchQuery.trim() !== "" || selectedPriority !== "all" || selectedColor !== "all";

    return (
        <div className="flex-1 flex flex-col bg-[#F6F8FB] min-h-screen">
            {/* Page Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs text-[#5B6573] mb-1">
                            <span>Workspace</span>
                            <span>/</span>
                            <span className="font-medium text-[#17212F]">Notes & Scratchpad</span>
                        </div>
                        <h1 className="text-xl font-bold text-[#17212F] flex items-center gap-2">
                            <span>Notes</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-[#17365D]">
                                {notes.length} total
                            </span>
                        </h1>
                    </div>

                    {/* Primary New Note Action */}
                    <button
                        type="button"
                        onClick={handleCreateNew}
                        className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#17365D] hover:bg-[#102642] text-white shadow-xs transition-colors flex items-center justify-center gap-1.5 self-start sm:self-auto cursor-pointer"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>New Note</span>
                    </button>
                </div>

                {/* Scope Switcher Tabs */}
                <div className="flex items-center gap-6 mt-5 border-b border-slate-200 -mb-4">
                    <button
                        type="button"
                        onClick={() => setScope("my_notes")}
                        className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                            scope === "my_notes"
                                ? "border-[#2878C7] text-[#2878C7]"
                                : "border-transparent text-[#5B6573] hover:text-[#17212F]"
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        My Notes
                    </button>

                    <button
                        type="button"
                        onClick={() => setScope("shared_with_me")}
                        className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                            scope === "shared_with_me"
                                ? "border-[#2878C7] text-[#2878C7]"
                                : "border-transparent text-[#5B6573] hover:text-[#17212F]"
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        Shared with Me
                    </button>

                    <button
                        type="button"
                        onClick={() => setScope("archived")}
                        className={`pb-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
                            scope === "archived"
                                ? "border-[#2878C7] text-[#2878C7]"
                                : "border-transparent text-[#5B6573] hover:text-[#17212F]"
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                        Archived
                    </button>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="px-6 py-4 bg-white/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                    {/* Search Input */}
                    <div className="relative min-w-[220px] max-w-sm">
                        <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search notes by title or content..."
                            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:border-[#2878C7] focus:ring-1 focus:ring-[#2878C7]"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {/* Priority Filter */}
                    <select
                        value={selectedPriority}
                        onChange={(e) => setSelectedPriority(e.target.value)}
                        className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium"
                    >
                        <option value="all">All Priorities</option>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>

                    {/* Color Filter */}
                    <select
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium"
                    >
                        {colorPills.map((cp) => (
                            <option key={cp.hex} value={cp.hex}>
                                {cp.label}
                            </option>
                        ))}
                    </select>

                    {/* Clear Filters Button */}
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setSelectedPriority("all");
                                setSelectedColor("all");
                            }}
                            className="text-xs text-[#2878C7] hover:underline font-medium px-2 py-1"
                        >
                            Reset filters
                        </button>
                    )}
                </div>

                {/* View Switcher: Grid vs Dense List */}
                <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5">
                    <button
                        type="button"
                        onClick={() => setViewMode("grid")}
                        title="Grid View"
                        className={`p-1.5 rounded ${
                            viewMode === "grid" ? "bg-slate-100 text-[#17365D]" : "text-slate-400 hover:text-slate-700"
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("list")}
                        title="List View"
                        className={`p-1.5 rounded ${
                            viewMode === "list" ? "bg-slate-100 text-[#17365D]" : "text-slate-400 hover:text-slate-700"
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-6">
                {/* 1. Loading State */}
                {loading && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-48 bg-slate-200/70 rounded-xl"></div>
                        ))}
                    </div>
                )}

                {/* 2. Error State */}
                {!loading && error && (
                    <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-center max-w-lg mx-auto my-12">
                        <svg className="w-10 h-10 text-red-500 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-sm font-bold text-red-900 mb-1">Failed to Load Notes</h3>
                        <p className="text-xs text-red-700 mb-4">{error}</p>
                        <button
                            type="button"
                            onClick={fetchNotes}
                            className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* 3. Empty State (No Notes in current scope) */}
                {!loading && !error && notes.length === 0 && !hasActiveFilters && (
                    <div className="py-20 text-center max-w-md mx-auto">
                        <div className="w-16 h-16 rounded-full bg-slate-100 text-[#17365D] flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h3 className="text-base font-bold text-[#17212F] mb-1">
                            {scope === "my_notes" && "No notes created yet"}
                            {scope === "shared_with_me" && "No notes shared with you"}
                            {scope === "archived" && "No archived notes"}
                        </h3>
                        <p className="text-xs text-[#5B6573] mb-5 leading-relaxed">
                            {scope === "my_notes" && "Quickly capture ideas, meeting minutes, to-do checklists, or link tasks to project notes."}
                            {scope === "shared_with_me" && "When teammates share notes with you, they will appear here with your assigned permissions."}
                            {scope === "archived" && "Archived notes will be stored here for future reference."}
                        </p>
                        {scope === "my_notes" && (
                            <button
                                type="button"
                                onClick={handleCreateNew}
                                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#17365D] hover:bg-[#102642] text-white shadow-xs"
                            >
                                + Create Your First Note
                            </button>
                        )}
                    </div>
                )}

                {/* 4. No Results State (Filters or Search matched 0 items) */}
                {!loading && !error && notes.length === 0 && hasActiveFilters && (
                    <div className="py-16 text-center max-w-sm mx-auto">
                        <svg className="w-10 h-10 text-slate-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <h3 className="text-sm font-semibold text-[#17212F] mb-1">No Matching Notes Found</h3>
                        <p className="text-xs text-[#5B6573] mb-4">
                            Try adjusting your search keywords, priority, or color filters.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery("");
                                setSelectedPriority("all");
                                setSelectedColor("all");
                            }}
                            className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        >
                            Clear All Filters
                        </button>
                    </div>
                )}

                {/* 5. Render Notes */}
                {!loading && !error && notes.length > 0 && (
                    <div className="space-y-8">
                        {/* Pinned Notes Section */}
                        {pinnedNotes.length > 0 && (
                            <div>
                                <h2 className="text-xs font-bold uppercase text-[#17365D] tracking-wider mb-3 flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-[#2878C7]" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                    </svg>
                                    Pinned Notes ({pinnedNotes.length})
                                </h2>

                                <div className={
                                    viewMode === "grid"
                                        ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                                        : "flex flex-col gap-2.5"
                                }>
                                    {pinnedNotes.map((note) => (
                                        <NoteCard
                                            key={note.id}
                                            note={note}
                                            currentUserId={currentUserId}
                                            onOpen={handleOpenNote}
                                            onTogglePin={handleTogglePin}
                                            onShare={handleOpenShare}
                                            onHistory={handleOpenHistory}
                                            onDelete={handleDeleteNote}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Other Notes Section */}
                        {otherNotes.length > 0 && (
                            <div>
                                {pinnedNotes.length > 0 && (
                                    <h2 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-3">
                                        Other Notes ({otherNotes.length})
                                    </h2>
                                )}

                                <div className={
                                    viewMode === "grid"
                                        ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                                        : "flex flex-col gap-2.5"
                                }>
                                    {otherNotes.map((note) => (
                                        <NoteCard
                                            key={note.id}
                                            note={note}
                                            currentUserId={currentUserId}
                                            onOpen={handleOpenNote}
                                            onTogglePin={handleTogglePin}
                                            onShare={handleOpenShare}
                                            onHistory={handleOpenHistory}
                                            onDelete={handleDeleteNote}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Note Editor Modal */}
            <NoteEditorModal
                noteId={editingNoteId}
                isOpen={editorOpen}
                onClose={() => setEditorOpen(false)}
                onSaved={fetchNotes}
                onConflictDetected={handleConflictDetected}
            />

            {/* Note Share & Permissions Modal */}
            <NoteShareModal
                noteId={sharingNoteId}
                isOpen={shareOpen}
                onClose={() => setShareOpen(false)}
                onSharesUpdated={fetchNotes}
            />

            {/* Note Version & Activity History Drawer */}
            <NoteHistoryDrawer
                noteId={historyNoteId}
                isOpen={historyOpen}
                onClose={() => setHistoryOpen(false)}
                onVersionRestored={fetchNotes}
            />

            {/* Note Conflict Resolution Modal */}
            <NoteConflictModal
                isOpen={conflictModalOpen}
                conflictData={conflictData}
                onClose={() => setConflictModalOpen(false)}
                onResolved={fetchNotes}
            />
        </div>
    );
}
