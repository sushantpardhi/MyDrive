const {
  createTransporter,
  getFromEmail,
  getFromName,
} = require("../config/emailConfig");

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
        console.log(
          "ℹ️  Email service not configured - notifications disabled"
        );
      }
    } catch (error) {
      console.error("Email service initialization error:", error.message);
      this.isConfigured = false;
    }
  }

  /**
   * Send email with error handling
   * @private
   */
  async sendMail(mailOptions) {
    if (!this.isConfigured) {
      console.log(
        "📧 Email not sent (service not configured):",
        mailOptions.subject
      );
      return { success: false, message: "Email service not configured" };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `${getFromName()} <${getFromEmail()}>`,
        ...mailOptions,
      });
      console.log(
        "✅ Email sent:",
        mailOptions.subject,
        "- Message ID:",
        info.messageId
      );
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error("❌ Email send error:", error.message);
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
                process.env.CLIENT_URL || "http://localhost:3000"
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
      
      Get started at: ${process.env.CLIENT_URL || "http://localhost:3000"}
      
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
   * Send file shared notification
   */
  async sendFileSharedEmail(recipient, sharer, itemName, itemType) {
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
                process.env.CLIENT_URL || "http://localhost:3000"
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
      
      View at: ${process.env.CLIENT_URL || "http://localhost:3000"}/shared
      
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
   * @param {Object} recipient - User who will receive the shared items
   * @param {Object} sharer - User who is sharing the items
   * @param {Array} items - Array of items being shared [{name, type}]
   */
  async sendBulkShareEmail(recipient, sharer, items) {
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
                process.env.CLIENT_URL || "http://localhost:3000"
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
      
      View at: ${process.env.CLIENT_URL || "http://localhost:3000"}/shared
      
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
   */
  async sendStorageWarningEmail(
    user,
    usedPercentage,
    storageUsed,
    storageLimit
  ) {
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
                process.env.CLIENT_URL || "http://localhost:3000"
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
      
      Manage your storage at: ${
        process.env.CLIENT_URL || "http://localhost:3000"
      }
      
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
   */
  async sendNotificationEmail(user, subject, message) {
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
}

// Export singleton instance
module.exports = new EmailService();
