import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userId = 'dogmatic1';

  try {
    const docRef = doc(db, 'portfolios', userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const portfolio = docSnap.data();

    // Find Heat vs Pacers position
    const heatPacersPosition = portfolio.positions.find((p: any) =>
      p.marketQuestion?.toLowerCase().includes('heat') &&
      p.marketQuestion?.toLowerCase().includes('pacers')
    );

    if (!heatPacersPosition) {
      return res.status(404).json({ error: 'Heat vs Pacers position not found' });
    }

    if (heatPacersPosition.closed) {
      return res.status(200).json({
        message: 'Position is already closed',
        position: heatPacersPosition
      });
    }

    // Find related trades
    const positionTrades = (portfolio.trades || []).filter((t: any) =>
      t.marketId === heatPacersPosition.marketId &&
      t.side === heatPacersPosition.side
    );

    const sellTrades = positionTrades.filter((t: any) => t.action === 'SELL');
    const buyTrades = positionTrades.filter((t: any) => t.action === 'BUY');

    // Calculate totals from trades
    const totalBoughtShares = buyTrades.reduce((sum: number, t: any) => sum + t.shares, 0);
    const totalBoughtValue = buyTrades.reduce((sum: number, t: any) => sum + t.total, 0);
    const totalSoldShares = sellTrades.reduce((sum: number, t: any) => sum + t.shares, 0);
    const totalSoldValue = sellTrades.reduce((sum: number, t: any) => sum + t.total, 0);

    const avgEntryPrice = totalBoughtValue / totalBoughtShares;
    const weightedAvgExitPrice = totalSoldValue / totalSoldShares;
    const totalCost = avgEntryPrice * totalBoughtShares;
    const realizedPnL = totalSoldValue - totalCost;
    const netShares = totalBoughtShares - totalSoldShares;

    console.log('🔧 Closing Heat vs Pacers position:', {
      positionId: heatPacersPosition.id,
      question: heatPacersPosition.marketQuestion,
      buyTrades: buyTrades.length,
      sellTrades: sellTrades.length,
      totalBoughtShares,
      totalBoughtValue,
      totalSoldShares,
      totalSoldValue,
      avgEntryPrice,
      weightedAvgExitPrice,
      totalCost,
      realizedPnL,
      netShares,
    });

    // Update position to closed
    const updatedPositions = portfolio.positions.map((p: any) => {
      if (p.id === heatPacersPosition.id) {
        return {
          ...p,
          closed: true,
          closedAt: Date.now(),
          exitPrice: weightedAvgExitPrice,
          originalShares: totalBoughtShares,
          shares: totalBoughtShares,
          avgPrice: avgEntryPrice,
          cost: totalCost,
          value: 0,
          pnl: realizedPnL,
          pnlPercent: (realizedPnL / totalCost) * 100,
          totalSoldValue,
          totalSoldShares,
        };
      }
      return p;
    });

    // Update Firestore
    await updateDoc(docRef, {
      positions: updatedPositions,
      updatedAt: Date.now(),
    });

    const closedPosition = updatedPositions.find((p: any) => p.id === heatPacersPosition.id);

    return res.status(200).json({
      success: true,
      message: `Position closed: ${sellTrades.length} sells, Avg Exit: $${weightedAvgExitPrice.toFixed(3)}, P&L: $${realizedPnL.toFixed(2)} (${((realizedPnL / totalCost) * 100).toFixed(2)}%)`,
      position: closedPosition,
      details: {
        totalBoughtShares,
        totalSoldShares,
        netShares,
        avgEntryPrice,
        weightedAvgExitPrice,
        totalCost,
        totalSoldValue,
        realizedPnL,
        realizedPnLPercent: (realizedPnL / totalCost) * 100,
      }
    });
  } catch (error: any) {
    console.error('Error closing position:', error);
    return res.status(500).json({ error: error.message });
  }
}
