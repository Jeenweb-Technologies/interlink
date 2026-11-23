import React, { useState } from "react";
import toast from "react-hot-toast";
import { updateNote, createNote } from "../../api/noteApi";
import { stripHtmlToText } from "./NoteCard";

export default function NoteConflictModal({
    isOpen,
    conflictData,
    onClose,
    onResolved
}) {
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen || !conflictData) return null;

    const { noteId, serverNote, localPayload } = conflictData;

    // Option 1: Force Overwrite (using server's new version so it succeeds)
    const handleOverwrite = async () => {
        setSubmitting(true);
        try {
            await updateNote(noteId, {
                ...localPayload,
                version: serverNote.version, // adopt latest version to force write
                change_summary: "Resolved edit conflict by overwriting"
            });
            toast.success("Note overwritten with your edits");
            if (onResolved) onResolved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to overwrite note");
        } finally {
            setSubmitting(false);
        }
    };

    // Option 2: Save as a New Note
    const handleSaveAsNew = async () => {
        setSubmitting(true);
        try {
            await createNote({
                ...localPayload,
                title: `${localPayload.title || "Note"} (My Divergent Copy)`
            });
            toast.success("Saved your edits as a separate new note");
            if (onResolved) onResolved();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to create new note copy");
        } finally {
            setSubmitting(false);
        }
    };

    // Option 3: Discard and keep server version
    const handleDiscard = () => {
        toast("Discarded local unsaved changes", { icon: "ℹ️" });
        if (onResolved) onResolved();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-3xl bg-white rounded-xl border border-red-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Warning Banner Header */}
                <div className="px-6 py-4 bg-amber-50 border-b border-amber-200 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>

                    <div>
                        <h3 className="text-base font-bold text-amber-900">
                            Concurrent Edit Conflict Detected
                        </h3>
                        <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                            Another user saved changes to this note while you were working. To prevent accidental data loss, please choose how you would like to proceed.
                        </p>
                    </div>
                </div>

                {/* Diff Comparison Side by Side */}
                <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Server Note */}
                    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Current Server Version (v{serverNote?.version})
                                </span>
                                <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-700">
                                    Latest in Database
                                </span>
                            </div>

                            <h4 className="text-sm font-semibold text-slate-900 mb-2">
                                {serverNote?.title}
                            </h4>

                            <div className="text-xs text-slate-600 bg-white p-3 rounded border border-slate-200 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans">
                                {stripHtmlToText(serverNote?.content) || "No content"}
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-200">
                            Last saved: {serverNote?.updated_at ? new Date(serverNote.updated_at).toLocaleTimeString() : "Recently"}
                        </p>
                    </div>

                    {/* Right: Local Edits */}
                    <div className="p-4 rounded-lg border border-blue-200 bg-blue-50/50 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-[#17365D] uppercase tracking-wider">
                                    Your Local Unsaved Edits
                                </span>
                                <span className="text-[10px] bg-blue-100 text-[#2878C7] px-1.5 py-0.5 rounded font-semibold">
                                    Your Browser
                                </span>
                            </div>

                            <h4 className="text-sm font-semibold text-slate-900 mb-2">
                                {localPayload?.title}
                            </h4>

                            <div className="text-xs text-slate-800 bg-white p-3 rounded border border-blue-200 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans">
                                {stripHtmlToText(localPayload?.content) || "No content"}
                            </div>
                        </div>

                        <p className="text-[11px] text-blue-600 mt-3 pt-2 border-t border-blue-100 font-medium">
                            Has unsaved modifications
                        </p>
                    </div>
                </div>

                {/* Conflict Action Buttons */}
                <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={handleDiscard}
                        disabled={submitting}
                        className="px-3.5 py-2 text-xs font-medium rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 transition-colors"
                    >
                        Discard My Edits & Reload
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleSaveAsNew}
                            disabled={submitting}
                            className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#2878C7] text-[#2878C7] bg-white hover:bg-blue-50 transition-colors"
                        >
                            Save My Edits as New Note
                        </button>

                        <button
                            type="button"
                            onClick={handleOverwrite}
                            disabled={submitting}
                            className="px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-xs transition-colors flex items-center gap-1.5"
                        >
                            {submitting ? "Overwriting..." : "Overwrite Server Version"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
