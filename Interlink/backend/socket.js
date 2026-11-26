const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const {
    sendMessage,
    markConversationRead,
    toggleMessageReaction
} = require("./models/chatModel.js");
const { getMeetingByRoomCode, updateMeeting } = require("./models/meetingModel.js");

let io = null;

const checkAndAutoEndMeeting = (roomCode) => {
    if (!roomCode) return;
    setTimeout(async () => {
        try {
            const roomKey = `meeting_${roomCode}`;
            const room = io?.sockets.adapter.rooms.get(roomKey);
            const remainingCount = room ? room.size : 0;
            if (remainingCount === 0) {
                const meeting = await getMeetingByRoomCode(roomCode);
                if (meeting && meeting.status === "live") {
                    await updateMeeting(meeting.id, { status: "ended", scheduled_end: new Date() });
                    if (io) {
                        io.to(`meeting_${roomCode}`).emit("meeting_ended", {
                            meetingId: meeting.id,
                            roomCode
                        });
                    }
                }
            }
        } catch (err) {
            console.warn("Auto-ending empty meeting room error:", err.message);
        }
    }, 5000);
};

const initSocket = (server) => {
    // Intercept and normalize /api/socket.io to /socket.io so Socket.IO works behind Passenger /api mount
    if (server) {
        server.prependListener("request", (req, res) => {
            if (req.url && req.url.startsWith("/api/socket.io")) {
                req.url = req.url.replace(/^\/api\/socket\.io/, "/socket.io");
            }
        });

        server.prependListener("upgrade", (req, socket, head) => {
            if (req.url && req.url.startsWith("/api/socket.io")) {
                req.url = req.url.replace(/^\/api\/socket\.io/, "/socket.io");
            }
        });
    }

    io = new Server(server, {
        cors: {
            origin: (origin, callback) => callback(null, true),
            credentials: true,
            methods: ["GET", "POST"]
        },
        transports: ["polling", "websocket"],
        allowEIO3: true
    });

    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
        if (!token) {
            // Allow connection for guest or handle gracefully
            return next();
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            console.warn("[Socket.IO] Token verification failed:", err.message);
            next();
        }
    });

    io.on("connection", (socket) => {
        const userId = socket.user?.id;
        if (userId) {
            socket.join(`user_${userId}`);
        }

        // Join conversation room
        socket.on("join_conversation", (conversationId) => {
            if (conversationId) {
                socket.join(`conv_${conversationId}`);
            }
        });

        // Leave conversation room
        socket.on("leave_conversation", (conversationId) => {
            if (conversationId) {
                socket.leave(`conv_${conversationId}`);
            }
        });

        // Send message event
        socket.on("send_message", async (data, callback) => {
            try {
                const senderId = socket.user?.id || data.senderId;
                if (!senderId) throw new Error("Unauthorized sender");

                const newMsg = await sendMessage({
                    conversationId: data.conversationId,
                    senderId,
                    messageText: data.messageText,
                    messageType: data.messageType || 'TEXT',
                    fileUrl: data.fileUrl,
                    fileName: data.fileName,
                    fileSize: data.fileSize,
                    fileMime: data.fileMime,
                    parentMessageId: data.parentMessageId,
                    isAnnouncement: data.isAnnouncement
                });

                // Broadcast to conversation room
                io.to(`conv_${data.conversationId}`).emit("new_message", newMsg);

                if (typeof callback === "function") {
                    callback({ success: true, message: newMsg });
                }
            } catch (err) {
                console.error("[Socket.IO] send_message error:", err.message);
                if (typeof callback === "function") {
                    callback({ success: false, error: err.message });
                }
            }
        });

        // Typing indicator
        socket.on("typing", ({ conversationId, userName }) => {
            socket.to(`conv_${conversationId}`).emit("user_typing", {
                conversationId,
                userId: socket.user?.id,
                userName: userName || socket.user?.name || "Someone"
            });
        });

        socket.on("stop_typing", ({ conversationId }) => {
            socket.to(`conv_${conversationId}`).emit("user_stop_typing", {
                conversationId,
                userId: socket.user?.id
            });
        });

        // Toggle reaction
        socket.on("toggle_reaction", async ({ messageId, emoji, conversationId }, callback) => {
            try {
                const userId = socket.user?.id;
                if (!userId) throw new Error("Unauthorized");
                const res = await toggleMessageReaction(messageId, userId, emoji);
                io.to(`conv_${conversationId}`).emit("reaction_updated", res);
                if (typeof callback === "function") callback({ success: true, data: res });
            } catch (err) {
                if (typeof callback === "function") callback({ success: false, error: err.message });
            }
        });

        // Mark as read
        socket.on("mark_read", async ({ conversationId }, callback) => {
            try {
                const userId = socket.user?.id;
                if (!userId) return;
                const res = await markConversationRead(conversationId, userId);
                socket.to(`conv_${conversationId}`).emit("conversation_read", res);
                if (typeof callback === "function") callback({ success: true });
            } catch (err) {
                if (typeof callback === "function") callback({ success: false });
            }
        });

        // ─── Meeting & Whiteboard Realtime Signaling ───────────
        socket.on("join_lobby", ({ roomCode }) => {
            if (roomCode) {
                socket.join(`lobby_${roomCode}`);
            }
        });

        socket.on("join_meeting_room", ({ roomCode, participant }) => {
            if (roomCode) {
                const roomKey = `meeting_${roomCode}`;
                socket.leave(`lobby_${roomCode}`);

                socket.meetingRoomKey = roomKey;
                socket.meetingParticipant = {
                    ...(participant || {}),
                    socketId: socket.id,
                    id: participant?.id || (socket.user?.id ? `user_${socket.user.id}` : socket.id),
                    name: participant?.name || socket.user?.name || "Participant"
                };

                // Find existing peers already in this meeting room (excluding self)
                const existingPeers = [];
                const room = io.sockets.adapter.rooms.get(roomKey);
                if (room) {
                    for (const sId of room) {
                        if (sId !== socket.id) {
                            const peerSocket = io.sockets.sockets.get(sId);
                            if (peerSocket && peerSocket.meetingParticipant) {
                                existingPeers.push({
                                    socketId: sId,
                                    participant: peerSocket.meetingParticipant
                                });
                            } else {
                                existingPeers.push({
                                    socketId: sId,
                                    participant: { socketId: sId, name: "Participant" }
                                });
                            }
                        }
                    }
                }

                socket.join(roomKey);

                // Send list of existing peers to the newly joined participant
                socket.emit("existing_meeting_peers", { peers: existingPeers });

                // Notify all existing participants in the room
                socket.to(roomKey).emit("peer_joined", {
                    participant: socket.meetingParticipant,
                    socketId: socket.id
                });
            }
        });

        socket.on("webrtc_signal", ({ to, signal }) => {
            if (to) {
                io.to(to).emit("webrtc_signal", {
                    from: socket.id,
                    fromParticipant: socket.meetingParticipant,
                    signal
                });
            }
        });

        socket.on("leave_meeting_room", ({ roomCode, participantId }) => {
            if (roomCode) {
                const roomKey = `meeting_${roomCode}`;
                socket.leave(roomKey);
                socket.to(roomKey).emit("peer_left", {
                    participantId: participantId || socket.meetingParticipant?.id || socket.id,
                    socketId: socket.id
                });
                socket.meetingRoomKey = null;
                socket.meetingParticipant = null;
                checkAndAutoEndMeeting(roomCode);
            }
        });

        socket.on("whiteboard_draw", ({ roomCode, action, element, elements }) => {
            if (roomCode) {
                socket.to(`meeting_${roomCode}`).emit("whiteboard_draw", {
                    action,
                    element,
                    elements,
                    senderId: socket.user?.id || socket.id
                });
            }
        });

        socket.on("whiteboard_cursor", ({ roomCode, cursor }) => {
            if (roomCode) {
                socket.to(`meeting_${roomCode}`).emit("whiteboard_cursor", {
                    ...cursor,
                    senderId: socket.user?.id || socket.id,
                    senderName: cursor.senderName || socket.user?.name || "Collaborator"
                });
            }
        });

        socket.on("meeting_chat_message", ({ roomCode, message }) => {
            if (roomCode) {
                io.to(`meeting_${roomCode}`).emit("meeting_chat_message", {
                    ...message,
                    senderId: socket.user?.id || socket.id,
                    senderName: message.senderName || socket.user?.name || "Participant",
                    timestamp: new Date()
                });
            }
        });

        socket.on("meeting_raise_hand", ({ roomCode, participantId, participantName, raised }) => {
            if (roomCode) {
                io.to(`meeting_${roomCode}`).emit("meeting_raise_hand", {
                    participantId: participantId || socket.user?.id || socket.id,
                    participantName: participantName || socket.user?.name || "Participant",
                    raised
                });
            }
        });

        socket.on("host_control_action", ({ roomCode, action, targetParticipantId, payload }) => {
            if (roomCode) {
                io.to(`meeting_${roomCode}`).emit("host_control_action", {
                    action,
                    targetParticipantId,
                    payload,
                    senderId: socket.user?.id || socket.id
                });
            }
        });

        socket.on("disconnecting", () => {
            if (socket.meetingRoomKey) {
                const roomKey = socket.meetingRoomKey;
                const roomCode = roomKey.replace(/^meeting_/, "");
                socket.to(roomKey).emit("peer_left", {
                    participantId: socket.meetingParticipant?.id || socket.id,
                    socketId: socket.id
                });
                checkAndAutoEndMeeting(roomCode);
            }
        });

        socket.on("disconnect", () => {
            // disconnected cleanly
        });
    });

    console.log("Socket.IO initialized.");
    return io;
};

const getIO = () => io;

module.exports = {
    initSocket,
    getIO
};
