import type { NextApiRequest, NextApiResponse } from 'next';
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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const privateKey = process.env.WALLET_PRIVATE_KEY?.replace(/'/g, '');
    const apiKey = process.env.CLOB_API_KEY?.replace(/'/g, '');
    const secret = process.env.CLOB_SECRET?.replace(/'/g, '');
    const passphrase = process.env.CLOB_PASS_PHRASE?.replace(/'/g, '');
    const homeboyApiUrl = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://homeboyapi-318538657595.me-west1.run.app';

    if (!privateKey || !apiKey || !secret || !passphrase) {
      throw new Error('Missing required credentials');
    }

    console.log('🚀 Starting price fetch test...');
    console.log(`📡 Using homeboy API: ${homeboyApiUrl}`);

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
    console.log(`✅ Fetched ${allTrades.length} total trades`);

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
    console.log(`📈 Found ${activePositions.length} active positions`);

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

    // Fetch current prices from homeboy API
    console.log('💰 Fetching current SELL prices from homeboy API...');
    const results = [];

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

        const responseStatus = priceResponse.status;
        let priceData = null;
        let errorText = null;

        if (priceResponse.ok) {
          priceData = await priceResponse.json();
        } else {
          errorText = await priceResponse.text();
        }

        const currentPrice = priceData?.price ? parseFloat(priceData.price) : null;
        const costBasis = pos.avgBuyPrice * pos.netSize;
        const currentValue = currentPrice ? currentPrice * pos.netSize : null;
        const pnl = currentValue ? currentValue - costBasis : null;
        const pnlPercent = pnl ? (pnl / costBasis) * 100 : null;

        results.push({
          outcome: pos.outcome.toUpperCase(),
          marketTitle,
          tokenId: pos.asset_id,
          shares: pos.netSize,
          entryPrice: pos.avgBuyPrice,
          currentSellPrice: currentPrice,
          costBasis,
          currentValue,
          pnl,
          pnlPercent,
          apiStatus: responseStatus,
          apiResponse: priceData,
          apiError: errorText
        });

        console.log(`✅ ${pos.outcome} @ ${marketTitle.substring(0, 40)}...: $${pos.avgBuyPrice.toFixed(3)} → $${currentPrice?.toFixed(3) || 'N/A'}`);
      } catch (error: any) {
        results.push({
          outcome: pos.outcome.toUpperCase(),
          marketTitle,
          tokenId: pos.asset_id,
          shares: pos.netSize,
          entryPrice: pos.avgBuyPrice,
          error: error.message
        });
        console.log(`❌ Error for ${marketTitle}: ${error.message}`);
      }
    }

    console.log('✅ Price fetch test complete!');

    return res.status(200).json({
      success: true,
      totalPositions: activePositions.length,
      results
    });
  } catch (error: any) {
    console.error('❌ Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
