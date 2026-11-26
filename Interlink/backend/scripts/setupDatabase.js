require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const bcrypt = require("bcryptjs");
const db = require("../config/db.js");

// Model Initializations
const { initCompanyModel } = require("../models/companyModel.js");
const { createDepartmentTables } = require("../models/departmentModel.js");
const { initUserModel } = require("../models/userModel.js");
const { createUserTypesTable, createUserTypePermissionsTable } = require("../models/userTypeModel.js");
const { createAuditLogsTable } = require("../models/auditLogModel.js");
const { createUserDevicesTable } = require("../models/deviceModel.js");
const { createTaskTables } = require("../models/taskModel.js");
const { createProjectTables } = require("../models/projectModel.js");
const { createChatTables } = require("../models/chatModel.js");
const { createNoteTables } = require("../models/noteModel.js");
const { createMeetingTables } = require("../models/meetingModel.js");
const { initAttendanceTables } = require("../models/attendanceModel.js");
const { initTimesheetTables } = require("../models/timesheetModel.js");
const { initCalendarTables } = require("../models/calendarModel.js");
const { initReminderTables } = require("../models/reminderModel.js");

async function setupDatabase() {
    console.log("==========================================================");
    console.log("  INTERLINK DATABASE INITIALIZATION & SEEDING SCRIPT");
    console.log("==========================================================\n");

    try {
        console.log(`[1/5] Connecting to database '${process.env.DB_NAME || "interlink"}' at '${process.env.DB_HOST || "localhost"}'...`);
        const conn = await db.getConnection();
        conn.release();
        console.log("✅ MySQL Database connected successfully.\n");

        console.log("[2/5] Temporarily disabling foreign key checks for safe creation...");
        await db.execute("SET FOREIGN_KEY_CHECKS = 0;");

        console.log("[3/5] Creating all application tables in dependency order...");
        
        // Step 1: Core Users & Authentication
        process.stdout.write("  -> Creating Users table... ");
        await initUserModel();
        console.log("DONE");

        // Step 2: Organizations, Companies & Junction
        process.stdout.write("  -> Creating Organizations & Companies tables... ");
        await initCompanyModel();
        console.log("DONE");

        // Step 3: User Types & Granular Permissions
        process.stdout.write("  -> Creating User Types & Permissions tables... ");
        await createUserTypesTable();
        await createUserTypePermissionsTable();
        console.log("DONE");

        // Step 4: Departments & Multi-Department Allocation
        process.stdout.write("  -> Creating Departments & Allocation tables... ");
        await createDepartmentTables();
        console.log("DONE");

        // Step 5: Audit Logging & Device Approval
        process.stdout.write("  -> Creating Audit Logs & Device Approval tables... ");
        await createAuditLogsTable();
        await createUserDevicesTable();
        console.log("DONE");

        // Step 6: Workspace & Collaboration (Projects, Tasks, Chat, Notes, Meetings)
        process.stdout.write("  -> Creating Projects tables... ");
        await createProjectTables();
        console.log("DONE");

        process.stdout.write("  -> Creating Tasks tables... ");
        await createTaskTables();
        console.log("DONE");

        process.stdout.write("  -> Creating Chat & Channels tables... ");
        await createChatTables();
        console.log("DONE");

        process.stdout.write("  -> Creating Notes tables... ");
        await createNoteTables();
        console.log("DONE");

        process.stdout.write("  -> Creating Meetings & Whiteboard tables... ");
        await createMeetingTables();
        console.log("DONE");

        // Step 7: Operations & HR (Attendance, Timesheets, Calendar, Reminders)
        process.stdout.write("  -> Creating Attendance tables... ");
        await initAttendanceTables();
        console.log("DONE");

        process.stdout.write("  -> Creating Timesheets tables... ");
        await initTimesheetTables();
        console.log("DONE");

        process.stdout.write("  -> Creating Calendar tables... ");
        await initCalendarTables();
        console.log("DONE");

        process.stdout.write("  -> Creating Reminders tables... ");
        await initReminderTables();
        console.log("DONE");

        console.log("\n[4/5] Re-enabling foreign key checks...");
        await db.execute("SET FOREIGN_KEY_CHECKS = 1;");
        console.log("✅ Foreign key checks re-enabled.\n");

        console.log("[5/5] Seeding Developer and Administrator Accounts...");

        // Seed Developer / Platform Superadmin Account
        const devUsername = "developer";
        const devPassword = "developer123";
        const devEmail = "developer@interlink.com";
        const hashedDevPassword = await bcrypt.hash(devPassword, 10);

        const [devRows] = await db.execute("SELECT id FROM users WHERE username = ?", [devUsername]);
        if (devRows.length === 0) {
            await db.execute(`
                INSERT INTO users 
                    (name, username, email, password, role, organization_id, company_id, device_verification_required, active)
                VALUES 
                    ('Platform Developer', ?, ?, ?, 'super_admin', 1, 1, 0, 1)
            `, [devUsername, devEmail, hashedDevPassword]);
            console.log("  ✅ Platform Developer account seeded.");
        } else {
            // Update password & ensure super_admin role and active
            await db.execute(`
                UPDATE users 
                SET password = ?, role = 'super_admin', active = 1, device_verification_required = 0 
                WHERE username = ?
            `, [hashedDevPassword, devUsername]);
            console.log("  ℹ️ Platform Developer account updated with current credentials.");
        }

        // Seed Default Organization Administrator Account
        const adminUsername = "admin";
        const adminPassword = "admin123";
        const adminEmail = "admin@interlink.com";
        const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

        const [adminRows] = await db.execute("SELECT id FROM users WHERE username = ?", [adminUsername]);
        if (adminRows.length === 0) {
            await db.execute(`
                INSERT INTO users 
                    (name, username, email, password, role, organization_id, company_id, device_verification_required, active)
                VALUES 
                    ('Organization Admin', ?, ?, ?, 'admin', 1, 1, 0, 1)
            `, [adminUsername, adminEmail, hashedAdminPassword]);
            console.log("  ✅ Organization Admin account seeded.");
        } else {
            await db.execute(`
                UPDATE users 
                SET password = ?, role = 'admin', active = 1, device_verification_required = 0 
                WHERE username = ?
            `, [hashedAdminPassword, adminUsername]);
            console.log("  ℹ️ Organization Admin account updated with current credentials.");
        }

        // List all tables created in the database
        const [tables] = await db.execute("SHOW TABLES");
        const tableNames = tables.map(t => Object.values(t)[0]);

        console.log("\n==========================================================");
        console.log("  ✅ DATABASE SETUP COMPLETED SUCCESSFULLY!");
        console.log("==========================================================");
        console.log(`  Total Tables Created (${tableNames.length}):`);
        console.log("  " + tableNames.join(", "));
        console.log("----------------------------------------------------------");
        console.log("  PLATFORM DEVELOPER CREDENTIALS (Developer Panel):");
        console.log(`  • URL      : https://interlink.jeenhost.in/developer`);
        console.log(`  • Username : ${devUsername}`);
        console.log(`  • Password : ${devPassword}`);
        console.log(`  • Role     : super_admin`);
        console.log("----------------------------------------------------------");
        console.log("  ORGANIZATION ADMIN CREDENTIALS (Tenant Admin):");
        console.log(`  • URL      : https://interlink.jeenhost.in/login`);
        console.log(`  • Username : ${adminUsername}`);
        console.log(`  • Password : ${adminPassword}`);
        console.log(`  • Role     : admin`);
        console.log("==========================================================\n");

        process.exit(0);
    } catch (err) {
        console.error("\n❌ Database setup failed with error:", err);
        try { await db.execute("SET FOREIGN_KEY_CHECKS = 1;"); } catch (_) {}
        process.exit(1);
    }
}

setupDatabase();
