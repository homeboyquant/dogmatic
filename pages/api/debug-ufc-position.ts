import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase';

const db = getFirestore(app);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = 'dogmatic1'; // Your user ID

    const docRef = doc(db, 'portfolios', userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const portfolio = docSnap.data();

    // Find UFC position (not closed)
    const ufcPosition = portfolio.positions?.find((p: any) =>
      !p.closed && (
        p.marketQuestion?.toLowerCase().includes('makhachev') ||
        p.marketQuestion?.toLowerCase().includes('maddalena') ||
        p.marketQuestion?.toLowerCase().includes('ufc')
      )
    );

    if (!ufcPosition) {
      return res.status(404).json({ error: 'UFC position not found' });
    }

    // Test fetching by slug
    let slugResult = null;
    if (ufcPosition.marketSlug) {
      const slugResponse = await fetch(`https://gamma-api.polymarket.com/markets?slug=${ufcPosition.marketSlug}`);
      slugResult = await slugResponse.json();
    }

    // Test fetching by ID
    let idResult = null;
    if (ufcPosition.marketId) {
      const idResponse = await fetch(`https://gamma-api.polymarket.com/markets?id=${ufcPosition.marketId}`);
      idResult = await idResponse.json();
    }

    return res.status(200).json({
      position: {
        id: ufcPosition.id,
        marketId: ufcPosition.marketId,
        marketQuestion: ufcPosition.marketQuestion,
        marketSlug: ufcPosition.marketSlug,
        side: ufcPosition.side,
        avgPrice: ufcPosition.avgPrice,
        currentPrice: ufcPosition.currentPrice,
        shares: ufcPosition.shares,
      },
      fetchBySlug: {
        slug: ufcPosition.marketSlug,
        found: slugResult?.length > 0,
        bestBid: slugResult?.[0]?.bestBid,
        bestAsk: slugResult?.[0]?.bestAsk,
        outcomePrices: slugResult?.[0]?.outcomePrices,
      },
      fetchById: {
        id: ufcPosition.marketId,
        found: idResult?.length > 0,
        bestBid: idResult?.[0]?.bestBid,
        bestAsk: idResult?.[0]?.bestAsk,
        outcomePrices: idResult?.[0]?.outcomePrices,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: String(error) });
  }
}
