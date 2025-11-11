import type { NextApiRequest, NextApiResponse } from 'next';
import { portfolioService } from '@/lib/portfolioService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const userId = 'dogmatic1';

    // Get or create portfolio
    console.log('📖 Getting portfolio for:', userId);
    const portfolio = await portfolioService.getOrCreatePortfolio(userId, 500);
    console.log('✅ Portfolio loaded:', portfolio);

    // Add a test trade
    const testTrade = {
      id: Date.now().toString(),
      marketId: 'test_market_123',
      marketQuestion: 'Test Question?',
      side: 'YES' as const,
      action: 'BUY' as const,
      shares: 100,
      price: 0.55,
      total: 55,
      timestamp: Date.now(),
      thesis: 'This is a test trade',
    };

    portfolio.trades.push(testTrade);
    portfolio.balance -= 55;

    // Save portfolio
    console.log('📝 Saving portfolio with test trade...');
    await portfolioService.savePortfolio(userId, portfolio);
    console.log('✅ Portfolio saved successfully');

    // Read it back
    console.log('📖 Reading portfolio back...');
    const savedPortfolio = await portfolioService.getOrCreatePortfolio(userId, 500);
    console.log('✅ Portfolio read back:', savedPortfolio);

    res.status(200).json({
      success: true,
      message: 'Portfolio test passed!',
      portfolio: savedPortfolio,
      tradesCount: savedPortfolio.trades.length,
    });
  } catch (error) {
    console.error('❌ Portfolio test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
