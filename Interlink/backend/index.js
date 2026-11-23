require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const http = require("http");
const path = require("path");
const uploadConfig = require("./config/uploadConfig.js");
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


const app = express();

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) || allowedOrigins.includes(origin)) {
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


// Global 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack);
    res.status(500).json({ success: false, message: "Something went wrong" });
});

const startServer = async () => {
    try {
        await connectDB();

        console.log("Initializing database tables...");
        // Initialize tables in correct dependency order
        await initCompanyModel();
        await createDepartmentTables();
        await initUserModel();
        await createUserTypesTable();
        await createUserTypePermissionsTable();
        await createAuditLogsTable();
        await createUserDevicesTable();
        await createTaskTables();
        await createProjectTables();
        await createChatTables();

        console.log("All database tables are initialized and ready.");

        const PORT = process.env.PORT || 5000;
        const server = http.createServer(app);
        initSocket(server);

        server.listen(PORT, () => {
            console.log(`Server & Socket.IO Running on Port ${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start application server:", error);
        process.exit(1);
    }
};

startServer();