# Email Service

## Overview

MyDrive uses Nodemailer to send email notifications for user registration, password reset, and file sharing events.

## Features

- Welcome emails on registration
- Password reset emails with secure tokens
- File/folder sharing notifications
- Storage warning emails
- Custom email templates
- Multiple email provider support (Gmail, SendGrid, Custom SMTP)

## Configuration

### Environment Variables

```env
# Email Service Provider
EMAIL_SERVICE=gmail

# Gmail Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password

# Optional: Custom sender details
EMAIL_FROM_NAME=MyDrive
EMAIL_FROM=noreply@mydrive.com

# Client URL (for links in emails)
CLIENT_URL=http://localhost:5000
```

### Supported Email Services

#### 1. Gmail

**Setup Steps**:

1. Enable 2-factor authentication on your Google account
2. Go to: https://myaccount.google.com/apppasswords
3. Generate a new app password for "Mail"
4. Use the 16-character password in `EMAIL_PASSWORD`

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

#### 2. SendGrid

```env
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=MyDrive
```

#### 3. Custom SMTP

```env
EMAIL_SERVICE=custom
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASSWORD=your-password
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=MyDrive
```

## Email Types

### 1. Welcome Email

**Triggered**: On user registration

**Template**:

```
Subject: Welcome to MyDrive!

Hi {userName},

Welcome to MyDrive! Your account has been successfully created.

You can now:
✓ Upload and organize your files
✓ Share files with others
✓ Access your files from anywhere

Get Started: {clientUrl}/drive

Storage: 5 GB free

Need help? Contact us at support@mydrive.com

Best regards,
The MyDrive Team
```

**Implementation**:

```javascript
// server/routes/auth.js
await emailService.sendWelcomeEmail(user.email, user.name);
```

### 2. Password Reset Email

**Triggered**: When user requests password reset

**Template**:

```
Subject: Reset Your MyDrive Password

Hi {userName},

We received a request to reset your MyDrive password.

Reset Password: {clientUrl}/reset-password?token={resetToken}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
The MyDrive Team
```

**Implementation**:

```javascript
// server/routes/auth.js
const resetToken = jwt.sign(
  {
    userId: user._id,
    type: "password_reset",
  },
  process.env.JWT_SECRET,
  { expiresIn: "1h" }
);

await emailService.sendPasswordResetEmail(user.email, user.name, resetToken);
```

### 3. File Shared Email

**Triggered**: When file/folder is shared with user

**Template**:

```
Subject: {sharerName} shared a {itemType} with you

Hi {recipientName},

{sharerName} has shared a {itemType} with you on MyDrive.

Item: {itemName}
Access Level: {permission}

View Now: {clientUrl}/shared

Best regards,
The MyDrive Team
```

**Implementation**:

```javascript
// server/routes/files.js or folders.js
await emailService.sendFileSharedEmail(recipientEmail, recipientName, {
  itemName: file.name,
  itemType: "file",
  sharerName: req.user.name,
  permission: "view",
});
```

### 4. Storage Warning Email

**Triggered**: When user reaches 80% or 90% storage

**Template**:

```
Subject: Storage Space Warning

Hi {userName},

Your MyDrive storage is {percentage}% full.

Used: {usedSpace} / {totalSpace}

Consider:
• Deleting unnecessary files
• Emptying your trash
• Upgrading your storage plan

Manage Storage: {clientUrl}/settings

Best regards,
The MyDrive Team
```

### 5. Custom Notification Email

**Triggered**: For custom admin notifications

**Usage**:

```javascript
await emailService.sendNotificationEmail(
  userEmail,
  "Important Update",
  "Your account has been upgraded to premium!",
  "<p>Your account has been upgraded to <strong>premium</strong>!</p>"
);
```

## Email Service Implementation

### Location

`server/utils/emailService.js`

### Service Class

```javascript
class EmailService {
  constructor() {
    this.transporter = createTransporter();
    this.isConfigured = false;
  }

  async sendWelcomeEmail(email, userName) {
    if (!this.isConfigured) {
      console.log("Email service not configured");
      return;
    }

    const mailOptions = {
      from: `${getFromName()} <${getFromEmail()}>`,
      to: email,
      subject: "Welcome to MyDrive!",
      html: this.generateWelcomeTemplate(userName),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log(`Welcome email sent to ${email}`);
    } catch (error) {
      console.error("Failed to send welcome email:", error);
    }
  }

  // ... other email methods
}

module.exports = new EmailService();
```

### Email Configuration

Location: `server/config/emailConfig.js`

```javascript
const createTransporter = () => {
  const emailService = process.env.EMAIL_SERVICE;

  switch (emailService) {
    case "gmail":
      return nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD,
        },
      });

    case "sendgrid":
      return nodemailer.createTransport({
        host: "smtp.sendgrid.net",
        port: 587,
        auth: {
          user: "apikey",
          pass: process.env.SENDGRID_API_KEY,
        },
      });

    case "custom":
      return nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

    default:
      console.warn("Email service not configured");
      return null;
  }
};
```

## Email Templates

### HTML Template Structure

```html
<!DOCTYPE html>
<html>
  <head>
    <style>
      body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
      }
      .button {
        display: inline-block;
        padding: 12px 24px;
        background-color: #4f46e5;
        color: white;
        text-decoration: none;
        border-radius: 6px;
      }
      .footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
        color: #666;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h2>Welcome to MyDrive!</h2>
      <p>Hi {{userName}},</p>
      <p>Your account has been successfully created.</p>

      <a href="{{clientUrl}}/drive" class="button"> Get Started </a>

      <div class="footer">
        <p>© 2025 MyDrive. All rights reserved.</p>
      </div>
    </div>
  </body>
</html>
```

### Template Variables

```javascript
const replaceVariables = (template, variables) => {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, value);
  }

  return result;
};
```

## Testing Email Service

### Verify Configuration

```javascript
// server/config/emailConfig.js
const verifyEmailConfig = async () => {
  const transporter = createTransporter();

  if (!transporter) {
    console.warn("⚠️  Email service not configured");
    return false;
  }

  try {
    await transporter.verify();
    console.log("✅ Email service configured successfully");
    return true;
  } catch (error) {
    console.error("❌ Email verification failed:", error);
    return false;
  }
};
```

### Send Test Email

```bash
# Test from command line
node -e "
  require('dotenv').config();
  const emailService = require('./server/utils/emailService');
  emailService.sendWelcomeEmail('test@example.com', 'Test User');
"
```

### Manual Testing Checklist

- [ ] Welcome email on registration
- [ ] Password reset email with valid token
- [ ] Password reset link expires after 1 hour
- [ ] File sharing notification
- [ ] Storage warning email
- [ ] Email delivery speed (< 5 seconds)
- [ ] Email lands in inbox (not spam)
- [ ] All links work correctly
- [ ] Email displays correctly on mobile

## Error Handling

### Common Issues

#### 1. Gmail Authentication Error

**Error**: `Invalid login: 535-5.7.8 Username and Password not accepted`

**Solution**:

- Use App Password, not regular password
- Enable 2-factor authentication first
- Check EMAIL_USER and EMAIL_PASSWORD are correct

#### 2. SendGrid API Key Error

**Error**: `Unauthorized: Authentication required`

**Solution**:

- Verify SENDGRID_API_KEY is correct
- Check API key has "Mail Send" permissions
- Ensure EMAIL_FROM is verified in SendGrid

#### 3. SMTP Connection Timeout

**Error**: `Connection timeout`

**Solution**:

- Check SMTP_HOST and SMTP_PORT
- Verify firewall allows outbound connections
- Try different port (587, 465, 25)

#### 4. Rate Limiting

**Error**: `Too many requests`

**Solution**:

- Implement email queue
- Add delay between emails
- Upgrade email service plan

### Graceful Degradation

```javascript
// App works even if email fails
try {
  await emailService.sendWelcomeEmail(email, name);
} catch (error) {
  console.error("Email failed, but registration successful:", error);
  // Don't fail the registration
}
```

## Production Best Practices

### 1. Use Professional Email Service

✅ SendGrid for high volume  
✅ AWS SES for cost-effective  
✅ Mailgun for reliability  
❌ Gmail for production (rate limits)

### 2. Email Queue

```javascript
// Using Bull queue
const emailQueue = new Queue("emails", {
  redis: process.env.REDIS_URL,
});

emailQueue.process(async (job) => {
  const { type, to, data } = job.data;

  switch (type) {
    case "welcome":
      await emailService.sendWelcomeEmail(to, data.name);
      break;
    case "password-reset":
      await emailService.sendPasswordResetEmail(to, data.name, data.token);
      break;
  }
});
```

### 3. Email Analytics

- Track open rates
- Track click rates
- Monitor bounce rates
- A/B test subject lines

### 4. SPF and DKIM

Configure DNS records:

```
# SPF Record
v=spf1 include:_spf.google.com ~all

# DKIM Record (get from email provider)
default._domainkey IN TXT "v=DKIM1; k=rsa; p=..."
```

### 5. Unsubscribe Link

Include unsubscribe option:

```html
<div class="footer">
  <a href="{{clientUrl}}/unsubscribe?email={{email}}">
    Unsubscribe from notifications
  </a>
</div>
```

## Email Statistics

### Track Email Performance

```javascript
// Store email logs
const EmailLog = new Schema({
  userId: ObjectId,
  type: String,
  to: String,
  subject: String,
  sentAt: Date,
  delivered: Boolean,
  opened: Boolean,
  clicked: Boolean,
  bounced: Boolean,
});
```

### Get Email Stats

```javascript
// Get user email statistics
GET /api/users/email-stats

Response:
{
  "totalSent": 42,
  "delivered": 40,
  "opened": 35,
  "clicked": 20,
  "bounced": 2,
  "deliveryRate": 95.2,
  "openRate": 87.5,
  "clickRate": 57.1
}
```

## Related Documentation

- [Authentication](./AUTHENTICATION.md) - Password reset flow
- [File Sharing](./FILE_SHARING.md) - Share notifications
- [User Management](./USER_MANAGEMENT.md) - User preferences
