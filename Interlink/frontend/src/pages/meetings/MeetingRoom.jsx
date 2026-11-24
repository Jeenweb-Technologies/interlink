import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import {
    getMeetingDetails,
    getMeetingToken,
    endMeeting,
    saveMeetingRecording
} from "../../api/meetingApi";
import { getMeetingSocket } from "../../utils/meetingSocket";
import MeetingWhiteboard from "../../components/meetings/MeetingWhiteboard";
import HostControlsDrawer from "../../components/meetings/HostControlsDrawer";
import MeetingChatDrawer from "../../components/meetings/MeetingChatDrawer";
import MeetingNotesDrawer from "../../components/meetings/MeetingNotesDrawer";
import RecordingConsentModal from "../../components/meetings/RecordingConsentModal";

export default function MeetingRoom() {
    const { roomCode } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const preJoinState = location.state || {};

    // Meeting & Token State
    const [meeting, setMeeting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isHost, setIsHost] = useState(false);

    // Media Hardware & Streams
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [screenStream, setScreenStream] = useState(null);
    const [isMicMuted, setIsMicMuted] = useState(preJoinState.initialMicMuted ?? false);
    const [isCamOff, setIsCamOff] = useState(preJoinState.initialCamOff ?? false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [activeSpeakerId, setActiveSpeakerId] = useState(null);

    // Participants & Lobby
    const [participants, setParticipants] = useState([]);
    const [waitingParticipants, setWaitingParticipants] = useState([]);
    const [handRaised, setHandRaised] = useState(false);
    const [raisedHands, setRaisedHands] = useState(new Set());

    // In-Room Features & Drawers
    // Whiteboard mode: 'off' | 'split' | 'fullscreen'
    const [whiteboardMode, setWhiteboardMode] = useState("off");
    const [isHostDrawerOpen, setIsHostDrawerOpen] = useState(false);
    const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
    const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [chatMessages, setChatMessages] = useState([]);

    // Recording & Governance State
    const [isRecording, setIsRecording] = useState(false);
    const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
    const [recordingStartTime, setRecordingStartTime] = useState(null);

    // Host Governance Permissions
    const [permissions, setPermissions] = useState({
        canShareScreen: true,
        canEditWhiteboard: true,
        canChat: true
    });

    const localVideoRef = useRef(null);
    const screenVideoRef = useRef(null);
    const socketRef = useRef(null);
    const peersRef = useRef({});
    const localStreamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    // 1. Initialize Meeting & Socket
    useEffect(() => {
        let mounted = true;

        const createPeerConnection = (targetSocketId, isInitiator, targetParticipant) => {
            if (peersRef.current[targetSocketId]) {
                try { peersRef.current[targetSocketId].close(); } catch (e) {}
            }

            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" },
                    { urls: "stun:stun1.l.google.com:19302" }
                ]
            });

            peersRef.current[targetSocketId] = pc;
            pc._pendingCandidates = [];

            // Add local tracks if available
            const curStream = localStreamRef.current;
            if (curStream) {
                curStream.getTracks().forEach((track) => {
                    pc.addTrack(track, curStream);
                });
            }

            // Ensure transceivers exist for both audio and video so SDP always has m-lines
            const hasAudio = curStream?.getAudioTracks().length > 0;
            const hasVideo = curStream?.getVideoTracks().length > 0;
            if (!hasAudio) {
                try { pc.addTransceiver("audio", { direction: "sendrecv" }); } catch (e) {}
            }
            if (!hasVideo) {
                try { pc.addTransceiver("video", { direction: "sendrecv" }); } catch (e) {}
            }

            pc.onicecandidate = (event) => {
                if (event.candidate && socketRef.current) {
                    socketRef.current.emit("webrtc_signal", {
                        to: targetSocketId,
                        signal: {
                            type: "candidate",
                            candidate: event.candidate
                        }
                    });
                }
            };

            pc.ontrack = (event) => {
                const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);
                setRemoteStreams((prev) => {
                    const next = { ...prev, [targetSocketId]: stream };
                    if (targetParticipant?.id) next[targetParticipant.id] = stream;
                    return next;
                });
            };

            pc.onconnectionstatechange = () => {
                if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
                    setRemoteStreams((prev) => {
                        const next = { ...prev };
                        delete next[targetSocketId];
                        if (targetParticipant?.id) delete next[targetParticipant.id];
                        return next;
                    });
                }
            };

            if (isInitiator) {
                (async () => {
                    try {
                        const offer = await pc.createOffer({
                            offerToReceiveAudio: true,
                            offerToReceiveVideo: true
                        });
                        await pc.setLocalDescription(offer);
                        if (socketRef.current) {
                            socketRef.current.emit("webrtc_signal", {
                                to: targetSocketId,
                                signal: {
                                    type: "offer",
                                    sdp: offer
                                }
                            });
                        }
                    } catch (err) {
                        console.error("Error creating WebRTC offer:", err);
                    }
                })();
            }

            return pc;
        };

        const initRoom = async () => {
            try {
                const res = await getMeetingDetails(roomCode);
                if (!mounted) return;

                if (res.data?.success && res.data.meeting) {
                    const m = res.data.meeting;
                    setMeeting(m);
                    const userIsHost = Boolean(user.id && user.id === m.host_id);
                    setIsHost(userIsHost);

                    const myUserId = user.id;
                    const myDisplayName = preJoinState.displayName || user.name || "Guest";

                    // Separate admitted vs waiting participants, excluding self from remote tiles
                    const allParts = res.data.participants || [];
                    const remotes = allParts.filter((p) => {
                        if (p.status !== "admitted") return false;
                        if (myUserId && (p.user_id === myUserId || p.id === myUserId)) return false;
                        if (p.guest_name && p.guest_name === myDisplayName && !p.user_id && !myUserId) return false;
                        return true;
                    });
                    setParticipants(remotes);
                    setWaitingParticipants(allParts.filter((p) => p.status === "waiting_room"));
                } else {
                    toast.error("Meeting not found");
                    navigate("/meetings");
                    return;
                }

                // Connect to meeting socket room
                const socket = getMeetingSocket();
                socketRef.current = socket;

                const myIdentity = user.id ? `user_${user.id}` : `guest_${Date.now()}`;
                const myDisplayName = preJoinState.displayName || user.name || "Guest";
                const myUserId = user.id;

                socket.emit("join_meeting_room", {
                    roomCode,
                    participant: {
                        id: myIdentity,
                        name: myDisplayName,
                        role: user.id && user.id === res.data.meeting.host_id ? "host" : "participant"
                    }
                });

                // Socket Event Handlers
                socket.on("existing_meeting_peers", ({ peers }) => {
                    if (!peers || !Array.isArray(peers)) return;

                    setParticipants((prev) => {
                        const next = [...prev];
                        peers.forEach(({ socketId, participant }) => {
                            const partWithSocket = { ...(participant || {}), socketId };
                            const existingIdx = next.findIndex(
                                (p) => p.socketId === socketId || (p.id && p.id === participant?.id)
                            );
                            if (existingIdx >= 0) {
                                next[existingIdx] = { ...next[existingIdx], ...partWithSocket };
                            } else {
                                next.push(partWithSocket);
                            }
                        });
                        return next;
                    });

                    // Initiate WebRTC connection to each existing peer
                    peers.forEach(({ socketId, participant }) => {
                        createPeerConnection(socketId, true, participant);
                    });
                });

                socket.on("webrtc_signal", async ({ from, fromParticipant, signal }) => {
                    if (!from || !signal) return;

                    try {
                        if (signal.type === "offer") {
                            const pc = createPeerConnection(from, false, fromParticipant);
                            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

                            if (pc._pendingCandidates && pc._pendingCandidates.length > 0) {
                                for (const cand of pc._pendingCandidates) {
                                    await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                                }
                                pc._pendingCandidates = [];
                            }

                            const answer = await pc.createAnswer();
                            await pc.setLocalDescription(answer);

                            socket.emit("webrtc_signal", {
                                to: from,
                                signal: {
                                    type: "answer",
                                    sdp: answer
                                }
                            });
                        } else if (signal.type === "answer") {
                            const pc = peersRef.current[from];
                            if (pc) {
                                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
                                if (pc._pendingCandidates && pc._pendingCandidates.length > 0) {
                                    for (const cand of pc._pendingCandidates) {
                                        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                                    }
                                    pc._pendingCandidates = [];
                                }
                            }
                        } else if (signal.type === "candidate") {
                            const pc = peersRef.current[from];
                            if (pc) {
                                if (pc.remoteDescription && pc.remoteDescription.type) {
                                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(() => {});
                                } else {
                                    if (!pc._pendingCandidates) pc._pendingCandidates = [];
                                    pc._pendingCandidates.push(signal.candidate);
                                }
                            }
                        }
                    } catch (err) {
                        console.error("Error processing WebRTC signal:", err);
                    }
                });

                socket.on("peer_joined", ({ participant, socketId }) => {
                    // Ignore self
                    if (socketId === socket.id || participant?.id === myIdentity || (myUserId && participant?.id === `user_${myUserId}`)) {
                        return;
                    }
                    const displayName = participant?.name || participant?.display_name || "A participant";
                    toast.success(`${displayName} joined the room`);
                    setParticipants((prev) => {
                        const partWithSocket = { ...(participant || {}), socketId };
                        const existingIdx = prev.findIndex(
                            (p) => p.socketId === socketId || (p.id && p.id === participant?.id)
                        );
                        if (existingIdx >= 0) {
                            const next = [...prev];
                            next[existingIdx] = { ...next[existingIdx], ...partWithSocket };
                            return next;
                        }
                        return [...prev, partWithSocket];
                    });
                });

                socket.on("peer_left", ({ socketId, participantId }) => {
                    if (socketId && peersRef.current[socketId]) {
                        try { peersRef.current[socketId].close(); } catch (e) {}
                        delete peersRef.current[socketId];
                    }
                    setRemoteStreams((prev) => {
                        const next = { ...prev };
                        if (socketId) delete next[socketId];
                        if (participantId) delete next[participantId];
                        return next;
                    });
                    setParticipants((prev) =>
                        prev.filter((p) => p.socketId !== socketId && p.id !== participantId && p.identity !== participantId)
                    );
                });

                socket.on("lobby_updated", (data) => {
                    const partId = data.participantId || data.id;
                    setWaitingParticipants((prev) => {
                        if (prev.some((p) => (p.id || p.participantId) === partId)) return prev;
                        return [...prev, data];
                    });
                    const displayName = data.display_name || data.name || "A guest";
                    toast((t) => (
                        <div className="flex items-center gap-2 text-xs">
                            <i className="fa-solid fa-door-open text-amber-500"></i>
                            <span>{displayName} is waiting in the lobby.</span>
                        </div>
                    ));
                });

                socket.on("participant_admitted", ({ participantId }) => {
                    setWaitingParticipants((prev) => prev.filter((p) => (p.id || p.participantId) !== participantId));
                });

                socket.on("meeting_chat_message", (msg) => {
                    setChatMessages((prev) => [...prev, msg]);
                    if (!isChatDrawerOpen) {
                        setUnreadChatCount((c) => c + 1);
                    }
                });

                socket.on("meeting_raise_hand", ({ participantId, participantName, raised }) => {
                    setRaisedHands((prev) => {
                        const next = new Set(prev);
                        if (raised) next.add(participantId);
                        else next.delete(participantId);
                        return next;
                    });
                    if (raised) {
                        toast(`${participantName} raised their hand ✋`);
                    }
                });

                socket.on("meeting_ended", () => {
                    toast.error("The host has ended the meeting.");
                    navigate(`/meetings/history/${res.data.meeting.id}`);
                });

                socket.on("host_control_action", ({ action, targetParticipantId, payload }) => {
                    if (action === "mute_all") {
                        handleMuteLocal();
                        toast("All participants were muted by the host.");
                    } else if (action === "mute_participant" && targetParticipantId === (user.id || myIdentity)) {
                        handleMuteLocal();
                        toast("You have been muted by the host.");
                    } else if (action === "kick_participant" && targetParticipantId === (user.id || myIdentity)) {
                        toast.error("You have been removed from the meeting.");
                        navigate("/meetings");
                    }
                });
            } catch (err) {
                console.error("Room init error:", err);
                toast.error("Failed to load meeting room");
            } finally {
                if (mounted) setLoading(false);
            }
        };

        initRoom();

        return () => {
            mounted = false;
            if (socketRef.current) {
                socketRef.current.emit("leave_meeting_room", { roomCode });
                socketRef.current.disconnect();
            }
            Object.values(peersRef.current).forEach((pc) => {
                try { pc.close(); } catch (e) {}
            });
            peersRef.current = {};
        };
    }, [roomCode, user.id, navigate]);

    // 2. Initialize Camera & Mic Stream
    useEffect(() => {
        let active = true;

        const startLocalMedia = async () => {
            let stream = null;
            let cameraBusy = false;

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: !preJoinState.initialCamOff,
                    audio: true
                });
            } catch (err) {
                console.warn("Could not start local camera stream:", err.message);
                // Fallback to audio-only if camera is busy / locked by another window
                try {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: false,
                        audio: true
                    });
                    cameraBusy = true;
                    setIsCamOff(true);
                    toast("Camera is in use by another window. Audio connected.", { icon: "ℹ️", id: "cam-busy" });
                } catch (audioErr) {
                    console.warn("Could not start local audio stream:", audioErr.message);
                }
            }

            if (!active) {
                if (stream) stream.getTracks().forEach((t) => t.stop());
                return;
            }

            if (stream) {
                setLocalStream(stream);

                // Apply initial state from Green Room
                if (preJoinState.initialMicMuted) {
                    stream.getAudioTracks().forEach((t) => (t.enabled = false));
                }
                if (preJoinState.initialCamOff || cameraBusy) {
                    stream.getVideoTracks().forEach((t) => (t.enabled = false));
                    setIsCamOff(true);
                }

                if (localVideoRef.current && !cameraBusy) {
                    localVideoRef.current.srcObject = stream;
                }
            }
        };

        startLocalMedia();

        return () => {
            active = false;
            if (localStream) {
                localStream.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    // Sync localStream tracks to peer connections when stream changes
    useEffect(() => {
        localStreamRef.current = localStream;
        if (!localStream) return;

        Object.values(peersRef.current).forEach((pc) => {
            try {
                localStream.getTracks().forEach((track) => {
                    const senders = pc.getSenders();
                    const existingSender = senders.find(
                        (s) => (s.track && s.track.kind === track.kind) || s.kind === track.kind
                    );
                    if (existingSender) {
                        existingSender.replaceTrack(track).catch(() => {});
                    } else {
                        pc.addTrack(track, localStream);
                    }
                });
            } catch (err) {
                console.warn("Could not sync track to peer:", err);
            }
        });
    }, [localStream]);

    // Toggle Mic
    const handleToggleMic = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach((t) => {
                t.enabled = isMicMuted;
            });
        }
        setIsMicMuted(!isMicMuted);
    };

    const handleMuteLocal = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach((t) => {
                t.enabled = false;
            });
        }
        setIsMicMuted(true);
    };

    // Toggle Camera
    const handleToggleCam = async () => {
        if (!permissions.canTurnOnVideo && !isHost && isCamOff) {
            toast.error("Host has disabled participant cameras.");
            return;
        }

        if (localStream) {
            const videoTracks = localStream.getVideoTracks();
            if (videoTracks.length === 0) {
                // If stream was audio-only (e.g. camera was locked upon join), try to acquire video track now
                try {
                    const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
                    const vTrack = vStream.getVideoTracks()[0];
                    if (vTrack) {
                        localStream.addTrack(vTrack);
                        if (localVideoRef.current) {
                            localVideoRef.current.srcObject = localStream;
                        }
                        // Update peer connections with new video track
                        Object.values(peersRef.current).forEach((pc) => {
                            const senders = pc.getSenders();
                            const existingSender = senders.find(
                                (s) => (s.track && s.track.kind === "video") || s.kind === "video"
                            );
                            if (existingSender) {
                                existingSender.replaceTrack(vTrack).catch(() => {});
                            } else {
                                pc.addTrack(vTrack, localStream);
                            }
                        });
                        setIsCamOff(false);
                        toast.success("Camera connected");
                    }
                } catch (err) {
                    toast.error("Camera is in use by another window or application.");
                }
                return;
            }

            videoTracks.forEach((t) => {
                t.enabled = isCamOff;
            });
            setIsCamOff(!isCamOff);
        }
    };

    // Toggle Screen Share
    const handleToggleScreenShare = async () => {
        if (!permissions.canShareScreen && !isHost) {
            toast.error("Screen sharing has been disabled by the host.");
            return;
        }

        if (isScreenSharing) {
            if (screenStream) {
                screenStream.getTracks().forEach((t) => t.stop());
            }
            setScreenStream(null);
            setIsScreenSharing(false);
        } else {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });

                setScreenStream(stream);
                setIsScreenSharing(true);

                if (screenVideoRef.current) {
                    screenVideoRef.current.srcObject = stream;
                }

                stream.getVideoTracks()[0].onended = () => {
                    setIsScreenSharing(false);
                    setScreenStream(null);
                };
            } catch (err) {
                console.warn("Screen share cancelled:", err.message);
            }
        }
    };

    // Toggle Hand Raise
    const handleToggleHandRaise = () => {
        const nextState = !handRaised;
        setHandRaised(nextState);

        const myId = user.id ? `user_${user.id}` : `guest_${Date.now()}`;
        if (socketRef.current) {
            socketRef.current.emit("meeting_raise_hand", {
                roomCode,
                participantId: myId,
                participantName: user.name || "Participant",
                raised: nextState
            });
        }
    };

    // Send Chat Message
    const handleSendMessage = (text) => {
        if (!socketRef.current) return;
        socketRef.current.emit("meeting_chat_message", {
            roomCode,
            message: {
                text,
                senderId: user.id || socketRef.current.id,
                senderName: user.name || preJoinState.displayName || "Participant"
            }
        });
    };

    // Host Action Forwarder
    const handleHostAction = (action, targetParticipantId, payload) => {
        if (!socketRef.current) return;
        socketRef.current.emit("host_control_action", {
            roomCode,
            action,
            targetParticipantId,
            payload
        });
    };

    // Start / Stop Recording
    const handleStartRecording = () => {
        try {
            const streamToRecord = screenStream || localStream;
            if (!streamToRecord) {
                toast.error("No active video feed available to record");
                return;
            }

            recordedChunksRef.current = [];
            const recorder = new MediaRecorder(streamToRecord, { mimeType: "video/webm;codecs=vp9" });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    recordedChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
                const duration = Math.round((Date.now() - recordingStartTime) / 1000);

                // Save recording metadata
                try {
                    await saveMeetingRecording(meeting.id, {
                        file_url: URL.createObjectURL(blob),
                        file_size_bytes: blob.size,
                        duration_seconds: duration
                    });
                    toast.success("Recording archived to workspace project portfolio! 🎬");
                } catch (e) {
                    console.warn("Could not archive recording:", e);
                }
            };

            recorder.start(1000);
            setIsRecording(true);
            setRecordingStartTime(Date.now());
            toast.success("Recording started with workspace legal audit banner active.");
        } catch (e) {
            console.error("Recording start error:", e);
            toast.error("Could not start recording: " + e.message);
        }
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    // Leave or End Meeting
    const handleLeaveRoom = async (endForAll = false) => {
        if (isRecording) {
            handleStopRecording();
        }

        if (endForAll && isHost) {
            try {
                await endMeeting(roomCode);
            } catch (e) {
                // proceed
            }
        }

        if (localStream) {
            localStream.getTracks().forEach((t) => t.stop());
        }
        if (screenStream) {
            screenStream.getTracks().forEach((t) => t.stop());
        }

        if (meeting?.id) {
            navigate(`/meetings/history/${meeting.id}`);
        } else {
            navigate("/meetings");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-3">
                <i className="fa-solid fa-circle-notch fa-spin text-4xl text-blue-500"></i>
                <p className="text-sm font-medium text-slate-300">Entering meeting room...</p>
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-slate-950 text-white flex flex-col overflow-hidden select-none relative font-sans">
            {/* 1. Flashing Recording Legal Banner (Section 5.3) */}
            {isRecording && (
                <div className="bg-rose-600 text-white px-4 py-1.5 flex items-center justify-between text-xs font-bold shadow-lg shrink-0 z-40 animate-pulse">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
                        <i className="fa-solid fa-record-vinyl text-white"></i>
                        <span>RECORDING IN PROGRESS — This meeting is being recorded for workspace documentation and legal audit compliance.</span>
                    </div>
                    {isHost && (
                        <button
                            onClick={handleStopRecording}
                            className="px-2.5 py-0.5 rounded-md bg-white text-rose-600 hover:bg-slate-100 font-black text-[11px] transition-colors cursor-pointer"
                        >
                            Stop Recording
                        </button>
                    )}
                </div>
            )}

            {/* 2. Top Header Bar */}
            <div className="h-14 px-4 sm:px-6 bg-slate-900/90 border-b border-white/10 flex items-center justify-between shrink-0 z-30">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-500/20">
                        <i className="fa-solid fa-video"></i>
                    </div>
                    <div>
                        <h1 className="font-bold text-sm text-white truncate max-w-[200px] sm:max-w-md">
                            {meeting?.title || "Interlink Meeting"}
                        </h1>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span className="font-mono text-blue-300">{roomCode}</span>
                            <span>•</span>
                            <span>{participants.length + 1} connected</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Whiteboard Toggle (Split / Fullscreen / Off) */}
                    <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-white/10">
                        <button
                            onClick={() => setWhiteboardMode(whiteboardMode === "off" ? "split" : "off")}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                whiteboardMode !== "off"
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "text-slate-400 hover:text-white"
                            }`}
                        >
                            <i className="fa-solid fa-chalkboard-user"></i>
                            <span>Whiteboard</span>
                        </button>

                        {whiteboardMode !== "off" && (
                            <button
                                onClick={() =>
                                    setWhiteboardMode(whiteboardMode === "split" ? "fullscreen" : "split")
                                }
                                className="px-2 py-1 text-slate-400 hover:text-white text-xs cursor-pointer"
                                title={whiteboardMode === "split" ? "Expand Fullscreen" : "Split Screen"}
                            >
                                <i
                                    className={`fa-solid ${
                                        whiteboardMode === "split" ? "fa-expand" : "fa-compress"
                                    }`}
                                ></i>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. Main Stage & Video Layout Grid */}
            <div className="flex-1 relative flex overflow-hidden">
                {/* Stage Area */}
                <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
                    {/* Left/Main: Whiteboard or Screen Share */}
                    {whiteboardMode !== "off" ? (
                        <div
                            className={`h-full transition-all duration-300 ${
                                whiteboardMode === "fullscreen" ? "w-full" : "w-full md:w-3/5 lg:w-2/3"
                            } border-r border-white/10`}
                        >
                            <MeetingWhiteboard
                                roomCode={roomCode}
                                meetingId={meeting?.id}
                                projectId={meeting?.project_id}
                                socket={socketRef.current}
                                currentUser={user}
                                canEdit={permissions.canEditWhiteboard || isHost}
                            />
                        </div>
                    ) : isScreenSharing ? (
                        <div className="flex-1 bg-black flex items-center justify-center relative p-2">
                            <video
                                ref={screenVideoRef}
                                autoPlay
                                playsInline
                                className="w-full h-full object-contain rounded-2xl"
                            />
                            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-white flex items-center gap-2 border border-white/10">
                                <i className="fa-solid fa-desktop text-blue-400"></i>
                                <span>Presenting Screen</span>
                            </div>
                        </div>
                    ) : null}

                    {/* Right/Grid: Participant Video Bubbles / Grid */}
                    {(whiteboardMode !== "fullscreen" || (!isScreenSharing && whiteboardMode === "off")) && (
                        <div
                            className={`flex-1 p-3 overflow-y-auto ${
                                whiteboardMode === "split" || isScreenSharing
                                    ? "w-full md:w-2/5 lg:w-1/3 flex flex-col gap-3"
                                    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 items-center justify-center"
                            }`}
                        >
                            {/* Local Participant Tile */}
                            <div
                                className={`relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border ${
                                    activeSpeakerId === "me"
                                        ? "border-emerald-500 ring-2 ring-emerald-500/50"
                                        : "border-white/10"
                                } shadow-lg group flex items-center justify-center`}
                            >
                                {isCamOff ? (
                                    <div className="flex flex-col items-center gap-2 text-slate-400">
                                        <div className="w-14 h-14 rounded-full bg-blue-600/30 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-xl">
                                            {user.name ? user.name[0].toUpperCase() : "U"}
                                        </div>
                                        <span className="text-xs font-semibold text-slate-300">
                                            {user.name || preJoinState.displayName || "You"}
                                        </span>
                                    </div>
                                ) : (
                                    <video
                                        ref={(el) => {
                                            localVideoRef.current = el;
                                            if (el && localStream) {
                                                el.srcObject = localStream;
                                            }
                                        }}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover -scale-x-100"
                                    />
                                )}

                                {/* Overlay Badges */}
                                <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-2 border border-white/10">
                                    <span>{user.name || preJoinState.displayName || "You"} (You)</span>
                                    {isHost && (
                                        <span className="px-1.5 py-0.2 rounded-sm bg-blue-600 text-[9px] font-black uppercase">
                                            Host
                                        </span>
                                    )}
                                </div>

                                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                                    {handRaised && (
                                        <span className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-bold shadow-lg animate-bounce">
                                            ✋
                                        </span>
                                    )}
                                    {isMicMuted && (
                                        <span className="w-7 h-7 rounded-full bg-rose-600/90 text-white flex items-center justify-center text-xs shadow-md">
                                            <i className="fa-solid fa-microphone-slash"></i>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Remote Participants Tiles */}
                            {participants.map((p) => {
                                const pId = p.socketId || p.id || p.identity;
                                const isRemoteHandRaised = raisedHands.has(pId) || (p.id && raisedHands.has(p.id));
                                const displayName = p.display_name || p.user_name || p.name || p.guest_name || "Participant";
                                const remoteStream = (p.socketId && remoteStreams[p.socketId]) || (p.id && remoteStreams[p.id]) || (p.identity && remoteStreams[p.identity]);
                                const hasVideo = remoteStream && remoteStream.getVideoTracks().length > 0 && remoteStream.getVideoTracks().some((t) => t.enabled);

                                return (
                                    <div
                                        key={pId}
                                        className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-white/10 shadow-lg flex items-center justify-center"
                                    >
                                        {hasVideo ? (
                                            <video
                                                ref={(el) => {
                                                    if (el && remoteStream && el.srcObject !== remoteStream) {
                                                        el.srcObject = remoteStream;
                                                    }
                                                }}
                                                autoPlay
                                                playsInline
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                                <div className="w-14 h-14 rounded-full bg-slate-800 border border-white/10 text-white flex items-center justify-center font-bold text-xl">
                                                    {displayName ? displayName[0].toUpperCase() : "P"}
                                                </div>
                                                <span className="text-xs font-semibold text-slate-300">
                                                    {displayName}
                                                </span>
                                            </div>
                                        )}

                                        {/* Remote Audio Track (always attached so participant is heard even if video is off) */}
                                        {remoteStream && remoteStream.getAudioTracks().length > 0 && (
                                            <audio
                                                ref={(el) => {
                                                    if (el && remoteStream && el.srcObject !== remoteStream) {
                                                        el.srcObject = remoteStream;
                                                        el.play().catch(() => {});
                                                    }
                                                }}
                                                autoPlay
                                            />
                                        )}

                                        <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 border border-white/10">
                                            <span>{displayName}</span>
                                            {p.role === "host" && (
                                                <span className="px-1.5 py-0.2 rounded-sm bg-blue-600 text-[9px] font-black uppercase">
                                                    Host
                                                </span>
                                            )}
                                        </div>

                                        {isRemoteHandRaised && (
                                            <div className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-xs font-bold shadow-lg animate-bounce">
                                                ✋
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Drawers */}
                <HostControlsDrawer
                    isOpen={isHostDrawerOpen}
                    onClose={() => setIsHostDrawerOpen(false)}
                    roomCode={roomCode}
                    meeting={meeting}
                    waitingParticipants={waitingParticipants}
                    activeParticipants={participants}
                    onAdmitSuccess={(admittedId) => {
                        if (admittedId === "all") {
                            setWaitingParticipants([]);
                        } else {
                            setWaitingParticipants((prev) =>
                                prev.filter((p) => (p.id || p.participantId) !== admittedId)
                            );
                        }
                    }}
                    onDenySuccess={(pId) => {
                        setWaitingParticipants((prev) => prev.filter((p) => (p.id || p.participantId) !== pId));
                    }}
                    onHostAction={handleHostAction}
                    permissions={permissions}
                    onUpdatePermissions={setPermissions}
                />

                <MeetingChatDrawer
                    isOpen={isChatDrawerOpen}
                    onClose={() => setIsChatDrawerOpen(false)}
                    messages={chatMessages}
                    onSendMessage={handleSendMessage}
                    canChat={permissions.canChat || isHost}
                    currentUser={user}
                />

                <MeetingNotesDrawer
                    isOpen={isNotesDrawerOpen}
                    onClose={() => setIsNotesDrawerOpen(false)}
                    meetingId={meeting?.id}
                    currentUser={user}
                />
            </div>

            {/* 4. Bottom Control Bar (Screen 3 & 4) */}
            <div className="h-18 px-4 sm:px-6 bg-slate-900 border-t border-white/10 flex items-center justify-between shrink-0 z-30">
                {/* Left Area: Room Details Pill */}
                <div className="hidden sm:flex items-center gap-2">
                    <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 border border-white/10">
                        {roomCode}
                    </span>
                </div>

                {/* Center Area: Primary A/V Controls */}
                <div className="flex items-center gap-2 sm:gap-3 mx-auto sm:mx-0">
                    {/* Microphone Toggle */}
                    <button
                        onClick={handleToggleMic}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg shadow-md transition-all active:scale-95 cursor-pointer ${
                            isMicMuted
                                ? "bg-rose-600 text-white shadow-rose-600/30"
                                : "bg-slate-800 hover:bg-slate-700 text-white border border-white/10"
                        }`}
                        title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
                    >
                        <i className={`fa-solid ${isMicMuted ? "fa-microphone-slash" : "fa-microphone"}`}></i>
                    </button>

                    {/* Camera Toggle */}
                    <button
                        onClick={handleToggleCam}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg shadow-md transition-all active:scale-95 cursor-pointer ${
                            isCamOff
                                ? "bg-rose-600 text-white shadow-rose-600/30"
                                : "bg-slate-800 hover:bg-slate-700 text-white border border-white/10"
                        }`}
                        title={isCamOff ? "Turn On Camera" : "Turn Off Camera"}
                    >
                        <i className={`fa-solid ${isCamOff ? "fa-video-slash" : "fa-video"}`}></i>
                    </button>

                    {/* Screen Share Toggle */}
                    <button
                        onClick={handleToggleScreenShare}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg shadow-md transition-all active:scale-95 cursor-pointer ${
                            isScreenSharing
                                ? "bg-emerald-600 text-white shadow-emerald-600/30"
                                : "bg-slate-800 hover:bg-slate-700 text-white border border-white/10"
                        }`}
                        title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
                    >
                        <i className="fa-solid fa-desktop"></i>
                    </button>

                    {/* Hand Raise */}
                    <button
                        onClick={handleToggleHandRaise}
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg shadow-md transition-all active:scale-95 cursor-pointer ${
                            handRaised
                                ? "bg-amber-500 text-slate-900 shadow-amber-500/30 font-bold"
                                : "bg-slate-800 hover:bg-slate-700 text-white border border-white/10"
                        }`}
                        title={handRaised ? "Lower Hand" : "Raise Hand"}
                    >
                        <span>✋</span>
                    </button>
                </div>

                {/* Right Area: Drawers & End Meeting */}
                <div className="flex items-center gap-2">
                    {/* Chat Drawer Toggle */}
                    <button
                        onClick={() => {
                            setIsChatDrawerOpen(!isChatDrawerOpen);
                            setUnreadChatCount(0);
                        }}
                        className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                            isChatDrawerOpen
                                ? "bg-blue-600 text-white"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
                        }`}
                        title="In-Meeting Chat"
                    >
                        <i className="fa-solid fa-comments"></i>
                        {unreadChatCount > 0 && !isChatDrawerOpen && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-md">
                                {unreadChatCount}
                            </span>
                        )}
                    </button>

                    {/* Notes Drawer Toggle */}
                    <button
                        onClick={() => setIsNotesDrawerOpen(!isNotesDrawerOpen)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                            isNotesDrawerOpen
                                ? "bg-amber-500 text-slate-900 font-bold"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
                        }`}
                        title="Meeting Notes &amp; Action Items"
                    >
                        <i className="fa-solid fa-note-sticky"></i>
                    </button>

                    {/* Recording Toggle (Host only) */}
                    {isHost && (
                        <button
                            onClick={() => {
                                if (isRecording) {
                                    handleStopRecording();
                                } else {
                                    setIsRecordingModalOpen(true);
                                }
                            }}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                                isRecording
                                    ? "bg-rose-600 text-white shadow-lg shadow-rose-600/30 animate-pulse"
                                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
                            }`}
                            title={isRecording ? "Stop Recording" : "Record Meeting"}
                        >
                            <i className="fa-solid fa-record-vinyl"></i>
                        </button>
                    )}

                    {/* Host Administration & Lobby Drawer */}
                    {isHost && (
                        <button
                            onClick={() => setIsHostDrawerOpen(!isHostDrawerOpen)}
                            className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-sm transition-all cursor-pointer ${
                                isHostDrawerOpen
                                    ? "bg-blue-600 text-white"
                                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
                            }`}
                            title="Host Controls &amp; Lobby"
                        >
                            <i className="fa-solid fa-shield-halved"></i>
                            {waitingParticipants.length > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center shadow-md animate-pulse">
                                    {waitingParticipants.length}
                                </span>
                            )}
                        </button>
                    )}

                    {/* Leave / End Room */}
                    <button
                        onClick={() => handleLeaveRoom(isHost)}
                        className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center gap-1.5 cursor-pointer ml-1"
                    >
                        <i className="fa-solid fa-phone-slash"></i>
                        <span>{isHost ? "End" : "Leave"}</span>
                    </button>
                </div>
            </div>

            {/* Recording Consent Modal */}
            <RecordingConsentModal
                isOpen={isRecordingModalOpen}
                onClose={() => setIsRecordingModalOpen(false)}
                onConfirmStart={handleStartRecording}
            />
        </div>
    );
}
