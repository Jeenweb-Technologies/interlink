const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const {
    sendMessage,
    markConversationRead,
    toggleMessageReaction
} = require("./models/chatModel.js");

let io = null;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: (origin, callback) => callback(null, true),
            credentials: true,
            methods: ["GET", "POST"]
        }
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
