export interface Position {
  id: string;
  orderID: string; // Original buy order ID - required for selling
  tokenId: string; // Token ID for this position - required for selling
  marketId: string;
  marketQuestion: string;
  marketSlug?: string; // Market slug for fetching updates
  eventImage?: string; // Event image URL
  polymarketUrl?: string; // Full Polymarket URL for this market
  side: 'YES' | 'NO';
  shares: number;
  avgPrice: number; // Price per share (0-1)
  currentPrice: number; // Current market price
  cost: number; // Total amount paid
  value: number; // Current value (shares * currentPrice)
  pnl: number; // Profit/Loss (value - cost)
  pnlPercent: number; // P&L percentage
  timestamp: number;
  thesis?: string; // User's reasoning for the trade
  closed?: boolean; // Whether position has been closed
  closedAt?: number; // Timestamp when position was closed
  exitPrice?: number; // Weighted average price at which position was closed
  exitOrderID?: string; // Order ID for the sell transaction
  originalShares?: number; // Original shares before closing (for display)
  exitNotes?: string; // Notes explaining why the position was closed
  totalSoldValue?: number; // Total USD received from all sells (for weighted average exit price)
  totalSoldShares?: number; // Total shares sold across all partial sells
}

export interface Trade {
  id: string;
  marketId: string;
  marketQuestion: string;
  side: 'YES' | 'NO';
  action: 'BUY' | 'SELL';
  shares: number;
  price: number; // Price per share
  total: number; // Total transaction amount
  timestamp: number;
  thesis?: string; // User's reasoning for the trade
}

export interface Portfolio {
  id?: string; // Firestore document ID
  userId?: string; // For multi-user support
  balance: number; // Available cash
  positions: Position[];
  trades: Trade[];
  totalValue: number; // balance + sum of position values
  totalPnL: number; // Total unrealized P&L
  totalPnLPercent: number; // Total P&L percentage
  initialBalance: number; // Starting balance for reset tracking
  createdAt?: number; // Portfolio creation timestamp
  updatedAt?: number; // Last update timestamp
  pnlHistory?: PerformanceSnapshot[]; // P&L snapshots over time
}

export interface PerformanceSnapshot {
  timestamp: number;
  balance: number;
  totalValue: number;
  totalPnL: number;
}

export interface PortfolioStats {
  totalTrades: number;
  totalBuys: number;
  totalSells: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgTradeSize: number;
  largestWin: number;
  largestLoss: number;
  totalVolume: number;
}
