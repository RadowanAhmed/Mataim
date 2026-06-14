# Production Deployment Checklist - Mataim App

## ✅ COMPLETED PRE-DEPLOYMENT FIXES

### 1. Security & Sensitive Data
- ✅ Removed `EXPO_PUBLIC_SKIP_PAYMENT_API` payment bypass from `paymentIntentClient.ts`
  - Removed mock payment response in `createPaymentIntent()` function
  - Removed mock payment response in `verifyPaymentIntent()` function
- ✅ Removed development-only test notifications file: `app/(tabs)/notifications/test-notifications.tsx`
- ✅ Cleaned up debug console logs in `app/_layout.tsx`

### 2. Code Quality
- ✅ Verified all console.error() statements are error-level (appropriate for production)
- ✅ Confirmed React error boundaries are in place (ErrorBoundary.tsx)
- ✅ Verified dev-only routes redirect correctly to production routes

### 3. Dependencies
- ✅ react-native-maps fixed (direct imports, no async state issues)
- ✅ All required dependencies installed
- ✅ No deprecated APIs in use

## 🔧 REQUIRED BEFORE EAS SUBMIT

### Environment Variables (Set in EAS Build Settings)
```
EXPO_PUBLIC_SUPABASE_URL=<your-production-supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-production-anon-key>
EXPO_PUBLIC_API_URL=<your-production-api-url>
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_<production-key>
GOOGLE_ANDROID_CLIENT_ID=<production-android-client-id>
GOOGLE_IOS_CLIENT_ID=<production-ios-client-id>
GOOGLE_WEB_CLIENT_ID=<production-web-client-id>
STRIPE_SECRET_KEY=sk_live_<production-key>
SUPABASE_SERVICE_ROLE_KEY=<production-service-key>
```

### Build Configuration
- ✅ app.json configured with production settings
- ✅ eas.json configured for production build
- ✅ Bundle identifiers set correctly:
  - iOS: com.radowanahmed.MataimApp
  - Android: com.radowanahmed.MataimApp

### App Store Requirements
- ✅ Version set to 1.0.0 in app.json
- ✅ Icon properly configured (./assets/icons/ic_launcher.png)
- ✅ Privacy Policy URL should be added before submission
- ✅ Support URL should be configured

## 📱 BUILD COMMAND

```bash
# First, ensure .env.production is configured with production values
# Then run:

eas build --platform android --auto-submit
# or
eas build --platform ios --auto-submit
```

## 🚀 DEPLOYMENT STEPS

1. **Set Production Secrets in EAS:**
   ```
   eas secret:create
   ```
   - Add each EXPO_PUBLIC_* and backend secret

2. **Build for Production:**
   ```
   eas build --platform android --auto-submit
   eas build --platform ios --auto-submit
   ```

3. **Submit to Stores:**
   ```
   eas submit --platform android
   eas submit --platform ios
   ```

## ✨ POST-DEPLOYMENT

- Monitor crash reports in Firebase Crashlytics
- Monitor payment processing in Stripe Dashboard
- Monitor real-time database in Supabase
- Set up alerts for error rates
- Monitor user feedback

## 📋 PRODUCTION API ENDPOINTS

Ensure your backend payment server is:
- Running on production domain
- Configured in EXPO_PUBLIC_API_URL (production builds)
- Accessible from mobile networks (not localhost)
- Using production Stripe keys

## 🔐 Security Reminders

- ❌ Never commit production secrets to git
- ❌ Never use test payment keys in production
- ✅ All payment transactions must use production Stripe keys
- ✅ Backend must be accessible from mobile networks
- ✅ CORS configured correctly for production domain
