import React, { useState, useRef, useEffect, useCallback } from "react";
import { Stage, Layer, Line, Rect, Circle, Arrow, Text, Group } from "react-konva";
import toast from "react-hot-toast";
import { saveMeetingWhiteboard, getMeetingWhiteboard } from "../../api/meetingApi";

export default function MeetingWhiteboard({
    roomCode,
    meetingId,
    projectId,
    socket,
    currentUser,
    canEdit = true
}) {
    const stageRef = useRef(null);
    const containerRef = useRef(null);
    const textareaRef = useRef(null);

    // Canvas Dimensions
    const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

    // Drawing Elements & History State
    // History initialized with empty array as step 0 so undo works on the very 1st stroke!
    const [elements, setElements] = useState([]);
    const [history, setHistory] = useState([[]]);
    const [historyStep, setHistoryStep] = useState(0);

    // Selection & Editing State
    const [selectedId, setSelectedId] = useState(null);
    const [editingText, setEditingText] = useState(null);

    // Active Tool State
    // tools: 'select', 'pen', 'highlighter', 'rect', 'circle', 'arrow', 'text', 'sticky', 'laser'
    const [tool, setTool] = useState("pen");
    const [color, setColor] = useState("#2563eb"); // default blue
    const [strokeWidth, setStrokeWidth] = useState(4);
    const [stickyColor, setStickyColor] = useState("#fef08a"); // pastel yellow

    const isDrawing = useRef(false);
    const [currentShape, setCurrentShape] = useState(null);

    // Live Remote Cursor Pointers
    const [remoteCursors, setRemoteCursors] = useState({});

    // Laser pointer transient trails
    const [laserPoints, setLaserPoints] = useState([]);

    // Zoom & Pan
    const [scale, setScale] = useState(1);
    const [stagePos, setStagePos] = useState({ x: 0, y: 0 });

    // Handle container resize
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.offsetWidth || 1200,
                    height: containerRef.current.offsetHeight || 800
                });
            }
        };
        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    // Broadcast helper
    const broadcastAction = useCallback(
        (action, element = null, allElements = null) => {
            if (socket && roomCode) {
                socket.emit("whiteboard_draw", {
                    roomCode,
                    action,
                    element,
                    elements: allElements
                });
            }
        },
        [socket, roomCode]
    );

    // History Snapshot Management (Deep Cloned)
    const pushHistory = useCallback(
        (newElements) => {
            setHistory((prev) => {
                const sliced = prev.slice(0, historyStep + 1);
                return [...sliced, JSON.parse(JSON.stringify(newElements))];
            });
            setHistoryStep((prev) => prev + 1);
        },
        [historyStep]
    );

    // Undo action
    const handleUndo = useCallback(() => {
        if (historyStep > 0) {
            const prevStep = historyStep - 1;
            const target = history[prevStep] || [];
            const cloned = JSON.parse(JSON.stringify(target));
            setHistoryStep(prevStep);
            setElements(cloned);
            setSelectedId(null);
            setEditingText(null);
            broadcastAction("update_all", null, cloned);
        }
    }, [history, historyStep, broadcastAction]);

    // Redo action
    const handleRedo = useCallback(() => {
        if (historyStep < history.length - 1) {
            const nextStep = historyStep + 1;
            const target = history[nextStep] || [];
            const cloned = JSON.parse(JSON.stringify(target));
            setHistoryStep(nextStep);
            setElements(cloned);
            setSelectedId(null);
            setEditingText(null);
            broadcastAction("update_all", null, cloned);
        }
    }, [history, historyStep, broadcastAction]);

    // Delete selected element
    const handleDeleteSelected = useCallback(() => {
        if (!selectedId) return;
        const updated = elements.filter((el) => el.id !== selectedId);
        setElements(updated);
        pushHistory(updated);
        broadcastAction("update_all", null, updated);
        setSelectedId(null);
        toast.success("Element deleted");
    }, [selectedId, elements, pushHistory, broadcastAction]);

    // Color change handler (also recolors selected shapes/sticky notes)
    const handleSelectColor = (c) => {
        setColor(c);
        const stickyPastelMap = {
            "#2563eb": "#bfdbfe", // pastel blue
            "#dc2626": "#fecaca", // pastel red/pink
            "#16a34a": "#bbf7d0", // pastel green
            "#f59e0b": "#fef08a", // pastel yellow
            "#9333ea": "#e9d5ff", // pastel purple
            "#ffffff": "#ffffff"  // white
        };
        const pastel = stickyPastelMap[c] || c;
        setStickyColor(pastel);

        if (selectedId) {
            const updated = elements.map((item) => {
                if (item.id === selectedId) {
                    if (item.type === "sticky") return { ...item, fill: pastel };
                    if (item.type === "text") return { ...item, fill: c };
                    return { ...item, stroke: c };
                }
                return item;
            });
            setElements(updated);
            pushHistory(updated);
            broadcastAction("update_all", null, updated);
        }
    };

    // Load initial whiteboard state from database
    useEffect(() => {
        if (!meetingId) return;

        getMeetingWhiteboard(meetingId)
            .then((res) => {
                if (res.data?.success && res.data.whiteboard?.canvas_data) {
                    try {
                        const parsed =
                            typeof res.data.whiteboard.canvas_data === "string"
                                ? JSON.parse(res.data.whiteboard.canvas_data)
                                : res.data.whiteboard.canvas_data;
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            setElements(parsed);
                            setHistory([[], parsed]);
                            setHistoryStep(1);
                        }
                    } catch (e) {
                        console.warn("Could not parse whiteboard data:", e);
                    }
                }
            })
            .catch(() => {});
    }, [meetingId]);

    // Socket.IO Realtime Listeners
    useEffect(() => {
        if (!socket) return;

        const handleRemoteDraw = (data) => {
            if (data.senderId === (currentUser?.id || currentUser?.identity)) return;

            if (data.action === "add" && data.element) {
                setElements((prev) => [...prev, data.element]);
            } else if (data.action === "update_all" && Array.isArray(data.elements)) {
                setElements(data.elements);
            } else if (data.action === "clear") {
                setElements([]);
                setSelectedId(null);
            }
        };

        const handleRemoteCursor = (data) => {
            if (data.senderId === (currentUser?.id || currentUser?.identity)) return;

            setRemoteCursors((prev) => ({
                ...prev,
                [data.senderId]: {
                    x: data.x,
                    y: data.y,
                    name: data.senderName || "Collaborator",
                    color: data.color || "#06b6d4",
                    updatedAt: Date.now()
                }
            }));
        };

        socket.on("whiteboard_draw", handleRemoteDraw);
        socket.on("whiteboard_cursor", handleRemoteCursor);

        return () => {
            socket.off("whiteboard_draw", handleRemoteDraw);
            socket.off("whiteboard_cursor", handleRemoteCursor);
        };
    }, [socket, currentUser]);

    // Cleanup stale remote cursors (older than 4 seconds)
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setRemoteCursors((prev) => {
                let changed = false;
                const next = { ...prev };
                for (const id in next) {
                    if (now - next[id].updatedAt > 4000) {
                        delete next[id];
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Delete)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (["INPUT", "TEXTAREA"].includes(e.target?.tagName)) {
                return;
            }

            // Undo: Ctrl+Z / Cmd+Z
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
                return;
            }

            // Redo: Ctrl+Y or Ctrl+Shift+Z
            if (
                ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
                ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && e.shiftKey)
            ) {
                e.preventDefault();
                handleRedo();
                return;
            }

            // Delete / Backspace selected element
            if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
                e.preventDefault();
                handleDeleteSelected();
                return;
            }

            // Tool hotkeys
            if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                if (e.key === "v" || e.key === "V") setTool("select");
                else if (e.key === "p" || e.key === "P") setTool("pen");
                else if (e.key === "h" || e.key === "H") setTool("highlighter");
                else if (e.key === "r" || e.key === "R") setTool("rect");
                else if (e.key === "c" || e.key === "C") setTool("circle");
                else if (e.key === "a" || e.key === "A") setTool("arrow");
                else if (e.key === "s" || e.key === "S") setTool("sticky");
                else if (e.key === "t" || e.key === "T") setTool("text");
                else if (e.key === "l" || e.key === "L") setTool("laser");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleUndo, handleRedo, selectedId, handleDeleteSelected]);

    // Focus and select textarea only once upon opening editor for an element
    const prevEditingIdRef = useRef(null);

    useEffect(() => {
        if (editingText && textareaRef.current) {
            if (prevEditingIdRef.current !== editingText.id) {
                prevEditingIdRef.current = editingText.id;
                textareaRef.current.focus();
                // Select default placeholder text so initial typing replaces it
                if (editingText.text === "Sticky Note" || editingText.text === "Text") {
                    textareaRef.current.select();
                } else {
                    const len = textareaRef.current.value.length;
                    textareaRef.current.setSelectionRange(len, len);
                }
            }
        } else {
            prevEditingIdRef.current = null;
        }
    }, [editingText?.id]);

    // Start inline text editing
    const handleStartTextEdit = useCallback(
        (el) => {
            if (!canEdit) return;
            setSelectedId(el.id);
            setEditingText({
                id: el.id,
                type: el.type,
                x: el.x * scale + stagePos.x,
                y: el.y * scale + stagePos.y,
                width: (el.type === "sticky" ? el.width || 160 : el.width || 200) * scale,
                height: (el.type === "sticky" ? el.height || 130 : el.height || 45) * scale,
                text: el.text || (el.type === "sticky" ? "Sticky Note" : "Text"),
                fill: el.fill,
                textColor: el.type === "sticky" ? "#1e293b" : el.fill || "#ffffff",
                fontSize: el.fontSize || (el.type === "sticky" ? 13 : 18)
            });
        },
        [canEdit, scale, stagePos]
    );

    // Save and close inline text editing (Never deletes element on blur)
    const handleFinishTextEdit = useCallback(() => {
        if (!editingText) return;
        const finalContent = editingText.text.trim();

        const updated = elements.map((item) => {
            if (item.id === editingText.id) {
                return {
                    ...item,
                    text: finalContent || (item.type === "sticky" ? "Sticky Note" : "Text")
                };
            }
            return item;
        });

        setElements(updated);
        pushHistory(updated);
        broadcastAction("update_all", null, updated);
        setEditingText(null);
    }, [editingText, elements, pushHistory, broadcastAction]);

    // Handle element drag move end
    const handleElementDragEnd = useCallback(
        (id, newX, newY) => {
            const updated = elements.map((item) => {
                if (item.id === id) {
                    return { ...item, x: newX, y: newY };
                }
                return item;
            });
            setElements(updated);
            pushHistory(updated);
            broadcastAction("update_all", null, updated);
        },
        [elements, pushHistory, broadcastAction]
    );

    // Mouse Move (Drawing & Cursor Tracking)
    const handleMouseMove = (e) => {
        const stage = e.target.getStage();
        const point = stage.getPointerPosition();
        if (!point) return;

        const realX = (point.x - stagePos.x) / scale;
        const realY = (point.y - stagePos.y) / scale;

        if (socket && roomCode) {
            socket.emit("whiteboard_cursor", {
                roomCode,
                cursor: {
                    x: realX,
                    y: realY,
                    senderName: currentUser?.name || "Participant",
                    color: color
                }
            });
        }

        if (!canEdit || !isDrawing.current) return;

        if (tool === "laser") {
            setLaserPoints((prev) => [...prev.slice(-15), { x: realX, y: realY, id: Math.random() }]);
            return;
        }

        if (tool === "pen" || tool === "highlighter") {
            setCurrentShape((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    points: [...prev.points, realX, realY]
                };
            });
        } else if (tool === "rect" || tool === "circle" || tool === "arrow") {
            setCurrentShape((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    endX: realX,
                    endY: realY
                };
            });
        }
    };

    // Mouse Down (Start Drawing or Place Sticky/Text)
    const handleMouseDown = (e) => {
        if (!canEdit) return;

        // Clicking on canvas background in select mode deselects
        if (e.target === e.target.getStage()) {
            setSelectedId(null);
            if (editingText) {
                handleFinishTextEdit();
            }
        }

        if (tool === "select") {
            return;
        }

        isDrawing.current = true;
        const stage = e.target.getStage();
        const point = stage.getPointerPosition();
        if (!point) return;

        const startX = (point.x - stagePos.x) / scale;
        const startY = (point.y - stagePos.y) / scale;

        if (tool === "pen") {
            setCurrentShape({
                id: `stroke_${Date.now()}`,
                type: "line",
                points: [startX, startY],
                stroke: color,
                strokeWidth: strokeWidth,
                opacity: 1
            });
        } else if (tool === "highlighter") {
            setCurrentShape({
                id: `highlighter_${Date.now()}`,
                type: "line",
                points: [startX, startY],
                stroke: color,
                strokeWidth: strokeWidth * 3.5,
                opacity: 0.35
            });
        } else if (tool === "rect") {
            setCurrentShape({
                id: `rect_${Date.now()}`,
                type: "rect",
                startX,
                startY,
                endX: startX,
                endY: startY,
                stroke: color,
                strokeWidth: strokeWidth,
                fill: "transparent"
            });
        } else if (tool === "circle") {
            setCurrentShape({
                id: `circle_${Date.now()}`,
                type: "circle",
                startX,
                startY,
                endX: startX,
                endY: startY,
                stroke: color,
                strokeWidth: strokeWidth,
                fill: "transparent"
            });
        } else if (tool === "arrow") {
            setCurrentShape({
                id: `arrow_${Date.now()}`,
                type: "arrow",
                startX,
                startY,
                endX: startX,
                endY: startY,
                stroke: color,
                strokeWidth: strokeWidth
            });
        } else if (tool === "sticky") {
            const newSticky = {
                id: `sticky_${Date.now()}`,
                type: "sticky",
                x: Math.max(20, Math.round(startX - 80)),
                y: Math.max(20, Math.round(startY - 65)),
                width: 160,
                height: 130,
                text: "Sticky Note",
                fill: stickyColor || "#fef08a"
            };
            const updated = [...elements, newSticky];
            setElements(updated);
            pushHistory(updated);
            broadcastAction("add", newSticky);
            isDrawing.current = false;
            setSelectedId(newSticky.id);
            setTool("select");

            // Open inline text editor on short timeout to avoid mouse-up race conditions
            setTimeout(() => {
                handleStartTextEdit(newSticky);
            }, 60);
        } else if (tool === "text") {
            const newText = {
                id: `text_${Date.now()}`,
                type: "text",
                x: Math.max(20, Math.round(startX)),
                y: Math.max(20, Math.round(startY - 12)),
                width: 200,
                height: 45,
                text: "Text",
                fill: color,
                fontSize: 18
            };
            const updated = [...elements, newText];
            setElements(updated);
            pushHistory(updated);
            broadcastAction("add", newText);
            isDrawing.current = false;
            setSelectedId(newText.id);
            setTool("select");

            // Open inline text editor on short timeout
            setTimeout(() => {
                handleStartTextEdit(newText);
            }, 60);
        }
    };

    // Mouse Up (Finalize in-progress shapes)
    const handleMouseUp = () => {
        if (!canEdit || !isDrawing.current) return;
        isDrawing.current = false;

        if (currentShape) {
            let finalizedShape = null;

            if (currentShape.type === "line") {
                finalizedShape = currentShape;
            } else if (currentShape.type === "rect") {
                const x = Math.min(currentShape.startX, currentShape.endX);
                const y = Math.min(currentShape.startY, currentShape.endY);
                const width = Math.abs(currentShape.endX - currentShape.startX);
                const height = Math.abs(currentShape.endY - currentShape.startY);
                if (width > 3 && height > 3) {
                    finalizedShape = {
                        ...currentShape,
                        x,
                        y,
                        width,
                        height
                    };
                }
            } else if (currentShape.type === "circle") {
                const radius =
                    Math.hypot(
                        currentShape.endX - currentShape.startX,
                        currentShape.endY - currentShape.startY
                    ) / 2;
                if (radius > 3) {
                    finalizedShape = {
                        ...currentShape,
                        x: (currentShape.startX + currentShape.endX) / 2,
                        y: (currentShape.startY + currentShape.endY) / 2,
                        radius
                    };
                }
            } else if (currentShape.type === "arrow") {
                finalizedShape = {
                    ...currentShape,
                    points: [currentShape.startX, currentShape.startY, currentShape.endX, currentShape.endY]
                };
            }

            if (finalizedShape) {
                const updated = [...elements, finalizedShape];
                setElements(updated);
                pushHistory(updated);
                broadcastAction("add", finalizedShape);
            }

            setCurrentShape(null);
        }
    };

    // Clear whole canvas
    const handleClearCanvas = () => {
        if (elements.length === 0) return;
        if (!window.confirm("Are you sure you want to clear the entire whiteboard?")) return;
        setElements([]);
        pushHistory([]);
        broadcastAction("clear");
        setSelectedId(null);
        setEditingText(null);
        toast.success("Whiteboard canvas cleared");
    };

    // Save whiteboard vector state & snapshot to backend database
    const handleSaveToProject = async () => {
        if (!meetingId) return;
        try {
            setSelectedId(null);
            const dataUrl = stageRef.current ? stageRef.current.toDataURL() : null;

            await saveMeetingWhiteboard(meetingId, {
                canvas_data: elements,
                thumbnail_url: dataUrl,
                project_id: projectId || null
            });

            toast.success("Whiteboard saved to project workspace! 🎨");
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to save whiteboard");
        }
    };

    // Export to High-Res PNG
    const handleExportPNG = () => {
        if (!stageRef.current) return;
        setSelectedId(null);
        setTimeout(() => {
            const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
            const link = document.createElement("a");
            link.download = `interlink-whiteboard-${roomCode || "export"}.png`;
            link.href = uri;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Whiteboard exported as PNG");
        }, 50);
    };

    return (
        <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
            {/* ─── Top Floating Controls Bar (Unified, Non-overlapping) ─── */}
            <div className="absolute top-3 inset-x-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                {/* Left/Center Island: Tools, Styles & History */}
                <div className="pointer-events-auto flex items-center gap-1 bg-slate-900/95 border border-white/15 p-1.5 rounded-2xl shadow-2xl backdrop-blur-md overflow-x-auto max-w-[calc(100%-180px)] sm:max-w-none">
                    {/* Select / Move */}
                    <button
                        onClick={() => {
                            setTool("select");
                            if (editingText) handleFinishTextEdit();
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all cursor-pointer ${
                            tool === "select"
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                        title="Select & Move Tool (V)"
                    >
                        <i className="fa-solid fa-arrow-pointer"></i>
                    </button>

                    {/* Pen */}
                    <button
                        onClick={() => {
                            setTool("pen");
                            setSelectedId(null);
                            if (editingText) handleFinishTextEdit();
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all cursor-pointer ${
                            tool === "pen"
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                        title="Pen Tool (P)"
                    >
                        <i className="fa-solid fa-pen"></i>
                    </button>

                    {/* Highlighter */}
                    <button
                        onClick={() => {
                            setTool("highlighter");
                            setSelectedId(null);
                            if (editingText) handleFinishTextEdit();
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all cursor-pointer ${
                            tool === "highlighter"
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                        title="Highlighter (H)"
                    >
                        <i className="fa-solid fa-highlighter"></i>
                    </button>

                    {/* Rectangle */}
                    <button
                        onClick={() => {
                            setTool("rect");
                            setSelectedId(null);
                            if (editingText) handleFinishTextEdit();
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all cursor-pointer ${
                            tool === "rect"
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                        title="Rectangle Shape (R)"
                    >
                        <i className="fa-regular fa-square"></i>
                    </button>

                    {/* Circle */}
                    <button
                        onClick={() => {
                            setTool("circle");
                            setSelectedId(null);
                            if (editingText) handleFinishTextEdit();
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all cursor-pointer ${
                            tool === "circle"
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                        title="Circle Shape (C)"
                    >
                        <i className="fa-regular fa-circle"></i>
                    </button>

                    {/* Arrow */}
                    <button
                        onClick={() => {
                            setTool("arrow");
                            setSelectedId(null);
                            if (editingText) handleFinishTextEdit();
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all cursor-pointer ${
                            tool === "arrow"
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                        title="Vector Arrow (A)"
                    >
                        <i className="fa-solid fa-arrow-right"></i>
                    </button>

                    {/* Sticky Note */}
                    <button
                        onClick={() => {
                            setTool("sticky");
                            setSelectedId(null);
                            if (editingText) handleFinishTextEdit();
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all cursor-pointer ${
                            tool === "sticky"
                                ? "bg-amber-500 text-slate-900 shadow-md shadow-amber-500/30 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                        title="Sticky Note (S) - Click on canvas to place"
                    >
                        <i className="fa-solid fa-note-sticky text-amber-400"></i>
                    </button>

                    {/* Text Tool */}
                    <button
                        onClick={() => {
                            setTool("text");
                            setSelectedId(null);
                            if (editingText) handleFinishTextEdit();
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all cursor-pointer ${
                            tool === "text"
                                ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                        title="Text Tool (T) - Click on canvas to type"
                    >
                        <i className="fa-solid fa-font"></i>
                    </button>

                    {/* Laser Pointer */}
                    <button
                        onClick={() => {
                            setTool("laser");
                            setSelectedId(null);
                            if (editingText) handleFinishTextEdit();
                        }}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs transition-all cursor-pointer ${
                            tool === "laser"
                                ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 font-bold"
                                : "text-slate-400 hover:text-white hover:bg-white/10"
                        }`}
                        title="Laser Pointer (L)"
                    >
                        <i className="fa-solid fa-wand-magic-sparkles text-rose-400"></i>
                    </button>

                    {/* Separator */}
                    <div className="w-px h-5 bg-white/15 mx-1"></div>

                    {/* Color Palette */}
                    {["#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#9333ea", "#ffffff"].map((c) => (
                        <button
                            key={c}
                            onClick={() => handleSelectColor(c)}
                            className={`w-4.5 h-4.5 rounded-full border border-white/20 transition-transform cursor-pointer shrink-0 ${
                                color === c ? "scale-125 ring-2 ring-white" : "hover:scale-110"
                            }`}
                            style={{ backgroundColor: c }}
                        />
                    ))}

                    {/* Separator */}
                    <div className="w-px h-5 bg-white/15 mx-1"></div>

                    {/* Stroke Width Selector */}
                    {[2, 4, 8].map((w) => (
                        <button
                            key={w}
                            onClick={() => setStrokeWidth(w)}
                            className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center cursor-pointer transition-colors ${
                                strokeWidth === w ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"
                            }`}
                        >
                            {w}
                        </button>
                    ))}

                    {/* Separator */}
                    <div className="w-px h-5 bg-white/15 mx-1"></div>

                    {/* Undo (Ctrl+Z) */}
                    <button
                        onClick={handleUndo}
                        disabled={historyStep <= 0}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all"
                        title="Undo (Ctrl+Z)"
                    >
                        <i className="fa-solid fa-rotate-left text-xs"></i>
                    </button>

                    {/* Redo (Ctrl+Y) */}
                    <button
                        onClick={handleRedo}
                        disabled={historyStep >= history.length - 1}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all"
                        title="Redo (Ctrl+Y)"
                    >
                        <i className="fa-solid fa-rotate-right text-xs"></i>
                    </button>

                    {/* Delete Selected Item or Clear All Canvas */}
                    {selectedId ? (
                        <button
                            onClick={handleDeleteSelected}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-rose-400 hover:text-white hover:bg-rose-600 cursor-pointer transition-all"
                            title="Delete Selected Item (Delete)"
                        >
                            <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                    ) : (
                        <button
                            onClick={handleClearCanvas}
                            disabled={elements.length === 0}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all"
                            title="Clear Whiteboard"
                        >
                            <i className="fa-solid fa-trash text-xs"></i>
                        </button>
                    )}
                </div>

                {/* Right Island: Save & Export (Zero overlap guaranteed) */}
                <div className="pointer-events-auto shrink-0 flex items-center gap-1.5 bg-slate-900/95 border border-white/15 p-1.5 rounded-2xl shadow-2xl backdrop-blur-md">
                    <button
                        onClick={handleSaveToProject}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/30 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
                        title="Save Whiteboard to Project"
                    >
                        <i className="fa-solid fa-cloud-arrow-up text-xs"></i>
                        <span className="hidden sm:inline">Save</span>
                    </button>

                    <button
                        onClick={handleExportPNG}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        title="Export High-Res PNG"
                    >
                        <i className="fa-solid fa-download text-xs"></i>
                        <span className="hidden sm:inline">Export PNG</span>
                    </button>
                </div>
            </div>

            {/* ─── Canvas Stage ─────────────────────────────────────────── */}
            <div
                ref={containerRef}
                className={`flex-1 w-full h-full relative bg-[#0d1527] ${
                    tool === "select" ? "cursor-default" : "cursor-crosshair"
                }`}
            >
                <Stage
                    ref={stageRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    scaleX={scale}
                    scaleY={scale}
                    x={stagePos.x}
                    y={stagePos.y}
                >
                    <Layer>
                        {/* Render Elements */}
                        {elements.map((el) => {
                            const isSelected = selectedId === el.id;

                            if (el.type === "line") {
                                return (
                                    <Line
                                        key={el.id}
                                        points={el.points}
                                        stroke={isSelected ? "#38bdf8" : el.stroke}
                                        strokeWidth={el.strokeWidth}
                                        tension={0.4}
                                        lineCap="round"
                                        lineJoin="round"
                                        opacity={el.opacity || 1}
                                        onClick={(e) => {
                                            if (tool === "select") {
                                                e.cancelBubble = true;
                                                setSelectedId(el.id);
                                            }
                                        }}
                                    />
                                );
                            } else if (el.type === "rect") {
                                return (
                                    <Rect
                                        key={el.id}
                                        x={el.x}
                                        y={el.y}
                                        width={el.width}
                                        height={el.height}
                                        stroke={isSelected ? "#38bdf8" : el.stroke}
                                        strokeWidth={isSelected ? el.strokeWidth + 2 : el.strokeWidth}
                                        dash={isSelected ? [6, 4] : undefined}
                                        cornerRadius={4}
                                        draggable={canEdit && tool === "select"}
                                        onClick={(e) => {
                                            if (tool === "select") {
                                                e.cancelBubble = true;
                                                setSelectedId(el.id);
                                            }
                                        }}
                                        onDragEnd={(e) => {
                                            handleElementDragEnd(el.id, e.target.x(), e.target.y());
                                        }}
                                    />
                                );
                            } else if (el.type === "circle") {
                                return (
                                    <Circle
                                        key={el.id}
                                        x={el.x}
                                        y={el.y}
                                        radius={el.radius}
                                        stroke={isSelected ? "#38bdf8" : el.stroke}
                                        strokeWidth={isSelected ? el.strokeWidth + 2 : el.strokeWidth}
                                        dash={isSelected ? [6, 4] : undefined}
                                        draggable={canEdit && tool === "select"}
                                        onClick={(e) => {
                                            if (tool === "select") {
                                                e.cancelBubble = true;
                                                setSelectedId(el.id);
                                            }
                                        }}
                                        onDragEnd={(e) => {
                                            handleElementDragEnd(el.id, e.target.x(), e.target.y());
                                        }}
                                    />
                                );
                            } else if (el.type === "arrow") {
                                return (
                                    <Arrow
                                        key={el.id}
                                        points={el.points}
                                        stroke={isSelected ? "#38bdf8" : el.stroke}
                                        fill={isSelected ? "#38bdf8" : el.stroke}
                                        strokeWidth={el.strokeWidth}
                                        pointerLength={10}
                                        pointerWidth={10}
                                        onClick={(e) => {
                                            if (tool === "select") {
                                                e.cancelBubble = true;
                                                setSelectedId(el.id);
                                            }
                                        }}
                                    />
                                );
                            } else if (el.type === "sticky") {
                                const isEditingThis = editingText?.id === el.id;

                                return (
                                    <Group
                                        key={el.id}
                                        x={el.x}
                                        y={el.y}
                                        draggable={canEdit && tool === "select"}
                                        onClick={(e) => {
                                            e.cancelBubble = true;
                                            setSelectedId(el.id);
                                            if (tool === "text") {
                                                handleStartTextEdit(el);
                                            }
                                        }}
                                        onDblClick={(e) => {
                                            e.cancelBubble = true;
                                            handleStartTextEdit(el);
                                        }}
                                        onDragEnd={(e) => {
                                            handleElementDragEnd(el.id, e.target.x(), e.target.y());
                                        }}
                                    >
                                        {/* Sticky Note Body (Always rendered and visible) */}
                                        <Rect
                                            width={el.width || 160}
                                            height={el.height || 130}
                                            fill={el.fill || "#fef08a"}
                                            shadowColor="#000000"
                                            shadowBlur={isSelected ? 16 : 10}
                                            shadowOffset={{ x: 3, y: 4 }}
                                            shadowOpacity={isSelected ? 0.45 : 0.28}
                                            stroke={isSelected ? "#3b82f6" : "rgba(0,0,0,0.15)"}
                                            strokeWidth={isSelected ? 2 : 1}
                                            cornerRadius={8}
                                        />

                                        {/* Top Header Pin/Accent Line */}
                                        <Rect
                                            width={el.width || 160}
                                            height={6}
                                            fill="rgba(0,0,0,0.06)"
                                            cornerRadius={[8, 8, 0, 0]}
                                        />

                                        {/* Note Content Text */}
                                        {!isEditingThis && (
                                            <Text
                                                text={el.text || "Sticky Note"}
                                                x={14}
                                                y={16}
                                                width={(el.width || 160) - 28}
                                                height={(el.height || 130) - 30}
                                                fill="#1e293b"
                                                fontSize={13}
                                                fontFamily="sans-serif"
                                                wrap="word"
                                                lineHeight={1.35}
                                            />
                                        )}
                                    </Group>
                                );
                            } else if (el.type === "text") {
                                const isEditingThis = editingText?.id === el.id;

                                return (
                                    <Group
                                        key={el.id}
                                        x={el.x}
                                        y={el.y}
                                        draggable={canEdit && tool === "select"}
                                        onClick={(e) => {
                                            e.cancelBubble = true;
                                            setSelectedId(el.id);
                                            if (tool === "text") {
                                                handleStartTextEdit(el);
                                            }
                                        }}
                                        onDblClick={(e) => {
                                            e.cancelBubble = true;
                                            handleStartTextEdit(el);
                                        }}
                                        onDragEnd={(e) => {
                                            handleElementDragEnd(el.id, e.target.x(), e.target.y());
                                        }}
                                    >
                                        {isSelected && (
                                            <Rect
                                                x={-6}
                                                y={-4}
                                                width={(el.width || 180) + 12}
                                                height={(el.height || 40) + 8}
                                                stroke="#38bdf8"
                                                strokeWidth={1.5}
                                                dash={[4, 4]}
                                                cornerRadius={4}
                                            />
                                        )}
                                        {!isEditingThis && (
                                            <Text
                                                text={el.text || "Text"}
                                                x={0}
                                                y={0}
                                                fill={el.text ? el.fill || "#ffffff" : "#94a3b8"}
                                                fontSize={el.fontSize || 18}
                                                fontFamily="sans-serif"
                                            />
                                        )}
                                    </Group>
                                );
                            }
                            return null;
                        })}

                        {/* Current In-Progress Shape */}
                        {currentShape && currentShape.type === "line" && (
                            <Line
                                points={currentShape.points}
                                stroke={currentShape.stroke}
                                strokeWidth={currentShape.strokeWidth}
                                tension={0.4}
                                lineCap="round"
                                lineJoin="round"
                                opacity={currentShape.opacity || 1}
                            />
                        )}
                        {currentShape && currentShape.type === "rect" && (
                            <Rect
                                x={Math.min(currentShape.startX, currentShape.endX)}
                                y={Math.min(currentShape.startY, currentShape.endY)}
                                width={Math.abs(currentShape.endX - currentShape.startX)}
                                height={Math.abs(currentShape.endY - currentShape.startY)}
                                stroke={currentShape.stroke}
                                strokeWidth={currentShape.strokeWidth}
                            />
                        )}
                        {currentShape && currentShape.type === "circle" && (
                            <Circle
                                x={(currentShape.startX + currentShape.endX) / 2}
                                y={(currentShape.startY + currentShape.endY) / 2}
                                radius={
                                    Math.hypot(
                                        currentShape.endX - currentShape.startX,
                                        currentShape.endY - currentShape.startY
                                    ) / 2
                                }
                                stroke={currentShape.stroke}
                                strokeWidth={currentShape.strokeWidth}
                            />
                        )}
                        {currentShape && currentShape.type === "arrow" && (
                            <Arrow
                                points={[
                                    currentShape.startX,
                                    currentShape.startY,
                                    currentShape.endX,
                                    currentShape.endY
                                ]}
                                stroke={currentShape.stroke}
                                fill={currentShape.stroke}
                                strokeWidth={currentShape.strokeWidth}
                                pointerLength={10}
                                pointerWidth={10}
                            />
                        )}

                        {/* Transient Laser Pointer Dots */}
                        {laserPoints.map((pt) => (
                            <Circle
                                key={pt.id}
                                x={pt.x}
                                y={pt.y}
                                radius={5}
                                fill="#f43f5e"
                                shadowColor="#f43f5e"
                                shadowBlur={12}
                            />
                        ))}
                    </Layer>
                </Stage>

                {/* ─── Active Inline HTML Textarea for Sticky Notes & Text ─── */}
                {editingText && (
                    <div
                        className="absolute z-50 pointer-events-auto"
                        style={{
                            left: `${editingText.x}px`,
                            top: `${editingText.y}px`,
                            width: `${Math.max(160, editingText.width)}px`,
                            minHeight: `${Math.max(60, editingText.height)}px`
                        }}
                    >
                        <textarea
                            ref={textareaRef}
                            value={editingText.text}
                            onChange={(e) => setEditingText((prev) => ({ ...prev, text: e.target.value }))}
                            onBlur={handleFinishTextEdit}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === "Escape") {
                                    e.preventDefault();
                                    handleFinishTextEdit();
                                } else if (
                                    e.key === "Enter" &&
                                    !e.shiftKey &&
                                    editingText.type !== "sticky"
                                ) {
                                    e.preventDefault();
                                    handleFinishTextEdit();
                                }
                            }}
                            placeholder={
                                editingText.type === "sticky"
                                    ? "Write note here..."
                                    : "Type text here..."
                            }
                            className={`w-full p-3 rounded-lg outline-hidden text-xs font-medium resize-none shadow-2xl transition-all ${
                                editingText.type === "sticky"
                                    ? "text-slate-900 placeholder:text-slate-500 border-2 border-amber-500"
                                    : "text-white placeholder:text-slate-400 bg-slate-900/95 border-2 border-blue-500"
                            }`}
                            style={{
                                backgroundColor:
                                    editingText.type === "sticky"
                                        ? editingText.fill || "#fef08a"
                                        : undefined,
                                fontSize: `${editingText.fontSize || 13}px`,
                                lineHeight: "1.35",
                                height: `${Math.max(60, editingText.height)}px`
                            }}
                            autoFocus
                            rows={editingText.type === "sticky" ? 5 : 2}
                        />
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between bg-slate-900/80 px-2 py-0.5 rounded-md backdrop-blur-xs">
                            <span>
                                {editingText.type === "sticky" ? "Shift+Enter for newline" : "Enter or click outside to save"}
                            </span>
                            <span>Esc to finish</span>
                        </div>
                    </div>
                )}

                {/* ─── HTML Overlay for Remote User Cursors ─── */}
                {Object.entries(remoteCursors).map(([id, cursor]) => (
                    <div
                        key={id}
                        className="absolute pointer-events-none transition-all duration-75 flex items-center gap-1.5"
                        style={{
                            left: cursor.x * scale + stagePos.x,
                            top: cursor.y * scale + stagePos.y
                        }}
                    >
                        <i
                            className="fa-solid fa-arrow-pointer text-xs drop-shadow-md"
                            style={{ color: cursor.color }}
                        ></i>
                        <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-md"
                            style={{ backgroundColor: cursor.color }}
                        >
                            {cursor.name}
                        </span>
                    </div>
                ))}

                {/* ─── Bottom-Left Zoom & Pan Controls ─── */}
                <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 bg-slate-900/90 border border-white/15 p-1 rounded-xl shadow-xl backdrop-blur-md text-xs text-slate-300">
                    <button
                        onClick={() => setScale((s) => Math.max(0.5, s - 0.15))}
                        className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
                        title="Zoom Out"
                    >
                        <i className="fa-solid fa-minus text-[10px]"></i>
                    </button>
                    <button
                        onClick={() => {
                            setScale(1);
                            setStagePos({ x: 0, y: 0 });
                        }}
                        className="px-2 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center font-mono font-semibold cursor-pointer transition-colors"
                        title="Reset Zoom (100%)"
                    >
                        {Math.round(scale * 100)}%
                    </button>
                    <button
                        onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
                        className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
                        title="Zoom In"
                    >
                        <i className="fa-solid fa-plus text-[10px]"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}
