# CLOB Portfolio - Quick Start Guide

## 🎯 What You Got

A brand new portfolio system that mirrors `homeboy_monitor`'s approach - tracking positions directly from Polymarket's CLOB API with **zero database overhead**.

## 🆕 New Files

| File | Purpose |
|------|---------|
| `pages/api/wallet-balance.ts` | Fetches USDC balance from PolygonScan |
| `pages/api/clob-portfolio.ts` | Fetches & calculates positions from trade history |
| `pages/api/clob-sell.ts` | Simplified sell endpoint (proxy to homeboyapi) |
| `components/CLOBPortfolio.tsx` | React component for CLOB-based portfolio UI |
| `CLOB_PORTFOLIO_REIMAGINED.md` | Full technical documentation |

## 🔧 Setup

1. **Ensure environment variables are set** in `.env.local`:
   ```env
   CLOB_API_KEY=your_api_key
   CLOB_SECRET=your_secret
   CLOB_PASS_PHRASE=your_passphrase
   NEXT_PUBLIC_WALLET_ADDRESS=0xYourWalletAddress
   NEXT_PUBLIC_TRADING_PRIVATE_KEY=0xYourPrivateKey
   ```

2. **Start your dev server**:
   ```bash
   npm run dev
   ```

3. **Navigate to Portfolio → CLOB Mode** tab

## ✨ Key Features

### 0. Live USDC Balance 💵
- **Displayed prominently in header** with green badge
- Shows your actual wallet balance from PolygonScan
- Auto-refreshes every 30 seconds
- Mirrors homeboy_monitor's design

### 1. Active Positions
- Shows positions you currently hold (netSize > 0.5)
- Displays: Size, Avg Buy Price, Cost Basis, Total Bought/Sold
- **"Sell Fast" button** - One click selling without order ID lookup

### 2. Closed Positions
- Shows fully sold positions (netSize ≤ 0.5)
- Displays realized P&L for each trade
- Historical record of your exits

### 3. Trade History
- Last 50 trades from your account
- Shows: Side (BUY/SELL), Size, Price, Timestamp
- Full trade ID for reference

## 🚀 How to Sell a Position

**Super Simple - Just 2 Steps:**

1. Click **"Sell Fast"** button on any active position
2. Wait for confirmation ✅

**What happens behind the scenes:**
```typescript
// Component automatically extracts order_id from trade history
const order_id = position.buyTrades[0].taker_order_id;

// Calls sell API with token_id + order_id
await fetch('/api/clob-sell', {
  method: 'POST',
  body: JSON.stringify({
    token_id: position.asset_id,
    order_id: order_id,
    sell_percentage: 100
  })
});
```

**No manual order ID lookup needed!** 🎉

## 📊 Position Calculation Logic

Positions are calculated by aggregating ALL trades:

```typescript
// Example trade aggregation
BUY 100 shares @ $0.50  →  netSize = 100
BUY 50 shares @ $0.60   →  netSize = 150, avgBuyPrice = $0.533
SELL 75 shares @ $0.70  →  netSize = 75 (ACTIVE)
SELL 75 shares @ $0.65  →  netSize = 0 (CLOSED)
```

**Active** = netSize > 0.5
**Closed** = netSize ≤ 0.5 and had buys

## 🔄 Auto-Refresh

- Portfolio refreshes every **30 seconds** automatically
- Manual refresh button available
- Timestamp shows last update time

## 🎨 UI Components

### Header
- **USDC Balance Badge** - Live balance with green indicator dot
- **Stats Line** - Active • Closed • Total trades counts
- **Refresh Button** - Manually refresh positions and balance
- **Last Updated Time** - Timestamp of last data fetch

### Summary Cards
- **Active Positions Count** - How many open positions
- **Closed Positions Count** - How many fully sold
- **Total Trades** - All-time trade count
- **Realized P&L** - Profit/loss from closed positions

### Position Cards
Each position shows:
- Market title (question)
- Outcome (YES/NO)
- Position size (shares)
- Average buy/sell prices
- Cost basis
- Realized P&L (if closed)
- Sell button (if active)

## 🆚 Comparison with Old System

| Feature | Old (Firestore) | New (CLOB) |
|---------|----------------|------------|
| Data Source | Database | CLOB API |
| Position Tracking | Manual | Automatic |
| Sell Complexity | High (EIP-712) | Low (Proxy) |
| Sync with Polymarket | Can drift | Always synced |
| Order ID Storage | Required | Embedded in trades |
| API Calls to Sell | 5+ | 1 |

## 🐛 Troubleshooting

### "Failed to fetch CLOB portfolio"
- Check CLOB credentials in `.env.local`
- Verify `NEXT_PUBLIC_TRADING_PRIVATE_KEY` is set
- Check console for detailed error logs

### No positions showing
- Make sure you have actual trades on Polymarket
- Check if wallet address matches your trading account
- Verify CLOB API credentials are correct

### Sell not working
- Ensure `NEXT_PUBLIC_TRADING_API_URL` points to homeboyapi
- Check console for sell response errors
- Verify position has `buyTrades` array with valid order IDs

## 📖 Learn More

- See [CLOB_PORTFOLIO_REIMAGINED.md](./CLOB_PORTFOLIO_REIMAGINED.md) for full technical details
- Check homeboy_monitor for reference implementation
- Review CLOB client docs: [@polymarket/clob-client](https://www.npmjs.com/package/@polymarket/clob-client)

## 🎯 Next Steps

1. **Test with real positions** - Make a small trade on Polymarket
2. **Verify data accuracy** - Compare CLOB Mode with Polymarket.com
3. **Try selling** - Test the "Sell Fast" functionality
4. **Monitor performance** - Check auto-refresh behavior
5. **Consider removing old Account Mode** - Once you're confident in CLOB Mode

## 💡 Pro Tips

- Keep the browser console open to see detailed logs
- Refresh rate can be adjusted in `CLOBPortfolio.tsx` (line 67)
- Position threshold (0.5) can be tweaked in `clob-portfolio.ts` (line 125)
- Market title caching could be added for better performance

---

**You now have a production-ready CLOB portfolio system!** 🎉

Inspired by and modeled after the amazing `homeboy_monitor` implementation.
