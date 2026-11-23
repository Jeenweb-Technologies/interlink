import React, { useState, useEffect, useRef, useMemo } from "react";
import toast from "react-hot-toast";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import {
    getNoteById,
    createNote,
    updateNote,
    uploadNoteAttachment,
    deleteNoteAttachment,
    addNoteLink,
    deleteNoteLink,
    getLinkableEntities
} from "../../api/noteApi";

export default function NoteEditorModal({
    noteId = null,
    isOpen,
    onClose,
    onSaved,
    onConflictDetected
}) {
    const isEdit = Boolean(noteId);

    // Form state
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [color, setColor] = useState("#FFFFFF");
    const [priority, setPriority] = useState("medium");
    const [labels, setLabels] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const [isPinned, setIsPinned] = useState(false);
    const [version, setVersion] = useState(1);
    const [myPermission, setMyPermission] = useState("owner");

    // Checklists
    const [checklists, setChecklists] = useState([]);
    const [newChecklistText, setNewChecklistText] = useState("");

    // Attachments & Links
    const [attachments, setAttachments] = useState([]);
    const [links, setLinks] = useState([]);

    // Entity linking picker
    const [linkPickerOpen, setLinkPickerOpen] = useState(false);
    const [availableEntities, setAvailableEntities] = useState({ tasks: [], projects: [] });
    const [selectedEntityType, setSelectedEntityType] = useState("task");
    const [selectedEntityId, setSelectedEntityId] = useState("");

    // UI Loading & Submitting
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);

    const textareaRef = useRef(null);

    // Color options from palette
    const colorOptions = [
        { hex: "#FFFFFF", name: "White", border: "border-slate-300" },
        { hex: "#FEF3C7", name: "Amber", border: "border-amber-300" },
        { hex: "#D1FAE5", name: "Emerald", border: "border-emerald-300" },
        { hex: "#E0F2FE", name: "Sky", border: "border-sky-300" },
        { hex: "#F3E8FF", name: "Purple", border: "border-purple-300" },
        { hex: "#FFE4E6", name: "Rose", border: "border-rose-300" }
    ];

    // Load initial note details if editing
    useEffect(() => {
        if (!isOpen) return;

        if (isEdit) {
            setLoadingDetails(true);
            getNoteById(noteId)
                .then((res) => {
                    const n = res.data.note;
                    setTitle(n.title || "");
                    setContent(n.content || "");
                    setColor(n.color || "#FFFFFF");
                    setPriority(n.priority || "medium");
                    setLabels(Array.isArray(n.labels) ? n.labels : []);
                    setIsPinned(Boolean(n.is_pinned));
                    setVersion(n.version || 1);
                    setMyPermission(n.my_permission || "owner");
                    setChecklists(n.checklists || []);
                    setAttachments(n.attachments || []);
                    setLinks(n.links || []);
                })
                .catch((err) => {
                    console.error("Failed to fetch note:", err);
                    toast.error(err.response?.data?.message || "Failed to load note details");
                    onClose();
                })
                .finally(() => setLoadingDetails(false));
        } else {
            // Reset for new note
            setTitle("");
            setContent("");
            setColor("#FFFFFF");
            setPriority("medium");
            setLabels([]);
            setTagInput("");
            setIsPinned(false);
            setVersion(1);
            setMyPermission("owner");
            setChecklists([]);
            setAttachments([]);
            setLinks([]);
        }
    }, [isOpen, noteId, isEdit]);

    // Fetch linkable tasks and projects when link picker is opened
    const handleOpenLinkPicker = async () => {
        setLinkPickerOpen(true);
        if (availableEntities.tasks.length === 0 && availableEntities.projects.length === 0) {
            try {
                const res = await getLinkableEntities();
                setAvailableEntities(res.data);
                if (res.data.tasks.length > 0) {
                    setSelectedEntityId(res.data.tasks[0].id);
                } else if (res.data.projects.length > 0) {
                    setSelectedEntityId(res.data.projects[0].id);
                }
            } catch (err) {
                console.error("Failed to load linkable entities:", err);
            }
        }
    };

    const quillModules = useMemo(() => ({
        toolbar: [
            [{ header: [1, 2, 3, false] }],
            ["bold", "italic", "underline", "strike"],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ color: [] }, { background: [] }],
            ["blockquote", "code-block"],
            ["link", "clean"]
        ]
    }), []);

    // Checklist handlers
    const handleAddChecklist = (e) => {
        e.preventDefault();
        if (!newChecklistText.trim()) return;
        setChecklists([
            ...checklists,
            { id: Date.now(), item_text: newChecklistText.trim(), is_completed: false }
        ]);
        setNewChecklistText("");
    };

    const handleToggleChecklist = (index) => {
        const updated = [...checklists];
        updated[index].is_completed = !updated[index].is_completed;
        setChecklists(updated);
    };

    const handleDeleteChecklist = (index) => {
        setChecklists(checklists.filter((_, i) => i !== index));
    };

    // Label tag handlers
    const handleAddLabel = (e) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            const trimmed = tagInput.trim().replace(/^#/, "");
            if (trimmed && !labels.includes(trimmed)) {
                setLabels([...labels, trimmed]);
            }
            setTagInput("");
        }
    };

    const handleRemoveLabel = (labelToRemove) => {
        setLabels(labels.filter((l) => l !== labelToRemove));
    };

    // Attachment upload
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!isEdit) {
            toast("Save the note first to add attachments.", { icon: "ℹ️" });
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        setUploadingFile(true);
        try {
            const res = await uploadNoteAttachment(noteId, formData);
            setAttachments([res.data.attachment, ...attachments]);
            toast.success("Attachment uploaded");
        } catch (err) {
            console.error("Upload error:", err);
            toast.error(err.response?.data?.message || "Failed to upload file");
        } finally {
            setUploadingFile(false);
            e.target.value = "";
        }
    };

    const handleDeleteAttachment = async (attachmentId) => {
        try {
            await deleteNoteAttachment(noteId, attachmentId);
            setAttachments(attachments.filter((a) => a.id !== attachmentId));
            toast.success("Attachment deleted");
        } catch (err) {
            toast.error("Failed to delete attachment");
        }
    };

    // Link entity
    const handleAddEntityLink = async () => {
        if (!selectedEntityId) return;

        let titleStr = "";
        if (selectedEntityType === "task") {
            const t = availableEntities.tasks.find((x) => String(x.id) === String(selectedEntityId));
            titleStr = t ? `[${t.task_code}] ${t.title}` : `Task #${selectedEntityId}`;
        } else {
            const p = availableEntities.projects.find((x) => String(x.id) === String(selectedEntityId));
            titleStr = p ? `[${p.project_code || "PRJ"}] ${p.title}` : `Project #${selectedEntityId}`;
        }

        if (isEdit) {
            try {
                await addNoteLink(noteId, {
                    entity_type: selectedEntityType,
                    entity_id: selectedEntityId,
                    title: titleStr
                });
                setLinks([...links, { entity_type: selectedEntityType, entity_id: selectedEntityId, title: titleStr }]);
                setLinkPickerOpen(false);
                toast.success("Entity linked to note");
            } catch (err) {
                toast.error(err.response?.data?.message || "Failed to link entity");
            }
        } else {
            setLinks([...links, { entity_type: selectedEntityType, entity_id: selectedEntityId, title: titleStr }]);
            setLinkPickerOpen(false);
        }
    };

    const handleDeleteEntityLink = async (linkId, index) => {
        if (isEdit && linkId) {
            try {
                await deleteNoteLink(noteId, linkId);
                setLinks(links.filter((l) => l.id !== linkId));
                toast.success("Link removed");
            } catch (err) {
                toast.error("Failed to remove link");
            }
        } else {
            setLinks(links.filter((_, i) => i !== index));
        }
    };

    // Save note handler (handles optimistic concurrency & 409 Conflict)
    const handleSave = async () => {
        if (!title.trim()) {
            toast.error("Note title is required");
            return;
        }

        const payload = {
            title: title.trim(),
            content,
            color,
            priority,
            labels,
            is_pinned: isPinned,
            checklists,
            version // Send current version for concurrency check
        };

        setSaving(true);
        try {
            if (isEdit) {
                await updateNote(noteId, payload);
                toast.success("Note saved successfully");
            } else {
                await createNote({ ...payload, links });
                toast.success("Note created successfully");
            }
            onSaved();
            onClose();
        } catch (err) {
            console.error("Save note error:", err);
            // ─── 409 Conflict Trigger ─────────────────────────────────────────
            if (err.response?.status === 409 && err.response?.data?.conflict) {
                toast.error("Conflict detected: This note was updated by someone else.");
                if (onConflictDetected) {
                    onConflictDetected({
                        noteId,
                        serverNote: err.response.data.currentNote,
                        localPayload: payload,
                        onResolve: () => {
                            onSaved();
                            onClose();
                        }
                    });
                }
            } else {
                toast.error(err.response?.data?.message || "Failed to save note");
            }
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const canEdit = myPermission === "owner" || myPermission === "edit";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div
                style={{ backgroundColor: color !== "#FFFFFF" ? color : "#FFFFFF" }}
                className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-xl border border-slate-200 shadow-xl overflow-hidden transition-colors"
            >
                {/* Header Toolbar */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-white/70 backdrop-blur-xs">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-[#17365D]">
                            {isEdit ? `Editing Note (v${version})` : "New Note"}
                        </span>

                        {/* Priority Selector */}
                        <select
                            value={priority}
                            onChange={(e) => setPriority(e.target.value)}
                            disabled={!canEdit}
                            className="text-xs font-medium px-2 py-1 rounded border border-slate-200 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-[#2878C7]"
                        >
                            <option value="low">Priority: Low</option>
                            <option value="medium">Priority: Medium</option>
                            <option value="high">Priority: High</option>
                            <option value="urgent">Priority: Urgent</option>
                        </select>

                        {/* Color Palette Selector */}
                        <div className="flex items-center gap-1.5 ml-2">
                            {colorOptions.map((c) => (
                                <button
                                    key={c.hex}
                                    type="button"
                                    onClick={() => setColor(c.hex)}
                                    title={c.name}
                                    style={{ backgroundColor: c.hex }}
                                    className={`w-5 h-5 rounded-full border ${c.border} transition-transform ${
                                        color === c.hex ? "scale-125 ring-2 ring-[#2878C7] shadow-xs" : "hover:scale-110"
                                    }`}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Pin Button */}
                        <button
                            type="button"
                            onClick={() => setIsPinned(!isPinned)}
                            title={isPinned ? "Unpin note" : "Pin note to top"}
                            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                                isPinned
                                    ? "bg-blue-50 border-blue-200 text-[#2878C7]"
                                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                        >
                            <svg className="w-4 h-4" fill={isPinned ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                            </svg>
                            {isPinned ? "Pinned" : "Pin"}
                        </button>

                        {/* Close Modal */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Body Content */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {loadingDetails ? (
                        <div className="space-y-4 py-8 animate-pulse">
                            <div className="h-8 bg-slate-200 rounded w-2/3"></div>
                            <div className="h-32 bg-slate-200 rounded"></div>
                        </div>
                    ) : (
                        <>
                            {/* Title Input */}
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={!canEdit}
                                placeholder="Note title..."
                                className="w-full text-2xl font-bold text-[#17212F] placeholder-slate-400 bg-transparent border-0 border-b border-transparent hover:border-slate-200 focus:border-[#2878C7] focus:outline-none transition-colors pb-1"
                            />

                            {/* Rich Text Editor (ReactQuill as used in Shreepad ERP) */}
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Content</label>
                                <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-2xs [&_.ql-toolbar]:border-none [&_.ql-toolbar]:border-b [&_.ql-toolbar]:border-slate-200 [&_.ql-toolbar]:bg-slate-50/90 [&_.ql-container]:border-none [&_.ql-container]:min-h-[220px] [&_.ql-editor]:min-h-[220px] [&_.ql-editor]:text-sm">
                                    <ReactQuill
                                        theme="snow"
                                        value={content}
                                        onChange={(val) => setContent(val)}
                                        readOnly={!canEdit}
                                        modules={quillModules}
                                        placeholder="Write your note with rich text formatting..."
                                    />
                                </div>
                            </div>

                            {/* Checklists Section */}
                            <div className="bg-white/80 rounded-lg p-4 border border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-semibold text-[#17365D] uppercase tracking-wider flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                        </svg>
                                        Actionable Checklist
                                    </h4>
                                    <span className="text-xs text-slate-400">
                                        {checklists.filter((c) => c.is_completed).length} / {checklists.length} done
                                    </span>
                                </div>

                                {/* List of items */}
                                <div className="space-y-1.5 mb-3">
                                    {checklists.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2 group/chk">
                                            <input
                                                type="checkbox"
                                                checked={Boolean(item.is_completed)}
                                                onChange={() => handleToggleChecklist(idx)}
                                                disabled={myPermission === "view"}
                                                className="w-4 h-4 rounded border-slate-300 text-[#2878C7] focus:ring-[#2878C7] cursor-pointer"
                                            />
                                            <span className={`text-xs flex-1 ${item.is_completed ? "line-through text-slate-400" : "text-slate-800"}`}>
                                                {item.item_text}
                                            </span>
                                            {canEdit && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteChecklist(idx)}
                                                    className="opacity-0 group-hover/chk:opacity-100 text-slate-400 hover:text-red-500 p-0.5 text-xs"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* Add checklist item input */}
                                {canEdit && (
                                    <form onSubmit={handleAddChecklist} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newChecklistText}
                                            onChange={(e) => setNewChecklistText(e.target.value)}
                                            placeholder="Add an actionable todo item..."
                                            className="flex-1 text-xs px-3 py-1.5 rounded border border-slate-200 bg-white focus:outline-none focus:border-[#2878C7]"
                                        />
                                        <button
                                            type="submit"
                                            className="px-3 py-1.5 text-xs font-medium rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                                        >
                                            + Add
                                        </button>
                                    </form>
                                )}
                            </div>

                            {/* Linked Entities (Tasks, Projects, Meetings, Knowledge) */}
                            <div className="bg-white/80 rounded-lg p-4 border border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-semibold text-[#17365D] uppercase tracking-wider flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                        </svg>
                                        Linked Work Items
                                    </h4>
                                    {canEdit && (
                                        <button
                                            type="button"
                                            onClick={handleOpenLinkPicker}
                                            className="text-xs text-[#2878C7] hover:underline font-medium"
                                        >
                                            + Link Task / Project
                                        </button>
                                    )}
                                </div>

                                {links.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No tasks or projects linked to this note yet.</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {links.map((link, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-blue-200 bg-blue-50/80 text-blue-800"
                                            >
                                                <span className="font-semibold uppercase text-[10px] bg-blue-200/80 px-1 rounded text-blue-900">
                                                    {link.entity_type}
                                                </span>
                                                <span className="truncate max-w-[200px]">{link.title || `#${link.entity_id}`}</span>
                                                {canEdit && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteEntityLink(link.id, idx)}
                                                        className="text-blue-500 hover:text-red-500 ml-1 font-bold"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Link Picker Dropdown Sub-drawer */}
                                {linkPickerOpen && (
                                    <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-center gap-2 animate-in fade-in">
                                        <select
                                            value={selectedEntityType}
                                            onChange={(e) => setSelectedEntityType(e.target.value)}
                                            className="text-xs p-1.5 rounded border border-slate-200 bg-white"
                                        >
                                            <option value="task">Task</option>
                                            <option value="project">Project</option>
                                        </select>

                                        <select
                                            value={selectedEntityId}
                                            onChange={(e) => setSelectedEntityId(e.target.value)}
                                            className="text-xs p-1.5 rounded border border-slate-200 bg-white flex-1 min-w-[200px]"
                                        >
                                            {selectedEntityType === "task" ? (
                                                availableEntities.tasks.map((t) => (
                                                    <option key={t.id} value={t.id}>
                                                        [{t.task_code}] {t.title}
                                                    </option>
                                                ))
                                            ) : (
                                                availableEntities.projects.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        [{p.project_code || "PRJ"}] {p.title}
                                                    </option>
                                                ))
                                            )}
                                        </select>

                                        <button
                                            type="button"
                                            onClick={handleAddEntityLink}
                                            className="px-3 py-1.5 text-xs font-semibold rounded bg-[#17365D] text-white hover:bg-[#102642]"
                                        >
                                            Attach
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLinkPickerOpen(false)}
                                            className="px-2 py-1.5 text-xs text-slate-500 hover:text-slate-800"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Attachments Section */}
                            <div className="bg-white/80 rounded-lg p-4 border border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-semibold text-[#17365D] uppercase tracking-wider flex items-center gap-1.5">
                                        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                                        </svg>
                                        Attachments & Documents
                                    </h4>
                                    {canEdit && (
                                        <label className="text-xs text-[#2878C7] hover:underline font-medium cursor-pointer">
                                            {uploadingFile ? "Uploading..." : "+ Upload File"}
                                            <input
                                                type="file"
                                                onChange={handleFileUpload}
                                                disabled={uploadingFile}
                                                className="hidden"
                                            />
                                        </label>
                                    )}
                                </div>

                                {attachments.length === 0 ? (
                                    <p className="text-xs text-slate-400 italic">No files attached to this note.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {attachments.map((att) => (
                                            <div
                                                key={att.id}
                                                className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                                            >
                                                <a
                                                    href={att.file_url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-2 truncate text-[#2878C7] hover:underline"
                                                >
                                                    <svg className="w-4 h-4 shrink-0 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                                    </svg>
                                                    <span className="truncate">{att.file_name}</span>
                                                </a>

                                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                                    <span className="text-[10px] text-slate-400">
                                                        {(att.file_size / 1024).toFixed(1)} KB
                                                    </span>
                                                    {canEdit && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteAttachment(att.id)}
                                                            className="text-slate-400 hover:text-red-500 text-sm font-bold"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Labels & Tags Input */}
                            <div className="flex flex-wrap items-center gap-2 pt-2">
                                <span className="text-xs font-medium text-slate-500">Labels:</span>
                                {labels.map((lbl, idx) => (
                                    <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-slate-200 text-slate-700 rounded"
                                    >
                                        #{lbl}
                                        {canEdit && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveLabel(lbl)}
                                                className="hover:text-red-600 font-bold ml-0.5"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </span>
                                ))}
                                {canEdit && (
                                    <input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={handleAddLabel}
                                        placeholder="Add tag (press Enter)..."
                                        className="text-xs px-2 py-1 bg-white/70 border border-slate-200 rounded focus:outline-none focus:border-[#2878C7] w-36"
                                    />
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-white/80">
                    <span className="text-xs text-slate-400">
                        {myPermission !== "owner" && `Permission: Can ${myPermission}`}
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>

                        {canEdit && (
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving || loadingDetails}
                                className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#17365D] hover:bg-[#102642] text-white shadow-xs transition-colors flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                        </svg>
                                        Saving...
                                    </>
                                ) : (
                                    "Save Note"
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
