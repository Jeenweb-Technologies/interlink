/**
 * seedPeoplesDemo.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive demonstration seed script for PJ-17 Interlink.
 * Creates:
 *  - 3 Companies (Epoxy House India Main, Jeenweb Technologies, Delta Polymer)
 *  - 5 Departments (Sales, IT & Software, HR, Finance, Operations)
 *  - 6 User Type profiles
 *  - 10 User accounts with diverse chat scoping (all dept, own dept, custom, cross-company, vendor)
 *  - Department assignments (user_departments)
 *  - Company broadcast channels & team group chats with sample messages
 *
 * Password for all test users: Password123!
 * ─────────────────────────────────────────────────────────────────────────────
 */

const bcrypt = require("bcryptjs");
const db = require("../config/db.js");
const { createUsersTable } = require("../models/userModel.js");
const { createCompaniesTable } = require("../models/companyModel.js");
const { createDepartmentTables } = require("../models/departmentModel.js");
const { createConversationTables } = require("../models/conversationModel.js");
const { createMessageTables } = require("../models/messageModel.js");
const { createUserTypesTable } = require("../models/userTypeModel.js");

async function seed() {
    console.log("=================================================================");
    console.log("   PJ-17 INTERLINK: SEEDING PEOPLES & CHAT ARCHITECTURE DEMO     ");
    console.log("=================================================================");

    // 1. Initialize Tables
    console.log("1. Initializing & verifying database table schemas...");
    await createCompaniesTable();
    await createDepartmentTables();
    await createUserTypesTable();
    await createUsersTable();
    await createConversationTables();
    await createMessageTables();

    // 2. Seed Companies
    console.log("\n2. Seeding 3 Companies & Entities...");
    const companiesData = [
        {
            company_name: "Epoxy House India Pvt Ltd",
            company_code: "EHIPL",
            legal_name: "Epoxy House India Private Limited",
            tax_id: "24AAACE1234F1Z5",
            email: "contact@epoxyhouse.in",
            phone: "+91 98250 11001",
            website: "https://epoxyhouse.in",
            address: "Plot 102, GIDC Industrial Estate, Makarpura",
            city: "Vadodara",
            state: "Gujarat",
            country: "India",
            postal_code: "390010",
            industry: "Chemical & Resins Manufacturing",
            description: "Main flagship industrial manufacturing & electrical insulation division.",
            is_main: 1,
            status: "ACTIVE"
        },
        {
            company_name: "Jeenweb Technologies Pvt Ltd",
            company_code: "JWTECH",
            legal_name: "Jeenweb Technologies Private Limited",
            tax_id: "24BBBCJ5678K1Z2",
            email: "hello@jeenweb.com",
            phone: "+91 98790 22002",
            website: "https://jeenweb.com",
            address: "Alpha Commercial Hub, SG Highway",
            city: "Ahmedabad",
            state: "Gujarat",
            country: "India",
            postal_code: "380054",
            industry: "Software & Digital Cloud Engineering",
            description: "Digital engineering, enterprise cloud solutions & IT systems sister company.",
            is_main: 0,
            status: "ACTIVE"
        },
        {
            company_name: "Delta Polymer Solutions",
            company_code: "DELTAPOLY",
            legal_name: "Delta Polymer Solutions LLP",
            tax_id: "27CCCDP9012L1Z9",
            email: "info@deltapolymer.com",
            phone: "+91 99090 33003",
            website: "https://deltapolymer.com",
            address: "Western Logistics Park, Andheri East",
            city: "Mumbai",
            state: "Maharashtra",
            country: "India",
            postal_code: "400069",
            industry: "Logistics, Supply Chain & Raw Polymers",
            description: "Raw material polymers supply, distribution and warehousing sister enterprise.",
            is_main: 0,
            status: "ACTIVE"
        }
    ];

    const companyMap = {};
    for (const c of companiesData) {
        const [existing] = await db.execute("SELECT id FROM companies WHERE company_code = ? OR company_name = ?", [c.company_code, c.company_name]);
        if (existing.length > 0) {
            companyMap[c.company_code] = existing[0].id;
            await db.execute(
                `UPDATE companies SET company_name=?, legal_name=?, tax_id=?, email=?, phone=?, address=?, city=?, state=?, country=?, postal_code=?, industry=?, description=?, is_main=?, status=? WHERE id=?`,
                [c.company_name, c.legal_name, c.tax_id, c.email, c.phone, c.address, c.city, c.state, c.country, c.postal_code, c.industry, c.description, c.is_main, c.status, existing[0].id]
            );
            console.log(`   [UPDATED] Company: ${c.company_name} (ID: ${existing[0].id})`);
        } else {
            const [res] = await db.execute(
                `INSERT INTO companies (company_name, company_code, legal_name, tax_id, email, phone, website, address, city, state, country, postal_code, industry, description, is_main, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [c.company_name, c.company_code, c.legal_name, c.tax_id, c.email, c.phone, c.website, c.address, c.city, c.state, c.country, c.postal_code, c.industry, c.description, c.is_main, c.status]
            );
            companyMap[c.company_code] = res.insertId;
            console.log(`   [CREATED] Company: ${c.company_name} (ID: ${res.insertId})`);
        }
    }

    // 3. Seed Departments
    console.log("\n3. Seeding 5 Organizational Departments...");
    const deptsData = [
        {
            department_name: "Sales & Commercial",
            company_id: companyMap["EHIPL"],
            description: "Direct enterprise sales, quotations, client relationships & bids.",
            status: "ACTIVE"
        },
        {
            department_name: "IT & Software Engineering",
            company_id: companyMap["EHIPL"],
            description: "Architecture, ERP systems, internal communications & software infrastructure.",
            status: "ACTIVE"
        },
        {
            department_name: "Human Resources & Talent",
            company_id: companyMap["EHIPL"],
            description: "Recruitment, organizational policy, team welfare & compliance.",
            status: "ACTIVE"
        },
        {
            department_name: "Finance, Audit & Accounts",
            company_id: companyMap["JWTECH"],
            description: "Financial modeling, ledger auditing, tax compliance & reporting.",
            status: "ACTIVE"
        },
        {
            department_name: "Operations & Supply Chain",
            company_id: companyMap["DELTAPOLY"],
            description: "Warehouse logistics, inventory tracking, raw polymer procurement.",
            status: "ACTIVE"
        }
    ];

    const deptMap = {};
    for (const d of deptsData) {
        const [existing] = await db.execute(
            "SELECT id FROM departments WHERE department_name = ? AND company_id = ?",
            [d.department_name, d.company_id]
        );
        if (existing.length > 0) {
            deptMap[d.department_name] = existing[0].id;
            await db.execute(
                "UPDATE departments SET description = ?, status = ? WHERE id = ?",
                [d.description, d.status, existing[0].id]
            );
            console.log(`   [UPDATED] Dept: ${d.department_name} (ID: ${existing[0].id})`);
        } else {
            const [res] = await db.execute(
                "INSERT INTO departments (company_id, department_name, description, status) VALUES (?, ?, ?, ?)",
                [d.company_id, d.department_name, d.description, d.status]
            );
            deptMap[d.department_name] = res.insertId;
            console.log(`   [CREATED] Dept: ${d.department_name} (ID: ${res.insertId})`);
        }
    }

    // 4. Seed User Types
    console.log("\n4. Ensuring User Type Profiles...");
    const userTypesData = [
        { name: "Super Administrator", is_vendor: false },
        { name: "Executive Manager", is_vendor: false },
        { name: "Software Engineer", is_vendor: false },
        { name: "Sales Specialist", is_vendor: false },
        { name: "HR Manager", is_vendor: false },
        { name: "External Vendor Partner", is_vendor: true }
    ];

    const userTypeMap = {};
    for (const ut of userTypesData) {
        const [existing] = await db.execute(
            "SELECT id FROM user_types WHERE name = ? OR type_name = ?",
            [ut.name, ut.name]
        );
        if (existing.length > 0) {
            userTypeMap[ut.name] = existing[0].id;
        } else {
            const [res] = await db.execute(
                "INSERT INTO user_types (name, type_name, added_by, is_vendor) VALUES (?, ?, 1, ?)",
                [ut.name, ut.name, ut.is_vendor ? 1 : 0]
            );
            userTypeMap[ut.name] = res.insertId;
        }
    }

    // 5. Seed 10 Users with Diverse Chat Governance
    console.log("\n5. Seeding 10 User Accounts with Diverse Governance (Password: Password123!)...");
    const salt = await bcrypt.genSalt(10);
    const sharedPasswordHash = await bcrypt.hash("Password123!", salt);

    const usersData = [
        {
            name: "System Superadmin",
            username: "superadmin",
            email: "admin@epoxyhouse.in",
            role: "admin",
            user_type_name: "Super Administrator",
            mob_no: "+91 98000 00001",
            company_id: companyMap["EHIPL"],
            primary_dept: "IT & Software Engineering",
            dept_role: "ADMIN",
            can_chat_all_departments: true,
            allowed_chat_departments: null,
            can_chat_all_companies: true,
            allowed_chat_companies: null,
            is_vendor: false,
            can_chat_with_vendors: true
        },
        {
            name: "Raj Patel",
            username: "raj.patel",
            email: "raj.patel@epoxyhouse.in",
            role: "admin",
            user_type_name: "Software Engineer",
            mob_no: "+91 98000 00002",
            company_id: companyMap["EHIPL"],
            primary_dept: "IT & Software Engineering",
            dept_role: "ADMIN",
            can_chat_all_departments: true,
            allowed_chat_departments: null,
            can_chat_all_companies: true,
            allowed_chat_companies: null,
            is_vendor: false,
            can_chat_with_vendors: true
        },
        {
            name: "Nakul Sharma",
            username: "nakul.sharma",
            email: "nakul.sharma@epoxyhouse.in",
            role: "user",
            user_type_name: "Sales Specialist",
            mob_no: "+91 98000 00003",
            company_id: companyMap["EHIPL"],
            primary_dept: "Sales & Commercial",
            dept_role: "USER",
            can_chat_all_departments: false, // Scoped to own department only
            allowed_chat_departments: null,
            can_chat_all_companies: false,
            allowed_chat_companies: null,
            is_vendor: false,
            can_chat_with_vendors: false
        },
        {
            name: "Tanmay Shah",
            username: "tanmay.shah",
            email: "tanmay.shah@epoxyhouse.in",
            role: "user",
            user_type_name: "Sales Specialist",
            mob_no: "+91 98000 00004",
            company_id: companyMap["EHIPL"],
            primary_dept: "Sales & Commercial",
            dept_role: "ADMIN",
            can_chat_all_departments: false,
            allowed_chat_departments: [deptMap["Sales & Commercial"], deptMap["IT & Software Engineering"]], // Custom depts
            can_chat_all_companies: false,
            allowed_chat_companies: null,
            is_vendor: false,
            can_chat_with_vendors: false
        },
        {
            name: "Pooja Verma",
            username: "pooja.verma",
            email: "pooja.verma@epoxyhouse.in",
            role: "user",
            user_type_name: "HR Manager",
            mob_no: "+91 98000 00005",
            company_id: companyMap["EHIPL"],
            primary_dept: "Human Resources & Talent",
            dept_role: "ADMIN",
            can_chat_all_departments: true, // HR can reach all departments in company
            allowed_chat_departments: null,
            can_chat_all_companies: false,
            allowed_chat_companies: null,
            is_vendor: false,
            can_chat_with_vendors: false
        },
        {
            name: "Amit Joshi",
            username: "amit.joshi",
            email: "amit.joshi@jeenweb.com",
            role: "user",
            user_type_name: "Executive Manager",
            mob_no: "+91 98000 00006",
            company_id: companyMap["JWTECH"],
            primary_dept: "Finance, Audit & Accounts",
            dept_role: "ADMIN",
            can_chat_all_departments: true,
            allowed_chat_departments: null,
            can_chat_all_companies: true, // Cross-company enabled
            allowed_chat_companies: null,
            is_vendor: false,
            can_chat_with_vendors: false
        },
        {
            name: "Neha Kulkarni",
            username: "neha.kulkarni",
            email: "neha.kulkarni@jeenweb.com",
            role: "user",
            user_type_name: "Executive Manager",
            mob_no: "+91 98000 00007",
            company_id: companyMap["JWTECH"],
            primary_dept: "Finance, Audit & Accounts",
            dept_role: "USER",
            can_chat_all_departments: false,
            allowed_chat_departments: null,
            can_chat_all_companies: false,
            allowed_chat_companies: null,
            is_vendor: false,
            can_chat_with_vendors: false
        },
        {
            name: "Suresh Kumar",
            username: "suresh.kumar",
            email: "suresh.kumar@deltapolymer.com",
            role: "user",
            user_type_name: "Executive Manager",
            mob_no: "+91 98000 00008",
            company_id: companyMap["DELTAPOLY"],
            primary_dept: "Operations & Supply Chain",
            dept_role: "USER",
            can_chat_all_departments: false,
            allowed_chat_departments: null,
            can_chat_all_companies: false,
            allowed_chat_companies: null,
            is_vendor: false,
            can_chat_with_vendors: false
        },
        {
            name: "Vikram Malhotra",
            username: "vikram.malhotra",
            email: "vikram.malhotra@deltapolymer.com",
            role: "user",
            user_type_name: "Executive Manager",
            mob_no: "+91 98000 00009",
            company_id: companyMap["DELTAPOLY"],
            primary_dept: "Operations & Supply Chain",
            dept_role: "ADMIN",
            can_chat_all_departments: true,
            allowed_chat_departments: null,
            can_chat_all_companies: true,
            allowed_chat_companies: null,
            is_vendor: false,
            can_chat_with_vendors: true // Allowed to negotiate with vendor accounts
        },
        {
            name: "Global Resin Partner (Vendor)",
            username: "resin.vendor",
            email: "orders@resinchemical.com",
            role: "user",
            user_type_name: "External Vendor Partner",
            mob_no: "+91 98000 00010",
            company_id: companyMap["DELTAPOLY"],
            primary_dept: "Operations & Supply Chain",
            dept_role: "USER",
            can_chat_all_departments: false,
            allowed_chat_departments: null,
            can_chat_all_companies: false,
            allowed_chat_companies: null,
            is_vendor: true, // Flagged as external vendor
            can_chat_with_vendors: false
        }
    ];

    const userMap = {};
    for (const u of usersData) {
        const utId = userTypeMap[u.user_type_name] || null;
        const [existing] = await db.execute("SELECT id FROM users WHERE username = ? OR email = ?", [u.username, u.email]);
        let uid;
        if (existing.length > 0) {
            uid = existing[0].id;
            userMap[u.username] = uid;
            await db.execute(
                `UPDATE users SET 
                    name = ?, full_name = ?, password = ?, password_hash = ?, role = ?, user_type_id = ?, 
                    mob_no = ?, company_id = ?, can_chat_all_departments = ?, allowed_chat_departments = ?, 
                    can_chat_all_companies = ?, allowed_chat_companies = ?, is_vendor = ?, can_chat_with_vendors = ?, 
                    active = 1, is_active = 1, device_verification_required = 0 
                 WHERE id = ?`,
                [
                    u.name, u.name, sharedPasswordHash, sharedPasswordHash, u.role, utId,
                    u.mob_no, u.company_id, u.can_chat_all_departments ? 1 : 0, u.allowed_chat_departments ? JSON.stringify(u.allowed_chat_departments) : null,
                    u.can_chat_all_companies ? 1 : 0, u.allowed_chat_companies ? JSON.stringify(u.allowed_chat_companies) : null,
                    u.is_vendor ? 1 : 0, u.can_chat_with_vendors ? 1 : 0, uid
                ]
            );
            console.log(`   [UPDATED] User: ${u.name} (@${u.username}) -> ID: ${uid}`);
        } else {
            const [res] = await db.execute(
                `INSERT INTO users (
                    name, full_name, username, email, password, password_hash, role, user_type_id, 
                    mob_no, company_id, can_chat_all_departments, allowed_chat_departments, 
                    can_chat_all_companies, allowed_chat_companies, is_vendor, can_chat_with_vendors, 
                    active, is_active, device_verification_required, date_of_join
                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, CURDATE())`,
                [
                    u.name, u.name, u.username, u.email, sharedPasswordHash, sharedPasswordHash, u.role, utId,
                    u.mob_no, u.company_id, u.can_chat_all_departments ? 1 : 0, u.allowed_chat_departments ? JSON.stringify(u.allowed_chat_departments) : null,
                    u.can_chat_all_companies ? 1 : 0, u.allowed_chat_companies ? JSON.stringify(u.allowed_chat_companies) : null,
                    u.is_vendor ? 1 : 0, u.can_chat_with_vendors ? 1 : 0
                ]
            );
            uid = res.insertId;
            userMap[u.username] = uid;
            console.log(`   [CREATED] User: ${u.name} (@${u.username}) -> ID: ${uid}`);
        }

        // Link user to primary department
        const targetDeptId = deptMap[u.primary_dept];
        if (targetDeptId) {
            const [link] = await db.execute(
                "SELECT id FROM user_departments WHERE user_id = ? AND department_id = ?",
                [uid, targetDeptId]
            );
            if (link.length === 0) {
                await db.execute(
                    "INSERT INTO user_departments (user_id, department_id, department_role) VALUES (?, ?, ?)",
                    [uid, targetDeptId, u.dept_role]
                );
            } else {
                await db.execute(
                    "UPDATE user_departments SET department_role = ? WHERE id = ?",
                    [u.dept_role, link[0].id]
                );
            }
        }
    }

    // 6. Seed Company Broadcast Channels
    console.log("\n6. Seeding Official Company Broadcast Channels...");
    const broadcasts = [
        {
            code: "EHIPL",
            title: "Epoxy House Official Broadcast",
            desc: "Company-wide official announcements and updates for Epoxy House India.",
            company_id: companyMap["EHIPL"]
        },
        {
            code: "JWTECH",
            title: "Jeenweb Technologies Official Broadcast",
            desc: "Engineering updates, server deployments and company notices for Jeenweb.",
            company_id: companyMap["JWTECH"]
        },
        {
            code: "DELTAPOLY",
            title: "Delta Polymer Official Broadcast",
            desc: "Supply chain alerts, shipping schedules and warehouse notices.",
            company_id: companyMap["DELTAPOLY"]
        }
    ];

    for (const b of broadcasts) {
        let convId;
        const [existing] = await db.execute(
            "SELECT id FROM conversations WHERE company_id = ? AND is_company_broadcast = 1",
            [b.company_id]
        );
        if (existing.length > 0) {
            convId = existing[0].id;
        } else {
            const [cRes] = await db.execute(
                `INSERT INTO conversations (type, title, description, created_by, is_announcement, is_company_broadcast, company_id, who_can_post, last_message_text, last_message_at)
                 VALUES ('GROUP', ?, ?, ?, 1, 1, ?, 'ADMIN_ONLY', 'Welcome to the official company broadcast channel.', NOW())`,
                [b.title, b.desc, userMap["superadmin"], b.company_id]
            );
            convId = cRes.insertId;
        }

        // Add company users to this broadcast
        const [compUsers] = await db.execute("SELECT id FROM users WHERE company_id = ?", [b.company_id]);
        for (const cu of compUsers) {
            const [mEx] = await db.execute(
                "SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
                [convId, cu.id]
            );
            const isAdm = cu.id === userMap["superadmin"] || cu.id === userMap["raj.patel"];
            if (mEx.length === 0) {
                await db.execute(
                    "INSERT INTO conversation_members (conversation_id, user_id, role, can_post) VALUES (?, ?, ?, ?)",
                    [convId, cu.id, isAdm ? "ADMIN" : "MEMBER", isAdm ? 1 : 0]
                );
            }
        }
        console.log(`   [READY] Broadcast Channel: "${b.title}" (ID: ${convId}) with ${compUsers.length} members`);
    }

    // 7. Seed Team Channel: IT & Engineering Sprint
    console.log("\n7. Seeding Team Channel (IT & Engineering Sprint)...");
    const sprintMembers = [userMap["superadmin"], userMap["raj.patel"], userMap["tanmay.shah"], userMap["amit.joshi"]];
    let sprintConvId;
    const [existingSprint] = await db.execute("SELECT id FROM conversations WHERE title = 'IT & Engineering Sprint'");
    if (existingSprint.length > 0) {
        sprintConvId = existingSprint[0].id;
    } else {
        const [spRes] = await db.execute(
            `INSERT INTO conversations (type, title, description, created_by, who_can_post, last_message_text, last_message_at)
             VALUES ('GROUP', 'IT & Engineering Sprint', 'Cross-department software architecture & release planning.', ?, 'ALL_MEMBERS', 'Sprint 17 kick-off meeting completed successfully.', NOW())`,
            [userMap["raj.patel"]]
        );
        sprintConvId = spRes.insertId;
    }

    for (const uid of sprintMembers) {
        const [mEx] = await db.execute(
            "SELECT id FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
            [sprintConvId, uid]
        );
        if (mEx.length === 0) {
            await db.execute(
                "INSERT INTO conversation_members (conversation_id, user_id, role, can_post) VALUES (?, ?, ?, 1)",
                [sprintConvId, uid, uid === userMap["raj.patel"] ? "ADMIN" : "MEMBER"]
            );
        }
    }

    // Insert sample message in sprint channel if empty
    const [sprintMsgs] = await db.execute("SELECT id FROM messages WHERE conversation_id = ?", [sprintConvId]);
    if (sprintMsgs.length === 0) {
        await db.execute(
            "INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, 'TEXT', ?)",
            [sprintConvId, userMap["raj.patel"], "Team, welcome to the PJ-17 Interlink engineering workspace!"]
        );
        await db.execute(
            "INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, 'TEXT', ?)",
            [sprintConvId, userMap["amit.joshi"], "Great to connect cross-company from Jeenweb Tech. Looking forward to our release."]
        );
    }
    console.log(`   [READY] Team Channel: "IT & Engineering Sprint" (ID: ${sprintConvId})`);

    // 8. Seed Direct Chat (Raj Patel <-> Nakul Sharma)
    console.log("\n8. Seeding Direct 1-on-1 Chats...");
    const [u1, u2] = [userMap["raj.patel"], userMap["nakul.sharma"]];
    const [dEx] = await db.execute(
        `SELECT c.id FROM conversations c
         JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
         JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
         WHERE c.type = 'DIRECT' LIMIT 1`,
        [u1, u2]
    );

    let directId;
    if (dEx.length > 0) {
        directId = dEx[0].id;
    } else {
        const [dRes] = await db.execute(
            `INSERT INTO conversations (type, created_by, who_can_post, last_message_text, last_message_at)
             VALUES ('DIRECT', ?, 'ALL_MEMBERS', 'Let me know once the client review is done.', NOW())`,
            [u1]
        );
        directId = dRes.insertId;
        await db.execute("INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, 'MEMBER')", [directId, u1]);
        await db.execute("INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, 'MEMBER')", [directId, u2]);

        await db.execute(
            "INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, 'TEXT', ?)",
            [directId, u1, "Hey Nakul, how are the enterprise quotation numbers looking?"]
        );
        await db.execute(
            "INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, 'TEXT', ?)",
            [directId, u2, "Hi Raj! Just finished preparing the resin schedule. Will send it over shortly."]
        );
    }
    console.log(`   [READY] Direct Chat: Raj Patel <-> Nakul Sharma (ID: ${directId})`);

    // 9. Seed Direct Chat (Vikram Malhotra <-> External Vendor Partner)
    const [v1, v2] = [userMap["vikram.malhotra"], userMap["resin.vendor"]];
    const [vEx] = await db.execute(
        `SELECT c.id FROM conversations c
         JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
         JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
         WHERE c.type = 'DIRECT' LIMIT 1`,
        [v1, v2]
    );

    let vendorDirectId;
    if (vEx.length > 0) {
        vendorDirectId = vEx[0].id;
    } else {
        const [vRes] = await db.execute(
            `INSERT INTO conversations (type, created_by, who_can_post, last_message_text, last_message_at)
             VALUES ('DIRECT', ?, 'ALL_MEMBERS', 'Order dispatched via Mumbai transport hub.', NOW())`,
            [v1]
        );
        vendorDirectId = vRes.insertId;
        await db.execute("INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, 'MEMBER')", [vendorDirectId, v1]);
        await db.execute("INSERT INTO conversation_members (conversation_id, user_id, role) VALUES (?, ?, 'MEMBER')", [vendorDirectId, v2]);

        await db.execute(
            "INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, 'TEXT', ?)",
            [vendorDirectId, v1, "Hello Global Resin Partner, can you confirm dispatch for batch DP-44?"]
        );
        await db.execute(
            "INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, 'TEXT', ?)",
            [vendorDirectId, v2, "Order dispatched via Mumbai transport hub. Docket will be shared in an hour."]
        );
    }
    console.log(`   [READY] Vendor Partner Chat: Vikram Malhotra <-> Resin Partner (ID: ${vendorDirectId})`);

    console.log("\n=================================================================");
    console.log("   DEMO SEEDING COMPLETED SUCCESSFULLY!                         ");
    console.log("=================================================================");
    console.log("Summary of Seeded Users (Password: Password123!):");
    console.log("  1. superadmin     - Epoxy House (IT) - Super Admin / All Scopes");
    console.log("  2. raj.patel      - Epoxy House (IT) - Admin / All Scopes");
    console.log("  3. nakul.sharma   - Epoxy House (Sales) - Own Dept Only");
    console.log("  4. tanmay.shah    - Epoxy House (Sales) - Custom Dept (Sales + IT)");
    console.log("  5. pooja.verma    - Epoxy House (HR) - All Depts (Own Company)");
    console.log("  6. amit.joshi     - Jeenweb Tech (Finance) - Cross-Company Enabled");
    console.log("  7. neha.kulkarni  - Jeenweb Tech (Finance) - Own Company Only");
    console.log("  8. suresh.kumar   - Delta Polymer (Operations) - Restricted");
    console.log("  9. vikram.malhotra- Delta Polymer (Operations) - Can Chat with Vendors");
    console.log("  10. resin.vendor  - Delta Polymer (Vendor) - External Partner Pill");
    console.log("=================================================================\n");

    process.exit(0);
}

seed().catch((err) => {
    console.error("FATAL: Seeding error:", err);
    process.exit(1);
});
