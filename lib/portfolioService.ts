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

      // Clean undefined values from portfolio data (Firestore doesn't accept undefined)
      const cleanPortfolioData = JSON.parse(JSON.stringify({
        ...portfolio,
        updatedAt: Date.now(),
        // Clean positions array
        positions: portfolio.positions.map(p => {
          const cleanPos: any = {};
          Object.keys(p).forEach(key => {
            if ((p as any)[key] !== undefined) {
              cleanPos[key] = (p as any)[key];
            }
          });
          return cleanPos;
        }),
        // Clean trades array
        trades: portfolio.trades.map(t => {
          const cleanTrade: any = {};
          Object.keys(t).forEach(key => {
            if ((t as any)[key] !== undefined) {
              cleanTrade[key] = (t as any)[key];
            }
          });
          return cleanTrade;
        }),
      }));

      await setDoc(docRef, cleanPortfolioData);
      console.log('✅ Portfolio saved to Firestore');
    } catch (error) {
      console.error('❌ Error saving portfolio to Firestore:', error);
      throw error; // Re-throw so the error handler can show alert
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

  async deleteTradeAndPosition(userId: string, positionId: string): Promise<Portfolio> {
    try {
      const portfolio = await this.getOrCreatePortfolio(userId);

      // Find the position to delete
      const positionToDelete = portfolio.positions.find(p => p.id === positionId);

      if (!positionToDelete) {
        console.error(`❌ Position not found: ${positionId}`);
        throw new Error('Position not found');
      }

      console.log(`🗑️ Deleting position: ${positionToDelete.marketQuestion}`);
      console.log(`💰 Original cost: $${positionToDelete.cost.toFixed(2)}`);

      // Remove the position
      portfolio.positions = portfolio.positions.filter(p => p.id !== positionId);

      // Remove all trades related to this position (both BUY and SELL)
      const tradesToRemove = portfolio.trades.filter(t => t.marketId === positionToDelete.marketId);
      console.log(`🗑️ Removing ${tradesToRemove.length} trade(s) for this position`);

      // Calculate total money spent/received on this position
      let totalMoneyIn = 0;
      let totalMoneyOut = 0;

      tradesToRemove.forEach(trade => {
        if (trade.action === 'BUY') {
          totalMoneyIn += trade.total;
          console.log(`  📉 BUY trade: -$${trade.total.toFixed(2)}`);
        } else if (trade.action === 'SELL') {
          totalMoneyOut += trade.total;
          console.log(`  📈 SELL trade: +$${trade.total.toFixed(2)}`);
        }
      });

      // Net effect: if we spent $100 and got back $81, we lost $19
      // To reverse: add back the $19 we lost
      const netEffect = totalMoneyOut - totalMoneyIn;
      console.log(`💸 Net effect of position: ${netEffect >= 0 ? '+' : ''}$${netEffect.toFixed(2)}`);
      console.log(`🔄 Reversing by adjusting balance: ${netEffect >= 0 ? '-' : '+'}$${Math.abs(netEffect).toFixed(2)}`);

      // Remove the trades
      portfolio.trades = portfolio.trades.filter(t => t.marketId !== positionToDelete.marketId);

      // Adjust balance to reverse the net effect
      portfolio.balance = portfolio.balance - netEffect;

      console.log(`✅ Updated balance: $${portfolio.balance.toFixed(2)}`);

      // Save the updated portfolio
      await this.savePortfolio(userId, portfolio);
      console.log('✅ Trade and position deleted, portfolio adjusted');

      return portfolio;
    } catch (error) {
      console.error('❌ Error deleting trade:', error);
      throw error;
    }
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
