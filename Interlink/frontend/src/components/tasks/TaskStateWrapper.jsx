import React from "react";

export default function TaskStateWrapper({
    loading = false,
    error = null,
    onRetry = null,
    permissionDenied = false,
    isEmpty = false,
    isFilterEmpty = false,
    onClearFilters = null,
    onAction = null,
    actionLabel = "+ Create Task",
    emptyTitle = "No tasks yet",
    emptyDescription = "Get started by creating your first task or importing from a template.",
    children
}) {
    // 1. Loading Skeleton
    if (loading) {
        return (
            <div className="w-full space-y-4 p-6 animate-pulse" data-testid="task-loading-skeleton">
                {/* Metric Skeletons */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-24 bg-slate-200/80 rounded-xl"></div>
                    ))}
                </div>
                {/* Table/Board Skeleton */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                    <div className="h-6 w-48 bg-slate-200 rounded"></div>
                    <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="h-12 bg-slate-100 rounded-lg flex items-center justify-between px-4">
                                <div className="h-4 w-1/3 bg-slate-200 rounded"></div>
                                <div className="h-4 w-24 bg-slate-200 rounded"></div>
                                <div className="h-4 w-16 bg-slate-200 rounded"></div>
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
            <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm" data-testid="task-permission-denied">
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mb-4 border border-amber-200">
                    <i className="fa-solid fa-shield-halved"></i>
                </div>
                <h3 className="text-xl font-bold text-[#17212F] mb-2">Access Restricted</h3>
                <p className="text-sm text-[#5B6573] max-w-md mb-6 leading-relaxed">
                    You do not have effective permissions to view or edit tasks in this project or team scope. Please contact your workspace administrator or team lead.
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
                            className="px-4 py-2 text-sm font-medium text-white bg-[#17365D] hover:bg-[#102642] rounded-lg transition-colors cursor-pointer"
                        >
                            Check Access Again
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // 3. Error / Retry State
    if (error) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-red-200 shadow-sm" data-testid="task-error-state">
                <div className="w-16 h-16 rounded-2xl bg-red-50 text-[#EF4444] flex items-center justify-center text-3xl mb-4 border border-red-200">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h3 className="text-xl font-bold text-[#17212F] mb-2">Unable to Load Tasks</h3>
                <p className="text-sm text-[#5B6573] max-w-md mb-6 leading-relaxed">
                    {typeof error === "string" ? error : error?.message || "An unexpected error occurred while loading task data. Please try again."}
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
            <div className="min-h-[360px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm" data-testid="task-no-results">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mb-4">
                    <i className="fa-solid fa-filter-circle-xmark"></i>
                </div>
                <h3 className="text-lg font-bold text-[#17212F] mb-1">No Matching Tasks Found</h3>
                <p className="text-sm text-[#5B6573] max-w-md mb-5">
                    We couldn't find any tasks matching your active filters or search terms. Try adjusting your query or reset filters.
                </p>
                {onClearFilters && (
                    <button
                        onClick={onClearFilters}
                        className="px-4 py-2 text-sm font-semibold text-[#2878C7] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-2"
                    >
                        <i className="fa-solid fa-xmark"></i>
                        <span>Clear All Filters</span>
                    </button>
                )}
            </div>
        );
    }

    // 5. Empty State (Zero Data)
    if (isEmpty) {
        return (
            <div className="min-h-[380px] flex flex-col items-center justify-center p-8 text-center bg-white rounded-xl border border-slate-200 shadow-sm" data-testid="task-empty-state">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 text-[#2878C7] flex items-center justify-center text-3xl mb-4 border border-blue-100">
                    <i className="fa-solid fa-list-check"></i>
                </div>
                <h3 className="text-xl font-bold text-[#17212F] mb-2">{emptyTitle}</h3>
                <p className="text-sm text-[#5B6573] max-w-md mb-6 leading-relaxed">
                    {emptyDescription}
                </p>
                {onAction && (
                    <button
                        onClick={onAction}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-[#17365D] hover:bg-[#102642] rounded-lg shadow-sm transition-all cursor-pointer inline-flex items-center gap-2"
                    >
                        <i className="fa-solid fa-plus"></i>
                        <span>{actionLabel}</span>
                    </button>
                )}
            </div>
        );
    }

    // 6. Success State
    return children;
}
