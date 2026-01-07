const {
  createTransporter,
  getFromEmail,
  getFromName,
} = require("../config/emailConfig");
const logger = require("./logger");

/**
 * Email Service - Handles all email sending functionality
 * Provides methods for various email notifications in MyDrive
 */

class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.initialize();
  }

  /**
   * Initialize email transporter
   */
  initialize() {
    try {
      // Only initialize if email credentials are provided
      if (process.env.EMAIL_USER || process.env.SMTP_HOST) {
        this.transporter = createTransporter();
        this.isConfigured = true;
      } else {
        this.isConfigured = false;
      }
    } catch (error) {
      this.isConfigured = false;
    }
  }

  /**
   * Send email with error handling
   * @private
   */
  async sendMail(mailOptions) {
    if (!this.isConfigured) {
      logger.warn("Email send attempted but service not configured");
      return { success: false, message: "Email service not configured" };
    }

    const startTime = Date.now();
    try {
      const info = await this.transporter.sendMail({
        from: `${getFromName()} <${getFromEmail()}>`,
        ...mailOptions,
      });

      const duration = Date.now() - startTime;
      logger.logEmail("sent", mailOptions.to, mailOptions.subject, {
        duration,
      });

      return { success: true, messageId: info.messageId };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logEmail("failed", mailOptions.to, mailOptions.subject, {
        error: error.message,
        duration,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send welcome email to new users
   */
  async sendWelcomeEmail(user) {
    const subject = "Welcome to MyDrive! 🎉";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .feature { margin: 15px 0; padding: 15px; background: white; border-radius: 5px; }
          .feature-icon { font-size: 24px; margin-right: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to MyDrive!</h1>
            <p>Your secure cloud storage solution</p>
          </div>
          <div class="content">
            <h2>Hi ${user.name}! 👋</h2>
            <p>Thank you for joining MyDrive. We're excited to have you on board!</p>
            
            <h3>What you can do with MyDrive:</h3>
            <div class="feature">
              <span class="feature-icon">📁</span>
              <strong>Organize Files:</strong> Create folders and organize your files easily
            </div>
            <div class="feature">
              <span class="feature-icon">☁️</span>
              <strong>Upload Anything:</strong> Support for large files with chunked upload technology
            </div>
            <div class="feature">
              <span class="feature-icon">🔗</span>
              <strong>Share Securely:</strong> Share files and folders with other users
            </div>
            <div class="feature">
              <span class="feature-icon">🗑️</span>
              <strong>Trash Protection:</strong> Deleted files go to trash for safe recovery
            </div>
            
            <p>Your account email: <strong>${user.email}</strong></p>
            
            <div style="text-align: center;">
              <a href="${
                process.env.CLIENT_URL ||
                `http://${window.location.hostname}:3000`
              }" class="button">Get Started</a>
            </div>
            
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Happy storing! 🚀</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} MyDrive. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to MyDrive!
      
      Hi ${user.name},
      
      Thank you for joining MyDrive. We're excited to have you on board!
      
      What you can do with MyDrive:
      - Organize Files: Create folders and organize your files easily
      - Upload Anything: Support for large files with chunked upload technology
      - Share Securely: Share files and folders with other users
      - Trash Protection: Deleted files go to trash for safe recovery
      
      Your account email: ${user.email}
      
      Get started at: ${process.env.CLIENT_URL}
      
      Happy storing!
      
      © ${new Date().getFullYear()} MyDrive. All rights reserved.
    `;

    return await this.sendMail({
      to: user.email,
      subject,
      html,
      text,
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, resetToken, resetUrl) {
    const subject = "Reset Your MyDrive Password";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #667eea; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .token-box { background: white; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${user.name},</h2>
            <p>We received a request to reset your MyDrive password.</p>
            
            <p>Click the button below to reset your password:</p>
            
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            
            <p>Or copy and paste this link into your browser:</p>
            <div class="token-box">${resetUrl}</div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.
            </div>
            
            <p><strong>Didn't request a password reset?</strong></p>
            <p>If you didn't make this request, please ignore this email. Your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} MyDrive. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset Request
      
      Hi ${user.name},
      
      We received a request to reset your MyDrive password.
      
      Click this link to reset your password:
      ${resetUrl}
      
      This link will expire in 1 hour for security reasons.
      
      Didn't request a password reset?
      If you didn't make this request, please ignore this email. Your password will remain unchanged.
      
      © ${new Date().getFullYear()} MyDrive. All rights reserved.
    `;

    return await this.sendMail({
      to: user.email,
      subject,
      html,
      text,
    });
  }

  /**
   * Check if user has email notifications enabled
   * @private
   */
  async hasEmailNotificationsEnabled(userId) {
    try {
      const User = require("../models/User");
      const user = await User.findById(userId).select(
        "settings.emailNotifications"
      );
      return user?.settings?.emailNotifications !== false;
    } catch (error) {
      return true; // Default to enabled if there's an error
    }
  }

  /**
   * Send file shared notification
   * Respects user's email notification preference
   */
  async sendFileSharedEmail(recipient, sharer, itemName, itemType) {
    // Check if recipient has email notifications enabled
    const notificationsEnabled = await this.hasEmailNotificationsEnabled(
      recipient._id || recipient.id
    );
    if (!notificationsEnabled) {
      return {
        success: false,
        message: "User has email notifications disabled",
      };
    }

    const subject = `${sharer.name} shared a ${itemType} with you`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .item-box { background: white; padding: 20px; border-radius: 5px; border-left: 4px solid #667eea; margin: 20px 0; }
          .item-icon { font-size: 40px; text-align: center; margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔗 New ${itemType === "file" ? "File" : "Folder"} Shared</h1>
          </div>
          <div class="content">
            <h2>Hi ${recipient.name}! 👋</h2>
            <p><strong>${sharer.name}</strong> (${
      sharer.email
    }) has shared a ${itemType} with you.</p>
            
            <div class="item-box">
              <div class="item-icon">${itemType === "file" ? "📄" : "📁"}</div>
              <h3 style="margin: 0; text-align: center;">${itemName}</h3>
            </div>
            
            <p>You can now access this ${itemType} in your MyDrive account under the "Shared with me" section.</p>
            
            <div style="text-align: center;">
              <a href="${
                process.env.CLIENT_URL
              }/shared" class="button">View Shared ${
      itemType === "file" ? "File" : "Folder"
    }</a>
            </div>
            
            <p>Enjoy collaborating! 🚀</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} MyDrive. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      New ${itemType === "file" ? "File" : "Folder"} Shared
      
      Hi ${recipient.name},
      
      ${sharer.name} (${sharer.email}) has shared a ${itemType} with you.
      
      ${itemType === "file" ? "File" : "Folder"} name: ${itemName}
      
      You can now access this ${itemType} in your MyDrive account under the "Shared with me" section.
      
      View at: ${process.env.CLIENT_URL}/shared
      
      © ${new Date().getFullYear()} MyDrive. All rights reserved.
    `;

    return await this.sendMail({
      to: recipient.email,
      subject,
      html,
      text,
    });
  }

  /**
   * Send bulk file/folder shared email notification
   * Respects user's email notification preference
   * @param {Object} recipient - User who will receive the shared items
   * @param {Object} sharer - User who is sharing the items
   * @param {Array} items - Array of items being shared [{name, type}]
   */
  async sendBulkShareEmail(recipient, sharer, items) {
    // Check if recipient has email notifications enabled
    const notificationsEnabled = await this.hasEmailNotificationsEnabled(
      recipient._id || recipient.id
    );
    if (!notificationsEnabled) {
      return {
        success: false,
        message: "User has email notifications disabled",
      };
    }

    const itemCount = items.length;
    const fileCount = items.filter((item) => item.type === "file").length;
    const folderCount = items.filter((item) => item.type === "folder").length;

    let itemSummary = "";
    if (fileCount > 0 && folderCount > 0) {
      itemSummary = `${fileCount} file${
        fileCount > 1 ? "s" : ""
      } and ${folderCount} folder${folderCount > 1 ? "s" : ""}`;
    } else if (fileCount > 0) {
      itemSummary = `${fileCount} file${fileCount > 1 ? "s" : ""}`;
    } else {
      itemSummary = `${folderCount} folder${folderCount > 1 ? "s" : ""}`;
    }

    const subject = `${sharer.name} shared ${itemCount} items with you`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .item-box { background: white; padding: 20px; border-radius: 5px; border-left: 4px solid #667eea; margin: 20px 0; }
          .item-list { list-style: none; padding: 0; max-height: 200px; overflow-y: auto; }
          .item-list li { padding: 8px 0; border-bottom: 1px solid #eee; display: flex; align-items: center; }
          .item-list li:last-child { border-bottom: none; }
          .item-icon { margin-right: 10px; font-size: 18px; }
          .summary-box { background: #e8eaf6; padding: 15px; border-radius: 5px; margin: 15px 0; text-align: center; }
          .count-badge { display: inline-block; background: #667eea; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin: 0 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔗 Multiple Items Shared</h1>
          </div>
          <div class="content">
            <h2>Hi ${recipient.name}! 👋</h2>
            <p><strong>${sharer.name}</strong> (${
      sharer.email
    }) has shared <strong>${itemCount} items</strong> with you.</p>
            
            <div class="summary-box">
              <p style="margin: 5px 0; font-size: 18px;">
                ${
                  fileCount > 0
                    ? `<span class="count-badge">${fileCount} 📄 File${
                        fileCount > 1 ? "s" : ""
                      }</span>`
                    : ""
                }
                ${
                  folderCount > 0
                    ? `<span class="count-badge">${folderCount} 📁 Folder${
                        folderCount > 1 ? "s" : ""
                      }</span>`
                    : ""
                }
              </p>
            </div>
            
            <div class="item-box">
              <h3 style="margin-top: 0;">Shared Items:</h3>
              <ul class="item-list">
                ${items
                  .slice(0, 10)
                  .map(
                    (item) => `
                  <li>
                    <span class="item-icon">${
                      item.type === "file" ? "📄" : "📁"
                    }</span>
                    <span>${item.name}</span>
                  </li>
                `
                  )
                  .join("")}
                ${
                  items.length > 10
                    ? `<li style="text-align: center; color: #667eea; font-weight: bold;">+ ${
                        items.length - 10
                      } more items...</li>`
                    : ""
                }
              </ul>
            </div>
            
            <p>You can now access these items in your MyDrive account under the "Shared with me" section.</p>
            
            <div style="text-align: center;">
              <a href="${
                process.env.CLIENT_URL
              }/shared" class="button">View Shared Items</a>
            </div>
            
            <p>Enjoy collaborating! 🚀</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} MyDrive. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Multiple Items Shared
      
      Hi ${recipient.name},
      
      ${sharer.name} (${sharer.email}) has shared ${itemCount} items with you.
      
      Summary: ${itemSummary}
      
      Shared items:
      ${items
        .slice(0, 10)
        .map(
          (item, i) =>
            `${i + 1}. ${item.type === "file" ? "📄" : "📁"} ${item.name}`
        )
        .join("\n      ")}
      ${
        items.length > 10 ? `      ... and ${items.length - 10} more items` : ""
      }
      
      You can now access these items in your MyDrive account under the "Shared with me" section.
      
      View at: ${process.env.CLIENT_URL}/shared
      
      © ${new Date().getFullYear()} MyDrive. All rights reserved.
    `;

    return await this.sendMail({
      to: recipient.email,
      subject,
      html,
      text,
    });
  }

  /**
   * Send storage limit warning
   * Respects user's email notification preference
   */
  async sendStorageWarningEmail(
    user,
    usedPercentage,
    storageUsed,
    storageLimit
  ) {
    // Check if user has email notifications enabled
    const notificationsEnabled = await this.hasEmailNotificationsEnabled(
      user._id || user.id
    );
    if (!notificationsEnabled) {
      return {
        success: false,
        message: "User has email notifications disabled",
      };
    }

    const subject = "⚠️ Storage Space Warning - MyDrive";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ffc107; color: #333; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .progress-bar { width: 100%; height: 30px; background: #e0e0e0; border-radius: 15px; overflow: hidden; margin: 20px 0; }
          .progress-fill { height: 100%; background: ${
            usedPercentage >= 90 ? "#dc3545" : "#ffc107"
          }; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; }
          .tips { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #667eea; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Storage Space Warning</h1>
          </div>
          <div class="content">
            <h2>Hi ${user.name},</h2>
            <p>Your MyDrive storage is running low!</p>
            
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${usedPercentage}%;">
                ${usedPercentage.toFixed(1)}% used
              </div>
            </div>
            
            <p><strong>Storage used:</strong> ${storageUsed} / ${storageLimit}</p>
            
            <div class="tips">
              <h3>💡 Tips to free up space:</h3>
              <ul>
                <li>Empty your trash folder</li>
                <li>Delete old or duplicate files</li>
                <li>Remove large files you no longer need</li>
                <li>Unshare files that are stored by other users</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${
                process.env.CLIENT_URL
              }" class="button">Manage Storage</a>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} MyDrive. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Storage Space Warning
      
      Hi ${user.name},
      
      Your MyDrive storage is running low!
      
      Storage used: ${storageUsed} / ${storageLimit} (${usedPercentage.toFixed(
      1
    )}% used)
      
      Tips to free up space:
      - Empty your trash folder
      - Delete old or duplicate files
      - Remove large files you no longer need
      - Unshare files that are stored by other users
      
      Manage your storage at: ${process.env.CLIENT_URL}
      
      © ${new Date().getFullYear()} MyDrive. All rights reserved.
    `;

    return await this.sendMail({
      to: user.email,
      subject,
      html,
      text,
    });
  }

  /**
   * Send custom notification email
   * Respects user's email notification preference
   */
  async sendNotificationEmail(user, subject, message) {
    // Check if user has email notifications enabled
    const notificationsEnabled = await this.hasEmailNotificationsEnabled(
      user._id || user.id
    );
    if (!notificationsEnabled) {
      return {
        success: false,
        message: "User has email notifications disabled",
      };
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>MyDrive Notification</h1>
          </div>
          <div class="content">
            <h2>Hi ${user.name},</h2>
            ${message}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} MyDrive. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendMail({
      to: user.email,
      subject,
      html,
      text: `Hi ${user.name},\n\n${message.replace(
        /<[^>]*>/g,
        ""
      )}\n\n© ${new Date().getFullYear()} MyDrive. All rights reserved.`,
    });
  }

  /**
   * Send storage warning email (50%, 75%, 90% thresholds)
   */
  async sendStorageWarningEmail(user, threshold, storageInfo) {
    // Check if user has email notifications enabled
    const notificationsEnabled = await this.hasEmailNotificationsEnabled(
      user._id || user.id
    );
    if (!notificationsEnabled) {
      return {
        success: false,
        message: "User has email notifications disabled",
      };
    }

    const percentageText = threshold + "%";
    const warningLevel =
      threshold >= 90 ? "Critical" : threshold >= 75 ? "High" : "Medium";
    const warningColor =
      threshold >= 90 ? "#dc2626" : threshold >= 75 ? "#f59e0b" : "#0891b2";

    const subject = `⚠️ Storage ${warningLevel}: ${percentageText} Full - MyDrive`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, ${warningColor} 0%, ${warningColor}dd 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .warning-icon { font-size: 60px; margin-bottom: 10px; }
          .storage-bar { width: 100%; height: 30px; background: #e5e7eb; border-radius: 15px; overflow: hidden; margin: 20px 0; position: relative; }
          .storage-fill { height: 100%; background: linear-gradient(90deg, ${warningColor} 0%, ${warningColor}dd 100%); transition: width 0.3s ease; }
          .storage-percentage { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: ${
            threshold >= 50 ? "white" : "#333"
          }; font-weight: bold; font-size: 14px; }
          .stats-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${warningColor}; }
          .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .stat-row:last-child { border-bottom: none; }
          .stat-label { font-weight: 600; color: #6b7280; }
          .stat-value { font-weight: bold; color: #111827; }
          .action-box { background: #fef3c7; padding: 20px; border-radius: 8px; border: 1px solid #fbbf24; margin: 20px 0; }
          .action-title { font-weight: bold; color: #92400e; margin-bottom: 10px; font-size: 16px; }
          .action-list { margin: 10px 0; padding-left: 20px; }
          .action-list li { margin: 5px 0; color: #78350f; }
          .button { display: inline-block; padding: 14px 28px; background: ${warningColor}; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="warning-icon">⚠️</div>
            <h1>Storage ${warningLevel} Warning</h1>
            <p>Your MyDrive storage is ${percentageText} full</p>
          </div>
          <div class="content">
            <h2>Hi ${user.name},</h2>
            <p>Your MyDrive storage is reaching its limit. You've used <strong>${
              storageInfo.formattedUsed
            }</strong> of your <strong>${
      storageInfo.formattedLimit
    }</strong> storage quota.</p>
            
            <div class="storage-bar">
              <div class="storage-fill" style="width: ${
                storageInfo.percentage
              }%;"></div>
              <div class="storage-percentage">${storageInfo.percentage.toFixed(
                1
              )}%</div>
            </div>
            
            <div class="stats-box">
              <div class="stat-row">
                <span class="stat-label">Storage Used:</span>
                <span class="stat-value">${storageInfo.formattedUsed}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Total Storage:</span>
                <span class="stat-value">${storageInfo.formattedLimit}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Remaining Space:</span>
                <span class="stat-value">${
                  storageInfo.formattedRemaining
                }</span>
              </div>
            </div>
            
            <div class="action-box">
              <div class="action-title">💡 Actions You Can Take:</div>
              <ul class="action-list">
                <li>Delete files you no longer need</li>
                <li>Empty your trash to permanently free up space</li>
                <li>Move large files to local storage</li>
                <li>Compress files before uploading</li>
              </ul>
            </div>
            
            <p style="color: #991b1b; font-weight: 600; margin-top: 20px;">
              ${
                threshold >= 90
                  ? "⚠️ Warning: You're approaching your storage limit. New uploads may be blocked soon."
                  : "Please free up some space to continue using MyDrive smoothly."
              }
            </p>
            
            <div style="text-align: center;">
              <a href="${
                process.env.CLIENT_URL
              }" class="button">Manage Your Storage</a>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} MyDrive. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Storage ${warningLevel} Warning - MyDrive
      
      Hi ${user.name},
      
      Your MyDrive storage is reaching its limit. You've used ${
        storageInfo.formattedUsed
      } of your ${
      storageInfo.formattedLimit
    } storage quota (${storageInfo.percentage.toFixed(1)}%).
      
      Storage Details:
      - Storage Used: ${storageInfo.formattedUsed}
      - Total Storage: ${storageInfo.formattedLimit}
      - Remaining Space: ${storageInfo.formattedRemaining}
      
      Actions You Can Take:
      • Delete files you no longer need
      • Empty your trash to permanently free up space
      • Move large files to local storage
      • Compress files before uploading
      
      ${
        threshold >= 90
          ? "⚠️ Warning: You're approaching your storage limit. New uploads may be blocked soon."
          : "Please free up some space to continue using MyDrive smoothly."
      }
      
      Visit MyDrive: ${process.env.CLIENT_URL}
      
      © ${new Date().getFullYear()} MyDrive. All rights reserved.
    `;

    return await this.sendMail({
      to: user.email,
      subject,
      html,
      text,
    });
  }

  /**
   * Send storage limit reached email (100% threshold)
   */
  async sendStorageLimitReachedEmail(user, storageInfo) {
    // Check if user has email notifications enabled
    const notificationsEnabled = await this.hasEmailNotificationsEnabled(
      user._id || user.id
    );
    if (!notificationsEnabled) {
      return {
        success: false,
        message: "User has email notifications disabled",
      };
    }

    const subject = "🚫 Storage Limit Reached - Action Required - MyDrive";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .alert-icon { font-size: 60px; margin-bottom: 10px; }
          .storage-bar { width: 100%; height: 30px; background: #e5e7eb; border-radius: 15px; overflow: hidden; margin: 20px 0; position: relative; }
          .storage-fill { height: 100%; background: linear-gradient(90deg, #dc2626 0%, #b91c1c 100%); width: 100%; }
          .storage-percentage { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: white; font-weight: bold; font-size: 14px; }
          .stats-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626; }
          .stat-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
          .stat-row:last-child { border-bottom: none; }
          .stat-label { font-weight: 600; color: #6b7280; }
          .stat-value { font-weight: bold; color: #111827; }
          .alert-box { background: #fee2e2; padding: 20px; border-radius: 8px; border: 2px solid #dc2626; margin: 20px 0; }
          .alert-title { font-weight: bold; color: #991b1b; margin-bottom: 10px; font-size: 18px; }
          .alert-text { color: #7f1d1d; font-size: 16px; line-height: 1.5; }
          .action-box { background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0; }
          .action-title { font-weight: bold; color: #111827; margin-bottom: 10px; font-size: 16px; }
          .action-list { margin: 10px 0; padding-left: 20px; }
          .action-list li { margin: 8px 0; color: #374151; }
          .button { display: inline-block; padding: 14px 28px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="alert-icon">🚫</div>
            <h1>Storage Limit Reached</h1>
            <p>Your storage is at 100% capacity</p>
          </div>
          <div class="content">
            <h2>Hi ${user.name},</h2>
            
            <div class="alert-box">
              <div class="alert-title">⚠️ Uploads Blocked</div>
              <div class="alert-text">
                You have reached your storage limit of <strong>${
                  storageInfo.formattedLimit
                }</strong>. 
                You cannot upload any new files until you free up space.
              </div>
            </div>
            
            <div class="storage-bar">
              <div class="storage-fill"></div>
              <div class="storage-percentage">100%</div>
            </div>
            
            <div class="stats-box">
              <div class="stat-row">
                <span class="stat-label">Storage Used:</span>
                <span class="stat-value">${storageInfo.formattedUsed}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Total Storage:</span>
                <span class="stat-value">${storageInfo.formattedLimit}</span>
              </div>
              <div class="stat-row">
                <span class="stat-label">Remaining Space:</span>
                <span class="stat-value" style="color: #dc2626;">${
                  storageInfo.formattedRemaining
                } (${storageInfo.percentage.toFixed(1)}% used)</span>
              </div>
            </div>
            
            <div class="action-box">
              <div class="action-title">🔧 Immediate Actions Required:</div>
              <ul class="action-list">
                <li><strong>Delete unnecessary files</strong> from your drive</li>
                <li><strong>Empty your trash</strong> to permanently remove deleted items</li>
                <li><strong>Download and remove</strong> large files to free up space</li>
                <li><strong>Compress files</strong> before re-uploading if needed</li>
              </ul>
            </div>
            
            <p style="color: #991b1b; font-weight: 600; margin-top: 20px; padding: 15px; background: #fee2e2; border-radius: 6px;">
              💡 <strong>Tip:</strong> Even a small amount of free space will allow you to resume uploads. 
              Delete just a few files to get started again!
            </p>
            
            <div style="text-align: center;">
              <a href="${
                process.env.CLIENT_URL
              }" class="button">Free Up Space Now</a>
            </div>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} MyDrive. All rights reserved.</p>
            <p>This is an automated email, please do not reply.</p>
            <p>Need help? Contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Storage Limit Reached - Action Required - MyDrive
      
      Hi ${user.name},
      
      ⚠️ UPLOADS BLOCKED
      
      You have reached your storage limit of ${
        storageInfo.formattedLimit
      }. You cannot upload any new files until you free up space.
      
      Storage Details:
      - Storage Used: ${storageInfo.formattedUsed}
      - Total Storage: ${storageInfo.formattedLimit}
      - Remaining Space: ${
        storageInfo.formattedRemaining
      } (${storageInfo.percentage.toFixed(1)}% used)
      
      Immediate Actions Required:
      • Delete unnecessary files from your drive
      • Empty your trash to permanently remove deleted items
      • Download and remove large files to free up space
      • Compress files before re-uploading if needed
      
      💡 Tip: Even a small amount of free space will allow you to resume uploads. Delete just a few files to get started again!
      
      Visit MyDrive: ${process.env.CLIENT_URL}
      
      © ${new Date().getFullYear()} MyDrive. All rights reserved.
    `;

    return await this.sendMail({
      to: user.email,
      subject,
      html,
      text,
    });
  }
}

// Export singleton instance
module.exports = new EmailService();
