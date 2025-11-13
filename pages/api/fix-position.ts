import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, positionId, exitPrice } = req.body;

  if (!userId || !positionId || !exitPrice) {
    return res.status(400).json({ error: 'Missing required fields' });
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

    // Calculate correct values
    const total = position.shares * exitPrice;
    const pnl = total - position.cost;
    const pnlPercent = (pnl / position.cost) * 100;

    // Update position
    const updatedPositions = portfolio.positions.map((p: any) => {
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

    // Update the corresponding SELL trade
    const updatedTrades = portfolio.trades.map((t: any) => {
      if (t.id === positionId && t.action === 'SELL') {
        return {
          ...t,
          price: exitPrice,
          total,
        };
      }
      return t;
    });

    // Recalculate balance
    const sellTrade = portfolio.trades.find((t: any) => t.id === positionId && t.action === 'SELL');
    const balanceDiff = total - (sellTrade?.total || 0);
    const newBalance = portfolio.balance + balanceDiff;

    await updateDoc(docRef, {
      positions: updatedPositions,
      trades: updatedTrades,
      balance: newBalance,
      updatedAt: Date.now(),
    });

    return res.status(200).json({
      success: true,
      message: `Position updated: Exit price ${exitPrice}, PnL: $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`,
      position: {
        exitPrice,
        total,
        pnl,
        pnlPercent,
      }
    });
  } catch (error: any) {
    console.error('Error fixing position:', error);
    return res.status(500).json({ error: error.message });
  }
}
