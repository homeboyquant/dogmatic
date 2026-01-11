/**
 * Script to close the Heat vs Pacers position
 * Run with: npx tsx scripts/close-heat-pacers.ts
 */

import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const USER_ID = 'dogmatic1';

async function closeHeatPacersPosition() {
  console.log(`\n🔧 Closing Heat vs Pacers position for user: ${USER_ID}\n`);

  const docRef = doc(db, 'portfolios', USER_ID);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    console.error('❌ Portfolio not found');
    process.exit(1);
  }

  const portfolio = docSnap.data();

  // Find Heat vs Pacers position
  const heatPacersPosition = portfolio.positions.find((p: any) =>
    p.marketQuestion?.toLowerCase().includes('heat') &&
    p.marketQuestion?.toLowerCase().includes('pacers')
  );

  if (!heatPacersPosition) {
    console.log('❌ Heat vs Pacers position not found');
    process.exit(1);
  }

  console.log('📊 Found position:', heatPacersPosition.marketQuestion);
  console.log('Status:', heatPacersPosition.closed ? 'CLOSED' : 'OPEN');

  if (heatPacersPosition.closed) {
    console.log('✅ Position is already closed!');
    process.exit(0);
  }

  // Find related trades
  const positionTrades = (portfolio.trades || []).filter((t: any) =>
    t.marketId === heatPacersPosition.marketId &&
    t.side === heatPacersPosition.side
  );

  const sellTrades = positionTrades.filter((t: any) => t.action === 'SELL');
  const buyTrades = positionTrades.filter((t: any) => t.action === 'BUY');

  // Calculate totals from trades
  const totalBoughtShares = buyTrades.reduce((sum: number, t: any) => sum + t.shares, 0);
  const totalBoughtValue = buyTrades.reduce((sum: number, t: any) => sum + t.total, 0);
  const totalSoldShares = sellTrades.reduce((sum: number, t: any) => sum + t.shares, 0);
  const totalSoldValue = sellTrades.reduce((sum: number, t: any) => sum + t.total, 0);

  const avgEntryPrice = totalBoughtValue / totalBoughtShares;
  const weightedAvgExitPrice = totalSoldValue / totalSoldShares;
  const totalCost = avgEntryPrice * totalBoughtShares;
  const realizedPnL = totalSoldValue - totalCost;
  const netShares = totalBoughtShares - totalSoldShares;

  console.log('\n📈 Trade Summary:');
  console.log('  Buy Trades:', buyTrades.length);
  console.log('  Sell Trades:', sellTrades.length);
  console.log('\n💰 Calculations:');
  console.log(`  Total Bought: ${totalBoughtShares.toFixed(2)} shares @ $${avgEntryPrice.toFixed(3)} = $${totalBoughtValue.toFixed(2)}`);
  console.log(`  Total Sold: ${totalSoldShares.toFixed(2)} shares @ $${weightedAvgExitPrice.toFixed(3)} = $${totalSoldValue.toFixed(2)}`);
  console.log(`  Net Shares: ${netShares.toFixed(2)}`);
  console.log(`  Realized P&L: $${realizedPnL.toFixed(2)} (${((realizedPnL / totalCost) * 100).toFixed(2)}%)`);

  if (netShares > 0.1) {
    console.warn(`\n⚠️  WARNING: Net shares (${netShares.toFixed(2)}) > 0.1. Position may not be fully sold.`);
    console.log('Proceeding to close anyway...\n');
  }

  // Update position to closed
  const updatedPositions = portfolio.positions.map((p: any) => {
    if (p.id === heatPacersPosition.id) {
      return {
        ...p,
        closed: true,
        closedAt: Date.now(),
        exitPrice: weightedAvgExitPrice,
        originalShares: totalBoughtShares,
        shares: totalBoughtShares,
        avgPrice: avgEntryPrice,
        cost: totalCost,
        value: 0,
        pnl: realizedPnL,
        pnlPercent: (realizedPnL / totalCost) * 100,
        totalSoldValue,
        totalSoldShares,
      };
    }
    return p;
  });

  // Update Firestore
  await updateDoc(docRef, {
    positions: updatedPositions,
    updatedAt: Date.now(),
  });

  console.log('\n✅ Position closed successfully!');
  console.log(`   Position moved to "Closed Positions"`);
  console.log(`   Exit Price: $${weightedAvgExitPrice.toFixed(3)}`);
  console.log(`   P&L: $${realizedPnL.toFixed(2)} (${((realizedPnL / totalCost) * 100).toFixed(2)}%)\n`);
}

closeHeatPacersPosition().catch(console.error);
