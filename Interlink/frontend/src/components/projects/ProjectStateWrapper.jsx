import React from "react";

export default function ProjectStateWrapper({
    loading = false,
    error = null,
    onRetry = null,
    permissionDenied = false,
    isEmpty = false,
    isFilterEmpty = false,
    onClearFilters = null,
    onAction = null,
    actionLabel = "+ New Project",
    emptyTitle = "No projects yet",
    emptyDescription = "Get started by creating your first project or launching from an enterprise blueprint template.",
    children
}) {
    // 1. Loading Skeleton
    if (loading) {
        return (
            <div className="w-full space-y-4 p-6 animate-pulse" data-testid="project-loading-skeleton">
                {/* Metric Skeletons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-28 bg-slate-200/80 rounded-xl"></div>
                    ))}
                </div>
                {/* Filter & Card/Table Skeleton */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                    <div className="h-8 w-64 bg-slate-200 rounded"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="h-44 bg-slate-100 rounded-xl border border-slate-200 p-4 space-y-3">
                                <div className="h-5 w-2/3 bg-slate-200 rounded"></div>
                                <div className="h-3 w-1/3 bg-slate-200 rounded"></div>
                                <div className="h-2 w-full bg-slate-200 rounded mt-4"></div>
                                <div className="h-4 w-1/2 bg-slate-200 rounded mt-2"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // 2. Permission Denied (403)
    if (permissionDenied) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm" data-testid="project-permission-denied">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mb-4 border border-amber-200">
                    <i className="fa-solid fa-lock"></i>
                </div>
                <h3 className="text-xl font-bold text-[#17212F] mb-2">Restricted Project Workspace</h3>
                <p className="text-sm text-[#5B6573] max-w-md mb-6 leading-relaxed">
                    This project is marked as private or restricted. You must be added as a project member, manager, or executive sponsor to access its workspace.
                </p>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => window.history.back()}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                        Go Back
                    </button>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className="px-4 py-2 text-sm font-semibold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg transition-colors cursor-pointer"
                        >
                            Retry Access
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // 3. Error / Retry State
    if (error) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-red-200 shadow-sm" data-testid="project-error-state">
                <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#EF4444] flex items-center justify-center text-3xl mb-4 border border-red-200">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h3 className="text-xl font-bold text-[#17212F] mb-2">Unable to Load Project Information</h3>
                <p className="text-sm text-[#5B6573] max-w-md mb-6 leading-relaxed">
                    {typeof error === "string" ? error : error?.message || "An unexpected error occurred while contacting the server. Please try again."}
                </p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                        <i className="fa-solid fa-rotate-right"></i>
                        <span>Try Again</span>
                    </button>
                )}
            </div>
        );
    }

    // 4. No Search / Filter Results State
    if (isFilterEmpty) {
        return (
            <div className="min-h-[360px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm" data-testid="project-no-search-results">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center text-2xl mb-3 border border-slate-200">
                    <i className="fa-solid fa-magnifying-glass"></i>
                </div>
                <h4 className="text-lg font-bold text-[#17212F] mb-1">No Projects Match Your Filters</h4>
                <p className="text-sm text-[#5B6573] max-w-sm mb-5">
                    We couldn't find any projects matching your current filter criteria or search keyword.
                </p>
                {onClearFilters && (
                    <button
                        onClick={onClearFilters}
                        className="px-4 py-2 text-xs font-semibold text-[#17365D] bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    >
                        <i className="fa-solid fa-xmark"></i>
                        <span>Clear All Filters</span>
                    </button>
                )}
            </div>
        );
    }

    // 5. Empty Data State
    if (isEmpty) {
        return (
            <div className="min-h-[380px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-dashed border-slate-300" data-testid="project-empty-state">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#2878C7] flex items-center justify-center text-3xl mb-4 border border-blue-100 shadow-sm">
                    <i className="fa-solid fa-diagram-project"></i>
                </div>
                <h3 className="text-xl font-bold text-[#17212F] mb-1.5">{emptyTitle}</h3>
                <p className="text-sm text-[#5B6573] max-w-md mb-6 leading-relaxed">
                    {emptyDescription}
                </p>
                {onAction && (
                    <button
                        onClick={onAction}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg shadow-sm transition-all cursor-pointer inline-flex items-center gap-2 hover:shadow"
                    >
                        <i className="fa-solid fa-plus text-xs"></i>
                        <span>{actionLabel}</span>
                    </button>
                )}
            </div>
        );
    }

    // 6. Normal Content Render
    return <>{children}</>;
}
