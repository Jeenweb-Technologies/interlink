import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { formatFileSize } from "./CameraCaptureModal";

const resolveApiUrl = (url) => {
    if (!url) return "";
    let clean = url;
    if (typeof clean === "string") {
        clean = clean.replace(/https?:\/\/crm\.jasminmobile\.com/g, "https://interchat.epoxyhouse.in")
                     .replace(/https?:\/\/(www\.)?interchat\.jeenweb\.com/g, "https://interchat.epoxyhouse.in");
    }
    if (clean.startsWith("http://") || clean.startsWith("https://") || clean.startsWith("blob:") || clean.startsWith("data:")) {
        return clean;
    }
    const base = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "")
        : (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:5005" : "");
    const cleanUrl = clean.startsWith("/") ? clean : `/${clean}`;
    return `${base}${cleanUrl}`;
};

export default function FileViewerModal({
    file,
    onClose,
    canDownload = false,
    currentUserName = "User",
    currentUserId = ""
}) {
    // Blob & Media state
    const [blobUrl, setBlobUrl] = useState(null);
    const [mediaError, setMediaError] = useState(false);

    // Text & Code state
    const [textContent, setTextContent] = useState(null);

    // Word (.docx / .doc) state
    const [docHtml, setDocHtml] = useState(null);
    const [docWarning, setDocWarning] = useState(null);

    // Excel state
    const [excelSheets, setExcelSheets] = useState([]);
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);
    const [rawWorkbook, setRawWorkbook] = useState(null);
    const [excelData, setExcelData] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");

    // PowerPoint state
    const [slidesText, setSlidesText] = useState([]);

    // UI state
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [rotation, setRotation] = useState(0);

    if (!file) return null;

    const originalName = file.originalName || file.fileName || file.file_name || "Document";
    const fileType = (file.fileType || file.mime_type || file.file_type || "").toLowerCase();
    const fileSize = file.fileSize || file.file_size || 0;
    const fileId = file.id || file.attachmentId;

    const token = localStorage.getItem("token") || "";
    const rawViewUrl = file.viewUrl || `/api/chat/files/${fileId}/view`;
    const viewUrlWithToken = rawViewUrl.includes("token=")
        ? resolveApiUrl(rawViewUrl)
        : `${resolveApiUrl(rawViewUrl)}${rawViewUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;

    const rawDownloadUrl = canDownload ? (file.downloadUrl || `/api/chat/files/${fileId}/download`) : null;
    const downloadUrl = rawDownloadUrl ? resolveApiUrl(rawDownloadUrl) : null;

    const ext = (originalName.split(".").pop() || "").toLowerCase();

    // File Category Detection
    const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff", "avif"].includes(ext) || fileType.startsWith("image/");
    const isPdf = ext === "pdf" || fileType === "application/pdf";
    const isDocx = ext === "docx" || fileType.includes("wordprocessingml") || fileType.includes("vnd.openxmlformats-officedocument.wordprocessingml");
    const isDoc = ext === "doc" || fileType === "application/msword";
    const isWord = isDocx || isDoc;
    const isExcel = ["xlsx", "xls", "csv", "tsv", "ods", "xlsb"].includes(ext) || fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("csv");
    const isPpt = ["pptx", "ppt", "odp"].includes(ext) || fileType.includes("presentation") || fileType.includes("powerpoint");
    const isVideo = ["mp4", "webm", "ogg", "mov", "mkv", "avi"].includes(ext) || fileType.startsWith("video/");
    const isAudio = ["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(ext) || fileType.startsWith("audio/");
    const isText = ["txt", "json", "md", "log", "js", "jsx", "ts", "tsx", "py", "html", "css", "xml", "sql", "env", "yml", "yaml", "ini", "sh", "bat", "rtf", "c", "cpp", "java", "php"].includes(ext) || fileType.startsWith("text/");

    // Fetch and parse file
    useEffect(() => {
        let isMounted = true;
        let createdBlobUrl = null;

        setIsLoading(true);
        setErrorMsg(null);
        setDocWarning(null);
        setDocHtml(null);
        setTextContent(null);
        setExcelData([]);
        setExcelSheets([]);
        setSlidesText([]);
        setSearchQuery("");
        setZoomLevel(1);
        setRotation(0);
        setMediaError(false);

        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        // 1. Excel files (.xlsx, .xls, .csv, .tsv)
        if (isExcel) {
            fetch(viewUrlWithToken, { headers })
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load spreadsheet`);
                    return res.arrayBuffer();
                })
                .then((arrayBuffer) => {
                    if (!isMounted) return;
                    try {
                        const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
                        setRawWorkbook(workbook);
                        const sheets = workbook.SheetNames || [];
                        setExcelSheets(sheets);
                        if (sheets.length > 0) {
                            setActiveSheetIndex(0);
                            const firstSheet = workbook.Sheets[sheets[0]];
                            const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" });
                            setExcelData(jsonData);
                        }
                    } catch (parseErr) {
                        console.error("Excel parse error:", parseErr);
                        try {
                            const text = new TextDecoder().decode(arrayBuffer);
                            const rows = text.split(/\r?\n/).filter(r => r.trim().length > 0).map(r => r.split(","));
                            if (rows.length > 0) {
                                setExcelSheets(["Data"]);
                                setActiveSheetIndex(0);
                                setExcelData(rows);
                            } else {
                                setErrorMsg("Could not parse spreadsheet data.");
                            }
                        } catch (e) {
                            setErrorMsg("Could not parse spreadsheet data.");
                        }
                    }
                })
                .catch((err) => {
                    console.error("Error loading Excel file:", err);
                    if (isMounted) setErrorMsg("Failed to download spreadsheet for viewing.");
                })
                .finally(() => {
                    if (isMounted) setIsLoading(false);
                });
            return () => { isMounted = false; };
        }

        // 2. Word (.docx / .doc) files
        if (isWord) {
            fetch(viewUrlWithToken, { headers })
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load Word document`);
                    return res.arrayBuffer();
                })
                .then(async (arrayBuffer) => {
                    if (!isMounted) return;

                    if (isDocx) {
                        try {
                            const result = await mammoth.convertToHtml(
                                { arrayBuffer, buffer: arrayBuffer },
                                {
                                    styleMap: [
                                        "p[style-name='Heading 1'] => h1:fresh",
                                        "p[style-name='Heading 2'] => h2:fresh",
                                        "p[style-name='Heading 3'] => h3:fresh",
                                        "p[style-name='Title'] => h1.title:fresh",
                                        "p[style-name='Subtitle'] => p.subtitle:fresh"
                                    ]
                                }
                            );
                            if (isMounted) {
                                if (result.value && result.value.trim().length > 0) {
                                    setDocHtml(result.value);
                                } else {
                                    setDocHtml("<p class='text-slate-400 italic text-center py-8'>This Word document appears to be empty.</p>");
                                }
                            }
                        } catch (convErr) {
                            console.warn("Mammoth conversion notice:", convErr);
                            try {
                                const rawRes = await mammoth.extractRawText({ arrayBuffer, buffer: arrayBuffer });
                                if (rawRes.value && rawRes.value.trim().length > 0) {
                                    const formatted = rawRes.value
                                        .split(/\n\n+/)
                                        .map(p => `<p class="mb-3">${p.replace(/\n/g, '<br/>')}</p>`)
                                        .join("");
                                    setDocHtml(formatted);
                                    setDocWarning("Rendered using text extraction mode.");
                                } else {
                                    setErrorMsg("Could not render Word document preview.");
                                }
                            } catch (fallbackErr) {
                                setErrorMsg("Could not render Word document preview.");
                            }
                        }
                    } else {
                        // Legacy .doc format text extraction
                        try {
                            const bytes = new Uint8Array(arrayBuffer);
                            let text = "";
                            for (let i = 0; i < bytes.length; i++) {
                                const c = bytes[i];
                                if ((c >= 32 && c <= 126) || c === 10 || c === 13) {
                                    text += String.fromCharCode(c);
                                } else if (text.length > 0 && text[text.length - 1] !== "\n") {
                                    text += " ";
                                }
                            }
                            const cleaned = text.replace(/ {2,}/g, " ").trim();
                            const paragraphs = cleaned
                                .split(/[\r\n]+/)
                                .filter(p => p.trim().length > 15)
                                .map(p => `<p class="mb-2 text-slate-800 leading-relaxed">${p}</p>`)
                                .join("");

                            if (paragraphs.length > 0) {
                                setDocHtml(paragraphs);
                                setDocWarning("Legacy Word document (.doc) preview.");
                            } else {
                                setDocHtml("<p class='text-slate-500'>Legacy binary Word document. Please download to view with Microsoft Word.</p>");
                            }
                        } catch (docErr) {
                            setErrorMsg("Could not render binary Word (.doc) preview.");
                        }
                    }
                })
                .catch((err) => {
                    console.error("Error loading Word document:", err);
                    if (isMounted) setErrorMsg("Failed to load Word document.");
                })
                .finally(() => {
                    if (isMounted) setIsLoading(false);
                });
            return () => { isMounted = false; };
        }

        // 3. PowerPoint (.pptx, .ppt)
        if (isPpt) {
            fetch(viewUrlWithToken, { headers })
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load presentation`);
                    return res.arrayBuffer();
                })
                .then((arrayBuffer) => {
                    if (!isMounted) return;
                    try {
                        const bytes = new Uint8Array(arrayBuffer);
                        let text = "";
                        for (let i = 0; i < bytes.length; i++) {
                            const c = bytes[i];
                            if ((c >= 32 && c <= 126) || c === 10 || c === 13) {
                                text += String.fromCharCode(c);
                            }
                        }
                        const matches = text.match(/<a:t>([^<]+)<\/a:t>/g);
                        if (matches && matches.length > 0) {
                            const extracted = matches.map(m => m.replace(/<\/?a:t>/g, "").trim()).filter(Boolean);
                            setSlidesText(extracted);
                        } else {
                            setSlidesText(["Presentation loaded. Download file to view with PowerPoint or Keynote."]);
                        }
                    } catch (e) {
                        setSlidesText(["Presentation file loaded."]);
                    }
                })
                .catch((err) => {
                    console.error("Error loading presentation:", err);
                    if (isMounted) setErrorMsg("Failed to load presentation.");
                })
                .finally(() => {
                    if (isMounted) setIsLoading(false);
                });
            return () => { isMounted = false; };
        }

        // 4. Text / Code files
        if (isText && !isImage && !isPdf) {
            fetch(viewUrlWithToken, { headers })
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load text document`);
                    return res.text();
                })
                .then((text) => {
                    if (isMounted) setTextContent(text);
                })
                .catch((err) => {
                    console.error("Error loading text file:", err);
                    if (isMounted) setErrorMsg("Failed to load text preview.");
                })
                .finally(() => {
                    if (isMounted) setIsLoading(false);
                });
            return () => { isMounted = false; };
        }

        // 5. Images, PDFs, Videos, Audios - Fetch as Authenticated Blob
        if (isImage || isPdf || isVideo || isAudio) {
            fetch(viewUrlWithToken, { headers })
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch file`);
                    return res.blob();
                })
                .then((blob) => {
                    if (!isMounted) return;
                    const mime = isPdf ? "application/pdf" : blob.type;
                    const cleanBlob = new Blob([blob], { type: mime });
                    createdBlobUrl = URL.createObjectURL(cleanBlob);
                    setBlobUrl(createdBlobUrl);
                })
                .catch((err) => {
                    console.error("Error loading media blob:", err);
                    if (isMounted) {
                        // Fallback to direct tokenized viewUrl
                        setBlobUrl(viewUrlWithToken);
                    }
                })
                .finally(() => {
                    if (isMounted) setIsLoading(false);
                });

            return () => {
                isMounted = false;
                if (createdBlobUrl) {
                    URL.revokeObjectURL(createdBlobUrl);
                }
            };
        }

        // 6. Other Archives / Unknown binaries
        setIsLoading(false);
        return () => { isMounted = false; };
    }, [viewUrlWithToken, isExcel, isWord, isDocx, isPpt, isText, isImage, isPdf, isVideo, isAudio]);

    // Handle switching Excel sheet tabs
    const handleSwitchExcelSheet = (index) => {
        setActiveSheetIndex(index);
        if (rawWorkbook && excelSheets[index]) {
            const sheetName = excelSheets[index];
            const sheet = rawWorkbook.Sheets[sheetName];
            if (sheet) {
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
                setExcelData(jsonData);
            }
        }
    };

    // Filter Excel rows based on search query
    const filteredExcelData = useMemo(() => {
        if (!searchQuery.trim() || excelData.length === 0) return excelData;
        const q = searchQuery.toLowerCase();
        const header = excelData[0] || [];
        const rows = excelData.slice(1).filter((row) =>
            row && row.some((cell) => String(cell).toLowerCase().includes(q))
        );
        return [header, ...rows];
    }, [excelData, searchQuery]);

    // Compute max columns for Excel grid
    const maxCols = useMemo(() => {
        let max = 0;
        filteredExcelData.forEach((row) => {
            if (row && row.length > max) max = row.length;
        });
        return Math.min(Math.max(max, 6), 35);
    }, [filteredExcelData]);

    const getColLetter = (colIdx) => {
        let temp = "";
        let letter = "";
        while (colIdx >= 0) {
            temp = String.fromCharCode((colIdx % 26) + 65);
            letter = temp + letter;
            colIdx = Math.floor(colIdx / 26) - 1;
        }
        return letter;
    };

    const handleZoomIn = () => setZoomLevel((z) => Math.min(Number((z + 0.25).toFixed(2)), 3.5));
    const handleZoomOut = () => setZoomLevel((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.5));
    const handleResetZoom = () => { setZoomLevel(1); setRotation(0); };
    const handleRotate = () => setRotation((r) => (r + 90) % 360);

    const handleCopyText = () => {
        if (textContent) {
            navigator.clipboard.writeText(textContent);
            toast.success("Text content copied to clipboard!");
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-hidden animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col w-full max-w-6xl max-h-[92vh] overflow-hidden">
                
                {/* Top Header Bar */}
                <div className="px-4 sm:px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0 gap-3">
                    <div className="flex items-center gap-3 truncate">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 shadow-2xs ${
                            isImage ? "bg-purple-100 text-purple-700" :
                            isPdf ? "bg-rose-100 text-rose-700" :
                            isWord ? "bg-blue-100 text-blue-700" :
                            isExcel ? "bg-emerald-100 text-emerald-700" :
                            isPpt ? "bg-amber-100 text-amber-700" :
                            isVideo ? "bg-red-100 text-red-700" :
                            isAudio ? "bg-violet-100 text-violet-700" :
                            "bg-slate-100 text-slate-700"
                        }`}>
                            <i className={`fa-solid ${
                                isImage ? "fa-image" :
                                isPdf ? "fa-file-pdf" :
                                isWord ? "fa-file-word" :
                                isExcel ? "fa-file-excel" :
                                isPpt ? "fa-file-powerpoint" :
                                isVideo ? "fa-film" :
                                isAudio ? "fa-music" :
                                isText ? "fa-file-lines" :
                                "fa-file"
                            }`}></i>
                        </div>

                        <div className="truncate">
                            <h3 className="text-sm font-bold text-slate-900 truncate" title={originalName}>
                                {originalName}
                            </h3>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span>{ext.toUpperCase()}</span>
                                {fileSize > 0 && (
                                    <>
                                        <span>•</span>
                                        <span>{formatFileSize(fileSize)}</span>
                                    </>
                                )}
                                <span>•</span>
                                <span className="text-indigo-600 font-semibold">In-App Secure Preview</span>
                            </div>
                        </div>
                    </div>

                    {/* Header Action Controls */}
                    <div className="flex items-center gap-2">
                        {/* Zoom Controls for Images */}
                        {isImage && (
                            <div className="hidden sm:flex items-center gap-1 bg-slate-200/70 rounded-xl p-0.5">
                                <button
                                    onClick={handleZoomOut}
                                    title="Zoom Out"
                                    className="w-7 h-7 rounded-lg hover:bg-white text-slate-600 flex items-center justify-center text-xs transition-colors cursor-pointer"
                                >
                                    <i className="fa-solid fa-magnifying-glass-minus"></i>
                                </button>
                                <button
                                    onClick={handleResetZoom}
                                    title="Reset Zoom"
                                    className="px-2 text-[11px] font-bold text-slate-600 hover:text-indigo-600 cursor-pointer"
                                >
                                    {Math.round(zoomLevel * 100)}%
                                </button>
                                <button
                                    onClick={handleZoomIn}
                                    title="Zoom In"
                                    className="w-7 h-7 rounded-lg hover:bg-white text-slate-600 flex items-center justify-center text-xs transition-colors cursor-pointer"
                                >
                                    <i className="fa-solid fa-magnifying-glass-plus"></i>
                                </button>
                                <button
                                    onClick={handleRotate}
                                    title="Rotate 90°"
                                    className="w-7 h-7 rounded-lg hover:bg-white text-slate-600 flex items-center justify-center text-xs transition-colors cursor-pointer"
                                >
                                    <i className="fa-solid fa-rotate-right"></i>
                                </button>
                            </div>
                        )}

                        {/* Copy button for code/text */}
                        {isText && textContent && (
                            <button
                                onClick={handleCopyText}
                                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-indigo-600 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                            >
                                <i className="fa-solid fa-copy"></i>
                                <span className="hidden sm:inline">Copy Text</span>
                            </button>
                        )}

                        {/* Download button only if permission is granted */}
                        {canDownload && downloadUrl ? (
                            <a
                                href={downloadUrl}
                                download={originalName}
                                className="px-3.5 py-1.5 rounded-lg bg-[#17365D] hover:bg-[#102642] text-white font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                                <i className="fa-solid fa-download"></i>
                                <span className="hidden sm:inline">Download</span>
                            </a>
                        ) : (
                            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                                <i className="fa-solid fa-shield-cat"></i> View Only
                            </span>
                        )}

                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                        >
                            <i className="fa-solid fa-xmark text-base"></i>
                        </button>
                    </div>
                </div>

                {/* Main Body Content with Watermark Protection */}
                <div className="flex-1 overflow-hidden flex flex-col bg-slate-100/70 relative min-h-[460px] max-h-[78vh]">
                    {/* Watermark Overlay */}
                    <div className="absolute inset-0 pointer-events-none z-20 flex flex-wrap items-center justify-around opacity-[0.035] overflow-hidden select-none">
                        {Array.from({ length: 16 }).map((_, i) => (
                            <div
                                key={i}
                                className="transform -rotate-25 text-xs sm:text-sm font-black tracking-widest text-slate-900 p-8"
                            >
                                CONFIDENTIAL • {currentUserName} ({currentUserId}) • INTERCHAT PREVIEW
                            </div>
                        ))}
                    </div>

                    {/* Loading State */}
                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500">
                            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <p className="text-xs font-bold text-slate-700">Loading document preview...</p>
                            <p className="text-[11px] text-slate-400 mt-1">Preparing rendered in-app view</p>
                        </div>
                    ) : errorMsg ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl mb-3">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                            </div>
                            <h4 className="text-sm font-bold text-slate-800">{errorMsg}</h4>
                            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
                                The file could not be parsed for direct inline preview.
                            </p>
                            {canDownload && downloadUrl && (
                                <a
                                    href={downloadUrl}
                                    download={originalName}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-700 cursor-pointer"
                                >
                                    Download to Open Locally
                                </a>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* 1. EXCEL SPREADSHEET VIEWER */}
                            {isExcel && (
                                <div className="flex-1 flex flex-col overflow-hidden bg-white">
                                    <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                                        <div className="flex items-center gap-1.5 overflow-x-auto">
                                            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Sheets:</span>
                                            {excelSheets.map((name, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleSwitchExcelSheet(idx)}
                                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                                        activeSheetIndex === idx
                                                            ? "bg-emerald-600 text-white shadow-xs"
                                                            : "bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200"
                                                    }`}
                                                >
                                                    <i className="fa-solid fa-table text-[10px] mr-1"></i>
                                                    {name}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                                                <input
                                                    type="text"
                                                    value={searchQuery}
                                                    onChange={(e) => setSearchQuery(e.target.value)}
                                                    placeholder="Search cells..."
                                                    className="pl-8 pr-3 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 w-36 sm:w-48"
                                                />
                                                {searchQuery && (
                                                    <button
                                                        onClick={() => setSearchQuery("")}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                                    >
                                                        <i className="fa-solid fa-xmark"></i>
                                                    </button>
                                                )}
                                            </div>
                                            <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                                                {filteredExcelData.length > 0 ? `${filteredExcelData.length - 1} rows` : "0 rows"}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-auto p-2">
                                        {filteredExcelData.length === 0 ? (
                                            <div className="p-8 text-center text-xs text-slate-400">No data found matching filter.</div>
                                        ) : (
                                            <table className="w-full border-collapse border border-slate-300 text-xs font-sans text-slate-800">
                                                <thead>
                                                    <tr className="bg-slate-100 text-slate-600 font-bold sticky top-0 z-10">
                                                        <th className="border border-slate-300 px-2.5 py-1.5 text-center text-[11px] w-12 bg-slate-200/90 select-none">
                                                            #
                                                        </th>
                                                        {Array.from({ length: maxCols }).map((_, cIdx) => (
                                                            <th
                                                                key={cIdx}
                                                                className="border border-slate-300 px-3 py-1.5 text-center text-[11px] min-w-[110px] bg-slate-100 select-none font-semibold text-slate-700"
                                                            >
                                                                {getColLetter(cIdx)}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredExcelData.map((row, rIdx) => (
                                                        <tr key={rIdx} className={rIdx === 0 ? "bg-slate-50/80 font-semibold" : "hover:bg-blue-50/50 transition-colors"}>
                                                            <td className="border border-slate-300 px-2 py-1.5 text-center font-bold text-[10px] bg-slate-50 text-slate-400 select-none">
                                                                {rIdx + 1}
                                                            </td>
                                                            {Array.from({ length: maxCols }).map((_, cIdx) => (
                                                                <td
                                                                    key={cIdx}
                                                                    className="border border-slate-300 px-3 py-1.5 whitespace-pre-wrap break-words leading-relaxed"
                                                                >
                                                                    {row && row[cIdx] !== undefined && row[cIdx] !== null
                                                                        ? String(row[cIdx])
                                                                        : ""}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 2. WORD DOCUMENT VIEWER (.docx / .doc) */}
                            {isWord && (
                                <div className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center bg-slate-200/70">
                                    {docWarning && (
                                        <div className="w-full max-w-3xl mb-3 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                                            <i className="fa-solid fa-circle-info text-amber-600"></i>
                                            <span>{docWarning}</span>
                                        </div>
                                    )}
                                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 sm:p-14 w-full max-w-3xl min-h-[65vh] text-slate-900 leading-relaxed font-sans">
                                        <div
                                            dangerouslySetInnerHTML={{ __html: docHtml || "<p class='text-slate-400'>Loading Word document...</p>" }}
                                            className="space-y-4 leading-relaxed text-sm sm:text-base text-slate-800 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-slate-900 [&>h1]:mb-3 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-slate-900 [&>h2]:mb-2 [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-slate-900 [&>table]:w-full [&>table]:my-4 [&>table]:border-collapse [&>table]:border [&>table]:border-slate-300 [&>table_td]:border [&>table_td]:border-slate-300 [&>table_td]:p-2.5 [&>table_th]:border [&>table_th]:border-slate-300 [&>table_th]:p-2.5 [&>table_th]:bg-slate-100 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-1.5 [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:space-y-1.5 [&>p]:leading-relaxed"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* 3. PDF DOCUMENT VIEWER (.pdf) */}
                            {isPdf && (
                                <div className="w-full h-full bg-white flex-1 overflow-hidden">
                                    <iframe
                                        src={blobUrl || `${viewUrlWithToken}#toolbar=0&navpanes=0&scrollbar=1`}
                                        title={originalName}
                                        className="w-full h-full border-none min-h-[520px]"
                                    />
                                </div>
                            )}

                            {/* 4. POWERPOINT PRESENTATION VIEWER (.pptx, .ppt) */}
                            {isPpt && (
                                <div className="flex-1 overflow-auto p-6 sm:p-10 flex flex-col items-center bg-slate-100">
                                    <div className="w-full max-w-3xl space-y-4">
                                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg shrink-0">
                                                <i className="fa-solid fa-file-powerpoint"></i>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-amber-900">PowerPoint Presentation Preview</h4>
                                                <p className="text-xs text-amber-700">Slide outlines and presentation text contents extracted below.</p>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8 divide-y divide-slate-100">
                                            {slidesText.map((txt, idx) => (
                                                <div key={idx} className="py-3.5 first:pt-0 last:pb-0">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Slide Item #{idx + 1}</span>
                                                    <p className="text-sm text-slate-800 leading-relaxed font-sans">{txt}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 5. VIDEO PLAYER (.mp4, .webm, .mov) */}
                            {isVideo && (
                                <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black">
                                    <video
                                        src={blobUrl || viewUrlWithToken}
                                        controls
                                        autoPlay
                                        className="max-w-full max-h-[70vh] rounded-xl shadow-2xl"
                                    >
                                        Your browser does not support playing this video format.
                                    </video>
                                </div>
                            )}

                            {/* 6. AUDIO PLAYER (.mp3, .wav, .m4a) */}
                            {isAudio && (
                                <div className="flex-1 overflow-auto p-8 flex flex-col items-center justify-center bg-slate-900 text-white">
                                    <div className="w-20 h-20 rounded-3xl bg-violet-600/30 border border-violet-500/40 text-violet-400 flex items-center justify-center text-3xl mb-6 shadow-xl">
                                        <i className="fa-solid fa-music"></i>
                                    </div>
                                    <h4 className="text-base font-bold text-white mb-1 text-center">{originalName}</h4>
                                    <p className="text-xs text-slate-400 mb-6">Audio Recording / Track</p>
                                    <audio
                                        src={blobUrl || viewUrlWithToken}
                                        controls
                                        autoPlay
                                        className="w-full max-w-md rounded-xl"
                                    />
                                </div>
                            )}

                            {/* 7. IMAGE VIEWER (png, jpg, webp, svg, gif) */}
                            {isImage && (
                                <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/20 select-none">
                                    <img
                                        src={blobUrl || viewUrlWithToken}
                                        alt={originalName}
                                        draggable="false"
                                        onError={() => setMediaError(true)}
                                        style={{
                                            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                                            transition: "transform 0.15s ease-out"
                                        }}
                                        className="max-w-full max-h-[70vh] rounded-xl shadow-xl object-contain pointer-events-none select-none"
                                    />
                                </div>
                            )}

                            {/* 8. TEXT / CODE VIEWER */}
                            {isText && !isWord && !isExcel && !isPdf && !isPpt && (
                                <div className="w-full h-full bg-slate-900 text-slate-200 p-5 sm:p-7 overflow-auto font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                                    {textContent !== null ? textContent : <p className="text-slate-400">Loading text document...</p>}
                                </div>
                            )}

                            {/* 9. OTHER / ARCHIVES / BINARIES */}
                            {!isImage && !isPdf && !isWord && !isExcel && !isPpt && !isVideo && !isAudio && !isText && (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
                                    <div className="w-16 h-16 rounded-3xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-2xl mb-4 shadow-sm">
                                        <i className="fa-solid fa-file-zipper"></i>
                                    </div>
                                    <h4 className="text-base font-bold text-slate-800">{originalName}</h4>
                                    <p className="text-xs text-slate-500 max-w-md mt-1 mb-6">
                                        This file type ({ext.toUpperCase()}) cannot be rendered directly inside the browser. You can download and open it with your local software application.
                                    </p>
                                    {canDownload && downloadUrl ? (
                                        <a
                                            href={downloadUrl}
                                            download={originalName}
                                            className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2 cursor-pointer"
                                        >
                                            <i className="fa-solid fa-download"></i>
                                            Download File
                                        </a>
                                    ) : (
                                        <span className="px-3.5 py-1.5 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold">
                                            Download Restricted
                                        </span>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Bottom Footer Status Bar */}
                <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
                    <span className="flex items-center gap-1.5">
                        <i className="fa-solid fa-shield text-indigo-500 text-xs"></i>
                        Screen protection & watermark active • Confidential In-App Viewer
                    </span>
                    <span className="font-semibold text-slate-600">InterChat Secure Viewer</span>
                </div>
            </div>
        </div>
    );
}
