export interface JournalEntry {
  id: string;
  createdAt: string;
  updatedAt: string;

  // Polymarket Event Info
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  eventImage?: string;
  marketQuestion: string;

  // Trade Details
  position: 'yes' | 'no';
  entryPrice: number;
  size: number;
  entryDate: string;

  // Journal Content
  thesis: string; // Why you have edge
  reasoning: string; // Detailed analysis
  edge: string; // Specific edge identified
  confidence: number; // 1-10 scale

  // Trade Outcome (optional, filled when closed)
  exitPrice?: number;
  exitDate?: string;
  outcome?: 'win' | 'loss' | 'breakeven';
  profitLoss?: number;
  profitLossPercent?: number;

  // Status
  status: 'open' | 'closed';

  // Tags for organization
  tags: string[];

  // Notes
  notes?: string;
}

export interface JournalFilters {
  status?: 'open' | 'closed' | 'all';
  position?: 'yes' | 'no' | 'all';
  outcome?: 'win' | 'loss' | 'breakeven' | 'all';
  searchQuery?: string;
  tags?: string[];
  dateFrom?: string;
  dateTo?: string;
}

export interface JournalStats {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  totalWins: number;
  totalLosses: number;
  winRate: number;
  totalProfitLoss: number;
  avgProfitLoss: number;
  bestTrade: number;
  worstTrade: number;
}
