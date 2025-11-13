import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

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

    return res.status(200).json({
      success: true,
      balance: portfolio.balance,
      positions: portfolio.positions.map((p: any) => ({
        id: p.id,
        question: p.marketQuestion,
        slug: p.marketSlug,
        side: p.side,
        shares: p.shares,
        avgPrice: p.avgPrice,
        cost: p.cost,
        exitPrice: p.exitPrice,
        closed: p.closed,
        closedAt: p.closedAt,
      })),
      trades: portfolio.trades?.length || 0,
    });
  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
