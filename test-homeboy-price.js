// Simple test to check homeboy API price endpoint
const fetch = require('node-fetch');

const HOMEBOY_API = 'https://homeboyapi-318538657595.me-west1.run.app';

// Example token IDs from common markets (you'll need to replace with your actual token IDs)
const testTokenIds = [
  '21742633143463906290569050155826241533067272736897614950488156847949938836455', // Example - replace with actual
  '71321045679252212594626385532706912750332728571942532289631379312455583992563', // Example - replace with actual
];

async function testPrice(tokenId) {
  try {
    console.log(`\n🔍 Testing token: ${tokenId}`);

    const response = await fetch(`${HOMEBOY_API}/price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_id: tokenId,
        side: 'SELL'
      })
    });

    console.log(`   Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`   Response:`, JSON.stringify(data, null, 2));

      if (data && data.price) {
        console.log(`   ✅ Price: $${parseFloat(data.price).toFixed(4)}`);
      } else {
        console.log(`   ⚠️ No price in response`);
      }
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Error: ${errorText}`);
    }
  } catch (error) {
    console.log(`   ❌ Exception: ${error.message}`);
  }
}

async function main() {
  console.log('🚀 Testing homeboy API /price endpoint\n');
  console.log(`API URL: ${HOMEBOY_API}`);

  // Test with example token IDs
  for (const tokenId of testTokenIds) {
    await testPrice(tokenId);
  }

  console.log('\n✅ Test complete');
}

main().catch(console.error);
