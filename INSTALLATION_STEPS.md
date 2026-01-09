# Installation Steps for CLOB Portfolio System

## 📦 Install Required Dependency

The new CLOB Portfolio system requires the `@polymarket/clob-client` package. Install it:

```bash
pnpm add @polymarket/clob-client
```

✅ **Already installed!** This package has been added to your dependencies.

## ✅ Verify Installation

After installing, check that it appears in `package.json`:

```json
{
  "dependencies": {
    "@polymarket/clob-client": "^latest",
    ...
  }
}
```

## 🔧 Environment Variables

Ensure these are set in `.env.local`:

```env
# CLOB API Credentials (from Polymarket)
CLOB_API_KEY=your_clob_api_key
CLOB_SECRET=your_clob_secret
CLOB_PASS_PHRASE=your_clob_passphrase

# Wallet Addresses
NEXT_PUBLIC_WALLET_ADDRESS=0xYourWalletAddress  # For USDC balance lookup on PolygonScan
NEXT_PUBLIC_TRADING_PRIVATE_KEY=0xYourPrivateKeyHere  # For signing transactions

# Trading API URL (homeboyapi)
NEXT_PUBLIC_TRADING_API_URL=https://homeboyapi-318538657595.me-west1.run.app
```

## 🚀 Start Development Server

```bash
npm run dev
```

## 🧪 Test the System

1. Open your browser to `http://localhost:3000`
2. Navigate to **Portfolio** section
3. You should see your positions loaded from Polymarket!
4. Three tabs available:
   - **Open Positions** (active)
   - **Closed Positions** (fully sold)
   - **P&L Chart**

## 🔍 Verify It's Working

Look for these console logs:

```
🔑 Using wallet address: 0x...
📊 Fetching open orders from CLOB...
📜 Fetching all trades from CLOB...
✅ Fetched X total trades
📊 Active positions: Y
📊 Closed positions: Z
🔍 Fetching market titles for N unique markets...
✅ Portfolio data compiled successfully
```

If you see these logs, everything is working! ✅

## ❌ Common Issues

### Issue: "Cannot find module '@polymarket/clob-client'"
**Solution**: Install the package:
```bash
npm install @polymarket/clob-client
```

### Issue: "Missing CLOB credentials"
**Solution**: Add credentials to `.env.local`:
```env
CLOB_API_KEY=...
CLOB_SECRET=...
CLOB_PASS_PHRASE=...
```

### Issue: "WALLET_PRIVATE_KEY not configured"
**Solution**: Add your private key:
```env
NEXT_PUBLIC_TRADING_PRIVATE_KEY=0x...
```

### Issue: No positions showing
**Possible causes:**
- You don't have any trades on Polymarket yet
- Wrong wallet address (check console logs)
- CLOB credentials are for a different account

### Issue: Sell fails with error
**Possible causes:**
- Trading API URL is wrong or unreachable
- Position was bought externally (order_id mismatch)
- Insufficient balance or network issues

## 📚 Additional Resources

- [CLOB Portfolio Documentation](./CLOB_PORTFOLIO_REIMAGINED.md)
- [Quick Start Guide](./CLOB_QUICK_START.md)
- [Polymarket CLOB Client Docs](https://www.npmjs.com/package/@polymarket/clob-client)

## 💡 Pro Tips

1. **Keep console open** - Useful logs will help debug issues
2. **Test with small position** - Make a small trade first to verify
3. **Compare with Polymarket.com** - Verify data matches your actual account
4. **Check network tab** - See actual API calls being made

---

## 🎉 You're All Set!

Once installed and configured, your CLOB Portfolio should:
- ✅ Display live USDC balance in header (like homeboy_monitor!)
- ✅ Auto-load positions from Polymarket
- ✅ Update every 30 seconds (positions + balance)
- ✅ Show active and closed positions
- ✅ Enable one-click selling

Enjoy your new portfolio system! 🚀

---

## 📸 What You'll See

**Header:**
```
CLOB Portfolio    💵 $523.45 USDC
                  5 active • 3 closed • 47 total trades
```

**Summary Cards:**
- Active Positions: 5
- Closed Positions: 3
- Total Trades: 47
- Realized P&L: +$42.18

**Position Cards:**
Each showing market title, outcome, size, prices, and a "🚀 Sell Fast" button!

All styled beautifully just like homeboy_monitor ✨
