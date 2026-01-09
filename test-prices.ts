/**
 * Test script to fetch current prices for all open positions
 * Run with: npx ts-node test-prices.ts
 */

import { ethers } from 'ethers';
import { ClobClient } from '@polymarket/clob-client';

interface Trade {
  id: string;
  taker_order_id: string;
  market: string;
  asset_id: string;
  side: 'BUY' | 'SELL';
  size: string;
  price: string;
  match_time: string;
  outcome: string;
}

interface Position {
  market: string;
  asset_id: string;
  outcome: string;
  netSize: number;
  avgBuyPrice: number;
  avgSellPrice: number;
  totalBought: number;
  totalSold: number;
  marketTitle?: string;
}

async function testPriceFetching() {
  console.log('🚀 Starting price fetch test...\n');

  // Load credentials from environment
  const privateKey = process.env.WALLET_PRIVATE_KEY?.replace(/'/g, '');
  const apiKey = process.env.CLOB_API_KEY?.replace(/'/g, '');
  const secret = process.env.CLOB_SECRET?.replace(/'/g, '');
  const passphrase = process.env.CLOB_PASS_PHRASE?.replace(/'/g, '');
  const homeboyApiUrl = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://homeboyapi-318538657595.me-west1.run.app';

  if (!privateKey || !apiKey || !secret || !passphrase) {
    console.error('❌ Missing required credentials');
    return;
  }

  console.log(`📡 Using homeboy API: ${homeboyApiUrl}\n`);

  // Create wallet and CLOB client
  const wallet = new ethers.Wallet(privateKey);
  const clobClient = new ClobClient(
    'https://clob.polymarket.com',
    137,
    wallet,
    { key: apiKey, secret, passphrase }
  );

  // Fetch all trades
  console.log('📊 Fetching trades from CLOB...');
  const allTrades: Trade[] = await clobClient.getTrades({}, true) as Trade[];
  console.log(`✅ Fetched ${allTrades.length} total trades\n`);

  // Calculate positions
  const positions = new Map<string, Position>();

  for (const trade of allTrades) {
    const key = `${trade.market}-${trade.asset_id}`;
    if (!positions.has(key)) {
      positions.set(key, {
        market: trade.market,
        asset_id: trade.asset_id,
        outcome: trade.outcome,
        netSize: 0,
        avgBuyPrice: 0,
        avgSellPrice: 0,
        totalBought: 0,
        totalSold: 0,
      });
    }

    const pos = positions.get(key)!;
    const size = parseFloat(trade.size);
    const price = parseFloat(trade.price);

    if (trade.side === 'BUY') {
      pos.avgBuyPrice = ((pos.avgBuyPrice * pos.totalBought) + (price * size)) / (pos.totalBought + size);
      pos.totalBought += size;
      pos.netSize += size;
    } else {
      pos.avgSellPrice = ((pos.avgSellPrice * pos.totalSold) + (price * size)) / (pos.totalSold + size);
      pos.totalSold += size;
      pos.netSize -= size;
    }
  }

  // Filter active positions
  const activePositions = Array.from(positions.values()).filter(pos => pos.netSize > 0.5);
  console.log(`📈 Found ${activePositions.length} active positions\n`);

  // Fetch market titles
  console.log('📝 Fetching market titles...');
  const marketTitles = new Map<string, string>();
  for (const pos of activePositions) {
    try {
      const market = await clobClient.getMarket(pos.market);
      if (market?.question) {
        marketTitles.set(pos.market, market.question);
      }
    } catch (error) {
      console.log(`⚠️ Could not fetch market title for ${pos.market}`);
    }
  }
  console.log('✅ Market titles fetched\n');

  // Now fetch current prices using homeboy API
  console.log('💰 Fetching current SELL prices from homeboy API...\n');
  console.log('='.repeat(100));

  for (const pos of activePositions) {
    const marketTitle = marketTitles.get(pos.market) || 'Unknown Market';

    try {
      const priceResponse = await fetch(`${homeboyApiUrl}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_id: pos.asset_id,
          side: 'SELL'
        })
      });

      if (priceResponse.ok) {
        const priceData = await priceResponse.json();

        if (priceData && typeof priceData.price !== 'undefined') {
          const currentPrice = parseFloat(priceData.price);
          const costBasis = pos.avgBuyPrice * pos.netSize;
          const currentValue = currentPrice * pos.netSize;
          const pnl = currentValue - costBasis;
          const pnlPercent = (pnl / costBasis) * 100;

          console.log(`\n📊 ${pos.outcome.toUpperCase()} Position`);
          console.log(`   Market: ${marketTitle}`);
          console.log(`   Token ID: ${pos.asset_id}`);
          console.log(`   Shares: ${pos.netSize.toFixed(2)}`);
          console.log(`   Entry Price: $${pos.avgBuyPrice.toFixed(4)}`);
          console.log(`   Current Sell Price: $${currentPrice.toFixed(4)}`);
          console.log(`   Cost Basis: $${costBasis.toFixed(2)}`);
          console.log(`   Current Value: $${currentValue.toFixed(2)}`);
          console.log(`   P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`);
          console.log('-'.repeat(100));
        } else {
          console.log(`\n⚠️ No price data for ${marketTitle}`);
          console.log(`   Token ID: ${pos.asset_id}`);
          console.log(`   API Response:`, JSON.stringify(priceData));
          console.log('-'.repeat(100));
        }
      } else {
        console.log(`\n❌ API Error for ${marketTitle}`);
        console.log(`   Status: ${priceResponse.status}`);
        console.log(`   Token ID: ${pos.asset_id}`);
        const errorText = await priceResponse.text();
        console.log(`   Response: ${errorText}`);
        console.log('-'.repeat(100));
      }
    } catch (error: any) {
      console.log(`\n❌ Fetch Error for ${marketTitle}`);
      console.log(`   Token ID: ${pos.asset_id}`);
      console.log(`   Error: ${error.message}`);
      console.log('-'.repeat(100));
    }
  }

  console.log('\n' + '='.repeat(100));
  console.log('✅ Price fetch test complete!');
}

// Run the test
testPriceFetching().catch(console.error);
