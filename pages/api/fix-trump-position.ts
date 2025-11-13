import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = 'dogmatic1';
  const positionId = '1762871423243'; // Trump drug boat strike

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

    // Fetch current market data
    const marketRes = await fetch(`https://gamma-api.polymarket.com/markets?slug=${position.marketSlug}`);
    const markets = await marketRes.json();

    if (markets.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = markets[0];
    const correctExitPrice = parseFloat(market.bestBid); // 0.72

    console.log('Current state:', {
      question: position.marketQuestion,
      avgPrice: position.avgPrice,
      currentExitPrice: position.exitPrice,
      marketBestBid: market.bestBid,
      correctExitPrice,
    });

    // Calculate correct values
    const correctTotal = position.shares * correctExitPrice;
    const correctPnl = correctTotal - position.cost;
    const correctPnlPercent = (correctPnl / position.cost) * 100;

    // Find SELL trade
    const sellTrade = portfolio.trades?.find((t: any) =>
      t.marketQuestion === position.marketQuestion &&
      t.action === 'SELL' &&
      t.side === position.side
    );

    // Calculate balance adjustment
    const oldTotal = position.shares * position.exitPrice;
    const balanceDiff = correctTotal - oldTotal;
    const newBalance = portfolio.balance + balanceDiff;

    // Update positions
    const updatedPositions = portfolio.positions.map((p: any) => {
      if (p.id === positionId) {
        return {
          ...p,
          exitPrice: correctExitPrice,
          currentPrice: correctExitPrice,
          value: correctTotal,
          pnl: correctPnl,
          pnlPercent: correctPnlPercent,
        };
      }
      return p;
    });

    // Update trades
    const updatedTrades = portfolio.trades?.map((t: any) => {
      if (sellTrade && t.id === sellTrade.id) {
        return {
          ...t,
          price: correctExitPrice,
          total: correctTotal,
        };
      }
      return t;
    }) || [];

    await updateDoc(docRef, {
      positions: updatedPositions,
      trades: updatedTrades,
      balance: newBalance,
      updatedAt: Date.now(),
    });

    return res.status(200).json({
      success: true,
      message: 'Trump drug boat strike position fixed',
      before: {
        exitPrice: position.exitPrice,
        total: oldTotal,
        pnl: position.pnl,
        balance: portfolio.balance,
      },
      after: {
        exitPrice: correctExitPrice,
        total: correctTotal,
        pnl: correctPnl,
        pnlPercent: correctPnlPercent,
        balance: newBalance,
        balanceDiff,
      },
    });
  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
