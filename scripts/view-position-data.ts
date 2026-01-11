/**
 * Script to view position data and associated trades
 * Run with: npx tsx scripts/view-position-data.ts
 */

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

async function viewPositionData() {
  // Get userId from environment or use default
  const userId = process.env.USER_ID || process.env.NEXT_PUBLIC_USER_ID;

  if (!userId) {
    console.error('❌ No USER_ID found in environment');
    console.log('Please set USER_ID environment variable');
    process.exit(1);
  }

  console.log(`\n🔍 Fetching portfolio for user: ${userId}\n`);

  const docRef = doc(db, 'portfolios', userId);
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
    console.log('❌ Heat vs Pacers position not found\n');
    console.log('📋 Available positions:');
    portfolio.positions.forEach((p: any, i: number) => {
      console.log(`  ${i + 1}. ${p.marketQuestion} (${p.side}) - ${p.closed ? 'CLOSED' : 'OPEN'}`);
    });
    process.exit(1);
  }

  console.log('📊 HEAT VS PACERS POSITION:');
  console.log('═'.repeat(80));
  console.log(`ID: ${heatPacersPosition.id}`);
  console.log(`Market: ${heatPacersPosition.marketQuestion}`);
  console.log(`Market ID: ${heatPacersPosition.marketId}`);
  console.log(`Side: ${heatPacersPosition.side}`);
  console.log(`Status: ${heatPacersPosition.closed ? 'CLOSED' : 'OPEN'}`);
  console.log(`\nCurrent Data:`);
  console.log(`  Shares: ${heatPacersPosition.shares}`);
  console.log(`  Avg Price: $${heatPacersPosition.avgPrice?.toFixed(3)}`);
  console.log(`  Cost: $${heatPacersPosition.cost?.toFixed(2)}`);
  console.log(`  Current Price: $${heatPacersPosition.currentPrice?.toFixed(3)}`);
  console.log(`  Value: $${heatPacersPosition.value?.toFixed(2)}`);
  console.log(`  PnL: $${heatPacersPosition.pnl?.toFixed(2)}`);
  console.log(`  PnL %: ${heatPacersPosition.pnlPercent?.toFixed(2)}%`);

  if (heatPacersPosition.closed) {
    console.log(`\nClosed Info:`);
    console.log(`  Exit Price: $${heatPacersPosition.exitPrice?.toFixed(3)}`);
    console.log(`  Original Shares: ${heatPacersPosition.originalShares}`);
    console.log(`  Total Sold Value: $${heatPacersPosition.totalSoldValue?.toFixed(2)}`);
    console.log(`  Total Sold Shares: ${heatPacersPosition.totalSoldShares}`);
  }

  // Find related trades
  const relatedTrades = (portfolio.trades || []).filter((t: any) =>
    t.marketId === heatPacersPosition.marketId &&
    t.side === heatPacersPosition.side
  );

  console.log(`\n📝 RELATED TRADES (${relatedTrades.length} total):`);
  console.log('═'.repeat(80));

  const buyTrades = relatedTrades.filter((t: any) => t.action === 'BUY');
  const sellTrades = relatedTrades.filter((t: any) => t.action === 'SELL');

  console.log(`\n🟢 BUY TRADES (${buyTrades.length}):`);
  buyTrades.forEach((t: any, i: number) => {
    const date = new Date(t.timestamp).toLocaleString();
    console.log(`  ${i + 1}. ${date}`);
    console.log(`     Shares: ${t.shares.toFixed(2)}`);
    console.log(`     Price: $${t.price.toFixed(3)}`);
    console.log(`     Total: $${t.total.toFixed(2)}`);
  });

  console.log(`\n🔴 SELL TRADES (${sellTrades.length}):`);
  sellTrades.forEach((t: any, i: number) => {
    const date = new Date(t.timestamp).toLocaleString();
    console.log(`  ${i + 1}. ${date}`);
    console.log(`     Shares: ${t.shares.toFixed(2)}`);
    console.log(`     Price: $${t.price.toFixed(3)}`);
    console.log(`     Total: $${t.total.toFixed(2)}`);
  });

  // Calculate totals
  const totalBoughtShares = buyTrades.reduce((sum: number, t: any) => sum + t.shares, 0);
  const totalBoughtValue = buyTrades.reduce((sum: number, t: any) => sum + t.total, 0);
  const totalSoldShares = sellTrades.reduce((sum: number, t: any) => sum + t.shares, 0);
  const totalSoldValue = sellTrades.reduce((sum: number, t: any) => sum + t.total, 0);

  console.log(`\n📈 CALCULATED TOTALS:`);
  console.log('═'.repeat(80));
  console.log(`Total Bought: ${totalBoughtShares.toFixed(2)} shares for $${totalBoughtValue.toFixed(2)}`);
  console.log(`Avg Buy Price: $${(totalBoughtValue / totalBoughtShares).toFixed(3)}`);
  console.log(`Total Sold: ${totalSoldShares.toFixed(2)} shares for $${totalSoldValue.toFixed(2)}`);
  console.log(`Avg Sell Price: $${(totalSoldValue / totalSoldShares).toFixed(3)}`);
  console.log(`Net Shares: ${(totalBoughtShares - totalSoldShares).toFixed(2)}`);
  console.log(`\nRealized P&L: $${(totalSoldValue - totalBoughtValue).toFixed(2)}`);
  console.log(`Realized P&L %: ${((totalSoldValue - totalBoughtValue) / totalBoughtValue * 100).toFixed(2)}%`);

  console.log('\n');
}

viewPositionData().catch(console.error);
