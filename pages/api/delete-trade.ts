import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, positionId } = req.body;

  if (!userId || !positionId) {
    return res.status(400).json({ error: 'Missing userId or positionId' });
  }

  try {
    console.log(`📖 Loading portfolio for user: ${userId}`);
    const docRef = doc(db, 'portfolios', userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const portfolio = docSnap.data();
    console.log('✅ Portfolio loaded');

    // Find the position
    const positionToDelete = portfolio.positions?.find((p: any) => p.id === positionId);

    if (!positionToDelete) {
      return res.status(404).json({ error: 'Position not found' });
    }

    console.log(`🗑️ Deleting position: ${positionToDelete.marketQuestion || positionToDelete.question}`);

    // Find related trades
    const tradesToRemove = portfolio.trades?.filter((t: any) =>
      t.marketId === positionToDelete.marketId
    ) || [];

    console.log(`🗑️ Removing ${tradesToRemove.length} trade(s)`);

    // Calculate net effect
    let totalMoneyIn = 0;
    let totalMoneyOut = 0;

    tradesToRemove.forEach((trade: any) => {
      if (trade.action === 'BUY') {
        totalMoneyIn += trade.total || 0;
      } else if (trade.action === 'SELL') {
        totalMoneyOut += trade.total || 0;
      }
    });

    const netEffect = totalMoneyOut - totalMoneyIn;
    console.log(`💸 Net effect: ${netEffect >= 0 ? '+' : ''}$${netEffect.toFixed(2)}`);

    // Update portfolio
    const updatedPortfolio = {
      ...portfolio,
      positions: portfolio.positions?.filter((p: any) => p.id !== positionId) || [],
      trades: portfolio.trades?.filter((t: any) => t.marketId !== positionToDelete.marketId) || [],
      balance: portfolio.balance - netEffect,
      updatedAt: Date.now(),
    };

    await setDoc(docRef, updatedPortfolio);

    console.log('✅ Trade deleted successfully!');

    return res.status(200).json({
      success: true,
      deletedPosition: positionToDelete.marketQuestion || positionToDelete.question,
      netEffect,
      oldBalance: portfolio.balance,
      newBalance: updatedPortfolio.balance,
    });

  } catch (error: any) {
    console.error('❌ Error deleting trade:', error);
    return res.status(500).json({ error: error.message });
  }
}
