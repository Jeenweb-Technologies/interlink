import React, { useState } from "react";

export default function RecordingConsentModal({ isOpen, onClose, onConfirmStart }) {
    const [hasAgreed, setHasAgreed] = useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-150">
            <div className="bg-slate-900 border border-rose-500/30 rounded-3xl max-w-md w-full p-6 text-white shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-500 border border-rose-500/30 flex items-center justify-center text-xl shrink-0">
                        <i className="fa-solid fa-record-vinyl animate-pulse"></i>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white">Initiate Meeting Recording</h3>
                        <p className="text-xs text-rose-300">Enterprise Compliance &amp; Consent Audit</p>
                    </div>
                </div>

                <div className="text-xs text-slate-300 leading-relaxed space-y-2 bg-white/5 p-3.5 rounded-2xl border border-white/10">
                    <p>
                        By activating recording, a persistent, un-dismissible banner will be displayed to all participants:
                    </p>
                    <blockquote className="border-l-2 border-rose-500 pl-2.5 italic text-slate-200 text-[11px]">
                        "This meeting is being recorded for workspace documentation and audit compliance."
                    </blockquote>
                    <p className="text-[11px] text-slate-400">
                        The recorded media and attendance timestamps will be archived to this workspace&apos;s project portfolio upon meeting completion.
                    </p>
                </div>

                <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer pt-1">
                    <input
                        type="checkbox"
                        checked={hasAgreed}
                        onChange={(e) => setHasAgreed(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500 mt-0.5"
                    />
                    <span>
                        I confirm that all participants have been notified and consent to in-meeting recording under enterprise policy.
                    </span>
                </label>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 text-xs font-semibold transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!hasAgreed}
                        onClick={() => {
                            onConfirmStart();
                            onClose();
                        }}
                        className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        <i className="fa-solid fa-circle-dot"></i>
                        <span>Start Recording</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
