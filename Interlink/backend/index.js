require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const uploadConfig = require("./config/uploadConfig.js");
const { connectDB, db } = require("./config/db.js");

// Routes
const authRoutes = require("./routes/authRoutes.js");
const companyRoutes = require("./routes/companyRoutes.js");
const superadminRoutes = require("./routes/superadminRoutes.js");
const adminRoutes = require("./routes/adminRoutes.js");
const userTypeMasterRoutes = require("./routes/userTypeMasterRoutes.js");
const taskRoutes = require("./routes/taskRoutes.js");
const projectRoutes = require("./routes/projectRoutes.js");
const chatRoutes = require("./routes/chatRoutes.js");
const departmentRoutes = require("./routes/departmentRoutes.js");
const searchRoutes = require("./routes/searchRoutes.js");

// Model Initializations
const { initCompanyModel } = require("./models/companyModel.js");
const { initUserModel } = require("./models/userModel.js");
const { createCompaniesTable } = require("./models/companyModel.js");
const { createDepartmentTables } = require("./models/departmentModel.js");
const { createUserTypesTable, createUserTypePermissionsTable } = require("./models/userTypeModel.js");
const { createAuditLogsTable } = require("./models/auditLogModel.js");
const { createUserDevicesTable } = require("./models/deviceModel.js");
const { createSystemSettingsTable } = require("./models/systemSettingsModel.js");
const { 
    createConversationTables, 
    ensureActivityGroup, 
    ensureMasterAnnouncementGroup, 
    ensureCompanyBroadcasts, 
    findDirectConversation, 
    createDirectConversation 
} = require("./models/conversationModel.js");
const { createMessageTables, createMessage, getMessageById } = require("./models/messageModel.js");
const { createPollTables } = require("./models/pollModel.js");
const { createNotificationTables } = require("./models/notificationModel.js");
const { createTaskTables } = require("./models/taskModel.js");
const { createProjectTables } = require("./models/projectModel.js");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:4173",
    "http://localhost:3000",
    "https://crm.jasminmobile.com",
    "http://crm.jasminmobile.com",
    process.env.FRONTEND_URL
].filter(Boolean);

const corsOriginHandler = (origin, callback) => {
    if (!origin) return callback(null, true);
    try {
        if (
            allowedOrigins.includes(origin) ||
            /^http:\/\/localhost(:\d+)?$/.test(origin) ||
            /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
            /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
            /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/.test(origin)
        ) {
            return callback(null, true);
        }
    } catch (_) {}
    return callback(null, true);
};

const corsOptions = {
    origin: corsOriginHandler,
    credentials: true,
    allowedHeaders: [
        "Content-Type", 
        "Authorization", 
        "X-HTTP-Method-Override", 
        "x-device-id", 
        "device-id", 
        "x-company-id", 
        "company-id", 
        "Accept", 
        "Origin", 
        "X-Requested-With"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    optionsSuccessStatus: 200
};

// Universal CORS & Preflight handling
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    } else {
        res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-HTTP-Method-Override, x-device-id, device-id, x-company-id, company-id, Accept, Origin, X-Requested-With"
    );
    res.setHeader("Access-Control-Max-Age", "86400");

    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    next();
});

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
if (uploadConfig && uploadConfig.serveMethod === "express" && uploadConfig.uploadDir !== "uploads") {
    app.use("/uploads", express.static(uploadConfig.uploadDir));
}

// HTTP Method Override middleware
app.use((req, res, next) => {
    const methodOverride = req.headers['x-http-method-override'];
    if (req.method === 'POST' && methodOverride) {
        req.method = methodOverride.toUpperCase();
    }
    next();
});

// Socket.IO Setup
const io = new Server(server, {
    cors: {
        origin: corsOriginHandler,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
    },
    transports: ["websocket", "polling"],
    pingTimeout: 60000,
    pingInterval: 25000
});

app.set("io", io);

// Online Users & Call Sessions
const onlineUsers = new Map(); // userId -> Set(socketIds)
const activeCallSessions = new Map();
app.set("onlineUsers", onlineUsers);
app.set("activeCallSessions", activeCallSessions);

const pruneStaleCallSessions = (maxAgeMs = 60000) => {
    const now = Date.now();
    for (const [sockId, sess] of activeCallSessions.entries()) {
        if (!sess.createdAt || now - sess.createdAt > maxAgeMs) {
            activeCallSessions.delete(sockId);
        }
    }
};

const clearCallSessions = ({ callId, userId1, userId2, socketId } = {}) => {
    const targetCallId = callId || (socketId ? activeCallSessions.get(socketId)?.callId : null);
    const targetPeerId = userId2 || (socketId ? activeCallSessions.get(socketId)?.peerUserId : null);

    if (targetCallId) {
        for (const [sId, sess] of activeCallSessions.entries()) {
            if (sess.callId === targetCallId) {
                activeCallSessions.delete(sId);
            }
        }
    }
    if (socketId) activeCallSessions.delete(socketId);
    if (userId1) {
        const u1Sockets = onlineUsers.get(String(userId1));
        if (u1Sockets) {
            for (const sId of u1Sockets) activeCallSessions.delete(sId);
        }
    }
    if (targetPeerId) {
        const u2Sockets = onlineUsers.get(String(targetPeerId));
        if (u2Sockets) {
            for (const sId of u2Sockets) activeCallSessions.delete(sId);
        }
    }
};

const loggedCallIds = new Set();
const recordCallLog = async ({ callerUserId, receiverUserId, callType = "audio", status = "completed", duration = 0, callId }) => {
    try {
        if (!callerUserId || !receiverUserId) return;
        const cId = Number(callerUserId);
        const rId = Number(receiverUserId);
        if (!cId || !rId || cId === rId) return;

        if (callId) {
            if (loggedCallIds.has(callId)) return;
            loggedCallIds.add(callId);
            if (loggedCallIds.size > 2000) {
                const oldest = loggedCallIds.values().next().value;
                loggedCallIds.delete(oldest);
            }
        }

        let conv = await findDirectConversation(cId, rId);
        if (!conv) {
            conv = await createDirectConversation(cId, rId);
        }
        if (!conv?.id) return;

        const durSec = Math.max(0, parseInt(duration, 10) || 0);
        const isVideo = String(callType).toLowerCase() === "video";
        const formatDur = (s) => {
            const m = Math.floor(s / 60);
            const sec = s % 60;
            return `${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`;
        };

        let snippet = "";
        if (status === "completed") {
            snippet = isVideo ? `📹 Video call (${formatDur(durSec)})` : `📞 Voice call (${formatDur(durSec)})`;
        } else if (status === "declined") {
            snippet = isVideo ? `📹 Declined video call` : `📞 Declined voice call`;
        } else {
            snippet = isVideo ? `📹 Missed video call` : `📞 Missed voice call`;
        }

        const callPayload = {
            type: "call_log",
            callType: isVideo ? "video" : "audio",
            status,
            duration: durSec,
            callerId: cId,
            receiverId: rId,
            text: snippet
        };

        const newMsg = await createMessage({
            conversationId: conv.id,
            senderId: cId,
            content: JSON.stringify(callPayload),
            messageType: "CALL"
        });

        await db.execute(
            `UPDATE conversations SET last_message_text = ?, last_message_at = NOW() WHERE id = ?`,
            [snippet, conv.id]
        );

        const fullMsg = await getMessageById(newMsg.id);
        if (fullMsg) {
            fullMsg.call_details = callPayload;
            io.to(`conv_${conv.id}`).emit("message:new", fullMsg);
            io.to(`user_${cId}`).emit("message:new", fullMsg);
            io.to(`user_${rId}`).emit("message:new", fullMsg);
        }
    } catch (err) {
        console.error("Failed to record call log:", err.message);
    }
};

io.on("connection", (socket) => {
    let currentUserId = socket.handshake.query?.userId || socket.handshake.auth?.userId;

    const registerUser = (uid) => {
        if (!uid) return;
        const sUid = String(uid);
        socket.userId = sUid;
        currentUserId = sUid;
        if (!onlineUsers.has(sUid)) {
            onlineUsers.set(sUid, new Set());
        }
        onlineUsers.get(sUid).add(socket.id);
        socket.join(`user_${sUid}`);
        io.emit("users:online", Array.from(onlineUsers.keys()));
    };

    socket.emit("users:online", Array.from(onlineUsers.keys()));

    if (currentUserId) {
        registerUser(currentUserId);
    }

    socket.on("user:online", (uid) => registerUser(uid));
    socket.on("users:get_online", () => {
        socket.emit("users:online", Array.from(onlineUsers.keys()));
    });

    socket.on("user:offline", (uid) => {
        const sUid = String(uid || socket.userId || currentUserId || "");
        if (sUid && onlineUsers.has(sUid)) {
            onlineUsers.get(sUid).delete(socket.id);
            if (onlineUsers.get(sUid).size === 0) {
                onlineUsers.delete(sUid);
            }
            io.emit("users:online", Array.from(onlineUsers.keys()));
        }
    });

    socket.on("conversation:join", (conversationId) => {
        if (conversationId) socket.join(`conv_${conversationId}`);
    });

    socket.on("conversation:leave", (conversationId) => {
        if (conversationId) socket.leave(`conv_${conversationId}`);
    });

    socket.on("typing:start", ({ conversationId, userName, userId }) => {
        socket.to(`conv_${conversationId}`).emit("typing:start", { conversationId, userName, userId });
    });

    socket.on("typing:stop", ({ conversationId, userName, userId }) => {
        socket.to(`conv_${conversationId}`).emit("typing:stop", { conversationId, userName, userId });
    });

    // WebRTC Signaling
    socket.on("call:initiate", ({ toUserId, callType, callerInfo, callId }) => {
        pruneStaleCallSessions(60000);
        const sRecipientId = String(toUserId);
        const recipientSockets = onlineUsers.get(sRecipientId);

        if (!recipientSockets || recipientSockets.size === 0) {
            socket.emit("call:unavailable", { reason: "offline", toUserId, callId });
            recordCallLog({
                callerUserId: socket.userId,
                receiverUserId: toUserId,
                callType: callType || "audio",
                status: "missed",
                duration: 0,
                callId
            });
            return;
        }

        clearCallSessions({ socketId: socket.id, userId1: socket.userId });

        let isRecipientBusy = false;
        for (const rSockId of recipientSockets) {
            const sess = activeCallSessions.get(rSockId);
            if (sess) {
                const peerOnline = sess.peerUserId && onlineUsers.has(String(sess.peerUserId));
                if (peerOnline && Date.now() - (sess.createdAt || 0) < 60000) {
                    isRecipientBusy = true;
                    break;
                } else {
                    activeCallSessions.delete(rSockId);
                }
            }
        }
        if (isRecipientBusy) {
            socket.emit("call:unavailable", { reason: "busy", toUserId, callId });
            recordCallLog({
                callerUserId: socket.userId,
                receiverUserId: toUserId,
                callType: callType || "audio",
                status: "busy",
                duration: 0,
                callId
            });
            return;
        }

        const now = Date.now();
        activeCallSessions.set(socket.id, {
            peerUserId: sRecipientId,
            callerUserId: socket.userId,
            receiverUserId: sRecipientId,
            callId,
            callType: callType || "audio",
            createdAt: now,
            answeredAt: null
        });

        io.to(`user_${sRecipientId}`).emit("call:incoming", {
            callerUserId: socket.userId,
            callerSocketId: socket.id,
            callerInfo: callerInfo || { id: socket.userId },
            callType: callType || "audio",
            callId
        });
    });

    socket.on("call:ringing", ({ toUserId, callId }) => {
        io.to(`user_${String(toUserId)}`).emit("call:ringing", {
            fromUserId: socket.userId,
            callId
        });
    });

    socket.on("call:accept", ({ toUserId, callId, callType }) => {
        const sCallerId = String(toUserId);
        const now = Date.now();
        for (const sess of activeCallSessions.values()) {
            if (sess.callId === callId) sess.answeredAt = now;
        }
        activeCallSessions.set(socket.id, {
            peerUserId: sCallerId,
            callerUserId: sCallerId,
            receiverUserId: socket.userId,
            callId,
            callType: callType || "audio",
            createdAt: now,
            answeredAt: now
        });
        io.to(`user_${sCallerId}`).emit("call:accepted", {
            fromUserId: socket.userId,
            callId
        });
    });

    socket.on("call:signal", ({ toUserId, signal, callId }) => {
        if (!toUserId || !signal) return;
        io.to(`user_${String(toUserId)}`).emit("call:signal", {
            fromUserId: socket.userId,
            signal,
            callId
        });
    });

    socket.on("call:reject", ({ toUserId, reason, callId }) => {
        const session = activeCallSessions.get(socket.id) || Array.from(activeCallSessions.values()).find(s => s.callId === callId);
        const cUserId = session?.callerUserId || toUserId;
        const rUserId = session?.receiverUserId || socket.userId;
        const cType = session?.callType || "audio";
        const callStatus = reason === "busy" ? "busy" : (reason === "timeout" ? "missed" : "declined");

        recordCallLog({
            callerUserId: cUserId,
            receiverUserId: rUserId,
            callType: cType,
            status: callStatus,
            duration: 0,
            callId
        });

        const sCallerId = toUserId ? String(toUserId) : null;
        clearCallSessions({ callId, userId1: socket.userId, userId2: sCallerId, socketId: socket.id });
        if (sCallerId) {
            io.to(`user_${sCallerId}`).emit("call:rejected", {
                fromUserId: socket.userId,
                reason: reason || "declined",
                callId
            });
        }
    });

    socket.on("call:end", ({ toUserId, callId, duration }) => {
        const session = activeCallSessions.get(socket.id) || Array.from(activeCallSessions.values()).find(s => s.callId === callId);
        const targetPeerId = toUserId ? String(toUserId) : (session?.peerUserId ? String(session.peerUserId) : null);
        const targetCallId = callId || session?.callId;

        if (session) {
            const isAnswered = Boolean(session.answeredAt);
            const cUserId = session.callerUserId;
            const rUserId = session.receiverUserId || (String(session.callerUserId) === String(socket.userId) ? targetPeerId : socket.userId);
            const dur = isAnswered
                ? Math.max(parseInt(duration, 10) || 0, Math.round((Date.now() - session.answeredAt) / 1000))
                : 0;
            const callStatus = isAnswered ? "completed" : "missed";

            recordCallLog({
                callerUserId: cUserId,
                receiverUserId: rUserId,
                callType: session.callType || "audio",
                status: callStatus,
                duration: dur,
                callId: targetCallId
            });
        }

        clearCallSessions({ callId: targetCallId, userId1: socket.userId, userId2: targetPeerId, socketId: socket.id });
        if (targetPeerId) {
            io.to(`user_${targetPeerId}`).emit("call:ended", {
                fromUserId: socket.userId,
                callId: targetCallId
            });
        }
    });

    socket.on("disconnect", () => {
        if (activeCallSessions.has(socket.id)) {
            const session = activeCallSessions.get(socket.id);
            const targetPeerId = session?.peerUserId ? String(session.peerUserId) : null;
            const targetCallId = session?.callId;
            clearCallSessions({ callId: targetCallId, userId1: socket.userId, userId2: targetPeerId, socketId: socket.id });
            if (targetPeerId) {
                io.to(`user_${targetPeerId}`).emit("call:ended", {
                    fromUserId: socket.userId,
                    callId: targetCallId,
                    reason: "disconnected"
                });
            }
        }

        let changed = false;
        const sUid = socket.userId || currentUserId;
        if (sUid && onlineUsers.has(sUid)) {
            onlineUsers.get(sUid).delete(socket.id);
            if (onlineUsers.get(sUid).size === 0) {
                onlineUsers.delete(sUid);
            }
            changed = true;
        }

        for (const [uId, sockSet] of onlineUsers.entries()) {
            if (sockSet.has(socket.id)) {
                sockSet.delete(socket.id);
                if (sockSet.size === 0) {
                    onlineUsers.delete(uId);
                }
                changed = true;
            }
        }

        if (changed) {
            io.emit("users:online", Array.from(onlineUsers.keys()));
        }
    });
});

// App Endpoints
app.use(["/api/auth", "/auth"], authRoutes);
app.use(["/api/companies", "/companies"], companyRoutes);
app.use(["/api/superadmin", "/superadmin"], superadminRoutes);
app.use(["/api/admin", "/admin"], adminRoutes);
app.use(["/api/usertypes", "/usertypes", "/api/user-types", "/user-types"], userTypeMasterRoutes);
app.use(["/api/tasks", "/tasks"], taskRoutes);
app.use(["/api/projects", "/projects"], projectRoutes);
app.use(["/api/chat", "/chat"], chatRoutes);
app.use(["/api/admin/companies", "/api/companies", "/companies"], companyRoutes);
app.use(["/api/admin/departments", "/api/departments", "/departments"], departmentRoutes);
app.use(["/api/search", "/search"], searchRoutes);

// Global 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err.message);
    res.status(500).json({ success: false, message: err.message || "Something went wrong" });
});

const startServer = async () => {
    try {
        await connectDB();

        console.log("Initializing database tables...");
        // Initialize tables in correct dependency order
        await initCompanyModel();
        await initUserModel();
        await createCompaniesTable();
        await createDepartmentTables();
        await createUserTypesTable();
        await createUserTypePermissionsTable();
        await createAuditLogsTable();
        await createUserDevicesTable();
        await createSystemSettingsTable();
        await createConversationTables();
        await createMessageTables();
        await createPollTables();
        await createNotificationTables();
        await createTaskTables();
        await createProjectTables();

        // Seed system conversation channels
        await ensureActivityGroup();
        await ensureMasterAnnouncementGroup();
        await ensureCompanyBroadcasts();

        console.log("All database tables and channels are initialized and ready.");

        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () => {
            console.log(`Server & Socket.IO Running on Port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start application server:", error);
        process.exit(1);
    }
};

startServer();
