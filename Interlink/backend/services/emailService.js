const nodemailer = require('nodemailer');
const dns = require('dns');

// Force IPv4 first to prevent Windows/Node ENOTFOUND / connection timeout errors on IPv6 networks
if (dns.setDefaultResultOrder) {
    dns.setDefaultResultOrder('ipv4first');
}

/**
 * Build a Nodemailer transport instance
 */
function buildTransport(config) {
    const isGmail = config.host === 'smtp.gmail.com' || config.host?.includes('gmail');
    return nodemailer.createTransport({
        host: isGmail ? 'smtp.gmail.com' : (config.host || 'smtp.gmail.com'),
        port: isGmail ? 465 : (parseInt(config.port, 10) || 465),
        secure: isGmail ? true : (config.secure === true || config.port === 465),
        auth: {
            user: config.user,
            pass: config.pass,
        },
        tls: {
            rejectUnauthorized: false,
        },
        family: 4, // Force IPv4
        connectionTimeout: 10000,
        greetingTimeout: 10000,
    });
}

/**
 * Read SMTP settings from environment variables
 */
function getSmtpConfig() {
    return {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '465', 10),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        user: process.env.SMTP_USER || 'interlinknoreply@gmail.com',
        pass: process.env.SMTP_PASS || '',
        from: process.env.SMTP_FROM || `"Interlink" <${process.env.SMTP_USER || 'interlinknoreply@gmail.com'}>`
    };
}

let cachedTransporter = null;

function getTransporter() {
    if (cachedTransporter) return cachedTransporter;
    const config = getSmtpConfig();
    cachedTransporter = buildTransport(config);
    return cachedTransporter;
}

/**
 * Verify SMTP connection and credentials
 */
async function verifyEmailConfig() {
    const config = getSmtpConfig();
    if (!config.pass || config.pass === 'your_16_character_app_password_here') {
        return {
            success: false,
            message: 'SMTP_PASS is not configured. Please generate a Google App Password and add it to .env'
        };
    }
    const transporter = buildTransport(config);
    try {
        await transporter.verify();
        return { success: true, message: `SMTP connection established successfully to ${config.host} as ${config.user}` };
    } catch (err) {
        return { success: false, message: `SMTP verification failed: ${err.message}` };
    }
}

/**
 * General purpose email sender
 */
async function sendEmail({ to, subject, text, html, attachments = [] }) {
    const config = getSmtpConfig();
    const from = config.from;

    // Development mode check
    if (process.env.EMAIL_DEV_MODE === 'true') {
        console.log(`[EmailService DEV_MODE] Email skipped. To: ${to} | Subject: ${subject}`);
        if (text) console.log(`[EmailService DEV_MODE] Body: ${text}`);
        return { success: true, devMode: true };
    }

    if (!config.pass || config.pass === 'your_16_character_app_password_here') {
        const warning = `[EmailService] Cannot send email to ${to}: SMTP_PASS is not configured in .env.`;
        console.warn(warning);
        if (process.env.NODE_ENV === 'development') {
            return { success: false, devMode: true, message: warning };
        }
        throw new Error(warning);
    }

    try {
        const transport = getTransporter();
        const info = await transport.sendMail({
            from,
            to,
            subject,
            text,
            html,
            attachments
        });

        console.log(`[EmailService] Email sent successfully to ${to} | Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId, response: info.response };
    } catch (err) {
        console.error(`[EmailService] Failed to send email to ${to}:`, err.message);
        throw err;
    }
}

/**
 * Generate branded HTML template for Interlink emails
 */
function wrapInterlinkTemplate({ title, preheader = '', contentHtml }) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <span style="display:none !important; visibility:hidden; mso-hide:all; font-size:1px; color:#0f172a; line-height:1px; max-height:0px; max-width:0px; opacity:0; overflow:hidden;">
    ${preheader}
  </span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #1e293b; border: 1px solid #334155; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);" cellspacing="0" cellpadding="0">
          
          <!-- Top Accent Bar -->
          <tr>
            <td style="background: linear-gradient(90deg, #3b82f6 0%, #06b6d4 50%, #10b981 100%); height: 6px;"></td>
          </tr>

          <!-- Header Logo / Brand -->
          <tr>
            <td style="padding: 32px 36px 16px 36px; text-align: center;">
              <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: 1px; color: #ffffff;">
                INTER<span style="color: #38bdf8;">LINK</span>
              </h1>
              <p style="margin: 4px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8;">
                Enterprise Collaboration & Workspace Platform
              </p>
            </td>
          </tr>

          <!-- Dynamic Body Content -->
          <tr>
            <td style="padding: 10px 36px 32px 36px;">
              ${contentHtml}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 36px; text-align: center; border-top: 1px solid #334155;">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #64748b;">
                This is an automated system notification from Interlink.
              </p>
              <p style="margin: 0; font-size: 10px; color: #475569;">
                © ${new Date().getFullYear()} Interlink. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Send branded OTP verification email
 */
async function sendOtpEmail({ to, otp, purpose = 'verification', userName = '' }) {
    let title = 'Verification Code';
    let description = 'Use the single-use verification code below to proceed.';

    if (purpose === 'device_verification') {
        title = 'New Device Verification';
        description = 'A sign-in attempt was detected from a new device. Enter the code below to approve this device:';
    } else if (purpose === 'password_reset') {
        title = 'Reset Your Password';
        description = 'We received a request to reset your Interlink account password. Use this code to continue:';
    } else if (purpose === 'registration') {
        title = 'Welcome to Interlink';
        description = 'Thank you for registering. Please enter the verification code below to activate your account:';
    }

    const contentHtml = `
      <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ffffff; text-align: center;">
        ${title}
      </h2>
      ${userName ? `<p style="margin: 0 0 12px 0; font-size: 14px; color: #cbd5e1; text-align: center;">Hello <strong>${userName}</strong>,</p>` : ''}
      <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #94a3b8; text-align: center;">
        ${description}
      </p>

      <!-- OTP Box -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
        <tr>
          <td align="center">
            <div style="background-color: #0f172a; border: 2px dashed #38bdf8; border-radius: 14px; padding: 18px 30px; display: inline-block;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #38bdf8; display: block; margin-left: 8px;">
                ${otp}
              </span>
            </div>
          </td>
        </tr>
      </table>

      <!-- Expiry Notice -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #334155; border-radius: 10px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 12px 16px; font-size: 12px; line-height: 1.5; color: #cbd5e1; text-align: center;">
            ⏱️ This code is valid for <strong>10 minutes</strong>. Do not share it with anyone.
          </td>
        </tr>
      </table>

      <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b; text-align: center;">
        If you did not request this code, you can safely ignore this email.
      </p>
    `;

    const html = wrapInterlinkTemplate({
        title,
        preheader: `Your verification code is: ${otp}`,
        contentHtml
    });

    return sendEmail({
        to,
        subject: `[Interlink] ${title}: ${otp}`,
        text: `Your Interlink verification code is: ${otp}. It will expire in 10 minutes.`,
        html
    });
}

/**
 * Send branded reminder / task notification email
 */
async function sendReminderEmail({ to, userName, title, description, deepLinkUrl, triggerAt }) {
    const formattedDate = triggerAt ? new Date(triggerAt).toLocaleString() : new Date().toLocaleString();
    
    const contentHtml = `
      <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ffffff; text-align: center;">
        Reminder Alert 🔔
      </h2>
      <p style="margin: 0 0 16px 0; font-size: 14px; color: #cbd5e1; text-align: center;">
        Hello <strong>${userName || 'there'}</strong>, here is your scheduled reminder:
      </p>

      <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #38bdf8;">
          ${title}
        </h3>
        ${description ? `<p style="margin: 0 0 12px 0; font-size: 14px; color: #94a3b8; line-height: 1.5;">${description}</p>` : ''}
        <p style="margin: 0; font-size: 12px; color: #64748b;">
          Scheduled Time: <strong style="color: #cbd5e1;">${formattedDate}</strong>
        </p>
      </div>

      ${deepLinkUrl ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
        <tr>
          <td align="center">
            <a href="${deepLinkUrl}" target="_blank" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px;">
              View Details in Interlink →
            </a>
          </td>
        </tr>
      </table>` : ''}
    `;

    const html = wrapInterlinkTemplate({
        title: `Reminder: ${title}`,
        preheader: `Reminder alert: ${title}`,
        contentHtml
    });

    return sendEmail({
        to,
        subject: `[Interlink Reminder] ${title}`,
        text: `Reminder: ${title}\n${description || ''}\nTime: ${formattedDate}`,
        html
    });
}

/**
 * Send branded meeting invitation email
 */
async function sendMeetingInviteEmail({ to, guestName, hostName, meetingTitle, roomCode, joinUrl, scheduledStart, passcode }) {
    const formattedDate = scheduledStart ? new Date(scheduledStart).toLocaleString() : 'Now';

    const contentHtml = `
      <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ffffff; text-align: center;">
        Video Meeting Invitation 📹
      </h2>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #cbd5e1; text-align: center;">
        <strong>${hostName || 'A team member'}</strong> has invited you to join a meeting.
      </p>

      <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #38bdf8;">
          ${meetingTitle || 'Interlink Meeting'}
        </h3>
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #94a3b8;">
          Room Code: <strong style="color: #ffffff; font-family: monospace;">${roomCode}</strong>
        </p>
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #94a3b8;">
          Scheduled Time: <strong style="color: #cbd5e1;">${formattedDate}</strong>
        </p>
        ${passcode ? `<p style="margin: 0; font-size: 13px; color: #94a3b8;">Meeting Passcode: <strong style="color: #f59e0b; font-family: monospace;">${passcode}</strong></p>` : ''}
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
        <tr>
          <td align="center">
            <a href="${joinUrl}" target="_blank" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px;">
              Join Meeting Now →
            </a>
          </td>
        </tr>
      </table>
    `;

    const html = wrapInterlinkTemplate({
        title: `Meeting Invitation: ${meetingTitle}`,
        preheader: `You have been invited to join ${meetingTitle}`,
        contentHtml
    });

    return sendEmail({
        to,
        subject: `[Interlink Meeting] Invitation: ${meetingTitle}`,
        text: `You have been invited to ${meetingTitle} by ${hostName}.\nJoin link: ${joinUrl}\nRoom Code: ${roomCode}${passcode ? `\nPasscode: ${passcode}` : ''}`,
        html
    });
}

/**
 * Send branded Project Enrollment Notification email
 */
async function sendProjectEnrollmentEmail({ to, userName, projectName, projectCode, role, projectManagerName, description, deepLinkUrl }) {
    const formattedRole = (role || 'Contributor').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

    const contentHtml = `
      <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #ffffff; text-align: center;">
        Project Enrollment Notice 🚀
      </h2>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #cbd5e1; text-align: center;">
        Hello <strong>${userName || 'Team Member'}</strong>, you have been enrolled as a member of this project:
      </p>

      <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <div style="margin-bottom: 12px;">
          <span style="display: inline-block; background-color: #1e293b; color: #38bdf8; font-family: monospace; font-size: 12px; font-weight: 700; padding: 3px 8px; border-radius: 6px; border: 1px solid #334155;">
            ${projectCode || 'PROJECT'}
          </span>
        </div>
        <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
          ${projectName}
        </h3>
        ${description ? `<p style="margin: 0 0 14px 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">${description}</p>` : ''}
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size: 13px; color: #cbd5e1; border-top: 1px solid #1e293b; padding-top: 12px; margin-top: 8px;">
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Your Assigned Role:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #38bdf8; text-align: right;">${formattedRole}</td>
          </tr>
          ${projectManagerName ? `
          <tr>
            <td style="padding: 4px 0; color: #64748b;">Project Lead:</td>
            <td style="padding: 4px 0; font-weight: 600; color: #ffffff; text-align: right;">${projectManagerName}</td>
          </tr>` : ''}
        </table>
      </div>

      ${deepLinkUrl ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
        <tr>
          <td align="center">
            <a href="${deepLinkUrl}" target="_blank" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px;">
              Open Project Workspace →
            </a>
          </td>
        </tr>
      </table>` : ''}

      <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b; text-align: center;">
        You can collaborate on tasks, track milestones, and view documents directly in Interlink.
      </p>
    `;

    const html = wrapInterlinkTemplate({
        title: `Enrolled in Project: ${projectName}`,
        preheader: `You have been added to project ${projectName} (${projectCode})`,
        contentHtml
    });

    return sendEmail({
        to,
        subject: `[Interlink] Enrolled in Project: ${projectName} (${projectCode || 'PRJ'})`,
        text: `You have been enrolled in project ${projectName} (${projectCode}) as ${formattedRole}.\nProject Lead: ${projectManagerName || 'N/A'}\nWorkspace: ${deepLinkUrl || ''}`,
        html
    });
}

/**
 * Send branded Broadcast Email to all enrolled members of a project
 */
async function sendProjectBroadcastEmail({ to, userName, projectName, projectCode, subject, message, senderName, deepLinkUrl }) {
    const contentHtml = `
      <div style="margin-bottom: 16px; text-align: center;">
        <span style="display: inline-block; background-color: #0f172a; color: #38bdf8; font-family: monospace; font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 6px; border: 1px solid #334155;">
          ${projectCode || 'PROJECT'}
        </span>
      </div>

      <h2 style="margin: 0 0 6px 0; font-size: 19px; font-weight: 700; color: #ffffff; text-align: center;">
        ${projectName}
      </h2>
      <p style="margin: 0 0 20px 0; font-size: 12px; color: #94a3b8; text-align: center;">
        Project Team Broadcast • Sent by <strong style="color: #cbd5e1;">${senderName || 'Project Lead'}</strong>
      </p>

      <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 22px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: #38bdf8;">
          ${subject || 'Project Update'}
        </h3>
        <div style="font-size: 14px; line-height: 1.6; color: #e2e8f0; white-space: pre-wrap;">
${message}
        </div>
      </div>

      ${deepLinkUrl ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 20px;">
        <tr>
          <td align="center">
            <a href="${deepLinkUrl}" target="_blank" style="display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 8px;">
              View Project in Interlink →
            </a>
          </td>
        </tr>
      </table>` : ''}

      <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #64748b; text-align: center;">
        You received this email because you are an enrolled member of project <strong>${projectName}</strong>.
      </p>
    `;

    const html = wrapInterlinkTemplate({
        title: subject || `Update on ${projectName}`,
        preheader: `Update from ${senderName || 'Project Lead'} on ${projectName}`,
        contentHtml
    });

    return sendEmail({
        to,
        subject: `[${projectCode || 'Project'}] ${subject || `Update: ${projectName}`}`,
        text: `Update on project ${projectName} (${projectCode}) by ${senderName}:\n\n${subject ? `${subject}\n\n` : ''}${message}\n\nProject workspace: ${deepLinkUrl || ''}`,
        html
    });
}

module.exports = {
    sendEmail,
    sendOtpEmail,
    sendReminderEmail,
    sendMeetingInviteEmail,
    sendProjectEnrollmentEmail,
    sendProjectBroadcastEmail,
    verifyEmailConfig,
    getTransporter
};
