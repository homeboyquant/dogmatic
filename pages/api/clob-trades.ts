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
  buyTrades: Trade[];
  sellTrades: Trade[];
  marketTitle: string;
  status: 'active' | 'closed';
  curPrice?: number;
  cashPnl?: number;
  percentPnl?: number;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const privateKey = process.env.WALLET_PRIVATE_KEY?.replace(/'/g, '');
    const apiKey = process.env.CLOB_API_KEY?.replace(/'/g, '');
    const secret = process.env.CLOB_SECRET?.replace(/'/g, '');
    const passphrase = process.env.CLOB_PASS_PHRASE?.replace(/'/g, '');

    if (!privateKey || !apiKey || !secret || !passphrase) {
      throw new Error('Missing required credentials');
    }

    console.log('🔄 Fetching all trades from CLOB API...');

    // Create wallet and CLOB client
    const wallet = new ethers.Wallet(privateKey);
    const clobClient = new ClobClient(
      'https://clob.polymarket.com',
      137, // Polygon mainnet
      wallet,
      { key: apiKey, secret, passphrase }
    );

    // Fetch all trades (this is the source of truth, just like homeboy_monitor)
    let allTrades: Trade[] = [];
    try {
      const tradesData = await clobClient.getTrades({}, true);
      if (Array.isArray(tradesData)) {
        allTrades = tradesData as Trade[];
      }
      console.log('✅ Fetched', allTrades.length, 'trades from CLOB API');
    } catch (error: any) {
      console.error('❌ Failed to fetch trades:', error.message || error);
      throw error;
    }

    // Calculate net positions from trades (exactly like homeboy_monitor)
    const positions = new Map<string, {
      market: string;
      asset_id: string;
      outcome: string;
      netSize: number;
      avgBuyPrice: number;
      avgSellPrice: number;
      totalBought: number;
      totalSold: number;
      buyTrades: Trade[];
      sellTrades: Trade[];
      marketTitle?: string;
    }>();

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
          buyTrades: [],
          sellTrades: [],
        });
      }

      const pos = positions.get(key)!;
      const size = parseFloat(trade.size);
      const price = parseFloat(trade.price);

      if (trade.side === 'BUY') {
        // Calculate weighted average buy price
        pos.avgBuyPrice = ((pos.avgBuyPrice * pos.totalBought) + (price * size)) / (pos.totalBought + size);
        pos.totalBought += size;
        pos.netSize += size;
        pos.buyTrades.push(trade);
      } else {
        // Calculate weighted average sell price
        pos.avgSellPrice = ((pos.avgSellPrice * pos.totalSold) + (price * size)) / (pos.totalSold + size);
        pos.totalSold += size;
        pos.netSize -= size;
        pos.sellTrades.push(trade);
      }
    }

    // Sort all positions by last trade time
    const allPositions = Array.from(positions.values())
      .sort((a, b) => {
        const lastTradeA = Math.max(
          ...a.buyTrades.map(t => parseInt(t.match_time)),
          ...a.sellTrades.map(t => parseInt(t.match_time))
        );
        const lastTradeB = Math.max(
          ...b.buyTrades.map(t => parseInt(t.match_time)),
          ...b.sellTrades.map(t => parseInt(t.match_time))
        );
        return lastTradeB - lastTradeA;
      });

    // Filter active positions (netSize > 0.5 to account for rounding)
    const activePositions = allPositions.filter(pos => pos.netSize > 0.5);

    // Filter closed positions (fully sold or dust)
    const closedPositions = allPositions.filter(pos => pos.netSize <= 0.5 && pos.totalBought > 0);

    console.log(`📊 Calculated ${activePositions.length} active positions, ${closedPositions.length} closed positions`);

    // Fetch market titles for all positions
    const marketTitles = new Map<string, string>();
    const uniqueMarkets = [...new Set(allPositions.map(p => p.market))];

    const marketPromises = uniqueMarkets.map(async (marketId) => {
      try {
        const market = await clobClient.getMarket(marketId);
        return { marketId, question: market?.question };
      } catch {
        console.log(`Could not fetch market title for ${marketId}`);
        return { marketId, question: undefined };
      }
    });

    const marketResults = await Promise.all(marketPromises);
    marketResults.forEach(({ marketId, question }) => {
      if (question) {
        marketTitles.set(marketId, question);
      }
    });

    // Fetch current sell prices using homeboy API /price endpoint
    const homeboyApiUrl = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://homeboyapi-318538657595.me-west1.run.app';
    const activePositionsWithData = await Promise.all(activePositions.map(async (pos) => {
      let curPrice = pos.avgBuyPrice; // Default fallback to entry price

      try {
        // Use homeboy API to get current SELL price for this token
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
          // The homeboy API returns price nested in response object: {status: "success", response: {price: "0.72"}}
          const price = priceData?.response?.price || priceData?.price;
          if (price !== undefined) {
            const fetchedPrice = parseFloat(price);
            if (!isNaN(fetchedPrice) && fetchedPrice >= 0 && fetchedPrice <= 1) {
              curPrice = fetchedPrice;
              console.log(`✅ ${pos.outcome} @ ${pos.marketTitle?.substring(0, 40)}...: current sell price = $${curPrice.toFixed(3)} (entry: $${pos.avgBuyPrice.toFixed(3)})`);
            } else {
              console.log(`⚠️ Invalid price returned for ${pos.asset_id}: ${fetchedPrice}`);
            }
          } else {
            console.log(`⚠️ No price data returned for ${pos.asset_id}`, priceData);
          }
        } else {
          console.log(`⚠️ Price API returned ${priceResponse.status} for ${pos.asset_id}`);
        }
      } catch (error) {
        console.log(`❌ Could not fetch price for ${pos.asset_id}:`, error);
      }

      // Calculate P&L using current price
      const pnl = (curPrice - pos.avgBuyPrice) * pos.netSize;
      const pnlPercent = pos.avgBuyPrice > 0 ? ((curPrice - pos.avgBuyPrice) / pos.avgBuyPrice) * 100 : 0;

      console.log(`📊 PNL for ${pos.outcome}: cost=$${(pos.avgBuyPrice * pos.netSize).toFixed(2)}, value=$${(curPrice * pos.netSize).toFixed(2)}, pnl=$${pnl.toFixed(2)} (${pnlPercent.toFixed(1)}%)`);

      return {
        ...pos,
        marketTitle: marketTitles.get(pos.market) || 'Unknown Market',
        status: 'active' as const,
        curPrice: curPrice,
        cashPnl: pnl,
        percentPnl: pnlPercent,
      };
    }));

    const closedPositionsWithData = closedPositions.map(pos => ({
      ...pos,
      marketTitle: marketTitles.get(pos.market) || 'Unknown Market',
      status: 'closed' as const,
    }));

    // Get recent individual trades (last 20 for trade history)
    const recentTrades = allTrades
      .sort((a, b) => parseInt(b.match_time) - parseInt(a.match_time))
      .slice(0, 20)
      .map(trade => ({
        ...trade,
        marketTitle: marketTitles.get(trade.market),
      }));

    return res.status(200).json({
      orders: [],
      activePositions: activePositionsWithData,
      closedPositions: closedPositionsWithData,
      recentTrades,
      stats: {
        totalActive: activePositionsWithData.length,
        totalClosed: closedPositionsWithData.length,
        totalTrades: allTrades.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Error fetching positions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return res.status(500).json({
      error: 'Failed to fetch positions',
      details: errorMessage
    });
  }
}
