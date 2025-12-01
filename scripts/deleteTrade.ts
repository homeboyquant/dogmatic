import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

async function deleteTrade() {
  // You need to provide your userId here
  const userId = 'YOUR_USER_ID'; // Replace with your actual userId
  const tradeToDelete = 'Will Google\'s Gemini 3 Pro win the Alpha Arena Season 1.5 competition';

  try {
    console.log('📖 Loading portfolio...');
    const docRef = doc(db, 'portfolios', userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.error('❌ Portfolio not found');
      return;
    }

    const portfolio = docSnap.data();
    console.log('✅ Portfolio loaded');
    console.log(`📊 Current balance: $${portfolio.balance}`);
    console.log(`📊 Total positions: ${portfolio.positions?.length || 0}`);
    console.log(`📊 Total trades: ${portfolio.trades?.length || 0}`);

    // Find the position
    const positionToDelete = portfolio.positions?.find((p: any) =>
      p.marketQuestion?.includes('Gemini 3 Pro') ||
      p.question?.includes('Gemini 3 Pro')
    );

    if (!positionToDelete) {
      console.error('❌ Position not found');
      console.log('Available positions:');
      portfolio.positions?.forEach((p: any, i: number) => {
        console.log(`  ${i + 1}. ${p.marketQuestion || p.question}`);
      });
      return;
    }

    console.log(`\n🎯 Found position to delete:`);
    console.log(`  Question: ${positionToDelete.marketQuestion || positionToDelete.question}`);
    console.log(`  ID: ${positionToDelete.id}`);
    console.log(`  Market ID: ${positionToDelete.marketId}`);
    console.log(`  Cost: $${positionToDelete.cost?.toFixed(2)}`);
    console.log(`  Closed: ${positionToDelete.closed}`);

    // Find related trades
    const tradesToRemove = portfolio.trades?.filter((t: any) =>
      t.marketId === positionToDelete.marketId
    ) || [];

    console.log(`\n🗑️ Found ${tradesToRemove.length} trade(s) to remove:`);

    let totalMoneyIn = 0;
    let totalMoneyOut = 0;

    tradesToRemove.forEach((trade: any, i: number) => {
      console.log(`  ${i + 1}. ${trade.action} - $${trade.total?.toFixed(2)}`);
      if (trade.action === 'BUY') {
        totalMoneyIn += trade.total || 0;
      } else if (trade.action === 'SELL') {
        totalMoneyOut += trade.total || 0;
      }
    });

    const netEffect = totalMoneyOut - totalMoneyIn;
    console.log(`\n💸 Net effect: ${netEffect >= 0 ? '+' : ''}$${netEffect.toFixed(2)}`);
    console.log(`🔄 Will adjust balance by: ${netEffect >= 0 ? '-' : '+'}$${Math.abs(netEffect).toFixed(2)}`);

    // Remove the position and trades
    const updatedPortfolio = {
      ...portfolio,
      positions: portfolio.positions?.filter((p: any) => p.id !== positionToDelete.id) || [],
      trades: portfolio.trades?.filter((t: any) => t.marketId !== positionToDelete.marketId) || [],
      balance: portfolio.balance - netEffect,
      updatedAt: Date.now(),
    };

    console.log(`\n📝 Saving updated portfolio...`);
    console.log(`  Old balance: $${portfolio.balance?.toFixed(2)}`);
    console.log(`  New balance: $${updatedPortfolio.balance?.toFixed(2)}`);
    console.log(`  Positions: ${portfolio.positions?.length} → ${updatedPortfolio.positions.length}`);
    console.log(`  Trades: ${portfolio.trades?.length} → ${updatedPortfolio.trades.length}`);

    await setDoc(docRef, updatedPortfolio);

    console.log('\n✅ Trade deleted successfully!');
    console.log('🎉 Portfolio adjusted as if the trade never happened');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

deleteTrade();
