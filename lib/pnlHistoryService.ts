/**
 * P&L History Service
 * Tracks P&L over time for visualization
 */

import { db } from './firebase';
import { collection, addDoc, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';

export interface PnLSnapshot {
  userId: string;
  timestamp: number;
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  openPositionsCount: number;
  closedPositionsCount: number;
}

class PnLHistoryService {
  private collectionName = 'pnlHistory';

  /**
   * Record a P&L snapshot
   */
  async recordSnapshot(snapshot: Omit<PnLSnapshot, 'timestamp'>): Promise<void> {
    try {
      const data: PnLSnapshot = {
        ...snapshot,
        timestamp: Date.now(),
      };

      await addDoc(collection(db, this.collectionName), {
        ...data,
        createdAt: Timestamp.fromDate(new Date()),
      });

      console.log('✅ P&L snapshot recorded:', data.totalPnL);
    } catch (error) {
      console.error('❌ Error recording P&L snapshot:', error);
    }
  }

  /**
   * Get P&L history for a user
   */
  async getHistory(userId: string, days: number = 30): Promise<PnLSnapshot[]> {
    try {
      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

      console.log(`📊 Fetching P&L history for user: ${userId}, cutoff: ${new Date(cutoffTime).toISOString()}`);

      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        where('timestamp', '>=', cutoffTime),
        orderBy('timestamp', 'asc')
      );

      const snapshot = await getDocs(q);
      const history: PnLSnapshot[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        console.log('📈 P&L snapshot:', {
          timestamp: new Date(data.timestamp).toISOString(),
          totalPnL: data.totalPnL,
        });
        history.push({
          userId: data.userId,
          timestamp: data.timestamp,
          totalPnL: data.totalPnL,
          realizedPnL: data.realizedPnL,
          unrealizedPnL: data.unrealizedPnL,
          openPositionsCount: data.openPositionsCount,
          closedPositionsCount: data.closedPositionsCount,
        });
      });

      console.log(`✅ Loaded ${history.length} P&L snapshots`);
      return history;
    } catch (error: any) {
      console.error('❌ Error loading P&L history:', error);
      if (error.code === 'failed-precondition') {
        console.error('🔥 Firestore index required! Check the error message for the index creation link.');
      }
      return [];
    }
  }

  /**
   * Get simplified data for charting (timestamp and totalPnL only)
   */
  async getChartData(userId: string, days: number = 30): Promise<{ timestamp: number; pnl: number }[]> {
    const history = await this.getHistory(userId, days);
    return history.map(snapshot => ({
      timestamp: snapshot.timestamp,
      pnl: snapshot.totalPnL,
    }));
  }
}

export const pnlHistoryService = new PnLHistoryService();
