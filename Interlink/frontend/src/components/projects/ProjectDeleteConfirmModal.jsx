import React, { useState } from "react";
import toast from "react-hot-toast";
import { deleteProject } from "../../api/projectApi";

export default function ProjectDeleteConfirmModal({ isOpen, onClose, project, onDeleted }) {
    const [deleting, setDeleting] = useState(false);

    if (!isOpen || !project) return null;

    const handleDelete = async () => {
        try {
            setDeleting(true);
            const res = await deleteProject(project.id);
            if (res.data?.success) {
                toast.success("Project deleted successfully");
                if (onDeleted) {
                    onDeleted(project.id);
                }
                onClose();
            } else {
                toast.error(res.data?.message || "Failed to delete project");
            }
        } catch (err) {
            console.error("Delete project error:", err);
            toast.error(err.response?.data?.message || "Failed to delete project");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-lg border border-red-100 shrink-0">
                        <i className="fa-regular fa-trash-can"></i>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-[#17212F]">Delete Project?</h3>
                        <p className="text-xs text-slate-500">This action will remove the project from the active portfolio</p>
                    </div>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500">Project Name:</span>
                        <span className="font-bold text-[#17212F] truncate max-w-[200px]">{project.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-slate-500">Project Code:</span>
                        <span className="font-mono font-bold text-[#17365D] bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {project.code}
                        </span>
                    </div>
                    {project.parent_project_name && (
                        <div className="flex items-center justify-between text-slate-500">
                            <span>Parent Project:</span>
                            <span className="font-semibold text-slate-700">{project.parent_project_name}</span>
                        </div>
                    )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                    Are you sure you want to delete this project initiative? Associated workstreams, phases, and records will be archived and hidden.
                </p>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={deleting}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                    >
                        {deleting ? (
                            <>
                                <i className="fa-solid fa-circle-notch fa-spin"></i>
                                <span>Deleting...</span>
                            </>
                        ) : (
                            <>
                                <i className="fa-regular fa-trash-can"></i>
                                <span>Delete Project</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
