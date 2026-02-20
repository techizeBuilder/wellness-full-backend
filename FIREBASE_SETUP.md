# Firebase Cloud Messaging Setup Guide

This guide will help you set up Firebase Cloud Messaging (FCM) for push notifications in the Wellness app.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard to create your project

## Step 2: Add Firebase to Your App

### For Android:
1. In Firebase Console, click the Android icon to add an Android app
2. Enter your package name (from `android/app/build.gradle`): `com.zenovia` or your package name
3. Download the `google-services.json` file
4. Place it in `Wellness-User-App/android/app/` directory

### For iOS (if applicable):
1. In Firebase Console, click the iOS icon to add an iOS app
2. Enter your bundle ID
3. Download the `GoogleService-Info.plist` file
4. Add it to your iOS project

## Step 3: Get Service Account Credentials

1. In Firebase Console, go to **Project Settings** (gear icon) → **Service accounts**
2. Click **Generate new private key**
3. Download the JSON file (keep it secure!)
4. Open the JSON file and extract the following values:
   - `project_id`
   - `private_key`
   - `client_email`

## Step 4: Configure Backend Environment Variables

Add these to your `.env` file in the backend:

```env
# Firebase Cloud Messaging
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

**Important Notes:**
- The `FIREBASE_PRIVATE_KEY` must include the full key with `\n` for newlines
- Keep the quotes around the private key
- Never commit the `.env` file or service account JSON to version control

## Step 5: Install Dependencies

### Backend:
```bash
cd wellness-full-backend
npm install firebase-admin
```

### Frontend:
```bash
cd Wellness-User-App
npx expo install expo-notifications expo-device
```

## Step 6: Enable Cloud Messaging API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** → **Library**
4. Search for "Firebase Cloud Messaging API"
5. Click **Enable**

## Step 7: Test the Setup

1. Start the backend server
2. Check logs for: `Firebase Admin SDK initialized successfully`
3. Start the mobile app
4. The app will request notification permissions on first launch
5. FCM token will be automatically registered with the backend

## Notification Types Implemented

The following notifications are automatically sent:

### Appointment Notifications:
- ✅ Appointment confirmed
- ✅ Appointment reminder (30 minutes before)
- ✅ Appointment cancelled
- ✅ Appointment rescheduled
- ✅ Expert accepted/rejected appointment
- ✅ Session starting soon (5 minutes before)
- ✅ Prescription uploaded

### Payment Notifications:
- ✅ Payment successful
- ✅ Payment failed

### Subscription Notifications:
- ✅ Subscription activated
- ✅ Subscription expiring soon (3 days before)
- ✅ Subscription expired

### General Notifications:
- ✅ Welcome notification for new users

## Testing FCM Tokens

You can test FCM token registration using the following API endpoints:

### Register FCM Token:
```bash
POST /api/user/notifications/fcm-token
Headers: Authorization: Bearer YOUR_JWT_TOKEN
Body: { "fcmToken": "your-fcm-token-here" }
```

### Check Notification Settings:
```bash
GET /api/user/notifications/settings
Headers: Authorization: Bearer YOUR_JWT_TOKEN
```

### Enable/Disable Notifications:
```bash
PUT /api/user/notifications/settings
Headers: Authorization: Bearer YOUR_JWT_TOKEN
Body: { "notificationsEnabled": true }
```

## Troubleshooting

### Firebase not initialized
- Check if all three environment variables are set correctly
- Verify the private key format (must include `\n` for newlines)
- Restart the backend server after adding environment variables

### Notifications not received on device
- Verify FCM token is registered successfully (check backend logs)
- Ensure user has granted notification permissions
- Check if `notificationsEnabled` is true for the user
- Test on a real device (not emulator) for best results

### Invalid FCM token errors
- FCM tokens expire and need to be refreshed
- The app automatically handles token refresh
- Old/invalid tokens are logged and should be removed

## Security Best Practices

1. Never commit `.env` files or service account JSON files
2. Use different Firebase projects for development and production
3. Restrict API keys in Firebase Console
4. Regularly rotate service account keys
5. Monitor usage in Firebase Console

## Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
