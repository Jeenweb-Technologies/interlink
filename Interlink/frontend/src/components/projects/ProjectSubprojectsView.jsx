import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getSubprojects } from "../../api/projectApi";
import ProjectCreateModal from "./ProjectCreateModal";

export default function ProjectSubprojectsView({ projectId, projectCode, parentProject }) {
    const navigate = useNavigate();
    const [subprojects, setSubprojects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createModalOpen, setCreateModalOpen] = useState(false);

    const loadSubprojects = async () => {
        try {
            setLoading(true);
            const res = await getSubprojects(projectId);
            if (res.data?.success) {
                setSubprojects(res.data.data || []);
            }
        } catch (err) {
            console.error("Load subprojects error:", err);
            toast.error("Failed to load sub-projects");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) {
            loadSubprojects();
        }
    }, [projectId]);

    if (loading) {
        return (
            <div className="p-6 bg-white rounded-xl border border-slate-200 animate-pulse space-y-3">
                <div className="h-6 w-48 bg-slate-200 rounded"></div>
                <div className="h-20 bg-slate-100 rounded-lg"></div>
                <div className="h-20 bg-slate-100 rounded-lg"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-[#17212F]">Sub-Projects & Workstreams</h3>
                    <p className="text-xs text-[#5B6573]">
                        Independent child workstreams governed under this project initiative
                    </p>
                </div>
                <button
                    onClick={() => setCreateModalOpen(true)}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
                >
                    <i className="fa-solid fa-folder-plus text-xs"></i>
                    <span>+ New Sub-Project</span>
                </button>
            </div>

            {/* List */}
            {subprojects.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2878C7] flex items-center justify-center text-xl mx-auto mb-3">
                        <i className="fa-solid fa-folder-tree"></i>
                    </div>
                    <h4 className="text-sm font-bold text-[#17212F]">No Sub-projects Yet</h4>
                    <p className="text-xs text-[#5B6573] max-w-sm mx-auto mt-1 mb-4">
                        Break this project down into independent initiatives with dedicated budgets and teams.
                    </p>
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg shadow-sm cursor-pointer"
                    >
                        Create Sub-project
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {subprojects.map((sub) => {
                        const progress = Math.min(Math.max(Number(sub.progress_percentage) || 0, 0), 100);
                        return (
                            <div
                                key={sub.id}
                                onClick={() => navigate(`/projects/${sub.id}`)}
                                className="bg-white border border-[#E2E8F0] hover:border-[#2878C7] rounded-xl p-5 shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-mono text-xs font-bold text-[#17365D] bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                            {sub.code}
                                        </span>
                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 capitalize">
                                            {sub.status}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-bold text-[#17212F] line-clamp-1 mb-1">
                                        {sub.name}
                                    </h4>
                                    <p className="text-xs text-[#5B6573] line-clamp-2 leading-relaxed mb-3">
                                        {sub.description || "No description provided."}
                                    </p>
                                    <div className="space-y-1 mb-3">
                                        <div className="flex justify-between text-[11px] font-semibold text-[#5B6573]">
                                            <span>Progress</span>
                                            <span>{progress}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[#2878C7] rounded-full"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#5B6573]">
                                    <span className="font-medium text-[#17212F]">
                                        Lead: {sub.owner_name || "Unassigned"}
                                    </span>
                                    <span className="font-semibold text-blue-600 flex items-center gap-1 group-hover:underline">
                                        <span>Open Workspace</span>
                                        <i className="fa-solid fa-arrow-right text-[10px]"></i>
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Subproject Modal (reuses main project modal with common prefilled items) */}
            <ProjectCreateModal
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                parentProject={parentProject || { id: projectId, code: projectCode }}
                onCreated={() => {
                    setCreateModalOpen(false);
                    loadSubprojects();
                }}
            />
        </div>
    );
}
