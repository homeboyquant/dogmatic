import type { NextApiRequest, NextApiResponse } from 'next';
import { portfolioService } from '@/lib/portfolioService';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = 'dogmatic1';

  try {
    // Load portfolio
    const portfolio = await portfolioService.getOrCreatePortfolio(userId, 500);

    // Update the MrBeast position with correct slug
    const updatedPositions = portfolio.positions.map(pos => {
      if (pos.marketId === '665690') {
        return {
          ...pos,
          marketSlug: 'will-mrbeasts-next-video-get-less-than-70-million-views-on-week-1-594'
        };
      }
      return pos;
    });

    // Save updated portfolio
    const updatedPortfolio = {
      ...portfolio,
      positions: updatedPositions
    };

    await portfolioService.savePortfolio(userId, updatedPortfolio);

    res.status(200).json({
      success: true,
      message: 'Portfolio slug fixed',
      positions: updatedPositions
    });
  } catch (error) {
    console.error('Error fixing portfolio:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
}
