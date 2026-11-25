let livekitSdk;
try {
    livekitSdk = require("livekit-server-sdk");
} catch (e) {
    console.warn("livekit-server-sdk not loaded yet, using mock token generator until installed:", e.message);
}

const {
    createMeeting,
    getMeetingByRoomCode,
    getMeetingById,
    getMeetings,
    updateMeeting,
    addOrUpdateParticipant,
    getMeetingParticipants,
    updateParticipantStatus,
    getWhiteboardByMeeting,
    saveWhiteboard,
    getMeetingNotes,
    saveMeetingNotes,
    createRecording,
    getRecordings
} = require("../models/meetingModel.js");

const { createAuditLog } = require("../models/auditLogModel.js");
const { getIO } = require("../socket.js");

// Fallback high-entropy room code generator
const generateRoomCode = () => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `int-${segment(4)}-${segment(4)}`;
};

// ─── Instant Meeting Launcher ───────────────────────────────────────
const createInstantMeeting = async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;
        const { title = "Instant Meeting", project_id = null, task_id = null, is_lobby_enabled = true } = req.body;

        const roomCode = generateRoomCode();

        const meetingId = await createMeeting({
            organization_id: organizationId,
            company_id: companyId,
            project_id: project_id ? parseInt(project_id, 10) : null,
            task_id: task_id ? parseInt(task_id, 10) : null,
            room_code: roomCode,
            title,
            meeting_type: "instant",
            host_id: userId,
            status: "scheduled",
            is_lobby_enabled: is_lobby_enabled === undefined ? true : Boolean(is_lobby_enabled),
            is_recording_allowed: true,
            is_guest_allowed: true
        });

        // Register host as participant (admitted to lobby/prep; transitions to live upon token generation)
        await addOrUpdateParticipant({
            meeting_id: meetingId,
            user_id: userId,
            role: "host",
            status: "waiting_room"
        });

        // Audit log
        await createAuditLog(
            userId,
            req.user.name || req.user.username,
            req.headers["x-device-id"] || null,
            "meetings",
            "CREATE_INSTANT",
            null,
            { meetingId, roomCode, title },
            null,
            companyId
        );

        const meeting = await getMeetingById(meetingId, companyId);

        return res.status(201).json({
            success: true,
            message: "Instant meeting created successfully",
            meeting
        });
    } catch (error) {
        console.error("createInstantMeeting error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Schedule Meeting ───────────────────────────────────────────────
const scheduleMeeting = async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organization_id || 1;
        const companyId = req.user.company_id || 1;

        const {
            title,
            description,
            project_id,
            task_id,
            scheduled_start,
            scheduled_end,
            is_lobby_enabled = true,
            is_recording_allowed = false,
            is_guest_allowed = true,
            passcode = null
        } = req.body;

        if (!title || !scheduled_start) {
            return res.status(400).json({
                success: false,
                message: "Meeting title and scheduled start time are required."
            });
        }

        const roomCode = generateRoomCode();

        const meetingId = await createMeeting({
            organization_id: organizationId,
            company_id: companyId,
            project_id: project_id ? parseInt(project_id, 10) : null,
            task_id: task_id ? parseInt(task_id, 10) : null,
            room_code: roomCode,
            title,
            description,
            meeting_type: "scheduled",
            host_id: userId,
            scheduled_start: new Date(scheduled_start),
            scheduled_end: scheduled_end ? new Date(scheduled_end) : null,
            status: "scheduled",
            is_lobby_enabled: Boolean(is_lobby_enabled),
            is_recording_allowed: Boolean(is_recording_allowed),
            is_guest_allowed: Boolean(is_guest_allowed),
            passcode: passcode || null
        });

        await addOrUpdateParticipant({
            meeting_id: meetingId,
            user_id: userId,
            role: "host",
            status: "admitted"
        });

        const meeting = await getMeetingById(meetingId, companyId);

        return res.status(201).json({
            success: true,
            message: "Meeting scheduled successfully",
            meeting
        });
    } catch (error) {
        console.error("scheduleMeeting error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── List Meetings (Company Scoped) ─────────────────────────────────
const listMeetings = async (req, res) => {
    try {
        const companyId = req.user.company_id || 1;
        const { status, project_id, task_id, search } = req.query;

        // Auto-reconcile orphan live meetings (e.g. instant meetings with no active socket peers)
        const io = getIO();
        if (io) {
            try {
                const rawLive = await getMeetings(companyId, { status: "live" });
                for (const lm of rawLive) {
                    const roomKey = `meeting_${lm.room_code}`;
                    const room = io.sockets.adapter.rooms.get(roomKey);
                    const activeSockets = room ? room.size : 0;
                    if (activeSockets === 0) {
                        const ageMs = Date.now() - new Date(lm.created_at).getTime();
                        if (ageMs > 30 * 1000) {
                            if (lm.meeting_type === "instant" && (!lm.active_participants_count || lm.active_participants_count === 0)) {
                                await updateMeeting(lm.id, { status: "cancelled", scheduled_end: new Date() });
                            } else {
                                await updateMeeting(lm.id, { status: "ended", scheduled_end: new Date() });
                            }
                        }
                    }
                }
            } catch (reconErr) {
                console.warn("Meeting auto-reconciliation notice:", reconErr.message);
            }
        }

        const meetings = await getMeetings(companyId, {
            status,
            project_id: project_id ? parseInt(project_id, 10) : null,
            task_id: task_id ? parseInt(task_id, 10) : null,
            search
        });

        return res.json({
            success: true,
            meetings
        });
    } catch (error) {
        console.error("listMeetings error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Get Meeting Details ────────────────────────────────────────────
const getMeetingDetails = async (req, res) => {
    try {
        const { roomCode } = req.params;
        const meeting = await getMeetingByRoomCode(roomCode);

        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting room not found" });
        }

        const participants = await getMeetingParticipants(meeting.id);
        const whiteboard = await getWhiteboardByMeeting(meeting.id);
        const notes = await getMeetingNotes(meeting.id);

        return res.json({
            success: true,
            meeting,
            participants,
            whiteboard,
            notes
        });
    } catch (error) {
        console.error("getMeetingDetails error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Generate LiveKit Room Token ────────────────────────────────────
const generateMeetingToken = async (req, res) => {
    try {
        const { roomCode } = req.params;
        const { guest_name, guest_email, passcode } = req.body;

        const meeting = await getMeetingByRoomCode(roomCode);
        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        if (meeting.status === "ended" || meeting.status === "cancelled") {
            return res.status(200).json({
                success: false,
                status: "ended",
                message: "This meeting has concluded."
            });
        }

        const user = req.user || null;
        const isHost = user && user.id === meeting.host_id;

        // Check passcode if protected and participant is not host
        if (meeting.passcode && !isHost) {
            if (passcode !== meeting.passcode) {
                return res.status(401).json({
                    success: false,
                    requiresPasscode: true,
                    message: "Invalid meeting passcode"
                });
            }
        }

        // Verify company isolation for authenticated non-guests
        if (user && user.company_id && meeting.company_id && user.company_id !== meeting.company_id && !meeting.is_guest_allowed) {
            return res.status(403).json({
                success: false,
                message: "Access restricted: This meeting belongs to another company workspace."
            });
        }

        const role = isHost ? "host" : (user ? "participant" : "guest");
        const displayName = user?.name || user?.username || guest_name || "Guest";
        const identity = user?.id ? `user_${user.id}` : `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // Check waiting room status if lobby is enabled and user is not host
        if (meeting.is_lobby_enabled && !isHost) {
            const participants = await getMeetingParticipants(meeting.id);
            const currentParticipant = participants.find(p =>
                (user && p.user_id === user.id) ||
                (guest_email && p.guest_email === guest_email) ||
                (guest_name && p.guest_name === guest_name)
            );

            if (!currentParticipant || currentParticipant.status === "waiting_room") {
                let partId = currentParticipant ? currentParticipant.id : null;
                // Participant must wait in the lobby
                if (!currentParticipant) {
                    const added = await addOrUpdateParticipant({
                        meeting_id: meeting.id,
                        user_id: user?.id || null,
                        guest_name: displayName,
                        guest_email: user?.email || guest_email || null,
                        role,
                        status: "waiting_room"
                    });
                    partId = added.id;
                }

                // Notify host via Socket.IO
                const io = getIO();
                if (io) {
                    io.to(`meeting_${meeting.room_code}`).emit("lobby_updated", {
                        meetingId: meeting.id,
                        participantId: partId,
                        id: partId,
                        name: displayName,
                        display_name: displayName,
                        email: user?.email || guest_email,
                        role,
                        status: "waiting_room"
                    });
                }

                return res.json({
                    success: true,
                    status: "waiting_room",
                    participantId: partId,
                    message: "Please wait, the host will let you in shortly.",
                    meeting: {
                        id: meeting.id,
                        title: meeting.title,
                        room_code: meeting.room_code,
                        host_name: meeting.host_name
                    }
                });
            } else if (currentParticipant.status === "rejected") {
                return res.status(403).json({
                    success: false,
                    status: "rejected",
                    message: "The host has declined your request to join this meeting."
                });
            }
        }

        // Mark as admitted
        await addOrUpdateParticipant({
            meeting_id: meeting.id,
            user_id: user?.id || null,
            guest_name: displayName,
            guest_email: user?.email || guest_email || null,
            role,
            status: "admitted"
        });

        // Update meeting status to 'live' if currently scheduled
        if (meeting.status === "scheduled") {
            await updateMeeting(meeting.id, { status: "live" });
        }

        // Generate LiveKit Token
        const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
        const apiSecret = process.env.LIVEKIT_API_SECRET || "secret_32_characters_minimum_interlink_sfu";
        const livekitUrl = process.env.LIVEKIT_URL || "wss://livekit.interlink-workspace.local";

        let livekitToken = null;
        if (livekitSdk && livekitSdk.AccessToken) {
            const at = new livekitSdk.AccessToken(apiKey, apiSecret, {
                identity,
                name: displayName,
                metadata: JSON.stringify({
                    userId: user?.id || null,
                    role,
                    companyId: meeting.company_id,
                    avatar: user?.avatar || null
                })
            });

            at.addGrant({
                roomJoin: true,
                room: meeting.room_code,
                canPublish: true,
                canSubscribe: true,
                canPublishData: true,
                roomAdmin: isHost
            });

            livekitToken = await at.toJwt();
        } else {
            // Self-contained signed JWT fallback
            const jwt = require("jsonwebtoken");
            livekitToken = jwt.sign(
                {
                    sub: identity,
                    name: displayName,
                    video: {
                        room: meeting.room_code,
                        roomJoin: true,
                        canPublish: true,
                        canSubscribe: true,
                        canPublishData: true
                    },
                    metadata: { role, isHost }
                },
                process.env.JWT_SECRET,
                { expiresIn: "4h" }
            );
        }

        return res.json({
            success: true,
            status: "admitted",
            token: livekitToken,
            serverUrl: livekitUrl,
            participant: {
                identity,
                name: displayName,
                role,
                isHost
            },
            meeting: {
                id: meeting.id,
                title: meeting.title,
                room_code: meeting.room_code,
                host_id: meeting.host_id,
                host_name: meeting.host_name,
                project_id: meeting.project_id,
                task_id: meeting.task_id,
                is_recording_allowed: Boolean(meeting.is_recording_allowed),
                is_lobby_enabled: Boolean(meeting.is_lobby_enabled)
            }
        });
    } catch (error) {
        console.error("generateMeetingToken error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Lobby / Waiting Room: Join Lobby Queue ─────────────────────────
const joinLobby = async (req, res) => {
    try {
        const { roomCode } = req.params;
        const { guest_name, guest_email } = req.body;

        const meeting = await getMeetingByRoomCode(roomCode);
        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        if (meeting.status === "ended" || meeting.status === "cancelled") {
            return res.status(200).json({
                success: false,
                status: "ended",
                message: "This meeting has concluded."
            });
        }

        const user = req.user || null;
        const displayName = user?.name || guest_name || "Guest";

        const participant = await addOrUpdateParticipant({
            meeting_id: meeting.id,
            user_id: user?.id || null,
            guest_name: displayName,
            guest_email: user?.email || guest_email || null,
            role: "participant",
            status: "waiting_room"
        });

        // Broadcast to host in room
        const io = getIO();
        if (io) {
            io.to(`meeting_${meeting.room_code}`).emit("lobby_updated", {
                meetingId: meeting.id,
                participantId: participant.id,
                name: displayName,
                email: user?.email || guest_email,
                status: "waiting_room"
            });
        }

        return res.json({
            success: true,
            status: "waiting_room",
            participantId: participant.id,
            message: "Enqueued in waiting room"
        });
    } catch (error) {
        console.error("joinLobby error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Host Actions: Admit / Deny Participant ─────────────────────────
const admitParticipant = async (req, res) => {
    try {
        const { roomCode, participantId } = req.params;
        const meeting = await getMeetingByRoomCode(roomCode);

        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        // Host verification
        if (req.user && req.user.id !== meeting.host_id && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Only the host can admit participants." });
        }

        await updateParticipantStatus(participantId, "admitted");

        const io = getIO();
        if (io) {
            const payload = {
                participantId: parseInt(participantId, 10),
                roomCode
            };
            io.to(`meeting_${meeting.room_code}`).emit("participant_admitted", payload);
            io.to(`lobby_${meeting.room_code}`).emit("participant_admitted", payload);
        }

        return res.json({ success: true, message: "Participant admitted" });
    } catch (error) {
        console.error("admitParticipant error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const denyParticipant = async (req, res) => {
    try {
        const { roomCode, participantId } = req.params;
        const meeting = await getMeetingByRoomCode(roomCode);

        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        if (req.user && req.user.id !== meeting.host_id && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Only the host can deny participants." });
        }

        await updateParticipantStatus(participantId, "rejected");

        const io = getIO();
        if (io) {
            const payload = {
                participantId: parseInt(participantId, 10),
                roomCode
            };
            io.to(`meeting_${meeting.room_code}`).emit("participant_rejected", payload);
            io.to(`lobby_${meeting.room_code}`).emit("participant_rejected", payload);
        }

        return res.json({ success: true, message: "Participant denied entry" });
    } catch (error) {
        console.error("denyParticipant error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Cancel Meeting ──────────────────────────────────────────────────
const cancelMeeting = async (req, res) => {
    try {
        const { roomCode } = req.params;
        const meeting = await getMeetingByRoomCode(roomCode);

        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        if (req.user.id !== meeting.host_id && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Only the host can cancel the meeting." });
        }

        await updateMeeting(meeting.id, { status: "cancelled", scheduled_end: new Date() });

        const io = getIO();
        if (io) {
            io.to(`meeting_${meeting.room_code}`).emit("meeting_ended", {
                meetingId: meeting.id,
                roomCode
            });
            io.to(`lobby_${meeting.room_code}`).emit("meeting_ended", {
                meetingId: meeting.id,
                roomCode
            });
        }

        return res.json({ success: true, message: "Meeting cancelled successfully" });
    } catch (error) {
        console.error("cancelMeeting error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── End Meeting ────────────────────────────────────────────────────
const endMeetingSession = async (req, res) => {
    try {
        const { roomCode } = req.params;
        const meeting = await getMeetingByRoomCode(roomCode);

        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        if (req.user.id !== meeting.host_id && req.user.role !== "admin") {
            return res.status(403).json({ success: false, message: "Only the host can end the meeting." });
        }

        await updateMeeting(meeting.id, { status: "ended", scheduled_end: new Date() });

        const io = getIO();
        if (io) {
            io.to(`meeting_${meeting.room_code}`).emit("meeting_ended", {
                meetingId: meeting.id,
                roomCode
            });
        }

        return res.json({ success: true, message: "Meeting ended successfully" });
    } catch (error) {
        console.error("endMeetingSession error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Whiteboard State & Save to Project ──────────────────────────────
const getMeetingWhiteboard = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const whiteboard = await getWhiteboardByMeeting(meetingId);
        return res.json({ success: true, whiteboard });
    } catch (error) {
        console.error("getMeetingWhiteboard error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const saveMeetingWhiteboard = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { canvas_data, thumbnail_url, title, project_id } = req.body;

        const meeting = await getMeetingById(meetingId);
        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        const wbId = await saveWhiteboard({
            meeting_id: parseInt(meetingId, 10),
            organization_id: meeting.organization_id,
            company_id: meeting.company_id,
            project_id: project_id ? parseInt(project_id, 10) : meeting.project_id,
            title: title || `${meeting.title} - Whiteboard`,
            canvas_data: typeof canvas_data === "object" ? JSON.stringify(canvas_data) : canvas_data,
            thumbnail_url
        });

        // Broadcast to whiteboard peers via Socket.IO
        const io = getIO();
        if (io) {
            io.to(`meeting_${meeting.room_code}`).emit("whiteboard_saved", {
                whiteboardId: wbId,
                title: title || `${meeting.title} - Whiteboard`,
                savedAt: new Date()
            });
        }

        return res.json({
            success: true,
            message: "Whiteboard saved successfully",
            whiteboardId: wbId
        });
    } catch (error) {
        console.error("saveMeetingWhiteboard error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Meeting Notes & Action Items ───────────────────────────────────
const getNotes = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const notes = await getMeetingNotes(meetingId);
        return res.json({ success: true, notes });
    } catch (error) {
        console.error("getNotes error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

const saveNotes = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { notes_content, ai_summary, action_items } = req.body;
        const userId = req.user.id;

        const meeting = await getMeetingById(meetingId);
        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        const notesId = await saveMeetingNotes({
            meeting_id: parseInt(meetingId, 10),
            author_id: userId,
            notes_content,
            ai_summary,
            action_items
        });

        const io = getIO();
        if (io) {
            io.to(`meeting_${meeting.room_code}`).emit("notes_updated", {
                meetingId,
                notes_content,
                action_items,
                updatedBy: req.user.name || "User"
            });
        }

        return res.json({
            success: true,
            message: "Meeting notes saved successfully",
            notesId
        });
    } catch (error) {
        console.error("saveNotes error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Post-Meeting Summary & Archive ─────────────────────────────────
const getMeetingSummary = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.user.company_id || 1;

        const meeting = await getMeetingById(id, companyId);
        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        const participants = await getMeetingParticipants(meeting.id);
        const whiteboard = await getWhiteboardByMeeting(meeting.id);
        const notes = await getMeetingNotes(meeting.id);
        const recordings = await getRecordings(meeting.id);

        return res.json({
            success: true,
            summary: {
                meeting,
                participants,
                whiteboard,
                notes,
                recordings
            }
        });
    } catch (error) {
        console.error("getMeetingSummary error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Recordings ─────────────────────────────────────────────────────
const recordMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { file_url, file_size_bytes, duration_seconds } = req.body;
        const userId = req.user.id;

        const meeting = await getMeetingById(meetingId);
        if (!meeting) {
            return res.status(404).json({ success: false, message: "Meeting not found" });
        }

        const recId = await createRecording({
            meeting_id: parseInt(meetingId, 10),
            organization_id: meeting.organization_id,
            company_id: meeting.company_id,
            file_url,
            file_size_bytes: file_size_bytes || 0,
            duration_seconds: duration_seconds || 0,
            recorded_by: userId
        });

        return res.status(201).json({
            success: true,
            message: "Recording registered successfully",
            recordingId: recId
        });
    } catch (error) {
        console.error("recordMeeting error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createInstantMeeting,
    scheduleMeeting,
    listMeetings,
    getMeetingDetails,
    generateMeetingToken,
    joinLobby,
    admitParticipant,
    denyParticipant,
    cancelMeeting,
    endMeetingSession,
    getMeetingWhiteboard,
    saveMeetingWhiteboard,
    getNotes,
    saveNotes,
    getMeetingSummary,
    recordMeeting
};
