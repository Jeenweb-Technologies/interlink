require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const http = require("http");
const path = require("path");
const uploadConfig = require("./config/uploadConfig.js");
const db = require("./config/db.js");
const { connectDB } = require("./config/db.js");
const { initSocket } = require("./socket.js");

// Routes
const authRoutes = require("./routes/authRoutes.js");
const companyRoutes = require("./routes/companyRoutes.js");
const superadminRoutes = require("./routes/superadminRoutes.js");
const adminRoutes = require("./routes/adminRoutes.js");
const userTypeMasterRoutes = require("./routes/userTypeMasterRoutes.js");
const taskRoutes = require("./routes/taskRoutes.js");
const projectRoutes = require("./routes/projectRoutes.js");
const searchRoutes = require("./routes/searchRoutes.js");
const departmentRoutes = require("./routes/departmentRoutes.js");
const chatRoutes = require("./routes/chatRoutes.js");
const noteRoutes = require("./routes/noteRoutes.js");
const meetingRoutes = require("./routes/meetingRoutes.js");
const attendanceRoutes = require("./routes/attendanceRoutes.js");
const timesheetRoutes = require("./routes/timesheetRoutes.js");
const calendarRoutes = require("./routes/calendarRoutes.js");
const reminderRoutes = require("./routes/reminderRoutes.js");

// Model Initializations
const { initCompanyModel } = require("./models/companyModel.js");
const { createDepartmentTables } = require("./models/departmentModel.js");
const { initUserModel } = require("./models/userModel.js");
const { createUserTypesTable, createUserTypePermissionsTable } = require("./models/userTypeModel.js");
const { createAuditLogsTable } = require("./models/auditLogModel.js");
const { createUserDevicesTable } = require("./models/deviceModel.js");
const { createTaskTables } = require("./models/taskModel.js");
const { createProjectTables } = require("./models/projectModel.js");
const { createChatTables } = require("./models/chatModel.js");
const { createNoteTables } = require("./models/noteModel.js");
const { createMeetingTables } = require("./models/meetingModel.js");
const { initAttendanceTables } = require("./models/attendanceModel.js");
const { initTimesheetTables } = require("./models/timesheetModel.js");
const { initCalendarTables } = require("./models/calendarModel.js");
const { initReminderTables } = require("./models/reminderModel.js");
const { startReminderDaemon } = require("./services/reminderDaemon.js");


const app = express();

const allowedOrigins = [
    "https://interlink.jeenhost.in",
    "http://interlink.jeenhost.in",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/+$/, "");
        const allowedClean = allowedOrigins.map(o => o.replace(/\/+$/, ""));
        if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin) || allowedClean.includes(cleanOrigin)) {
            return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-HTTP-Method-Override", "x-device-id", "device-id", "x-company-id", "company-id"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
}));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded files statically if set to express
if (uploadConfig.serveMethod === "express") {
    console.log(`Serving uploaded files statically from: ${uploadConfig.uploadDir}`);
    app.use("/uploads", express.static(uploadConfig.uploadDir));
}

// HTTP Method Override middleware for environments that block PUT and DELETE requests
app.use((req, res, next) => {
    const methodOverride = req.headers['x-http-method-override'];
    if (req.method === 'POST' && methodOverride) {
        req.method = methodOverride.toUpperCase();
    }
    next();
});

// Initialize HTTP server & Socket.IO BEFORE routes and 404 handler
const server = http.createServer(app);
const io = initSocket(server, app);

// Health check and root endpoints for cPanel / Passenger / uptime probes
app.get(["/", "/api", "/api/health", "/health"], (req, res) => {
    res.status(200).json({
        success: true,
        status: "ok",
        message: "Interlink API is running",
        timestamp: new Date().toISOString()
    });
});

app.use(["/api/auth", "/auth"], authRoutes);
app.use(["/api/companies", "/companies"], companyRoutes);
app.use(["/api/superadmin", "/superadmin"], superadminRoutes);
app.use(["/api/admin", "/admin"], adminRoutes);
app.use(["/api/usertypes", "/usertypes"], userTypeMasterRoutes);
app.use(["/api/tasks", "/tasks"], taskRoutes);
app.use(["/api/projects", "/projects"], projectRoutes);
app.use(["/api/search", "/search"], searchRoutes);
app.use(["/api/departments", "/departments", "/api/admin/departments", "/admin/departments"], departmentRoutes);
app.use(["/api/chat", "/chat"], chatRoutes);
app.use(["/api/notes", "/notes"], noteRoutes);
app.use(["/api/meetings", "/meetings"], meetingRoutes);
app.use(["/api/attendance", "/attendance"], attendanceRoutes);
app.use(["/api/timesheets", "/timesheets"], timesheetRoutes);
app.use(["/api/calendar", "/calendar"], calendarRoutes);
app.use(["/api/reminders", "/reminders"], reminderRoutes);


// Global 404 handler (must remain after all routes and Socket.IO handler)
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack);
    res.status(500).json({ success: false, message: "Something went wrong" });
});

const startServer = () => {
    try {
        const PORT = process.env.PORT || 5000;

        server.listen(PORT, () => {
            console.log(`Server & Socket.IO Running on Port ${PORT}`);

            // Asynchronously initialize database tables once server is listening
            (async () => {
                try {
                    const isConnected = await connectDB();
                    if (isConnected) {
                        console.log("Initializing database tables with safe foreign key checks...");
                        await db.execute("SET FOREIGN_KEY_CHECKS = 0");

                        // 1. Core Users table - MUST BE INITIALIZED FIRST so foreign keys resolve
                        await initUserModel();

                        // 2. Base Organization & Companies tables (organizations, companies, user_companies)
                        await initCompanyModel();

                        // 3. User Types & Permissions (user_types, user_type_permissions)
                        await createUserTypesTable();
                        await createUserTypePermissionsTable();

                        // 4. Departments & User-Departments Junction (departments, user_departments)
                        await createDepartmentTables();

                        // 5. System Devices & Audit Logging (audit_logs, user_devices)
                        await createAuditLogsTable();
                        await createUserDevicesTable();

                        // 6. Collaboration & Workspaces (projects, tasks, chat, notes, meetings)
                        await createProjectTables();
                        await createTaskTables();
                        await createChatTables();
                        await createNoteTables();
                        await createMeetingTables();

                        // 7. Operations & HR (attendance, timesheets, calendar, reminders)
                        await initAttendanceTables();
                        await initTimesheetTables();
                        await initCalendarTables();
                        await initReminderTables();

                        await db.execute("SET FOREIGN_KEY_CHECKS = 1");
                        console.log("All database tables are initialized and ready.");

                        // Start background reminder scheduler ONLY after database tables are ready
                        startReminderDaemon(io);
                    } else {
                        console.warn("[Database] Could not connect to MySQL on boot. Please verify database credentials in .env");
                    }
                } catch (dbInitErr) {
                    console.error("Database initialization warning:", dbInitErr.message);
                    try { await db.execute("SET FOREIGN_KEY_CHECKS = 1"); } catch (_) {}
                }
            })();
        });
    } catch (error) {
        console.error("Failed to start application server:", error);
    }
};

startServer();