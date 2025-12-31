/**
 * Test script for buy_fast and sell_fast functions
 * Tests with $5 on the market: will-anyone-be-charged-over-daycare-fraud-in-minnesota-by
 */

import { buy_fast, sell_fast, getTokenIdForMarket } from '../lib/tradingApi';

const TEST_SLUG = 'us-recession-in-2025';
const TEST_AMOUNT = 5; // $5 test amount
const TEST_TOKEN_ID = '104173557214744537570424345347209544585775842950109756851652855913015295701992'; // YES token for us-recession-in-2025

async function testBuyAndSell() {
  console.log('🚀 Starting trading test...\n');
  console.log(`Market: ${TEST_SLUG}`);
  console.log(`Test amount: $${TEST_AMOUNT}\n`);

  try {
    // Step 1: Use hardcoded token ID for testing
    console.log('📍 Step 1: Using token ID for YES outcome...');
    const tokenId = TEST_TOKEN_ID;
    console.log(`✅ Token ID: ${tokenId}\n`);

    // Step 2: Test BUY
    console.log(`📍 Step 2: Testing BUY with $${TEST_AMOUNT}...`);
    const buyResponse = await buy_fast(tokenId, TEST_AMOUNT);

    console.log('📊 Buy Response Structure:');
    console.log(JSON.stringify(buyResponse, null, 2));
    console.log('');

    // Check if buy was successful
    if (buyResponse.status !== 'success' && !buyResponse.order_id) {
      console.error('❌ Buy failed. Cannot proceed to sell test.');
      return;
    }

    // Extract orderID from response
    const orderId = buyResponse.response?.orderID || buyResponse.response?.order_id || buyResponse.order_id;

    if (!orderId) {
      console.error('❌ No orderID in buy response. Response structure:');
      console.log(JSON.stringify(buyResponse, null, 2));
      return;
    }

    console.log(`✅ Buy successful! Order ID: ${orderId}\n`);

    // Wait a bit before selling
    console.log('⏳ Waiting 3 seconds before selling...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Test SELL (100% of position)
    console.log('📍 Step 3: Testing SELL (100% of position)...');
    const sellResponse = await sell_fast(tokenId, orderId, 100);

    console.log('📊 Sell Response Structure:');
    console.log(JSON.stringify(sellResponse, null, 2));
    console.log('');

    if (sellResponse.status === 'success' || sellResponse.response?.status === 'success') {
      console.log('✅ Sell successful!\n');
    } else {
      console.log('⚠️ Sell may have failed. Check response above.\n');
    }

    // Summary
    console.log('📋 Test Summary:');
    console.log('─────────────────────────────────');
    console.log(`Market: ${TEST_SLUG}`);
    console.log(`Token ID: ${tokenId}`);
    console.log(`Amount: $${TEST_AMOUNT}`);
    console.log(`Buy Status: ${buyResponse.status || 'unknown'}`);
    console.log(`Order ID: ${orderId}`);
    console.log(`Sell Status: ${sellResponse.status || 'unknown'}`);
    console.log('─────────────────────────────────');

  } catch (error: any) {
    console.error('\n❌ Test failed with error:');
    console.error(error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testBuyAndSell();
