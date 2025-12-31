/**
 * Script to fetch user orders using private key
 */

import axios from 'axios';

const PRIVATE_KEY = process.env.NEXT_PUBLIC_TRADING_PRIVATE_KEY || process.env.TRADING_PRIVATE_KEY || '0xf2e7a5daabccf153eb7ae888b3e08de418105613f337b0d1cf59284fb458773e';
const API_BASE_URL = 'https://homeboyapi-318538657595.me-west1.run.app';

async function getUserOrders() {
  try {
    console.log('📖 Fetching user orders with private key...\n');

    const response = await axios.post(`${API_BASE_URL}/get_orders`, {
      private_key: PRIVATE_KEY
    });

    console.log('✅ Orders retrieved successfully!\n');
    console.log('📊 Response structure:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.orders && Array.isArray(response.data.orders)) {
      console.log(`\n📋 Total orders: ${response.data.orders.length}`);

      // Display first few orders
      console.log('\n🔍 Sample orders:');
      response.data.orders.slice(0, 5).forEach((order: any, index: number) => {
        console.log(`\nOrder ${index + 1}:`);
        console.log(`  - Order ID: ${order.id || order.orderID}`);
        console.log(`  - Token ID: ${order.asset_id || order.token_id}`);
        console.log(`  - Side: ${order.side}`);
        console.log(`  - Size: ${order.size || order.size_matched}`);
        console.log(`  - Price: ${order.price}`);
        console.log(`  - Status: ${order.status}`);
      });
    }

  } catch (error: any) {
    console.error('❌ Failed to fetch orders:');
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

getUserOrders();
