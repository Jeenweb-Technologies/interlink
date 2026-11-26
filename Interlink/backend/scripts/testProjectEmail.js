require('dotenv').config();
const db = require('../config/db');
const { sendProjectBroadcastEmail } = require('../services/emailService');

async function main() {
    console.log('==================================================');
    console.log('      INTERLINK PROJECT TEAM EMAIL TEST TOOL      ');
    console.log('==================================================');
    console.log(`Sender Account: ${process.env.SMTP_USER || 'interlinknoreply@gmail.com'}`);
    console.log('--------------------------------------------------');

    const projectIdArg = process.argv[2];

    let query = 'SELECT id, name, code, description FROM projects';
    let params = [];
    if (projectIdArg) {
        query += ' WHERE id = ?';
        params.push(projectIdArg);
    } else {
        query += ' ORDER BY id DESC LIMIT 1';
    }

    const [projects] = await db.execute(query, params);

    if (projects.length === 0) {
        console.error('❌ No projects found in the database. Create a project first!');
        process.exit(1);
    }

    const project = projects[0];
    console.log(`\nSelected Project: #${project.id} - ${project.name} (${project.code})`);

    // Fetch enrolled users from project_members
    const [members] = await db.execute(`
        SELECT pm.role, u.id as user_id, u.name, u.email
        FROM project_members pm
        JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = ?
    `, [project.id]);

    console.log(`Enrolled Members Count: ${members.length}`);

    if (members.length === 0) {
        console.warn('⚠️ No members are currently enrolled in this project.');
        console.log('You can enroll members by assigning users in the Project workspace.');
        process.exit(0);
    }

    console.log('\nList of Enrolled Users:');
    members.forEach((m, idx) => {
        console.log(`  [${idx + 1}] ${m.name} (${m.role}) - Email: ${m.email || '(NO EMAIL SET)'}`);
    });

    const validMembers = members.filter(m => m.email && m.email.trim() !== '');

    if (validMembers.length === 0) {
        console.warn('\n⚠️ None of the enrolled members have a valid email address configured.');
        process.exit(0);
    }

    const customSubject = process.argv[3] || `Team Notification: ${project.name}`;
    const customMessage = process.argv[4] || `Hello Team,\n\nThis is a priority update for all members enrolled in ${project.name} (${project.code}). Please review your assigned tasks and upcoming milestones in the project workspace.\n\nBest regards,\nProject Management`;

    console.log(`\nDispatching email to ${validMembers.length} enrolled member(s)...`);
    console.log(`Subject: "${customSubject}"`);

    const frontendUrl = process.env.FRONTEND_URL || 'https://interlink.jeenhost.in';
    const deepLinkUrl = `${frontendUrl}/projects/${project.id}`;

    let successCount = 0;
    for (const member of validMembers) {
        process.stdout.write(`  -> Sending to ${member.name} <${member.email}>... `);
        try {
            const res = await sendProjectBroadcastEmail({
                to: member.email,
                userName: member.name,
                projectName: project.name,
                projectCode: project.code,
                subject: customSubject,
                message: customMessage,
                senderName: 'Interlink Project Lead',
                deepLinkUrl
            });
            console.log(`✅ SENT (ID: ${res.messageId})`);
            successCount++;
        } catch (err) {
            console.log(`❌ FAILED: ${err.message}`);
        }
    }

    console.log('\n==================================================');
    console.log(`Summary: ${successCount} of ${validMembers.length} emails delivered successfully!`);
    console.log('==================================================');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
