import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import Navbar from "../../../components/Navbar";
import { bulkImportUsers, downloadBulkImportTemplate } from "../../../api/authApi";
import { getDepartments } from "../../../api/departmentApi";
import { getUserTypes } from "../../../api/userTypeMasterApi";
import { getCompanies } from "../../../api/companyApi";

export default function BulkUserImport() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);

    // Metadata references for template & auto-matching
    const [companiesList, setCompaniesList] = useState([]);
    const [departmentsList, setDepartmentsList] = useState([]);
    const [userTypesList, setUserTypesList] = useState([]);
    const [loadingMeta, setLoadingMeta] = useState(true);

    // Upload & Parsed State
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [parsedRows, setParsedRows] = useState([]);
    const [tableSearch, setTableSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL"); // ALL | READY | WARNING | ERROR

    // Import Options
    const [skipDuplicates, setSkipDuplicates] = useState(true);
    const [defaultPassword, setDefaultPassword] = useState("Password123!");
    const [mustChangePassword, setMustChangePassword] = useState(true);
    const [deviceVerificationRequired, setDeviceVerificationRequired] = useState(true);

    // Processing State
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState(null); // { summary, createdUsers, skippedUsers }
    const [showInstructionsModal, setShowInstructionsModal] = useState(false);

    // Load system metadata for validation and template guide
    useEffect(() => {
        const fetchMeta = async () => {
            try {
                setLoadingMeta(true);
                const [compRes, deptRes, typeRes] = await Promise.allSettled([
                    getCompanies(),
                    getDepartments(),
                    getUserTypes()
                ]);

                if (compRes.status === "fulfilled" && compRes.value?.data?.companies) {
                    setCompaniesList(compRes.value.data.companies);
                }
                if (deptRes.status === "fulfilled" && deptRes.value?.data?.departments) {
                    setDepartmentsList(deptRes.value.data.departments);
                }
                if (typeRes.status === "fulfilled" && typeRes.value?.data?.userTypes) {
                    setUserTypesList(typeRes.value.data.userTypes);
                }
            } catch (err) {
                console.error("Failed to load metadata for user import:", err);
            } finally {
                setLoadingMeta(false);
            }
        };
        fetchMeta();
    }, []);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Download Sample Excel Template with Preloaded Dropdowns
    // ─────────────────────────────────────────────────────────────────────────
    const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);

    const handleDownloadTemplate = async () => {
        try {
            setIsDownloadingTemplate(true);
            toast.loading("Generating Excel template with live master dropdowns...", { id: "download-tpl" });
            
            const response = await downloadBulkImportTemplate();
            
            // Build blob link and trigger browser download
            const blob = new Blob([response.data], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", "EpoxyHouse_Employee_Import_Template.xlsx");
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            window.URL.revokeObjectURL(url);

            toast.success("Excel template downloaded with preloaded masters dropdowns!", { id: "download-tpl" });
        } catch (error) {
            console.error("Template download error:", error);
            toast.error("Failed to download template. Please try again.", { id: "download-tpl" });
        } finally {
            setIsDownloadingTemplate(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Parse & Validate Uploaded Excel / CSV
    // ─────────────────────────────────────────────────────────────────────────
    const handleFileChosen = (file) => {
        if (!file) return;

        const validExts = [".xlsx", ".xls", ".csv"];
        const fileExt = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if (!validExts.includes(fileExt)) {
            toast.error("Please upload a valid Excel file (.xlsx, .xls) or CSV file.");
            return;
        }

        setUploadedFile(file);
        setImportResult(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const buffer = e.target.result;
                const workbook = XLSX.read(buffer, { type: "array" });

                // Pick first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

                if (!rawJson || rawJson.length === 0) {
                    toast.error("The uploaded file does not contain any data rows.");
                    setParsedRows([]);
                    return;
                }

                // Process and validate rows
                const seenEmails = new Set();
                const processed = rawJson.map((row, index) => {
                    // Extract fields with multiple possible key formats
                    const name = String(row["Full Name*"] || row["Full Name"] || row["full_name"] || row["Name"] || row.name || "").trim();
                    const email = String(row["Email*"] || row["Email"] || row["email_address"] || row.email || "").trim().toLowerCase();
                    const username = String(row["Username"] || row["User Name"] || row.username || "").trim();
                    const password = String(row["Password"] || row.password || "").trim();
                    const mobile = String(row["Mobile Number"] || row["Mobile"] || row["Phone"] || row.mobNo || row.mob_no || "").trim();
                    const company = String(row["Company"] || row["Company Name"] || row.company || "").trim();
                    const departments = String(row["Departments"] || row["Department"] || row.departments || "").trim();
                    const deptRole = String(row["Department Role"] || row.departmentRole || row.deptRole || "USER").toUpperCase().trim();
                    const userType = String(row["User Type"] || row.userType || "").trim();
                    const role = String(row["Role"] || row.role || "user").toLowerCase().trim();
                    const isVendor = String(row["Is Vendor"] || row.isVendor || row.is_vendor || "No").trim();
                    const canChatVendor = String(row["Can Chat With Vendors"] || row.canChatWithVendors || "No").trim();
                    const deviceVerif = String(row["Device Verification Required"] || row.deviceVerificationRequired || "Yes").trim();
                    const dateOfJoin = String(row["Date of Joining"] || row["Joining Date"] || row.dateOfJoin || "").trim();

                    // Validation checks
                    const errors = [];
                    const warnings = [];

                    if (!name) {
                        errors.push("Full Name is missing");
                    }

                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!email) {
                        errors.push("Email is missing");
                    } else if (!emailRegex.test(email)) {
                        errors.push("Invalid email format");
                    } else if (seenEmails.has(email)) {
                        errors.push("Duplicate email in this file");
                    } else {
                        seenEmails.add(email);
                    }

                    if (!username && email) {
                        warnings.push("Username will be auto-generated from email");
                    }
                    if (!password) {
                        warnings.push("Default password (Password123!) will be assigned");
                    }
                    if (!company && companiesList.length > 0) {
                        warnings.push(`Default company (${companiesList[0]?.company_name}) will be assigned`);
                    }

                    const status = errors.length > 0 ? "ERROR" : warnings.length > 0 ? "WARNING" : "READY";

                    return {
                        id: `row_${index + 1}`,
                        rowNumber: index + 2, // Excel 1-based + 1 header row
                        name,
                        email,
                        username: username || (email ? email.split("@")[0] : ""),
                        password: password || defaultPassword,
                        mobile,
                        company: company || companiesList[0]?.company_name || "Epoxy House",
                        departments,
                        deptRole: deptRole === "ADMIN" ? "ADMIN" : "USER",
                        userType: userType || "Standard User",
                        role: role === "admin" ? "admin" : "user",
                        isVendor: ["yes", "1", "true", "vendor"].includes(isVendor.toLowerCase()),
                        canChatWithVendors: ["yes", "1", "true"].includes(canChatVendor.toLowerCase()),
                        deviceVerificationRequired: !["no", "0", "false"].includes(deviceVerif.toLowerCase()),
                        dateOfJoin: dateOfJoin || new Date().toISOString().split("T")[0],
                        errors,
                        warnings,
                        status
                    };
                });

                setParsedRows(processed);
                toast.success(`Parsed ${processed.length} records successfully.`);
            } catch (err) {
                console.error("Excel parse error:", err);
                toast.error("Failed to parse Excel file. Please ensure the format matches the template.");
            }
        };

        reader.readAsArrayBuffer(file);
    };

    // Remove single row from preview
    const handleRemoveRow = (rowId) => {
        setParsedRows(prev => prev.filter(r => r.id !== rowId));
        toast.success("Row removed from batch.");
    };

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Submit Bulk Import to Backend API
    // ─────────────────────────────────────────────────────────────────────────
    const handleExecuteImport = async () => {
        const validRows = parsedRows.filter(r => r.status !== "ERROR");
        if (validRows.length === 0) {
            toast.error("There are no valid records ready to import.");
            return;
        }

        try {
            setIsImporting(true);

            const payload = {
                users: validRows.map(r => ({
                    name: r.name,
                    username: r.username,
                    email: r.email,
                    password: r.password || defaultPassword,
                    mobNo: r.mobile,
                    role: r.role,
                    company: r.company,
                    departments: r.departments,
                    departmentRole: r.deptRole,
                    userType: r.userType,
                    isVendor: r.isVendor,
                    canChatWithVendors: r.canChatWithVendors,
                    deviceVerificationRequired: r.deviceVerificationRequired && deviceVerificationRequired,
                    dateOfJoin: r.dateOfJoin
                })),
                options: {
                    skipDuplicates,
                    defaultPassword,
                    mustChangePassword,
                    deviceVerificationRequired
                }
            };

            const response = await bulkImportUsers(payload);

            if (response.data && response.data.success) {
                setImportResult(response.data);
                toast.success(response.data.message || "Users imported successfully!");
            } else {
                toast.error(response.data?.message || "Import encountered an error.");
            }
        } catch (error) {
            console.error("Bulk Import Execution Error:", error);
            const errMsg = error.response?.data?.message || error.message || "Failed to process bulk import.";
            toast.error(errMsg);
        } finally {
            setIsImporting(false);
        }
    };

    // Filtered Preview Rows
    const filteredRows = parsedRows.filter(r => {
        if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
        if (!tableSearch) return true;
        const q = tableSearch.toLowerCase();
        return (
            r.name.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q) ||
            r.username.toLowerCase().includes(q) ||
            r.company.toLowerCase().includes(q) ||
            r.departments.toLowerCase().includes(q)
        );
    });

    const readyCount = parsedRows.filter(r => r.status === "READY").length;
    const warningCount = parsedRows.filter(r => r.status === "WARNING").length;
    const errorCount = parsedRows.filter(r => r.status === "ERROR").length;
    const canSubmit = (readyCount + warningCount) > 0 && !isImporting;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            <Navbar />

            <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                {/* ── Top Header Bar ────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <button
                                onClick={() => navigate("/admin/users")}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                            >
                                <i className="fa-solid fa-arrow-left"></i>
                                Back to User Master
                            </button>
                            <span className="text-slate-300">/</span>
                            <span className="text-xs font-medium text-slate-400">Excel Employee Import</span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
                            <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                                <i className="fa-solid fa-file-excel text-base"></i>
                            </span>
                            Bulk Employee Import Master
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">
                            Upload an Excel spreadsheet (.xlsx, .xls, .csv) to rapidly provision multiple employee accounts in batch.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => setShowInstructionsModal(true)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-all cursor-pointer"
                        >
                            <i className="fa-solid fa-circle-info text-blue-500"></i>
                            Field Guide & Rules
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            disabled={isDownloadingTemplate}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                        >
                            <i className={`fa-solid ${isDownloadingTemplate ? "fa-spinner fa-spin" : "fa-download"}`}></i>
                            {isDownloadingTemplate ? "Preparing Template..." : "Download Sample Excel Template"}
                        </button>
                    </div>
                </div>

                {/* ── Import Completed Banner / Report ──────────────────────── */}
                {importResult && (
                    <div className="mb-6 bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 animate-fadeIn">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                                    <i className="fa-solid fa-circle-check"></i>
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-900">
                                        Import Completed Successfully!
                                    </h2>
                                    <p className="text-xs text-slate-600 mt-0.5">
                                        Processed {importResult.summary?.total} records:{" "}
                                        <span className="font-semibold text-emerald-600">{importResult.summary?.created} created</span>,{" "}
                                        <span className="font-semibold text-amber-600">{importResult.summary?.skipped} skipped/duplicates</span>.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigate("/admin/users")}
                                    className="px-4 py-2 rounded-xl bg-[#ED1C28] hover:bg-[#C5131E] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                                >
                                    <i className="fa-solid fa-users mr-1.5"></i>
                                    View in User Master
                                </button>
                                <button
                                    onClick={() => {
                                        setImportResult(null);
                                        setParsedRows([]);
                                        setUploadedFile(null);
                                    }}
                                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
                                >
                                    Import Another File
                                </button>
                            </div>
                        </div>

                        {/* Skipped users list if any */}
                        {importResult.skippedUsers && importResult.skippedUsers.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <h3 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                    <i className="fa-solid fa-triangle-exclamation text-amber-500"></i>
                                    Skipped Records ({importResult.skippedUsers.length})
                                </h3>
                                <div className="max-h-40 overflow-y-auto space-y-1.5 text-xs text-slate-600 pr-2">
                                    {importResult.skippedUsers.map((su, idx) => (
                                        <div key={idx} className="flex items-center justify-between py-1 px-2.5 rounded bg-amber-50/70 border border-amber-100/50">
                                            <span>
                                                Row {su.row}: <strong>{su.name}</strong> ({su.email})
                                            </span>
                                            <span className="text-[11px] font-medium text-amber-700">
                                                {su.reason}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Main Layout: Dropzone / Preview ───────────────────────── */}
                {!parsedRows.length ? (
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-8 text-center">
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setIsDragging(false);
                                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                    handleFileChosen(e.dataTransfer.files[0]);
                                }
                            }}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 transition-all cursor-pointer flex flex-col items-center justify-center gap-4 ${
                                isDragging
                                    ? "border-emerald-500 bg-emerald-50/40 scale-[1.005]"
                                    : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50/50"
                            }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        handleFileChosen(e.target.files[0]);
                                    }
                                }}
                            />
                            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-2xl shadow-xs">
                                <i className="fa-solid fa-cloud-arrow-up"></i>
                            </div>

                            <div>
                                <h3 className="text-base font-bold text-slate-800">
                                    Click or Drag & Drop Excel File Here
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Supports Microsoft Excel (.xlsx, .xls) and CSV (.csv) files up to 10MB
                                </p>
                            </div>

                            <div className="flex items-center gap-2 mt-2">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                                    <i className="fa-solid fa-check text-emerald-500"></i> Auto Column Mapping
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                                    <i className="fa-solid fa-check text-emerald-500"></i> Duplicate Protection
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">
                                    <i className="fa-solid fa-check text-emerald-500"></i> Department Auto-Enrollment
                                </span>
                            </div>
                        </div>

                        {/* Quick Template Download CTA */}
                        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                            <div>
                                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                    Need the standard format?
                                </h4>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Download our prefilled sample Excel template with all headers, sample rows, and live dropdowns for Company, Departments, and User Types.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleDownloadTemplate}
                                disabled={isDownloadingTemplate}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-800 text-xs font-semibold transition-all cursor-pointer shrink-0"
                            >
                                <i className={`fa-solid ${isDownloadingTemplate ? "fa-spinner fa-spin" : "fa-file-arrow-down text-emerald-600"}`}></i>
                                {isDownloadingTemplate ? "Downloading..." : "Get Sample Template (.xlsx)"}
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ── Interactive Preview & Validation Table ─────────────── */
                    <div className="space-y-6">
                        {/* Summary Badges & Settings Bar */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold">
                                        <i className="fa-solid fa-file-excel text-emerald-600"></i>
                                        <span className="truncate max-w-[200px]">{uploadedFile?.name || "Uploaded File"}</span>
                                        <button
                                            onClick={() => {
                                                setParsedRows([]);
                                                setUploadedFile(null);
                                            }}
                                            className="text-slate-400 hover:text-red-500 ml-1"
                                            title="Remove File"
                                        >
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>

                                    {/* Stats Chips */}
                                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                                        Total: {parsedRows.length}
                                    </span>
                                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <i className="fa-solid fa-check mr-1"></i> Ready: {readyCount}
                                    </span>
                                    {warningCount > 0 && (
                                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                                            <i className="fa-solid fa-triangle-exclamation mr-1"></i> Auto-Adjusted: {warningCount}
                                        </span>
                                    )}
                                    {errorCount > 0 && (
                                        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200">
                                            <i className="fa-solid fa-circle-xmark mr-1"></i> Errors: {errorCount}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setParsedRows([]);
                                            setUploadedFile(null);
                                        }}
                                        className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold border border-slate-200 transition-all cursor-pointer"
                                    >
                                        Change File
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!canSubmit}
                                        onClick={handleExecuteImport}
                                        className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white text-xs font-bold shadow-xs transition-all ${
                                            canSubmit
                                                ? "bg-[#ED1C28] hover:bg-[#C5131E] cursor-pointer"
                                                : "bg-slate-300 cursor-not-allowed opacity-70"
                                        }`}
                                    >
                                        {isImporting ? (
                                            <>
                                                <i className="fa-solid fa-circle-notch fa-spin"></i>
                                                Importing {readyCount + warningCount} Users...
                                            </>
                                        ) : (
                                            <>
                                                <i className="fa-solid fa-user-plus"></i>
                                                Create {readyCount + warningCount} Users Now
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Batch Import Configurations */}
                            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                                <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={skipDuplicates}
                                        onChange={(e) => setSkipDuplicates(e.target.checked)}
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span>Skip duplicate emails in database</span>
                                </label>

                                <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={mustChangePassword}
                                        onChange={(e) => setMustChangePassword(e.target.checked)}
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span>Require 1st login password change</span>
                                </label>

                                <label className="flex items-center gap-2 text-slate-700 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={deviceVerificationRequired}
                                        onChange={(e) => setDeviceVerificationRequired(e.target.checked)}
                                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span>Hardware device verification</span>
                                </label>

                                <div className="flex items-center gap-2">
                                    <span className="text-slate-500 whitespace-nowrap">Default Pass:</span>
                                    <input
                                        type="text"
                                        value={defaultPassword}
                                        onChange={(e) => setDefaultPassword(e.target.value)}
                                        placeholder="Password123!"
                                        className="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Search & Filter Toolbar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80">
                            <div className="relative w-full sm:w-72">
                                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                <input
                                    type="text"
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                    placeholder="Search parsed records..."
                                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                {[
                                    { id: "ALL", label: `All (${parsedRows.length})` },
                                    { id: "READY", label: `Ready (${readyCount})` },
                                    { id: "WARNING", label: `Auto-Adjusted (${warningCount})` },
                                    { id: "ERROR", label: `Errors (${errorCount})` }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setStatusFilter(tab.id)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                            statusFilter === tab.id
                                                ? "bg-slate-900 text-white"
                                                : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                                        }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Preview Data Table */}
                        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                            <div className="overflow-x-auto max-h-[500px]">
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                                        <tr>
                                            <th className="py-3 px-3 w-12 text-center">Row</th>
                                            <th className="py-3 px-3">Status</th>
                                            <th className="py-3 px-3">Full Name</th>
                                            <th className="py-3 px-3">Email Address</th>
                                            <th className="py-3 px-3">Username</th>
                                            <th className="py-3 px-3">Company</th>
                                            <th className="py-3 px-3">Departments</th>
                                            <th className="py-3 px-3">User Type</th>
                                            <th className="py-3 px-3">Vendor?</th>
                                            <th className="py-3 px-3 text-center w-12">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {filteredRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="py-8 text-center text-slate-400">
                                                    No rows matching the current filter.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRows.map((row) => (
                                                <tr
                                                    key={row.id}
                                                    className={`hover:bg-slate-50/80 transition-colors ${
                                                        row.status === "ERROR" ? "bg-red-50/20" : ""
                                                    }`}
                                                >
                                                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                                                        {row.rowNumber}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        {row.status === "READY" && (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[10px]">
                                                                <i className="fa-solid fa-check"></i> Ready
                                                            </span>
                                                        )}
                                                        {row.status === "WARNING" && (
                                                            <span
                                                                title={row.warnings.join("\n")}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-[10px] cursor-help"
                                                            >
                                                                <i className="fa-solid fa-triangle-exclamation"></i> Adjusted
                                                            </span>
                                                        )}
                                                        {row.status === "ERROR" && (
                                                            <span
                                                                title={row.errors.join("\n")}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200 font-semibold text-[10px] cursor-help"
                                                            >
                                                                <i className="fa-solid fa-xmark"></i> Error
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                                                        {row.name || <span className="text-red-500 italic">Missing</span>}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-mono text-[11px]">
                                                        {row.email || <span className="text-red-500 italic">Missing</span>}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                                                        {row.username || <span className="text-amber-500 italic">Auto-gen</span>}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        {row.company || "Epoxy House"}
                                                    </td>
                                                    <td className="py-2.5 px-3 max-w-[180px] truncate" title={row.departments}>
                                                        {row.departments ? (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                                                                {row.departments}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 italic">None</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        {row.userType}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        {row.isVendor ? (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 font-semibold text-[10px]">
                                                                Vendor
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 text-[11px]">No</span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center">
                                                        <button
                                                            onClick={() => handleRemoveRow(row.id)}
                                                            className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                                                            title="Remove Row"
                                                        >
                                                            <i className="fa-regular fa-trash-can"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Table Footer */}
                            <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                                <span>Showing {filteredRows.length} of {parsedRows.length} total rows</span>
                                <span className="text-[11px] text-slate-400">
                                    Hover over Adjusted / Error badges for specific row details.
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* ── Field Guide & Instructions Modal ─────────────────────────── */}
            {showInstructionsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                                <i className="fa-solid fa-book text-emerald-600"></i>
                                Bulk Employee Import Field Guide
                            </h3>
                            <button
                                onClick={() => setShowInstructionsModal(false)}
                                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors shrink-0"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-600 leading-relaxed">
                            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-900">
                                <strong>Tip:</strong> Always download the <strong>Sample Excel Template</strong> first. It contains working sample rows, correct column headers, and system references.
                            </div>

                            <div>
                                <h4 className="font-bold text-slate-800 text-sm mb-2">Column Headers Reference:</h4>
                                <div className="space-y-2 border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                                    <div className="p-2.5 bg-slate-50 font-semibold text-slate-700 grid grid-cols-12 gap-2">
                                        <div className="col-span-4">Header</div>
                                        <div className="col-span-3">Status</div>
                                        <div className="col-span-5">Explanation</div>
                                    </div>
                                    <div className="p-2.5 grid grid-cols-12 gap-2">
                                        <div className="col-span-4 font-mono font-bold text-slate-800">Full Name*</div>
                                        <div className="col-span-3 text-red-600 font-semibold">Required</div>
                                        <div className="col-span-5">Employee full name.</div>
                                    </div>
                                    <div className="p-2.5 grid grid-cols-12 gap-2">
                                        <div className="col-span-4 font-mono font-bold text-slate-800">Email*</div>
                                        <div className="col-span-3 text-red-600 font-semibold">Required</div>
                                        <div className="col-span-5">Must be unique across the entire organization.</div>
                                    </div>
                                    <div className="p-2.5 grid grid-cols-12 gap-2">
                                        <div className="col-span-4 font-mono text-slate-800">Username</div>
                                        <div className="col-span-3 text-slate-500">Optional</div>
                                        <div className="col-span-5">Auto-generated from email username if blank.</div>
                                    </div>
                                    <div className="p-2.5 grid grid-cols-12 gap-2">
                                        <div className="col-span-4 font-mono text-slate-800">Password</div>
                                        <div className="col-span-3 text-slate-500">Optional</div>
                                        <div className="col-span-5">Defaults to <code className="bg-slate-100 px-1 rounded">Password123!</code> if blank.</div>
                                    </div>
                                    <div className="p-2.5 grid grid-cols-12 gap-2">
                                        <div className="col-span-4 font-mono text-slate-800">Company</div>
                                        <div className="col-span-3 text-slate-500">Optional</div>
                                        <div className="col-span-5">Company Name or Code. Defaults to primary company.</div>
                                    </div>
                                    <div className="p-2.5 grid grid-cols-12 gap-2">
                                        <div className="col-span-4 font-mono text-slate-800">Departments</div>
                                        <div className="col-span-3 text-slate-500">Optional</div>
                                        <div className="col-span-5">Comma-separated department names e.g. "Sales, IT".</div>
                                    </div>
                                    <div className="p-2.5 grid grid-cols-12 gap-2">
                                        <div className="col-span-4 font-mono text-slate-800">User Type</div>
                                        <div className="col-span-3 text-slate-500">Optional</div>
                                        <div className="col-span-5">e.g. Standard User, Vendor / External Partner.</div>
                                    </div>
                                    <div className="p-2.5 grid grid-cols-12 gap-2">
                                        <div className="col-span-4 font-mono text-slate-800">Is Vendor</div>
                                        <div className="col-span-3 text-slate-500">Optional</div>
                                        <div className="col-span-5">Yes or No. Restricts chat initiating permissions.</div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                                <strong>First Login Security:</strong> All bulk-created users will be required to change their password when they log in for the first time.
                            </div>
                        </div>

                        <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button
                                onClick={() => setShowInstructionsModal(false)}
                                className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition-colors cursor-pointer text-center justify-center"
                            >
                                Close Guide
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
