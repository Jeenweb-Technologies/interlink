import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getMeetingDetails, getMeetingToken, joinMeetingLobby } from "../../api/meetingApi";
import { getMeetingSocket } from "../../utils/meetingSocket";

export default function PreJoinRoom() {
    const { roomCode } = useParams();
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const isAuthenticated = Boolean(user && user.id);

    // Meeting Info State
    const [meeting, setMeeting] = useState(null);
    const [loadingMeeting, setLoadingMeeting] = useState(true);

    // Guest / Passcode State
    const [guestName, setGuestName] = useState(user.name || "");
    const [guestEmail, setGuestEmail] = useState(user.email || "");
    const [passcode, setPasscode] = useState("");
    const [requiresPasscode, setRequiresPasscode] = useState(false);

    // Media Hardware State
    const [videoDevices, setVideoDevices] = useState([]);
    const [audioInputDevices, setAudioInputDevices] = useState([]);
    const [audioOutputDevices, setAudioOutputDevices] = useState([]);
    const [selectedVideoId, setSelectedVideoId] = useState("");
    const [selectedAudioInputId, setSelectedAudioInputId] = useState("");
    const [selectedAudioOutputId, setSelectedAudioOutputId] = useState("");

    const [isMicMuted, setIsMicMuted] = useState(false);
    const [isCamOff, setIsCamOff] = useState(false);
    const [micVolume, setMicVolume] = useState(0);

    // Lobby / Waiting Room State
    const [isWaitingInLobby, setIsWaitingInLobby] = useState(false);
    const [lobbyStatusMessage, setLobbyStatusMessage] = useState("Waiting for the host to admit you...");
    const [joining, setJoining] = useState(false);

    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const animationFrameRef = useRef(null);
    const socketRef = useRef(null);

    // 1. Fetch meeting info
    useEffect(() => {
        let mounted = true;
        setLoadingMeeting(true);

        getMeetingDetails(roomCode)
            .then((res) => {
                if (!mounted) return;
                if (res.data?.success && res.data.meeting) {
                    setMeeting(res.data.meeting);
                    if (res.data.meeting.passcode && (!user.id || user.id !== res.data.meeting.host_id)) {
                        setRequiresPasscode(true);
                    }
                } else {
                    toast.error("Meeting not found");
                }
            })
            .catch((err) => {
                toast.error(err.response?.data?.message || "Failed to load meeting details");
            })
            .finally(() => {
                if (mounted) setLoadingMeeting(false);
            });

        return () => {
            mounted = false;
        };
    }, [roomCode, user.id]);

    // 2. Hardware Enumerate & Stream Initialization
    const initMediaDevices = useCallback(async () => {
        try {
            // Stop any previous stream
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }

            const constraints = {
                video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true,
                audio: selectedAudioInputId ? { deviceId: { exact: selectedAudioInputId } } : true
            };

            let stream = null;
            let cameraUnavailable = false;

            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (mediaErr) {
                console.warn("Full media access failed, trying audio-only fallback:", mediaErr);
                // Windows hardware lock / device busy: fall back to audio only
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: false,
                        audio: selectedAudioInputId ? { deviceId: { exact: selectedAudioInputId } } : true
                    });
                    cameraUnavailable = true;
                    setIsCamOff(true);
                    toast("Camera is in use by another tab or app. Joined with audio only.", { icon: "ℹ️", id: "cam-busy" });
                } catch (audioErr) {
                    console.warn("Audio access also failed:", audioErr);
                }
            }

            if (!stream) {
                // If neither worked, try enumerating devices anyway so dropdowns work
                try {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
                    setAudioInputDevices(devices.filter((d) => d.kind === "audioinput"));
                    setAudioOutputDevices(devices.filter((d) => d.kind === "audiooutput"));
                } catch (e) {}
                return;
            }

            streamRef.current = stream;

            if (videoRef.current && !cameraUnavailable) {
                videoRef.current.srcObject = stream;
            }

            // Enumerate devices for dropdowns
            const devices = await navigator.mediaDevices.enumerateDevices();
            setVideoDevices(devices.filter((d) => d.kind === "videoinput"));
            setAudioInputDevices(devices.filter((d) => d.kind === "audioinput"));
            setAudioOutputDevices(devices.filter((d) => d.kind === "audiooutput"));

            // Setup audio visualizer
            if (stream.getAudioTracks().length > 0) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                const audioCtx = new AudioCtx();
                audioContextRef.current = audioCtx;

                const analyser = audioCtx.createAnalyser();
                analyser.fftSize = 64;
                analyserRef.current = analyser;

                const source = audioCtx.createMediaStreamSource(stream);
                source.connect(analyser);

                const dataArray = new Uint8Array(analyser.frequencyBinCount);

                const updateMeter = () => {
                    analyser.getByteFrequencyData(dataArray);
                    let sum = 0;
                    for (let i = 0; i < dataArray.length; i++) {
                        sum += dataArray[i];
                    }
                    const avg = sum / dataArray.length;
                    setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
                    animationFrameRef.current = requestAnimationFrame(updateMeter);
                };
                updateMeter();
            }
        } catch (err) {
            console.warn("Could not access camera/mic:", err.message);
        }
    }, [selectedVideoId, selectedAudioInputId]);

    useEffect(() => {
        initMediaDevices();

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (audioContextRef.current && audioContextRef.current.state !== "closed") {
                audioContextRef.current.close().catch(() => {});
            }
        };
    }, [initMediaDevices]);

    // Handle Mic Toggle
    const handleToggleMic = () => {
        if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach((track) => {
                track.enabled = isMicMuted;
            });
        }
        setIsMicMuted(!isMicMuted);
    };

    // Handle Cam Toggle
    const handleToggleCam = async () => {
        if (!streamRef.current) return;
        const videoTracks = streamRef.current.getVideoTracks();

        if (videoTracks.length === 0) {
            // Attempt to dynamically acquire video track if it wasn't available at first
            try {
                const vStream = await navigator.mediaDevices.getUserMedia({
                    video: selectedVideoId ? { deviceId: { exact: selectedVideoId } } : true
                });
                const vTrack = vStream.getVideoTracks()[0];
                if (vTrack) {
                    streamRef.current.addTrack(vTrack);
                    if (videoRef.current) {
                        videoRef.current.srcObject = streamRef.current;
                    }
                    setIsCamOff(false);
                    toast.success("Camera connected");
                }
            } catch (err) {
                toast.error("Camera is in use by another tab or application.");
            }
            return;
        }

        videoTracks.forEach((track) => {
            track.enabled = isCamOff;
        });
        setIsCamOff(!isCamOff);
    };

    // Test Speaker Chime
    const handleTestSpeaker = () => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.45);
            toast.success("Playing speaker test chime 🔔");
        } catch (e) {
            console.error("Audio test error:", e);
        }
    };

    const [waitingParticipantId, setWaitingParticipantId] = useState(null);

    // Polling fallback while in lobby
    useEffect(() => {
        if (!isWaitingInLobby) return;

        const interval = setInterval(async () => {
            try {
                const payload = {
                    guest_name: guestName.trim() || user.name || "Guest",
                    guest_email: guestEmail.trim() || user.email || null,
                    passcode: passcode.trim() || null
                };
                const res = await getMeetingToken(roomCode, payload);
                if (res.data?.status === "admitted") {
                    setIsWaitingInLobby(false);
                    toast.success("Admitted by host! Entering room...");
                    if (res.data.token) {
                        sessionStorage.setItem(`meeting_token_${roomCode}`, res.data.token);
                        sessionStorage.setItem(`meeting_server_${roomCode}`, res.data.serverUrl);
                    }
                    navigate(`/meetings/room/${roomCode}`, {
                        state: {
                            initialMicMuted: isMicMuted,
                            initialCamOff: isCamOff,
                            selectedVideoId,
                            selectedAudioInputId,
                            displayName: payload.guest_name
                        }
                    });
                } else if (res.data?.status === "rejected") {
                    setIsWaitingInLobby(false);
                    toast.error("The host has declined your request to join.");
                }
            } catch (e) {
                // ignore transient polling errors
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [isWaitingInLobby, roomCode, guestName, guestEmail, passcode, isMicMuted, isCamOff, selectedVideoId, selectedAudioInputId, user.name, user.email, navigate]);

    // Join Meeting Execution
    const handleJoinMeeting = async () => {
        if (!isAuthenticated && !guestName.trim()) {
            toast.error("Please enter your name to enter the meeting");
            return;
        }

        if (requiresPasscode && !passcode.trim()) {
            toast.error("Please enter the meeting passcode");
            return;
        }

        setJoining(true);
        try {
            const payload = {
                guest_name: guestName.trim() || user.name || "Guest",
                guest_email: guestEmail.trim() || user.email || null,
                passcode: passcode.trim() || null
            };

            const res = await getMeetingToken(roomCode, payload);

            if (res.data?.status === "waiting_room") {
                const myPartId = res.data.participantId;
                setWaitingParticipantId(myPartId);
                setIsWaitingInLobby(true);
                setLobbyStatusMessage("You are in the waiting room. The meeting host will admit you shortly.");

                // Connect to Socket.IO and wait for admission
                if (!socketRef.current) {
                    socketRef.current = getMeetingSocket();
                }
                const socket = socketRef.current;

                // Join the lobby waiting room (NOT the live meeting video room)
                socket.emit("join_lobby", {
                    roomCode,
                    participant: {
                        id: myPartId,
                        name: payload.guest_name,
                        email: payload.guest_email
                    }
                });

                socket.off("participant_admitted");
                socket.on("participant_admitted", async (data) => {
                    if (!data.participantId || data.participantId === myPartId) {
                        toast.success("Admitted by host! Joining meeting...");
                        setIsWaitingInLobby(false);

                        // Fetch admitted token
                        try {
                            const tokenRes = await getMeetingToken(roomCode, payload);
                            if (tokenRes.data?.token) {
                                sessionStorage.setItem(`meeting_token_${roomCode}`, tokenRes.data.token);
                                sessionStorage.setItem(`meeting_server_${roomCode}`, tokenRes.data.serverUrl);
                            }
                        } catch (e) {
                            // proceed with navigation
                        }

                        navigate(`/meetings/room/${roomCode}`, {
                            state: {
                                initialMicMuted: isMicMuted,
                                initialCamOff: isCamOff,
                                selectedVideoId,
                                selectedAudioInputId,
                                displayName: payload.guest_name
                            }
                        });
                    }
                });

                socket.off("participant_rejected");
                socket.on("participant_rejected", (data) => {
                    if (!data.participantId || data.participantId === myPartId) {
                        setIsWaitingInLobby(false);
                        toast.error("The host has declined your admission request.");
                    }
                });
            } else if (res.data?.status === "admitted") {
                // Save token & session data
                sessionStorage.setItem(`meeting_token_${roomCode}`, res.data.token);
                sessionStorage.setItem(`meeting_server_${roomCode}`, res.data.serverUrl);

                navigate(`/meetings/room/${roomCode}`, {
                    state: {
                        initialMicMuted: isMicMuted,
                        initialCamOff: isCamOff,
                        selectedVideoId,
                        selectedAudioInputId,
                        displayName: payload.guest_name
                    }
                });
            } else {
                toast.error(res.data?.message || "Failed to join meeting");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || "Failed to join meeting");
        } finally {
            setJoining(false);
        }
    };

    if (loadingMeeting) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-3">
                <i className="fa-solid fa-circle-notch fa-spin text-4xl text-blue-500"></i>
                <p className="text-sm font-medium text-slate-300">Checking room status...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white flex flex-col justify-between p-4 sm:p-8">
            {/* Header */}
            <div className="max-w-5xl mx-auto w-full flex items-center justify-between py-2 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/30">
                        <i className="fa-solid fa-video text-white text-base"></i>
                    </div>
                    <div>
                        <h1 className="font-bold text-base tracking-tight text-white">Interlink Green Room</h1>
                        <p className="text-xs text-slate-400">Audio/Video Pre-Flight Hardware Calibration</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-white/10 text-blue-300 border border-white/10">
                        Room: {roomCode}
                    </span>
                    <button
                        onClick={() => navigate("/meetings")}
                        className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        Exit
                    </button>
                </div>
            </div>

            {/* Waiting Room Modal View */}
            {isWaitingInLobby ? (
                <div className="max-w-md mx-auto w-full bg-slate-900/90 border border-white/15 p-8 rounded-3xl shadow-2xl text-center space-y-6 my-auto backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-20 h-20 rounded-full bg-blue-600/20 border-2 border-blue-500/40 text-blue-400 flex items-center justify-center mx-auto text-3xl">
                        <i className="fa-solid fa-door-open fa-bounce"></i>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-white">In the Waiting Room</h2>
                        <p className="text-sm text-slate-300 mt-2">{lobbyStatusMessage}</p>
                    </div>

                    <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-xs text-slate-400 space-y-1">
                        <div><strong className="text-slate-200">Meeting:</strong> {meeting?.title}</div>
                        <div><strong className="text-slate-200">Host:</strong> {meeting?.host_name}</div>
                    </div>

                    <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                        <i className="fa-solid fa-circle-notch fa-spin text-blue-400"></i>
                        <span>Waiting for admission...</span>
                    </div>

                    <button
                        onClick={() => setIsWaitingInLobby(false)}
                        className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold transition-colors"
                    >
                        Cancel &amp; Leave
                    </button>
                </div>
            ) : (
                /* Pre-Flight Calibration Grid */
                <div className="max-w-5xl mx-auto w-full my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    {/* Left: Camera Preview & Test Controls (7 cols) */}
                    <div className="lg:col-span-7 space-y-4">
                        <div className="relative aspect-video rounded-3xl overflow-hidden bg-slate-900 border border-white/15 shadow-2xl flex items-center justify-center group">
                            {isCamOff ? (
                                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                    <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-3xl text-slate-500">
                                        <i className="fa-solid fa-video-slash"></i>
                                    </div>
                                    <span className="text-sm font-semibold">Camera is turned off</span>
                                </div>
                            ) : (
                                <video
                                    ref={(el) => {
                                        videoRef.current = el;
                                        if (el && streamRef.current) {
                                            el.srcObject = streamRef.current;
                                        }
                                    }}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="w-full h-full object-cover -scale-x-100"
                                />
                            )}

                            {/* Mic Volume Level Bar (Bottom Left Overlay) */}
                            {!isMicMuted && (
                                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15">
                                    <i className="fa-solid fa-microphone text-xs text-emerald-400"></i>
                                    <div className="w-16 h-2 bg-white/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-400 transition-all duration-75 rounded-full"
                                            style={{ width: `${micVolume}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {/* Floating Hardware Quick Toggles */}
                            <div className="absolute bottom-4 right-4 flex items-center gap-2">
                                <button
                                    onClick={handleToggleMic}
                                    className={`w-11 h-11 rounded-full flex items-center justify-center text-base shadow-lg transition-transform active:scale-95 cursor-pointer ${
                                        isMicMuted
                                            ? "bg-rose-600 text-white"
                                            : "bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/20"
                                    }`}
                                    title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
                                >
                                    <i className={`fa-solid ${isMicMuted ? "fa-microphone-slash" : "fa-microphone"}`}></i>
                                </button>

                                <button
                                    onClick={handleToggleCam}
                                    className={`w-11 h-11 rounded-full flex items-center justify-center text-base shadow-lg transition-transform active:scale-95 cursor-pointer ${
                                        isCamOff
                                            ? "bg-rose-600 text-white"
                                            : "bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/20"
                                    }`}
                                    title={isCamOff ? "Turn On Camera" : "Turn Off Camera"}
                                >
                                    <i className={`fa-solid ${isCamOff ? "fa-video-slash" : "fa-video"}`}></i>
                                </button>
                            </div>
                        </div>

                        {/* Speaker Test & Hardware Selector Accordion */}
                        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Audio &amp; Video Hardware
                                </span>
                                <button
                                    type="button"
                                    onClick={handleTestSpeaker}
                                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <i className="fa-solid fa-volume-high"></i>
                                    <span>Test Speaker</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                    <label className="text-slate-400 block mb-1">Camera</label>
                                    <select
                                        value={selectedVideoId}
                                        onChange={(e) => setSelectedVideoId(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-white focus:outline-hidden focus:border-blue-500"
                                    >
                                        {videoDevices.map((d) => (
                                            <option key={d.deviceId} value={d.deviceId}>
                                                {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-slate-400 block mb-1">Microphone</label>
                                    <select
                                        value={selectedAudioInputId}
                                        onChange={(e) => setSelectedAudioInputId(e.target.value)}
                                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-white focus:outline-hidden focus:border-blue-500"
                                    >
                                        {audioInputDevices.map((d) => (
                                            <option key={d.deviceId} value={d.deviceId}>
                                                {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Meeting Card & Intake Form (5 cols) */}
                    <div className="lg:col-span-5 bg-slate-900/80 border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl backdrop-blur-md space-y-5">
                        {/* Meeting Metadata */}
                        <div className="border-b border-white/10 pb-4 space-y-1">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                                Ready to join
                            </span>
                            <h2 className="text-xl font-black text-white tracking-tight">
                                {meeting?.title || "Enterprise Meeting"}
                            </h2>
                            <p className="text-xs text-slate-400">
                                Hosted by <span className="text-slate-200 font-semibold">{meeting?.host_name || "Host"}</span>
                            </p>
                        </div>

                        {/* Intake fields for unauthenticated guests */}
                        {!isAuthenticated && (
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Your Full Name <span className="text-rose-400">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Alex Morgan"
                                        value={guestName}
                                        onChange={(e) => setGuestName(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:outline-hidden focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Email Address <span className="text-slate-500">(Optional)</span>
                                    </label>
                                    <input
                                        type="email"
                                        placeholder="alex@example.com"
                                        value={guestEmail}
                                        onChange={(e) => setGuestEmail(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-white/10 text-white text-sm focus:outline-hidden focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Passcode input if required */}
                        {requiresPasscode && (
                            <div>
                                <label className="block text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
                                    <i className="fa-solid fa-lock text-[10px]"></i>
                                    Meeting Passcode Required
                                </label>
                                <input
                                    type="password"
                                    placeholder="Enter room passcode..."
                                    value={passcode}
                                    onChange={(e) => setPasscode(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-amber-400/30 text-white font-mono text-sm tracking-widest focus:outline-hidden focus:border-amber-400"
                                />
                            </div>
                        )}

                        {/* Join Button */}
                        <button
                            onClick={handleJoinMeeting}
                            disabled={joining}
                            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm tracking-wide shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                        >
                            {joining ? (
                                <>
                                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                                    <span>Entering Meeting...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-arrow-right-to-bracket"></i>
                                    <span>Join Meeting Now</span>
                                </>
                            )}
                        </button>

                        {/* Legal Governance Disclosure Notice (Section 5.4) */}
                        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-400 leading-relaxed flex items-start gap-2.5">
                            <i className="fa-solid fa-shield-halved text-blue-400 shrink-0 mt-0.5"></i>
                            <div>
                                <span className="font-semibold text-slate-300">Enterprise Privacy Notice: </span>
                                In-room recordings are consent-audited. Web browsers cannot prevent external operating system captures (e.g. OBS Studio, Windows Snipping Tool).
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="max-w-5xl mx-auto w-full text-center text-xs text-slate-500 py-2">
                Interlink Enterprise SFU WebRTC Engine • Multi-Tenant Isolated Workspace
            </div>
        </div>
    );
}
