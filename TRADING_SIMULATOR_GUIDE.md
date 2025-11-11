# Polymarket Trading Simulator - Enhanced Version

## Overview

This is a sophisticated paper trading simulator for Polymarket markets that allows you to practice trading with virtual money ($5,000 starting balance). The simulator now includes advanced features like trade thesis tracking, portfolio persistence with Firestore, trade history, and comprehensive analytics.

## New Features

### 1. **Trade Thesis & Notes**
- Every trade you make can include a **thesis** - your reasoning for making the trade
- Your thesis is saved with each position and trade
- Review your thesis later to understand your decision-making process
- Perfect for learning and improving your trading strategy

### 2. **Portfolio Reset**
- Reset your portfolio to starting balance ($5,000) at any time
- Clears all positions and trades
- Useful for starting fresh or practicing different strategies

### 3. **Trade History**
- Complete history of all your trades (BUY/SELL)
- Shows trade details: shares, price, total amount
- Displays your thesis for each trade
- Sorted by most recent first

### 4. **Position Tracking with Thesis**
- View all open positions with real-time P&L
- See your original thesis for each position
- Track average price, current price, and profit/loss
- Automatic position aggregation when buying multiple times

### 5. **Firestore Integration (Ready)**
- Firebase/Firestore service layer built for portfolio persistence
- Real-time sync capabilities
- Multi-portfolio support
- Performance snapshots for analytics

## How to Use

### Search for Markets
1. Enter a Polymarket event slug (e.g., "trump-popular-vote-2024")
2. Click "Search Market"
3. View all available markets for that event

### Make a Trade
1. Click "Trade" on any market outcome (YES or NO)
2. Enter the dollar amount you want to trade
3. **Add your thesis** - explain why you're making this trade
4. Click BUY to open a position or SELL to close/reduce a position

### Track Your Portfolio
- **Balance**: Your available cash
- **Total Value**: Cash + value of all positions
- **P&L**: Your total profit/loss across all positions

### View Trade History
- Scroll down to see your complete trade history
- Each trade shows BUY/SELL, YES/NO side, date, and your thesis
- Review past decisions to improve future trades

### Reset Portfolio
- Click "Reset Portfolio" button in the top right
- Confirm to clear all positions and trades
- Starts fresh with $5,000

## Firebase Setup (Optional)

To enable portfolio persistence across sessions:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)

2. Enable Firestore Database:
   - Go to Firestore Database
   - Click "Create database"
   - Start in production mode (or test mode for development)

3. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

4. Add your Firebase configuration to `.env.local`:
   - Get config from Firebase Console > Project Settings > General
   - Copy the firebaseConfig values

5. Update `firestore.rules` for production:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /portfolios/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

6. Deploy Firestore rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

## Data Schema

### Portfolio Structure
```typescript
{
  userId: string
  balance: number
  positions: Position[]
  trades: Trade[]
  totalValue: number
  totalPnL: number
  totalPnLPercent: number
  initialBalance: number
  createdAt: timestamp
  updatedAt: timestamp
}
```

### Trade Structure
```typescript
{
  id: string
  marketId: string
  marketQuestion: string
  side: 'YES' | 'NO'
  action: 'BUY' | 'SELL'
  shares: number
  price: number
  total: number
  timestamp: number
  thesis?: string  // NEW
}
```

### Position Structure
```typescript
{
  id: string
  marketId: string
  marketQuestion: string
  side: 'YES' | 'NO'
  shares: number
  avgPrice: number
  currentPrice: number
  cost: number
  value: number
  pnl: number
  pnlPercent: number
  timestamp: number
  thesis?: string  // NEW
}
```

## Development

```bash
# Install dependencies (if not already installed)
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Tips for Better Trading

1. **Always write a thesis**: Forces you to think through your trades
2. **Review your history**: Learn from past decisions
3. **Track your P&L**: Understand which strategies work
4. **Reset when needed**: Practice different approaches
5. **Use real market data**: Polymarket prices update in real-time

## Architecture

### Key Files
- `components/TradingSimulator.tsx` - Main simulator component
- `types/trading.ts` - TypeScript interfaces
- `lib/firebase.ts` - Firebase initialization
- `lib/portfolioService.ts` - Firestore operations
- `pages/api/events.ts` - Polymarket API integration

### Design Principles
- Clean, modern UI inspired by Polymarket and Kalshi
- San Francisco system font for readability
- Real-time P&L calculations
- Mobile-responsive design
- Smooth animations and transitions

## Future Enhancements

- [ ] User authentication (Firebase Auth)
- [ ] Multiple portfolios per user
- [ ] Portfolio analytics dashboard with charts
- [ ] Performance metrics (win rate, avg trade size, etc.)
- [ ] Export trade history to CSV
- [ ] Leaderboard (social features)
- [ ] Price alerts and notifications
- [ ] Advanced order types (limit orders, stop loss)

## Support

For issues or questions, check the [GitHub repository](https://github.com/yourusername/dogmatic).

---

Built with Next.js, TypeScript, Firebase, and ❤️
