import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { getProjectDocuments, uploadProjectDocument, deleteProjectDocument } from "../../api/projectApi";
import FilePreviewModal from "../FilePreviewModal";

export default function ProjectDocumentsView({ projectId }) {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [file, setFile] = useState(null);
    const [category, setCategory] = useState("general");
    const [uploading, setUploading] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);

    const loadDocuments = async () => {
        try {
            setLoading(true);
            const res = await getProjectDocuments(projectId);
            if (res.data?.success) {
                setDocuments(res.data.data || []);
            }
        } catch (err) {
            console.error("Load documents error:", err);
            toast.error("Failed to load documents");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (projectId) loadDocuments();
    }, [projectId]);

    const handleOpenFile = (doc) => {
        const fileUrl = doc.file_url || (doc.file_path?.startsWith("http")
            ? doc.file_path
            : `http://localhost:5000/uploads/${doc.file_path}`);
        setPreviewFile({
            name: doc.file_name,
            url: fileUrl,
            mimeType: doc.mime_type
        });
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            toast.error("Please select a file to upload");
            return;
        }

        try {
            setUploading(true);
            const formData = new FormData();
            formData.append("file", file);
            formData.append("category", category);

            const res = await uploadProjectDocument(projectId, formData);
            if (res.data?.success) {
                toast.success("Document attached to project!");
                setFile(null);
                setUploadModalOpen(false);
                loadDocuments();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to upload document");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (docId) => {
        if (!window.confirm("Are you sure you want to remove this project document?")) return;
        try {
            await deleteProjectDocument(docId);
            toast.success("Document deleted");
            loadDocuments();
        } catch (err) {
            toast.error("Failed to delete document");
        }
    };

    const formatBytes = (bytes) => {
        if (!bytes) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-3">
                <div className="h-6 w-48 bg-slate-200 rounded"></div>
                <div className="h-16 bg-slate-100 rounded-lg"></div>
                <div className="h-16 bg-slate-100 rounded-lg"></div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-[#17212F]">Project Documents &amp; Artifacts</h3>
                    <p className="text-xs text-[#5B6573]">
                        Centralized repository for briefs, specifications, contracts, and architecture RFCs
                    </p>
                </div>
                <button
                    onClick={() => setUploadModalOpen(true)}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                    <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
                    <span>Upload Document</span>
                </button>
            </div>

            {documents.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2878C7] flex items-center justify-center text-xl mx-auto mb-3">
                        <i className="fa-solid fa-folder-open"></i>
                    </div>
                    <h4 className="text-sm font-bold text-[#17212F]">No Documents Attached</h4>
                    <p className="text-xs text-[#5B6573] max-w-sm mx-auto mt-1 mb-4">
                        Upload technical specifications, contracts, and designs for this initiative.
                    </p>
                    <button
                        onClick={() => setUploadModalOpen(true)}
                        className="px-3.5 py-2 text-xs font-bold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg shadow-sm cursor-pointer"
                    >
                        Upload First Document
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[10px] font-bold text-[#5B6573] uppercase tracking-wider">
                                <tr>
                                    <th className="py-3 px-4">Document Name</th>
                                    <th className="py-3 px-4">Category</th>
                                    <th className="py-3 px-4">Size</th>
                                    <th className="py-3 px-4">Uploaded By</th>
                                    <th className="py-3 px-4">Date</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {documents.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                                        <td className="py-3 px-4 font-bold text-[#17212F]">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenFile(doc)}
                                                className="flex items-center gap-2 text-left hover:text-blue-600 transition-colors cursor-pointer group"
                                                title="Click to open attachment"
                                            >
                                                <i className="fa-regular fa-file-lines text-[#2878C7] text-sm group-hover:scale-110 transition-transform"></i>
                                                <span className="truncate max-w-xs group-hover:underline">{doc.file_name}</span>
                                            </button>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                                                {doc.category}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-slate-600">{formatBytes(doc.file_size)}</td>
                                        <td className="py-3 px-4 text-slate-700 font-medium">{doc.uploader_name || "User"}</td>
                                        <td className="py-3 px-4 text-slate-500">{new Date(doc.created_at).toLocaleDateString()}</td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenFile(doc)}
                                                    className="p-1.5 text-slate-500 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                                                    title="Open attachment"
                                                >
                                                    <i className="fa-regular fa-eye"></i>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(doc.id)}
                                                    className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                                    title="Delete document"
                                                >
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Upload Modal */}
            {uploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-base font-bold text-[#17212F]">Attach Document</h3>
                            <button onClick={() => setUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                        <form onSubmit={handleUpload} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">Select File *</label>
                                <input
                                    type="file"
                                    onChange={(e) => setFile(e.target.files[0])}
                                    className="w-full text-xs p-2 rounded-lg border border-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-[#17212F] mb-1">Classification Category</label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300"
                                >
                                    <option value="general">General Asset</option>
                                    <option value="brief">Project Brief</option>
                                    <option value="contract">Contract / SOW</option>
                                    <option value="architecture">Architecture RFC / Spec</option>
                                    <option value="report">Executive Status Report</option>
                                    <option value="meeting_notes">Meeting Notes</option>
                                </select>
                            </div>
                            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                                <button type="button" onClick={() => setUploadModalOpen(false)} className="px-3 py-1.5 text-xs text-slate-600 bg-slate-100 rounded-lg">Cancel</button>
                                <button type="submit" disabled={uploading} className="px-4 py-1.5 text-xs font-bold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg shadow-sm">
                                    {uploading ? "Uploading..." : "Upload File"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* File Preview Modal */}
            {previewFile && (
                <FilePreviewModal
                    file={previewFile}
                    canDownload={false}
                    onClose={() => setPreviewFile(null)}
                />
            )}
        </div>
    );
}
