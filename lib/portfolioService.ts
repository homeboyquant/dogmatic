import { doc, getDoc, setDoc, db } from './firebase';
import type { Portfolio, Trade, PortfolioStats } from '@/types/trading';

const COLLECTION = 'portfolios';

export class PortfolioService {
  async getOrCreatePortfolio(userId: string, initialBalance: number = 5000): Promise<Portfolio> {
    try {
      const docRef = doc(db, COLLECTION, userId);
      console.log(`📖 Attempting to load portfolio for userId: ${userId} from collection: ${COLLECTION}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as Portfolio;
        console.log(`✅ Portfolio loaded from Firestore - Trades: ${data.trades?.length || 0}, Balance: ${data.balance}`);
        return data;
      }

      // Create new portfolio
      console.log(`📝 No existing portfolio found - creating new one for userId: ${userId}`);
      const portfolio = this.getDefaultPortfolio(userId, initialBalance);
      await this.savePortfolio(userId, portfolio);
      console.log('✅ New portfolio created in Firestore');
      return portfolio;
    } catch (error) {
      console.error('❌ Error loading portfolio from Firestore:', error);
      return this.getDefaultPortfolio(userId, initialBalance);
    }
  }

  private getDefaultPortfolio(userId: string, initialBalance: number): Portfolio {
    return {
      userId,
      balance: initialBalance,
      positions: [],
      trades: [],
      totalValue: initialBalance,
      totalPnL: 0,
      totalPnLPercent: 0,
      initialBalance,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  async savePortfolio(userId: string, portfolio: Portfolio): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION, userId);

      const portfolioData = {
        ...portfolio,
        updatedAt: Date.now(),
      };

      await setDoc(docRef, portfolioData);
      console.log('✅ Portfolio saved to Firestore');
    } catch (error) {
      console.error('❌ Error saving portfolio to Firestore:', error);
    }
  }

  async recordTrade(userId: string, trade: Trade): Promise<void> {
    // Trades are stored in portfolio.trades array
    console.log('Trade recorded:', trade);
  }

  async resetPortfolio(userId: string, initialBalance: number = 5000): Promise<Portfolio> {
    const portfolio = this.getDefaultPortfolio(userId, initialBalance);
    await this.savePortfolio(userId, portfolio);
    console.log('✅ Portfolio reset in Firestore');
    return portfolio;
  }

  calculateStats(portfolio: Portfolio): PortfolioStats {
    const trades = portfolio.trades;
    const buys = trades.filter(t => t.action === 'BUY');
    const sells = trades.filter(t => t.action === 'SELL');

    return {
      totalTrades: trades.length,
      totalBuys: buys.length,
      totalSells: sells.length,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      avgTradeSize: trades.length > 0 ? trades.reduce((sum, t) => sum + t.total, 0) / trades.length : 0,
      largestWin: 0,
      largestLoss: 0,
      totalVolume: trades.reduce((sum, t) => sum + t.total, 0),
    };
  }
}

export const portfolioService = new PortfolioService();
