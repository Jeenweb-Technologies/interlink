import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

export default function FilePreviewModal({ file, canDownload = true, onClose }) {
    if (!file) return null;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [textContent, setTextContent] = useState("");
    const [docxHtml, setDocxHtml] = useState("");
    const [sheetsData, setSheetsData] = useState([]); // [{ name: "Sheet1", rows: [[]] }]
    const [activeSheetIndex, setActiveSheetIndex] = useState(0);
    const [filterQuery, setFilterQuery] = useState("");

    const fileName = file.name || "Attachment";
    const fileUrl = file.url;
    const fileExt = useMemo(() => {
        const parts = fileName.split(".");
        return parts.length > 1 ? parts.pop().toLowerCase() : "";
    }, [fileName]);

    const isImage = useMemo(() => {
        return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(fileExt) || Boolean(file.isImage);
    }, [fileExt, file.isImage]);

    const isPdf = useMemo(() => {
        return fileExt === "pdf" || Boolean(file.isPdf);
    }, [fileExt, file.isPdf]);

    const isExcel = useMemo(() => {
        return ["xlsx", "xls", "csv", "tsv"].includes(fileExt);
    }, [fileExt]);

    const isDocx = useMemo(() => {
        return fileExt === "docx";
    }, [fileExt]);

    const isTextOrCode = useMemo(() => {
        return ["xml", "json", "txt", "log", "sql", "html", "htm", "css", "js", "jsx", "ts", "tsx", "md", "py", "sh", "yml", "yaml", "ini", "env"].includes(fileExt);
    }, [fileExt]);

    const isVideo = useMemo(() => {
        return ["mp4", "webm", "ogg", "mov"].includes(fileExt);
    }, [fileExt]);

    const isAudio = useMemo(() => {
        return ["mp3", "wav", "ogg", "m4a", "aac"].includes(fileExt);
    }, [fileExt]);

    const isOtherOffice = useMemo(() => {
        return ["doc", "ppt", "pptx"].includes(fileExt);
    }, [fileExt]);

    // Format raw XML with basic indentation
    const formatXml = (xmlStr) => {
        try {
            let formatted = "";
            let pad = 0;
            const reg = /(>)(<)(\/*)/g;
            const xml = xmlStr.replace(reg, "$1\r\n$2$3");
            xml.split("\r\n").forEach((node) => {
                let indent = 0;
                if (node.match(/.+<\/\w[^>]*>$/)) {
                    indent = 0;
                } else if (node.match(/^<\/\w/)) {
                    if (pad !== 0) pad -= 1;
                } else if (node.match(/^<\w[^>]*[^\/]>.*$/)) {
                    indent = 1;
                } else {
                    indent = 0;
                }
                formatted += "  ".repeat(pad) + node + "\r\n";
                pad += indent;
            });
            return formatted.trim();
        } catch (_) {
            return xmlStr;
        }
    };

    // Load and parse file content based on type
    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(null);
        setTextContent("");
        setDocxHtml("");
        setSheetsData([]);
        setActiveSheetIndex(0);
        setFilterQuery("");

        if (!fileUrl) {
            setLoading(false);
            return;
        }

        // Images, PDFs, Audio, Video don't require pre-fetch decoding
        if (isImage || isPdf || isVideo || isAudio || isOtherOffice) {
            setLoading(false);
            return;
        }

        const fetchAndParse = async () => {
            try {
                const response = await fetch(fileUrl);
                if (!response.ok) throw new Error(`HTTP ${response.status}: Failed to fetch file`);

                if (isExcel) {
                    const arrayBuffer = await response.arrayBuffer();
                    const workbook = XLSX.read(arrayBuffer, { type: "array" });
                    const parsedSheets = workbook.SheetNames.map(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
                        return { name: sheetName, rows };
                    });
                    if (isMounted) {
                        setSheetsData(parsedSheets);
                        setLoading(false);
                    }
                } else if (isDocx) {
                    const arrayBuffer = await response.arrayBuffer();
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    if (isMounted) {
                        setDocxHtml(result.value);
                        setLoading(false);
                    }
                } else if (isTextOrCode) {
                    const text = await response.text();
                    let formattedText = text;
                    if (fileExt === "json") {
                        try {
                            formattedText = JSON.stringify(JSON.parse(text), null, 2);
                        } catch (_) {}
                    } else if (fileExt === "xml") {
                        formattedText = formatXml(text);
                    }
                    if (isMounted) {
                        setTextContent(formattedText);
                        setLoading(false);
                    }
                } else {
                    // Fallback to text attempt
                    const text = await response.text();
                    if (isMounted) {
                        setTextContent(text);
                        setLoading(false);
                    }
                }
            } catch (err) {
                console.error("In-app file viewer error:", err);
                if (isMounted) {
                    setError(err.message || "Failed to parse document content for preview.");
                    setLoading(false);
                }
            }
        };

        fetchAndParse();

        return () => {
            isMounted = false;
        };
    }, [fileUrl, fileExt, isImage, isPdf, isExcel, isDocx, isTextOrCode, isVideo, isAudio, isOtherOffice]);

    // Keyboard shortcut to close (ESC)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [onClose]);

    // Filtered rows for Excel spreadsheet view
    const currentSheet = sheetsData[activeSheetIndex] || null;
    const filteredRows = useMemo(() => {
        if (!currentSheet || !currentSheet.rows) return [];
        if (!filterQuery.trim()) return currentSheet.rows;
        const q = filterQuery.toLowerCase();
        return currentSheet.rows.filter(row =>
            row.some(cell => String(cell).toLowerCase().includes(q))
        );
    }, [currentSheet, filterQuery]);

    // Filtered text lines for code/text view
    const textLines = useMemo(() => {
        if (!textContent) return [];
        return textContent.split("\n");
    }, [textContent]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-150">
            <div
                className="bg-white rounded-2xl shadow-2xl flex flex-col w-full max-w-5xl h-[90vh] max-h-[850px] overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-4 py-3 sm:px-6 sm:py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2878C7] flex items-center justify-center text-lg shrink-0 border border-blue-100">
                            {isImage ? (
                                <i className="fa-solid fa-file-image text-blue-600"></i>
                            ) : isPdf ? (
                                <i className="fa-solid fa-file-pdf text-rose-500"></i>
                            ) : isExcel ? (
                                <i className="fa-solid fa-file-excel text-emerald-600"></i>
                            ) : isDocx ? (
                                <i className="fa-solid fa-file-word text-blue-600"></i>
                            ) : isTextOrCode ? (
                                <i className="fa-solid fa-file-code text-amber-600"></i>
                            ) : isVideo ? (
                                <i className="fa-solid fa-file-video text-purple-600"></i>
                            ) : isAudio ? (
                                <i className="fa-solid fa-file-audio text-purple-600"></i>
                            ) : (
                                <i className="fa-solid fa-file-lines text-slate-500"></i>
                            )}
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm truncate max-w-md sm:max-w-xl">
                                {fileName}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                <span className="uppercase font-semibold tracking-wider text-slate-500">
                                    {fileExt || "FILE"}
                                </span>
                                {file.size && (
                                    <>
                                        <span>•</span>
                                        <span>{(file.size / 1024).toFixed(1)} KB</span>
                                    </>
                                )}
                                <span className="hidden sm:inline">• In-App Secure Viewer</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {canDownload ? (
                            <a
                                href={fileUrl}
                                download={fileName}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#2878C7] hover:bg-[#1e63a8] text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                title="Download original file"
                            >
                                <i className="fa-solid fa-download"></i>
                                <span className="hidden sm:inline">Download</span>
                            </a>
                        ) : (
                            <span
                                className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-1.5"
                                title="Download restricted by corporate governance policy"
                            >
                                <i className="fa-solid fa-lock text-[10px] text-amber-600"></i>
                                <span className="hidden sm:inline">Controlled Preview (Downloads Restricted)</span>
                                <span className="sm:hidden">Restricted</span>
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                            title="Close viewer (Esc)"
                        >
                            <i className="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                </div>

                {/* Sub-Header Toolbar for Searchable / Tabbed Content */}
                {isExcel && sheetsData.length > 0 && (
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 text-xs shrink-0 flex-wrap">
                        {/* Sheet Selection Tabs */}
                        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5 scrollbar-none">
                            {sheetsData.map((s, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => { setActiveSheetIndex(idx); setFilterQuery(""); }}
                                    className={`px-3 py-1 rounded-lg font-bold text-xs transition-all shrink-0 cursor-pointer ${
                                        activeSheetIndex === idx
                                            ? "bg-[#17365D] text-white shadow-xs"
                                            : "bg-white text-slate-600 hover:bg-slate-200 border border-slate-200"
                                    }`}
                                >
                                    <i className="fa-solid fa-table-cells text-[10px] mr-1 opacity-70"></i>
                                    {s.name}
                                </button>
                            ))}
                        </div>

                        {/* Search in Sheet */}
                        <div className="relative w-48 sm:w-60 ml-auto">
                            <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input
                                type="text"
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                placeholder="Search cells..."
                                className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#2878C7]"
                            />
                        </div>
                    </div>
                )}

                {isTextOrCode && textContent && (
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 text-xs shrink-0">
                        <div className="text-slate-500 font-semibold flex items-center gap-2">
                            <span>{textLines.length} lines</span>
                            <span>•</span>
                            <span>UTF-8</span>
                        </div>
                        <div className="relative w-48 sm:w-64">
                            <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                            <input
                                type="text"
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                placeholder="Filter lines..."
                                className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#2878C7]"
                            />
                        </div>
                    </div>
                )}

                {/* Main Content Body */}
                <div
                    className={`flex-1 overflow-auto bg-slate-100/70 p-4 sm:p-6 flex flex-col ${
                        !canDownload ? "select-none" : ""
                    }`}
                    onContextMenu={canDownload ? undefined : (e) => e.preventDefault()}
                >
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 m-auto">
                            <i className="fa-solid fa-spinner fa-spin text-2xl text-[#2878C7]"></i>
                            <span className="text-xs font-semibold">Parsing document for in-app preview...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-md m-auto">
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl mx-auto mb-3">
                                <i className="fa-solid fa-triangle-exclamation"></i>
                            </div>
                            <h5 className="font-bold text-slate-900 text-sm mb-1">In-App Preview Unavailable</h5>
                            <p className="text-xs text-slate-500 mb-4">{error}</p>
                            {canDownload && (
                                <a
                                    href={fileUrl}
                                    download={fileName}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2878C7] text-white text-xs font-semibold hover:bg-[#1e63a8] transition-colors"
                                >
                                    <i className="fa-solid fa-download"></i> Download Original File
                                </a>
                            )}
                        </div>
                    ) : isImage ? (
                        <div className="m-auto flex items-center justify-center max-w-full max-h-full">
                            <img
                                src={fileUrl}
                                alt={fileName}
                                className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-md border border-slate-200 bg-white"
                            />
                        </div>
                    ) : isPdf ? (
                        <iframe
                            src={fileUrl}
                            title={fileName}
                            className="w-full h-full min-h-[500px] rounded-xl border border-slate-200 bg-white shadow-xs"
                        />
                    ) : isExcel ? (
                        <div className="w-full h-full overflow-auto bg-white rounded-xl border border-slate-200 shadow-xs">
                            {filteredRows.length === 0 ? (
                                <div className="p-12 text-center text-slate-400 text-xs">
                                    No data found in this sheet matching "{filterQuery}"
                                </div>
                            ) : (
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-300">
                                        <tr>
                                            <th className="w-12 px-2 py-1.5 text-center text-[10px] font-bold text-slate-400 border-r border-slate-200 bg-slate-200/50">
                                                #
                                            </th>
                                            {(filteredRows[0] || []).map((_, colIdx) => {
                                                const colLetter = String.fromCharCode(65 + (colIdx % 26));
                                                return (
                                                    <th
                                                        key={colIdx}
                                                        className="px-3 py-1.5 font-bold text-slate-700 border-r border-slate-200 text-xs whitespace-nowrap"
                                                    >
                                                        {colLetter}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-mono">
                                        {filteredRows.map((row, rowIdx) => (
                                            <tr key={rowIdx} className="hover:bg-blue-50/50 transition-colors">
                                                <td className="px-2 py-1 text-center text-[10px] text-slate-400 font-bold bg-slate-50 border-r border-slate-200 select-none">
                                                    {rowIdx + 1}
                                                </td>
                                                {(row || []).map((cell, colIdx) => (
                                                    <td
                                                        key={colIdx}
                                                        className="px-3 py-1 text-slate-800 border-r border-slate-100 whitespace-nowrap text-xs"
                                                    >
                                                        {cell !== null && cell !== undefined ? String(cell) : ""}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    ) : isDocx ? (
                        <div className="w-full h-full overflow-auto flex justify-center">
                            <div className="w-full max-w-3xl bg-white shadow-md p-8 sm:p-12 rounded-xl border border-slate-200 text-slate-800 text-sm leading-relaxed docx-preview-content">
                                {docxHtml ? (
                                    <div
                                        dangerouslySetInnerHTML={{ __html: docxHtml }}
                                        className="space-y-4"
                                    />
                                ) : (
                                    <p className="text-slate-400 text-xs italic">Document contains no readable text content.</p>
                                )}
                            </div>
                        </div>
                    ) : isTextOrCode ? (
                        <div className="w-full h-full overflow-auto bg-[#1E1E1E] text-slate-200 rounded-xl p-4 font-mono text-xs shadow-inner border border-slate-800">
                            {textLines
                                .filter(line => !filterQuery.trim() || line.toLowerCase().includes(filterQuery.toLowerCase()))
                                .map((line, idx) => (
                                    <div key={idx} className="flex hover:bg-white/5 py-0.5 rounded px-1">
                                        <span className="w-10 text-right pr-4 text-slate-500 select-none shrink-0 text-[11px]">
                                            {idx + 1}
                                        </span>
                                        <span className="whitespace-pre-wrap break-all flex-1 text-slate-100">
                                            {line || "\u00A0"}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    ) : isVideo ? (
                        <div className="m-auto flex items-center justify-center max-w-full">
                            <video
                                src={fileUrl}
                                controls
                                controlsList={canDownload ? undefined : "nodownload"}
                                className="max-h-[70vh] max-w-full rounded-xl shadow-lg border border-slate-200 bg-black"
                            >
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    ) : isAudio ? (
                        <div className="m-auto w-full max-w-md bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-2xl mx-auto shadow-xs">
                                <i className="fa-solid fa-music"></i>
                            </div>
                            <div>
                                <h5 className="font-bold text-slate-900 text-sm">{fileName}</h5>
                                <p className="text-xs text-slate-400 mt-0.5">Audio Attachment</p>
                            </div>
                            <audio
                                src={fileUrl}
                                controls
                                controlsList={canDownload ? undefined : "nodownload"}
                                className="w-full"
                            >
                                Your browser does not support the audio tag.
                            </audio>
                        </div>
                    ) : isOtherOffice ? (
                        <div className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-white">
                            <iframe
                                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`}
                                title={fileName}
                                className="w-full flex-1 border-0"
                            />
                        </div>
                    ) : (
                        <div className="m-auto text-center p-8 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-md">
                            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#2878C7] flex items-center justify-center text-xl mx-auto mb-3">
                                <i className="fa-solid fa-file-lines"></i>
                            </div>
                            <h5 className="font-bold text-slate-900 text-sm mb-1">{fileName}</h5>
                            <p className="text-xs text-slate-500 mb-4">
                                Binary file preview is limited. You can download the file to view on your device.
                            </p>
                            {canDownload ? (
                                <a
                                    href={fileUrl}
                                    download={fileName}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2878C7] text-white text-xs font-semibold hover:bg-[#1e63a8] transition-colors"
                                >
                                    <i className="fa-solid fa-download"></i> Download File
                                </a>
                            ) : (
                                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
                                    <i className="fa-solid fa-lock text-amber-600 mr-1.5"></i>
                                    Download is restricted by corporate policy.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
