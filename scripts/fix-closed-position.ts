import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    projectId: 'homeboyquant-e5910'
  });
}

const db = getFirestore();

async function fixClosedPosition() {
  try {
    console.log('🔍 Searching for portfolio with MrBeast video position...');

    // Get all portfolios
    const portfoliosRef = db.collection('portfolios');
    const snapshot = await portfoliosRef.get();

    console.log(`📊 Found ${snapshot.size} portfolios`);

    for (const doc of snapshot.docs) {
      const portfolio = doc.data();
      const userId = doc.id;

      console.log(`\n👤 Checking portfolio for userId: ${userId}`);
      console.log(`   Balance: $${portfolio.balance}`);
      console.log(`   Positions: ${portfolio.positions?.length || 0}`);

      if (!portfolio.positions) continue;

      // Find the MrBeast position
      const mrBeastPosition = portfolio.positions.find((p: any) =>
        p.marketQuestion?.toLowerCase().includes('mrbeast') &&
        p.marketQuestion?.toLowerCase().includes('video') &&
        p.closed === true
      );

      if (mrBeastPosition) {
        console.log('\n✅ FOUND MrBeast closed position:');
        console.log(`   Position ID: ${mrBeastPosition.id}`);
        console.log(`   Question: ${mrBeastPosition.marketQuestion}`);
        console.log(`   Side: ${mrBeastPosition.side}`);
        console.log(`   Shares: ${mrBeastPosition.shares}`);
        console.log(`   Entry (avgPrice): $${mrBeastPosition.avgPrice}`);
        console.log(`   Cost: $${mrBeastPosition.cost}`);
        console.log(`   Current Exit Price: $${mrBeastPosition.exitPrice}`);
        console.log(`   Current PnL: $${mrBeastPosition.pnl}`);
        console.log(`   Market Slug: ${mrBeastPosition.marketSlug}`);

        // Fetch current orderbook to verify 0.97
        if (mrBeastPosition.marketSlug) {
          console.log(`\n🔍 Fetching current market data for: ${mrBeastPosition.marketSlug}`);

          const marketResponse = await fetch(`https://gamma-api.polymarket.com/markets?slug=${mrBeastPosition.marketSlug}`);
          const marketData = await marketResponse.json();

          if (marketData.length > 0) {
            const market = marketData[0];
            console.log(`   Market found: ${market.question}`);
            console.log(`   Best Bid: ${market.bestBid}`);
            console.log(`   Best Ask: ${market.bestAsk}`);
            console.log(`   Outcome Prices: ${market.outcomePrices}`);

            // Fetch orderbook
            if (market.clobTokenIds) {
              const tokenIds = typeof market.clobTokenIds === 'string'
                ? JSON.parse(market.clobTokenIds)
                : market.clobTokenIds;

              const tokenIndex = mrBeastPosition.side.toLowerCase() === 'yes' ? 0 : 1;
              const tokenId = tokenIds[tokenIndex];

              console.log(`\n📊 Fetching orderbook for token: ${tokenId}`);
              const obResponse = await fetch(`https://clob.polymarket.com/book?token_id=${tokenId}`);
              const orderbook = await obResponse.json();

              console.log(`   Top Bid: ${orderbook.bids?.[0]?.price || 'N/A'}`);
              console.log(`   Top Ask: ${orderbook.asks?.[0]?.price || 'N/A'}`);

              const correctExitPrice = 0.97;
              const currentExitPrice = mrBeastPosition.exitPrice;

              if (currentExitPrice !== correctExitPrice) {
                console.log(`\n⚠️  INCORRECT EXIT PRICE DETECTED!`);
                console.log(`   Should be: $${correctExitPrice}`);
                console.log(`   Currently: $${currentExitPrice}`);

                // Calculate correct values
                const correctTotal = mrBeastPosition.shares * correctExitPrice;
                const correctPnl = correctTotal - mrBeastPosition.cost;
                const correctPnlPercent = (correctPnl / mrBeastPosition.cost) * 100;

                console.log(`\n💰 Correct calculations:`);
                console.log(`   Exit Price: $${correctExitPrice}`);
                console.log(`   Total: $${correctTotal.toFixed(2)}`);
                console.log(`   PnL: $${correctPnl.toFixed(2)} (${correctPnlPercent.toFixed(2)}%)`);

                // Find the SELL trade
                const sellTrade = portfolio.trades?.find((t: any) =>
                  t.marketQuestion === mrBeastPosition.marketQuestion &&
                  t.action === 'SELL' &&
                  t.side === mrBeastPosition.side
                );

                if (sellTrade) {
                  console.log(`\n📝 Found corresponding SELL trade:`);
                  console.log(`   Trade ID: ${sellTrade.id}`);
                  console.log(`   Current Price: $${sellTrade.price}`);
                  console.log(`   Current Total: $${sellTrade.total}`);
                }

                // Calculate balance adjustment
                const oldTotal = mrBeastPosition.shares * currentExitPrice;
                const balanceDiff = correctTotal - oldTotal;
                const newBalance = portfolio.balance + balanceDiff;

                console.log(`\n💵 Balance adjustment:`);
                console.log(`   Old total received: $${oldTotal.toFixed(2)}`);
                console.log(`   Correct total: $${correctTotal.toFixed(2)}`);
                console.log(`   Difference: $${balanceDiff.toFixed(2)}`);
                console.log(`   Current balance: $${portfolio.balance.toFixed(2)}`);
                console.log(`   New balance: $${newBalance.toFixed(2)}`);

                // Update Firestore
                console.log(`\n🔧 Updating Firestore...`);

                const updatedPositions = portfolio.positions.map((p: any) => {
                  if (p.id === mrBeastPosition.id) {
                    return {
                      ...p,
                      exitPrice: correctExitPrice,
                      currentPrice: correctExitPrice,
                      value: correctTotal,
                      pnl: correctPnl,
                      pnlPercent: correctPnlPercent,
                    };
                  }
                  return p;
                });

                const updatedTrades = portfolio.trades?.map((t: any) => {
                  if (sellTrade && t.id === sellTrade.id) {
                    return {
                      ...t,
                      price: correctExitPrice,
                      total: correctTotal,
                    };
                  }
                  return t;
                }) || [];

                await portfoliosRef.doc(userId).update({
                  positions: updatedPositions,
                  trades: updatedTrades,
                  balance: newBalance,
                  updatedAt: Date.now(),
                });

                console.log(`✅ Position fixed successfully!`);
              } else {
                console.log(`\n✅ Exit price is already correct ($${correctExitPrice})`);
              }
            }
          } else {
            console.log(`   ❌ Market not found`);
          }
        }
      }
    }

    console.log('\n✅ Script completed');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixClosedPosition();
