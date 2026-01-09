# Environment Variables Setup Fix

## 🔧 Issue

The CLOB Portfolio API was failing with "unauthorized" errors because it needs proper credentials from your `.env.local` file.

## ✅ Required Environment Variables

Make sure you have **ALL** of these in your `.env.local`:

```env
# CLOB API Credentials (with NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_CLOB_API_KEY=your_clob_api_key_here
NEXT_PUBLIC_CLOB_SECRET=your_clob_secret_here
NEXT_PUBLIC_CLOB_PASS_PHRASE=your_clob_passphrase_here

# Wallet Private Key
NEXT_PUBLIC_TRADING_PRIVATE_KEY=0xYourPrivateKeyHere

# Wallet Address (for USDC balance)
NEXT_PUBLIC_WALLET_ADDRESS=0xYourWalletAddress

# Trading API
NEXT_PUBLIC_TRADING_API_URL=https://homeboyapi-318538657595.me-west1.run.app
```

✅ **All variables use `NEXT_PUBLIC_` prefix** for consistency!

## 🎯 Key Points

1. **Use the SAME credentials as homeboy_monitor**
   - Copy the API credentials from homeboy_monitor's `.env.local`
   - But add `NEXT_PUBLIC_` prefix to match your project's convention

2. **Variable Naming Convention**
   - This project uses: `NEXT_PUBLIC_` prefix for all env vars
   - homeboy_monitor uses: No prefix (e.g., `CLOB_API_KEY`)
   - **Both work!** The API has been updated to use `NEXT_PUBLIC_` prefixed vars

3. **No quotes needed**
   - Values don't need quotes: `NEXT_PUBLIC_CLOB_API_KEY=abc123`
   - Next.js handles them automatically

## 🔍 How to Get These Values

### From homeboy_monitor:

```bash
cd homeboy_monitor
cat .env.local
```

Copy these values and add `NEXT_PUBLIC_` prefix:
- `CLOB_API_KEY` → `NEXT_PUBLIC_CLOB_API_KEY`
- `CLOB_SECRET` → `NEXT_PUBLIC_CLOB_SECRET`
- `CLOB_PASS_PHRASE` → `NEXT_PUBLIC_CLOB_PASS_PHRASE`
- `WALLET_PRIVATE_KEY` → `NEXT_PUBLIC_TRADING_PRIVATE_KEY`
- `WALLET_PUBLIC_ADDRESS` → `NEXT_PUBLIC_WALLET_ADDRESS`

### Paste into your project:

```bash
cd d:/dogmatic
# Edit .env.local and paste the values
```

## 🚀 After Setting Variables

1. **Restart your dev server:**
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

2. **Check the browser console** for these logs:
   ```
   🔍 Checking credentials...
   API Key exists: true
   Secret exists: true
   Passphrase exists: true
   Private Key exists: true
   🔑 Creating wallet from private key...
   🔑 Using wallet address: 0x...
   📊 Fetching open orders from CLOB...
   ✅ Fetched X total trades
   ```

3. **If you see these logs, it's working!** ✅

## ❌ Troubleshooting

### Error: "Missing CLOB credentials"
**Solution:** Make sure `CLOB_API_KEY`, `CLOB_SECRET`, and `CLOB_PASS_PHRASE` are set

### Error: "WALLET_PRIVATE_KEY not configured"
**Solution:** Add `WALLET_PRIVATE_KEY='0x...'` to `.env.local`

### Error: "Unauthorized" or 401/403
**Solution:**
- Double-check your credentials match homeboy_monitor EXACTLY
- Make sure there are no extra spaces or newlines
- Wrap values in quotes

### Error: "Failed to fetch CLOB portfolio"
**Solution:**
- Check console logs to see which credential is missing
- Restart dev server after adding credentials
- Verify credentials work in homeboy_monitor first

## 📋 Example .env.local

Here's a template (replace with your actual values):

```env
# Trading API
NEXT_PUBLIC_TRADING_API_URL=https://homeboyapi-318538657595.me-west1.run.app
NEXT_PUBLIC_TRADING_PRIVATE_KEY=0x123456...

# Polymarket CLOB API Credentials
NEXT_PUBLIC_CLOB_API_KEY=abc123...
NEXT_PUBLIC_CLOB_SECRET=xyz789...
NEXT_PUBLIC_CLOB_PASS_PHRASE=mypassphrase

# Polymarket Wallet Address
NEXT_PUBLIC_WALLET_ADDRESS=0xYourWalletAddress

# Other existing variables (Firebase, etc.)...
```

✅ **All variables consistently use `NEXT_PUBLIC_` prefix!**

## ✅ Verification

Once setup correctly, you should see:
- Portfolio loads with your positions
- USDC balance shows in green badge
- No "unauthorized" errors in console
- Positions match what you see in homeboy_monitor

---

**Remember:** The credentials MUST be the same as homeboy_monitor since they both access the same Polymarket account! 🔑
