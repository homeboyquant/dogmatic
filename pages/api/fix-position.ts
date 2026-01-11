import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    userId,
    positionId,
    action = 'fix', // 'fix', 'close', or 'recalculate'
    // For manual fix
    exitPrice,
    // For close with weighted average
    totalSoldShares,
    totalSoldValue,
    originalShares,
  } = req.body;

  if (!userId || !positionId) {
    return res.status(400).json({ error: 'Missing userId or positionId' });
  }

  try {
    const docRef = doc(db, 'portfolios', userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const portfolio = docSnap.data();
    const position = portfolio.positions.find((p: any) => p.id === positionId);

    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }

    let updatedPositions;
    let message;

    if (action === 'close') {
      // Close position using weighted average from multiple sells
      // Calculate from activity/trades data
      const positionTrades = (portfolio.trades || []).filter((t: any) =>
        t.marketId === position.marketId &&
        t.side === position.side
      );

      const sellTrades = positionTrades.filter((t: any) => t.action === 'SELL');
      const buyTrades = positionTrades.filter((t: any) => t.action === 'BUY');

      // Calculate totals from trades
      const totalBoughtShares = buyTrades.reduce((sum: number, t: any) => sum + t.shares, 0);
      const totalBoughtValue = buyTrades.reduce((sum: number, t: any) => sum + t.total, 0);
      const calcTotalSoldShares = sellTrades.reduce((sum: number, t: any) => sum + t.shares, 0);
      const calcTotalSoldValue = sellTrades.reduce((sum: number, t: any) => sum + t.total, 0);

      const useOriginalShares = originalShares || totalBoughtShares;
      const useTotalSoldShares = totalSoldShares || calcTotalSoldShares;
      const useTotalSoldValue = totalSoldValue || calcTotalSoldValue;

      const weightedAvgExitPrice = useTotalSoldValue / useTotalSoldShares;
      const avgEntryPrice = totalBoughtValue / totalBoughtShares;
      const totalCost = avgEntryPrice * useOriginalShares;
      const realizedPnL = useTotalSoldValue - totalCost;

      console.log('🔧 Closing position from activity:', {
        positionId,
        question: position.marketQuestion,
        buyTrades: buyTrades.length,
        sellTrades: sellTrades.length,
        totalBoughtShares,
        totalBoughtValue,
        calcTotalSoldShares,
        calcTotalSoldValue,
        useOriginalShares,
        useTotalSoldShares,
        useTotalSoldValue,
        avgEntryPrice,
        weightedAvgExitPrice,
        totalCost,
        realizedPnL,
      });

      updatedPositions = portfolio.positions.map((p: any) => {
        if (p.id === positionId) {
          return {
            ...p,
            closed: true,
            closedAt: Date.now(),
            exitPrice: weightedAvgExitPrice,
            originalShares: useOriginalShares,
            shares: useOriginalShares,
            avgPrice: avgEntryPrice,
            cost: totalCost,
            value: 0,
            pnl: realizedPnL,
            pnlPercent: (realizedPnL / totalCost) * 100,
            totalSoldValue: useTotalSoldValue,
            totalSoldShares: useTotalSoldShares,
          };
        }
        return p;
      });

      message = `Position closed: ${sellTrades.length} sells, Avg Exit: $${weightedAvgExitPrice.toFixed(3)}, PnL: $${realizedPnL.toFixed(2)} (${((realizedPnL / totalCost) * 100).toFixed(2)}%)`;
    } else {
      // Original simple fix with single exit price
      if (!exitPrice) {
        return res.status(400).json({ error: 'exitPrice required for fix action' });
      }

      const total = position.shares * exitPrice;
      const pnl = total - position.cost;
      const pnlPercent = (pnl / position.cost) * 100;

      updatedPositions = portfolio.positions.map((p: any) => {
        if (p.id === positionId) {
          return {
            ...p,
            exitPrice,
            currentPrice: exitPrice,
            value: total,
            pnl,
            pnlPercent,
          };
        }
        return p;
      });

      message = `Position updated: Exit price ${exitPrice}, PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`;
    }

    await updateDoc(docRef, {
      positions: updatedPositions,
      updatedAt: Date.now(),
    });

    const updatedPosition = updatedPositions.find((p: any) => p.id === positionId);

    return res.status(200).json({
      success: true,
      message,
      position: updatedPosition,
    });
  } catch (error: any) {
    console.error('Error fixing position:', error);
    return res.status(500).json({ error: error.message });
  }
}
