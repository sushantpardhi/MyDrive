const nodemailer = require("nodemailer");
const logger = require("../utils/logger");

/**
 * Email configuration and transporter setup
 * Supports multiple email providers: Gmail, SendGrid, custom SMTP
 */

// Create email transporter based on environment configuration
const createTransporter = () => {
  const emailService = process.env.EMAIL_SERVICE || "gmail";

  // Gmail configuration
  if (emailService === "gmail") {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD, // Use App Password for Gmail
      },
    });
  }

  // SendGrid configuration
  if (emailService === "sendgrid") {
    return nodemailer.createTransport({
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  }

  // Custom SMTP configuration
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
};

// Verify email configuration on startup
const verifyEmailConfig = async () => {
  try {
    const startTime = Date.now();
    const transporter = createTransporter();
    await transporter.verify();
    const duration = Date.now() - startTime;
    logger.info(
      `✅ Email service configured - Provider: ${
        process.env.EMAIL_SERVICE || "gmail"
      } - Verified in ${duration}ms`
    );
    return true;
  } catch (error) {
    logger.warn(`⚠️  Email service not configured: ${error.message}`);
    logger.warn("📧 Email notifications will be disabled");
    return false;
  }
};

// Get default sender email
const getFromEmail = () => {
  return (
    process.env.EMAIL_FROM || process.env.EMAIL_USER || "noreply@mydrive.com"
  );
};

// Get sender name
const getFromName = () => {
  return process.env.EMAIL_FROM_NAME || "MyDrive";
};

module.exports = {
  createTransporter,
  verifyEmailConfig,
  getFromEmail,
  getFromName,
};
