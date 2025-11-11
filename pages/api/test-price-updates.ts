import type { NextApiRequest, NextApiResponse } from 'next';
import { portfolioService } from '@/lib/portfolioService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const userId = 'dogmatic1';

    // Get portfolio
    const portfolio = await portfolioService.getOrCreatePortfolio(userId, 500);
    console.log('📊 Portfolio has', portfolio.positions.length, 'positions');

    // Test price fetching for each position
    const priceUpdates = [];

    for (const position of portfolio.positions) {
      if (!position.marketSlug) {
        console.warn('⚠️ Position missing marketSlug:', position.marketQuestion);
        priceUpdates.push({
          question: position.marketQuestion,
          error: 'Missing marketSlug',
          entryPrice: position.avgPrice,
          currentPrice: null,
        });
        continue;
      }

      try {
        console.log(`🔄 Fetching price for: ${position.marketSlug}`);
        const response = await fetch(`https://gamma-api.polymarket.com/markets?slug=${position.marketSlug}`);
        const data = await response.json();

        if (data.length > 0) {
          const market = data[0];
          const outcomeIndex = position.side === 'YES' ? 0 : 1;
          const prices = JSON.parse(market.outcomePrices);
          const currentPrice = parseFloat(prices[outcomeIndex]);

          console.log(`✅ ${position.marketQuestion.substring(0, 50)}...`);
          console.log(`   Entry: $${position.avgPrice}, Current: $${currentPrice}`);
          console.log(`   PnL: $${((currentPrice - position.avgPrice) * position.shares).toFixed(2)}`);

          priceUpdates.push({
            question: position.marketQuestion,
            side: position.side,
            entryPrice: position.avgPrice,
            currentPrice: currentPrice,
            shares: position.shares,
            pnl: (currentPrice - position.avgPrice) * position.shares,
            pnlPercent: ((currentPrice - position.avgPrice) / position.avgPrice) * 100,
          });
        } else {
          console.warn('⚠️ No market data found for:', position.marketSlug);
          priceUpdates.push({
            question: position.marketQuestion,
            error: 'No market data found',
            entryPrice: position.avgPrice,
            currentPrice: null,
          });
        }
      } catch (error) {
        console.error('❌ Error fetching price:', error);
        priceUpdates.push({
          question: position.marketQuestion,
          error: error instanceof Error ? error.message : 'Unknown error',
          entryPrice: position.avgPrice,
          currentPrice: null,
        });
      }
    }

    res.status(200).json({
      success: true,
      portfolioPositions: portfolio.positions.length,
      priceUpdates,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
