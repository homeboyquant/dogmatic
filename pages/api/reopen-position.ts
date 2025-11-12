import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc, updateDoc, db } from '@/lib/firebase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, positionId } = req.body;

    if (!userId || !positionId) {
      return res.status(400).json({ error: 'userId and positionId are required' });
    }

    // Get current portfolio
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

    if (!position.closed) {
      return res.status(400).json({ error: 'Position is already open' });
    }

    // Calculate the amount to deduct from balance (the exit value)
    const exitValue = position.exitPrice * position.shares;

    // Update the position - remove closed status
    const updatedPositions = portfolio.positions.map((p: any) => {
      if (p.id === positionId) {
        const { closed, closedAt, exitPrice, ...reopenedPosition } = p;
        return {
          ...reopenedPosition,
          currentPrice: p.avgPrice, // Reset to entry price
        };
      }
      return p;
    });

    // Remove the closing trade
    const updatedTrades = portfolio.trades.filter((t: any) =>
      !(t.id === positionId && t.action === 'SELL')
    );

    // Update portfolio
    await updateDoc(docRef, {
      positions: updatedPositions,
      trades: updatedTrades,
      balance: portfolio.balance - exitValue,
      updatedAt: Date.now(),
    });

    res.status(200).json({
      success: true,
      message: 'Position reopened successfully',
      refundedAmount: exitValue,
    });
  } catch (error) {
    console.error('Error reopening position:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
