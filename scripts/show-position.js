const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyA0xmkQmK2l9XQvQkEHLKZ6xIl-OUnMx8M",
  authDomain: "homeboyquant-e5910.firebaseapp.com",
  projectId: "homeboyquant-e5910",
  storageBucket: "homeboyquant-e5910.firebasestorage.app",
  messagingSenderId: "670725018574",
  appId: "1:670725018574:web:2eeb3e19b3f87dfd65074e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixPosition() {
  const userId = 'dogmatic1';
  const docRef = doc(db, 'portfolios', userId);

  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    console.log('Portfolio not found');
    process.exit(1);
  }

  const portfolio = docSnap.data();
  const positions = portfolio.positions || [];

  console.log('Searching for positions with slug: what-will-trump-say-this-week-november-10-16');

  const allMatchingPositions = positions.filter(pos =>
    pos.marketSlug && pos.marketSlug.includes('trump-say')
  );

  console.log(`Found ${allMatchingPositions.length} matching positions`);
  allMatchingPositions.forEach((pos, i) => {
    console.log(`\nPosition ${i + 1}:`);
    console.log({
      slug: pos.marketSlug,
      closed: pos.closed,
      side: pos.side,
      exitPrice: pos.exitPrice
    });
  });

  const targetPosition = positions.find(pos =>
    pos.marketSlug === 'will-trump-say-transgender-this-week-november-10-16' && pos.closed
  );

  if (!targetPosition) {
    console.log('\nTarget position (closed) not found');
    process.exit(1);
  }

  console.log('Current position data:');
  console.log({
    question: targetPosition.marketQuestion,
    side: targetPosition.side,
    shares: targetPosition.shares,
    avgPrice: targetPosition.avgPrice,
    cost: targetPosition.cost,
    exitPrice: targetPosition.exitPrice,
    value: targetPosition.value,
    pnl: targetPosition.pnl
  });

  // Calculate correct values from actual market outcome prices
  // outcomePrices: ["0.0245", "0.9755"] where [0]=YES, [1]=NO
  const correctExitPrice = targetPosition.side === 'YES' ? 0.0245 : 0.9755;
  const newValue = targetPosition.shares * correctExitPrice;
  const newPnl = newValue - targetPosition.cost;
  const newPnlPercent = (newPnl / targetPosition.cost) * 100;

  console.log('\nUpdating to:');
  console.log({
    exitPrice: correctExitPrice,
    value: newValue,
    pnl: newPnl,
    pnlPercent: newPnlPercent
  });

  // Update the position
  const updatedPositions = positions.map(pos => {
    if (pos.marketSlug === 'will-trump-say-transgender-this-week-november-10-16' && pos.closed) {
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

  await setDoc(docRef, {
    ...portfolio,
    positions: updatedPositions,
    updatedAt: Date.now()
  });

  console.log('\n✅ Position updated successfully!');
  process.exit(0);
}

fixPosition().catch(console.error);
