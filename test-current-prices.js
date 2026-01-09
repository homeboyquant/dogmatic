// Test to fetch actual current prices for your open positions
const { ethers } = require('ethers');
const { ClobClient } = require('@polymarket/clob-client');

// Manually load env vars from .env.local
const fs = require('fs');
const envContent = fs.readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
});

const HOMEBOY_API = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://homeboyapi-318538657595.me-west1.run.app';

async function main() {
  console.log('🚀 Fetching your actual positions and testing prices\n');

  // Setup CLOB client
  const privateKey = process.env.WALLET_PRIVATE_KEY?.replace(/'/g, '');
  const apiKey = process.env.CLOB_API_KEY?.replace(/'/g, '');
  const secret = process.env.CLOB_SECRET?.replace(/'/g, '');
  const passphrase = process.env.CLOB_PASS_PHRASE?.replace(/'/g, '');

  if (!privateKey || !apiKey || !secret || !passphrase) {
    console.error('❌ Missing credentials in .env.local');
    return;
  }

  const wallet = new ethers.Wallet(privateKey);
  const clobClient = new ClobClient(
    'https://clob.polymarket.com',
    137,
    wallet,
    { key: apiKey, secret, passphrase }
  );

  // Fetch trades
  console.log('📊 Fetching your trades...');
  const allTrades = await clobClient.getTrades({}, true);
  console.log(`✅ Found ${allTrades.length} trades\n`);

  // Calculate positions
  const positions = new Map();

  for (const trade of allTrades) {
    const key = `${trade.market}-${trade.asset_id}`;
    if (!positions.has(key)) {
      positions.set(key, {
        market: trade.market,
        asset_id: trade.asset_id,
        outcome: trade.outcome,
        netSize: 0,
        avgBuyPrice: 0,
        totalBought: 0,
      });
    }

    const pos = positions.get(key);
    const size = parseFloat(trade.size);
    const price = parseFloat(trade.price);

    if (trade.side === 'BUY') {
      pos.avgBuyPrice = ((pos.avgBuyPrice * pos.totalBought) + (price * size)) / (pos.totalBought + size);
      pos.totalBought += size;
      pos.netSize += size;
    } else {
      pos.netSize -= size;
    }
  }

  // Get active positions
  const activePositions = Array.from(positions.values()).filter(pos => pos.netSize > 0.5);
  console.log(`📈 Found ${activePositions.length} active positions\n`);

  if (activePositions.length === 0) {
    console.log('No active positions found!');
    return;
  }

  // Fetch market titles
  console.log('📝 Fetching market details...');
  for (const pos of activePositions) {
    try {
      const market = await clobClient.getMarket(pos.market);
      pos.marketTitle = market?.question || 'Unknown';
    } catch (e) {
      pos.marketTitle = 'Unknown';
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('💰 Testing price fetching from homeboy API');
  console.log('='.repeat(100));

  // Test price fetching for each position
  for (let i = 0; i < activePositions.length; i++) {
    const pos = activePositions[i];
    console.log(`\n[${i + 1}/${activePositions.length}] ${pos.outcome.toUpperCase()} Position`);
    console.log(`Market: ${pos.marketTitle}`);
    console.log(`Token ID: ${pos.asset_id}`);
    console.log(`Shares: ${pos.netSize.toFixed(2)}`);
    console.log(`Avg Buy Price: $${pos.avgBuyPrice.toFixed(4)}`);
    console.log(`Cost Basis: $${(pos.avgBuyPrice * pos.netSize).toFixed(2)}`);

    try {
      console.log('\n🔄 Calling homeboy API...');
      const startTime = Date.now();

      const response = await fetch(`${HOMEBOY_API}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_id: pos.asset_id,
          side: 'SELL'
        })
      });

      const elapsed = Date.now() - startTime;
      console.log(`   Response time: ${elapsed}ms`);
      console.log(`   Status: ${response.status}`);

      if (response.ok) {
        const data = await response.json();
        console.log(`   Raw response:`, JSON.stringify(data));

        const price = data?.response?.price || data?.price;
        if (price !== undefined) {
          const currentPrice = parseFloat(price);
          const currentValue = currentPrice * pos.netSize;
          const costBasis = pos.avgBuyPrice * pos.netSize;
          const pnl = currentValue - costBasis;
          const pnlPercent = (pnl / costBasis) * 100;

          console.log(`\n✅ Current Sell Price: $${currentPrice.toFixed(4)}`);
          console.log(`   Current Value: $${currentValue.toFixed(2)}`);
          console.log(`   P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);
        } else {
          console.log(`\n⚠️ No price field in response`);
        }
      } else {
        const errorText = await response.text();
        console.log(`\n❌ API Error: ${errorText}`);
      }
    } catch (error) {
      console.log(`\n❌ Exception: ${error.message}`);
    }

    console.log('-'.repeat(100));
  }

  console.log('\n✅ Test complete!\n');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
