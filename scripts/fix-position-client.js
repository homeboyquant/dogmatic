const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCPF0JcW_2yf-mhxLe7pDICkC-Qrwx0OY8",
  authDomain: "homeboyquant-e5910.firebaseapp.com",
  projectId: "homeboyquant-e5910",
  storageBucket: "homeboyquant-e5910.firebasestorage.app",
  messagingSenderId: "1095071823669",
  appId: "1:1095071823669:web:4a84e2db55e0ae79b5de56",
  measurementId: "G-BH0K99VFW2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixPosition() {
  try {
    console.log('🔍 Searching for portfolios...');

    const portfoliosRef = collection(db, 'portfolios');
    const snapshot = await getDocs(portfoliosRef);

    console.log(`📊 Found ${snapshot.size} portfolios`);

    for (const docSnap of snapshot.docs) {
      const portfolio = docSnap.data();
      const userId = docSnap.id;

      console.log(`\n👤 Checking userId: ${userId}`);
      console.log(`   Balance: $${portfolio.balance}`);
      console.log(`   Positions: ${portfolio.positions?.length || 0}`);

      if (!portfolio.positions) continue;

      // Find MrBeast closed position
      const mrBeastPos = portfolio.positions.find(p =>
        p.marketSlug === 'of-views-of-next-mrbeast-video-on-week-1-275' ||
        (p.marketQuestion?.toLowerCase().includes('mrbeast') &&
         p.marketQuestion?.toLowerCase().includes('video') &&
         p.closed === true)
      );

      if (mrBeastPos) {
        console.log('\n✅ FOUND MrBeast position:');
        console.log(`   ID: ${mrBeastPos.id}`);
        console.log(`   Question: ${mrBeastPos.marketQuestion}`);
        console.log(`   Side: ${mrBeastPos.side}`);
        console.log(`   Shares: ${mrBeastPos.shares}`);
        console.log(`   Entry: $${mrBeastPos.avgPrice}`);
        console.log(`   Cost: $${mrBeastPos.cost}`);
        console.log(`   Current Exit: $${mrBeastPos.exitPrice}`);
        console.log(`   Current PnL: $${mrBeastPos.pnl}`);
        console.log(`   Slug: ${mrBeastPos.marketSlug}`);

        // Fetch current market data
        if (mrBeastPos.marketSlug) {
          const marketRes = await fetch(`https://gamma-api.polymarket.com/markets?slug=${mrBeastPos.marketSlug}`);
          const markets = await marketRes.json();

          if (markets.length > 0) {
            const market = markets[0];
            console.log(`\n📊 Market Data:`);
            console.log(`   Question: ${market.question}`);
            console.log(`   Best Bid: ${market.bestBid}`);
            console.log(`   Best Ask: ${market.bestAsk}`);

            // Get orderbook
            if (market.clobTokenIds) {
              const tokenIds = JSON.parse(market.clobTokenIds);
              const tokenIndex = mrBeastPos.side.toLowerCase() === 'yes' ? 0 : 1;
              const tokenId = tokenIds[tokenIndex];

              console.log(`\n📖 Fetching orderbook for ${mrBeastPos.side} (token: ${tokenId})...`);
              const obRes = await fetch(`https://clob.polymarket.com/book?token_id=${tokenId}`);
              const orderbook = await obRes.json();

              console.log(`   Top Bid: $${orderbook.bids?.[0]?.price || 'N/A'}`);
              console.log(`   Top Ask: $${orderbook.asks?.[0]?.price || 'N/A'}`);

              const correctExitPrice = 0.97;

              console.log(`\n💡 Analysis:`);
              console.log(`   You bought at: $${mrBeastPos.avgPrice}`);
              console.log(`   Should sell at: $${correctExitPrice} (based on your report)`);
              console.log(`   Currently recorded: $${mrBeastPos.exitPrice}`);

              if (Math.abs(mrBeastPos.exitPrice - correctExitPrice) > 0.001) {
                console.log(`\n⚠️  MISMATCH DETECTED - Fixing...`);

                const correctTotal = mrBeastPos.shares * correctExitPrice;
                const correctPnl = correctTotal - mrBeastPos.cost;
                const correctPnlPercent = (correctPnl / mrBeastPos.cost) * 100;

                console.log(`\n💰 Correct Values:`);
                console.log(`   Total: $${correctTotal.toFixed(2)}`);
                console.log(`   PnL: $${correctPnl.toFixed(2)} (${correctPnlPercent.toFixed(2)}%)`);

                // Find SELL trade
                const sellTrade = portfolio.trades?.find(t =>
                  t.marketQuestion === mrBeastPos.marketQuestion &&
                  t.action === 'SELL' &&
                  t.side === mrBeastPos.side
                );

                if (sellTrade) {
                  console.log(`\n📝 Found SELL trade: ${sellTrade.id}`);
                  console.log(`   Current price: $${sellTrade.price}`);
                  console.log(`   Current total: $${sellTrade.total}`);
                }

                // Calculate balance adjustment
                const oldTotal = mrBeastPos.shares * mrBeastPos.exitPrice;
                const balanceDiff = correctTotal - oldTotal;
                const newBalance = portfolio.balance + balanceDiff;

                console.log(`\n💵 Balance Adjustment:`);
                console.log(`   Old total: $${oldTotal.toFixed(2)}`);
                console.log(`   Correct total: $${correctTotal.toFixed(2)}`);
                console.log(`   Difference: $${balanceDiff.toFixed(2)}`);
                console.log(`   Current balance: $${portfolio.balance.toFixed(2)}`);
                console.log(`   New balance: $${newBalance.toFixed(2)}`);

                // Update Firestore
                const updatedPositions = portfolio.positions.map(p => {
                  if (p.id === mrBeastPos.id) {
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

                const updatedTrades = portfolio.trades?.map(t => {
                  if (sellTrade && t.id === sellTrade.id) {
                    return {
                      ...t,
                      price: correctExitPrice,
                      total: correctTotal,
                    };
                  }
                  return t;
                }) || [];

                console.log(`\n🔧 Updating Firestore...`);

                const docRef = doc(db, 'portfolios', userId);
                await updateDoc(docRef, {
                  positions: updatedPositions,
                  trades: updatedTrades,
                  balance: newBalance,
                  updatedAt: Date.now(),
                });

                console.log(`✅ FIXED! Position updated successfully.`);
                console.log(`\n📋 Summary:`);
                console.log(`   Entry: $${mrBeastPos.avgPrice} → Exit: $${correctExitPrice}`);
                console.log(`   PnL: $${correctPnl.toFixed(2)} (${correctPnlPercent.toFixed(2)}%)`);
                console.log(`   New Balance: $${newBalance.toFixed(2)}`);
              } else {
                console.log(`\n✅ Exit price already correct!`);
              }
            }
          }
        }
      }
    }

    console.log('\n✅ Script complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixPosition();
