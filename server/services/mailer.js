
const nodemailer = require('nodemailer');

const createTransporter = () => {
    // Check required env vars
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        console.warn("[Mailer] SMTP credentials missing. Email sending disabled.");
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

const sendEmail = async (to, subject, htmlContent) => {
    const transporter = createTransporter();
    if (!transporter) return false;

    try {
        const info = await transporter.sendMail({
            from: process.env.MAIL_FROM || '"SST Metrics Pro" <no-reply@tackertools.com>',
            to: to,
            subject: subject,
            html: htmlContent,
        });
        console.log(`[Mailer] Message sent: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error("[Mailer] Error sending email:", error);
        return false;
    }
};

module.exports = { sendEmail };
