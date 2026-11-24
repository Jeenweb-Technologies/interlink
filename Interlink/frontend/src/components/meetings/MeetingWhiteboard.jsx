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

    // Canvas Dimensions
    const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

    // Drawing Elements State
    const [elements, setElements] = useState([]);
    const [history, setHistory] = useState([]);
    const [historyStep, setHistoryStep] = useState(0);

    // Active Tool State
    // tools: 'select', 'pen', 'highlighter', 'rect', 'circle', 'arrow', 'text', 'sticky', 'eraser', 'laser'
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

    // Load initial whiteboard state from database
    useEffect(() => {
        if (!meetingId) return;

        getMeetingWhiteboard(meetingId)
            .then((res) => {
                if (res.data?.success && res.data.whiteboard?.canvas_data) {
                    try {
                        const parsed = typeof res.data.whiteboard.canvas_data === "string"
                            ? JSON.parse(res.data.whiteboard.canvas_data)
                            : res.data.whiteboard.canvas_data;
                        if (Array.isArray(parsed)) {
                            setElements(parsed);
                            setHistory([parsed]);
                        }
                    } catch (e) {
                        console.warn("Could not parse whiteboard data:", e);
                    }
                }
            })
            .catch(() => {});
    }, [meetingId]);

    // Socket.IO Realtime Listeners for Differential Drawing & Cursor Synchronization
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

    // Broadcast cursor movement
    const handleMouseMove = (e) => {
        const stage = e.target.getStage();
        const point = stage.getPointerPosition();
        if (!point) return;

        // Invert stage transform for pan/zoom
        const realX = (point.x - stagePos.x) / scale;
        const realY = (point.y - stagePos.y) / scale;

        // Emit cursor position throttled
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

        // Tool: Laser Pointer
        if (tool === "laser") {
            setLaserPoints((prev) => [...prev.slice(-15), { x: realX, y: realY, id: Math.random() }]);
            return;
        }

        // Tool: Pen or Highlighter
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

    const handleMouseDown = (e) => {
        if (!canEdit) return;
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
                x: startX,
                y: startY,
                text: "Sticky Note",
                fill: stickyColor
            };
            const updated = [...elements, newSticky];
            setElements(updated);
            pushHistory(updated);
            broadcastAction("add", newSticky);
            isDrawing.current = false;
        } else if (tool === "text") {
            const newText = {
                id: `text_${Date.now()}`,
                type: "text",
                x: startX,
                y: startY,
                text: "Click to edit text",
                fill: color,
                fontSize: 18
            };
            const updated = [...elements, newText];
            setElements(updated);
            pushHistory(updated);
            broadcastAction("add", newText);
            isDrawing.current = false;
        }
    };

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
                const radius = Math.hypot(
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

    const broadcastAction = (action, element = null, allElements = null) => {
        if (socket && roomCode) {
            socket.emit("whiteboard_draw", {
                roomCode,
                action,
                element,
                elements: allElements
            });
        }
    };

    const pushHistory = (newElements) => {
        const nextHistory = history.slice(0, historyStep + 1);
        nextHistory.push(newElements);
        setHistory(nextHistory);
        setHistoryStep(nextHistory.length - 1);
    };

    const handleUndo = () => {
        if (historyStep > 0) {
            const prev = history[historyStep - 1];
            setHistoryStep(historyStep - 1);
            setElements(prev);
            broadcastAction("update_all", null, prev);
        }
    };

    const handleRedo = () => {
        if (historyStep < history.length - 1) {
            const next = history[historyStep + 1];
            setHistoryStep(historyStep + 1);
            setElements(next);
            broadcastAction("update_all", null, next);
        }
    };

    const handleClearCanvas = () => {
        if (!window.confirm("Are you sure you want to clear the entire whiteboard?")) return;
        setElements([]);
        pushHistory([]);
        broadcastAction("clear");
        toast.success("Whiteboard canvas cleared");
    };

    // Save whiteboard vector state & snapshot to backend database
    const handleSaveToProject = async () => {
        if (!meetingId) return;
        try {
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
        const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
        const link = document.createElement("a");
        link.download = `interlink-whiteboard-${roomCode || "export"}.png`;
        link.href = uri;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Whiteboard exported as PNG");
    };

    return (
        <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
            {/* Top Whiteboard Floating Toolbar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-slate-900/90 border border-white/15 p-1.5 rounded-2xl shadow-2xl backdrop-blur-md">
                {/* Pen */}
                <button
                    onClick={() => setTool("pen")}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                        tool === "pen"
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                    title="Pen Tool"
                >
                    <i className="fa-solid fa-pen"></i>
                </button>

                {/* Highlighter */}
                <button
                    onClick={() => setTool("highlighter")}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                        tool === "highlighter"
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                    title="Highlighter"
                >
                    <i className="fa-solid fa-highlighter"></i>
                </button>

                {/* Rectangle */}
                <button
                    onClick={() => setTool("rect")}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                        tool === "rect"
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                    title="Rectangle Shape"
                >
                    <i className="fa-regular fa-square"></i>
                </button>

                {/* Circle */}
                <button
                    onClick={() => setTool("circle")}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                        tool === "circle"
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                    title="Circle Shape"
                >
                    <i className="fa-regular fa-circle"></i>
                </button>

                {/* Arrow */}
                <button
                    onClick={() => setTool("arrow")}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                        tool === "arrow"
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                    title="Vector Arrow"
                >
                    <i className="fa-solid fa-arrow-right"></i>
                </button>

                {/* Sticky Note */}
                <button
                    onClick={() => setTool("sticky")}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                        tool === "sticky"
                            ? "bg-amber-500 text-slate-900 shadow-md shadow-amber-500/30 font-bold"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                    title="Sticky Note"
                >
                    <i className="fa-solid fa-note-sticky text-amber-400"></i>
                </button>

                {/* Text Tool */}
                <button
                    onClick={() => setTool("text")}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                        tool === "text"
                            ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 font-bold"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                    title="Text Box"
                >
                    <i className="fa-solid fa-font"></i>
                </button>

                {/* Laser Pointer */}
                <button
                    onClick={() => setTool("laser")}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                        tool === "laser"
                            ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 font-bold"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                    }`}
                    title="Laser Pointer"
                >
                    <i className="fa-solid fa-wand-magic-sparkles text-rose-400"></i>
                </button>

                {/* Separator */}
                <div className="w-px h-6 bg-white/15 mx-1"></div>

                {/* Color Palette */}
                {["#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#9333ea", "#ffffff"].map((c) => (
                    <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={`w-5 h-5 rounded-full border border-white/20 transition-transform cursor-pointer ${
                            color === c ? "scale-125 ring-2 ring-white" : "hover:scale-110"
                        }`}
                        style={{ backgroundColor: c }}
                    />
                ))}

                {/* Stroke Width Selector */}
                <div className="w-px h-6 bg-white/15 mx-1"></div>

                {[2, 4, 8].map((w) => (
                    <button
                        key={w}
                        onClick={() => setStrokeWidth(w)}
                        className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center cursor-pointer ${
                            strokeWidth === w ? "bg-white/20 text-white" : "text-slate-400 hover:text-white"
                        }`}
                    >
                        {w}px
                    </button>
                ))}

                {/* Separator */}
                <div className="w-px h-6 bg-white/15 mx-1"></div>

                {/* Undo / Redo */}
                <button
                    onClick={handleUndo}
                    disabled={historyStep <= 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Undo"
                >
                    <i className="fa-solid fa-rotate-left text-xs"></i>
                </button>

                <button
                    onClick={handleRedo}
                    disabled={historyStep >= history.length - 1}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Redo"
                >
                    <i className="fa-solid fa-rotate-right text-xs"></i>
                </button>

                {/* Clear */}
                <button
                    onClick={handleClearCanvas}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-400 cursor-pointer"
                    title="Clear Canvas"
                >
                    <i className="fa-solid fa-trash text-xs"></i>
                </button>
            </div>

            {/* Top Right Actions: Save to Project & Export */}
            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                <button
                    onClick={handleSaveToProject}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                    <span>Save to Project</span>
                </button>

                <button
                    onClick={handleExportPNG}
                    className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-white/15 hover:bg-white/10 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                    <i className="fa-solid fa-download"></i>
                    <span>Export PNG</span>
                </button>
            </div>

            {/* Canvas Stage */}
            <div
                ref={containerRef}
                className="flex-1 w-full h-full relative cursor-crosshair bg-[#0d1527]"
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
                        {/* Render Saved Elements */}
                        {elements.map((el) => {
                            if (el.type === "line") {
                                return (
                                    <Line
                                        key={el.id}
                                        points={el.points}
                                        stroke={el.stroke}
                                        strokeWidth={el.strokeWidth}
                                        tension={0.4}
                                        lineCap="round"
                                        lineJoin="round"
                                        opacity={el.opacity || 1}
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
                                        stroke={el.stroke}
                                        strokeWidth={el.strokeWidth}
                                        cornerRadius={4}
                                    />
                                );
                            } else if (el.type === "circle") {
                                return (
                                    <Circle
                                        key={el.id}
                                        x={el.x}
                                        y={el.y}
                                        radius={el.radius}
                                        stroke={el.stroke}
                                        strokeWidth={el.strokeWidth}
                                    />
                                );
                            } else if (el.type === "arrow") {
                                return (
                                    <Arrow
                                        key={el.id}
                                        points={el.points}
                                        stroke={el.stroke}
                                        fill={el.stroke}
                                        strokeWidth={el.strokeWidth}
                                        pointerLength={10}
                                        pointerWidth={10}
                                    />
                                );
                            } else if (el.type === "sticky") {
                                return (
                                    <Group key={el.id} x={el.x} y={el.y}>
                                        <Rect
                                            width={140}
                                            height={110}
                                            fill={el.fill || "#fef08a"}
                                            shadowColor="black"
                                            shadowBlur={10}
                                            shadowOpacity={0.3}
                                            cornerRadius={8}
                                        />
                                        <Text
                                            text={el.text || "Note"}
                                            x={10}
                                            y={10}
                                            width={120}
                                            fill="#1e293b"
                                            fontSize={13}
                                            fontFamily="sans-serif"
                                        />
                                    </Group>
                                );
                            } else if (el.type === "text") {
                                return (
                                    <Text
                                        key={el.id}
                                        x={el.x}
                                        y={el.y}
                                        text={el.text}
                                        fill={el.fill || "#ffffff"}
                                        fontSize={el.fontSize || 18}
                                        fontFamily="sans-serif"
                                    />
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

                {/* HTML Overlay for Remote User Cursors */}
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
            </div>
        </div>
    );
}
