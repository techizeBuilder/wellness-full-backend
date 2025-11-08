# Email Configuration Guide

## Why am I not receiving OTP emails?

If you're not receiving OTP emails, check the following:

### 1. Check Environment Variables

Make sure your `.env` file in the `backend` folder has all required email configuration:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=your_email@gmail.com
```

### 2. For Gmail Users

If you're using Gmail, you need to:

1. **Enable 2-Factor Authentication** on your Google account
2. **Generate an App Password**:
   - Go to your Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
   - Use this 16-character password (not your regular Gmail password) in `EMAIL_PASS`

### 3. For Other Email Providers

#### Outlook/Hotmail:
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
```

#### Yahoo:
```env
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
```

#### Custom SMTP:
Check with your email provider for SMTP settings.

### 4. Test Email Configuration

Run the test script to verify your email setup:

```bash
cd backend
node src/tests/test-email.js
```

This will:
- Show your email configuration (without revealing passwords)
- Attempt to send a test email
- Show any errors if email sending fails

### 5. Check Server Logs

When you try to register, check your backend server logs for:
- `Email transporter verification failed` - Email server connection issue
- `Failed to send OTP email` - Email sending failed
- `Email sent successfully` - Email was sent (check spam folder)

### 6. Common Issues

**Issue: "Email service is not configured"**
- Solution: Make sure all EMAIL_* variables are set in your .env file

**Issue: "Invalid login credentials"**
- Solution: For Gmail, use an App Password, not your regular password

**Issue: "Connection timeout"**
- Solution: Check your internet connection and firewall settings
- Solution: Verify EMAIL_HOST and EMAIL_PORT are correct

**Issue: Emails going to spam**
- Solution: Check your spam/junk folder
- Solution: Add the sender email to your contacts

### 7. Debug Mode

To see detailed email sending logs, you can temporarily enable debug mode in `backend/src/services/emailService.ts`:

```typescript
logger: true,  // Change from false to true
debug: true    // Change from false to true
```

### 8. Verify Email Service on Startup

When your backend server starts, you should see:
- `✅ Email server is ready to take our messages` - Email service is working
- `❌ Email transporter verification failed` - Email service has issues

If you see the error, check your email configuration before trying to register.

