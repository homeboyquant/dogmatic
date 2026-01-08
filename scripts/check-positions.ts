/**
 * Script to check existing positions in Firestore and their order IDs
 */
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();

async function checkPositions() {
  try {
    console.log('🔍 Checking Firestore positions...\n');

    // Get the portfolio for user dogmatic1
    const portfolioRef = db.collection('portfolios').doc('dogmatic1');
    const portfolioDoc = await portfolioRef.get();

    if (!portfolioDoc.exists) {
      console.log('❌ Portfolio not found for user: dogmatic1');
      return;
    }

    const portfolio = portfolioDoc.data();
    console.log('✅ Portfolio found!\n');

    if (!portfolio?.positions || portfolio.positions.length === 0) {
      console.log('📭 No positions in portfolio');
      return;
    }

    console.log(`📊 Found ${portfolio.positions.length} positions:\n`);

    portfolio.positions.forEach((pos: any, index: number) => {
      console.log(`Position ${index + 1}:`);
      console.log(`  Question: ${pos.marketQuestion}`);
      console.log(`  Side: ${pos.side}`);
      console.log(`  ID: ${pos.id}`);
      console.log(`  Order ID: ${pos.orderID || 'MISSING ❌'}`);
      console.log(`  Token ID: ${pos.tokenId || 'MISSING ❌'}`);
      console.log(`  Shares: ${pos.shares}`);
      console.log(`  Closed: ${pos.closed || false}`);
      console.log(`  Market Slug: ${pos.marketSlug || 'MISSING'}`);
      console.log('');
    });

    // Check if any positions are missing orderID or tokenId
    const missingOrderId = portfolio.positions.filter((p: any) => !p.orderID);
    const missingTokenId = portfolio.positions.filter((p: any) => !p.tokenId);

    if (missingOrderId.length > 0) {
      console.log(`⚠️  ${missingOrderId.length} positions missing orderID`);
    }

    if (missingTokenId.length > 0) {
      console.log(`⚠️  ${missingTokenId.length} positions missing tokenId`);
    }

    if (missingOrderId.length === 0 && missingTokenId.length === 0) {
      console.log('✅ All positions have orderID and tokenId');
    }

  } catch (error) {
    console.error('❌ Error checking positions:', error);
  }
}

checkPositions();
