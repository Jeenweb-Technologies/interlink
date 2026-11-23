import React, { useState } from "react";
import { createCompany } from "../../api/companyApi";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

export default function CreateCompany() {
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        company_name: "",
        description: "",
        phone: "",
        address: ""
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.company_name.trim()) {
            toast.error("Please enter a valid Company Name");
            return;
        }

        setSubmitting(true);
        try {
            const res = await createCompany({
                company_name: form.company_name.trim(),
                description: form.description ? form.description.trim() : "",
                phone: form.phone ? form.phone.trim() : "",
                address: form.address ? form.address.trim() : "",
                status: "ACTIVE"
            });

            if (res.success || res.data || res.id) {
                toast.success(`Company "${form.company_name.trim()}" created successfully!`);
                setTimeout(() => {
                    navigate("/admin/companies");
                }, 400);
            } else {
                toast.error(res.message || "Failed to create company");
            }
        } catch (error) {
            console.error("Create company error:", error);
            toast.error(error.response?.data?.message || "Failed to create company");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-screen bg-slate-50 font-sans text-slate-900 select-text">
            <main className="flex-1 flex flex-col w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 max-w-4xl mx-auto">
                {/* ── Top Header & Navigation ───────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 sm:mb-6">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
                            <button
                                type="button"
                                onClick={() => navigate("/admin/companies")}
                                className="hover:text-blue-600 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                                <i className="fa-solid fa-arrow-left"></i> Company Master
                            </button>
                            <span>/</span>
                            <span className="text-slate-800 font-bold">Create Company</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                            <i className="fa-solid fa-city text-blue-600"></i>
                            Create Company
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">
                            Register a new company entity in the system.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate("/admin/companies")}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer text-center justify-center"
                        >
                            Cancel
                        </button>
                    </div>
                </div>

                {/* ── Full-Length Company Creation Form ── */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
                    <div className="pb-4 border-b border-slate-100 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold text-base shadow-xs shrink-0">
                            <i className="fa-solid fa-building"></i>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-900">Company Information</h2>
                            <p className="text-xs text-slate-500">Provide the basic details for the company</p>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {/* 1. Company Name */}
                        <div>
                            <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">
                                Company Name <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                                <i className="fa-solid fa-city absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Epoxy House, Acme Corp, Company B"
                                    value={form.company_name}
                                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* 2. Company Description */}
                        <div>
                            <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">
                                Company Description
                            </label>
                            <textarea
                                rows="3"
                                placeholder="Brief overview of company operations, industry domain or business nature..."
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </div>

                        {/* 3. Mobile Number */}
                        <div>
                            <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">
                                Mobile Number
                            </label>
                            <div className="relative">
                                <i className="fa-solid fa-phone absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                <input
                                    type="tel"
                                    placeholder="e.g. +91 9876543210 or 022-24901234"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>

                        {/* 4. Address */}
                        <div>
                            <label className="block text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-2">
                                Address
                            </label>
                            <div className="relative">
                                <i className="fa-solid fa-location-dot absolute left-3.5 top-3.5 text-slate-400 text-xs"></i>
                                <textarea
                                    rows="3"
                                    placeholder="Full office or registered address (Street, City, State, PIN)..."
                                    value={form.address}
                                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Form Actions ── */}
                    <div className="pt-5 sm:pt-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => navigate("/admin/companies")}
                            className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer text-center justify-center"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#ED1C28] hover:bg-[#C5131E] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                                    <span>Creating Company...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-check"></i>
                                    <span>Create Company</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}
