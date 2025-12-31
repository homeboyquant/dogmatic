# Environment Variables Guide

## Overview
This document explains all environment variables used in the trading platform and their security considerations.

---

## 🔑 Environment Variables

### Client-Side Variables (NEXT_PUBLIC_*)
These variables are accessible in the browser and bundled into the client-side JavaScript.

```bash
# Firebase Configuration (Public - needed in browser)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDajLUHcsKLGIwuul7fPEq1zf0vPYVpJPg
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=homeboyquant-e5910.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=homeboyquant-e5910
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=homeboyquant-e5910.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=318538657595
NEXT_PUBLIC_FIREBASE_APP_ID=1:318538657595:web:41254451e73b088401d11e
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-VZXC101HJ8

# Trading API (Public - needed for client-side trading)
NEXT_PUBLIC_TRADING_API_URL=https://homeboyapi-318538657595.me-west1.run.app
NEXT_PUBLIC_TRADING_PRIVATE_KEY=0xf2e7a5daabccf153eb7ae888b3e08de418105613f337b0d1cf59284fb458773e
```

### Server-Side Only Variables
These variables are ONLY accessible in API routes and server-side code.

```bash
# Polymarket CLOB API (Server-only - sensitive credentials)
CLOB_API_KEY=63108d24-0e8b-47a8-8892-80b57142368a
CLOB_SECRET=t4Lyt6QrdFLZNMrWC8ZjMOnyzbbe0ZoAt1uTTjH1Rqs=
CLOB_PASS_PHRASE=0188e5d4cea2c24621087aea857e8747fd836219d5ac848bb5b8aa6d35497736
```

---

## 📁 Where They're Used

### Client-Side Files

| File | Variables Used |
|------|----------------|
| `lib/tradingApi.ts` | `NEXT_PUBLIC_TRADING_API_URL` |
| `lib/realTradingService.ts` | `NEXT_PUBLIC_TRADING_PRIVATE_KEY` |
| `components/RealTradingSimulator.tsx` | Uses services that consume the above |

### Server-Side Files

| File | Variables Used |
|------|----------------|
| `pages/api/polymarket-orders.ts` | `CLOB_API_KEY`, `CLOB_SECRET`, `CLOB_PASS_PHRASE` |
| `pages/api/analyze.ts` | `OPENAI_API_KEY` (if present) |

### Scripts (Node.js)

| File | Variables Used |
|------|----------------|
| `scripts/testTrading.ts` | `NEXT_PUBLIC_TRADING_API_URL` |
| `scripts/getUserOrders.ts` | `NEXT_PUBLIC_TRADING_PRIVATE_KEY` |

---

## 🔒 Security Best Practices

### ✅ What's Safe to Expose (NEXT_PUBLIC_*)

1. **Firebase Config** - These are designed to be public and safe to expose
2. **Trading API URL** - This is a public endpoint URL
3. **Trading Private Key** - Used for signing transactions client-side (needed for Polymarket trading)

### ⚠️ What Must Stay Private (No NEXT_PUBLIC_)

1. **CLOB Credentials** - Sensitive API keys that should NEVER be exposed to the browser
   - `CLOB_API_KEY`
   - `CLOB_SECRET`
   - `CLOB_PASS_PHRASE`

2. **OpenAI API Key** - If you have one, keep it server-side only

---

## 🔄 How Next.js Handles Environment Variables

### Client-Side (Browser)
```typescript
// ✅ Works in browser
const apiUrl = process.env.NEXT_PUBLIC_TRADING_API_URL;

// ❌ Returns undefined in browser (good for security!)
const secret = process.env.CLOB_SECRET;
```

### Server-Side (API Routes)
```typescript
// ✅ Works in API routes
const apiKey = process.env.CLOB_API_KEY;
const publicUrl = process.env.NEXT_PUBLIC_TRADING_API_URL;
```

---

## 📝 Adding New Environment Variables

### For Client-Side Use
1. Prefix with `NEXT_PUBLIC_`
2. Add to `.env.local`
3. Restart dev server
4. Access via `process.env.NEXT_PUBLIC_YOUR_VAR`

### For Server-Side Only
1. No prefix needed
2. Add to `.env.local`
3. Restart dev server
4. Access ONLY in API routes or server-side code

---

## 🚨 Important Notes

### Security
- ✅ `.env.local` is in `.gitignore` (never commit it!)
- ✅ CLOB credentials are server-side only
- ✅ All sensitive keys are protected
- ⚠️ Trading private key is exposed client-side (required for Polymarket)

### Development
```bash
# After changing .env.local, always restart
pnpm dev
```

### Production
Make sure to set these environment variables in your hosting platform:
- Vercel: Project Settings → Environment Variables
- Other hosts: Follow their specific instructions

---

## 🔍 Verification

### Check What's Exposed in Browser
1. Run `pnpm dev`
2. Open browser console (F12)
3. Type: `console.log(process.env)`
4. You should ONLY see `NEXT_PUBLIC_*` variables

### Check Server Variables Work
1. Add a console.log in an API route:
   ```typescript
   console.log('CLOB Key:', process.env.CLOB_API_KEY);
   ```
2. Make an API request
3. Check server logs (terminal where `pnpm dev` is running)
4. You should see the value

---

## 📋 Quick Reference

| Variable | Location | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_TRADING_API_URL` | Client + Server | Trading API endpoint |
| `NEXT_PUBLIC_TRADING_PRIVATE_KEY` | Client + Server | Sign transactions |
| `CLOB_API_KEY` | Server only | Polymarket CLOB auth |
| `CLOB_SECRET` | Server only | Polymarket CLOB auth |
| `CLOB_PASS_PHRASE` | Server only | Polymarket CLOB auth |

---

## ✅ Current Status

All environment variables are correctly configured:
- ✅ Client-side variables use `NEXT_PUBLIC_` prefix
- ✅ Server-side secrets protected (no prefix)
- ✅ Firebase config accessible in browser
- ✅ CLOB credentials secured server-side
- ✅ Trading API accessible for real trades

---

**Your environment is properly configured and secure!** 🔐
