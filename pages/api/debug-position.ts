import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, action } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const docRef = doc(db, 'portfolios', userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const portfolio = docSnap.data();

    // Find MrBeast position
    const mrBeastPos = portfolio.positions?.find((p: any) =>
      (p.marketSlug === 'of-views-of-next-mrbeast-video-on-week-1-275' ||
       (p.marketQuestion?.toLowerCase().includes('mrbeast') &&
        p.marketQuestion?.toLowerCase().includes('video') &&
        p.closed === true))
    );

    if (!mrBeastPos) {
      return res.status(404).json({
        error: 'MrBeast position not found',
        allPositions: portfolio.positions?.map((p: any) => ({
          question: p.marketQuestion,
          slug: p.marketSlug,
          closed: p.closed
        }))
      });
    }

    // Fetch current market data
    let marketData = null;
    let orderbookData = null;

    if (mrBeastPos.marketSlug) {
      try {
        const marketRes = await fetch(`https://gamma-api.polymarket.com/markets?slug=${mrBeastPos.marketSlug}`);
        const markets = await marketRes.json();

        if (markets.length > 0) {
          marketData = markets[0];

          // Get orderbook if available
          if (marketData.clobTokenIds) {
            const tokenIds = JSON.parse(marketData.clobTokenIds);
            const tokenIndex = mrBeastPos.side.toLowerCase() === 'yes' ? 0 : 1;
            const tokenId = tokenIds[tokenIndex];

            const obRes = await fetch(`https://clob.polymarket.com/book?token_id=${tokenId}`);
            orderbookData = await obRes.json();
          }
        }
      } catch (error) {
        console.error('Error fetching market data:', error);
      }
    }

    const positionInfo = {
      id: mrBeastPos.id,
      question: mrBeastPos.marketQuestion,
      slug: mrBeastPos.marketSlug,
      side: mrBeastPos.side,
      shares: mrBeastPos.shares,
      avgPrice: mrBeastPos.avgPrice,
      cost: mrBeastPos.cost,
      exitPrice: mrBeastPos.exitPrice,
      currentPrice: mrBeastPos.currentPrice,
      pnl: mrBeastPos.pnl,
      pnlPercent: mrBeastPos.pnlPercent,
      closed: mrBeastPos.closed,
      closedAt: mrBeastPos.closedAt,
    };

    const market = {
      bestBid: marketData?.bestBid,
      bestAsk: marketData?.bestAsk,
      outcomePrices: marketData?.outcomePrices,
      orderbookTopBid: orderbookData?.bids?.[0]?.price,
      orderbookTopAsk: orderbookData?.asks?.[0]?.price,
    };

    // If action is 'fix', update the position
    if (action === 'fix') {
      const correctExitPrice = 0.97;
      const correctTotal = mrBeastPos.shares * correctExitPrice;
      const correctPnl = correctTotal - mrBeastPos.cost;
      const correctPnlPercent = (correctPnl / mrBeastPos.cost) * 100;

      // Find SELL trade
      const sellTrade = portfolio.trades?.find((t: any) =>
        t.marketQuestion === mrBeastPos.marketQuestion &&
        t.action === 'SELL' &&
        t.side === mrBeastPos.side
      );

      // Calculate balance adjustment
      const oldTotal = mrBeastPos.shares * mrBeastPos.exitPrice;
      const balanceDiff = correctTotal - oldTotal;
      const newBalance = portfolio.balance + balanceDiff;

      // Update positions
      const updatedPositions = portfolio.positions.map((p: any) => {
        if (p.id === mrBeastPos.id) {
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
        message: 'Position fixed successfully',
        before: positionInfo,
        after: {
          exitPrice: correctExitPrice,
          total: correctTotal,
          pnl: correctPnl,
          pnlPercent: correctPnlPercent,
        },
        balanceAdjustment: {
          old: portfolio.balance,
          new: newBalance,
          diff: balanceDiff,
        },
      });
    }

    // Otherwise just return debug info
    return res.status(200).json({
      position: positionInfo,
      market,
      analysis: {
        boughtAt: mrBeastPos.avgPrice,
        shouldSellAt: 0.97,
        currentlyRecorded: mrBeastPos.exitPrice,
        needsFix: Math.abs(mrBeastPos.exitPrice - 0.97) > 0.001,
      },
      instruction: 'To fix, send POST with { userId, action: "fix" }',
    });
  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
