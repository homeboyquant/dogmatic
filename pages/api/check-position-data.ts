import type { NextApiRequest, NextApiResponse } from 'next';
import { portfolioService } from '@/lib/portfolioService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = 'dogmatic1';

    console.log('🔍 Checking positions for user:', userId);

    const portfolio = await portfolioService.getOrCreatePortfolio(userId, 500);

    if (!portfolio.positions || portfolio.positions.length === 0) {
      return res.status(200).json({
        message: 'No positions found',
        positions: []
      });
    }

    const positionData = portfolio.positions.map(pos => ({
      question: pos.marketQuestion,
      side: pos.side,
      id: pos.id,
      orderID: pos.orderID || null,
      tokenId: pos.tokenId || null,
      shares: pos.shares,
      closed: pos.closed || false,
      marketSlug: pos.marketSlug || null,
    }));

    const missingOrderId = positionData.filter(p => !p.orderID).length;
    const missingTokenId = positionData.filter(p => !p.tokenId).length;

    return res.status(200).json({
      totalPositions: portfolio.positions.length,
      missingOrderId,
      missingTokenId,
      positions: positionData,
    });

  } catch (error: any) {
    console.error('❌ Error checking positions:', error);
    return res.status(500).json({
      error: 'Failed to check positions',
      details: error.message,
    });
  }
}
