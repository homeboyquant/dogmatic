import { doc, getDoc, setDoc } from '../lib/firebase';
import { db } from '../lib/firebase';

async function fixPositionPrice() {
  const userId = 'dogmatic1';
  const docRef = doc(db, 'portfolios', userId);

  try {
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log('Portfolio not found');
      return;
    }

    const portfolio = docSnap.data();
    console.log('Current portfolio positions:', portfolio.positions?.length || 0);

    // Find the position for "what-will-trump-say-this-week-november-10-16"
    const positions = portfolio.positions || [];
    let updated = false;

    const updatedPositions = positions.map((pos: any) => {
      if (pos.marketSlug === 'what-will-trump-say-this-week-november-10-16' && pos.closed) {
        console.log('Found position:', {
          question: pos.marketQuestion,
          side: pos.side,
          currentExitPrice: pos.exitPrice,
          shares: pos.shares,
          avgPrice: pos.avgPrice
        });

        // The market resolved to YES at 100%, so YES = 0.99, NO = 0.01
        const correctExitPrice = pos.side === 'YES' ? 0.99 : 0.01;
        const newValue = pos.shares * correctExitPrice;
        const newPnl = newValue - pos.cost;
        const newPnlPercent = (newPnl / pos.cost) * 100;

        console.log('Updating to:', {
          exitPrice: correctExitPrice,
          value: newValue,
          pnl: newPnl,
          pnlPercent: newPnlPercent
        });

        updated = true;

        return {
          ...pos,
          exitPrice: correctExitPrice,
          currentPrice: correctExitPrice,
          value: newValue,
          pnl: newPnl,
          pnlPercent: newPnlPercent
        };
      }
      return pos;
    });

    if (updated) {
      await setDoc(docRef, {
        ...portfolio,
        positions: updatedPositions,
        updatedAt: Date.now()
      });
      console.log('✅ Position updated successfully!');
    } else {
      console.log('❌ Position not found or not closed');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

fixPositionPrice();
