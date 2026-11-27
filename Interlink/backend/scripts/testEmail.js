require('dotenv').config();
const { verifyEmailConfig, sendEmail, sendOtpEmail } = require('../services/emailService');

async function main() {
    console.log('==============================================');
    console.log('       INTERLINK GMAIL SMTP TEST SCRIPT       ');
    console.log('==============================================');
    console.log(`Configured Sender: ${process.env.SMTP_USER || '(not set)'}`);
    console.log(`SMTP Host:        ${process.env.SMTP_HOST || 'smtp.gmail.com'}:${process.env.SMTP_PORT || '465'}`);
    console.log(`SSL/Secure:       ${process.env.SMTP_SECURE || 'true'}`);
    console.log(`App Password Set: ${process.env.SMTP_PASS && process.env.SMTP_PASS !== 'your_16_character_app_password_here' ? 'YES (configured)' : 'NO (placeholder)'}`);
    console.log('----------------------------------------------');

    // 1. Verify Configuration & SMTP Handshake
    console.log('\n[1/2] Verifying SMTP credentials & connection...');
    const verifyResult = await verifyEmailConfig();
    if (!verifyResult.success) {
        console.error('❌ Verification Failed:', verifyResult.message);
        console.log('\nTip: To fix this:');
        console.log('  1. Ensure 2-Step Verification is turned ON for interlinknoreply@gmail.com');
        console.log('  2. Generate a 16-character App Password at: https://myaccount.google.com/apppasswords');
        console.log('  3. Paste the 16 characters into SMTP_PASS in backend/.env');
        process.exit(1);
    }
    console.log('✅ Connection Successful:', verifyResult.message);

    // 2. Optionally send a test email if an email address was passed as CLI argument
    const targetEmail = process.argv[2] || process.env.SMTP_USER;
    if (targetEmail) {
        console.log(`\n[2/2] Sending test verification email to: ${targetEmail}...`);
        try {
            const sendResult = await sendOtpEmail({
                to: targetEmail,
                otp: '123456',
                purpose: 'registration',
                userName: 'Admin Tester'
            });
            console.log('✅ Test email dispatched successfully!');
            console.log('   Message ID:', sendResult.messageId);
            console.log('   Check inbox of:', targetEmail);
        } catch (err) {
            console.error('❌ Failed to send test email:', err.message);
            process.exit(1);
        }
    }

    console.log('\n==============================================');
    console.log('🎉 Gmail SMTP configuration is fully working!');
    console.log('==============================================');
}

main().catch(err => {
    console.error('Fatal error during test:', err);
    process.exit(1);
});
