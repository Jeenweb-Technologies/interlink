import React from "react";
import { Link, useLocation } from "react-router-dom";
import { InterlinkLogo } from "../components/Sidebar";
import jwlogo from "../assets/jwLogo.jpeg";

export default function OrgPendingApproval() {
    const location = useLocation();
    const orgName = location.state?.orgName || "Your Organization";
    const email = location.state?.email || "";

    return (
        <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#06152d] via-slate-950 to-[#0b1b36] p-4 font-sans text-slate-200 relative overflow-hidden">
            {/* Ambient Glows */}
            <div className="absolute top-[30%] left-[30%] w-[35%] h-[40%] bg-blue-600/15 rounded-full blur-[130px] pointer-events-none" />
            <div className="absolute bottom-[20%] right-[30%] w-[30%] h-[35%] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl text-center relative z-10">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <InterlinkLogo size="lg" light={true} />
                </div>

                {/* Status Icon */}
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4 text-2xl shadow-lg shadow-amber-500/10">
                    <i className="fa-solid fa-hourglass-half animate-pulse"></i>
                </div>

                <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/20 inline-block mb-3">
                    Under Review
                </span>

                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Registration Pending Approval
                </h1>

                <p className="mt-3 text-xs sm:text-sm text-slate-400 leading-relaxed">
                    The registration for <span className="font-bold text-white">"{orgName}"</span> has been submitted to the platform developers.
                </p>

                <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-4 mt-5 text-left text-xs space-y-2">
                    <div className="flex items-center justify-between text-slate-400 border-b border-slate-850 pb-2">
                        <span>Organization:</span>
                        <span className="font-bold text-white">{orgName}</span>
                    </div>
                    {email && (
                        <div className="flex items-center justify-between text-slate-400 border-b border-slate-850 pb-2">
                            <span>Admin Email:</span>
                            <span className="font-mono text-slate-300 truncate max-w-[180px]">{email}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between text-slate-400">
                        <span>Next Step:</span>
                        <span className="font-semibold text-amber-400">Developer Review Required</span>
                    </div>
                </div>

                <p className="mt-5 text-[11px] text-slate-500 leading-normal">
                    Once the developer panel approves your application, your administrator account will be activated and you can sign in directly.
                </p>

                <div className="mt-6 flex flex-col gap-2.5">
                    <Link
                        to="/"
                        className="w-full py-2.5 rounded-xl text-white text-xs sm:text-sm font-semibold tracking-wider transition-all duration-300 bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/30 cursor-pointer flex items-center justify-center gap-2"
                    >
                        <i className="fa-solid fa-arrow-left text-xs"></i>
                        <span>Return to Sign In</span>
                    </Link>
                </div>

                {/* Footer */}
                <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                        <span>Platform:</span>
                        <img src={jwlogo} alt="Jeenweb" className="h-6 w-auto rounded-sm" />
                    </div>
                    <span>Developer Support Available</span>
                </div>
            </div>
        </div>
    );
}
