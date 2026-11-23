import React, { useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

/**
 * Format bytes to readable size string (B, KB, MB)
 */
export const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes) || bytes <= 0) return "0 KB";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * Compresses an image canvas to target default size between 25 KB and 50 KB.
 * Downscales dimensions (max 800px) and adaptively adjusts JPEG quality.
 */
export const compressImageToTarget = async (canvas, targetMinKB = 25, targetMaxKB = 50) => {
    const MAX_DIM = 800;
    let width = canvas.width || 800;
    let height = canvas.height || 600;

    // Maintain aspect ratio while bounding within MAX_DIM
    if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
        } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
        }
    }

    const workingCanvas = document.createElement("canvas");
    workingCanvas.width = width;
    workingCanvas.height = height;
    const ctx = workingCanvas.getContext("2d");
    ctx.drawImage(canvas, 0, 0, width, height);

    const getBlob = (q) =>
        new Promise((resolve) => {
            workingCanvas.toBlob((b) => resolve(b), "image/jpeg", q);
        });

    // Start with balanced quality for chat display
    let quality = 0.70;
    let blob = await getBlob(quality);
    if (!blob) {
        const dataUrl = workingCanvas.toDataURL("image/jpeg", 0.7);
        return { blob: null, dataUrl, sizeKB: 35 };
    }

    let sizeKB = blob.size / 1024;

    // If larger than targetMaxKB (50KB), step down quality adaptively
    if (sizeKB > targetMaxKB) {
        const testQualities = [0.58, 0.46, 0.36, 0.28, 0.20];
        for (const q of testQualities) {
            quality = q;
            const testBlob = await getBlob(quality);
            if (testBlob) {
                blob = testBlob;
                sizeKB = blob.size / 1024;
                if (sizeKB <= targetMaxKB) break;
            }
        }

        // If still > targetMaxKB at lowest quality, downscale dimensions slightly
        if (sizeKB > targetMaxKB) {
            const smallerCanvas = document.createElement("canvas");
            smallerCanvas.width = Math.round(width * 0.75);
            smallerCanvas.height = Math.round(height * 0.75);
            const sCtx = smallerCanvas.getContext("2d");
            sCtx.drawImage(workingCanvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
            const downscaledBlob = await new Promise((res) => smallerCanvas.toBlob(res, "image/jpeg", 0.45));
            if (downscaledBlob) {
                blob = downscaledBlob;
                sizeKB = blob.size / 1024;
            }
        }
    } else if (sizeKB < targetMinKB) {
        // If image is very small (< 25KB), check if higher quality remains <= targetMaxKB
        const higherBlob = await getBlob(0.85);
        if (higherBlob && higherBlob.size / 1024 <= targetMaxKB) {
            blob = higherBlob;
            sizeKB = blob.size / 1024;
        }
    }

    const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });

    return {
        blob,
        dataUrl,
        sizeKB: parseFloat(sizeKB.toFixed(1))
    };
};

export default function CameraCaptureModal({ onClose, onSendMedia, onSendPhoto }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);
    const timerIntervalRef = useRef(null);
    const nativeCameraInputRef = useRef(null);
    const recordingDurationRef = useRef(0);

    // Modes: 'photo' | 'video'
    const [activeMode, setActiveMode] = useState("photo");
    const [facingMode, setFacingMode] = useState("user"); // 'user' | 'environment'
    const [isMicMuted, setIsMicMuted] = useState(false);

    // Captured States
    const [capturedImage, setCapturedImage] = useState(null); // dataURL for photo
    const [capturedVideoUrl, setCapturedVideoUrl] = useState(null); // blob URL for video preview
    const [capturedFile, setCapturedFile] = useState(null); // File object for upload
    const [caption, setCaption] = useState("");
    const [isProcessing, setIsProcessing] = useState(false); // Image compression loading state

    // Video Recording & Tracking States
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0); // in seconds
    const [capturedVideoDuration, setCapturedVideoDuration] = useState(0);
    const [recordedSizeBytes, setRecordedSizeBytes] = useState(0); // Live & final file size
    const MAX_RECORD_SECONDS = 120; // 2 minutes max recording safeguard

    // Camera Hardware States
    const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [isStartingCamera, setIsStartingCamera] = useState(true);
    const [isFlashing, setIsFlashing] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Stop active camera stream and recording
    const stopStream = useCallback(() => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            try {
                mediaRecorderRef.current.stop();
            } catch (e) { }
            mediaRecorderRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
                try { track.stop(); } catch (_) { }
            });
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    }, []);

    // Check available camera devices
    useEffect(() => {
        if (navigator.mediaDevices?.enumerateDevices) {
            navigator.mediaDevices.enumerateDevices().then((devices) => {
                const videoDevices = devices.filter((d) => d.kind === "videoinput");
                setHasMultipleCameras(videoDevices.length > 1);
            }).catch(() => { });
        }
    }, []);

    // Start camera stream with multi-level fallbacks for mobile, tablet, and desktop
    const startCamera = useCallback(async (mode, streamType, micMuted) => {
        setIsStartingCamera(true);
        setCameraError(null);
        stopStream();

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("WebRTC camera is not supported or not allowed on this browser.");
            }

            let stream = null;
            const wantAudio = streamType === "video" && !micMuted;

            // Strategy 1: Ideal constraints with requested facingMode & resolution
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: mode },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: wantAudio
                });
            } catch (e1) {
                console.warn("Primary camera constraints failed, trying basic facingMode:", e1);
                // Strategy 2: Relaxed facingMode without resolution limits
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: mode },
                        audio: wantAudio
                    });
                } catch (e2) {
                    console.warn("Relaxed facingMode failed, trying generic video:", e2);
                    // Strategy 3: Generic video (any camera available) with audio if needed
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            video: true,
                            audio: wantAudio
                        });
                    } catch (e3) {
                        console.warn("Generic video with audio failed, trying video only:", e3);
                        // Strategy 4: Video only, no audio
                        stream = await navigator.mediaDevices.getUserMedia({
                            video: true,
                            audio: false
                        });
                    }
                }
            }

            if (!stream) {
                throw new Error("Failed to initialize video stream.");
            }

            streamRef.current = stream;
            if (videoRef.current) {
                const video = videoRef.current;
                video.setAttribute("playsinline", "true");
                video.setAttribute("webkit-playsinline", "true");
                video.muted = true;
                video.srcObject = stream;
                try {
                    await video.play();
                } catch (playErr) {
                    console.warn("Autoplay promise warning:", playErr);
                }
            }
            setIsStartingCamera(false);
        } catch (err) {
            console.error("Camera access error:", err);
            let msg = "Could not access camera/microphone.";
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                msg = "Camera permission denied. Tap 'Use Phone Camera' below or allow access in browser settings.";
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                msg = "No camera hardware detected. Use 'Use Phone Camera' to capture with device app.";
            } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
                msg = "Camera is currently busy in another app. Close other camera apps and retry.";
            }
            setCameraError(msg);
            setIsStartingCamera(false);
        }
    }, [stopStream]);

    // Initial camera startup or on facingMode / mode toggle
    useEffect(() => {
        if (!capturedImage && !capturedVideoUrl) {
            startCamera(facingMode, activeMode, isMicMuted);
        }
        return () => {
            stopStream();
        };
    }, [facingMode, activeMode, isMicMuted, capturedImage, capturedVideoUrl, startCamera, stopStream]);

    // Switch between front and rear cameras
    const handleSwitchCamera = () => {
        setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    };

    // Toggle Microphone for Video Mode
    const handleToggleMic = () => {
        setIsMicMuted((prev) => !prev);
    };

    // Change Mode (Photo <-> Video)
    const handleModeSwitch = (mode) => {
        if (isRecording) {
            toast.error("Please stop recording first");
            return;
        }
        setActiveMode(mode);
        handleRetake();
    };

    // ─────────────────────────────────────────────────────────────
    // NATIVE DEVICE CAMERA FALLBACK (Instant Phone Camera App)
    // ─────────────────────────────────────────────────────────────
    const handleNativeCameraTrigger = () => {
        nativeCameraInputRef.current?.click();
    };

    const handleNativeFileSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const isVideo = file.type.startsWith("video");

        if (isVideo) {
            const url = URL.createObjectURL(file);
            setCapturedVideoUrl(url);
            setCapturedFile(file);
            setRecordedSizeBytes(file.size);
            setActiveMode("video");

            // Extract video duration using temporary HTMLVideoElement
            const tempVid = document.createElement("video");
            tempVid.preload = "metadata";
            tempVid.src = url;
            tempVid.onloadedmetadata = () => {
                const dur = Math.round(tempVid.duration) || 0;
                setCapturedVideoDuration(dur);
                setRecordingDuration(dur);
                recordingDurationRef.current = dur;
            };
            stopStream();
        } else {
            setIsProcessing(true);
            const reader = new FileReader();
            reader.onload = (uploadEvt) => {
                const img = new Image();
                img.onload = async () => {
                    try {
                        const tempCanvas = document.createElement("canvas");
                        tempCanvas.width = img.width;
                        tempCanvas.height = img.height;
                        const ctx = tempCanvas.getContext("2d");
                        ctx.drawImage(img, 0, 0);

                        // Compress to 25KB - 50KB default target
                        const compressed = await compressImageToTarget(tempCanvas, 25, 50);
                        const filename = `photo_${Date.now()}.jpg`;
                        const compressedFile = new File([compressed.blob], filename, { type: "image/jpeg" });
                        setCapturedImage(compressed.dataUrl);
                        setCapturedFile(compressedFile);
                        setRecordedSizeBytes(compressedFile.size);
                        setActiveMode("photo");
                        toast.success(`Photo compressed • ${formatFileSize(compressedFile.size)} (25–50 KB)`, { icon: "📸", duration: 2000 });
                    } catch (err) {
                        console.error("Native photo compress failed:", err);
                        setCapturedImage(uploadEvt.target.result);
                        setCapturedFile(file);
                        setRecordedSizeBytes(file.size);
                        setActiveMode("photo");
                    } finally {
                        setIsProcessing(false);
                    }
                };
                img.src = uploadEvt.target.result;
            };
            reader.readAsDataURL(file);
            stopStream();
        }
    };

    // ─────────────────────────────────────────────────────────────
    // PHOTO CAPTURE (Auto-compressed to default 25 KB - 50 KB)
    // ─────────────────────────────────────────────────────────────
    const handleCapturePhoto = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        ctx.save();
        // Front camera mirror
        if (facingMode === "user") {
            ctx.translate(width, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, width, height);
        ctx.restore();

        // Flash animation
        setIsFlashing(true);
        setTimeout(() => setIsFlashing(false), 200);

        try {
            setIsProcessing(true);
            // Compress to target default size of 25 KB - 50 KB
            const compressed = await compressImageToTarget(canvas, 25, 50);
            setCapturedImage(compressed.dataUrl);

            const filename = `photo_${Date.now()}.jpg`;
            const file = new File([compressed.blob], filename, { type: "image/jpeg" });
            setCapturedFile(file);
            setRecordedSizeBytes(file.size);
            toast.success(`Photo captured • ${formatFileSize(file.size)} (25–50 KB)`, { icon: "📸", duration: 2000 });
        } catch (err) {
            console.error("Adaptive compression error, using standard fallback:", err);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.65);
            setCapturedImage(dataUrl);
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
                    setCapturedFile(file);
                    setRecordedSizeBytes(file.size);
                }
            }, "image/jpeg", 0.65);
        } finally {
            setIsProcessing(false);
            stopStream();
        }
    };

    // ─────────────────────────────────────────────────────────────
    // VIDEO RECORDING (Live Duration & Realtime File Size Tracking)
    // ─────────────────────────────────────────────────────────────
    const handleStartRecording = () => {
        if (!streamRef.current) {
            toast.error("Camera stream is not active");
            return;
        }

        try {
            recordedChunksRef.current = [];
            setRecordedSizeBytes(0);
            setCapturedVideoDuration(0);
            recordingDurationRef.current = 0;

            // Detect best supported mime type (Prioritize iOS Safari mp4, then webm)
            const mimeTypes = [
                "video/mp4",
                "video/mp4;codecs=avc1",
                "video/webm;codecs=vp9,opus",
                "video/webm;codecs=vp8,opus",
                "video/webm"
            ];

            let supportedMime = "";
            for (const type of mimeTypes) {
                if (typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(type)) {
                    supportedMime = type;
                    break;
                }
            }

            const options = supportedMime ? { mimeType: supportedMime } : {};
            const recorder = new MediaRecorder(streamRef.current, options);

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                    setRecordedSizeBytes((prev) => {
                        const newTotal = prev + event.data.size;
                        // 35MB safeguard limit (backend max is 50MB)
                        if (newTotal >= 35 * 1024 * 1024) {
                            handleStopRecording();
                            toast("Max video size reached (35MB). Recording finalized.", { icon: "ℹ️" });
                        }
                        return newTotal;
                    });
                }
            };

            recorder.onstop = () => {
                const recordedBlob = new Blob(recordedChunksRef.current, {
                    type: supportedMime || "video/mp4"
                });

                const ext = (supportedMime && supportedMime.includes("webm")) ? "webm" : "mp4";
                const videoFile = new File([recordedBlob], `video_${Date.now()}.${ext}`, {
                    type: recordedBlob.type
                });

                const videoUrl = URL.createObjectURL(recordedBlob);
                setCapturedVideoUrl(videoUrl);
                setCapturedFile(videoFile);
                setRecordedSizeBytes(videoFile.size);
                const finalDur = recordingDurationRef.current || recordingDuration;
                setCapturedVideoDuration(finalDur);
                stopStream();
            };

            recorder.start(250); // collect 250ms chunks for live byte size updates
            mediaRecorderRef.current = recorder;
            setIsRecording(true);
            setRecordingDuration(0);

            // Timer Interval
            timerIntervalRef.current = setInterval(() => {
                setRecordingDuration((prev) => {
                    const next = prev + 1;
                    recordingDurationRef.current = next;
                    if (next >= MAX_RECORD_SECONDS) {
                        handleStopRecording();
                        toast("Max recording limit reached (2 minutes).", { icon: "ℹ️" });
                        return MAX_RECORD_SECONDS;
                    }
                    return next;
                });
            }, 1000);

            toast.success("Recording started...", { icon: "🔴", duration: 1500 });
        } catch (err) {
            console.error("Failed to start video recording:", err);
            toast.error("Video recording not supported on this browser");
        }
    };

    const handleStopRecording = () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            try {
                mediaRecorderRef.current.stop();
            } catch (_) { }
        }
        setIsRecording(false);
    };

    // Retake (Reset all captures)
    const handleRetake = () => {
        if (capturedVideoUrl) {
            URL.revokeObjectURL(capturedVideoUrl);
        }
        setCapturedImage(null);
        setCapturedVideoUrl(null);
        setCapturedFile(null);
        setCaption("");
        setIsRecording(false);
        setRecordingDuration(0);
        recordingDurationRef.current = 0;
        setCapturedVideoDuration(0);
        setRecordedSizeBytes(0);
        setIsProcessing(false);
    };

    // Format seconds to mm:ss
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    };

    // Confirm and send photo/video
    const handleSend = async () => {
        if (!capturedFile) {
            toast.error("Nothing captured to share");
            return;
        }

        try {
            setIsSending(true);
            const mediaType = activeMode === "video" || capturedVideoUrl ? "video" : "photo";

            if (typeof onSendMedia === "function") {
                await onSendMedia({
                    file: capturedFile,
                    caption: caption.trim(),
                    mediaType
                });
            } else if (typeof onSendPhoto === "function") {
                await onSendPhoto({
                    file: capturedFile,
                    caption: caption.trim(),
                    mediaType
                });
            }

            onClose();
        } catch (err) {
            console.error("Failed to share media:", err);
            toast.error(`Failed to share ${activeMode === "video" ? "video" : "photo"}`);
        } finally {
            setIsSending(false);
        }
    };

    const hasCaptured = Boolean(capturedImage || capturedVideoUrl);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-200">
            {/* Native device camera input (Hidden fallback) */}
            <input
                type="file"
                ref={nativeCameraInputRef}
                accept="image/*,video/*"
                capture="environment"
                onChange={handleNativeFileSelect}
                className="hidden"
            />

            <div className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] max-w-xl bg-slate-900 sm:rounded-3xl rounded-none overflow-hidden shadow-2xl border-0 sm:border border-slate-800 flex flex-col">

                {/* ── Top Header ────────────────────────────────────────────── */}
                <div className="px-4 py-3 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between shrink-0 z-10">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold border shrink-0 ${activeMode === "video"
                                ? "bg-red-500/20 text-red-400 border-red-500/30"
                                : "bg-indigo-600/20 text-indigo-400 border-indigo-500/30"
                            }`}>
                            <i className={activeMode === "video" ? "fa-solid fa-video" : "fa-solid fa-camera"}></i>
                        </div>
                        <div className="truncate">
                            <h3 className="font-bold text-white text-sm truncate">
                                {hasCaptured
                                    ? (capturedVideoUrl
                                        ? `Preview Video (${formatDuration(capturedVideoDuration || recordingDuration)} • ${formatFileSize(capturedFile?.size || recordedSizeBytes)})`
                                        : `Preview Photo (${formatFileSize(capturedFile?.size || recordedSizeBytes)})`)
                                    : (activeMode === "video" ? "Video Studio" : "Live Camera")}
                            </h3>
                            <p className="text-[11px] text-slate-400 truncate">
                                {hasCaptured
                                    ? (capturedVideoUrl
                                        ? `Duration: ${formatDuration(capturedVideoDuration || recordingDuration)} • Size: ${formatFileSize(capturedFile?.size || recordedSizeBytes)}`
                                        : `Optimized small size: ${formatFileSize(capturedFile?.size || recordedSizeBytes)} (Default 25–50 KB)`)
                                    : (activeMode === "video" ? "Record video with live timer and file size tracker" : "Capture photo with camera (auto-compressed 25–50 KB)")}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Native Phone Camera Option */}
                        {!hasCaptured && (
                            <button
                                type="button"
                                onClick={handleNativeCameraTrigger}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                                title="Open phone camera app"
                            >
                                <i className="fa-solid fa-mobile-screen"></i>
                                <span className="hidden xs:inline">Phone Cam</span>
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            disabled={isRecording || isSending}
                            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                            title="Close Studio"
                        >
                            <i className="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>
                </div>

                {/* ── Mode Switcher Tabs (Photo / Video) ────────────────────── */}
                {!hasCaptured && (
                    <div className="bg-slate-950/80 px-4 py-2 border-b border-slate-800/80 flex items-center justify-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => handleModeSwitch("photo")}
                            disabled={isRecording}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeMode === "photo"
                                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                                    : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                }`}
                        >
                            <i className="fa-solid fa-camera"></i>
                            <span>Photo (25–50 KB)</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => handleModeSwitch("video")}
                            disabled={isRecording}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${activeMode === "video"
                                    ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                                    : "bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                                }`}
                        >
                            <i className="fa-solid fa-video"></i>
                            <span>Video (Time & Size)</span>
                        </button>
                    </div>
                )}

                {/* ── Viewfinder / Viewport ─────────────────────────────────── */}
                <div className="relative flex-1 min-h-0 bg-black flex items-center justify-center overflow-hidden">
                    {/* Flash effect */}
                    {isFlashing && (
                        <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-150 pointer-events-none"></div>
                    )}

                    {/* Processing / Compression Loader */}
                    {isProcessing && (
                        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm text-slate-200 p-4">
                            <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                            <h5 className="font-semibold text-sm text-white">Compressing Photo...</h5>
                            <p className="text-xs text-slate-400 mt-1">Optimizing image size to small 25 KB – 50 KB</p>
                        </div>
                    )}

                    {/* Hidden Canvas for photo rendering */}
                    <canvas ref={canvasRef} className="hidden" />

                    {cameraError ? (
                        <div className="text-center p-6 max-w-sm space-y-3">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto text-2xl border border-amber-500/20">
                                <i className="fa-solid fa-camera"></i>
                            </div>
                            <h4 className="font-bold text-white text-base">Camera Not Ready</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">{cameraError}</p>

                            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={handleNativeCameraTrigger}
                                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25"
                                >
                                    <i className="fa-solid fa-mobile-screen"></i>
                                    <span>Use Phone Camera App</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => startCamera(facingMode, activeMode, isMicMuted)}
                                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center justify-center gap-2 border border-slate-700"
                                >
                                    <i className="fa-solid fa-rotate-right"></i>
                                    <span>Retry Stream</span>
                                </button>
                            </div>
                        </div>
                    ) : capturedImage ? (
                        /* Captured Photo Preview */
                        <div className="relative w-full h-full flex items-center justify-center bg-black">
                            <img
                                src={capturedImage}
                                alt="Captured Preview"
                                className="w-full h-full object-contain select-none pointer-events-none"
                            />
                            {/* Photo Size & Status Badge */}
                            <div className="absolute top-3 left-3 px-3 py-1.5 rounded-full bg-black/75 backdrop-blur-md text-[11px] font-semibold text-emerald-400 border border-emerald-500/30 flex items-center gap-2 shadow-lg pointer-events-none">
                                <i className="fa-solid fa-check"></i>
                                <span>Photo Ready</span>
                                <span className="w-1 h-1 rounded-full bg-emerald-400/60"></span>
                                <span className="text-white font-mono">{formatFileSize(capturedFile?.size || recordedSizeBytes)}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-medium">Default 25–50 KB</span>
                            </div>
                        </div>
                    ) : capturedVideoUrl ? (
                        /* Recorded Video Preview Player */
                        <div className="relative w-full h-full flex items-center justify-center bg-black">
                            <video
                                src={capturedVideoUrl}
                                controls
                                autoPlay
                                playsInline
                                className="w-full h-full object-contain"
                            />
                            {/* Video Duration & File Size Badge */}
                            <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2 pointer-events-none">
                                <div className="px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md text-[11px] font-semibold text-red-400 border border-red-500/30 flex items-center gap-2 shadow-lg">
                                    <i className="fa-solid fa-film"></i>
                                    <span>Video Ready</span>
                                    <span className="w-1 h-1 rounded-full bg-red-400/60"></span>
                                    <span className="text-white font-mono flex items-center gap-1">
                                        <i className="fa-regular fa-clock text-[10px]"></i>
                                        {formatDuration(capturedVideoDuration || recordingDuration)}
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-red-400/60"></span>
                                    <span className="text-white font-mono flex items-center gap-1">
                                        <i className="fa-solid fa-hard-drive text-[10px]"></i>
                                        {formatFileSize(capturedFile?.size || recordedSizeBytes)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Live Camera Stream */
                        <div className="relative w-full h-full flex items-center justify-center bg-black">
                            {isStartingCamera && (
                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-xs text-slate-300">
                                    <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                    <span className="text-xs font-medium">Starting camera...</span>
                                </div>
                            )}

                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className={`w-full h-full object-cover sm:object-contain ${facingMode === "user" && activeMode === "photo" ? "scale-x-[-1]" : ""
                                    }`}
                            />

                            {/* Live Recording HUD Badge (Realtime Duration & Cumulative Size) */}
                            {isRecording && (
                                <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-red-600/90 text-white backdrop-blur-md text-xs font-bold shadow-lg border border-red-400/30 animate-pulse">
                                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                                    <span>REC {formatDuration(recordingDuration)}</span>
                                    <span className="text-[10px] text-red-200 font-mono">/ {formatDuration(MAX_RECORD_SECONDS)}</span>
                                    <span className="w-1 h-1 rounded-full bg-red-300"></span>
                                    <span className="text-[11px] font-mono text-white flex items-center gap-1">
                                        <i className="fa-solid fa-hard-drive text-[10px]"></i>
                                        {formatFileSize(recordedSizeBytes)}
                                    </span>
                                </div>
                            )}

                            {/* Viewfinder Target Markers */}
                            <div className="absolute inset-6 sm:inset-12 pointer-events-none border border-white/15 rounded-2xl flex flex-col justify-between p-3">
                                <div className="flex justify-between">
                                    <div className="w-4 h-4 border-t-2 border-l-2 border-indigo-400"></div>
                                    <div className="w-4 h-4 border-t-2 border-r-2 border-indigo-400"></div>
                                </div>
                                <div className="flex justify-between">
                                    <div className="w-4 h-4 border-b-2 border-l-2 border-indigo-400"></div>
                                    <div className="w-4 h-4 border-b-2 border-r-2 border-indigo-400"></div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Bottom Controls ───────────────────────────────────────── */}
                <div className="p-3 sm:p-5 bg-slate-900/95 border-t border-slate-800 flex flex-col gap-3 shrink-0 pb-safe">
                    {hasCaptured ? (
                        /* Preview Controls */
                        <div className="space-y-3">
                            {/* Media Stats Banner (Exact Duration & File Size) */}
                            <div className="flex items-center justify-between px-3.5 py-2 bg-slate-800/80 rounded-xl border border-slate-700/60 text-[11px]">
                                <div className="flex items-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${capturedVideoUrl ? "bg-red-400 animate-pulse" : "bg-emerald-400"}`}></span>
                                    <span className="text-slate-400 font-medium">Captured:</span>
                                    <span className="text-white font-semibold">
                                        {capturedVideoUrl ? "Video Recording" : "Camera Photo"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 font-mono text-xs">
                                    {capturedVideoUrl ? (
                                        <>
                                            <span className="flex items-center gap-1.5 text-red-300 font-medium">
                                                <i className="fa-regular fa-clock text-[11px]"></i>
                                                Time: {formatDuration(capturedVideoDuration || recordingDuration)}
                                            </span>
                                            <span className="text-slate-600">•</span>
                                            <span className="flex items-center gap-1.5 text-slate-200 font-medium">
                                                <i className="fa-solid fa-hard-drive text-[11px]"></i>
                                                Size: {formatFileSize(capturedFile?.size || recordedSizeBytes)}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-emerald-300 font-medium">
                                            <i className="fa-solid fa-hard-drive text-[11px]"></i>
                                            Size: {formatFileSize(capturedFile?.size || recordedSizeBytes)}
                                            <span className="text-[10px] text-emerald-400/80 font-sans font-normal ml-0.5">(Default 25–50 KB)</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Caption Input */}
                            <div className="relative">
                                <i className="fa-solid fa-pen absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                                <input
                                    type="text"
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    placeholder={capturedVideoUrl ? "Add a video caption..." : "Add a photo caption..."}
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2.5">
                                <button
                                    type="button"
                                    onClick={handleRetake}
                                    disabled={isSending || isProcessing}
                                    className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                                >
                                    <i className="fa-solid fa-rotate-left"></i>
                                    <span>Retake</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSend}
                                    disabled={isSending || !capturedFile || isProcessing}
                                    className="flex-1 py-2.5 px-4 rounded-xl text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 bg-[#ED1C28] hover:bg-[#C5131E] shadow-red-600/20"
                                >
                                    {isSending ? (
                                        <>
                                            <i className="fa-solid fa-circle-notch fa-spin"></i>
                                            <span>Sharing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-paper-plane"></i>
                                            <span>
                                                Send {capturedVideoUrl
                                                    ? `Video (${formatDuration(capturedVideoDuration || recordingDuration)} • ${formatFileSize(capturedFile?.size || recordedSizeBytes)})`
                                                    : `Photo (${formatFileSize(capturedFile?.size || recordedSizeBytes)})`}
                                            </span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Live Shutter / Record Controls */
                        <div className="flex items-center justify-around px-2 sm:px-8 py-1">
                            {/* Mic Toggle or Facing indicator */}
                            {activeMode === "video" ? (
                                <button
                                    type="button"
                                    onClick={handleToggleMic}
                                    disabled={isRecording || isStartingCamera}
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm transition-all cursor-pointer border ${isMicMuted
                                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                                            : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                                        }`}
                                    title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                                >
                                    <i className={isMicMuted ? "fa-solid fa-microphone-slash" : "fa-solid fa-microphone"}></i>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleNativeCameraTrigger}
                                    disabled={isStartingCamera}
                                    className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center text-sm transition-all cursor-pointer border border-slate-700"
                                    title="Open Phone Camera App"
                                >
                                    <i className="fa-solid fa-mobile-screen"></i>
                                </button>
                            )}

                            {/* Main Action Button (Photo Shutter vs Video Record) */}
                            {activeMode === "photo" ? (
                                <button
                                    type="button"
                                    onClick={handleCapturePhoto}
                                    disabled={isStartingCamera || Boolean(cameraError) || isProcessing}
                                    className="w-16 h-16 rounded-full border-4 border-white p-1 bg-transparent hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:hover:scale-100"
                                    title="Take Photo (Compressed to 25–50 KB)"
                                >
                                    <div className="w-full h-full rounded-full bg-white shadow-md"></div>
                                </button>
                            ) : (
                                /* Video Record / Stop Button */
                                <button
                                    type="button"
                                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                                    disabled={isStartingCamera || Boolean(cameraError)}
                                    className={`w-16 h-16 rounded-full border-4 p-1 bg-transparent hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center disabled:opacity-40 ${isRecording ? "border-red-500" : "border-red-500/60"
                                        }`}
                                    title={isRecording ? "Stop Recording" : "Start Recording"}
                                >
                                    {isRecording ? (
                                        <div className="w-6 h-6 rounded-md bg-red-500 shadow-md"></div>
                                    ) : (
                                        <div className="w-full h-full rounded-full bg-red-600 shadow-md flex items-center justify-center text-white text-xs">
                                            <i className="fa-solid fa-video"></i>
                                        </div>
                                    )}
                                </button>
                            )}

                            {/* Switch Camera Toggle */}
                            <button
                                type="button"
                                onClick={handleSwitchCamera}
                                disabled={isStartingCamera || isRecording || Boolean(cameraError)}
                                className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white flex items-center justify-center text-base transition-all cursor-pointer border border-slate-700 disabled:opacity-50"
                                title="Switch Front/Rear Camera"
                            >
                                <i className="fa-solid fa-camera-rotate"></i>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
